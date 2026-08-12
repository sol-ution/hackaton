import { useCallback, useEffect, useMemo, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import CafeMap from './components/CafeMap';
import CafeDetailPanel from './components/CafeDetailPanel';
import CafeListPanel from './components/CafeListPanel';
import FilterBar from './components/FilterBar';
import SearchBar from './components/SearchBar';
import LoginModal from './components/LoginModal';
import KakaoCallback from './components/KakaoCallback';
import OwnerDashboard from './components/OwnerDashboard';
import MyPage from './components/MyPage';
import MyActivity from './components/MyActivity';
import SettingsPage from './components/SettingsPage';
import Announcements from './components/Announcements';
import CafeRegister from './components/CafeRegister';
import ContactAdmin from './components/ContactAdmin';
import OwnerMyPage from './components/OwnerMyPage';
import StoreInfoManage from './components/StoreInfoManage';
import StampPolicyManage from './components/StampPolicyManage';
import CouponRedeem from './components/CouponRedeem';
import {
  addFavorite,
  fetchCafes,
  postReport,
  postOwnerSeat,
  removeFavorite,
  getAuthToken,
  KAKAO_REDIRECT_PATH,
} from './api/client';
import { MOCK_CAFES } from './mocks/cafes';
import { MAP_CENTER } from './utils/geo';
import { OCCUPANCY_MIDPOINT } from './constants/crowd';
import { useIsMobile } from './hooks/useIsMobile';
import { usePolling } from './hooks/usePolling';
import type { Cafe, CafeTag, CrowdLevel, CrowdReportRequest, CrowdReportResponse } from './types/cafe';

/**
 * WF09~20(마이페이지·설정·스탬프 등) 화면들의 이동 스택.
 * 다들 "풀스크린 오버레이 + 뒤로가기" 패턴이라 라우터 없이 배열 하나로 처리한다.
 * 마지막 원소가 지금 보이는 화면, pop하면 그 전 화면으로 돌아감.
 */
type SubScreen =
  | { kind: 'my' }
  | { kind: 'myActivity'; tab: 'reports' | 'reviews' }
  | { kind: 'settings' }
  | { kind: 'announcements' }
  | { kind: 'cafeRegister' }
  | { kind: 'contactAdmin' }
  | { kind: 'ownerMy' }
  | { kind: 'storeInfo' }
  | { kind: 'stampPolicy' }
  | { kind: 'couponRedeem' };

const LOGIN_STORAGE_KEY = 'zari:loggedIn';

/** 사장님 화면 데모용 고정 카페. 실제 로그인-카페 매핑 붙기 전까지 이걸로 시연. */
const OWNER_DEMO_CAFE_ID = 1;

/** 목록 자동 갱신 주기. 제보하면 화면이 저절로 바뀌는 걸 보여주는 용도. */
const REFRESH_INTERVAL_MS = 30_000;

function loadLoginState(): boolean {
  // 카카오 로그인은 KakaoCallback이 zari:authToken에 저장한다. 그게 있으면 무조건 로그인 상태.
  // (이걸 안 보면 카카오로 로그인해도 App은 계속 로그아웃으로 판단해서
  //  제보 → 로그인 → 카카오 → 콜백 → 다시 제보 불가... 로 무한 반복된다.)
  if (getAuthToken()) return true;
  try {
    return localStorage.getItem(LOGIN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 제보 직후 화면에 즉시 반영하기 위한 낙관적 갱신.
 * 서버 연결 상태에서는 곧바로 재조회해서 서버 계산값으로 덮어쓰므로 "깜빡임 방지"용이고,
 * 오프라인 폴백 상태에서는 이게 최종 값이 된다.
 */
function applyOptimisticReport(cafe: Cafe, report: CrowdReportRequest): Cafe {
  return {
    ...cafe,
    crowdLevel: report.crowdLevel,
    crowdSource: 'report',
    confidence: cafe.reportCount24h + 1 >= 3 ? 'high' : 'low',
    occupancyPercent: OCCUPANCY_MIDPOINT[report.crowdLevel],
    quietScore: report.quietScore,
    restroomScore: report.restroomScore,
    outletLevel: report.outletLevel,
    hasSmokingRoom: report.smokingRoom !== 'none',
    reportCount24h: cafe.reportCount24h + 1,
    updatedAt: new Date().toISOString(),
  };
}

/** 사장님 좌석 갱신 낙관적 반영. 백엔드 store.update_owner_seat와 동일한 환산식. */
function applyOwnerSeatUpdate(cafe: Cafe, level: CrowdLevel): Cafe {
  const occupancyPercent = OCCUPANCY_MIDPOINT[level];
  return {
    ...cafe,
    crowdLevel: level,
    crowdSource: 'owner',
    confidence: 'high',
    occupancyPercent,
    emptySeats:
      cafe.totalSeats !== null ? Math.round(cafe.totalSeats * (1 - occupancyPercent / 100)) : null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 카카오 콜백 경로인지 여부. 페이지가 완전히 새로 로드될 때 한 번만 확인하면 되고
 * (카카오가 서버사이드로 리다이렉트시키는 거라 클라이언트 라우팅으로 바뀌는 값이 아님),
 * App() 렌더 도중 값이 안 바뀌므로 아래 훅 순서에 영향 없음.
 */
const IS_KAKAO_CALLBACK = window.location.pathname === KAKAO_REDIRECT_PATH;

function App() {
  // 카카오 로그인 콜백 경로면 평소 화면 대신 이 처리 화면 하나만 그린다.
  if (IS_KAKAO_CALLBACK) {
    return <KakaoCallback />;
  }

  const isMobile = useIsMobile();

  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  /** 백엔드에 못 붙어서 목데이터로 돌아간 상태. 발표 중 서버가 죽어도 화면은 살아있게. */
  const [offline, setOffline] = useState(false);

  const [selectedCafeId, setSelectedCafeId] = useState<number | null>(null);
  const [filterTag, setFilterTag] = useState<CafeTag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(loadLoginState);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [view, setView] = useState<'customer' | 'owner'>('customer');

  const [screenStack, setScreenStack] = useState<SubScreen[]>([]);
  const pushScreen = (s: SubScreen) => setScreenStack((prev) => [...prev, s]);
  const popScreen = () => setScreenStack((prev) => prev.slice(0, -1));
  const closeScreens = () => setScreenStack([]);
  const currentScreen = screenStack[screenStack.length - 1];

  /**
   * 거리·도보시간 기준점. 발표는 카페 앞이 아니라 발표장에서 하므로 GPS를 쓰지 않고
   * 인하대 후문으로 고정한다. (제보 GPS는 제출 시점에 따로 잡는다)
   */
  const origin = MAP_CENTER;

  const refresh = useCallback(async () => {
    try {
      const data = await fetchCafes();
      setCafes(data);
      setOffline(false);
      return true;
    } catch {
      setCafes((prev) => (prev.length ? prev : MOCK_CAFES));
      setOffline(true);
      return false;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // 30초마다 자동 갱신 — 제보가 들어오면 새로고침 없이 화면이 바뀐다.
  usePolling(refresh, REFRESH_INTERVAL_MS, !offline);

  useEffect(() => {
    try {
      localStorage.setItem(LOGIN_STORAGE_KEY, isLoggedIn ? '1' : '0');
    } catch {
      // 저장 실패해도 세션 내 로그인 상태는 유지되니 무시
    }
  }, [isLoggedIn]);

  const selectedCafe = useMemo(
    () => cafes.find((c) => c.id === selectedCafeId) ?? null,
    [cafes, selectedCafeId],
  );

  const ownerCafe = useMemo(
    () => cafes.find((c) => c.id === OWNER_DEMO_CAFE_ID) ?? cafes[0] ?? null,
    [cafes],
  );

  const filteredCafes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return cafes.filter((c) => {
      const matchesTag = !filterTag || c.tags.includes(filterTag);
      const matchesQuery =
        !query || c.name.toLowerCase().includes(query) || c.address.toLowerCase().includes(query);
      return matchesTag && matchesQuery;
    });
  }, [cafes, filterTag, searchQuery]);

  /** 실패 시 throw → 제보 폼이 서버 에러 메시지(GPS 반경 초과 등)를 그대로 보여줌. */
  async function handleSubmitReport(report: CrowdReportRequest): Promise<CrowdReportResponse | void> {
    setCafes((prev) =>
      prev.map((c) => (c.id === report.cafeId ? applyOptimisticReport(c, report) : c)),
    );
    if (offline) return; // 목데이터 모드: 낙관적 갱신이 최종값
    let res: CrowdReportResponse;
    try {
      res = await postReport(report);
    } catch (err) {
      await refresh(); // 낙관적 갱신 롤백
      throw err;
    }
    await refresh(); // 서버가 계산한 crowdLevel/confidence로 교체
    return res;
  }

  /**
   * 즐겨찾기 토글. 화면은 클릭 즉시 반영(낙관적 갱신)하고 그대로 유지한다.
   * 서버 호출이 실패해도 되돌리지 않는 이유: 되돌리면 "눌러도 아무 반응 없음"처럼 보여서
   * 데모에서 훨씬 혼란스럽다 — 대신 콘솔에 에러만 남겨 나중에 원인을 추적할 수 있게 한다.
   */
  async function handleToggleFavorite(cafe: Cafe) {
    const next = !cafe.isFavorite;
    setCafes((prev) => prev.map((c) => (c.id === cafe.id ? { ...c, isFavorite: next } : c)));
    if (offline) return;
    try {
      if (next) await addFavorite(cafe.id);
      else await removeFavorite(cafe.id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[favorite] 서버 반영 실패, 화면 상태는 그대로 유지', err);
    }
  }

  async function handleOwnerUpdateSeat(level: CrowdLevel) {
    const targetId = ownerCafe?.id ?? OWNER_DEMO_CAFE_ID;
    setCafes((prev) => prev.map((c) => (c.id === targetId ? applyOwnerSeatUpdate(c, level) : c)));
    if (offline) return;
    try {
      await postOwnerSeat({ cafeId: targetId, crowdLevel: level });
      await refresh();
    } catch {
      await refresh();
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100dvh', color: '#888' }}>
        불러오는 중…
      </div>
    );
  }

  const detailPanel = selectedCafe && (
    <CafeDetailPanel
      key={selectedCafe.id}
      cafe={selectedCafe}
      allCafes={cafes}
      onClose={() => setSelectedCafeId(null)}
      onSelectAlternative={(cafe) => setSelectedCafeId(cafe.id)}
      isLoggedIn={isLoggedIn}
      onRequestLogin={() => setShowLoginModal(true)}
      onSubmitReport={handleSubmitReport}
      onToggleFavorite={handleToggleFavorite}
      origin={origin}
      offline={offline}
    />
  );

  return (
    <ErrorBoundary>
    <div
      style={{
        width: '100%',
        // 모바일 브라우저 주소창 높이 변화 대응 (100vh는 아래가 잘림)
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {offline && (
        <div
          style={{
            padding: '6px 12px',
            background: '#FCEADD',
            color: '#7A3208',
            fontSize: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>서버에 연결되지 않아 샘플 데이터로 보여주고 있어요.</span>
          <button
            onClick={() => refresh()}
            style={{
              flexShrink: 0,
              border: '1px solid #E06010',
              background: 'transparent',
              color: '#7A3208',
              borderRadius: 6,
              padding: '2px 10px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            다시 연결
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: '#fafafa',
          borderBottom: '1px solid #eee',
          flexShrink: 0,
        }}
      >
        {view === 'customer' && (
          <button
            onClick={() => pushScreen({ kind: 'my' })}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: '1px solid #ddd',
              background: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            👤 마이
          </button>
        )}
        <button
          onClick={() => setView(view === 'customer' ? 'owner' : 'customer')}
          style={{
            padding: '6px 14px',
            borderRadius: 999,
            border: '1px solid #ddd',
            background: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {view === 'customer' ? '🔑 사장님 화면 (데모)' : '← 고객 화면으로'}
        </button>
      </div>

      {view === 'owner' ? (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {ownerCafe && (
            <OwnerDashboard
              cafe={ownerCafe}
              offline={offline}
              onUpdateSeat={handleOwnerUpdateSeat}
              onOpenSettings={() => pushScreen({ kind: 'ownerMy' })}
            />
          )}
        </div>
      ) : (
        <>
          <div style={{ flexShrink: 0 }}>
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <FilterBar selected={filterTag} onChange={setFilterTag} />
          </div>

          {isMobile ? (
            /* 모바일 — WF01: 지도 위, 카페 리스트는 아래 시트 */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ flex: '1 1 55%', position: 'relative', minHeight: 0 }}>
                <CafeMap
                  cafes={filteredCafes}
                  center={MAP_CENTER}
                  onSelect={(cafe) => setSelectedCafeId(cafe.id)}
                />
              </div>
              <div
                style={{
                  flex: '1 1 45%',
                  minHeight: 0,
                  borderTop: '1px solid #eee',
                  boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
                  background: '#fff',
                }}
              >
                <CafeListPanel
                  cafes={filteredCafes}
                  center={origin}
                  onSelect={(cafe) => setSelectedCafeId(cafe.id)}
                  selectedId={selectedCafeId}
                />
              </div>
            </div>
          ) : (
            /* 데스크톱 — 리스트와 지도를 나란히 */
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #eee' }}>
                <CafeListPanel
                  cafes={filteredCafes}
                  center={origin}
                  onSelect={(cafe) => setSelectedCafeId(cafe.id)}
                  selectedId={selectedCafeId}
                />
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <CafeMap
                  cafes={filteredCafes}
                  center={MAP_CENTER}
                  onSelect={(cafe) => setSelectedCafeId(cafe.id)}
                />
                {detailPanel}
              </div>
            </div>
          )}
        </>
      )}

      {/* 모바일에서는 상세를 전체화면으로 띄운다 (좁은 화면에 사이드 패널은 안 맞음) */}
      {isMobile && view === 'customer' && detailPanel}

      {/* WF09~20 마이페이지·설정·스탬프 화면군. screenStack이 비어있으면 아무것도 안 그림. */}
      {currentScreen?.kind === 'my' && (
        <MyPage
          cafes={cafes}
          offline={offline}
          onBack={popScreen}
          onOpenActivity={(tab) => pushScreen({ kind: 'myActivity', tab })}
          onOpenSettings={() => pushScreen({ kind: 'settings' })}
          onSelectCafe={(cafe) => {
            closeScreens();
            setSelectedCafeId(cafe.id);
          }}
        />
      )}
      {currentScreen?.kind === 'myActivity' && (
        <MyActivity initialTab={currentScreen.tab} offline={offline} onBack={popScreen} />
      )}
      {currentScreen?.kind === 'settings' && (
        <SettingsPage
          onBack={popScreen}
          onOpenAnnouncements={() => pushScreen({ kind: 'announcements' })}
          onOpenCafeRegister={() => pushScreen({ kind: 'cafeRegister' })}
          onOpenContactAdmin={() => pushScreen({ kind: 'contactAdmin' })}
        />
      )}
      {currentScreen?.kind === 'announcements' && <Announcements offline={offline} onBack={popScreen} />}
      {currentScreen?.kind === 'cafeRegister' && <CafeRegister cafes={cafes} onBack={popScreen} />}
      {currentScreen?.kind === 'contactAdmin' && <ContactAdmin onBack={popScreen} />}
      {currentScreen?.kind === 'ownerMy' && ownerCafe && (
        <OwnerMyPage
          cafe={ownerCafe}
          offline={offline}
          onBack={popScreen}
          onOpenSeat={popScreen}
          onOpenStoreInfo={() => pushScreen({ kind: 'storeInfo' })}
          onOpenStampPolicy={() => pushScreen({ kind: 'stampPolicy' })}
          onOpenCouponRedeem={() => pushScreen({ kind: 'couponRedeem' })}
          onOpenSettings={() => pushScreen({ kind: 'settings' })}
        />
      )}
      {currentScreen?.kind === 'storeInfo' && ownerCafe && (
        <StoreInfoManage cafe={ownerCafe} offline={offline} onBack={popScreen} />
      )}
      {currentScreen?.kind === 'stampPolicy' && ownerCafe && (
        <StampPolicyManage cafeId={ownerCafe.id} cafeName={ownerCafe.name} offline={offline} onBack={popScreen} />
      )}
      {currentScreen?.kind === 'couponRedeem' && ownerCafe && (
        <CouponRedeem cafeId={ownerCafe.id} offline={offline} onBack={popScreen} />
      )}

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLogin={() => {
            setIsLoggedIn(true);
            setShowLoginModal(false);
          }}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}

export default App;
