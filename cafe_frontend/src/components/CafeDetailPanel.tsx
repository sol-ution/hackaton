import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  getCafeVisual,
  CROWD_META,
  TAG_LABELS,
  OUTLET_LABELS,
  VISIT_COUNT_LABELS,
  formatUpdatedAt,
} from '../constants/crowd';
import { findAlternatives, distanceInMeters, walkingMinutes } from '../utils/geo';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  fetchCafeHistory,
  fetchCafeReports,
  fetchForecast,
  postCafeDirections,
  postCafeView,
  postReportReply,
} from '../api/client';
import CrowdReportForm from './CrowdReportForm';
import OccupancyChart from './OccupancyChart';
import type {
  Cafe,
  CafeReportsResponse,
  CrowdReportRequest,
  CrowdReportResponse,
  DayKey,
  ForecastResponse,
  HistoryPoint,
} from '../types/cafe';

interface CafeDetailPanelProps {
  cafe: Cafe;
  allCafes: Cafe[];
  onClose: () => void;
  onSelectAlternative: (cafe: Cafe) => void;
  isLoggedIn: boolean;
  onRequestLogin: () => void;
  onSubmitReport: (report: CrowdReportRequest) => Promise<CrowdReportResponse | void> | void;
  onToggleFavorite: (cafe: Cafe) => void;
  /** 거리·도보시간 계산 기준점 (유저 위치 또는 지도 중심) */
  origin: { lat: number; lng: number };
  /** 백엔드 미연결 상태면 서버 호출을 건너뛴다. */
  offline: boolean;
}

type TabKey = 'info' | 'crowd' | 'report';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'info', label: '정보' },
  { key: 'crowd', label: '혼잡도' },
  { key: 'report', label: '제보' },
];

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
];

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const isFull = (cafe: Cafe) => cafe.crowdLevel === 3;

function badgeStyle(text: string, bg: string): CSSProperties {
  return {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    color: text,
    background: bg,
  };
}

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (score === null) {
    return <span style={badgeStyle('#4A4F56', '#F1F2F4')}>{label} 정보 없음</span>;
  }
  const color = score >= 4 ? '#0F5C33' : score >= 3 ? '#6B5200' : '#6E1220';
  const bg = score >= 4 ? '#E6F4EC' : score >= 3 ? '#FBF3D6' : '#FBE7EA';
  return (
    <span style={badgeStyle(color, bg)}>
      {label} {score}/5
    </span>
  );
}

function SeatStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: 'center',
        padding: '10px 0',
        borderRadius: 8,
        background: highlight ? '#E6F4EC' : '#F1F2F4',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? '#0F5C33' : '#333' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  );
}

/** WF04 상단 "지금 / 도착 시점" 2칸 비교. 자리요만의 차별 기능. */
function NowVsArrival({
  cafe,
  minutes,
  forecast,
}: {
  cafe: Cafe;
  minutes: number;
  forecast: ForecastResponse | null;
}) {
  const now = getCafeVisual(cafe);
  const arrival = forecast ? CROWD_META[forecast.crowdLevel] : null;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: now.bg }}>
        <div style={{ fontSize: 11, color: now.text, opacity: 0.75 }}>지금</div>
        <div style={{ fontWeight: 700, color: now.text, fontSize: 15 }}>
          {now.icon} {now.label}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          padding: '10px 12px',
          borderRadius: 10,
          background: arrival ? arrival.bg : '#F1F2F4',
          border: '1px dashed rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ fontSize: 11, color: arrival ? arrival.text : '#666', opacity: 0.75 }}>
          도착 시점 ({minutes}분 후)
        </div>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: arrival ? arrival.text : '#888',
          }}
        >
          {arrival ? `${arrival.icon} ${arrival.label} · 예측` : '불러오는 중…'}
        </div>
      </div>
    </div>
  );
}

function InfoTab({
  cafe,
  allCafes,
  origin,
  onSelectAlternative,
}: {
  cafe: Cafe;
  allCafes: Cafe[];
  origin: { lat: number; lng: number };
  onSelectAlternative: (cafe: Cafe) => void;
}) {
  const alternatives = isFull(cafe) ? findAlternatives(cafe, allCafes, 3) : [];
  const hasSeatBreakdown =
    cafe.seatsSolo !== null || cafe.seatsPair !== null || cafe.seatsGroup !== null;

  return (
    <>
      {cafe.isRegistered && cafe.totalSeats !== null ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <SeatStat label="총 좌석" value={cafe.totalSeats} />
          <SeatStat label="빈 좌석" value={cafe.emptySeats ?? 0} highlight />
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
          {cafe.reportCount24h > 0
            ? `최근 24시간 제보 ${cafe.reportCount24h}건 기반 추정`
            : '등록되지 않은 매장 — AI 예측 정보입니다'}
        </p>
      )}

      {hasSeatBreakdown && (
        <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
          <span style={{ fontWeight: 700 }}>좌석 </span>
          {[
            cafe.seatsSolo !== null && `1인석 ${cafe.seatsSolo}`,
            cafe.seatsPair !== null && `2인석 ${cafe.seatsPair}`,
            cafe.seatsGroup !== null && `단체석 ${cafe.seatsGroup}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}

      {cafe.structureNote && (
        <div
          style={{
            fontSize: 13,
            color: '#555',
            lineHeight: 1.5,
            padding: '10px 12px',
            background: '#FAFAFA',
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {cafe.structureNote}
        </div>
      )}

      {cafe.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {cafe.tags.map((tag) => (
            <span key={tag} style={badgeStyle('#374151', '#F1F2F4')}>
              #{TAG_LABELS[tag]}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        <ScoreBadge score={cafe.restroomScore} label="화장실 청결도" />
        <ScoreBadge score={cafe.quietScore} label="조용함" />
        <span style={badgeStyle('#374151', '#F1F2F4')}>
          {cafe.outletLevel ? OUTLET_LABELS[cafe.outletLevel] : '콘센트 정보 없음'}
        </span>
        <span style={badgeStyle('#374151', '#F1F2F4')}>
          흡연실 {cafe.hasSmokingRoom ? '있음' : '없음'}
        </span>
      </div>

      {isFull(cafe) && (
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>근처 대체 카페</h3>
          {alternatives.length === 0 ? (
            <p style={{ fontSize: 13, color: '#888' }}>주변에 여유 있는 카페가 없어요.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {alternatives.map((alt) => {
                const altVisual = getCafeVisual(alt);
                const dist = Math.round(distanceInMeters(origin, alt));
                return (
                  <li key={alt.id} style={{ marginBottom: 8 }}>
                    <button
                      onClick={() => onSelectAlternative(alt)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #eee',
                        background: '#fafafa',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>
                        {alt.name}
                        <span style={{ color: '#999', fontSize: 12 }}> · 도보 {walkingMinutes(dist)}분</span>
                      </span>
                      <span style={{ color: altVisual.color, fontWeight: 700 }}>
                        {altVisual.icon} {altVisual.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function CrowdTab({ cafe, offline }: { cafe: Cafe; offline: boolean }) {
  const visual = getCafeVisual(cafe);
  const todayKey = DAY_KEYS[new Date().getDay()];
  const [day, setDay] = useState<DayKey>(todayKey);
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);

  useEffect(() => {
    if (offline) {
      setPoints([]);
      return;
    }
    let alive = true;
    setPoints(null);
    fetchCafeHistory(cafe.id, day)
      .then((d) => alive && setPoints(d))
      .catch(() => alive && setPoints([]));
    return () => {
      alive = false;
    };
  }, [cafe.id, day, offline]);

  return (
    <>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
        {visual.badge} · {formatUpdatedAt(cafe.updatedAt)}
        {cafe.confidence === 'low' && cafe.crowdSource !== 'owner' && ' · 신뢰도 낮음'}
      </div>

      {cafe.occupancyPercent !== null && (
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: visual.text }}>
            {cafe.occupancyPercent}%
          </span>
          <span style={{ fontSize: 14, color: '#888', marginLeft: 6 }}>{visual.label}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {DAYS.map((d) => (
          <button
            key={d.key}
            onClick={() => setDay(d.key)}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: 6,
              border: day === d.key ? '1px solid #111' : '1px solid #eee',
              background: day === d.key ? '#111' : '#fff',
              color: day === d.key ? '#fff' : '#666',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#555' }}>
        시간대별 좌석 점유율 (%)
      </div>

      {points === null ? (
        <p style={{ fontSize: 13, color: '#888' }}>불러오는 중…</p>
      ) : points.length === 0 ? (
        <p style={{ fontSize: 13, color: '#888' }}>
          {offline ? '서버에 연결되면 시간대 그래프를 볼 수 있어요.' : '시간대 데이터가 없어요.'}
        </p>
      ) : (
        <OccupancyChart points={points} nowHour={day === todayKey ? new Date().getHours() : undefined} />
      )}
    </>
  );
}

function LoginPrompt({ onRequestLogin }: { onRequestLogin: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 8px' }}>
      <p style={{ fontSize: 14, color: '#555', marginBottom: 16 }}>
        혼잡도를 제보하려면 로그인이 필요해요.
        <br />
        지도와 좌석 정보는 로그인 없이도 계속 볼 수 있어요.
      </p>
      <button
        onClick={onRequestLogin}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          background: '#111',
          color: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        로그인하고 제보하기
      </button>
    </div>
  );
}

/** 제보 신뢰도 투표(동의/아니요). 답글은 목록에 즉시 반영되도록 부모에게 새로고침을 요청한다. */
function ReplyBar({
  cafeId,
  reportIndex,
  replies,
  offline,
  onReplied,
}: {
  cafeId: number;
  reportIndex: number;
  replies: { agree: boolean; content: string }[] | null | undefined;
  offline: boolean;
  onReplied: () => void;
}) {
  // 백엔드가 아직 이 필드를 안 내려주는 응답이 섞여 있어도 화면이 죽지 않도록 방어.
  const safeReplies = replies ?? [];
  const [myVote, setMyVote] = useState<'agree' | 'disagree' | null>(null);

  const agreeCount = safeReplies.filter((r) => r.agree).length + (myVote === 'agree' ? 1 : 0);
  const disagreeCount = safeReplies.length - safeReplies.filter((r) => r.agree).length + (myVote === 'disagree' ? 1 : 0);

  /**
   * 클릭하면 눌렀다는 게 바로 보이도록 화면부터 확정하고, 서버 반영은 뒤에서 시도한다.
   * onReplied()로 다시 불러왔을 때 서버가 이 필드를 아직 안 채워줘도(또는 실패해도)
   * myVote가 로컬에 남아있어서 "눌렀는데 안 눌린 것처럼 보이는" 문제가 없다.
   */
  function vote(agree: boolean) {
    if (offline || myVote !== null) return;
    setMyVote(agree ? 'agree' : 'disagree');
    postReportReply(cafeId, reportIndex, { agree, content: '' })
      .then(onReplied)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[reply] 서버 반영 실패, 화면 상태는 그대로 유지', err);
      });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <button
        onClick={() => vote(true)}
        disabled={myVote !== null}
        style={{
          border: 'none',
          background: 'none',
          color: myVote === 'agree' ? '#0F5C33' : '#0F5C33',
          fontWeight: myVote === 'agree' ? 800 : 700,
          fontSize: 11,
          cursor: myVote !== null ? 'default' : 'pointer',
          padding: 0,
          opacity: myVote !== null && myVote !== 'agree' ? 0.5 : 1,
        }}
      >
        {myVote === 'agree' ? '✓ ' : '👍 '}저도 확인했어요 {agreeCount > 0 && `(${agreeCount})`}
      </button>
      <button
        onClick={() => vote(false)}
        disabled={myVote !== null}
        style={{
          border: 'none',
          background: 'none',
          color: '#888',
          fontWeight: myVote === 'disagree' ? 800 : 700,
          fontSize: 11,
          cursor: myVote !== null ? 'default' : 'pointer',
          padding: 0,
          opacity: myVote !== null && myVote !== 'disagree' ? 0.5 : 1,
        }}
      >
        {myVote === 'disagree' ? '✓ ' : ''}아니에요 {disagreeCount > 0 && `(${disagreeCount})`}
      </button>
    </div>
  );
}

/** WF05 제보 내역 + 상단 통계. */
function ReportHistory({
  data,
  cafeId,
  offline,
  onReplied,
}: {
  data: CafeReportsResponse | null;
  cafeId: number;
  offline: boolean;
  onReplied: () => void;
}) {
  if (data === null) return <p style={{ fontSize: 13, color: '#888' }}>불러오는 중…</p>;
  if (data.reports.length === 0) {
    return <p style={{ fontSize: 13, color: '#888' }}>아직 제보가 없어요. 첫 제보를 남겨보세요.</p>;
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: '#F5F7FA' }}>
          <div style={{ fontSize: 11, color: '#888' }}>오늘 제보</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{data.todayCount}건</div>
        </div>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: '#F5F7FA' }}>
          <div style={{ fontSize: 11, color: '#888' }}>마지막 제보</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {data.lastReportedAt ? formatUpdatedAt(data.lastReportedAt) : '없음'}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>
        제보가 모이면 이 매장의 예측 정확도가 올라갑니다
      </p>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {data.reports.map((r, i) => {
          const meta = CROWD_META[r.crowdLevel] ?? CROWD_META[0];
          const isMine = r.nickname === '나';
          return (
            <li
              key={i}
              style={{
                padding: '10px 0',
                borderBottom: i < data.reports.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: meta.bg,
                    color: meta.text,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {meta.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: isMine ? 700 : 500 }}>{r.nickname}</span>
                <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>
                  {formatUpdatedAt(r.reportedAt)}
                </span>
              </div>
              {r.note && (
                <p style={{ fontSize: 13, color: '#444', margin: '0 0 4px' }}>{r.note}</p>
              )}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span style={badgeStyle('#666', '#F5F5F5')}>{VISIT_COUNT_LABELS[r.visitCount]}</span>
                <span style={badgeStyle('#666', '#F5F5F5')}>조용함 ★{r.quietScore}</span>
                <span style={badgeStyle('#666', '#F5F5F5')}>{OUTLET_LABELS[r.outletLevel]}</span>
              </div>
              <ReplyBar
                cafeId={cafeId}
                reportIndex={r.reportIndex ?? i}
                replies={r.replies}
                offline={offline}
                onReplied={onReplied}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** 제보 직후 스탬프 적립 결과 배너. 몇 초 후 자동으로 사라진다. */
function StampBanner({ stamp }: { stamp: NonNullable<CrowdReportResponse['stamp']> }) {
  const text = stamp.couponIssued
    ? `🎉 스탬프를 다 모아서 쿠폰이 발급됐어요! (${stamp.couponIssued.reward})`
    : stamp.earned
      ? `⭐ 스탬프 적립! ${stamp.count}/${stamp.goal}`
      : `스탬프가 적립되지 않았어요 — ${stamp.reason}`;
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 13,
        fontWeight: 600,
        background: stamp.earned ? '#E6F4EC' : '#F1F2F4',
        color: stamp.earned ? '#0F5C33' : '#666',
      }}
    >
      {text}
    </div>
  );
}

function ReportTab({
  cafe,
  isLoggedIn,
  offline,
  onRequestLogin,
  onSubmitReport,
}: {
  cafe: Cafe;
  isLoggedIn: boolean;
  offline: boolean;
  onRequestLogin: () => void;
  onSubmitReport: (report: CrowdReportRequest) => Promise<CrowdReportResponse | void> | void;
}) {
  const [mode, setMode] = useState<'idle' | 'form'>('idle');
  const [data, setData] = useState<CafeReportsResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [stamp, setStamp] = useState<CrowdReportResponse['stamp'] | null>(null);

  useEffect(() => {
    if (offline) {
      setData({ cafeId: cafe.id, todayCount: 0, lastReportedAt: null, totalCount: 0, reports: [] });
      return;
    }
    let alive = true;
    setData(null);
    fetchCafeReports(cafe.id)
      .then((d) => alive && setData(d))
      .catch(
        () =>
          alive &&
          setData({ cafeId: cafe.id, todayCount: 0, lastReportedAt: null, totalCount: 0, reports: [] }),
      );
    return () => {
      alive = false;
    };
  }, [cafe.id, offline, reloadKey]);

  if (mode === 'form') {
    if (!isLoggedIn) return <LoginPrompt onRequestLogin={onRequestLogin} />;
    return (
      <CrowdReportForm
        cafe={cafe}
        onCancel={() => setMode('idle')}
        onSubmit={async (report) => {
          const res = await onSubmitReport(report);
          setStamp(res && res.stamp ? res.stamp : null);
          setMode('idle');
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <>
      {stamp && <StampBanner stamp={stamp} />}
      <button
        onClick={() => (isLoggedIn ? setMode('form') : onRequestLogin())}
        style={{
          width: '100%',
          padding: '12px 0',
          marginBottom: 16,
          borderRadius: 8,
          border: '1px solid #ddd',
          background: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        + 혼잡도 제보하기
      </button>
      <ReportHistory
        data={data}
        cafeId={cafe.id}
        offline={offline}
        onReplied={() => setReloadKey((k) => k + 1)}
      />
    </>
  );
}

export default function CafeDetailPanel({
  cafe,
  allCafes,
  onClose,
  onSelectAlternative,
  isLoggedIn,
  onRequestLogin,
  onSubmitReport,
  onToggleFavorite,
  origin,
  offline,
}: CafeDetailPanelProps) {
  const [tab, setTab] = useState<TabKey>('info');
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const isMobile = useIsMobile();

  const distance = Math.round(distanceInMeters(origin, cafe));
  const minutes = walkingMinutes(distance);

  useEffect(() => {
    if (offline) {
      setForecast(null);
      return;
    }
    let alive = true;
    setForecast(null);
    fetchForecast(cafe.id, minutes)
      .then((f) => alive && setForecast(f))
      .catch(() => alive && setForecast(null));
    return () => {
      alive = false;
    };
  }, [cafe.id, minutes, offline]);

  // 상세 진입할 때마다 조회수 카운트 (하윤 안내: 프론트가 명시적으로 호출해야 함)
  useEffect(() => {
    if (offline) return;
    postCafeView(cafe.id).catch(() => {
      // 조회수 집계는 부가 기능이라 실패해도 화면엔 영향 없음
    });
  }, [cafe.id, offline]);

  function handleDirections() {
    if (!offline) postCafeDirections(cafe.id).catch(() => {});
    window.open(`https://map.naver.com/p/search/${encodeURIComponent(cafe.name)}`, '_blank', 'noopener');
  }

  return (
    <div
      style={
        isMobile
          ? {
              // 모바일: 전체화면 오버레이 (좁은 화면에 사이드 패널은 내용이 뭉개짐)
              position: 'fixed',
              inset: 0,
              zIndex: 900,
              background: '#fff',
              padding: 20,
              paddingBottom: 40,
              overflowY: 'auto',
              boxSizing: 'border-box',
            }
          : {
              position: 'absolute',
              top: 0,
              right: 0,
              width: 340,
              maxWidth: '90vw',
              height: '100%',
              background: '#fff',
              boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
              padding: 20,
              overflowY: 'auto',
              boxSizing: 'border-box',
            }
      }
    >
      <button
        onClick={onClose}
        aria-label="닫기"
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: 22,
          cursor: 'pointer',
          float: 'right',
          // 모바일 터치 타깃 최소 크기 확보
          minWidth: 44,
          minHeight: 44,
          marginTop: -8,
          marginRight: -8,
        }}
      >
        ✕
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{cafe.name}</h2>
        <button
          onClick={() => onToggleFavorite(cafe)}
          aria-label={cafe.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: 20,
            lineHeight: 1,
            cursor: 'pointer',
            color: cafe.isFavorite ? '#E0A315' : '#ccc',
            padding: 0,
          }}
        >
          {cafe.isFavorite ? '★' : '☆'}
        </button>
      </div>
      <p style={{ margin: '0 0 8px', color: '#666', fontSize: 13 }}>
        {cafe.address} · 도보 {minutes}분 ({distance}m)
      </p>

      <button
        onClick={handleDirections}
        style={{
          padding: '6px 12px',
          marginBottom: 12,
          borderRadius: 8,
          border: '1px solid #ddd',
          background: '#fff',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        🧭 길찾기
      </button>

      <NowVsArrival cafe={cafe} minutes={minutes} forecast={forecast} />

      <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              background: 'transparent',
              borderBottom: tab === t.key ? '2px solid #111' : '2px solid transparent',
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#111' : '#999',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <InfoTab
          cafe={cafe}
          allCafes={allCafes}
          origin={origin}
          onSelectAlternative={onSelectAlternative}
        />
      )}
      {tab === 'crowd' && <CrowdTab cafe={cafe} offline={offline} />}
      {tab === 'report' && (
        <ReportTab
          cafe={cafe}
          isLoggedIn={isLoggedIn}
          offline={offline}
          onRequestLogin={onRequestLogin}
          onSubmitReport={onSubmitReport}
        />
      )}
    </div>
  );
}
