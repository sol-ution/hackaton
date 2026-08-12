import { FILTER_CATEGORIES } from '../constants/crowd';
import type { CafeTag } from '../types/cafe';

interface FilterBarProps {
  selected: CafeTag | null;
  onChange: (tag: CafeTag | null) => void;
}

/** WF02 상단 카테고리 칩. 전체/공부/대화/조용/콘센트 중 하나만 선택 가능. */
export default function FilterBar({ selected, onChange }: FilterBarProps) {
  return (
    <div
      role="tablist"
      aria-label="카페 카테고리 필터"
      style={{
        display: 'flex',
        gap: 8,
        padding: '10px 12px',
        overflowX: 'auto',
        background: '#fff',
        borderBottom: '1px solid #eee',
      }}
    >
      {FILTER_CATEGORIES.map(({ key, label }) => {
        const isActive = selected === key;
        return (
          <button
            key={label}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: 999,
              border: isActive ? '1px solid #111' : '1px solid #ddd',
              background: isActive ? '#111' : '#fff',
              color: isActive ? '#fff' : '#333',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
