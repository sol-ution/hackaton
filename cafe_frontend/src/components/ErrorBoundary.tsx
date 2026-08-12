import { Component } from 'react';
import type { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 화면 전체가 하얗게 죽는 걸 막는 최후의 안전망.
 * 새 API 연동 코드가 예상과 다른 응답 모양을 만나 던지더라도,
 * 발표 중엔 "새로고침" 버튼이 있는 화면이 뜨는 편이 완전한 백지보다 훨씬 낫다.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            height: '100dvh',
            padding: 24,
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>화면에 문제가 생겼어요</p>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
              새로고침하면 대부분 바로 해결돼요.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: '#111',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
