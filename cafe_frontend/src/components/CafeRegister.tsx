import { useState } from 'react';
import { BRAND } from '../constants/theme';
import { postCafeRegistration } from '../api/client';
import { PrimaryButton, ScreenContainer, ScreenHeader, SectionTitle } from './ScreenChrome';
import type { Cafe } from '../types/cafe';

interface CafeRegisterProps {
  cafes: Cafe[];
  onBack: () => void;
}

/** WF18 새 카페 등록. POST /api/cafe-registrations 로 실제 접수된다(status: "pending", 실제 심사는 아직 미연동). */
export default function CafeRegister({ cafes, onBack }: CafeRegisterProps) {
  const unregistered = cafes.filter((c) => !c.isRegistered);
  const [target, setTarget] = useState<Cafe | null>(unregistered[0] ?? null);
  const [method, setMethod] = useState<'biz' | 'phone'>('biz');
  const [value, setValue] = useState('');
  const [requested, setRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickNext() {
    if (unregistered.length === 0) return;
    const idx = target ? unregistered.findIndex((c) => c.id === target.id) : -1;
    setTarget(unregistered[(idx + 1) % unregistered.length]);
    setRequested(false);
  }

  async function submitRequest() {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      await postCafeRegistration({
        cafeName: target.name,
        address: target.address,
        method: method === 'biz' ? 'business' : 'phone',
        value,
      });
      setRequested(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 접수에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="새 카페 등록" onBack={onBack} />
      <div style={{ padding: 20 }}>
        <h2 style={{ fontSize: 18, margin: '4px 0 16px', lineHeight: 1.4 }}>
          내 매장을 등록하고
          <br />
          실시간 좌석을 알려주세요
        </h2>

        <div style={{ padding: 14, borderRadius: 12, background: BRAND.card, marginBottom: 20 }}>
          {['예측값 대신 실제 좌석이 지도에 표시됩니다', '한산한 시간대에 손님에게 먼저 노출됩니다', '시간대별 방문 통계를 받아볼 수 있습니다'].map((t) => (
            <div key={t} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#3E2F22', padding: '4px 0' }}>
              <span>✓</span>
              <span>{t}</span>
            </div>
          ))}
        </div>

        <SectionTitle>등록할 매장</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, background: '#fff', border: `1px solid ${BRAND.border}`, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 44, height: 44, borderRadius: 8, background: '#e5ddcc', display: 'inline-block' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{target ? target.name : '등록 가능한 매장 없음'}</div>
              {target && <div style={{ fontSize: 12, color: BRAND.textSub }}>{target.address}</div>}
            </div>
          </div>
          <button onClick={pickNext} style={{ border: 'none', background: 'none', color: BRAND.primary, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            변경
          </button>
        </div>

        <SectionTitle>인증 방법</SectionTitle>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {([
            { key: 'biz' as const, label: '사업자등록번호', sub: '즉시 확인' },
            { key: 'phone' as const, label: '매장 전화번호', sub: 'ARS 인증' },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMethod(opt.key)}
              style={{
                flex: 1,
                padding: '12px 8px',
                borderRadius: 10,
                border: method === opt.key ? `2px solid ${BRAND.primary}` : `1px solid ${BRAND.border}`,
                background: '#fff',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: '#26201A' }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: BRAND.textSub, marginTop: 2 }}>{opt.sub}</div>
            </button>
          ))}
        </div>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={method === 'biz' ? '000-00-00000' : '02-000-0000'}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: `1px solid ${BRAND.border}`,
            fontSize: 14,
            marginBottom: 10,
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: 11, color: BRAND.textSub, marginBottom: 24, lineHeight: 1.6 }}>
          사업자등록증상 대표자 정보와 대조합니다. 인증 결과는 영업일 1일 이내 알림으로 안내됩니다.
        </div>

        <PrimaryButton disabled={!target || value.trim() === '' || submitting} onClick={submitRequest}>
          {submitting ? '접수 중…' : '인증 요청하기'}
        </PrimaryButton>
        {error && <p style={{ color: BRAND.danger, fontSize: 13, marginTop: 8 }}>{error}</p>}
        {requested && (
          <div style={{ textAlign: 'center', fontSize: 12, color: BRAND.primary, marginTop: 10 }}>
            인증 요청이 접수됐어요 (실제 심사 연동은 아직 연결 전이라 접수까지만 진행돼요)
          </div>
        )}
      </div>
    </ScreenContainer>
  );
}
