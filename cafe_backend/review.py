"""
리뷰 (WF19 내 활동 - 내 리뷰).

별점(1~5) + 한줄평 + 해시태그. 작성/수정/삭제 가능.
제보와 달리 리뷰는 시점 기록이 아니라 의견이라 수정이 허용된다.

데모라 유저는 1명 고정(userId=1).
"""

import csv
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = Path(__file__).parent
REVIEWS_CSV = BASE / "reviews.csv"

KST = timezone(timedelta(hours=9))
_lock = threading.Lock()

DEMO_USER_ID = 1
MAX_CONTENT = 200

REVIEW_FIELDS = ["reviewId", "userId", "cafeId", "rating",
                 "content", "tags", "createdAt", "updatedAt"]


def _read() -> list[dict]:
    if not REVIEWS_CSV.exists():
        return []
    try:
        with open(REVIEWS_CSV, encoding="utf-8-sig") as f:
            return list(csv.DictReader(f))
    except Exception:
        return []


def _write(rows: list[dict]) -> None:
    with open(REVIEWS_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=REVIEW_FIELDS)
        w.writeheader()
        w.writerows(rows)


def _to_dict(r: dict) -> dict | None:
    """CSV 한 행 → API 응답 형태. 깨진 행이면 None."""
    try:
        return {
            "reviewId": int(r["reviewId"]),
            "cafeId": int(r["cafeId"]),
            "rating": int(r["rating"]),
            "content": r["content"],
            "tags": r["tags"].split("|") if r["tags"] else [],
            "createdAt": r["createdAt"],
            "updatedAt": r["updatedAt"] or None,
        }
    except (ValueError, KeyError, TypeError):
        return None


def load_reviews(user_id: int = DEMO_USER_ID) -> list[dict]:
    """내 리뷰 (최신순). 깨진 행은 건너뛴다."""
    rows = []
    for r in _read():
        try:
            if int(r["userId"]) == user_id:
                rows.append(r)
        except (ValueError, KeyError, TypeError):
            continue
    rows.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return [d for d in (_to_dict(r) for r in rows) if d is not None]


def reviews_for_cafe(cafe_id: int) -> list[dict]:
    """특정 카페의 리뷰 전체 (최신순). 깨진 행은 건너뛴다."""
    rows = []
    for r in _read():
        try:
            if int(r["cafeId"]) == cafe_id:
                rows.append(r)
        except (ValueError, KeyError, TypeError):
            continue
    rows.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return [d for d in (_to_dict(r) for r in rows) if d is not None]


def create(cafe_id: int, rating: int, content: str, tags: list[str],
           user_id: int = DEMO_USER_ID) -> dict:
    """리뷰 작성."""
    with _lock:
        rows = _read()
        ids = []
        for r in rows:
            try:
                ids.append(int(r["reviewId"]))
            except (ValueError, KeyError, TypeError):
                continue
        next_id = max(ids, default=0) + 1
        now = datetime.now(KST).isoformat()
        row = {
            "reviewId": next_id,
            "userId": user_id,
            "cafeId": cafe_id,
            "rating": rating,
            "content": content,
            "tags": "|".join(tags),
            "createdAt": now,
            "updatedAt": "",
        }
        rows.append(row)
        _write(rows)
        return _to_dict(row)


def update(review_id: int, rating: int | None, content: str | None,
           tags: list[str] | None, user_id: int = DEMO_USER_ID) -> dict | None:
    """리뷰 수정. 없거나 남의 리뷰면 None."""
    with _lock:
        rows = _read()
        for r in rows:
            if int(r["reviewId"]) == review_id and int(r["userId"]) == user_id:
                if rating is not None:
                    r["rating"] = rating
                if content is not None:
                    r["content"] = content
                if tags is not None:
                    r["tags"] = "|".join(tags)
                r["updatedAt"] = datetime.now(KST).isoformat()
                _write(rows)
                return _to_dict(r)
        return None


def delete(review_id: int, user_id: int = DEMO_USER_ID) -> bool:
    """리뷰 삭제. 없거나 남의 리뷰면 False."""
    with _lock:
        rows = _read()
        before = len(rows)
        rows = [r for r in rows
                if not (int(r["reviewId"]) == review_id and int(r["userId"]) == user_id)]
        if len(rows) == before:
            return False
        _write(rows)
        return True


def rating_summary(cafe_id: int) -> dict:
    """카페 평균 별점 + 리뷰 수 (상세 화면용)."""
    revs = reviews_for_cafe(cafe_id)
    if not revs:
        return {"averageRating": None, "reviewCount": 0}
    avg = sum(r["rating"] for r in revs) / len(revs)
    return {"averageRating": round(avg, 1), "reviewCount": len(revs)}
