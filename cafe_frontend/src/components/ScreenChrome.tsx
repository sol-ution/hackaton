import type { CSSProperties, ReactNode } from 'react';
import { BRAND } from '../constants/theme';

/**
 * WF09~20 전용 공통 뼈대.
 * 이 스크린들은 전부 "모바일 풀스크린 오버레이 + 뒤로가기"라는 같은 패턴이라
 * 화면마다 헤더/리스트행/버튼을 새로 짜지 않고 여기서 공유한다.
 */

export function ScreenContainer({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: BRAND.bg, zIndex: 300, overflowY: 'auto' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100%', background: BRAND.bg, paddingBottom: 40 }}>
        {children}
      </div>
    </div>
  );
}

export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        background: BRAND.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: `1px solid ${BRAND.border}`,
        zIndex: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onBack}
          aria-label="뒤로"
          style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: BRAND.primaryDark, padding: 0 }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#26201A' }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function ListLinkRow({
  label,
  sub,
  onClick,
  badge,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        border: 'none',
        borderBottom: `1px solid ${BRAND.border}`,
        background: 'transparent',
        cursor: 'pointer',
      }}
    >
      <span>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#26201A' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: BRAND.textSub, marginTop: 2 }}>{sub}</div>}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {badge ? (
          <span style={{ background: BRAND.primary, color: '#fff', borderRadius: 999, fontSize: 11, padding: '2px 7px', fontWeight: 700 }}>
            {badge}
          </span>
        ) : null}
        <span style={{ color: '#C4B49B' }}>›</span>
      </span>
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '14px 0',
        borderRadius: 10,
        border: 'none',
        background: disabled ? '#D8CBB8' : BRAND.primary,
        color: '#fff',
        fontWeight: 700,
        fontSize: 15,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#26201A' }}>{value}</div>
      <div style={{ fontSize: 12, color: BRAND.textSub, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function StatCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        padding: '18px 12px',
        borderRadius: 14,
        background: BRAND.card,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: '#26201A', marginBottom: 8 }}>{children}</div>;
}
