import { useEffect, useState } from 'react';
import { CROWD_META } from '../constants/crowd';
import { BRAND } from '../constants/theme';
import { deleteReview, fetchMyReports, fetchMyReviews, patchReview } from '../api/client';
import { MOCK_MY_REPORTS, MOCK_MY_REVIEWS, MY_REPORT_MONTH_STATS } from '../mocks/activity';
import { ScreenContainer, ScreenHeader, StatBlock, StatCard } from './ScreenChrome';
import type { MyReport, Review } from '../types/activity';

interface MyActivityProps {
  initialTab: 'reports' | 'reviews';
  offline: boolean;
  onBack: () => void;
}

function toDateLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** "n분 전" 대신 절대 날짜/시각으로 (내 제보 내역은 과거 기록이라 상대시간보다 날짜가 더 유용). */
function formatReportedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${toDateLabel(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** WF10(제보내역)·WF11(리뷰내역) 통합. reports/reviews 둘 다 실제 API로 연결됨(오프라인이면 mock). */
export default function MyActivity({ initialTab, offline, onBack }: MyActivityProps) {
  const [tab, setTab] = useState<'reports' | 'reviews'>(initialTab);

  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [reportStats, setReportStats] = useState({ total: 0, earned: 0, notEarned: 0 });

  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<Review['id'] | null>(null);
  const [reviewReloadKey, setReviewReloadKey] = useState(0);

  useEffect(() => {
    if (offline) {
      setReports(MOCK_MY_REPORTS);
      setReportStats({
        total: MOCK_MY_REPORTS.length,
        earned: MY_REPORT_MONTH_STATS.stamped,
        notEarned: MY_REPORT_MONTH_STATS.unstamped,
      });
      return;
    }
    let alive = true;
    fetchMyReports()
      .then((r) => {
        if (!alive) return;
        setReports(
          (r.reports ?? []).map((entry, i) => ({
            id: i,
            cafeId: null,
            cafeName: entry.cafeName,
            reportedAt: entry.reportedAt,
            note: entry.reason,
            stamped: entry.earned,
          })),
        );
        setReportStats({ total: r.totalCount ?? 0, earned: r.earnedCount ?? 0, notEarned: r.notEarnedCount ?? 0 });
      })
      .catch(() => {
        if (!alive) return;
        setReports(MOCK_MY_REPORTS);
        setReportStats({
          total: MOCK_MY_REPORTS.length,
          earned: MY_REPORT_MONTH_STATS.stamped,
          notEarned: MY_REPORT_MONTH_STATS.unstamped,
        });
      });
    return () => {
      alive = false;
    };
  }, [offline]);

  useEffect(() => {
    if (offline) {
      setReviews(MOCK_MY_REVIEWS);
      setReviewCount(MOCK_MY_REVIEWS.length);
      return;
    }
    let alive = true;
    fetchMyReviews()
      .then((r) => {
        if (!alive) return;
        setReviews(
          (r.reviews ?? []).map((rv) => ({
            id: rv.reviewId,
            cafeId: rv.cafeId,
            cafeName: rv.cafeName ?? '카페',
            rating: rv.rating,
            date: toDateLabel(rv.updatedAt ?? rv.createdAt),
            content: rv.content,
            tags: rv.tags ?? [],
          })),
        );
        setReviewCount(r.count ?? 0);
      })
      .catch(() => {
        if (!alive) return;
        setReviews(MOCK_MY_REVIEWS);
        setReviewCount(MOCK_MY_REVIEWS.length);
      });
    return () => {
      alive = false;
    };
  }, [offline, reviewReloadKey]);

  async function handleDeleteReview(review: Review) {
    setOpenMenuId(null);
    if (!window.confirm('이 리뷰를 삭제할까요?')) return;
    if (offline || typeof review.id !== 'number') {
      setReviews((prev) => (prev ? prev.filter((r) => r.id !== review.id) : prev));
      return;
    }
    try {
      await deleteReview(review.id);
      setReviewReloadKey((k) => k + 1);
    } catch {
      alert('삭제에 실패했어요. 다시 시도해주세요.');
    }
  }

  async function handleEditReview(review: Review) {
    setOpenMenuId(null);
    const next = window.prompt('리뷰 내용을 수정해주세요', review.content);
    if (next === null || next.trim() === '') return;
    if (offline || typeof review.id !== 'number') {
      setReviews((prev) => (prev ? prev.map((r) => (r.id === review.id ? { ...r, content: next } : r)) : prev));
      return;
    }
    try {
      await patchReview(review.id, { content: next });
      setReviewReloadKey((k) => k + 1);
    } catch {
      alert('수정에 실패했어요. 다시 시도해주세요.');
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="내 활동" onBack={onBack} />
      <div style={{ display: 'flex', borderBottom: `1px solid ${BRAND.border}` }}>
        {(['reports', 'reviews'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${BRAND.primary}` : '2px solid transparent',
              background: 'transparent',
              fontWeight: tab === t ? 800 : 500,
              color: tab === t ? '#26201A' : BRAND.textSub,
              cursor: 'pointer',
            }}
          >
            {t === 'reports' ? `내 제보 ${reportStats.total}` : `내 리뷰 ${reviewCount}`}
          </button>
        ))}
      </div>

      {tab === 'reports' ? (
        <div style={{ padding: 20 }}>
          <StatCard>
            <StatBlock label="전체 제보" value={reportStats.total} />
            <StatBlock label="스탬프 적립" value={reportStats.earned} />
            <StatBlock label="미적립" value={reportStats.notEarned} />
          </StatCard>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: BRAND.textSub, marginBottom: 8 }}>
            <span>전체 {reports?.length ?? 0}건</span>
            <span>최신순 ▾</span>
          </div>

          {reports === null ? (
            <p style={{ fontSize: 13, color: BRAND.textSub }}>불러오는 중…</p>
          ) : reports.length === 0 ? (
            <p style={{ fontSize: 13, color: BRAND.textSub }}>아직 제보한 내역이 없어요.</p>
          ) : (
            reports.map((r) => {
              const meta = r.crowdLevel !== undefined ? CROWD_META[r.crowdLevel] : null;
              return (
                <div key={r.id} style={{ padding: '12px 0', borderBottom: `1px solid ${BRAND.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {meta && (
                        <span style={{ padding: '2px 8px', borderRadius: 999, background: meta.bg, color: meta.text, fontSize: 12, fontWeight: 700 }}>
                          {meta.label}
                        </span>
                      )}
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#26201A' }}>{r.cafeName}</span>
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: r.stamped ? BRAND.primary : BRAND.textSub,
                        border: `1px solid ${r.stamped ? BRAND.primary : BRAND.border}`,
                        borderRadius: 999,
                        padding: '2px 8px',
                      }}
                    >
                      {r.stamped ? '★ 적립' : '미적립'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: BRAND.textSub }}>{formatReportedAt(r.reportedAt)}</div>
                  {r.note && <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>{r.note}</div>}
                </div>
              );
            })
          )}

          <div style={{ fontSize: 11, color: BRAND.textSub, marginTop: 16, lineHeight: 1.6 }}>
            제보는 그 시점의 기록이라 수정할 수 없습니다. 잘못 올렸다면 삭제 후 다시 제보해 주세요.
          </div>
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: BRAND.textSub, marginBottom: 8 }}>
            <span>전체 {reviews?.length ?? 0}건</span>
            <span>최신순 ▾</span>
          </div>
          {reviews === null ? (
            <p style={{ fontSize: 13, color: BRAND.textSub }}>불러오는 중…</p>
          ) : reviews.length === 0 ? (
            <p style={{ fontSize: 13, color: BRAND.textSub }}>아직 작성한 리뷰가 없어요.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} style={{ padding: '14px 0', borderBottom: `1px solid ${BRAND.border}`, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#26201A' }}>{r.cafeName}</div>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                    style={{ border: 'none', background: 'none', fontSize: 12, color: BRAND.textSub, cursor: 'pointer', padding: 0 }}
                  >
                    ⋯
                  </button>
                  {openMenuId === r.id && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 24,
                        background: '#fff',
                        border: `1px solid ${BRAND.border}`,
                        borderRadius: 8,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        zIndex: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => handleEditReview(r)}
                        style={{ display: 'block', width: 90, padding: '8px 12px', border: 'none', background: 'none', fontSize: 13, textAlign: 'left', cursor: 'pointer' }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteReview(r)}
                        style={{ display: 'block', width: 90, padding: '8px 12px', border: 'none', background: 'none', fontSize: 13, textAlign: 'left', cursor: 'pointer', color: BRAND.danger }}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#B8860B', marginBottom: 6 }}>
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)} <span style={{ color: BRAND.textSub }}>{r.date}</span>
                </div>
                <p style={{ fontSize: 13, color: '#444', margin: '0 0 8px' }}>{r.content}</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {r.tags.map((t) => (
                    <span key={t} style={{ padding: '3px 8px', borderRadius: 999, background: BRAND.chipBg, color: BRAND.primaryDark, fontSize: 11, fontWeight: 600 }}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
          <div style={{ fontSize: 11, color: BRAND.textSub, marginTop: 16 }}>⋯ 를 누르면 수정·삭제할 수 있습니다.</div>
        </div>
      )}
    </ScreenContainer>
  );
}
