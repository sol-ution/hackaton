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
# 발표 계정 스탬프·쿠폰 설정

일반 신규 카카오 계정은 즐겨찾기, 제보, 스탬프, 쿠폰이 모두 0에서
시작합니다. 특정 발표 계정에만 시연 데이터를 넣으려면 Render 환경변수에
다음 값을 등록하세요.

```env
DEMO_KAKAO_ID=발표에_사용할_실제_카카오_ID
OWNER_REDEEM_PIN=숫자_3자리
DEMO_FULL_COUPON_CAFE_ID=1
DEMO_PARTIAL_STAMP_CAFE_ID=2
DEMO_PARTIAL_STAMP_COUNT=14
```

- 발표 계정 최초 로그인: 카페 1의 사용 가능 쿠폰 1장, 카페 2의 14/20
  스탬프가 한 번만 생성됩니다.
- 카페 1은 쿠폰 발급 후 새 카드가 시작된 상태라 0/20으로 표시됩니다.
- 재로그인해도 시드가 다시 적용되지 않으므로 15번째 스탬프와 쿠폰 사용
  상태가 유지됩니다.
- 쿠폰 사용: `POST /api/coupons/{code}/use?pin=123`
  (`Authorization: Bearer <JWT>` 필수)
