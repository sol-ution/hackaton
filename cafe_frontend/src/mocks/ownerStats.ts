import type { CrowdLevel } from '../types/cafe';

/** WF11 "오늘 우리 매장" 통계 카드용 더미. cafeId 기준. */
export interface OwnerDailyStats {
  views: number;
  directions: number;
  reports: number;
}

export const MOCK_OWNER_STATS: Record<number, OwnerDailyStats> = {
  1: { views: 87, directions: 12, reports: 5 },
  2: { views: 54, directions: 9, reports: 3 },
  3: { views: 132, directions: 21, reports: 8 },
};

/** WF11 "손님 제보와 비교" 목록 항목. */
export interface ComparisonEntry {
  crowdLevel: CrowdLevel;
  minutesAgo: number;
}

export const MOCK_COMPARISONS: Record<number, ComparisonEntry[]> = {
  1: [
    { crowdLevel: 0, minutesAgo: 3 },
    { crowdLevel: 1, minutesAgo: 26 },
  ],
  2: [
    { crowdLevel: 2, minutesAgo: 8 },
    { crowdLevel: 2, minutesAgo: 40 },
  ],
  3: [{ crowdLevel: 3, minutesAgo: 5 }],
};
