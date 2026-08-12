import { useEffect, useState } from 'react';
import { CROWD_META } from '../constants/crowd';
import { BRAND } from '../constants/theme';
import { fetchOwnerDashboard } from '../api/client';
import { MOCK_OWNER_STATS } from '../mocks/ownerStats';
import { ListLinkRow, ScreenContainer, ScreenHeader, StatBlock, StatCard } from './ScreenChrome';
import type { Cafe } from '../types/cafe';

interface OwnerMyPageProps {
  cafe: Cafe;
  offline: boolean;
  onBack: () => void;
  onOpenSeat: () => void;
  onOpenStoreInfo: () => void;
  onOpenStampPolicy: () => void;
  onOpenCouponRedeem: () => void;
  onOpenSettings: () => void;
}

/** WF12 마이페이지(사장). 매장 관리 기능들의 허브 — 하위 화면들이 각자 실 API로 저장/조회한다. */
export default function OwnerMyPage({
  cafe,
  offline,
  onBack,
  onOpenSeat,
  onOpenStoreInfo,
  onOpenStampPolicy,
  onOpenCouponRedeem,
  onOpenSettings,
}: OwnerMyPageProps) {
  const [stats, setStats] = useState(MOCK_OWNER_STATS[cafe.id] ?? { views: 0, directions: 0, reports: 0 });

  useEffect(() => {
    if (offline) {
      setStats(MOCK_OWNER_STATS[cafe.id] ?? { views: 0, directions: 0, reports: 0 });
      return;
    }
    let alive = true;
    fetchOwnerDashboard(cafe.id)
      .then(
        (d) =>
          alive &&
          setStats({
            views: d.today?.viewCount ?? 0,
            directions: d.today?.directionCount ?? 0,
            reports: d.today?.reportCount ?? 0,
          }),
      )
      .catch(() => alive && setStats(MOCK_OWNER_STATS[cafe.id] ?? { views: 0, directions: 0, reports: 0 }));
    return () => {
      alive = false;
    };
  }, [cafe.id, offline]);

  const meta = cafe.crowdLevel !== null ? CROWD_META[cafe.crowdLevel] : null;

  return (
    <ScreenContainer>
      <ScreenHeader title="마이" onBack={onBack} />
      <div style={{ padding: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 16px',
            borderRadius: 14,
            background: BRAND.card,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#26201A' }}>
                자리요러 <span style={{ fontSize: 11, background: BRAND.primary, color: '#fff', borderRadius: 999, padding: '2px 7px', marginLeft: 4 }}>사장님</span>
              </div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: BRAND.textSub }}>수정 ›</span>
        </div>

        <button
          onClick={onOpenSeat}
          style={{
            width: '100%',
            textAlign: 'left',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginBottom: 16,
          }}
        >
          <div style={{ padding: '14px 16px', borderRadius: '14px 14px 0 0', background: BRAND.cardStrong, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#3E2F22' }}>내 매장 · {cafe.name}</span>
            {meta && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: meta.text }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
                {meta.label}
              </span>
            )}
          </div>
          <StatCard>
            <StatBlock label="오늘 조회" value={stats.views} />
            <StatBlock label="길찾기" value={stats.directions} />
            <StatBlock label="손님 제보" value={stats.reports} />
          </StatCard>
        </button>
      </div>

      <div style={{ padding: '0 20px 8px', fontSize: 12, color: BRAND.textSub, display: 'flex', alignItems: 'center', gap: 6 }}>
        매장 관리
        <span style={{ fontSize: 10, background: BRAND.primary, color: '#fff', borderRadius: 999, padding: '1px 6px' }}>사장님 전용</span>
      </div>
      <ListLinkRow label="사장님 좌석 등록" sub="지금 좌석 상태를 갱신합니다" onClick={onOpenSeat} />
      <ListLinkRow label="매장 정보 관리" sub="사진 · 좌석 구성 · 영업시간 · 카테고리" onClick={onOpenStoreInfo} />
      <ListLinkRow label="스탬프 발행 관리" sub="리워드 · 칸 수 · 적립 조건 · 유효기간" onClick={onOpenStampPolicy} />
      <ListLinkRow label="쿠폰 사용 처리" sub="손님이 보여준 쿠폰을 처리합니다" onClick={onOpenCouponRedeem} />
      <div style={{ height: 8 }} />
      <ListLinkRow label="설정" onClick={onOpenSettings} />
    </ScreenContainer>
  );
}
