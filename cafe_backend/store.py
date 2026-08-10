"""
CSV 데이터 로딩 + 제보 저장.
데모용이라 DB 없이 CSV로 처리. 제보 추가는 락으로 동시성 보호.
"""

import csv
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = Path(__file__).parent
CAFES_CSV = BASE / "cafes.csv"
REPORTS_CSV = BASE / "reports.csv"
FAVORITES_CSV = BASE / "favorites.csv"

KST = timezone(timedelta(hours=9))
_write_lock = threading.Lock()

REPORT_FIELDS = [
    "cafeId", "crowdLevel", "quietScore", "restroomScore", "outletLevel",
    "smokingRoom", "visitCount", "note", "nickname", "reportedAt",
]


def load_cafes() -> list[dict]:
    """cafes.csv 전체를 dict 리스트로."""
    with open(CAFES_CSV, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def load_reports() -> list[dict]:
    """reports.csv 전체를 dict 리스트로."""
    if not REPORTS_CSV.exists():
        return []
    with open(REPORTS_CSV, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def reports_for(cafe_id: int, reports: list[dict] | None = None) -> list[dict]:
    """특정 카페의 제보만 필터."""
    if reports is None:
        reports = load_reports()
    return [r for r in reports if int(r["cafeId"]) == cafe_id]


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
    """내 즐겨찾기 목록 (최근 추가순)."""
    if not FAVORITES_CSV.exists():
        return []
    with open(FAVORITES_CSV, encoding="utf-8-sig") as f:
        rows = [r for r in csv.DictReader(f) if int(r["userId"]) == user_id]
    rows.sort(key=lambda r: r["addedAt"], reverse=True)
    return rows


def is_favorite(cafe_id: int, user_id: int = DEMO_USER_ID) -> bool:
    return any(int(r["cafeId"]) == cafe_id for r in load_favorites(user_id))


def add_favorite(cafe_id: int, user_id: int = DEMO_USER_ID) -> bool:
    """즐겨찾기 추가. 이미 있으면 False."""
    with _write_lock:
        rows = []
        if FAVORITES_CSV.exists():
            with open(FAVORITES_CSV, encoding="utf-8-sig") as f:
                rows = list(csv.DictReader(f))
        if any(int(r["userId"]) == user_id and int(r["cafeId"]) == cafe_id for r in rows):
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
        with open(FAVORITES_CSV, encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        before = len(rows)
        rows = [r for r in rows
                if not (int(r["userId"]) == user_id and int(r["cafeId"]) == cafe_id)]
        if len(rows) == before:
            return False
        with open(FAVORITES_CSV, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=FAVORITE_FIELDS)
            w.writeheader()
            w.writerows(rows)
        return True