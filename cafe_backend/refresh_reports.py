"""
데모 직전에 실행 → reports.csv의 제보 시각을 '지금' 기준으로 재생성.

제보는 시간이 지나면 30분/2시간 창 밖으로 나가서 report/high가 안 뜬다.
발표 전에 이걸 한 번 돌리면 카페 4,5,6,7이 다시 report 상태로 살아난다.

  python3 refresh_reports.py
"""

import csv
from datetime import datetime, timedelta, timezone
from pathlib import Path

KST = timezone(timedelta(hours=9))
REPORTS_CSV = Path(__file__).parent / "reports.csv"

# (cafeId, crowdLevel, quiet, restroom, outlet, smoking, visit, note, "몇 분 전")
# 카페4: 30분내 3건+ -> report/high
# 카페6: 30분내 3건 -> report/high
# 카페5,7: 30분내 있지만 2시간 3건 미만 -> report/low
SEED = [
    (4, 2, 3, 3, "many", "none", "two", "자리 거의 없어요", "닉네임 A", 5),
    (4, 2, 3, 4, "many", "none", "solo", "", "닉네임 B", 12),
    (4, 3, 2, 3, "many", "none", "three-four", "2층도 만석", "닉네임 C", 20),
    (4, 1, 4, 3, "normal", "none", "two", "", "닉네임 D", 100),
    (5, 1, 3, 2, "normal", "none", "solo", "", "닉네임 A", 8),
    (5, 1, 3, 3, "normal", "none", "two", "적당해요", "닉네임 C", 70),
    (6, 3, 3, 4, "many", "none", "five-plus", "대기 3팀", "닉네임 B", 4),
    (6, 3, 2, 4, "many", "none", "three-four", "", "닉네임 D", 15),
    (6, 2, 3, 4, "many", "none", "two", "", "닉네임 A", 25),
    (7, 0, 4, 3, "many", "none", "solo", "한산함", "닉네임 C", 10),
    (7, 1, 4, 3, "many", "none", "two", "", "닉네임 B", 95),
]

FIELDS = ["cafeId", "crowdLevel", "quietScore", "restroomScore", "outletLevel",
          "smokingRoom", "visitCount", "note", "nickname", "reportedAt"]
now = datetime.now(KST)
with open(REPORTS_CSV, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(FIELDS)
    for (cid, cl, q, r, o, s, v, note, nick, m) in SEED:
        reported = (now - timedelta(minutes=m)).isoformat()
        w.writerow([cid, cl, q, r, o, s, v, note, nick, reported])
print(f"reports.csv 재생성 완료 ({len(SEED)}건, 기준시각 {now.isoformat()})")
