import { useEffect, useState } from 'react';

/**
 * 좁은 화면 여부. 와이어프레임이 모바일 기준이라 이 값으로 레이아웃을 갈아끼운다.
 * 768px는 태블릿 세로까지 모바일로 취급하는 흔한 기준.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isMobile;
}
