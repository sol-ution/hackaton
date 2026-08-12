/**
 * 브라우저 GPS 위치 조회. 제보 허위 방지 검증(백엔드가 반경 체크)에 쓸 좌표를 얻는다.
 * localhost는 HTTPS 아니어도 geolocation 허용됨 — 배포(HTTPS 아닌 도메인)에서는 막힘 주의.
 */
export function getCurrentPosition(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 8000 },
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('이 브라우저는 위치 정보를 지원하지 않아요.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}
