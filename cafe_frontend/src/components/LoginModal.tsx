import { getKakaoAuthUrl } from '../api/client';

interface LoginModalProps {
  onClose: () => void;
  /** 실제 OAuth 붙기 전까지는 provider만 기록하고 바로 로그인 처리. */
  onLogin: (provider: 'kakao' | 'google' | 'apple') => void;
}

const PROVIDERS: { key: 'kakao' | 'google' | 'apple'; label: string; bg: string; text: string }[] = [
  { key: 'kakao', label: '카카오로 계속하기', bg: '#FEE500', text: '#191600' },
  { key: 'google', label: 'Google로 계속하기', bg: '#fff', text: '#111' },
  { key: 'apple', label: 'Apple로 계속하기', bg: '#000', text: '#fff' },
];

/**
 * WF07 로그인 팝업. OAuth 백엔드 붙기 전까지는 버튼 누르면 바로 "로그인됨" 처리하는 스텁.
 * 나중에 실제 OAuth 붙일 때 onLogin 내부만 리다이렉트로 바꾸면 됨.
 */
export default function LoginModal({ onClose, onLogin }: LoginModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="로그인"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 320,
          maxWidth: '90vw',
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.4 }}>
            혼잡도를 제보하려면
            <br />
            로그인이 필요해요
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#666', margin: '8px 0 20px' }}>
          지도와 좌석 정보는 로그인 없이도 계속 볼 수 있어요.
        </p>

        {PROVIDERS.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              // 카카오는 REST API 키(VITE_KAKAO_CLIENT_ID)가 세팅되면 실제 OAuth로 이동.
              // 아직 키가 없으면(하윤 콘솔 등록 전) 기존 스텁 로그인으로 대신 처리.
              if (p.key === 'kakao') {
                const authUrl = getKakaoAuthUrl();
                if (authUrl) {
                  window.location.href = authUrl;
                  return;
                }
              }
              onLogin(p.key);
            }}
            style={{
              width: '100%',
              padding: '12px 0',
              marginBottom: 8,
              borderRadius: 8,
              border: p.key === 'google' ? '1px solid #ddd' : 'none',
              background: p.bg,
              color: p.text,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 4,
            padding: '10px 0',
            border: 'none',
            background: 'transparent',
            color: '#888',
            cursor: 'pointer',
          }}
        >
          나중에 하기
        </button>
      </div>
    </div>
  );
}
