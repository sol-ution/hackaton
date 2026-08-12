import { useEffect, useRef } from 'react';

/**
 * 일정 간격으로 콜백을 실행. 탭이 백그라운드면 멈추고, 돌아오면 즉시 한 번 실행한다.
 * (보이지도 않는 화면을 계속 갱신하면 서버·배터리만 낭비)
 */
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;

    const start = () => {
      stop();
      timer = window.setInterval(() => saved.current(), intervalMs);
    };
    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        saved.current(); // 돌아온 즉시 최신화
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}
