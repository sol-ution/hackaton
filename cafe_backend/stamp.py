"""
스탬프 · 쿠폰 (WF13 마이페이지, 사장님 스탬프 관리).

규칙 (프로토타입 기준):
- 제보 시 GPS 반경 확인되면 스탬프 1개 적립
- 하루 최대 3개까지 (같은 유저 기준)
- 매장별 목표 칸수(기본 20)를 채우면 쿠폰 자동 발급 후 스탬프 리셋
- 쿠폰 사용은 매장 PIN 입력으로 처리 (유저 폰에서 사장님이 입력)

데모라 유저는 1명 고정(userId=1, "자리요러").
"""

import csv
import random
import string
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = Path(__file__).parent
STAMPS_CSV = BASE / "stamps.csv"
COUPONS_CSV = BASE / "coupons.csv"

KST = timezone(timedelta(hours=9))
_lock = threading.Lock()

DEMO_USER_ID = 1              # 데모 유저 고정
DAILY_STAMP_LIMIT = 3         # 하루 적립 상한
DEFAULT_GOAL = 20             # 쿠폰 발급까지 필요한 칸 수
COUPON_VALID_DAYS = 30        # 쿠폰 유효기간

STAMP_FIELDS = ["userId", "cafeId", "reportedAt", "earned", "reason"]
COUPON_FIELDS = ["code", "userId", "cafeId", "reward", "issuedAt", "expiresAt", "usedAt"]


def _read(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        with open(path, encoding="utf-8-sig") as f:
            return list(csv.DictReader(f))
    except Exception:
        return []


def _write(path: Path, fields: list[str], rows: list[dict]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def _append(path: Path, fields: list[str], row: dict) -> None:
    exists = path.exists()
    with open(path, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        if not exists:
            w.writeheader()
        w.writerow(row)


def load_stamps(user_id: int = DEMO_USER_ID) -> list[dict]:
    result = []
    for s in _read(STAMPS_CSV):
        try:
            if int(s["userId"]) == user_id:
                result.append(s)
        except (ValueError, KeyError, TypeError):
            continue
    return result


def load_coupons(user_id: int = DEMO_USER_ID) -> list[dict]:
    result = []
    for c in _read(COUPONS_CSV):
        try:
            if int(c["userId"]) == user_id:
                result.append(c)
        except (ValueError, KeyError, TypeError):
            continue
    return result


def _new_code() -> str:
    """쿠폰 코드 #A3F9 형태."""
    chars = string.ascii_uppercase + string.digits
    return "#" + "".join(random.choices(chars, k=4))


def stamp_count(cafe_id: int, user_id: int = DEMO_USER_ID) -> int:
    """해당 매장에서 현재 모은 스탬프 수 (쿠폰 발급 시 리셋된 이후 기준)."""
    total = 0
    for s in load_stamps(user_id):
        try:
            if int(s["cafeId"]) == cafe_id and s["earned"] == "true":
                total += 1
        except (ValueError, KeyError, TypeError):
            continue
    return total


def earned_today(user_id: int = DEMO_USER_ID) -> int:
    """오늘 적립한 스탬프 수 (하루 상한 체크용)."""
    now = datetime.now(KST)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    total = 0
    for s in load_stamps(user_id):
        try:
            if s["earned"] == "true" and datetime.fromisoformat(s["reportedAt"]) >= midnight:
                total += 1
        except (ValueError, KeyError, TypeError):
            continue
    return total


def try_earn(cafe_id: int, gps_verified: bool, cafe_row: dict,
             user_id: int = DEMO_USER_ID) -> dict:
    """
    제보 후 스탬프 적립 시도.
    반환: {earned, reason, count, goal, couponIssued}
    """
    with _lock:
        now = datetime.now(KST)
        goal = int(cafe_row.get("stampGoal") or DEFAULT_GOAL)
        reward = cafe_row.get("stampReward") or "아메리카노 1잔 무료"

        # 적립 불가 사유 판정
        if not gps_verified:
            reason = "위치가 확인되지 않음"
            earned = False
        elif earned_today(user_id) >= DAILY_STAMP_LIMIT:
            reason = f"하루 적립 상한({DAILY_STAMP_LIMIT}개) 도달"
            earned = False
        else:
            reason = "반경 확인됨"
            earned = True

        _append(STAMPS_CSV, STAMP_FIELDS, {
            "userId": user_id,
            "cafeId": cafe_id,
            "reportedAt": now.isoformat(),
            "earned": "true" if earned else "false",
            "reason": reason,
        })

        count = stamp_count(cafe_id, user_id)
        coupon = None

        # 목표 도달 시 쿠폰 발급 + 스탬프 리셋
        if earned and count >= goal:
            coupon = {
                "code": _new_code(),
                "userId": user_id,
                "cafeId": cafe_id,
                "reward": reward,
                "issuedAt": now.isoformat(),
                "expiresAt": (now + timedelta(days=COUPON_VALID_DAYS)).isoformat(),
                "usedAt": "",
            }
            _append(COUPONS_CSV, COUPON_FIELDS, coupon)

            # 이 매장 스탬프를 사용 처리(earned=used)해서 0부터 다시 시작
            rows = _read(STAMPS_CSV)
            for r in rows:
                if (int(r["userId"]) == user_id and int(r["cafeId"]) == cafe_id
                        and r["earned"] == "true"):
                    r["earned"] = "used"
            _write(STAMPS_CSV, STAMP_FIELDS, rows)
            count = 0

        return {
            "earned": earned,
            "reason": reason,
            "count": count,
            "goal": goal,
            "couponIssued": coupon,
        }


def use_coupon(code: str, pin: str, cafe_row: dict,
               user_id: int = DEMO_USER_ID) -> dict:
    """
    쿠폰 사용 처리. 유저 폰에 PIN 입력창이 뜨고 사장님이 매장 PIN을 입력한다.
    반환: {success, message}
    """
    with _lock:
        expected = cafe_row.get("ownerPin") or "1234"
        if pin != expected:
            return {"success": False, "message": "PIN이 올바르지 않습니다"}

        rows = _read(COUPONS_CSV)
        for r in rows:
            if r["code"] == code and int(r["userId"]) == user_id:
                if r["usedAt"]:
                    return {"success": False, "message": "이미 사용된 쿠폰입니다"}
                if datetime.fromisoformat(r["expiresAt"]) < datetime.now(KST):
                    return {"success": False, "message": "유효기간이 지난 쿠폰입니다"}
                r["usedAt"] = datetime.now(KST).isoformat()
                _write(COUPONS_CSV, COUPON_FIELDS, rows)
                return {"success": True, "message": "사용 완료되었습니다"}

        return {"success": False, "message": "쿠폰을 찾을 수 없습니다"}
