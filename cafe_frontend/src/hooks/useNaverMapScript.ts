import { useEffect, useState } from 'react';

/**
 * 네이버 지도 JS SDK를 동적으로 로드하는 훅.
 * index.html에 <script>를 박지 않는 이유: Client ID를 .env로 관리하려면
 * 런타임에 쿼리스트링으로 조립해야 함.
 */

declare global {
  interface Window {
    naver: any;
  }
}

let loadingPromise: Promise<void> | null = null;

function loadScript(clientId: string): Promise<void> {
  if (window.naver?.maps) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error('네이버 지도 스크립트 로드 실패'));
    };
    document.head.appendChild(script);
  });

  return loadingPromise;
}

export function useNaverMapScript() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID;
    if (!clientId) {
      // eslint-disable-next-line no-console
      console.error(
        '[useNaverMapScript] VITE_NAVER_MAP_CLIENT_ID가 없습니다. frontend/.env를 확인하세요.',
      );
      setStatus('error');
      return;
    }

    let cancelled = false;
    loadScript(clientId)
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
