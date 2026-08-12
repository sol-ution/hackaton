import { useEffect, useState } from 'react';
import { CROWD_META, formatUpdatedAt } from '../constants/crowd';
import { BRAND } from '../constants/theme';
import { fetchMyCoupons, fetchMyFavorites, fetchMyReports, fetchMyStamps, useCoupon } from '../api/client';
import { MOCK_FAVORITE_CAFE_IDS, MOCK_MY_REPORTS, MOCK_MY_STAMPS, MOCK_PENDING_COUPONS } from '../mocks/activity';
import { PrimaryButton, ListLinkRow, ScreenContainer, ScreenHeader, SectionTitle, StatBlock, StatCard } from './ScreenChrome';
import type { Cafe } from '../types/cafe';
import type { StampCardApi } from '../types/activity';

/** WF13 "내 쿠폰" 카드 표시용 — API(CouponApi)와 mock(Coupon) 필드명이 달라 이 모양으로 맞춰서 그린다. */
interface CouponView {
  code: string;
  cafeName: string;
  reward: string;
  note: string;
}

interface MyPageProps {
  cafes: Cafe[];
  offline: boolean;
  onBack: () => void;
  onOpenActivity: (tab: 'reports' | 'reviews') => void;
  onOpenSettings: () => void;
  onSelectCafe: (cafe: Cafe) => void;
}

/** 스탬프 카드 표시는 API 응답(StampCardApi)과 mock(StampCard) 필드명이 달라 이 모양으로 맞춰서 그린다. */
interface StampCardView {
  cafeId: number;
  cafeName: string;
  rewardLabel: string;
  totalSlots: number;
  filled: number;
}

function toStampView(cards: StampCardApi[]): StampCardView[] {
  return cards.map((c) => ({
    cafeId: c.cafeId,
    cafeName: c.cafeName,
    rewardLabel: c.reward,
    totalSlots: c.goal,
    filled: c.count,
  }));
}

/** WF09 마이페이지. 즐겨찾기·스탬프·제보 수는 실제 백엔드(하윤 API 33개)에서 온다.
 * 오프라인(서버 미연결)일 때만 mocks/activity.ts 더미로 대체. */
export default function MyPage({ cafes, offline, onBack, onOpenActivity, onOpenSettings, onSelectCafe }: MyPageProps) {
  const [favorites, setFavorites] = useState<Cafe[] | null>(null);
  const [stamps, setStamps] = useState<StampCardView[] | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [coupons, setCoupons] = useState<CouponView[] | null>(null);
  const [couponReloadKey, setCouponReloadKey] = useState(0);

  useEffect(() => {
    if (offline) {
      setFavorites(
        MOCK_FAVORITE_CAFE_IDS.map((id) => cafes.find((c) => c.id === id)).filter(
          (c): c is Cafe => c !== undefined,
        ),
      );
      setStamps(MOCK_MY_STAMPS);
      setReportCount(MOCK_MY_REPORTS.length + 20);
      return;
    }
    let alive = true;
    fetchMyFavorites()
      .then((r) => alive && setFavorites((r.favorites ?? []).map((f) => f.cafe)))
      .catch(
        () =>
          alive &&
          setFavorites(
            MOCK_FAVORITE_CAFE_IDS.map((id) => cafes.find((c) => c.id === id)).filter(
              (c): c is Cafe => c !== undefined,
            ),
          ),
      );
    fetchMyStamps()
      .then((r) => alive && setStamps(toStampView(r.cards ?? [])))
      .catch(() => alive && setStamps(MOCK_MY_STAMPS));
    fetchMyReports()
      .then((r) => alive && setReportCount(r.totalCount ?? 0))
      .catch(() => alive && setReportCount(MOCK_MY_REPORTS.length + 20));
    return () => {
      alive = false;
    };
    // cafes는 오프라인 폴백에만 쓰이므로 온라인 재조회 트리거에서는 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline]);

  useEffect(() => {
    if (offline) {
      setCoupons(MOCK_PENDING_COUPONS.map((c) => ({ code: c.code, cafeName: c.cafeName, reward: c.rewardLabel, note: `${formatUpdatedAt(c.issuedAt)} 발급` })));
      return;
    }
    let alive = true;
    fetchMyCoupons()
      .then(
        (r) =>
          alive &&
          setCoupons(
            (r.coupons ?? [])
              .filter((c) => !c.used)
              .map((c) => ({ code: c.code, cafeName: c.cafeName, reward: c.reward, note: `~${c.expiresAt.slice(0, 10).replace(/-/g, '.')}까지` })),
          ),
      )
      .catch(() => alive && setCoupons([]));
    return () => {
      alive = false;
    };
  }, [offline, couponReloadKey]);

  async function handleUseCoupon(coupon: CouponView) {
    const pin = window.prompt(`"${coupon.reward}" 쿠폰을 사용할게요.\n매장 직원분께 PIN을 요청해서 입력해주세요.`, '');
    if (pin === null || pin.trim() === '') return;
    if (offline) {
      setCoupons((prev) => (prev ? prev.filter((c) => c.code !== coupon.code) : prev));
      return;
    }
    try {
      await useCoupon(coupon.code, pin);
      setCouponReloadKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : '쿠폰 사용에 실패했어요.');
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="마이" onBack={onBack} />
      <div style={{ padding: '20px' }}>
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
              <div style={{ fontWeight: 700, fontSize: 16, color: '#26201A' }}>자리요러</div>
              <div style={{ fontSize: 12, color: BRAND.textSub }}>카카오 계정 연결됨 · 공부·작업</div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: BRAND.textSub }}>수정 ›</span>
        </div>

        <StatCard>
          <StatBlock label="즐겨찾기" value={favorites?.length ?? '-'} />
          <StatBlock label="내 제보" value={reportCount ?? '-'} />
        </StatCard>

        {favorites && favorites.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionTitle>즐겨찾기한 카페</SectionTitle>
            <div style={{ fontSize: 12, color: BRAND.textSub, marginBottom: 8, marginTop: -4 }}>
              단골 카페의 지금 상태를 한눈에 봅니다
            </div>
            {favorites.map((cafe) => {
              const meta = cafe.crowdLevel !== null ? CROWD_META[cafe.crowdLevel] : null;
              return (
                <button
                  key={cafe.id}
                  onClick={() => onSelectCafe(cafe)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    border: 'none',
                    borderBottom: `1px solid ${BRAND.border}`,
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 40, height: 40, borderRadius: 8, background: '#e5ddcc', flexShrink: 0 }} />
                    <span>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#26201A' }}>{cafe.name}</div>
                      <div style={{ fontSize: 12, color: BRAND.textSub }}>
                        {cafe.emptySeats !== null && cafe.totalSeats !== null
                          ? `빈자리 ${cafe.emptySeats}/${cafe.totalSeats}`
                          : formatUpdatedAt(cafe.updatedAt)}
                      </div>
                    </span>
                  </span>
                  {meta && (
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: meta.bg,
                        color: meta.text,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {meta.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {coupons && coupons.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionTitle>내 쿠폰</SectionTitle>
            {coupons.map((c) => (
              <div key={c.code} style={{ padding: 14, borderRadius: 12, background: '#fff', border: `1px solid ${BRAND.border}`, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#26201A' }}>{c.reward}</div>
                    <div style={{ fontSize: 12, color: BRAND.textSub }}>{c.cafeName} · {c.note}</div>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: BRAND.primary }}>{c.code}</span>
                </div>
                <PrimaryButton onClick={() => handleUseCoupon(c)} style={{ padding: '10px 0', fontSize: 13 }}>
                  매장에서 사용하기
                </PrimaryButton>
              </div>
            ))}
          </div>
        )}

        {stamps && stamps.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <SectionTitle>내 스탬프</SectionTitle>
            {stamps.map((s) => (
              <div key={s.cafeId} style={{ padding: '14px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${BRAND.border}`, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#26201A' }}>{s.cafeName}</div>
                    <div style={{ fontSize: 12, color: BRAND.textSub }}>{s.rewardLabel}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>
                    {s.filled}
                    <span style={{ color: BRAND.textSub, fontWeight: 600 }}> / {s.totalSlots}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Array.from({ length: s.totalSlots }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: i < s.filled ? BRAND.primary : 'transparent',
                        border: i < s.filled ? 'none' : `1px dashed ${BRAND.border}`,
                      }}
                    />
                  ))}
                </div>
                {s.filled < s.totalSlots && (
                  <div style={{ fontSize: 11, color: BRAND.textSub, marginTop: 8 }}>
                    {s.totalSlots - s.filled}개 더 모으면 {s.rewardLabel}을 받아요
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ListLinkRow label="내 제보 내역" onClick={() => onOpenActivity('reports')} />
      <ListLinkRow label="내 리뷰" onClick={() => onOpenActivity('reviews')} />
      <ListLinkRow label="설정" onClick={onOpenSettings} />
    </ScreenContainer>
  );
}
