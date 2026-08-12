import type {
  CrowdLevel,
  CrowdSource,
  CafeTag,
  Cafe,
  OutletLevel,
  SmokingRoomType,
  VisitCount,
} from '../types/cafe';

/**
 * 색 = 혼잡도만. 등록/미등록은 색으로 구분하지 않는다.
 * (색으로 두 가지를 동시에 표현하면 "초록=등록"과 "초록=여유"가 충돌함)
 *
 * 팔레트는 색각 이상 검증기를 돌려서 고른 값이다:
 *   인접쌍 최소 ΔE — 일반 19.0 / 적록색약 17.6 (기준: 일반 15, CVD 8)
 * 이전 팔레트(#C99A06 보통 / #E1701A 혼잡)는 일반 시야에서도 ΔE 10.7이라
 * 지도에서 두 마커가 구분되지 않았다.
 *
 * '보통'의 노랑은 흰 배경 대비가 3:1 미만이라, 색만으로 쓰면 안 되고
 * 반드시 아이콘(icon)이나 라벨(label)을 함께 노출해야 한다 — 지금 모든 화면이 그렇게 되어 있다.
 *
 * icon은 색맹 대응용. 색을 못 봐도 모양으로 구분되게.
 */
export const CROWD_META: Record<
  CrowdLevel,
  { label: string; color: string; bg: string; text: string; icon: string; hint: string }
> = {
  0: {
    label: '여유',
    color: '#1F9254',
    bg: '#E6F4EC',
    text: '#0F5C33',
    icon: '○',
    hint: '좌석 많아 보여요',
  },
  1: {
    label: '보통',
    color: '#E8C000',
    bg: '#FBF3D6',
    text: '#6B5200',
    icon: '◐',
    hint: '자리는 있는 것 같아요',
  },
  2: {
    label: '혼잡',
    color: '#E06010',
    bg: '#FCEADD',
    text: '#7A3208',
    icon: '●',
    hint: '사람 많아요',
  },
  3: {
    label: '만석',
    color: '#A31C2E',
    bg: '#FBE7EA',
    text: '#6E1220',
    icon: '✕',
    hint: '자리 없어요',
  },
};

/** 데이터가 아예 없을 때 (crowdLevel === null) */
export const CROWD_UNKNOWN = {
  label: '정보 없음',
  color: '#8B9199',
  bg: '#F1F2F4',
  text: '#4A4F56',
  icon: '?',
  hint: '아직 제보가 없어요',
};

/**
 * 데이터 출처 = 마커 테두리 스타일로 표현.
 * 실시간(사장님)은 꽉 찬 핀, 예측은 점선 + 반투명.
 */
export const SOURCE_META: Record<
  CrowdSource,
  { label: string; borderStyle: 'solid' | 'dashed'; opacity: number; badge: string }
> = {
  owner: { label: '실시간', borderStyle: 'solid', opacity: 1, badge: '사장님 확인' },
  report: { label: '제보', borderStyle: 'solid', opacity: 0.9, badge: '사용자 제보' },
  predicted: { label: '예측', borderStyle: 'dashed', opacity: 0.65, badge: 'AI 예측' },
  none: { label: '정보 없음', borderStyle: 'dashed', opacity: 0.4, badge: '데이터 없음' },
};

export const TAG_LABELS: Record<CafeTag, string> = {
  study: '공부하기 좋은',
  talk: '대화 위주',
  outlet: '콘센트 많음',
  quiet: '조용함',
  'wide-table': '넓은 테이블',
  'late-night': '늦게까지',
};

/** WF02 카테고리 필터 칩. '전체'는 null로 표현 (필터 없음). */
export const FILTER_CATEGORIES: { key: CafeTag | null; label: string }[] = [
  { key: null, label: '전체' },
  { key: 'study', label: '공부' },
  { key: 'talk', label: '대화' },
  { key: 'quiet', label: '조용' },
  { key: 'outlet', label: '콘센트' },
];

export const OUTLET_LABELS: Record<OutletLevel, string> = {
  many: '콘센트 많음',
  normal: '콘센트 보통',
  none: '콘센트 없음',
};

/** WF06 제보 폼 옵션 순서 그대로. */
export const OUTLET_OPTIONS: { key: OutletLevel; label: string }[] = [
  { key: 'many', label: '많음' },
  { key: 'normal', label: '보통' },
  { key: 'none', label: '없음' },
];

export const SMOKING_LABELS: Record<SmokingRoomType, string> = {
  indoor: '있음(실내)',
  outdoor: '있음(실외)',
  none: '없음',
};

export const SMOKING_OPTIONS: { key: SmokingRoomType; label: string }[] = [
  { key: 'indoor', label: '있음(실내)' },
  { key: 'outdoor', label: '있음(실외)' },
  { key: 'none', label: '없음' },
];

export const VISIT_COUNT_LABELS: Record<VisitCount, string> = {
  solo: '혼자',
  two: '2명',
  'three-four': '3~4명',
  'five-plus': '5명 이상',
};

export const VISIT_COUNT_OPTIONS: { key: VisitCount; label: string }[] = [
  { key: 'solo', label: '혼자' },
  { key: 'two', label: '2명' },
  { key: 'three-four', label: '3~4명' },
  { key: 'five-plus', label: '5명 이상' },
];

/** WF06 "현재 카페는 어떤가요?" 4단계 버튼 순서. */
export const CROWD_LEVEL_OPTIONS: CrowdLevel[] = [0, 1, 2, 3];

/**
 * 혼잡도 단계 → 대표 점유율(%). 제보/사장님 갱신처럼 "레벨만 있고 실제 %는 모를 때"
 * occupancyPercent를 대충 채워 넣는 용도. 등록 카페의 실측 좌석 계산과는 별개.
 */
export const OCCUPANCY_MIDPOINT: Record<CrowdLevel, number> = { 0: 30, 1: 70, 2: 90, 3: 100 };

/** 마커 하나 그리는 데 필요한 시각 정보를 한 번에 계산. */
export function getCafeVisual(cafe: Cafe) {
  const crowd = cafe.crowdLevel === null ? CROWD_UNKNOWN : CROWD_META[cafe.crowdLevel];
  const source = SOURCE_META[cafe.crowdSource];
  return {
    ...crowd,
    ...source,
    /** 스크린리더 및 툴팁용 한 줄 설명 */
    ariaLabel: `${cafe.name}, ${crowd.label}, ${source.label}`,
  };
}

/**
 * 좌석 점유율(0~100) → 혼잡도 4단계 변환.
 * 기준: 여유 0-60% / 보통 60-80% / 혼잡 80-100% / 만석(좌석 0). WF01·WF07 범례와 동일.
 * 백엔드와 반드시 같은 기준 써야 함 — 다르면 지도 색이랑 상세 화면 숫자가 어긋남.
 */
export function occupancyToCrowdLevel(occupancyPercent: number): CrowdLevel {
  if (occupancyPercent >= 100) return 3;
  if (occupancyPercent >= 80) return 2;
  if (occupancyPercent >= 60) return 1;
  return 0;
}

/** 등록 카페의 좌석 수 → 점유율(%) 변환. */
export function seatsToOccupancyPercent(emptySeats: number, totalSeats: number): number {
  if (totalSeats <= 0) return 100;
  return Math.round((1 - emptySeats / totalSeats) * 100);
}

/** 등록 카페의 좌석 수 → 혼잡도 4단계 변환 (occupancyToCrowdLevel 합성). */
export function seatsToCrowdLevel(emptySeats: number, totalSeats: number): CrowdLevel {
  if (totalSeats <= 0) return 3;
  if (emptySeats <= 0) return 3;
  return occupancyToCrowdLevel(seatsToOccupancyPercent(emptySeats, totalSeats));
}

/** "3분 전" 형태로 갱신 시각 표시. */
export function formatUpdatedAt(iso: string, now: Date = new Date()): string {
  const diffMin = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
}
