"""
CSV 데이터 로딩 + 제보 저장.
데모용이라 DB 없이 CSV로 처리. 제보 추가는 락으로 동시성 보호.
"""

import csv
import logging
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = Path(__file__).parent
CAFES_CSV = BASE / "cafes.csv"
REPORTS_CSV = BASE / "reports.csv"
FAVORITES_CSV = BASE / "favorites.csv"
NOTICES_CSV = BASE / "notices.csv"
INQUIRIES_CSV = BASE / "inquiries.csv"

KST = timezone(timedelta(hours=9))
_write_lock = threading.Lock()
log = logging.getLogger("zari")


def safe_dt(value) -> datetime | None:
    """ISO 문자열을 datetime으로. 깨져 있으면 None."""
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def safe_int(value, default=None):
    """문자열을 int로. 실패하면 default."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

REPORT_FIELDS = [
    "cafeId", "crowdLevel", "quietScore", "restroomScore", "outletLevel",
    "smokingRoom", "visitCount", "note", "nickname", "reportedAt",
]


def _safe_read(path: Path, label: str) -> list[dict]:
    """
    CSV를 안전하게 읽는다.
    파일이 없거나 인코딩이 깨져도 서버가 죽지 않고 빈 목록을 돌려준다.
    (발표 중 CSV 하나 때문에 전체 API가 500이 되는 걸 막기 위함)
    """
    if not path.exists():
        log.warning("%s 파일이 없습니다: %s", label, path)
        return []
    try:
        with open(path, encoding="utf-8-sig") as f:
            return list(csv.DictReader(f))
    except UnicodeDecodeError:
        # 엑셀로 저장하면 cp949로 바뀌는 경우가 있어 한 번 더 시도
        try:
            with open(path, encoding="cp949") as f:
                log.warning("%s 를 cp949로 읽었습니다", label)
                return list(csv.DictReader(f))
        except Exception as e:
            log.error("%s 읽기 실패: %s", label, e)
            return []
    except Exception as e:
        log.error("%s 읽기 실패: %s", label, e)
        return []


def load_cafes() -> list[dict]:
    """cafes.csv 전체를 dict 리스트로."""
    return _safe_read(CAFES_CSV, "cafes.csv")


def load_reports() -> list[dict]:
    """reports.csv 전체를 dict 리스트로."""
    return _safe_read(REPORTS_CSV, "reports.csv")


def reports_for(cafe_id: int, reports: list[dict] | None = None) -> list[dict]:
    """특정 카페의 제보만 필터. 깨진 행은 건너뛴다."""
    if reports is None:
        reports = load_reports()
    result = []
    for r in reports:
        try:
            if int(r["cafeId"]) == cafe_id:
                result.append(r)
        except (ValueError, KeyError, TypeError):
            continue          # cafeId가 숫자가 아니면 무시
    return result


def append_report(row: dict) -> None:
    """제보 한 건을 reports.csv에 append (락으로 보호)."""
    with _write_lock:
        exists = REPORTS_CSV.exists()
        with open(REPORTS_CSV, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=REPORT_FIELDS)
            if not exists:
                writer.writeheader()
            writer.writerow(row)


LEVEL_TO_OCCUPANCY = {0: 30, 1: 70, 2: 90, 3: 100}


def update_owner_seat(cafe_id: int, crowd_level: int) -> bool:
    """
    사장님 좌석 갱신 (v3: crowdLevel만).
    crowdLevel에 맞춰 occupancyPercent와 emptySeats도 함께 갱신.
    (프론트 applyOwnerSeatUpdate와 동일한 공식 → 값 어긋남 방지)
    """
    with _write_lock:
        rows = load_cafes()
        for r in rows:
            if int(r["id"]) == cafe_id:
                occ = LEVEL_TO_OCCUPANCY[crowd_level]
                r["crowdLevel"] = str(crowd_level)
                r["occupancyPercent"] = str(occ)
                if r.get("totalSeats"):
                    r["emptySeats"] = str(round(int(r["totalSeats"]) * (1 - occ / 100)))
                r["updatedAt"] = datetime.now(KST).isoformat()
                break
        else:
            return False
        fieldnames = list(rows[0].keys())
        with open(CAFES_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        return True


# ─────────────────────────────────────────────
# 즐겨찾기 (WF13 마이페이지)
# ─────────────────────────────────────────────

DEMO_USER_ID = 1
FAVORITE_FIELDS = ["userId", "cafeId", "addedAt"]


def load_favorites(user_id: int = DEMO_USER_ID) -> list[dict]:
    """내 즐겨찾기 목록 (최근 추가순). 깨진 행은 건너뛴다."""
    rows = []
    for r in _safe_read(FAVORITES_CSV, "favorites.csv"):
        try:
            if int(r["userId"]) == user_id and int(r["cafeId"]) >= 0:
                rows.append(r)
        except (ValueError, KeyError, TypeError):
            continue
    rows.sort(key=lambda r: r.get("addedAt", ""), reverse=True)
    return rows


def is_favorite(cafe_id: int, user_id: int = DEMO_USER_ID) -> bool:
    return any(safe_int(r.get("cafeId")) == cafe_id for r in load_favorites(user_id))


def add_favorite(cafe_id: int, user_id: int = DEMO_USER_ID) -> bool:
    """즐겨찾기 추가. 이미 있으면 False."""
    with _write_lock:
        rows = _safe_read(FAVORITES_CSV, "favorites.csv")
        # 깨진 행은 여기서 정리하고 다시 쓴다
        rows = [r for r in rows
                if safe_int(r.get("userId")) is not None
                and safe_int(r.get("cafeId")) is not None]
        if any(safe_int(r.get("userId")) == user_id
               and safe_int(r.get("cafeId")) == cafe_id for r in rows):
            return False
        rows.append({
            "userId": user_id,
            "cafeId": cafe_id,
            "addedAt": datetime.now(KST).isoformat(),
        })
        with open(FAVORITES_CSV, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=FAVORITE_FIELDS)
            w.writeheader()
            w.writerows(rows)
        return True


def remove_favorite(cafe_id: int, user_id: int = DEMO_USER_ID) -> bool:
    """즐겨찾기 해제. 없으면 False."""
    with _write_lock:
        if not FAVORITES_CSV.exists():
            return False
        rows = _safe_read(FAVORITES_CSV, "favorites.csv")
        before = len(rows)
        rows = [r for r in rows
                if not (safe_int(r.get("userId")) == user_id
                        and safe_int(r.get("cafeId")) == cafe_id)]
        if len(rows) == before:
            return False
        with open(FAVORITES_CSV, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=FAVORITE_FIELDS)
            w.writeheader()
            w.writerows(rows)
        return True


# ─────────────────────────────────────────────
# 공지사항 · 문의 (WF16, WF15)
# ─────────────────────────────────────────────

NOTICE_NEW_HOURS = 24          # 이 시간 이내면 NEW 배지
INQUIRY_FIELDS = ["inquiryId", "userId", "name", "content", "createdAt"]


def load_notices() -> list[dict]:
    """공지 목록. 중요 공지가 위로, 그다음 최신순."""
    rows = _safe_read(NOTICES_CSV, "notices.csv")

    now = datetime.now(KST)
    result = []
    for r in rows:
        created = safe_dt(r.get("createdAt"))
        if created is None:
            continue
        result.append({
            "noticeId": safe_int(r.get("noticeId"), 0),
            "title": r["title"],
            "content": r["content"],
            "isImportant": r["isImportant"] == "true",
            "isNew": (now - created) <= timedelta(hours=NOTICE_NEW_HOURS),
            "createdAt": r["createdAt"],
        })
    # 중요 공지 먼저, 같은 등급이면 최신순
    result.sort(key=lambda n: (n["isImportant"], n["createdAt"]), reverse=True)
    return result


def create_inquiry(name: str, content: str, user_id: int = DEMO_USER_ID) -> dict:
    """문의 접수 (append)."""
    with _write_lock:
        rows = []
        if INQUIRIES_CSV.exists():
            with open(INQUIRIES_CSV, encoding="utf-8-sig") as f:
                rows = list(csv.DictReader(f))
        next_id = max((int(r["inquiryId"]) for r in rows), default=0) + 1
        row = {
            "inquiryId": next_id,
            "userId": user_id,
            "name": name,
            "content": content,
            "createdAt": datetime.now(KST).isoformat(),
        }
        exists = INQUIRIES_CSV.exists()
        with open(INQUIRIES_CSV, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=INQUIRY_FIELDS)
            if not exists:
                w.writeheader()
            w.writerow(row)
        return row


# ─────────────────────────────────────────────
# 제보 답글 (신뢰도 투표)
# ─────────────────────────────────────────────

REPLIES_CSV = BASE / "replies.csv"
REPLY_FIELDS = ["replyId", "reportIndex", "cafeId", "userId",
                "nickname", "agree", "content", "createdAt"]


def load_replies(cafe_id: int | None = None) -> list[dict]:
    rows = _safe_read(REPLIES_CSV, "replies.csv")
    if cafe_id is not None:
        rows = [r for r in rows if safe_int(r.get("cafeId")) == cafe_id]
    return rows


def replies_for_report(cafe_id: int, report_index: int) -> list[dict]:
    """특정 제보에 달린 답글."""
    return [
        {
            "replyId": safe_int(r.get("replyId"), 0),
            "nickname": r["nickname"],
            "agree": r["agree"] == "true",
            "content": r["content"],
            "createdAt": r["createdAt"],
        }
        for r in load_replies(cafe_id)
        if safe_int(r.get("reportIndex")) == report_index
    ]


def add_reply(cafe_id: int, report_index: int, agree: bool,
              content: str, user_id: int = DEMO_USER_ID) -> dict:
    """제보에 답글(신뢰도 투표) 달기."""
    with _write_lock:
        rows = load_replies()
        next_id = max((safe_int(r.get("replyId"), 0) for r in rows), default=0) + 1
        row = {
            "replyId": next_id,
            "reportIndex": report_index,
            "cafeId": cafe_id,
            "userId": user_id,
            "nickname": "나",
            "agree": "true" if agree else "false",
            "content": content,
            "createdAt": datetime.now(KST).isoformat(),
        }
        exists = REPLIES_CSV.exists()
        with open(REPLIES_CSV, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=REPLY_FIELDS)
            if not exists:
                w.writeheader()
            w.writerow(row)
        return row
