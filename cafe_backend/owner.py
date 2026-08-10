"""
사장님 기능 (WF11 대시보드, WF12 매장 정보, 스탬프·쿠폰 관리).

데모라 인증은 생략하고 cafeId로 매장을 지정한다.
실서비스라면 Authorization 헤더에서 사장님 → 매장을 찾아야 한다.
"""

import csv
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

import stamp
import store

BASE = Path(__file__).parent
REGISTRATIONS_CSV = BASE / "registrations.csv"

KST = timezone(timedelta(hours=9))
_lock = threading.Lock()

REGISTRATION_FIELDS = ["requestId", "userId", "cafeName", "address",
                       "method", "value", "status", "createdAt"]


def _save_cafes(rows: list[dict]) -> None:
    fields = list(rows[0].keys())
    with open(store.CAFES_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def _find(cafe_id: int) -> dict | None:
    return next((c for c in store.load_cafes() if int(c["id"]) == cafe_id), None)


# ─────────────────────────────────────────────
# 대시보드 (WF11)
# ─────────────────────────────────────────────

def dashboard(cafe_id: int) -> dict | None:
    """오늘 우리 매장 통계 + 손님 제보와 비교."""
    cafe = _find(cafe_id)
    if cafe is None:
        return None

    now = datetime.now(KST)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 오늘 제보 수
    my_reports = store.reports_for(cafe_id)
    today_reports = [r for r in my_reports
                     if (store.safe_dt(r.get("reportedAt")) or midnight - timedelta(days=1)) >= midnight]

    # 손님 제보와 내 등록값 비교 (최근 5건)
    owner_level = store.safe_int(cafe.get("crowdLevel"))
    comparisons = []
    for r in sorted(my_reports, key=lambda x: x.get("reportedAt", ""), reverse=True)[:5]:
        lvl = store.safe_int(r.get("crowdLevel"))
        if lvl is None:
            continue
        if owner_level is None:
            verdict = "등록값 없음"
        elif lvl == owner_level:
            verdict = "내 등록과 일치"
        elif lvl > owner_level:
            verdict = "내 등록보다 혼잡"
        else:
            verdict = "내 등록보다 여유"
        comparisons.append({
            "crowdLevel": lvl,
            "verdict": verdict,
            "reportedAt": r["reportedAt"],
        })

    # 마지막 갱신 이후 경과
    updated = store.safe_dt(cafe.get("updatedAt"))
    mins_ago = int((now - updated).total_seconds() // 60) if updated else 0

    return {
        "cafeId": cafe_id,
        "cafeName": cafe["name"],
        "crowdLevel": owner_level,
        "updatedMinutesAgo": mins_ago,
        "nextCheckInMinutes": max(0, 30 - mins_ago),   # 30분마다 확인 요청
        "today": {
            "viewCount": int(cafe.get("viewCount") or 0),
            "directionCount": int(cafe.get("directionCount") or 0),
            "reportCount": len(today_reports),
        },
        "tags": cafe["tags"].split("|") if cafe.get("tags") else [],
        "comparisons": comparisons,
    }


def increment_counter(cafe_id: int, field: str) -> bool:
    """조회수/길찾기 카운터 +1 (field: viewCount | directionCount)."""
    with _lock:
        rows = store.load_cafes()
        for r in rows:
            if int(r["id"]) == cafe_id:
                r[field] = str(int(r.get(field) or 0) + 1)
                _save_cafes(rows)
                return True
        return False


# ─────────────────────────────────────────────
# 매장 정보 관리 (WF12)
# ─────────────────────────────────────────────

INFO_FIELDS = ["weekdayHours", "weekendHours", "holiday", "structureNote",
               "hasWifi", "noTimeLimit", "hasParking", "hasSmokingRoom",
               "totalSeats", "seatsSolo", "seatsPair", "seatsGroup"]


def get_store_info(cafe_id: int) -> dict | None:
    cafe = _find(cafe_id)
    if cafe is None:
        return None

    def b(v):
        return v == "true"

    def i(v):
        return int(v) if v not in ("", None) else None

    return {
        "cafeId": cafe_id,
        "cafeName": cafe["name"],
        "weekdayHours": cafe.get("weekdayHours") or None,
        "weekendHours": cafe.get("weekendHours") or None,
        "holiday": cafe.get("holiday") or None,
        "structureNote": cafe.get("structureNote") or None,
        "amenities": {
            "outlet": cafe.get("outletLevel") == "many",
            "wifi": b(cafe.get("hasWifi", "")),
            "quiet": "quiet" in (cafe.get("tags") or ""),
            "noTimeLimit": b(cafe.get("noTimeLimit", "")),
            "smokingRoom": b(cafe.get("hasSmokingRoom", "")),
            "parking": b(cafe.get("hasParking", "")),
        },
        "seats": {
            "total": i(cafe.get("totalSeats")),
            "solo": i(cafe.get("seatsSolo")),
            "pair": i(cafe.get("seatsPair")),
            "group": i(cafe.get("seatsGroup")),
        },
    }


def update_store_info(cafe_id: int, patch: dict) -> dict | None:
    """매장 정보 저장. patch에 담긴 필드만 반영."""
    with _lock:
        rows = store.load_cafes()
        target = None
        for r in rows:
            if int(r["id"]) == cafe_id:
                target = r
                break
        if target is None:
            return None

        for key in ("weekdayHours", "weekendHours", "holiday", "structureNote"):
            if patch.get(key) is not None:
                target[key] = patch[key]

        amenities = patch.get("amenities") or {}
        bool_map = {
            "wifi": "hasWifi",
            "noTimeLimit": "noTimeLimit",
            "parking": "hasParking",
            "smokingRoom": "hasSmokingRoom",
        }
        for k, col in bool_map.items():
            if k in amenities:
                target[col] = "true" if amenities[k] else "false"

        # 콘센트/조용함은 기존 필드(outletLevel, tags)에 반영
        if "outlet" in amenities:
            target["outletLevel"] = "many" if amenities["outlet"] else "normal"
        if "quiet" in amenities:
            tags = [t for t in (target.get("tags") or "").split("|") if t]
            if amenities["quiet"] and "quiet" not in tags:
                tags.append("quiet")
            elif not amenities["quiet"] and "quiet" in tags:
                tags.remove("quiet")
            target["tags"] = "|".join(tags)

        seats = patch.get("seats") or {}
        seat_map = {"total": "totalSeats", "solo": "seatsSolo",
                    "pair": "seatsPair", "group": "seatsGroup"}
        for k, col in seat_map.items():
            if seats.get(k) is not None:
                target[col] = str(seats[k])

        target["updatedAt"] = datetime.now(KST).isoformat()
        _save_cafes(rows)
        return get_store_info(cafe_id)


# ─────────────────────────────────────────────
# 스탬프 · 쿠폰 관리 (사장님)
# ─────────────────────────────────────────────

def stamp_settings(cafe_id: int) -> dict | None:
    cafe = _find(cafe_id)
    if cafe is None:
        return None
    return {
        "cafeId": cafe_id,
        "reward": cafe.get("stampReward") or "",
        "goal": int(cafe.get("stampGoal") or stamp.DEFAULT_GOAL),
        "dailyLimit": int(cafe.get("dailyStampLimit") or stamp.DAILY_STAMP_LIMIT),
        "radiusMeters": int(cafe.get("stampRadius") or 100),
        "validDays": int(cafe.get("couponValidDays") or stamp.COUPON_VALID_DAYS),
        "ownerPin": cafe.get("ownerPin") or "",
    }


def update_stamp_settings(cafe_id: int, patch: dict) -> dict | None:
    """스탬프/쿠폰 발행 조건 저장."""
    with _lock:
        rows = store.load_cafes()
        target = next((r for r in rows if int(r["id"]) == cafe_id), None)
        if target is None:
            return None

        mapping = {
            "reward": "stampReward",
            "goal": "stampGoal",
            "dailyLimit": "dailyStampLimit",
            "radiusMeters": "stampRadius",
            "validDays": "couponValidDays",
            "ownerPin": "ownerPin",
        }
        for k, col in mapping.items():
            if patch.get(k) is not None:
                target[col] = str(patch[k])

        _save_cafes(rows)
        return stamp_settings(cafe_id)


def coupon_management(cafe_id: int) -> dict:
    """사장님 쿠폰 관리 - 사용 대기 / 처리 완료 + 이번 달 통계."""
    all_coupons = []
    if stamp.COUPONS_CSV.exists():
        with open(stamp.COUPONS_CSV, encoding="utf-8-sig") as f:
            all_coupons = [c for c in csv.DictReader(f)
                           if int(c["cafeId"]) == cafe_id]

    now = datetime.now(KST)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    pending, done = [], []
    for c in all_coupons:
        item = {
            "code": c["code"],
            "reward": c["reward"],
            "issuedAt": c["issuedAt"],
            "usedAt": c["usedAt"] or None,
        }
        (done if c["usedAt"] else pending).append(item)

    pending.sort(key=lambda x: x["issuedAt"], reverse=True)
    done.sort(key=lambda x: x["usedAt"], reverse=True)

    # 이번 달 통계
    issued_this_month = sum(1 for c in all_coupons
                            if (store.safe_dt(c.get("issuedAt")) or month_start - timedelta(days=1)) >= month_start)
    used_this_month = sum(1 for c in all_coupons
                          if c.get("usedAt")
                          and (store.safe_dt(c["usedAt"]) or month_start - timedelta(days=1)) >= month_start)
    stamps_this_month = 0
    if stamp.STAMPS_CSV.exists():
        with open(stamp.STAMPS_CSV, encoding="utf-8-sig") as f:
            stamps_this_month = sum(
                1 for s in csv.DictReader(f)
                if store.safe_int(s.get("cafeId")) == cafe_id and s.get("earned") in ("true", "used")
                and (store.safe_dt(s.get("reportedAt")) or month_start - timedelta(days=1)) >= month_start
            )

    return {
        "cafeId": cafe_id,
        "thisMonth": {
            "stampsEarned": stamps_this_month,
            "couponsIssued": issued_this_month,
            "couponsUsed": used_this_month,
        },
        "pendingCount": len(pending),
        "pending": pending,
        "completed": done[:10],
    }


# ─────────────────────────────────────────────
# 새 카페 등록 신청 (WF10)
# ─────────────────────────────────────────────

def create_registration(cafe_name: str, address: str, method: str,
                        value: str, user_id: int = 1) -> dict:
    """사업자등록번호/전화번호 인증 신청 접수 (실제 인증은 하지 않음)."""
    with _lock:
        rows = []
        if REGISTRATIONS_CSV.exists():
            with open(REGISTRATIONS_CSV, encoding="utf-8-sig") as f:
                rows = list(csv.DictReader(f))
        next_id = max((int(r["requestId"]) for r in rows), default=0) + 1
        row = {
            "requestId": next_id,
            "userId": user_id,
            "cafeName": cafe_name,
            "address": address,
            "method": method,
            "value": value,
            "status": "pending",
            "createdAt": datetime.now(KST).isoformat(),
        }
        exists = REGISTRATIONS_CSV.exists()
        with open(REGISTRATIONS_CSV, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=REGISTRATION_FIELDS)
            if not exists:
                w.writeheader()
            w.writerow(row)
        return row
