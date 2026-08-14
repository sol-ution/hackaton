import csv, math, glob

# 다운받은 CSV 경로 (파일명 일부만 맞으면 됨)
SRC = glob.glob("*상가*인천*.csv")[0]
OUT = "inha_cafes.csv"

# 인하대 후문 기준 1km 이내
LAT, LNG, RADIUS = 37.4497, 126.6540, 1000

def dist(la, ln):
    R = 6371000
    dla, dln = math.radians(la-LAT), math.radians(ln-LNG)
    a = math.sin(dla/2)**2 + math.sin(dln/2)**2*math.cos(math.radians(LAT))*math.cos(math.radians(la))
    return 2*R*math.asin(math.sqrt(a))

rows = []
with open(SRC, encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        name = r.get("상호명", "")
        small = r.get("상권업종소분류명", "")
        if "커피" not in small and "카페" not in small:
            continue
        try:
            la, ln = float(r["위도"]), float(r["경도"])
        except (ValueError, KeyError, TypeError):
            continue
        d = dist(la, ln)
        if d <= RADIUS:
            rows.append({
                "상호명": name,
                "도로명주소": r.get("도로명주소", ""),
                "위도": la, "경도": ln,
                "소분류": small,
                "거리m": round(d),
            })

rows.sort(key=lambda x: x["거리m"])
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

print(f"{len(rows)}곳 추출 → {OUT}")