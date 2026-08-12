import { useEffect, useRef } from 'react';
import { useNaverMapScript } from '../hooks/useNaverMapScript';
import { getCafeVisual } from '../constants/crowd';
import type { Cafe } from '../types/cafe';

interface CafeMapProps {
  cafes: Cafe[];
  center: { lat: number; lng: number };
  onSelect?: (cafe: Cafe) => void;
}

/**
 * 마커 HTML을 직접 그린다 (기본 빨간 핀 대신).
 * 색 = 혼잡도, 테두리 = 데이터 출처. constants/crowd.ts의 규칙을 그대로 반영.
 */
function buildMarkerHtml(cafe: Cafe): string {
  const v = getCafeVisual(cafe);
  const borderStyle = v.borderStyle === 'dashed' ? 'dashed' : 'solid';
  return `
    <div style="
      display:flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:50%;
      background:${v.bg}; color:${v.text};
      border:2px ${borderStyle} ${v.color};
      opacity:${v.opacity};
      font-size:14px; font-weight:700;
      box-shadow:0 1px 4px rgba(0,0,0,0.25);
    ">${v.icon}</div>
  `;
}

export default function CafeMap({ cafes, center, onSelect }: CafeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const status = useNaverMapScript();

  // 지도 초기화 (한 번만)
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || mapInstance.current) return;

    mapInstance.current = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(center.lat, center.lng),
      zoom: 16,
      minZoom: 14,
      maxZoom: 19,
    });
  }, [status, center.lat, center.lng]);

  // 마커 그리기 (cafes 바뀔 때마다 갱신)
  useEffect(() => {
    if (status !== 'ready' || !mapInstance.current) return;

    // 기존 마커 정리 (매번 새로 그리기 — 15개 수준에선 성능 문제 없음)
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    cafes.forEach((cafe) => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(cafe.lat, cafe.lng),
        map: mapInstance.current,
        icon: {
          content: buildMarkerHtml(cafe),
          anchor: new window.naver.maps.Point(16, 16),
        },
        title: cafe.name,
      });

      if (onSelect) {
        window.naver.maps.Event.addListener(marker, 'click', () => onSelect(cafe));
      }

      markersRef.current.push(marker);
    });
  }, [status, cafes, onSelect]);

  if (status === 'error') {
    return (
      <div style={{ padding: 16, color: '#6E1220' }}>
        지도를 불러오지 못했어요. frontend/.env의 VITE_NAVER_MAP_CLIENT_ID와
        Naver Cloud 콘솔의 Web 서비스 URL(localhost:5173) 등록을 확인하세요.
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: '100%', minHeight: 480 }}
      aria-label="카페 혼잡도 지도"
    />
  );
}
