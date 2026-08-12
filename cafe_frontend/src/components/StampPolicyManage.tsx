import { useEffect, useState } from 'react';
import { BRAND } from '../constants/theme';
import { fetchOwnerCoupons, fetchStampSettings, patchStampSettings } from '../api/client';
import { MOCK_STAMP_MONTH_STATS, MOCK_STAMP_POLICY } from '../mocks/activity';
import { PrimaryButton, ScreenContainer, ScreenHeader, SectionTitle, StatBlock, StatCard } from './ScreenChrome';
import type { StampSettings } from '../types/activity';

interface StampPolicyManageProps {
  cafeId: number;
  cafeName: string;
  offline: boolean;
  onBack: () => void;
}

const FALLBACK_SETTINGS: StampSettings = {
  reward: MOCK_STAMP_POLICY.rewardLabel,
  goal: MOCK_STAMP_POLICY.slots,
  dailyLimit: MOCK_STAMP_POLICY.dailyLimit,
  radiusMeters: MOCK_STAMP_POLICY.radiusM,
  validDays: MOCK_STAMP_POLICY.validDays,
  ownerPin: '1234',
};

function EditableRow({ label, value, onChange, suffix }: { label: string; value: string | number; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${BRAND.border}` }}>
      <span style={{ fontSize: 13, color: '#444' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 120, textAlign: 'right', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: '#26201A' }}
        />
        {suffix && <span style={{ fontSize: 12, color: BRAND.textSub }}>{suffix}</span>}
      </span>
    </div>
  );
}

/** WF15 스탬프 관리 - 발행 정책. GET/PATCH /api/owner/{cafeId}/stamp-settings 로 실제 저장된다. */
export default function StampPolicyManage({ cafeId, cafeName, offline, onBack }: StampPolicyManageProps) {
  const [settings, setSettings] = useState<StampSettings>(FALLBACK_SETTINGS);
  const [monthStats, setMonthStats] = useState(MOCK_STAMP_MONTH_STATS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (offline) {
      setSettings(FALLBACK_SETTINGS);
      setMonthStats(MOCK_STAMP_MONTH_STATS);
      setLoaded(true);
      return;
    }
    let alive = true;
    fetchStampSettings(cafeId)
      .then((d) => alive && setSettings(d))
      .catch(() => alive && setSettings(FALLBACK_SETTINGS));
    fetchOwnerCoupons(cafeId)
      .then(
        (d) =>
          alive &&
          setMonthStats({ earned: d.thisMonth.stampsEarned, issued: d.thisMonth.couponsIssued, used: d.thisMonth.couponsUsed }),
      )
      .catch(() => alive && setMonthStats(MOCK_STAMP_MONTH_STATS))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [cafeId, offline]);

  function update<K extends keyof StampSettings>(key: K, raw: string) {
    setSaved(false);
    if (key === 'reward' || key === 'ownerPin') {
      setSettings((prev) => ({ ...prev, [key]: raw }));
    } else {
      setSettings((prev) => ({ ...prev, [key]: Math.max(0, Number(raw) || 0) }));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (!offline) await patchStampSettings(cafeId, settings);
      setSaved(true);
    } catch {
      alert('저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  const previewFilled = Math.min(settings.goal, Math.round(settings.goal * 0.7));

  return (
    <ScreenContainer>
      <ScreenHeader title="스탬프 관리" onBack={onBack} />
      <div style={{ padding: 20 }}>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: BRAND.card, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#26201A' }}>{settings.reward}</div>
          <div style={{ fontSize: 12, color: BRAND.textSub }}>스탬프 {settings.goal}칸 · {cafeName}</div>
        </div>

        <SectionTitle>발행 조건</SectionTitle>
        <EditableRow label="리워드 내용" value={settings.reward} onChange={(v) => update('reward', v)} />
        <EditableRow label="스탬프 칸 수" value={settings.goal} onChange={(v) => update('goal', v)} suffix="칸" />
        <EditableRow label="하루 적립 상한" value={settings.dailyLimit} onChange={(v) => update('dailyLimit', v)} suffix="개" />
        <EditableRow label="적립 조건 반경" value={settings.radiusMeters} onChange={(v) => update('radiusMeters', v)} suffix="m" />
        <EditableRow label="쿠폰 유효기간" value={settings.validDays} onChange={(v) => update('validDays', v)} suffix="일" />
        <EditableRow label="사용 처리 PIN" value={settings.ownerPin} onChange={(v) => update('ownerPin', v)} />

        <div style={{ marginTop: 20, marginBottom: 12 }}>
          <SectionTitle>손님에게 이렇게 보여요</SectionTitle>
        </div>
        <div style={{ padding: 14, borderRadius: 12, background: '#fff', border: `1px solid ${BRAND.border}`, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{cafeName}</div>
            <div style={{ fontWeight: 800 }}>
              {previewFilled}
              <span style={{ color: BRAND.textSub, fontWeight: 600 }}> / {settings.goal}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Array.from({ length: settings.goal }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: i < previewFilled ? BRAND.primary : 'transparent',
                  border: i < previewFilled ? 'none' : `1px dashed ${BRAND.border}`,
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: BRAND.textSub, marginTop: 8 }}>
            {settings.goal - previewFilled}개 더 모으면 {settings.reward}을 받아요
          </div>
        </div>

        <StatCard>
          <StatBlock label="이번 달 적립" value={monthStats.earned} />
          <StatBlock label="쿠폰 발급" value={monthStats.issued} />
          <StatBlock label="사용 완료" value={monthStats.used} />
        </StatCard>

        <PrimaryButton onClick={handleSave} disabled={!loaded || saving}>
          {saving ? '저장 중…' : '저장하기'}
        </PrimaryButton>
        {saved && (
          <div style={{ textAlign: 'center', fontSize: 12, color: BRAND.primary, marginTop: 10 }}>
            저장되었어요{offline ? ' (오프라인 모드 — 서버엔 반영 안 됨)' : ''}
          </div>
        )}
      </div>
    </ScreenContainer>
  );
}
