"""
자리(zari) 백엔드 - API_CONTRACT v3.

엔드포인트:
  GET  /api/cafes                   전체 카페 목록
  GET  /api/cafes/search            카페 검색 (WF03)
  GET  /api/cafes/{id}              단건 조회
  GET  /api/cafes/{id}/reports      카페별 제보 목록 (WF05)
  GET  /api/cafes/{id}/history      시간대별 점유율 (WF07 그래프, 더미)
  POST /api/reports                 제보 (GPS 거리체크)
  POST /api/owner/seats             사장님 좌석 갱신 (crowdLevel)
"""

import logging
import math
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import store
import forecast as forecast_mod
import stamp
import review
import owner
from crowd_rule import decide_crowd
from schemas import (
    Cafe, CrowdReportRequest, CrowdReportResponse, OwnerSeatUpdateRequest,
    ReviewCreate, ReviewUpdate, InquiryCreate,
    StoreInfoUpdate, StampSettingsUpdate, CafeRegistrationRequest, ReplyCreate,
)

KST = timezone(timedelta(hours=9))
log = logging.getLogger("zari")

# ── 설정 (계약서 §2, 프론트 제안값 그대로) ──
GPS_RADIUS_M = 150          # 제보 허용 반경 (100m 제안이나 발표장 GPS 여유로 150)
# 발표는 카페 안이 아니라 발표장에서 하므로, 브라우저가 실제 위치를 잡으면
# 반경 밖이라 제보가 전부 400으로 막힌다. 데모 중엔 True로 두고 거리만 계산해서 응답에 담는다.
DEMO_SKIP_GPS = True        # 발표 당일 True(거리검증 통과), 실서비스 False
# LAN IP는 와이파이가 바뀔 때마다 달라지므로(172.x / 192.168.x / 10.x),
# 하나씩 적지 않고 사설 IP 대역 전체를 정규식으로 허용한다.
# 발표 당일 IP가 뭐로 잡히든 CORS를 다시 손댈 필요가 없다.
CORS_ORIGIN_REGEX = (
    r"(http://(localhost|127\.0\.0\.1"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})"
    r":\d+)"
    r"|(https://zari-frontend[a-z0-9-]*\.vercel\.app)"
)

app = FastAPI(title="zari API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    """두 좌표 사이 거리(m). 프론트 distanceInMeters와 동일 공식."""
    R = 6_371_000
    to_rad = math.radians
    d_lat = to_rad(lat2 - lat1)
    d_lng = to_rad(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.sin(d_lng / 2) ** 2 * math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)))
    return 2 * R * math.asin(math.sqrt(a))


def build_cafe(row: dict, reports: list[dict], now: datetime) -> Cafe:
    """
    cafes.csv 한 행 + 제보로 Cafe 응답 객체 생성.
    행이 깨져 있으면 예외를 던지므로 호출부에서 걸러야 한다 (build_cafe_safe 사용).
    """
    my_reports = store.reports_for(int(row["id"]), reports)
    decided = decide_crowd(row, my_reports, now)

    def i(v):  # int or None
        try:
            return int(v) if v not in ("", None) else None
        except (ValueError, TypeError):
            return None

    # 최근 24시간 제보 수. reportedAt이 깨진 행은 세지 않는다.
    day_ago = now - timedelta(hours=24)
    rc24 = 0
    for r in my_reports:
        try:
            if datetime.fromisoformat(r["reportedAt"]) >= day_ago:
                rc24 += 1
        except (ValueError, KeyError, TypeError):
            continue

    return Cafe(
        id=int(row["id"]),
        name=row["name"],
        address=row["address"],
        lat=float(row["lat"]),
        lng=float(row["lng"]),
        isRegistered=row["isRegistered"] == "true",
        crowdLevel=decided["crowdLevel"],
        crowdSource=decided["crowdSource"],
        confidence=decided["confidence"],
        occupancyPercent=decided["occupancyPercent"],
        totalSeats=i(row.get("totalSeats")),
        emptySeats=i(row.get("emptySeats")),
        tags=row["tags"].split("|") if row.get("tags") else [],
        hasSmokingRoom=row.get("hasSmokingRoom") == "true",
        restroomScore=i(row.get("restroomScore")),
        quietScore=i(row.get("quietScore")),
        outletLevel=row["outletLevel"] if row.get("outletLevel") else None,
        reportCount24h=rc24,
        updatedAt=row["updatedAt"],
        structureNote=row.get("structureNote") or None,
        seatsSolo=i(row.get("seatsSolo")),
        seatsPair=i(row.get("seatsPair")),
        seatsGroup=i(row.get("seatsGroup")),
        isFavorite=store.is_favorite(int(row["id"])),
    )


def build_cafe_safe(row: dict, reports: list[dict], now: datetime) -> Cafe | None:
    """
    build_cafe를 감싸서, 한 행이 깨져도 전체 응답이 죽지 않게 한다.
    깨진 행은 로그만 남기고 목록에서 제외된다.
    """
    try:
        return build_cafe(row, reports, now)
    except Exception as e:
        log.warning("카페 행 스킵 (id=%s): %s", row.get("id"), e)
        return None


@app.get("/api/cafes", response_model=list[Cafe])
def get_cafes():
    now = datetime.now(KST)
    cafes = store.load_cafes()
    reports = store.load_reports()
    built = [build_cafe_safe(row, reports, now) for row in cafes]
    return [c for c in built if c is not None]


@app.get("/api/cafes/search")
def search_cafes(q: str):
    now = datetime.now(KST)
    reports = store.load_reports()
    keyword = q.strip().lower()

    # 이름 또는 주소에 검색어가 들어간 카페만
    results = []
    for row in store.load_cafes():
        if keyword in row.get("name", "").lower() or keyword in row.get("address", "").lower():
            cafe = build_cafe_safe(row, reports, now)
            if cafe is not None:
                results.append(cafe)
    return results


@app.get("/api/cafes/{cafe_id}", response_model=Cafe)
def get_cafe(cafe_id: int):
    now = datetime.now(KST)
    reports = store.load_reports()
    for row in store.load_cafes():
        if int(row["id"]) == cafe_id:
            return build_cafe(row, reports, now)
    raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")


@app.get("/api/cafes/{cafe_id}/reports")
def get_cafe_reports(cafe_id: int):
    # 이 카페 제보만 뽑아서 최신순 정렬
    my_reports = store.reports_for(cafe_id)
    my_reports.sort(key=lambda r: r["reportedAt"], reverse=True)

    # 프론트가 쓸 모양으로 정리 (WF05 화면: 혼잡도/시각/후기/인원/태그)
    result = []
    for idx, r in enumerate(my_reports):
        try:
            result.append({
                "reportIndex": idx,
                "replies": store.replies_for_report(cafe_id, idx),
                "cafeId": int(r["cafeId"]),
                "crowdLevel": int(r["crowdLevel"]),
                "quietScore": int(r["quietScore"]),
                "restroomScore": int(r["restroomScore"]),
                "outletLevel": r["outletLevel"],
                "smokingRoom": r["smokingRoom"],
                "visitCount": r["visitCount"],
                "note": r["note"],
                "nickname": r.get("nickname", ""),
                "reportedAt": r["reportedAt"],
            })
        except (ValueError, KeyError, TypeError) as e:
            log.warning("제보 행 스킵 (cafe=%s, idx=%s): %s", cafe_id, idx, e)
            continue

    # 오늘(자정 이후) 제보 수 — WF05 상단 "오늘 제보 12건"
    now = datetime.now(KST)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = 0
    for r in result:
        try:
            if datetime.fromisoformat(r["reportedAt"]) >= midnight:
                today_count += 1
        except (ValueError, TypeError):
            continue

    return {
        "cafeId": cafe_id,
        # WF05 상단 요약: "오늘 제보 12건 / 마지막 제보 3분 전"
        "todayCount": today_count,
        "lastReportedAt": result[0]["reportedAt"] if result else None,
        "totalCount": len(result),
        "reports": result,
    }


@app.get("/api/cafes/{cafe_id}/history")
def get_cafe_history(cafe_id: int, day: str = "wed"):
    """WF07 시간대별 점유율 그래프. day=mon~sun (평일/주말 곡선이 다름)."""
    cafe = next((r for r in store.load_cafes() if int(r["id"]) == cafe_id), None)
    if cafe is None:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    if day not in forecast_mod.WEEKDAYS:
        raise HTTPException(status_code=400, detail=f"day는 {forecast_mod.WEEKDAYS} 중 하나")

    return {
        "cafeId": cafe_id,
        "day": day,
        "points": forecast_mod.history_points(cafe_id, day),
    }


@app.get("/api/cafes/{cafe_id}/forecast")
def get_cafe_forecast(cafe_id: int, minutes: int = 12):
    """
    WF04 도착 시점 예측. minutes 후 도착했을 때의 혼잡도.
    minutes는 프론트가 도보 시간으로 계산해서 보낸다.
    """
    cafe = next((r for r in store.load_cafes() if int(r["id"]) == cafe_id), None)
    if cafe is None:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    if not 0 <= minutes <= 180:
        raise HTTPException(status_code=400, detail="minutes는 0~180 사이여야 합니다")

    return forecast_mod.forecast(cafe_id, minutes, datetime.now(KST))


@app.post("/api/reports")
def create_report(body: CrowdReportRequest):
    # 카페 찾기
    cafe = next((r for r in store.load_cafes() if int(r["id"]) == body.cafeId), None)
    if cafe is None:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")

    # GPS 거리 체크 (DEMO_SKIP_GPS=True면 거리 멀어도 통과, 거리값은 응답에 담김)
    dist = haversine_m(float(cafe["lat"]), float(cafe["lng"]), body.userLat, body.userLng)
    if not DEMO_SKIP_GPS and dist > GPS_RADIUS_M:
        raise HTTPException(
            status_code=400,
            detail=f"카페 반경 {GPS_RADIUS_M}m 밖입니다 (현재 {dist:.1f}m)",
        )

    # 저장
    store.append_report({
        "cafeId": body.cafeId,
        "crowdLevel": int(body.crowdLevel),
        "quietScore": body.quietScore,
        "restroomScore": body.restroomScore,
        "outletLevel": body.outletLevel.value,
        "smokingRoom": body.smokingRoom.value,
        "visitCount": body.visitCount.value,
        "note": body.note,
        # 로그인이 스텁이라 새 제보는 "나"로 고정 (데모에서 방금 넣은 제보가 눈에 띄게)
        "nickname": "나",
        "reportedAt": datetime.now(KST).isoformat(),
    })
    # 스탬프 적립 시도 (GPS 반경 안에서 제보한 경우만 적립)
    gps_ok = dist <= GPS_RADIUS_M
    stamp_result = stamp.try_earn(body.cafeId, gps_ok, cafe)

    return {
        "success": True,
        "distanceMeters": round(dist, 1),
        "stamp": stamp_result,
    }


@app.post("/api/owner/seats")
def update_owner_seats(body: OwnerSeatUpdateRequest):
    # (데모: 인증 생략. 실제론 Authorization 헤더 검증)
    ok = store.update_owner_seat(body.cafeId, int(body.crowdLevel))
    if not ok:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    return {"success": True, "cafeId": body.cafeId, "crowdLevel": int(body.crowdLevel)}


# ─────────────────────────────────────────────
# 스탬프 · 쿠폰 (WF13 마이페이지)
# ─────────────────────────────────────────────

@app.get("/api/me/stamps")
def get_my_stamps():
    """매장별 스탬프 적립 현황."""
    cafes = {int(c["id"]): c for c in store.load_cafes()}
    result = []
    for cafe_id, cafe in cafes.items():
        if not cafe.get("stampGoal"):
            continue                       # 스탬프 운영 안 하는 매장은 제외
        count = stamp.stamp_count(cafe_id)
        goal = int(cafe["stampGoal"])
        result.append({
            "cafeId": cafe_id,
            "cafeName": cafe["name"],
            "reward": cafe.get("stampReward", ""),
            "count": count,
            "goal": goal,
            "remaining": max(0, goal - count),
        })
    return {
        "earnedToday": stamp.earned_today(),
        "dailyLimit": stamp.DAILY_STAMP_LIMIT,
        "cards": result,
    }


@app.get("/api/me/coupons")
def get_my_coupons():
    """내 쿠폰 목록 (사용 가능 / 사용 완료)."""
    cafes = {int(c["id"]): c["name"] for c in store.load_cafes()}
    result = []
    for c in stamp.load_coupons():
        result.append({
            "code": c["code"],
            "cafeId": int(c["cafeId"]),
            "cafeName": cafes.get(int(c["cafeId"]), ""),
            "reward": c["reward"],
            "issuedAt": c["issuedAt"],
            "expiresAt": c["expiresAt"],
            "used": bool(c["usedAt"]),
            "usedAt": c["usedAt"] or None,
        })
    available = [c for c in result if not c["used"]]
    return {"availableCount": len(available), "coupons": result}


@app.post("/api/coupons/{code}/use")
def use_coupon(code: str, pin: str):
    """
    쿠폰 사용 처리. 유저 폰에 PIN 입력창이 뜨고 사장님이 매장 PIN을 입력한다.
    code는 URL에 '#'이 들어가므로 프론트에서 인코딩 필요 (%23A3F9).
    """
    coupon = next((c for c in stamp.load_coupons() if c["code"] == code), None)
    if coupon is None:
        raise HTTPException(status_code=404, detail="쿠폰을 찾을 수 없습니다")

    cafe = next((r for r in store.load_cafes()
                 if int(r["id"]) == int(coupon["cafeId"])), None)
    if cafe is None:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다")

    result = stamp.use_coupon(code, pin, cafe)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/me/reports")
def get_my_reports():
    """내 제보 내역 (적립 여부 포함) - WF18."""
    cafes = {int(c["id"]): c["name"] for c in store.load_cafes()}
    stamps = stamp.load_stamps()

    result = []
    for s in sorted(stamps, key=lambda x: x["reportedAt"], reverse=True):
        result.append({
            "cafeId": int(s["cafeId"]),
            "cafeName": cafes.get(int(s["cafeId"]), ""),
            "reportedAt": s["reportedAt"],
            "earned": s["earned"] == "true",
            "reason": s["reason"],
        })

    earned = sum(1 for r in result if r["earned"])
    return {
        "totalCount": len(result),
        "earnedCount": earned,
        "notEarnedCount": len(result) - earned,
        "reports": result,
    }


# ─────────────────────────────────────────────
# 즐겨찾기 (WF13 마이페이지)
# ─────────────────────────────────────────────

@app.get("/api/me/favorites")
def get_my_favorites():
    """즐겨찾기한 카페 목록 (혼잡도 포함)."""
    now = datetime.now(KST)
    reports = store.load_reports()
    cafes = {int(c["id"]): c for c in store.load_cafes()}

    result = []
    for fav in store.load_favorites():
        row = cafes.get(int(fav["cafeId"]))
        if row is None:
            continue                       # 삭제된 카페는 건너뜀
        cafe = build_cafe_safe(row, reports, now)
        if cafe is None:
            continue
        result.append({
            "cafe": cafe,
            "addedAt": fav["addedAt"],
        })
    return {"count": len(result), "favorites": result}


@app.post("/api/cafes/{cafe_id}/favorite")
def add_favorite(cafe_id: int):
    """즐겨찾기 추가 (별 채우기)."""
    if not any(int(c["id"]) == cafe_id for c in store.load_cafes()):
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    added = store.add_favorite(cafe_id)
    return {"success": True, "cafeId": cafe_id, "isFavorite": True,
            "message": "즐겨찾기에 추가했습니다" if added else "이미 즐겨찾기입니다"}


@app.delete("/api/cafes/{cafe_id}/favorite")
def remove_favorite(cafe_id: int):
    """즐겨찾기 해제 (별 비우기)."""
    removed = store.remove_favorite(cafe_id)
    if not removed:
        raise HTTPException(status_code=404, detail="즐겨찾기에 없는 카페입니다")
    return {"success": True, "cafeId": cafe_id, "isFavorite": False,
            "message": "즐겨찾기를 해제했습니다"}


# ─────────────────────────────────────────────
# 리뷰 (WF19 내 활동)
# ─────────────────────────────────────────────

@app.get("/api/me/reviews")
def get_my_reviews():
    """내가 쓴 리뷰 목록 (최신순)."""
    cafes = {int(c["id"]): c["name"] for c in store.load_cafes()}
    result = []
    for r in review.load_reviews():
        result.append({**r, "cafeName": cafes.get(r["cafeId"], "")})
    return {"count": len(result), "reviews": result}


@app.get("/api/cafes/{cafe_id}/reviews")
def get_cafe_reviews(cafe_id: int):
    """카페의 리뷰 전체 + 평균 별점."""
    if not any(int(c["id"]) == cafe_id for c in store.load_cafes()):
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    summary = review.rating_summary(cafe_id)
    return {**summary, "reviews": review.reviews_for_cafe(cafe_id)}


@app.post("/api/reviews")
def create_review(body: ReviewCreate):
    """리뷰 작성."""
    if not any(int(c["id"]) == body.cafeId for c in store.load_cafes()):
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    created = review.create(body.cafeId, body.rating, body.content, body.tags)
    return {"success": True, "review": created}


@app.patch("/api/reviews/{review_id}")
def update_review(review_id: int, body: ReviewUpdate):
    """리뷰 수정 (보낸 필드만 변경)."""
    updated = review.update(review_id, body.rating, body.content, body.tags)
    if updated is None:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다")
    return {"success": True, "review": updated}


@app.delete("/api/reviews/{review_id}")
def delete_review(review_id: int):
    """리뷰 삭제."""
    if not review.delete(review_id):
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다")
    return {"success": True, "reviewId": review_id}


# ─────────────────────────────────────────────
# 공지사항 · 문의 (WF16, WF15)
# ─────────────────────────────────────────────

@app.get("/api/notices")
def get_notices():
    """공지 목록. 중요 공지가 위로, NEW 배지 포함."""
    notices = store.load_notices()
    return {
        "count": len(notices),
        "unreadCount": sum(1 for n in notices if n["isNew"]),
        "notices": notices,
    }


@app.post("/api/inquiries")
def create_inquiry(body: InquiryCreate):
    """문의 접수 (WF15 문의하기)."""
    created = store.create_inquiry(body.name, body.content)
    return {
        "success": True,
        "inquiryId": created["inquiryId"],
        "message": "문의가 접수되었습니다. 영업일 기준 1~2일 내 답변드립니다.",
    }


# ─────────────────────────────────────────────
# 사장님 - 대시보드 · 매장정보 (WF11, WF12)
# ─────────────────────────────────────────────

@app.get("/api/owner/{cafe_id}/dashboard")
def owner_dashboard(cafe_id: int):
    """오늘 우리 매장 (조회/길찾기/제보) + 손님 제보와 비교."""
    data = owner.dashboard(cafe_id)
    if data is None:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    return data


@app.get("/api/owner/{cafe_id}/info")
def get_store_info(cafe_id: int):
    """매장 정보 조회 (영업시간·편의시설·좌석 구성)."""
    data = owner.get_store_info(cafe_id)
    if data is None:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    return data


@app.patch("/api/owner/{cafe_id}/info")
def update_store_info(cafe_id: int, body: StoreInfoUpdate):
    """매장 정보 저장 (WF12 저장하기)."""
    patch = body.model_dump(exclude_none=True)
    if "amenities" in patch:
        patch["amenities"] = {k: v for k, v in patch["amenities"].items() if v is not None}
    if "seats" in patch:
        patch["seats"] = {k: v for k, v in patch["seats"].items() if v is not None}

    data = owner.update_store_info(cafe_id, patch)
    if data is None:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    return {"success": True, "info": data}


@app.post("/api/cafes/{cafe_id}/view")
def count_view(cafe_id: int):
    """카페 상세 조회수 +1 (사장님 통계용)."""
    if not owner.increment_counter(cafe_id, "viewCount"):
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    return {"success": True}


@app.post("/api/cafes/{cafe_id}/directions")
def count_directions(cafe_id: int):
    """길찾기 클릭수 +1 (사장님 통계용)."""
    if not owner.increment_counter(cafe_id, "directionCount"):
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    return {"success": True}


# ─────────────────────────────────────────────
# 사장님 - 스탬프 · 쿠폰 관리
# ─────────────────────────────────────────────

@app.get("/api/owner/{cafe_id}/stamp-settings")
def get_stamp_settings(cafe_id: int):
    """스탬프·쿠폰 발행 조건 조회."""
    data = owner.stamp_settings(cafe_id)
    if data is None:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    return data


@app.patch("/api/owner/{cafe_id}/stamp-settings")
def update_stamp_settings(cafe_id: int, body: StampSettingsUpdate):
    """스탬프·쿠폰 발행 조건 저장."""
    data = owner.update_stamp_settings(cafe_id, body.model_dump(exclude_none=True))
    if data is None:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    return {"success": True, "settings": data}


@app.get("/api/owner/{cafe_id}/coupons")
def owner_coupons(cafe_id: int):
    """사용 대기 / 처리 완료 쿠폰 + 이번 달 통계."""
    if not any(int(c["id"]) == cafe_id for c in store.load_cafes()):
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    return owner.coupon_management(cafe_id)


# ─────────────────────────────────────────────
# 새 카페 등록 신청 (WF10)
# ─────────────────────────────────────────────

@app.post("/api/cafe-registrations")
def register_cafe(body: CafeRegistrationRequest):
    """사업자등록번호 / 전화번호 인증 신청 접수."""
    created = owner.create_registration(
        body.cafeName, body.address, body.method, body.value)
    return {
        "success": True,
        "requestId": created["requestId"],
        "status": "pending",
        "message": "인증 요청이 접수되었습니다. 영업일 1일 이내 알림으로 안내됩니다.",
    }


# ─────────────────────────────────────────────
# 제보 답글 (신뢰도 투표)
# ─────────────────────────────────────────────

@app.post("/api/cafes/{cafe_id}/reports/{report_index}/replies")
def add_reply(cafe_id: int, report_index: int, body: ReplyCreate):
    """제보에 답글 달기 (동의/비동의)."""
    reports = store.reports_for(cafe_id)
    if not 0 <= report_index < len(reports):
        raise HTTPException(status_code=404, detail="제보를 찾을 수 없습니다")
    created = store.add_reply(cafe_id, report_index, body.agree, body.content)
    return {"success": True, "replyId": created["replyId"]}


@app.get("/")
def health():
    return {"status": "ok", "service": "zari API v3"}
