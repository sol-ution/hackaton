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

import math
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import store
import forecast as forecast_mod
from crowd_rule import decide_crowd
from schemas import (
    Cafe, CrowdReportRequest, CrowdReportResponse, OwnerSeatUpdateRequest,
)

KST = timezone(timedelta(hours=9))

# ── 설정 (계약서 §2, 프론트 제안값 그대로) ──
GPS_RADIUS_M = 150          # 제보 허용 반경 (100m 제안이나 발표장 GPS 여유로 150)
# 발표는 카페 안이 아니라 발표장에서 하므로, 브라우저가 실제 위치를 잡으면
# 반경 밖이라 제보가 전부 400으로 막힌다. 데모 중엔 True로 두고 거리만 계산해서 응답에 담는다.
DEMO_SKIP_GPS = True        # 발표 당일 True(거리검증 통과), 실서비스 False
# LAN IP는 와이파이가 바뀔 때마다 달라지므로(172.x / 192.168.x / 10.x),
# 하나씩 적지 않고 사설 IP 대역 전체를 정규식으로 허용한다.
# 발표 당일 IP가 뭐로 잡히든 CORS를 다시 손댈 필요가 없다.
CORS_ORIGIN_REGEX = (
    r"http://(localhost|127\.0\.0\.1"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})"
    r":\d+"
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
    """cafes.csv 한 행 + 제보로 Cafe 응답 객체 생성."""
    my_reports = store.reports_for(int(row["id"]), reports)
    decided = decide_crowd(row, my_reports, now)

    def i(v):  # int or None
        return int(v) if v not in ("", None) else None

    # 최근 24시간 제보 수 (동적 계산)
    day_ago = now - timedelta(hours=24)
    rc24 = sum(1 for r in my_reports
               if datetime.fromisoformat(r["reportedAt"]) >= day_ago)

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
    )
    


@app.get("/api/cafes", response_model=list[Cafe])
def get_cafes():
    now = datetime.now(KST)
    cafes = store.load_cafes()
    reports = store.load_reports()
    return [build_cafe(row, reports, now) for row in cafes]


@app.get("/api/cafes/search")
def search_cafes(q: str):
    now = datetime.now(KST)
    reports = store.load_reports()
    keyword = q.strip().lower()

    # 이름 또는 주소에 검색어가 들어간 카페만
    results = []
    for row in store.load_cafes():
        if keyword in row["name"].lower() or keyword in row["address"].lower():
            results.append(build_cafe(row, reports, now))
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
    for r in my_reports:
        result.append({
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

    # 오늘(자정 이후) 제보 수 — WF05 상단 "오늘 제보 12건"
    now = datetime.now(KST)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = sum(1 for r in result
                      if datetime.fromisoformat(r["reportedAt"]) >= midnight)

    return {
        "cafeId": cafe_id,
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
    """WF04 도착 시점 예측. minutes는 프론트가 도보 시간으로 계산해서 보냄."""
    cafe = next((r for r in store.load_cafes() if int(r["id"]) == cafe_id), None)
    if cafe is None:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    if not 0 <= minutes <= 180:
        raise HTTPException(status_code=400, detail="minutes는 0~180 사이여야 합니다")

    return forecast_mod.forecast(cafe_id, minutes, datetime.now(KST))


@app.post("/api/reports", response_model=CrowdReportResponse)
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
        "nickname": "나",
        "reportedAt": datetime.now(KST).isoformat(),
    })
    return CrowdReportResponse(success=True, distanceMeters=round(dist, 1))


@app.post("/api/owner/seats")
def update_owner_seats(body: OwnerSeatUpdateRequest):
    # (데모: 인증 생략. 실제론 Authorization 헤더 검증)
    ok = store.update_owner_seat(body.cafeId, int(body.crowdLevel))
    if not ok:
        raise HTTPException(status_code=404, detail="카페를 찾을 수 없습니다")
    return {"success": True, "cafeId": body.cafeId, "crowdLevel": int(body.crowdLevel)}


@app.get("/")
def health():
    return {"status": "ok", "service": "zari API v3"}