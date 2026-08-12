import { useEffect, useState } from 'react';
import { BRAND } from '../constants/theme';
import { fetchOwnerCoupons, useCoupon } from '../api/client';
import { MOCK_PENDING_COUPONS, MOCK_REDEEMED_COUPONS } from '../mocks/activity';
import { formatUpdatedAt } from '../constants/crowd';
import { PrimaryButton, ScreenContainer, ScreenHeader, SectionTitle } from './ScreenChrome';
import type { OwnerCouponEntry } from '../types/activity';

interface CouponRedeemProps {
  cafeId: number;
  offline: boolean;
  onBack: () => void;
}

/** WF16 스탬프 관리 - 쿠폰 사용 처리. GET /api/owner/{cafeId}/coupons 로 대기/완료 목록을 받고,
 * "사용 처리"를 누르면 PIN을 물어본 뒤 POST /api/coupons/{code}/use?pin= 을 호출한다. */
export default function CouponRedeem({ cafeId, offline, onBack }: CouponRedeemProps) {
  const [pending, setPending] = useState<OwnerCouponEntry[]>(MOCK_PENDING_COUPONS.map((c) => ({ code: c.code, reward: c.rewardLabel, issuedAt: c.issuedAt })));
  const [done, setDone] = useState<OwnerCouponEntry[]>(
    MOCK_REDEEMED_COUPONS.map((c) => ({ code: c.code, reward: c.rewardLabel, issuedAt: c.issuedAt, usedAt: c.redeemedAt })),
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (offline) return;
    let alive = true;
    fetchOwnerCoupons(cafeId)
      .then((d) => {
        if (!alive) return;
        setPending(d.pending ?? []);
        setDone(d.completed ?? []);
      })
      .catch(() => {
        // 실패하면 화면에 남아있던 값(mock 초기값 또는 이전 조회값)을 그대로 유지
      });
    return () => {
      alive = false;
    };
  }, [cafeId, offline, reloadKey]);

  async function redeem(coupon: OwnerCouponEntry) {
    if (offline) {
      setPending((prev) => prev.filter((c) => c.code !== coupon.code));
      setDone((prev) => [{ ...coupon, usedAt: new Date().toISOString() }, ...prev]);
      return;
    }
    const pin = window.prompt(`"${coupon.code}" 쿠폰을 사용 처리합니다.\n매장 PIN을 입력해주세요.`, '1234');
    if (pin === null) return;
    try {
      await useCoupon(coupon.code, pin);
      setReloadKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리에 실패했어요.');
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="스탬프 관리" onBack={onBack} />
      <div style={{ padding: 20 }}>
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: BRAND.chipBg,
            fontSize: 12,
            color: BRAND.primaryDark,
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          손님이 쿠폰 화면을 보여주면 번호를 확인한 뒤 사용 처리를 눌러주세요. 처리하면 손님 화면에서 쿠폰이 사라집니다.
        </div>

        <SectionTitle>사용 대기 {pending.length}건</SectionTitle>
        {pending.length === 0 && <div style={{ fontSize: 13, color: BRAND.textSub, marginBottom: 20 }}>대기 중인 쿠폰이 없어요.</div>}
        {pending.map((c) => (
          <div key={c.code} style={{ padding: 14, borderRadius: 12, background: '#fff', border: `1px solid ${BRAND.border}`, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#26201A' }}>{c.reward}</div>
                <div style={{ fontSize: 12, color: BRAND.textSub }}>{formatUpdatedAt(c.issuedAt)} 발급</div>
              </div>
              <span style={{ fontWeight: 800, fontSize: 14, color: BRAND.primary }}>{c.code}</span>
            </div>
            <PrimaryButton onClick={() => redeem(c)}>사용 처리</PrimaryButton>
          </div>
        ))}

        <div style={{ marginTop: 12 }}>
          <SectionTitle>최근 처리 완료</SectionTitle>
          {done.map((c) => (
            <div key={c.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${BRAND.border}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#26201A' }}>{c.code}</div>
                <div style={{ fontSize: 12, color: BRAND.textSub }}>{c.reward}</div>
              </div>
              {c.usedAt && <span style={{ fontSize: 12, color: BRAND.textSub }}>{formatUpdatedAt(c.usedAt)}</span>}
            </div>
          ))}
        </div>
      </div>
    </ScreenContainer>
  );
}
