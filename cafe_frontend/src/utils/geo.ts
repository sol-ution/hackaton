import type { Cafe } from '../types/cafe';

/** 지도 초기 중심: 인하대 후문 근처 */
export const MAP_CENTER = { lat: 37.4497, lng: 126.654 };

/**
 * 두 좌표 사이 거리(m) — 하버사인.
 * 백엔드 main.py의 haversine_m과 동일 공식이어야 함
 * (제보 GPS 검증 결과가 프론트 예상과 어긋나지 않도록).
 */
export function distanceInMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * 거리(m) → 도보 시간(분). 성인 보통 걸음 4km/h ≈ 67m/분 기준.
 * WF04 "도보 4분" 표시와 /forecast의 minutes 파라미터에 같은 값을 쓴다.
 * 0분은 어색하므로 최소 1분.
 */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 67));
}

/** 만석일 때 보여줄 "대체 카페 3곳" — 가까우면서 덜 붐비는 순. */
export function findAlternatives(target: Cafe, all: Cafe[], limit = 3): Cafe[] {
  return all
    .filter((c) => c.id !== target.id && c.crowdLevel !== null && c.crowdLevel <= 1)
    .sort((a, b) => distanceInMeters(target, a) - distanceInMeters(target, b))
    .slice(0, limit);
}
