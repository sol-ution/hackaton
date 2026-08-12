"""
카카오 로그인 (OAuth 2.0) + 우리 서비스용 JWT.

흐름:
  1. 프론트가 카카오 로그인 화면으로 보냄 → 인가 코드(code) 받음
  2. 프론트가 code를 POST /api/auth/kakao 로 넘김
  3. 백엔드가 카카오에 code → 액세스 토큰 교환
  4. 그 토큰으로 카카오에서 사용자 정보(id, 닉네임) 조회
  5. 우리 서비스 JWT를 만들어 프론트에 반환
  6. 이후 요청은 Authorization: Bearer <JWT>

정책:
   신규 카카오 계정은 즐겨찾기 0, 제보 0으로 시작한다.
   같은 계정으로 다시 로그인하면 kakaoId로 기존 userId를 찾아
   본인이 만든 기록이 그대로 이어진다.
"""

import csv
import os
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import Header, HTTPException
from jose import JWTError, jwt

BASE = Path(__file__).parent
USERS_CSV = BASE / "users.csv"

KST = timezone(timedelta(hours=9))
_lock = threading.Lock()

# ── 설정 (.env에서 읽음) ──
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY", "")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "zari-demo-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

ANONYMOUS_USER_ID = 0     # 실제 users.csv에 존재하지 않는 비로그인 전용 값

USER_FIELDS = ["userId", "kakaoId", "nickname", "profileImage",
               "isOwner", "ownerCafeId", "joinedAt"]

KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me"


def _read_users() -> list[dict]:
    if not USERS_CSV.exists():
        return []
    try:
        with open(USERS_CSV, encoding="utf-8-sig") as f:
            return list(csv.DictReader(f))
    except Exception:
        return []


def _write_users(rows: list[dict]) -> None:
    with open(USERS_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=USER_FIELDS)
        w.writeheader()
        w.writerows(rows)


def find_user(user_id: int) -> dict | None:
    for u in _read_users():
        try:
            if int(u["userId"]) == user_id:
                return u
        except (ValueError, KeyError, TypeError):
            continue
    return None


def _find_by_kakao(kakao_id: str) -> dict | None:
    return next((u for u in _read_users() if u.get("kakaoId") == str(kakao_id)), None)


def upsert_user(kakao_id: str, nickname: str, profile_image: str) -> dict:
    """
    카카오 사용자를 우리 유저로 등록/조회.
    - 이미 가입한 kakaoId면 기존 userId를 그대로 돌려준다 (기록 이어짐)
    - 처음 보는 kakaoId면 새 userId를 발급한다 (모든 기록 0에서 시작)
    """
    with _lock:
        rows = _read_users()
        existing = next((u for u in rows if u.get("kakaoId") == str(kakao_id)), None)
        if existing:
            # 닉네임이 바뀌었으면 갱신
            if nickname and existing.get("nickname") != nickname:
                existing["nickname"] = nickname
                _write_users(rows)
            return existing

        # 신규 계정은 항상 새 userId로 추가한다 (즐겨찾기·제보 0에서 시작)
        ids = []
        for u in rows:
            try:
                ids.append(int(u["userId"]))
            except (ValueError, KeyError, TypeError):
                continue
        new_id = max(ids, default=0) + 1
        row = {
            "userId": new_id,
            "kakaoId": str(kakao_id),
            "nickname": nickname or f"자리요러{new_id}",
            "profileImage": profile_image or "",
            "isOwner": "false",
            "ownerCafeId": "",
            "joinedAt": datetime.now(KST).isoformat(),
        }
        rows.append(row)
        _write_users(rows)
        return row


async def exchange_kakao_code(code: str, redirect_uri: str) -> dict:
    """인가 코드 → 카카오 액세스 토큰 → 사용자 정보."""
    if not KAKAO_REST_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="KAKAO_REST_API_KEY가 설정되지 않았습니다 (.env 확인)")

    data = {
        "grant_type": "authorization_code",
        "client_id": KAKAO_REST_API_KEY,
        "redirect_uri": redirect_uri,
        "code": code,
    }
    if KAKAO_CLIENT_SECRET:
        data["client_secret"] = KAKAO_CLIENT_SECRET

    async with httpx.AsyncClient(timeout=10) as client:
        # 1) 토큰 교환
        r = await client.post(
            KAKAO_TOKEN_URL, data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        if r.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"카카오 토큰 교환 실패: {r.text[:200]}")
        access_token = r.json().get("access_token")

        # 2) 사용자 정보 조회
        r2 = await client.get(
            KAKAO_USER_URL,
            headers={"Authorization": f"Bearer {access_token}"})
        if r2.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"카카오 사용자 조회 실패: {r2.text[:200]}")
        info = r2.json()

    kakao_id = str(info.get("id"))
    props = info.get("properties") or {}
    nickname = props.get("nickname", "")
    profile_image = props.get("profile_image", "")
    return {"kakaoId": kakao_id, "nickname": nickname, "profileImage": profile_image}


def create_token(user: dict) -> str:
    """우리 서비스 JWT 발급."""
    payload = {
        "sub": str(user["userId"]),
        "nickname": user.get("nickname", ""),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode(token: str) -> int | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


def current_user_id(authorization: str | None = Header(default=None)) -> int:
    """
    로그인 필수 엔드포인트용 의존성.
    Authorization: Bearer <token> 헤더에서 userId를 꺼낸다.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    user_id = _decode(authorization.split(" ", 1)[1].strip())
    if user_id is None:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
    return user_id


def optional_user_id(authorization: str | None = Header(default=None)) -> int:
    """
    로그인 선택 엔드포인트용.
    토큰이 없거나 잘못돼도 막지 않고 데모 유저로 취급한다.
    (지도·카페 목록은 비로그인도 볼 수 있어야 하므로)
    """
    if authorization and authorization.lower().startswith("bearer "):
        user_id = _decode(authorization.split(" ", 1)[1].strip())
        if user_id is not None:
            return user_id
    return ANONYMOUS_USER_ID
