import { useEffect, useState } from 'react';
import { BRAND } from '../constants/theme';
import { loginWithKakao } from '../api/client';

type Status = 'processing' | 'error';

/**
 * 이미 교환을 시작한 인가 코드.
 *
 * 카카오 인가 코드는 1회용이라 같은 코드로 두 번 요청하면 두 번째는 무조건 거절당한다.
 * 그런데 개발 모드 StrictMode에서는 useEffect가 "실행 → 정리 → 재실행"으로 두 번 돌기
 * 때문에, 그대로 두면 로그인에 성공하고도 두 번째 요청의 실패 메시지가 화면에 뜬다.
 * 모듈 스코프에 기록해서 코드 하나당 딱 한 번만 보낸다.
 */
let exchangeStartedFor: string | null = null;

/**
 * 카카오 Redirect URI(/auth/kakao/callback) 전용 페이지.
 *
 * 카카오 로그인 팝업이 아니라 브라우저가 이 경로로 "완전히 새로 이동"해서 열리는
 * 페이지라서(App.tsx가 URL 라우터 없이 상태값으로만 화면 전환하는 구조와 별개로),
 * App.tsx 맨 위에서 pathname을 보고 이 컴포넌트만 단독으로 그려준다.
 *
 * 흐름: 카카오 → 여기로 ?code=... 붙여서 리다이렉트
 *      → loginWithKakao(code)로 POST /api/auth/kakao 교환 요청
 *      → 토큰+유저정보 저장 → "/"로 이동
 */
export default function KakaoCallback() {
  const [status, setStatus] = useState<Status>('processing');
  const [message, setMessage] = useState('로그인 처리 중이에요…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setMessage('카카오 로그인이 취소됐어요.');
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('잘못된 접근이에요. 인가 코드가 없어요.');
      return;
    }

    if (exchangeStartedFor === code) return;
    exchangeStartedFor = code;

    loginWithKakao(code)
      .then(() => {
        // 로그인 성공 → 원래 화면으로. 새로고침으로 App.tsx가 처음부터 정상 초기화되게 한다.
        // replace라서 히스토리에 콜백 주소가 안 남는다. (뒤로가기로 돌아와서
        //  이미 써버린 코드로 또 교환을 시도하는 걸 막는다.)
        window.location.replace('/');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : '로그인에 실패했어요.');
      });
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
        background: BRAND.bg ?? '#fff',
      }}
    >
      {status === 'processing' ? (
        <>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3px solid #eee',
              borderTopColor: BRAND.primary,
              animation: 'zari-spin 0.8s linear infinite',
            }}
          />
          <style>{'@keyframes zari-spin { to { transform: rotate(360deg); } }'}</style>
          <p style={{ fontSize: 14, color: '#666' }}>{message}</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#26201A' }}>{message}</p>
          <a href="/" style={{ fontSize: 13, color: BRAND.primary, fontWeight: 700 }}>
            처음 화면으로 돌아가기
          </a>
        </>
      )}
    </div>
  );
}
