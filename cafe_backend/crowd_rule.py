"""
혼잡도 결정 규칙 (API_CONTRACT v3 §1).

핵심: crowdSource와 confidence는 서로 다른 '창(window)'을 쓴다.
- crowdSource=report 판정 : 최근 30분  (신선도)
- confidence=high 판정     : 최근 2시간  (표본 수)

그래서 crowdSource="predicted" + confidence="high" 조합이 나올 수 있고,
이건 버그가 아니다 (30분 내 제보는 없지만 2시간 내엔 충분한 경우).
"""

from collections import Counter
from datetime import datetime, timedelta, timezone

from schemas import Cafe, CrowdLevel, CrowdSource, Confidence

KST = timezone(timedelta(hours=9))

REPORT_WINDOW = timedelta(minutes=30)   # crowdSource=report 판정 창
CONF_WINDOW = timedelta(hours=2)        # confidence=high 판정 창
CONF_MIN_REPORTS = 3                    # 2시간 내 이 건수 이상이면 high

# occupancyPercent -> crowdLevel 구간 (§2-9)
#   여유 0-60 / 보통 60-80 / 혼잡 80-100 / 만석 100
def occupancy_to_level(pct: float) -> CrowdLevel:
    if pct >= 100:
        return CrowdLevel.FULL
    if pct >= 80:
        return CrowdLevel.CROWDED
    if pct >= 60:
        return CrowdLevel.NORMAL
    return CrowdLevel.FREE

# crowdLevel -> 대표 occupancyPercent (owner가 버튼만 누를 때 역산용)
#   여유 30 / 보통 70 / 혼잡 90 / 만석 100
LEVEL_TO_OCCUPANCY = {
    CrowdLevel.FREE: 30,
    CrowdLevel.NORMAL: 70,
    CrowdLevel.CROWDED: 90,
    CrowdLevel.FULL: 100,
}


def _mode_level(levels: list[int]) -> int:
    """제보 여러 개의 최빈 crowdLevel. 동점이면 더 혼잡한 쪽(큰 값)."""
    count = Counter(levels)
    top = max(count.values())
    return max(l for l, c in count.items() if c == top)


def decide_crowd(
    cafe_row: dict,
    reports: list[dict],
    now: datetime | None = None,
) -> dict:
    """
    카페 한 개의 최종 혼잡도 상태를 결정한다.

    cafe_row : cafes.csv 한 줄 (dict). owner 카페면 crowdLevel/occupancyPercent 보유.
    reports  : 이 카페의 제보 리스트 (reports.csv에서 cafeId로 필터한 것).
    반환      : {crowdLevel, crowdSource, confidence, occupancyPercent}
    """
    if now is None:
        now = datetime.now(KST)

    # 이 카페 제보만, 시각 파싱. 깨진 행은 건너뛴다.
    parsed = []
    for r in reports:
        try:
            t = datetime.fromisoformat(r["reportedAt"])
            parsed.append((t, int(r["crowdLevel"])))
        except (ValueError, KeyError, TypeError):
            continue

    recent_30m = [lvl for (t, lvl) in parsed if now - t <= REPORT_WINDOW]
    recent_2h = [lvl for (t, lvl) in parsed if now - t <= CONF_WINDOW]

    # ── confidence: 2시간 창 표본 수 ──
    confidence = Confidence.HIGH if len(recent_2h) >= CONF_MIN_REPORTS else Confidence.LOW

    is_registered = cafe_row.get("isRegistered") == "true"
    owner_level = cafe_row.get("crowdLevel", "")

    # ── crowdSource 우선순위 ──
    # ① owner: 등록 카페 + 사장님 값 존재
    if is_registered and owner_level != "":
        level = CrowdLevel(int(owner_level))
        occ = cafe_row.get("occupancyPercent", "")
        occ = float(occ) if occ != "" else LEVEL_TO_OCCUPANCY[level]
        return {
            "crowdLevel": level,
            "crowdSource": CrowdSource.OWNER,
            "confidence": Confidence.HIGH,   # 사장님 실측은 항상 high
            "occupancyPercent": occ,
        }

    # ② report: 최근 30분 제보 존재
    if recent_30m:
        level = CrowdLevel(_mode_level(recent_30m))
        return {
            "crowdLevel": level,
            "crowdSource": CrowdSource.REPORT,
            "confidence": confidence,        # 2시간 창 기준
            "occupancyPercent": LEVEL_TO_OCCUPANCY[level],
        }

    # ③ predicted: 30분 제보는 없지만 예측값이 있음 (여기선 시드의 예측값 사용)
    pred = cafe_row.get("crowdLevel", "")
    if pred != "":
        level = CrowdLevel(int(pred))
        occ = cafe_row.get("occupancyPercent", "")
        occ = float(occ) if occ != "" else LEVEL_TO_OCCUPANCY[level]
        return {
            "crowdLevel": level,
            "crowdSource": CrowdSource.PREDICTED,
            "confidence": confidence,        # 2시간 창 기준 (predicted+high 가능)
            "occupancyPercent": occ,
        }

    # ④ none: 아무 데이터 없음
    return {
        "crowdLevel": None,
        "crowdSource": CrowdSource.NONE,
        "confidence": Confidence.LOW,
        "occupancyPercent": None,
    }
