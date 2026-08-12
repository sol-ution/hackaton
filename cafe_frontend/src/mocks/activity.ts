import type { Announcement, Coupon, MyReport, RedeemedCoupon, Review, StampCard, StampPolicy } from '../types/activity';

/** WF10 "내 제보" 탭. cafeId는 실제 cafes.csv의 등록 카페(1=스타벅스 인하로점)를 재사용. */
export const MOCK_MY_REPORTS: MyReport[] = [
  { id: 1, cafeId: 1, cafeName: '온기다방', crowdLevel: 0, reportedAt: '2026-08-09T14:32:00+09:00', note: '2층 창가 쪽 여유 있어요', stamped: true },
  { id: 2, cafeId: 2, cafeName: '카페 이름 B', crowdLevel: 1, reportedAt: '2026-08-09T11:05:00+09:00', note: '위치가 확인되지 않음', stamped: false },
  { id: 3, cafeId: 3, cafeName: '카페 이름 C', crowdLevel: 3, reportedAt: '2026-08-08T19:40:00+09:00', note: '대기 3팀 있었습니다', stamped: true },
  { id: 4, cafeId: 1, cafeName: '온기다방', crowdLevel: 0, reportedAt: '2026-08-08T09:12:00+09:00', note: '', stamped: true },
];

export const MY_REPORT_MONTH_STATS = { thisMonth: 8, stamped: 6, unstamped: 2 };

/** WF11 "내 리뷰" 탭. */
export const MOCK_MY_REVIEWS: Review[] = [
  { id: 1, cafeId: 1, cafeName: '온기다방', rating: 4, date: '2026.08.04', content: '2층이 조용해서 작업하기 좋습니다. 좌석 표시도 실제랑 거의 맞았어요.', tags: ['조용함', '콘센트'] },
  { id: 2, cafeId: 2, cafeName: '카페 이름 B', rating: 4, date: '2026.07.24', content: '주말엔 혼잡 표시가 뜨는데 실제로도 만석이었습니다. 도착 시점 예측이 유용했어요.', tags: ['정확함'] },
  { id: 3, cafeId: 3, cafeName: '카페 이름 C', rating: 3, date: '2026.07.20', content: '1층은 대화 소음이 있는 편입니다.', tags: ['대화용', '1층 소음'] },
];

/** WF09 "내 스탬프" — 즐겨찾기한 등록 카페 기준. */
export const MOCK_MY_STAMPS: StampCard[] = [
  { cafeId: 1, cafeName: '온기다방', rewardLabel: '아메리카노 1잔 무료', totalSlots: 20, filled: 14 },
  { cafeId: 2, cafeName: '카페 이름 B', rewardLabel: '2,000원 할인 쿠폰', totalSlots: 20, filled: 6 },
];

/** WF09 즐겨찾기 카페 — 실제 cafes 목록에서 이 id들을 찾아 라이브 혼잡도로 보여준다. */
export const MOCK_FAVORITE_CAFE_IDS = [1, 2, 3];

/** WF16 사장님 쿠폰 사용 대기 목록. */
export const MOCK_PENDING_COUPONS: Coupon[] = [
  { code: '#A3F9', cafeId: 1, cafeName: '온기다방', rewardLabel: '아메리카노 1잔 무료', issuedAt: '2026-08-06T10:00:00+09:00' },
  { code: '#K72C', cafeId: 1, cafeName: '온기다방', rewardLabel: '아메리카노 1잔 무료', issuedAt: '2026-08-08T09:00:00+09:00' },
];

export const MOCK_REDEEMED_COUPONS: RedeemedCoupon[] = [
  { code: '#B18D', cafeId: 1, cafeName: '온기다방', rewardLabel: '아메리카노 1잔 무료', issuedAt: '2026-08-07T10:00:00+09:00', redeemedAt: '2026-08-09T12:30:00+09:00' },
  { code: '#F04A', cafeId: 1, cafeName: '온기다방', rewardLabel: '아메리카노 1잔 무료', issuedAt: '2026-08-06T10:00:00+09:00', redeemedAt: '2026-08-08T18:00:00+09:00' },
  { code: '#9C31', cafeId: 1, cafeName: '온기다방', rewardLabel: '아메리카노 1잔 무료', issuedAt: '2026-08-04T10:00:00+09:00', redeemedAt: '2026-08-06T15:00:00+09:00' },
];

export const MOCK_STAMP_POLICY: StampPolicy = {
  enabled: true,
  rewardLabel: '아메리카노 1잔 무료',
  slots: 20,
  dailyLimit: 3,
  radiusM: 100,
  validDays: 30,
};

export const MOCK_STAMP_MONTH_STATS = { earned: 128, issued: 6, used: 4 };

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  { id: 1, title: '자리요 1.3.0 업데이트 안내', date: '2026.08.06', isNew: true },
  { id: 2, title: '실시간 좌석 정확도 개선 작업 안내', date: '2026.08.06', important: true },
  { id: 3, title: '스탬프·쿠폰 기능이 추가되었어요', date: '2026.08.06' },
  { id: 4, title: '자리요 서비스 이용약관 개정 안내', date: '2026.08.06' },
];
