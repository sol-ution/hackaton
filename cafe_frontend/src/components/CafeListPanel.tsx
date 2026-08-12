import { getCafeVisual, formatUpdatedAt } from '../constants/crowd';
import { distanceInMeters } from '../utils/geo';
import type { Cafe } from '../types/cafe';

interface CafeListPanelProps {
  cafes: Cafe[];
  center: { lat: number; lng: number };
  onSelect: (cafe: Cafe) => void;
  selectedId?: number | null;
}

/**
 * WF01 하단 시트("주변 카페 12곳")와 WF02 카페 리스트를 겸하는 컴포넌트.
 * 거리순 정렬 고정 — WF02의 "가까운 순" 정렬 옵션은 추후 드롭다운으로 확장 가능.
 */
export default function CafeListPanel({ cafes, center, onSelect, selectedId }: CafeListPanelProps) {
  const sorted = [...cafes].sort(
    (a, b) => distanceInMeters(center, a) - distanceInMeters(center, b),
  );

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ padding: '10px 16px', fontSize: 13, color: '#666', fontWeight: 600 }}>
        주변 카페 {sorted.length}곳
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {sorted.map((cafe) => {
          const visual = getCafeVisual(cafe);
          const distance = Math.round(distanceInMeters(center, cafe));
          const isSelected = cafe.id === selectedId;

          return (
            <li key={cafe.id}>
              <button
                onClick={() => onSelect(cafe)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: '1px solid #f0f0f0',
                  background: isSelected ? '#F5F7FA' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: '#eee',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cafe.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`} ·{' '}
                    {cafe.isRegistered && cafe.totalSeats !== null
                      ? `좌석 ${cafe.emptySeats}/${cafe.totalSeats} · 실시간`
                      : cafe.crowdSource === 'predicted'
                        ? '예측값'
                        : cafe.crowdSource === 'report'
                          ? '제보 기반'
                          : formatUpdatedAt(cafe.updatedAt)}
                  </div>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 700,
                    color: visual.text,
                    background: visual.bg,
                  }}
                >
                  {visual.icon} {visual.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
