import { useState } from 'react';
import type { CSSProperties } from 'react';
import StarRating from './StarRating';
import {
  CROWD_META,
  CROWD_LEVEL_OPTIONS,
  OUTLET_OPTIONS,
  SMOKING_OPTIONS,
  VISIT_COUNT_OPTIONS,
} from '../constants/crowd';
import { getCurrentPosition } from '../utils/geolocation';
import type {
  Cafe,
  CrowdLevel,
  CrowdReportRequest,
  CrowdReportResponse,
  OutletLevel,
  SmokingRoomType,
  VisitCount,
} from '../types/cafe';

interface CrowdReportFormProps {
  cafe: Cafe;
  onSubmit: (report: CrowdReportRequest) => Promise<CrowdReportResponse | void> | void;
  onCancel: () => void;
}

const NOTE_MAX = 100;

function optionButtonStyle(active: boolean): CSSProperties {
  return {
    padding: '10px 8px',
    borderRadius: 8,
    border: active ? '2px solid #111' : '1px solid #ddd',
    background: active ? '#111' : '#fff',
    color: active ? '#fff' : '#333',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 700, margin: '16px 0 8px' }}>{children}</div>;
}

/** WF06 혼잡도 제보 폼. 제출 시 GPS 좌표를 붙여 CrowdReportRequest를 완성한다. */
export default function CrowdReportForm({ cafe, onSubmit, onCancel }: CrowdReportFormProps) {
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel | null>(null);
  const [quietScore, setQuietScore] = useState(0);
  const [restroomScore, setRestroomScore] = useState(0);
  const [outletLevel, setOutletLevel] = useState<OutletLevel | null>(null);
  const [smokingRoom, setSmokingRoom] = useState<SmokingRoomType | null>(null);
  const [visitCount, setVisitCount] = useState<VisitCount | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    crowdLevel !== null &&
    quietScore > 0 &&
    restroomScore > 0 &&
    outletLevel !== null &&
    smokingRoom !== null &&
    visitCount !== null;

  async function handleSubmit() {
    if (!isValid || crowdLevel === null || !outletLevel || !smokingRoom || !visitCount) return;
    setSubmitting(true);
    setError(null);
    try {
      let userLat = cafe.lat;
      let userLng = cafe.lng;
      try {
        const pos = await getCurrentPosition();
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
      } catch {
        // 위치 권한 거부 시 카페 좌표로 대체 — 데모 환경 배려. 실서비스에선 백엔드가 거리 400 처리.
      }

      await onSubmit({
        cafeId: cafe.id,
        crowdLevel,
        quietScore,
        restroomScore,
        outletLevel,
        smokingRoom,
        visitCount,
        note,
        userLat,
        userLng,
      });
    } catch (err) {
      // 서버가 준 메시지를 그대로 노출 (예: "카페 반경 150m 밖입니다 (현재 4210.3m)")
      setError(
        err instanceof Error && err.message
          ? err.message
          : '제보 전송에 실패했어요. 다시 시도해주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        onClick={onCancel}
        style={{ border: 'none', background: 'transparent', color: '#666', cursor: 'pointer', fontSize: 13, padding: 0 }}
      >
        ← 취소
      </button>

      <FieldLabel>현재 카페는 어떤가요?</FieldLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {CROWD_LEVEL_OPTIONS.map((level) => (
          <button
            key={level}
            type="button"
            style={optionButtonStyle(crowdLevel === level)}
            onClick={() => setCrowdLevel(level)}
          >
            {CROWD_META[level].label}
          </button>
        ))}
      </div>

      <FieldLabel>조용한 정도는?</FieldLabel>
      <StarRating label="조용한 정도" value={quietScore} onChange={setQuietScore} />

      <FieldLabel>화장실은 깨끗한가요?</FieldLabel>
      <StarRating label="화장실 청결도" value={restroomScore} onChange={setRestroomScore} />

      <FieldLabel>콘센트는 어떤가요?</FieldLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {OUTLET_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            style={optionButtonStyle(outletLevel === o.key)}
            onClick={() => setOutletLevel(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <FieldLabel>흡연실은?</FieldLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {SMOKING_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            style={optionButtonStyle(smokingRoom === o.key)}
            onClick={() => setSmokingRoom(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <FieldLabel>방문 인원</FieldLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {VISIT_COUNT_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            style={{ ...optionButtonStyle(visitCount === o.key), fontSize: 12 }}
            onClick={() => setVisitCount(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <FieldLabel>한줄 후기 (선택)</FieldLabel>
      <textarea
        value={note}
        maxLength={NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        placeholder="다른 이용자에게 도움이 되는 후기를 남겨주세요"
        rows={3}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 10,
          borderRadius: 8,
          border: '1px solid #ddd',
          fontFamily: 'inherit',
          fontSize: 13,
          resize: 'vertical',
        }}
      />
      <div style={{ textAlign: 'right', fontSize: 11, color: '#999', marginTop: 2 }}>
        {note.length}/{NOTE_MAX}
      </div>

      {error && <p style={{ color: '#A31C2E', fontSize: 13, marginTop: 8 }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        style={{
          width: '100%',
          marginTop: 16,
          padding: '12px 0',
          borderRadius: 8,
          border: 'none',
          background: !isValid || submitting ? '#ccc' : '#111',
          color: '#fff',
          fontWeight: 700,
          cursor: !isValid || submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? '제출 중...' : '제출하기'}
      </button>
    </div>
  );
}
