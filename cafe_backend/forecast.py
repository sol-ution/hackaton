"""
시간대별 점유율 곡선 (WF07 그래프 + 도착 시점 예측 공용).

⚠️ 현재는 요일·시간대 패턴 기반의 규칙형 추정이다.
   다음 주 AI 회의에서 LightGBM 모델이 정해지면
   occupancy_at() 내부만 모델 호출로 바꾸면 되도록 분리해 두었다.
"""

from datetime import datetime, timedelta

from crowd_rule import occupancy_to_level

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# 평일: 점심·오후 피크 / 주말: 늦게 시작해서 늦게까지 유지
WEEKDAY_CURVE = [30, 35, 45, 60, 75, 68, 55, 62, 80, 72, 58, 45, 38]
WEEKEND_CURVE = [20, 25, 32, 45, 58, 65, 70, 75, 82, 85, 78, 68, 55]

HOURS = list(range(9, 22))  # 9시 ~ 21시


def _curve_for(day: str, cafe_id: int) -> list[int]:
    """요일 + 카페별 곡선. 카페마다 살짝 다르게 offset을 준다."""
    base = WEEKEND_CURVE if day in ("sat", "sun") else WEEKDAY_CURVE
    offset = (cafe_id * 7) % 15
    return [max(0, min(100, v + offset)) for v in base]


def history_points(cafe_id: int, day: str) -> list[dict]:
    """WF07 그래프용 - 9시~21시 시간대별 점유율."""
    curve = _curve_for(day, cafe_id)
    return [{"hour": h, "occupancyPercent": curve[i]} for i, h in enumerate(HOURS)]


def occupancy_at(cafe_id: int, when: datetime) -> int:
    """
    특정 시각의 점유율(%) 추정.

    ★ LightGBM 교체 지점 ★
    모델이 준비되면 이 함수 본문을 model.predict(피처)로 바꾸면 된다.
    """
    day = WEEKDAYS[when.weekday()]
    curve = _curve_for(day, cafe_id)

    hour = when.hour + when.minute / 60.0

    if hour <= HOURS[0]:
        return curve[0]
    if hour >= HOURS[-1]:
        return curve[-1]

    # 두 시각 사이 선형보간 (예: 15시 12분 = 15시값과 16시값 사이 20% 지점)
    idx = int(hour) - HOURS[0]
    frac = hour - int(hour)
    lo, hi = curve[idx], curve[min(idx + 1, len(curve) - 1)]
    return round(lo + (hi - lo) * frac)


def forecast(cafe_id: int, minutes: int, now: datetime) -> dict:
    """도착 시점 예측 (WF04). minutes 후 시점의 점유율과 혼잡도."""
    target = now + timedelta(minutes=minutes)
    occ = occupancy_at(cafe_id, target)
    level = occupancy_to_level(occ)
    conf = "high" if minutes <= 30 else "low"

    return {
        "cafeId": cafe_id,
        "minutes": minutes,
        "crowdLevel": int(level),
        "occupancyPercent": occ,
        "confidence": conf,
        "forecastAt": target.isoformat(),
    }