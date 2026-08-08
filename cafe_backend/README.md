# 자리(zari) 백엔드 — API_CONTRACT v3

## 실행 방법

```bash
# 1. 가상환경 (선택)
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. 설치
pip install -r requirements.txt

# 3. (데모 직전) 제보 시각을 '지금' 기준으로 새로고침
python3 refresh_reports.py

# 4. 서버 실행
uvicorn main:app --reload

# 5. 확인: 브라우저에서 http://127.0.0.1:8000/docs
```

## 엔드포인트 (4개)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/cafes` | 카페 15개 목록 |
| GET | `/api/cafes/{id}` | 단건 조회 |
| POST | `/api/reports` | 제보 (GPS 150m 거리체크) |
| POST | `/api/owner/seats` | 사장님 좌석 갱신 (crowdLevel) |

## 혼잡도 규칙 (v3 §1)

- **crowdSource**: owner → (최근 30분 제보) report → predicted → none
- **confidence**: 최근 2시간 제보 3건 이상 = high, 아니면 low
- 창이 2개(30분/2시간)라 `predicted + high` 조합이 나올 수 있음 (정상)

## 파일 구조

- `main.py` — 엔드포인트 4개
- `schemas.py` — Pydantic 모델 (cafe.ts와 1:1)
- `crowd_rule.py` — 혼잡도 결정 규칙
- `store.py` — CSV 로딩/저장 (락 포함)
- `cafes.csv` — 카페 15개 시드 (mocks/cafes.ts와 동일)
- `reports.csv` — 제보 로그
- `refresh_reports.py` — 데모용 제보 시각 새로고침

## 설정 (main.py 상단)

- `GPS_RADIUS_M = 150` — 제보 허용 반경
- `CORS_ORIGINS` — 발표 당일 LAN IP 여기 추가
