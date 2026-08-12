import { useState } from 'react';
import { CROWD_META } from '../constants/crowd';
import type { HistoryPoint } from '../types/cafe';

interface OccupancyChartProps {
  points: HistoryPoint[];
  /** 지금 시각(시). 세로 기준선으로 표시. 없으면 안 그림. */
  nowHour?: number;
  width?: number;
  height?: number;
}

/**
 * WF07 시간대별 좌석 점유율 곡선.
 *
 * 단일 시계열이라 범례 박스는 두지 않고(제목이 계열을 설명함),
 * 배경의 혼잡도 구간(여유/보통/혼잡)만 라벨과 함께 범례로 노출한다.
 * 구간 색은 CROWD_META를 그대로 써서 지도 마커·배지와 같은 의미를 유지.
 */
export default function OccupancyChart({
  points,
  nowHour,
  width = 300,
  height = 160,
}: OccupancyChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // 배열이 아닌 값이 흘러들어와도 화면 전체가 죽지 않도록 방어
  if (!Array.isArray(points) || points.length === 0) {
    return <p style={{ fontSize: 13, color: '#888' }}>시간대 데이터가 없어요.</p>;
  }

  // right 여백은 마지막 x축 라벨("21시")이 잘리지 않을 만큼 확보해야 함
  const pad = { top: 16, right: 18, bottom: 22, left: 30 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const hours = points.map((p) => p.hour);
  const minH = Math.min(...hours);
  const maxH = Math.max(...hours);

  const x = (h: number) => pad.left + ((h - minH) / Math.max(1, maxH - minH)) * plotW;
  const y = (pct: number) => pad.top + (1 - pct / 100) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.hour)},${y(p.occupancyPercent)}`).join(' ');

  // 배경 혼잡도 구간 (여유 0-60 / 보통 60-80 / 혼잡 80-100)
  const bands = [
    { from: 0, to: 60, meta: CROWD_META[0] },
    { from: 60, to: 80, meta: CROWD_META[1] },
    { from: 80, to: 100, meta: CROWD_META[2] },
  ];

  const peak = points.reduce((a, b) => (b.occupancyPercent > a.occupancyPercent ? b : a));
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  /** 마우스 x좌표 → 가장 가까운 데이터 인덱스 */
  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(x(p.hour) - mx);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHoverIdx(best);
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="시간대별 좌석 점유율 그래프"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        style={{ display: 'block', cursor: 'crosshair' }}
      >
        {/* 혼잡도 구간 배경 */}
        {bands.map((b) => (
          <rect
            key={b.meta.label}
            x={pad.left}
            y={y(b.to)}
            width={plotW}
            height={y(b.from) - y(b.to)}
            fill={b.meta.color}
            opacity={0.09}
          />
        ))}

        {/* 눈금 (0/50/100%) — 배경보다 뒤로 물러나게 */}
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(v)}
              y2={y(v)}
              stroke="#D8DADE"
              strokeWidth={1}
            />
            <text x={pad.left - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#9AA0A6">
              {v}
            </text>
          </g>
        ))}

        {/* 지금 시각 기준선 */}
        {nowHour !== undefined && nowHour >= minH && nowHour <= maxH && (
          <line
            x1={x(nowHour)}
            x2={x(nowHour)}
            y1={pad.top}
            y2={pad.top + plotH}
            stroke="#111"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />
        )}

        {/* 본선 */}
        <path d={line} fill="none" stroke="#3C4043" strokeWidth={2} strokeLinejoin="round" />

        {/* 데이터 점 — 흰 링으로 배경과 분리 */}
        {points.map((p) => (
          <circle
            key={p.hour}
            cx={x(p.hour)}
            cy={y(p.occupancyPercent)}
            r={3.5}
            fill="#3C4043"
            stroke="#fff"
            strokeWidth={2}
          />
        ))}

        {/* 최고점만 직접 라벨 (모든 점에 숫자를 붙이지 않음) */}
        <text
          x={x(peak.hour)}
          y={y(peak.occupancyPercent) - 8}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill="#3C4043"
        >
          {peak.occupancyPercent}%
        </text>

        {/* 호버 크로스헤어 */}
        {hovered && (
          <>
            <line
              x1={x(hovered.hour)}
              x2={x(hovered.hour)}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="#3C4043"
              strokeWidth={1}
              opacity={0.35}
            />
            <circle
              cx={x(hovered.hour)}
              cy={y(hovered.occupancyPercent)}
              r={5}
              fill="#3C4043"
              stroke="#fff"
              strokeWidth={2}
            />
          </>
        )}

        {/* x축 라벨 — 3시간 간격만 */}
        {points
          .filter((p) => p.hour % 3 === 0)
          .map((p) => (
            <text
              key={p.hour}
              x={x(p.hour)}
              y={height - 6}
              textAnchor="middle"
              fontSize={9}
              fill="#9AA0A6"
            >
              {p.hour}시
            </text>
          ))}
      </svg>

      {/* 호버 툴팁 */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: `${(x(hovered.hour) / width) * 100}%`,
            top: 0,
            transform: 'translateX(-50%)',
            background: '#3C4043',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 11,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {hovered.hour}시 · {hovered.occupancyPercent}%
        </div>
      )}

      {/* 구간 범례 — 색만으로 구분하지 않도록 라벨 동반 */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        {bands.map((b) => (
          <span
            key={b.meta.label}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#666' }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: b.meta.color,
                opacity: 0.5,
              }}
            />
            {b.meta.label} {b.from}–{b.to}%
          </span>
        ))}
      </div>
    </div>
  );
}
