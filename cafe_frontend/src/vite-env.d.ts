/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NAVER_MAP_CLIENT_ID: string;
  /** 백엔드 주소. 없으면 http://localhost:8000 */
  readonly VITE_API_BASE_URL?: string;
  /** 카카오 REST API 키. 하윤이 카카오 개발자 콘솔에 앱 등록하기 전까지는 비워둠 —
   * 없으면 LoginModal이 실제 OAuth 대신 기존 스텁 로그인으로 대체 동작한다. */
  readonly VITE_KAKAO_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
