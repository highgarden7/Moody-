import { useEffect, useMemo, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import CalendarSection from './components/CalendarSection';
import DdaySection from './components/DdaySection';
import MoodSection from './components/MoodSection';
import PairingScreen from './components/PairingScreen';
import PwaUpdateModal from './components/PwaUpdateModal';
import NotificationBell from './components/NotificationBell';
import { firebaseConfigReady } from './firebase';
import {
  clearPendingSignupContext,
  getPendingSignupContext,
  logOut,
  useAuth
} from './hooks/useAuth';
import { findCoupleIdForUser, useCoupleData } from './hooks/useCoupleData';
import { usePushNotifications } from './hooks/usePushNotifications';
import { usePwaUpdate } from './pwaUpdate';

const TABS = [
  { id: 'calendar', label: '캘린더' },
  { id: 'mood', label: '컨디션' },
  { id: 'dday', label: 'D-day' }
];

export default function App() {
  const { user, ready } = useAuth();
  const { needRefresh, updateSW } = usePwaUpdate();
  const [coupleId, setCoupleId] = useState(null);
  const [toast, setToast] = useState('');
  const [checkingCouple, setCheckingCouple] = useState(true);
  const [activeTab, setActiveTab] = useState('calendar');

  useEffect(() => {
    if (!user) {
      setCoupleId(null);
      setCheckingCouple(false);
      clearPendingSignupContext();
      return;
    }

    let mounted = true;
    setCheckingCouple(true);

    findCoupleIdForUser(user.uid)
      .then((nextCoupleId) => {
        if (!mounted) {
          return;
        }

        if (nextCoupleId) {
          setCoupleId(nextCoupleId);
          clearPendingSignupContext();
          return;
        }

        const pending = getPendingSignupContext();
        if (pending?.uid === user.uid && pending.coupleId) {
          setCoupleId(pending.coupleId);
          return;
        }

        setCoupleId(null);
      })
      .finally(() => {
        if (mounted) {
          setCheckingCouple(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const { couple, events, moods, ddays, loading } = useCoupleData(coupleId);

  const ownerColors = useMemo(() => {
    if (!couple?.members?.length) {
      return user ? { [user.uid]: 'var(--me)' } : {};
    }

    return couple.members.reduce((accumulator, memberUid, index) => {
      accumulator[memberUid] = index === 0 ? 'var(--me)' : 'var(--partner)';
      return accumulator;
    }, {});
  }, [couple, user]);

  const pushNotifications = usePushNotifications({
    coupleId,
    uid: user?.uid || '',
    toast: setToast
  });

  const updateModal =
    needRefresh && updateSW ? <PwaUpdateModal onUpdate={() => updateSW(true)} /> : null;

  if (!ready || checkingCouple) {
    return (
      <>
        <LoadingScreen label="불러오는 중..." />
        {updateModal}
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen />
        {updateModal}
      </>
    );
  }

  if (!coupleId) {
    return (
      <>
        <NoCoupleScreen />
        {updateModal}
      </>
    );
  }

  if (loading || !couple) {
    return (
      <>
        <LoadingScreen label="동기화 중..." />
        {updateModal}
      </>
    );
  }

  if (couple.members.length < 2) {
    return (
      <>
        <PairingScreen user={user} coupleId={coupleId} onLogout={logOut} />
        {updateModal}
      </>
    );
  }

  return (
    <>
      <div className="app-shell mobile-only">
        <header className="app-header">
          <div className="brand-row">
            <div className="brand-block">
              <img className="header-wordmark" src="/files/wordmark.svg" alt="moody" />
            </div>
            <div className="header-actions">
              {!firebaseConfigReady ? <span className="demo-badge">데모 2/2</span> : null}
              <NotificationBell
                busy={pushNotifications.busy}
                enabled={pushNotifications.enabled}
                onDisable={pushNotifications.disableNotifications}
                onEnable={pushNotifications.enableNotifications}
                permission={pushNotifications.permission}
                reason={pushNotifications.reason}
                supported={pushNotifications.supported}
                toast={setToast}
              />
              <button className="btn-secondary" onClick={() => logOut()} type="button">
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <main className="app-main">
          {activeTab === 'calendar' ? (
            <CalendarSection
              coupleId={coupleId}
              currentUser={user}
              events={events}
              moods={moods}
              ownerColors={ownerColors}
              toast={setToast}
            />
          ) : null}

          {activeTab === 'mood' ? (
            <MoodSection
              coupleId={coupleId}
              currentUser={user}
              moods={moods}
              ownerColors={ownerColors}
              toast={setToast}
            />
          ) : null}

          {activeTab === 'dday' ? (
            <DdaySection
              anniversary={couple.anniversary}
              coupleId={coupleId}
              ddays={ddays}
              toast={setToast}
            />
          ) : null}
        </main>

        <nav className="tabbar" aria-label="주요 탭">
          {TABS.map((tab) => (
            <button
              className={activeTab === tab.id ? 'active' : ''}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {toast ? <div className="toast">{toast}</div> : null}
      </div>
      {updateModal}
    </>
  );
}

function LoadingScreen({ label }) {
  return (
    <div className="screen loading-screen">
      <div className="loading-card paper-card">
        <div className="spinner" />
        <p>{label}</p>
      </div>
    </div>
  );
}

function NoCoupleScreen() {
  return (
    <div className="screen loading-screen">
      <div className="loading-card paper-card">
        <p>이 계정은 아직 커플에 연결되지 않았어.</p>
        <p className="muted">가입 직후라면 잠시 기다리거나 다시 로그인해줘.</p>
        <button className="btn-secondary" onClick={() => logOut()} type="button">
          로그아웃
        </button>
      </div>
    </div>
  );
}
