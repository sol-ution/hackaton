import { BRAND } from '../constants/theme';
import { MOCK_ANNOUNCEMENTS } from '../mocks/activity';
import { ListLinkRow, ScreenContainer, ScreenHeader } from './ScreenChrome';

interface SettingsPageProps {
  onBack: () => void;
  onOpenAnnouncements: () => void;
  onOpenCafeRegister: () => void;
  onOpenContactAdmin: () => void;
}

/** WF17 설정. 로그아웃/업데이트/약관 등 실제 동작이 없는 항목은 alert로 대체(데모 스코프 밖). */
export default function SettingsPage({ onBack, onOpenAnnouncements, onOpenCafeRegister, onOpenContactAdmin }: SettingsPageProps) {
  return (
    <ScreenContainer>
      <ScreenHeader title="설정" onBack={onBack} />
      <div style={{ padding: '20px 20px 8px', fontSize: 12, color: BRAND.textSub }}>앱 정보</div>
      <div style={{ margin: '0 20px 12px', padding: 14, borderRadius: 12, background: BRAND.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#26201A' }}>자리요</div>
            <div style={{ fontSize: 12, color: BRAND.textSub }}>현재 1.2.0 · 최신 1.3.0</div>
          </div>
        </div>
        <button
          onClick={() => alert('데모에서는 실제 업데이트로 연결되지 않아요.')}
          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: BRAND.primary, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          업데이트
        </button>
      </div>

      <div style={{ padding: '8px 20px', fontSize: 12, color: BRAND.textSub }}>계정</div>
      <ListLinkRow label="카카오 계정으로 로그인됨" sub="자리요러 · jariyo@kakao.com" onClick={() => alert('데모 스코프 밖 기능이에요.')} />
      <ListLinkRow label="로그아웃" onClick={() => alert('데모 스코프 밖 기능이에요.')} />

      <div style={{ padding: '16px 20px 8px', fontSize: 12, color: BRAND.textSub }}>제보 · 등록</div>
      <ListLinkRow label="운영자에게 제보" sub="잘못된 정보나 오류를 신고합니다" onClick={onOpenContactAdmin} />
      <ListLinkRow label="새 카페 등록" sub="지도에 없는 카페를 알려주세요" onClick={onOpenCafeRegister} />

      <div style={{ padding: '16px 20px 8px', fontSize: 12, color: BRAND.textSub }}>안내</div>
      <ListLinkRow label="공지사항" badge={MOCK_ANNOUNCEMENTS.filter((a) => a.isNew).length || undefined} onClick={onOpenAnnouncements} />
      <ListLinkRow label="이용약관" onClick={() => alert('데모 스코프 밖 기능이에요.')} />
      <ListLinkRow label="개인정보처리방침" onClick={() => alert('데모 스코프 밖 기능이에요.')} />
    </ScreenContainer>
  );
}
