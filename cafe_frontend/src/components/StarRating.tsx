interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  label: string;
}

/** WF06 "조용한 정도는?", "화장실은 깨끗한가요?"용 5점 별점 입력. */
export default function StarRating({ value, onChange, max = 5, label }: StarRatingProps) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}점`}
          onClick={() => onChange(n)}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 24,
            lineHeight: 1,
            padding: 2,
            color: n <= value ? '#F5A623' : '#DADCE0',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
