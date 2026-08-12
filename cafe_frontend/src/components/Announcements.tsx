import { useEffect, useState } from 'react';
import { BRAND } from '../constants/theme';
import { fetchNotices } from '../api/client';
import { MOCK_ANNOUNCEMENTS } from '../mocks/activity';
import { ScreenContainer, ScreenHeader } from './ScreenChrome';
import type { Announcement } from '../types/activity';

interface AnnouncementsProps {
  offline: boolean;
  onBack: () => void;
}

/** WF19 공지사항. GET /api/notices 로 실제 목록을 받는다(중요 공지 먼저, 그다음 최신순 — 서버가 이미 정렬해서 줌). */
export default function Announcements({ offline, onBack }: AnnouncementsProps) {
  const [items, setItems] = useState<Announcement[] | null>(null);

  useEffect(() => {
    if (offline) {
      setItems(MOCK_ANNOUNCEMENTS);
      return;
    }
    let alive = true;
    fetchNotices()
      .then(
        (r) =>
          alive &&
          setItems(
            (r.notices ?? []).map((n) => ({
              id: n.noticeId,
              title: n.title,
              date: n.createdAt.slice(0, 10).replace(/-/g, '.'),
              isNew: n.isNew,
              important: n.isImportant,
            })),
          ),
      )
      .catch(() => alive && setItems(MOCK_ANNOUNCEMENTS));
    return () => {
      alive = false;
    };
  }, [offline]);

  return (
    <ScreenContainer>
      <ScreenHeader title="공지사항" onBack={onBack} />
      <div style={{ padding: 20 }}>
        {items === null ? (
          <p style={{ fontSize: 13, color: BRAND.textSub }}>불러오는 중…</p>
        ) : (
          items.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                borderRadius: 12,
                background: BRAND.card,
                marginBottom: 10,
              }}
            >
              {a.isNew && (
                <span style={{ background: '#2563EB', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '3px 8px' }}>NEW</span>
              )}
              {a.important && (
                <span style={{ background: BRAND.danger, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '3px 8px' }}>중요</span>
              )}
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#26201A' }}>{a.title}</span>
              <span style={{ fontSize: 12, color: BRAND.textSub }}>{a.date}</span>
            </div>
          ))
        )}
      </div>
    </ScreenContainer>
  );
}
