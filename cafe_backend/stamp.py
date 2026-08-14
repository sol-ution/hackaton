"""
스탬프 · 쿠폰 (WF13 마이페이지, 사장님 스탬프 관리).

규칙 (프로토타입 기준):
- 제보 시 GPS 반경 확인되면 스탬프 1개 적립
- 하루 최대 3개까지 (같은 유저 기준)
- 매장별 목표 칸수(기본 20)를 채우면 쿠폰 자동 발급 후 스탬프 리셋
- 쿠폰 사용은 매장 PIN 입력으로 처리 (유저 폰에서 사장님이 입력)

모든 데이터는 JWT에서 식별한 userId별로 분리한다.
발표용 데이터는 Render 환경변수 DEMO_KAKAO_ID와 일치하는 계정에만
최초 한 번 생성한다.
"""

import csv
import os
import random
import re
import string
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = Path(__file__).parent
STAMPS_CSV = BASE / "stamps.csv"
COUPONS_CSV = BASE / "coupons.csv"

KST = timezone(timedelta(hours=9))
_lock = threading.Lock()


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _row_int(row: dict, key: str, default: int = -1) -> int:
    try:
        return int(row.get(key, default))
    except (TypeError, ValueError):
        return default


ANONYMOUS_USER_ID = 0         # 실제 사용자와 겹치지 않는 기본값
DAILY_STAMP_LIMIT = 3         # 하루 적립 상한
DEFAULT_GOAL = 20             # 쿠폰 발급까지 필요한 칸 수
COUPON_VALID_DAYS = 30        # 쿠폰 유효기간

# 발표 계정 전용 설정. 값이 비어 있으면 어떤 계정에도 시드하지 않는다.
DEMO_KAKAO_ID = os.getenv("DEMO_KAKAO_ID", "").strip()
DEMO_FULL_COUPON_CAFE_ID = _env_int("DEMO_FULL_COUPON_CAFE_ID", 1)
DEMO_PARTIAL_STAMP_CAFE_ID = _env_int("DEMO_PARTIAL_STAMP_CAFE_ID", 2)
DEMO_PARTIAL_STAMP_COUNT = _env_int("DEMO_PARTIAL_STAMP_COUNT", 14)
OWNER_REDEEM_PIN = os.getenv("OWNER_REDEEM_PIN", "").strip()

DEMO_COUPON_CODE = "#DEMO"
DEMO_SEED_REASON = "발표용 초기 스탬프"

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


def load_stamps(user_id: int = ANONYMOUS_USER_ID) -> list[dict]:
    result = []
    for s in _read(STAMPS_CSV):
        try:
            if int(s["userId"]) == user_id:
                result.append(s)
        except (ValueError, KeyError, TypeError):
            continue
    return result


def load_coupons(user_id: int = ANONYMOUS_USER_ID) -> list[dict]:
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


def ensure_demo_account(user_id: int, kakao_id: str,
                        cafes: list[dict]) -> dict:
    """
    발표용 카카오 계정에만 시연 데이터를 최초 한 번 보장한다.

    - 카페 1: 사용 가능한 쿠폰 1장. 쿠폰 발급 뒤 새 카드가 시작된 상태라
      /api/me/stamps 에서는 0/20으로 보인다.
    - 카페 2: 14/20. 해당 카페에 제보하면 15/20이 된다.

    쿠폰과 시드 스탬프에는 고정 표식을 남기므로 재로그인해도 다시
    20/14/0으로 초기화하지 않는다.
    """
    if not DEMO_KAKAO_ID or str(kakao_id) != DEMO_KAKAO_ID:
        return {"isDemoAccount": False, "seeded": False}

    cafe_map = {int(c["id"]): c for c in cafes}
    full_cafe = cafe_map.get(DEMO_FULL_COUPON_CAFE_ID)
    partial_cafe = cafe_map.get(DEMO_PARTIAL_STAMP_CAFE_ID)
    if full_cafe is None or partial_cafe is None:
        return {
            "isDemoAccount": True,
            "seeded": False,
            "error": "발표용 카페 ID를 찾을 수 없습니다",
        }

    now = datetime.now(KST)
    changed = False

    with _lock:
        coupons = _read(COUPONS_CSV)
        demo_coupon_exists = any(
            c.get("code") == DEMO_COUPON_CODE
            and _row_int(c, "userId") == user_id
            for c in coupons
        )
        if not demo_coupon_exists:
            coupons.append({
                "code": DEMO_COUPON_CODE,
                "userId": user_id,
                "cafeId": DEMO_FULL_COUPON_CAFE_ID,
                "reward": full_cafe.get("stampReward") or "아메리카노 1잔 무료",
                "issuedAt": now.isoformat(),
                # 발표용 쿠폰이 발표 전에 만료되지 않도록 1년으로 둔다.
                "expiresAt": (now + timedelta(days=365)).isoformat(),
                "usedAt": "",
            })
            _write(COUPONS_CSV, COUPON_FIELDS, coupons)
            changed = True

        stamps = _read(STAMPS_CSV)
        demo_rows = [
            s for s in stamps
            if _row_int(s, "userId") == user_id
            and _row_int(s, "cafeId") == DEMO_PARTIAL_STAMP_CAFE_ID
            and s.get("reason") == DEMO_SEED_REASON
        ]

        # 표식이 하나라도 있으면 이미 시드한 계정이다. 이후 사용자가 만든
        # 15번째 스탬프나 쿠폰 발급 상태를 절대 되돌리지 않는다.
        if not demo_rows:
            current_count = sum(
                1 for s in stamps
                if _row_int(s, "userId") == user_id
                and _row_int(s, "cafeId") == DEMO_PARTIAL_STAMP_CAFE_ID
                and s.get("earned") == "true"
            )
            partial_goal = _row_int(partial_cafe, "stampGoal", DEFAULT_GOAL)
            target_count = min(
                max(0, DEMO_PARTIAL_STAMP_COUNT),
                max(0, partial_goal - 1),
            )
            add_count = max(0, target_count - current_count)
            # 오늘 적립 제한에 포함되지 않도록 전날 시각으로 기록한다.
            seeded_at = now - timedelta(days=1)
            for index in range(add_count):
                stamps.append({
                    "userId": user_id,
                    "cafeId": DEMO_PARTIAL_STAMP_CAFE_ID,
                    "reportedAt": (seeded_at - timedelta(minutes=index)).isoformat(),
                    "earned": "true",
                    "reason": DEMO_SEED_REASON,
                })
            if add_count:
                _write(STAMPS_CSV, STAMP_FIELDS, stamps)
                changed = True

    return {"isDemoAccount": True, "seeded": changed}


def stamp_count(cafe_id: int, user_id: int = ANONYMOUS_USER_ID) -> int:
    """해당 매장에서 현재 모은 스탬프 수 (쿠폰 발급 시 리셋된 이후 기준)."""
    total = 0
    for s in load_stamps(user_id):
        try:
            if int(s["cafeId"]) == cafe_id and s["earned"] == "true":
                total += 1
        except (ValueError, KeyError, TypeError):
            continue
    return total


def earned_today(user_id: int = ANONYMOUS_USER_ID) -> int:
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
             user_id: int = ANONYMOUS_USER_ID,
             reported_at: str | None = None) -> dict:
    """
    제보 후 스탬프 적립 시도.
    반환: {earned, reason, count, goal, couponIssued}
    """
    with _lock:
        try:
            now = datetime.fromisoformat(reported_at) if reported_at else datetime.now(KST)
        except (TypeError, ValueError):
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
               user_id: int = ANONYMOUS_USER_ID) -> dict:
    """
    쿠폰 사용 처리. 유저 폰에 PIN 입력창이 뜨고 사장님이 매장 PIN을 입력한다.
    반환: {success, message}
    """
    with _lock:
        if not re.fullmatch(r"\d{3}", pin):
            return {
                "success": False,
                "error": "invalid_pin_format",
                "message": "사장님 인증번호는 숫자 3자리여야 합니다",
            }

        expected = OWNER_REDEEM_PIN
        if not re.fullmatch(r"\d{3}", expected):
            return {
                "success": False,
                "error": "pin_not_configured",
                "message": "서버에 사장님 인증번호가 설정되지 않았습니다",
            }
        if pin != expected:
            return {
                "success": False,
                "error": "invalid_pin",
                "message": "사장님 인증번호가 올바르지 않습니다",
            }

        rows = _read(COUPONS_CSV)
        for r in rows:
            if r["code"] == code and int(r["userId"]) == user_id:
                if r["usedAt"]:
                    return {
                        "success": False,
                        "error": "already_used",
                        "message": "이미 사용된 쿠폰입니다",
                    }
                if datetime.fromisoformat(r["expiresAt"]) < datetime.now(KST):
                    return {
                        "success": False,
                        "error": "expired",
                        "message": "유효기간이 지난 쿠폰입니다",
                    }
                used_at = datetime.now(KST).isoformat()
                r["usedAt"] = used_at
                _write(COUPONS_CSV, COUPON_FIELDS, rows)
                return {
                    "success": True,
                    "message": "쿠폰 사용이 완료됐어요.",
                    "code": code,
                    "usedAt": used_at,
                }

        return {
            "success": False,
            "error": "not_found",
            "message": "쿠폰을 찾을 수 없습니다",
        }


def use_coupon_for_owner(code: str, pin: str, cafe_row: dict) -> dict:
    """사장님 화면에서 해당 매장의 쿠폰을 사용자와 무관하게 사용 처리한다."""
    with _lock:
        if not re.fullmatch(r"\d{3}", pin):
            return {"success": False, "error": "invalid_pin_format", "message": "사장님 인증번호는 숫자 3자리여야 합니다"}
        if not re.fullmatch(r"\d{3}", OWNER_REDEEM_PIN):
            return {"success": False, "error": "pin_not_configured", "message": "서버에 사장님 인증번호가 설정되지 않았습니다"}
        if pin != OWNER_REDEEM_PIN:
            return {"success": False, "error": "invalid_pin", "message": "사장님 인증번호가 올바르지 않습니다"}

        cafe_id = _row_int(cafe_row, "id")
        rows = _read(COUPONS_CSV)
        for row in rows:
            if row.get("code") != code or _row_int(row, "cafeId") != cafe_id:
                continue
            if row.get("usedAt"):
                return {"success": False, "error": "already_used", "message": "이미 사용된 쿠폰입니다"}
            if datetime.fromisoformat(row["expiresAt"]) < datetime.now(KST):
                return {"success": False, "error": "expired", "message": "유효기간이 지난 쿠폰입니다"}
            used_at = datetime.now(KST).isoformat()
            row["usedAt"] = used_at
            _write(COUPONS_CSV, COUPON_FIELDS, rows)
            return {"success": True, "message": "쿠폰 사용이 완료됐어요.", "code": code, "usedAt": used_at}

        return {"success": False, "error": "not_found", "message": "이 매장의 쿠폰을 찾을 수 없습니다"}
