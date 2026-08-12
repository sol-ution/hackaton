/**
 * 프론트-백엔드 데이터 계약.
 * 이 파일이 바뀌면 반드시 백엔드(하윤)와 같이 바꿔야 함.
 */

/** 혼잡도 4단계. LightGBM 모델의 target(crowd_level)과 숫자가 동일해야 함. */
export const CROWD_LEVELS = [0, 1, 2, 3] as const;
export type CrowdLevel = (typeof CROWD_LEVELS)[number];

/**
 * 혼잡도 값이 어디서 왔는지.
 * owner     : 등록 카페, 사장님이 직접 입력한 실시간 좌석
 * report    : 미등록 카페, 최근 사용자 제보 기반
 * predicted : 미등록 카페, 제보 없어서 AI 예측만
 * none      : 데이터 자체가 없음 (회색 마커)
 */
export type CrowdSource = 'owner' | 'report' | 'predicted' | 'none';

/** 예측 신뢰도. 최근 제보가 적으면 low. 화면에 "신뢰도 낮음" 배지로 노출. */
export type Confidence = 'high' | 'low';

/** 카테고리 필터에 쓰는 태그. */
export type CafeTag =
  | 'study' // 공부하기 좋음
  | 'talk' // 대화 위주
  | 'outlet' // 콘센트 많음
  | 'quiet' // 조용함
  | 'wide-table' // 넓은 테이블
  | 'late-night'; // 늦게까지 영업

/** 콘센트 여유 정도. 제보 폼(WF06) "콘센트는 어떤가요?" 3단계 응답과 동일. */
export type OutletLevel = 'many' | 'normal' | 'none';

/** 흡연실 형태. 제보 폼(WF06) "흡연실은?" 3단계 응답과 동일. */
export type SmokingRoomType = 'indoor' | 'outdoor' | 'none';

/** 방문 인원. 제보 폼(WF06)에서만 쓰는 값 — Cafe 자체엔 저장 안 함. */
export type VisitCount = 'solo' | 'two' | 'three-four' | 'five-plus';

export interface Cafe {
  id: number;
  name: string;
  address: string;

  /** 지도 마커 좌표 (WGS84) */
  lat: number;
  lng: number;

  /** 사장님 계정이 연결된 카페인지. true면 crowdSource가 'owner'일 수 있음. */
  isRegistered: boolean;

  /** 데이터 없으면 null. null이면 회색 마커. */
  crowdLevel: CrowdLevel | null;
  crowdSource: CrowdSource;
  confidence: Confidence;

  /**
   * 좌석 점유율(%). WF01 지도 범례·WF07 혼잡도 게이지에 쓰는 값.
   * 등록 카페는 (1 - emptySeats/totalSeats)*100 실측치, 미등록은 모델 예측 확률.
   * 없으면 null (crowdLevel만 표시).
   */
  occupancyPercent: number | null;

  /** 등록 카페만 실제 좌석 수를 가짐. 미등록은 null. */
  totalSeats: number | null;
  emptySeats: number | null;

  /** 로그인 유저가 즐겨찾기한 카페인지 (GET /api/cafes, /api/me/favorites 공통 필드). */
  isFavorite: boolean;

  tags: CafeTag[];

  /** 상세 화면 부가 정보 */
  hasSmokingRoom: boolean;
  /** 화장실 청결도 1~5. 제보 없으면 null. */
  restroomScore: number | null;
  /** 조용한 정도 1~5. 제보 없으면 null. WF06 별점 제보 항목. */
  quietScore: number | null;
  /** 콘센트 여유 정도. 제보 없으면 null. */
  outletLevel: OutletLevel | null;

  /** 최근 24시간 제보 건수. "최근 제보 2건" 표시에 사용. */
  reportCount24h: number;

  /** 마지막 갱신 시각 (ISO 8601). "3분 전" 계산용. */
  updatedAt: string;

  // ── WF04 상세 전용. 등록 카페 3곳만 값이 있고 미등록은 전부 null ──
  /** "1층·2층 좌석 분리, 계단 있음" 같은 매장 구조 메모. */
  structureNote: string | null;
  /** 1인석 수 */
  seatsSolo: number | null;
  /** 2인석 수 */
  seatsPair: number | null;
  /** 단체석 수 */
  seatsGroup: number | null;
}

/** GET /api/cafes/{id}/reports 응답. v4에서 배열 → 객체로 감싸짐. */
export interface CafeReportsResponse {
  cafeId: number;
  /** "오늘 제보 4건" */
  todayCount: number;
  /** "마지막 제보 3분 전". 제보가 없으면 null. */
  lastReportedAt: string | null;
  totalCount: number;
  reports: ReportEntry[];
}

/** 제보에 달린 신뢰도 투표 답글. */
export interface ReportReply {
  agree: boolean;
  content: string;
}

/** 제보 내역 한 건 (WF05). */
export interface ReportEntry {
  nickname: string;
  crowdLevel: CrowdLevel;
  quietScore: number;
  restroomScore: number;
  outletLevel: OutletLevel;
  smokingRoom: SmokingRoomType;
  visitCount: VisitCount;
  note: string;
  reportedAt: string;
  /** 답글 달 때 필요한 인덱스 (0부터). */
  reportIndex: number;
  replies: ReportReply[];
}

/** GET /api/cafes/{id}/history?day= 응답 한 점 (WF07 그래프). */
export interface HistoryPoint {
  hour: number;
  occupancyPercent: number;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** GET /api/cafes/{id}/forecast?minutes= 응답 (WF04 "도착 시점"). */
export interface ForecastResponse {
  cafeId: number;
  minutes: number;
  crowdLevel: CrowdLevel;
  occupancyPercent: number;
  confidence: Confidence;
  /** 예측 대상 시각 (ISO 8601). */
  forecastAt: string;
}

/** 사용자가 혼잡도를 제보할 때 보내는 body 전체 (WF06 폼과 1:1 대응). */
export interface CrowdReportRequest {
  cafeId: number;
  crowdLevel: CrowdLevel;
  quietScore: number;
  restroomScore: number;
  outletLevel: OutletLevel;
  smokingRoom: SmokingRoomType;
  visitCount: VisitCount;
  /** 한줄 후기, 선택 입력, 최대 100자 */
  note: string;
  /** GPS 검증용. 서버가 카페 좌표와 거리 비교해서 허위 제보 차단. */
  userLat: number;
  userLng: number;
}

/** POST /api/reports 제보 1건에 대한 스탬프 적립 결과. */
export interface StampResult {
  earned: boolean;
  /** "반경 확인됨" / "위치가 확인되지 않음" / "하루 적립 상한(3개) 도달" */
  reason: string;
  count: number;
  goal: number;
  /** 목표 칸수를 채우면 쿠폰이 담기고, 아니면 null. */
  couponIssued: { code: string; cafeId: number; cafeName: string; reward: string; expiresAt: string } | null;
}

/** POST /api/reports 성공 응답. */
export interface CrowdReportResponse {
  success: boolean;
  /** 서버가 계산한 사용자-카페 거리(m). GPS 검증 통과 여부 근거. */
  distanceMeters: number;
  stamp?: StampResult;
}

/**
 * 사장님이 좌석 상태를 갱신할 때 보내는 body.
 * WF11 화면은 정확한 좌석 숫자가 아니라 여유/보통/혼잡/만석 버튼 4개 중 하나만 고르는 구조라
 * emptySeats가 아니라 crowdLevel을 보낸다. (v1 계약서엔 emptySeats로 잘못 적혀 있었음 — v2에서 수정)
 */
export interface OwnerSeatUpdateRequest {
  cafeId: number;
  crowdLevel: CrowdLevel;
}
