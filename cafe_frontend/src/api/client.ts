import type {
  Cafe,
  CafeReportsResponse,
  CrowdReportRequest,
  CrowdReportResponse,
  DayKey,
  ForecastResponse,
  HistoryPoint,
  OwnerSeatUpdateRequest,
} from '../types/cafe';
import type {
  CafeRegistrationRequest,
  CafeRegistrationResponse,
  CafeReviewsResponse,
  CouponsResponse,
  FavoritesResponse,
  InquiryRequest,
  MyReportsResponse,
  MyReviewsResponse,
  NoticesResponse,
  OwnerCouponsResponse,
  OwnerDashboardResponse,
  OwnerInfo,
  OwnerInfoPatch,
  PatchReviewRequest,
  PostReviewRequest,
  ReviewApi,
  StampSettings,
  StampSettingsPatch,
  StampsResponse,
  UseCouponResponse,
} from '../types/activity';

/**
 * 백엔드 주소.
 *
 * 기본값은 "지금 이 페이지를 연 호스트의 8000번 포트"로 자동 계산한다.
 *  - localhost:5173 으로 접속 → http://localhost:8000
 *  - 172.16.101.117:5173 으로 접속 → http://172.16.101.117:8000
 *
 * 와이파이가 바뀌어 LAN IP가 달라져도 코드를 고칠 필요가 없다.
 * 백엔드를 다른 기기에서 돌리는 경우에만 .env의 VITE_API_BASE_URL로 덮어쓰면 됨.
 */
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? `${window.location.protocol}//${window.location.hostname}:8000`;

/** 서버가 내려준 에러 메시지를 그대로 들고 다니는 에러. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* 카카오 로그인 (하윤 스펙 확정본 — 2026-08-12) */
/* ------------------------------------------------------------------ */

const AUTH_TOKEN_KEY = 'zari:authToken';
const AUTH_USER_KEY = 'zari:authUser';

/** 카카오가 로그인 성공 후 돌려보낼 주소. Vercel/로컬 둘 다 이 경로로 통일. */
export const KAKAO_REDIRECT_PATH = '/auth/kakao/callback';

export interface KakaoUser {
  userId: number;
  nickname: string;
  profileImage: string | null;
  isOwner: boolean;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAuthUser(): KakaoUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as KakaoUser) : null;
  } catch {
    return null;
  }
}

/** 로그인 성공 시 토큰+유저정보를 같이 저장. */
function setAuthSession(accessToken: string, user: KakaoUser) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    // 저장 실패해도 이번 세션 메모리엔 남아있는 다른 상태로 계속 진행
  }
}

/** 로그아웃. */
export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    // ignore
  }
}

/**
 * 카카오 로그인 버튼 클릭 시 이동할 인가(authorize) URL.
 * REST API 키가 아직 없으면(.env에 VITE_KAKAO_CLIENT_ID 없음) null을 돌려주고,
 * 호출부(LoginModal)가 기존 스텁 로그인으로 대신 처리한다.
 */
export function getKakaoAuthUrl(): string | null {
  const clientId = import.meta.env.VITE_KAKAO_CLIENT_ID;
  if (!clientId) return null;
  const redirectUri = `${window.location.origin}${KAKAO_REDIRECT_PATH}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
  });
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

/**
 * 콜백 페이지가 카카오 인가 코드를 받으면 이걸 호출해서 백엔드 토큰으로 교환한다.
 * 스펙(하윤, 2026-08-12): POST /api/auth/kakao { code, redirectUri }
 *   → { accessToken, user: { userId, nickname, profileImage, isOwner } }
 */
export async function loginWithKakao(code: string): Promise<{ accessToken: string; user: KakaoUser }> {
  const raw = await request<{ accessToken: string; user: KakaoUser }>('/api/auth/kakao', {
    method: 'POST',
    body: JSON.stringify({ code, redirectUri: `${window.location.origin}${KAKAO_REDIRECT_PATH}` }),
  });
  if (!raw?.accessToken) throw new ApiError('로그인 응답에 토큰이 없어요.', 0);
  setAuthSession(raw.accessToken, raw.user);
  return raw;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const token = getAuthToken();
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...init,
    });
  } catch {
    // 네트워크 자체가 실패 (백엔드 미기동, CORS 차단 등)
    throw new ApiError('서버에 연결할 수 없어요.', 0);
  }

  if (!res.ok) {
    // FastAPI는 에러를 {"detail": "..."} 로 내려줌.
    // GPS 반경 초과(400) 메시지는 사용자에게 그대로 보여줘야 해서 살려둔다.
    let detail = `요청 실패 (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      // 본문이 JSON이 아니면 기본 메시지 유지
    }
    throw new ApiError(detail, res.status);
  }

  return (await res.json()) as T;
}

export function fetchCafes(): Promise<Cafe[]> {
  return request<Cafe[]>('/api/cafes');
}

export function fetchCafe(id: number): Promise<Cafe> {
  return request<Cafe>(`/api/cafes/${id}`);
}

export function postReport(report: CrowdReportRequest): Promise<CrowdReportResponse> {
  return request<CrowdReportResponse>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
}

export function postOwnerSeat(body: OwnerSeatUpdateRequest): Promise<unknown> {
  return request<unknown>('/api/owner/seats', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** WF05 제보 내역 + 상단 통계. */
export function fetchCafeReports(cafeId: number): Promise<CafeReportsResponse> {
  return request<CafeReportsResponse>(`/api/cafes/${cafeId}/reports`);
}

/**
 * WF07 요일별 시간대 곡선.
 *
 * 백엔드가 배열을 그대로 주는지 `{points: [...]}` 처럼 감싸 주는지 확정 전이라
 * 두 형태를 모두 받아들인다. 필드명도 occupancyPercent / occupancy / percent 를 모두 흡수.
 * 예상 밖 모양이 와도 빈 배열로 떨어뜨려 화면이 죽지 않게 한다.
 */
export async function fetchCafeHistory(cafeId: number, day: DayKey): Promise<HistoryPoint[]> {
  const raw = await request<unknown>(`/api/cafes/${cafeId}/history?day=${day}`);

  const container = raw as Record<string, unknown> | null;
  const arr: unknown = Array.isArray(raw)
    ? raw
    : (container?.points ?? container?.history ?? container?.data);

  if (!Array.isArray(arr)) return [];

  return arr
    .map((p) => {
      const o = p as Record<string, unknown>;
      const hour = Number(o.hour ?? o.h);
      const pct = Number(o.occupancyPercent ?? o.occupancy ?? o.percent ?? o.value);
      return { hour, occupancyPercent: pct };
    })
    .filter((p) => Number.isFinite(p.hour) && Number.isFinite(p.occupancyPercent));
}

/**
 * WF04 도착 시점 예측. minutes는 백엔드가 0~180만 허용하므로 클램프해서 보낸다.
 * (도보 3시간 넘는 카페는 애초에 목록에 없지만, 위치 권한 거부 등으로
 *  엉뚱한 거리가 계산되면 400이 떠서 화면이 깨지므로 방어)
 */
export function fetchForecast(cafeId: number, minutes: number): Promise<ForecastResponse> {
  const safe = Math.max(0, Math.min(180, Math.round(minutes)));
  return request<ForecastResponse>(`/api/cafes/${cafeId}/forecast?minutes=${safe}`);
}

/**
 * 조회수·길찾기 카운트는 프론트가 명시적으로 호출해야 사장님 대시보드에 올라간다
 * (하윤 안내: 자동으로 안 늘어남). 실패해도 화면 표시엔 영향 없어야 해서
 * 호출부에서 실패를 무시해도 되게 반환 타입을 단순하게 둔다.
 */
export function postCafeView(cafeId: number): Promise<unknown> {
  return request<unknown>(`/api/cafes/${cafeId}/view`, { method: 'POST' });
}

export function postCafeDirections(cafeId: number): Promise<unknown> {
  return request<unknown>(`/api/cafes/${cafeId}/directions`, { method: 'POST' });
}

// ── 스탬프 (WF13) ──
export function fetchMyStamps(): Promise<StampsResponse> {
  return request<StampsResponse>('/api/me/stamps');
}

// ── 쿠폰 (WF13) ── code에 "#"가 들어있어 URL 인코딩 필수 (안 하면 # 뒤가 잘려서 404).
export function fetchMyCoupons(): Promise<CouponsResponse> {
  return request<CouponsResponse>('/api/me/coupons');
}

export function useCoupon(code: string, pin: string): Promise<UseCouponResponse> {
  return request<UseCouponResponse>(
    `/api/coupons/${encodeURIComponent(code)}/use?pin=${encodeURIComponent(pin)}`,
    { method: 'POST' },
  );
}

// ── 즐겨찾기 (WF13) ──
export function fetchMyFavorites(): Promise<FavoritesResponse> {
  return request<FavoritesResponse>('/api/me/favorites');
}

export function addFavorite(cafeId: number): Promise<unknown> {
  return request<unknown>(`/api/cafes/${cafeId}/favorite`, { method: 'POST' });
}

export function removeFavorite(cafeId: number): Promise<unknown> {
  return request<unknown>(`/api/cafes/${cafeId}/favorite`, { method: 'DELETE' });
}

// ── 내 제보 내역 (WF18) ──
export function fetchMyReports(): Promise<MyReportsResponse> {
  return request<MyReportsResponse>('/api/me/reports');
}

// ── 리뷰 (WF19) ──
export function fetchMyReviews(): Promise<MyReviewsResponse> {
  return request<MyReviewsResponse>('/api/me/reviews');
}

export function fetchCafeReviews(cafeId: number): Promise<CafeReviewsResponse> {
  return request<CafeReviewsResponse>(`/api/cafes/${cafeId}/reviews`);
}

export function postReview(body: PostReviewRequest): Promise<ReviewApi> {
  return request<ReviewApi>('/api/reviews', { method: 'POST', body: JSON.stringify(body) });
}

export function patchReview(reviewId: number, body: PatchReviewRequest): Promise<ReviewApi> {
  return request<ReviewApi>(`/api/reviews/${reviewId}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteReview(reviewId: number): Promise<unknown> {
  return request<unknown>(`/api/reviews/${reviewId}`, { method: 'DELETE' });
}

// ── 공지 · 문의 (WF16, WF15) ──
export function fetchNotices(): Promise<NoticesResponse> {
  return request<NoticesResponse>('/api/notices');
}

export function postInquiry(body: InquiryRequest): Promise<unknown> {
  return request<unknown>('/api/inquiries', { method: 'POST', body: JSON.stringify(body) });
}

// ── 제보 답글 — 신뢰도 투표 ──
export function postReportReply(
  cafeId: number,
  reportIndex: number,
  body: { agree: boolean; content: string },
): Promise<unknown> {
  return request<unknown>(`/api/cafes/${cafeId}/reports/${reportIndex}/replies`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── 사장님 API (WF10~12). 인증은 데모라 생략하고 cafeId로 매장을 지정한다. ──
export function fetchOwnerDashboard(cafeId: number): Promise<OwnerDashboardResponse> {
  return request<OwnerDashboardResponse>(`/api/owner/${cafeId}/dashboard`);
}

export function fetchOwnerInfo(cafeId: number): Promise<OwnerInfo> {
  return request<OwnerInfo>(`/api/owner/${cafeId}/info`);
}

export function patchOwnerInfo(cafeId: number, body: OwnerInfoPatch): Promise<OwnerInfo> {
  return request<OwnerInfo>(`/api/owner/${cafeId}/info`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function fetchStampSettings(cafeId: number): Promise<StampSettings> {
  return request<StampSettings>(`/api/owner/${cafeId}/stamp-settings`);
}

export function patchStampSettings(cafeId: number, body: StampSettingsPatch): Promise<StampSettings> {
  return request<StampSettings>(`/api/owner/${cafeId}/stamp-settings`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function fetchOwnerCoupons(cafeId: number): Promise<OwnerCouponsResponse> {
  return request<OwnerCouponsResponse>(`/api/owner/${cafeId}/coupons`);
}

// ── 새 카페 등록 신청 (WF10) ──
export function postCafeRegistration(body: CafeRegistrationRequest): Promise<CafeRegistrationResponse> {
  return request<CafeRegistrationResponse>('/api/cafe-registrations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
