import { useEffect, useMemo, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import CalendarSection from './components/CalendarSection';
import DdaySection from './components/DdaySection';
import MoodSection from './components/MoodSection';
import PairingScreen from './components/PairingScreen';
import { useAuth, logOut } from './hooks/useAuth';
import { findCoupleIdForUser, useCoupleData } from './hooks/useCoupleData';

const TABS = [
  { id: 'calendar', label: '캘린더' },
  { id: 'mood', label: '컨디션' },
  { id: 'dday', label: 'D-day' },
];

export default function App() {
  const { user, ready } = useAuth();
  const [coupleId, setCoupleId] = useState(null);
  const [toast, setToast] = useState('');
  const [checkingCouple, setCheckingCouple] = useState(true);
  const [activeTab, setActiveTab] = useState('calendar');

  useEffect(() => {
    if (!user) {
      setCoupleId(null);
      setCheckingCouple(false);
      return;
    }

    let mounted = true;
    setCheckingCouple(true);

    findCoupleIdForUser(user.uid)
      .then((nextCoupleId) => {
        if (mounted) {
          setCoupleId(nextCoupleId);
        }
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

  if (!ready || checkingCouple) {
    return <LoadingScreen label="초기화 중..." />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!coupleId) {
    return <PairingScreen onPaired={setCoupleId} user={user} />;
  }

  if (loading || !couple) {
    return <LoadingScreen label="커플 데이터 동기화 중..." />;
  }

  return (
    <div className="app-shell mobile-only">
      <header className="app-header">
        <div>
          <p className="eyebrow">Moody</p>
          <h1>무디</h1>
        </div>
        <div className="header-meta">
          <span className="member-badge">{couple.members.length}/2</span>
          <button className="outline-button small" onClick={() => logOut()} type="button">
            로그아웃
          </button>
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
  );
}

function LoadingScreen({ label }) {
  return (
    <div className="screen loading-screen">
      <div className="loading-card">
        <div className="spinner" />
        <p>{label}</p>
      </div>
    </div>
  );
}
