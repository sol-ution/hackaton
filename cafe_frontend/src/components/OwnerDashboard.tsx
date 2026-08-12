import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { CROWD_META, CROWD_LEVEL_OPTIONS, TAG_LABELS, formatUpdatedAt } from '../constants/crowd';
import { fetchOwnerDashboard } from '../api/client';
import { MOCK_OWNER_STATS, MOCK_COMPARISONS } from '../mocks/ownerStats';
import type { Cafe, CafeTag, CrowdLevel } from '../types/cafe';
import type { OwnerDashboardComparison } from '../types/activity';

interface OwnerDashboardProps {
  cafe: Cafe;
  offline: boolean;
  onUpdateSeat: (level: CrowdLevel) => void;
  onOpenSettings: () => void;
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888' }}>{label}</div>
    </div>
  );
}

function compareLabel(mine: CrowdLevel, theirs: CrowdLevel): string {
  if (mine === theirs) return '내 등록과 일치';
  return theirs > mine ? '내 등록보다 혼잡' : '내 등록보다 한산';
}

interface DashboardStats {
  views: number;
  directions: number;
  reports: number;
}

/** WF11 사장님 좌석 등록 화면. 로그인/카페 소유권 검증은 데모 스코프 밖 — 고정된 카페 하나로 시연.
 * 오늘 통계·손님 제보 비교는 GET /api/owner/{cafeId}/dashboard 실 API에서 받는다(오프라인이면 mock). */
export default function OwnerDashboard({ cafe, offline, onUpdateSeat, onOpenSettings }: OwnerDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>(MOCK_OWNER_STATS[cafe.id] ?? { views: 0, directions: 0, reports: 0 });
  const [comparisons, setComparisons] = useState<OwnerDashboardComparison[]>([]);
  const [tags, setTags] = useState<CafeTag[]>(cafe.tags);

  useEffect(() => {
    if (offline) {
      setStats(MOCK_OWNER_STATS[cafe.id] ?? { views: 0, directions: 0, reports: 0 });
      setComparisons(
        (MOCK_COMPARISONS[cafe.id] ?? []).map((c) => ({
          crowdLevel: c.crowdLevel,
          verdict: cafe.crowdLevel !== null ? compareLabel(cafe.crowdLevel, c.crowdLevel) : '',
          reportedAt: '',
        })),
      );
      setTags(cafe.tags);
      return;
    }
    let alive = true;
    fetchOwnerDashboard(cafe.id)
      .then((d) => {
        if (!alive) return;
        setStats({
          views: d.today?.viewCount ?? 0,
          directions: d.today?.directionCount ?? 0,
          reports: d.today?.reportCount ?? 0,
        });
        setComparisons(d.comparisons ?? []);
        setTags((d.tags as CafeTag[]) ?? []);
      })
      .catch(() => {
        if (!alive) return;
        setStats(MOCK_OWNER_STATS[cafe.id] ?? { views: 0, directions: 0, reports: 0 });
        setComparisons([]);
      });
    return () => {
      alive = false;
    };
  }, [cafe.id, offline, cafe.crowdLevel, cafe.tags]);

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 14, color: '#888' }}>{cafe.name} · {cafe.address.split(' ').slice(-1)[0]}</div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: '#111',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          사장님
        </span>
      </div>

      <h2 style={{ margin: '4px 0 16px', fontSize: 20 }}>지금 좌석 상태</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
        {CROWD_LEVEL_OPTIONS.map((level) => {
          const meta = CROWD_META[level];
          const active = cafe.crowdLevel === level;
          const style: CSSProperties = {
            padding: '12px 0',
            borderRadius: 10,
            border: active ? `2px solid ${meta.color}` : '1px solid #ddd',
            background: active ? meta.bg : '#fff',
            color: active ? meta.text : '#333',
            fontWeight: 700,
            cursor: 'pointer',
          };
          return (
            <button key={level} onClick={() => onUpdateSeat(level)} style={style}>
              {meta.label}
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: '#999', marginBottom: 20 }}>
        {formatUpdatedAt(cafe.updatedAt)} 갱신 · 18분 뒤 확인 요청
      </p>

      <div
        style={{
          display: 'flex',
          padding: '16px 0',
          borderRadius: 12,
          background: '#F5F7FA',
          marginBottom: 16,
        }}
      >
        <StatItem label="조회" value={stats.views} />
        <StatItem label="길찾기" value={stats.directions} />
        <StatItem label="제보" value={stats.reports} />
      </div>

      {tags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textAlign: 'left' }}>
            매장 정보
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: '#F1F2F4',
                  color: '#374151',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {TAG_LABELS[tag]}
              </span>
            ))}
          </div>
        </div>
      )}

      {comparisons.length > 0 && cafe.crowdLevel !== null && (
        <div style={{ marginBottom: 16, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>손님 제보와 비교</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {comparisons.map((c, i) => {
              const meta = CROWD_META[c.crowdLevel];
              return (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: i < comparisons.length - 1 ? '1px solid #f0f0f0' : 'none',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: meta.bg,
                        color: meta.text,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 13, color: '#555' }}>{c.verdict}</span>
                  </span>
                  {c.reportedAt && (
                    <span style={{ fontSize: 12, color: '#999' }}>{formatUpdatedAt(c.reportedAt)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        onClick={onOpenSettings}
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: '1px solid #eee',
          background: '#fff',
          color: '#666',
          cursor: 'pointer',
        }}
      >
        마이페이지 ›
      </button>
    </div>
  );
}
