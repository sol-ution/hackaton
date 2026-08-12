"""
전체 API 자동 점검.

  python3 healthcheck.py

서버를 따로 띄우지 않아도 되고(내부에서 앱을 직접 호출),
실패한 항목만 빨간 X로 표시된다. 발표 전에 한 번 돌려보면 된다.
"""

from fastapi.testclient import TestClient

import auth
from main import app

client = TestClient(app)

# 로그인 필요한 API용 토큰 (데모 유저)
_token = auth.create_token({"userId": 1, "nickname": "자리요러"})
H = {"Authorization": f"Bearer {_token}"}

OK, FAIL = "\033[92m✓\033[0m", "\033[91m✗\033[0m"
results = []


def check(name: str, fn, expect: int = 200, note=None):
    """fn을 실행해서 상태코드를 확인하고 결과를 기록."""
    try:
        r = fn()
        status = r.status_code
        detail = ""
        if status == expect and note:
            try:
                detail = note(r.json())
            except Exception:
                detail = ""
        passed = status == expect
    except Exception as e:
        status, passed, detail = "예외", False, f"{type(e).__name__}: {e}"

    results.append(passed)
    mark = OK if passed else FAIL
    extra = f"  {detail}" if detail else ""
    if not passed:
        extra = f"  (기대 {expect}, 실제 {status})"
    print(f"  {mark} {name}{extra}")


print("\n[ 카페 ]")
check("GET  /api/cafes", lambda: client.get("/api/cafes"),
      note=lambda d: f"{len(d)}개")
check("GET  /api/cafes/search?q=카페", lambda: client.get("/api/cafes/search?q=카페"),
      note=lambda d: f"{len(d)}개 검색됨")
check("GET  /api/cafes/1", lambda: client.get("/api/cafes/1"),
      note=lambda d: d["name"])
check("GET  /api/cafes/999 (없는 카페)", lambda: client.get("/api/cafes/999"), expect=404)

print("\n[ 제보 ]")
check("GET  /api/cafes/4/reports", lambda: client.get("/api/cafes/4/reports"),
      note=lambda d: f"{d['totalCount']}건 (오늘 {d['todayCount']})")
check("POST /api/reports (카페 근처)", lambda: client.post("/api/reports", json={
    "cafeId": 1, "crowdLevel": 2, "quietScore": 3, "restroomScore": 3,
    "outletLevel": "many", "smokingRoom": "none", "visitCount": "solo",
    "note": "점검용", "userLat": 37.4512, "userLng": 126.6547}),
    note=lambda d: f"{d['distanceMeters']}m, 스탬프 {d['stamp']['count']}/{d['stamp']['goal']}")
check("POST /api/reports (잘못된 값)", lambda: client.post("/api/reports", json={
    "cafeId": 1, "crowdLevel": 9, "quietScore": 3, "restroomScore": 3,
    "outletLevel": "many", "smokingRoom": "none", "visitCount": "solo",
    "note": "", "userLat": 37.4512, "userLng": 126.6547}), expect=422)
check("POST 제보 답글", lambda: client.post(
    "/api/cafes/4/reports/0/replies", json={"agree": True, "content": "점검용"}))

print("\n[ 예측 · 그래프 ]")
check("GET  /api/cafes/1/history?day=wed", lambda: client.get("/api/cafes/1/history?day=wed"),
      note=lambda d: f"{len(d['points'])}포인트")
check("GET  /api/cafes/1/history?day=sat", lambda: client.get("/api/cafes/1/history?day=sat"),
      note=lambda d: f"9시 {d['points'][0]['occupancyPercent']}%")
check("GET  /api/cafes/1/history?day=XX", lambda: client.get("/api/cafes/1/history?day=XX"),
      expect=400)
check("GET  /api/cafes/4/forecast?minutes=12",
      lambda: client.get("/api/cafes/4/forecast?minutes=12"),
      note=lambda d: f"level={d['crowdLevel']} {d['occupancyPercent']}% ({d['confidence']})")

print("\n[ 스탬프 · 쿠폰 ]")
check("GET  /api/me/stamps", lambda: client.get("/api/me/stamps", headers=H),
      note=lambda d: f"카드 {len(d['cards'])}장, 오늘 {d['earnedToday']}/{d['dailyLimit']}")
check("GET  /api/me/coupons", lambda: client.get("/api/me/coupons", headers=H),
      note=lambda d: f"사용가능 {d['availableCount']}장")
check("POST 쿠폰 사용 (PIN 틀림)",
      lambda: client.post("/api/coupons/%23A3F9/use?pin=0000"), expect=400)

print("\n[ 즐겨찾기 ]")
check("GET  /api/me/favorites", lambda: client.get("/api/me/favorites", headers=H),
      note=lambda d: f"{d['count']}개")
check("POST 즐겨찾기 추가", lambda: client.post("/api/cafes/7/favorite", headers=H))
check("DEL  즐겨찾기 해제", lambda: client.delete("/api/cafes/7/favorite", headers=H))

print("\n[ 리뷰 ]")
check("GET  /api/me/reviews", lambda: client.get("/api/me/reviews", headers=H),
      note=lambda d: f"{d['count']}건")
check("GET  /api/cafes/12/reviews", lambda: client.get("/api/cafes/12/reviews"),
      note=lambda d: f"평균 {d['averageRating']}점")

# 리뷰 작성 → 수정 → 삭제 한 사이클
_new_review = {}


def _create_review():
    r = client.post("/api/reviews", headers=H, json={
        "cafeId": 1, "rating": 4, "content": "점검용 리뷰", "tags": ["점검"]})
    if r.status_code == 200:
        _new_review["id"] = r.json()["review"]["reviewId"]
    return r


check("POST 리뷰 작성", _create_review)
check("PATCH 리뷰 수정",
      lambda: client.patch(f"/api/reviews/{_new_review.get('id', 0)}", headers=H, json={"rating": 5}))
check("DEL  리뷰 삭제",
      lambda: client.delete(f"/api/reviews/{_new_review.get('id', 0)}", headers=H))

print("\n[ 내 활동 · 공지 · 문의 ]")
check("GET  /api/me/reports", lambda: client.get("/api/me/reports", headers=H),
      note=lambda d: f"{d['totalCount']}건 (적립 {d['earnedCount']})")
check("GET  /api/notices", lambda: client.get("/api/notices"),
      note=lambda d: f"{d['count']}건 (NEW {d['unreadCount']})")
check("POST /api/inquiries", lambda: client.post(
    "/api/inquiries", json={"name": "점검", "content": "자동 점검"}))

print("\n[ 사장님 ]")
check("GET  /api/owner/1/dashboard", lambda: client.get("/api/owner/1/dashboard"),
      note=lambda d: f"조회 {d['today']['viewCount']} / 길찾기 {d['today']['directionCount']} / {d['updatedMinutesAgo']}분 전")
check("GET  /api/owner/1/info", lambda: client.get("/api/owner/1/info"),
      note=lambda d: f"평일 {d['weekdayHours']}")
check("PATCH /api/owner/1/info",
      lambda: client.patch("/api/owner/1/info", json={"holiday": "매주 월요일"}))
check("GET  /api/owner/1/stamp-settings", lambda: client.get("/api/owner/1/stamp-settings"),
      note=lambda d: f"{d['reward']} {d['goal']}칸")
check("GET  /api/owner/1/coupons", lambda: client.get("/api/owner/1/coupons"),
      note=lambda d: f"대기 {d['pendingCount']}건")
check("POST /api/owner/seats",
      lambda: client.post("/api/owner/seats", json={"cafeId": 3, "crowdLevel": 3}))
check("POST 조회수 +1", lambda: client.post("/api/cafes/1/view"))
check("POST 길찾기 +1", lambda: client.post("/api/cafes/1/directions"))
check("POST 카페 등록 신청", lambda: client.post("/api/cafe-registrations", json={
    "cafeName": "점검카페", "address": "인천", "method": "business", "value": "123-45-67890"}))

print("\n[ 인증 ]")
check("GET  /api/auth/me (토큰 O)", lambda: client.get("/api/auth/me", headers=H),
      note=lambda d: d["nickname"])
check("GET  /api/me/stamps (토큰 X)", lambda: client.get("/api/me/stamps"), expect=401)
check("GET  /api/cafes (토큰 X, 열려야 함)", lambda: client.get("/api/cafes"))
check("POST /api/auth/logout", lambda: client.post("/api/auth/logout"))

print("\n[ 서버 ]")
check("GET  /", lambda: client.get("/"))

# ── 결과 요약 ──
total, passed = len(results), sum(results)
print("\n" + "─" * 50)
if passed == total:
    print(f"\033[92m전부 통과 ({passed}/{total})\033[0m")
else:
    print(f"\033[91m실패 {total - passed}건 (통과 {passed}/{total})\033[0m")
    print("위에서 ✗ 표시된 항목을 확인하세요.")
print("─" * 50)

# ── 데이터 상태 요약 ──
print("\n[ 데이터 상태 ]")
try:
    from collections import Counter
    cafes = client.get("/api/cafes").json()
    src = Counter(c["crowdSource"] for c in cafes)
    print(f"  카페 {len(cafes)}개 - {dict(src)}")
    reg = [c for c in cafes if c["isRegistered"]]
    print(f"  등록 카페 {len(reg)}곳: {', '.join(c['name'] for c in reg)}")

    owner_cafe = client.get("/api/owner/1/dashboard").json()
    mins = owner_cafe["updatedMinutesAgo"]
    if mins > 60:
        print(f"  \033[93m⚠ 등록 카페가 {mins}분 전 갱신 상태입니다."
              f" refresh_reports.py를 실행하세요\033[0m")

    report_cafes = [c for c in cafes if c["crowdSource"] == "report"]
    if not report_cafes:
        print("  \033[93m⚠ report 상태 카페가 없습니다."
              " refresh_reports.py를 실행하세요\033[0m")
except Exception as e:
    print(f"  요약 실패: {e}")
print()
