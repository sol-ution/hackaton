/**
 * WF09~20(마이페이지·스탬프·리뷰·사장님 관리 화면군) 전용 타입.
 *
 * 아래쪽 "API 응답 타입" 섹션은 하윤이 넘겨준 FRONTEND_GUIDE.md(2026-08-10) 기준
 * 실제 백엔드 계약이고, 위쪽 "화면 표시용(view model)" 섹션은 화면이 그대로 그리는
 * 단순한 모양이다. 오프라인일 때는 mocks/activity.ts의 더미가 view model 그대로 채워지고,
 * 온라인일 때는 API 응답을 view model로 변환해서(각 컴포넌트의 map 함수) 채운다.
 */
import type { Cafe, CrowdLevel } from './cafe';

// ── 화면 표시용(view model) — mock 폴백과 실 API 결과가 공통으로 이 모양으로 맞춰짐 ──

export interface MyReport {
  id: number | string;
  cafeId: number | null;
  cafeName: string;
  /** 실 API는 이 값을 안 줘서 오프라인(mock)일 때만 있음 — 있으면 배지로 보여준다. */
  crowdLevel?: CrowdLevel;
  reportedAt: string;
  note: string;
  /** 이 제보로 스탬프가 적립됐는지 (반경 확인된 제보만 적립) */
  stamped: boolean;
}

export interface Review {
  id: number | string;
  cafeId: number;
  cafeName: string;
  rating: number; // 1~5
  date: string;
  content: string;
  tags: string[];
}

export interface StampCard {
  cafeId: number;
  cafeName: string;
  rewardLabel: string;
  totalSlots: number;
  filled: number;
}

export interface Coupon {
  code: string; // "#A3F9"
  cafeId: number;
  cafeName: string;
  rewardLabel: string;
  issuedAt: string;
}

export interface RedeemedCoupon extends Coupon {
  redeemedAt: string;
}

export interface Announcement {
  id: number;
  title: string;
  date: string;
  isNew?: boolean;
  important?: boolean;
}

export interface StampPolicy {
  enabled: boolean;
  rewardLabel: string;
  slots: number;
  dailyLimit: number;
  radiusM: number;
  validDays: number;
}

// ── API 응답 타입 (FRONTEND_GUIDE.md 기준) ──

export interface FavoriteEntry {
  cafe: Cafe;
  addedAt: string;
}
export interface FavoritesResponse {
  count: number;
  favorites: FavoriteEntry[];
}

export interface StampCardApi {
  cafeId: number;
  cafeName: string;
  reward: string;
  count: number;
  goal: number;
  remaining: number;
}
export interface StampsResponse {
  earnedToday: number;
  dailyLimit: number;
  cards: StampCardApi[];
}

export interface CouponApi {
  code: string;
  cafeId: number;
  cafeName: string;
  reward: string;
  expiresAt: string;
  used: boolean;
  usedAt: string | null;
}
export interface CouponsResponse {
  availableCount: number;
  coupons: CouponApi[];
}
export interface UseCouponResponse {
  success: boolean;
  message: string;
}

export interface MyReportEntryApi {
  cafeName: string;
  reportedAt: string;
  earned: boolean;
  reason: string;
}
export interface MyReportsResponse {
  totalCount: number;
  earnedCount: number;
  notEarnedCount: number;
  reports: MyReportEntryApi[];
}

export interface ReviewApi {
  reviewId: number;
  cafeId: number;
  cafeName?: string;
  rating: number;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string | null;
}
export interface MyReviewsResponse {
  count: number;
  reviews: ReviewApi[];
}
export interface CafeReviewsResponse {
  averageRating: number;
  reviewCount: number;
  reviews: ReviewApi[];
}
export interface PostReviewRequest {
  cafeId: number;
  rating: number;
  content: string;
  tags: string[];
}
export interface PatchReviewRequest {
  rating?: number;
  content?: string;
  tags?: string[];
}

export interface NoticeApi {
  noticeId: number;
  title: string;
  content: string;
  isImportant: boolean;
  isNew: boolean;
  createdAt: string;
}
export interface NoticesResponse {
  count: number;
  unreadCount: number;
  notices: NoticeApi[];
}
export interface InquiryRequest {
  name: string;
  content: string;
}

export interface OwnerDashboardComparison {
  crowdLevel: CrowdLevel;
  verdict: string;
  reportedAt: string;
}
export interface OwnerDashboardResponse {
  cafeName: string;
  crowdLevel: CrowdLevel;
  updatedMinutesAgo: number;
  nextCheckInMinutes: number;
  today: { viewCount: number; directionCount: number; reportCount: number };
  tags: string[];
  comparisons: OwnerDashboardComparison[];
}

export interface OwnerInfoAmenities {
  outlet: boolean;
  wifi: boolean;
  quiet: boolean;
  noTimeLimit: boolean;
  smokingRoom: boolean;
  parking: boolean;
}
export interface OwnerInfo {
  weekdayHours: string;
  weekendHours: string;
  holiday: string;
  structureNote: string;
  amenities: OwnerInfoAmenities;
  seats: { total: number; solo: number; pair: number; group: number };
}
export type OwnerInfoPatch = Partial<Omit<OwnerInfo, 'amenities' | 'seats'>> & {
  amenities?: Partial<OwnerInfoAmenities>;
  seats?: Partial<OwnerInfo['seats']>;
};

export interface StampSettings {
  reward: string;
  goal: number;
  dailyLimit: number;
  radiusMeters: number;
  validDays: number;
  ownerPin: string;
}
export type StampSettingsPatch = Partial<StampSettings>;

export interface OwnerCouponEntry {
  code: string;
  reward: string;
  issuedAt: string;
  usedAt?: string;
}
export interface OwnerCouponsResponse {
  thisMonth: { stampsEarned: number; couponsIssued: number; couponsUsed: number };
  pendingCount: number;
  pending: OwnerCouponEntry[];
  completed: OwnerCouponEntry[];
}

export interface CafeRegistrationRequest {
  cafeName: string;
  address: string;
  method: 'business' | 'phone';
  value: string;
}
export interface CafeRegistrationResponse {
  status: string;
}
