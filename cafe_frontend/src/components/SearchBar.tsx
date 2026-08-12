import { useEffect, useState } from 'react';

const STORAGE_KEY = 'zari:recentSearches';
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 프라이빗 브라우징 등으로 저장 실패해도 검색 자체는 계속 동작해야 함
  }
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

/** WF01 상단 검색 입력 + WF03 "최근 검색어" 칩을 겸함. */
export default function SearchBar({ value, onChange }: SearchBarProps) {
  const [recent, setRecent] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  function commit(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recent.filter((r) => r !== trimmed)].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecent(next);
  }

  return (
    <div style={{ position: 'relative', padding: '10px 12px', background: '#fff' }}>
      <input
        type="text"
        value={value}
        placeholder="카페 이름·지역 검색"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(value);
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid #ddd',
          fontSize: 14,
        }}
      />

      {focused && recent.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {recent.map((r) => (
            <button
              key={r}
              onClick={() => {
                onChange(r);
                commit(r);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid #eee',
                background: '#F5F5F5',
                fontSize: 12,
                color: '#555',
                cursor: 'pointer',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
