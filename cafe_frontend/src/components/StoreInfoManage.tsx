import { useEffect, useState } from 'react';
import { BRAND } from '../constants/theme';
import { fetchOwnerInfo, patchOwnerInfo } from '../api/client';
import { PrimaryButton, ScreenContainer, ScreenHeader, SectionTitle } from './ScreenChrome';
import type { Cafe } from '../types/cafe';
import type { OwnerInfo, OwnerInfoAmenities } from '../types/activity';

interface StoreInfoManageProps {
  cafe: Cafe;
  offline: boolean;
  onBack: () => void;
}

const AMENITY_LABELS: Record<keyof OwnerInfoAmenities, string> = {
  outlet: '콘센트 많음',
  wifi: '와이파이',
  quiet: '조용한 매장',
  noTimeLimit: '시간 제한 없음',
  smokingRoom: '흡연실',
  parking: '주차 가능',
};
const AMENITY_KEYS = Object.keys(AMENITY_LABELS) as (keyof OwnerInfoAmenities)[];

const FALLBACK_INFO: OwnerInfo = {
  weekdayHours: '08:00-22:00',
  weekendHours: '10:00-22:00',
  holiday: '매주 월요일',
  structureNote: '',
  amenities: { outlet: false, wifi: false, quiet: false, noTimeLimit: false, smokingRoom: false, parking: false },
  seats: { total: 0, solo: 0, pair: 0, group: 0 },
};

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40,
        height: 24,
        borderRadius: 999,
        border: 'none',
        background: on ? BRAND.toggleOn : '#E4D7BF',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 19 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
        }}
      />
    </button>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: BRAND.textSub, marginBottom: 4 }}>{label}</div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          border: `1px solid ${BRAND.border}`,
          fontSize: 14,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

/** WF14 매장 정보 관리. GET/PATCH /api/owner/{cafeId}/info 로 실제 저장된다(오프라인이면 저장 버튼만 로컬 반영). */
export default function StoreInfoManage({ cafe, offline, onBack }: StoreInfoManageProps) {
  const [info, setInfo] = useState<OwnerInfo>(FALLBACK_INFO);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (offline) {
      setInfo({ ...FALLBACK_INFO, structureNote: cafe.structureNote ?? '' });
      setLoaded(true);
      return;
    }
    let alive = true;
    fetchOwnerInfo(cafe.id)
      .then(
        (d) =>
          alive &&
          setInfo({
            ...FALLBACK_INFO,
            ...d,
            amenities: { ...FALLBACK_INFO.amenities, ...d.amenities },
            seats: { ...FALLBACK_INFO.seats, ...d.seats },
          }),
      )
      .catch(() => alive && setInfo({ ...FALLBACK_INFO, structureNote: cafe.structureNote ?? '' }))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [cafe.id, offline, cafe.structureNote]);

  function toggleAmenity(key: keyof OwnerInfoAmenities) {
    setInfo((prev) => ({ ...prev, amenities: { ...prev.amenities, [key]: !prev.amenities[key] } }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (!offline) await patchOwnerInfo(cafe.id, info);
      setSaved(true);
    } catch {
      alert('저장에 실패했어요. 네트워크 상태를 확인해주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="매장 정보" onBack={onBack} />
      <div style={{ padding: 20 }}>
        <SectionTitle>매장 사진</SectionTitle>
        <div style={{ fontSize: 12, color: BRAND.textSub, marginTop: -4, marginBottom: 10 }}>
          첫 번째 사진이 지도와 리스트에 노출됩니다
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 76, height: 76, borderRadius: 10, background: '#E5DDCC' }} />
          ))}
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 10,
              border: `1px dashed ${BRAND.border}`,
              display: 'grid',
              placeItems: 'center',
              fontSize: 20,
              color: BRAND.textSub,
            }}
          >
            +
          </div>
        </div>

        <SectionTitle>영업시간</SectionTitle>
        {(
          [
            ['weekdayHours', '평일'],
            ['weekendHours', '주말'],
            ['holiday', '정기휴무'],
          ] as const
        ).map(([key, label], i, arr) => (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < arr.length - 1 ? `1px solid ${BRAND.border}` : 'none',
              fontSize: 14,
            }}
          >
            <span style={{ color: '#444' }}>{label}</span>
            <input
              value={info[key]}
              onChange={(e) => {
                setInfo((prev) => ({ ...prev, [key]: e.target.value }));
                setSaved(false);
              }}
              style={{ textAlign: 'right', border: 'none', background: 'transparent', fontWeight: 600, fontSize: 14, width: 160 }}
            />
          </div>
        ))}

        <div style={{ marginTop: 20, marginBottom: 20 }}>
          <SectionTitle>좌석 구성</SectionTitle>
          <div style={{ display: 'flex', gap: 8 }}>
            <NumberField label="총 좌석" value={info.seats.total} onChange={(n) => { setInfo((p) => ({ ...p, seats: { ...p.seats, total: n } })); setSaved(false); }} />
            <NumberField label="1인석" value={info.seats.solo} onChange={(n) => { setInfo((p) => ({ ...p, seats: { ...p.seats, solo: n } })); setSaved(false); }} />
            <NumberField label="2인석" value={info.seats.pair} onChange={(n) => { setInfo((p) => ({ ...p, seats: { ...p.seats, pair: n } })); setSaved(false); }} />
            <NumberField label="단체석" value={info.seats.group} onChange={(n) => { setInfo((p) => ({ ...p, seats: { ...p.seats, group: n } })); setSaved(false); }} />
          </div>
        </div>

        <SectionTitle>편의시설</SectionTitle>
        <div style={{ fontSize: 12, color: BRAND.textSub, marginTop: -4, marginBottom: 8 }}>
          손님의 카테고리 필터에 사용됩니다
        </div>
        {AMENITY_KEYS.map((key) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
            <span style={{ fontSize: 14, color: '#26201A' }}>{AMENITY_LABELS[key]}</span>
            <Toggle on={info.amenities[key]} onClick={() => toggleAmenity(key)} />
          </div>
        ))}

        <div style={{ marginTop: 16, marginBottom: 24 }}>
          <SectionTitle>매장 구조 메모</SectionTitle>
          <div style={{ fontSize: 12, color: BRAND.textSub, marginTop: -4, marginBottom: 8 }}>손님에게 그대로 보입니다</div>
          <textarea
            value={info.structureNote}
            onChange={(e) => {
              setInfo((prev) => ({ ...prev, structureNote: e.target.value }));
              setSaved(false);
            }}
            rows={4}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: `1px solid ${BRAND.border}`,
              fontSize: 13,
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>

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
