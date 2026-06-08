import { useEffect, useMemo, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import BucketSection from './components/BucketSection';
import CalendarSection from './components/CalendarSection';
import DdaySection from './components/DdaySection';
import PairingScreen from './components/PairingScreen';
import PwaUpdateModal from './components/PwaUpdateModal';
import NotificationBell from './components/NotificationBell';
import PingHeartButton from './components/PingHeartButton';
import { firebaseConfigReady } from './firebase';
import {
  clearPendingSignupContext,
  getPendingSignupContext,
  logOut,
  useAuth
} from './hooks/useAuth';
import { findCoupleIdForUser, requestCoupleDeletion, setCoupleDeletionNow, useCoupleData } from './hooks/useCoupleData';
import { usePingStatus } from './hooks/usePingStatus';
import { usePushNotifications } from './hooks/usePushNotifications';
import { checkAndApplyAppUpdate, usePwaUpdate } from './pwaUpdate';

const TABS = [
  { id: 'calendar', label: '캘린더' },
  { id: 'bucket', label: '버킷리스트' },
  { id: 'dday', label: 'D-day' }
];

export default function App() {
  const { user, ready } = useAuth();
  const { needRefresh, updateSW } = usePwaUpdate();
  const [coupleId, setCoupleId] = useState(null);
  const [toast, setToast] = useState('');
  const [checkingCouple, setCheckingCouple] = useState(true);
  const [activeTab, setActiveTab] = useState('calendar');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [showUserSheet, setShowUserSheet] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showDeleteNowModal, setShowDeleteNowModal] = useState(false);

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

  const { couple, events, moods, ddays, loading } = useCoupleData(coupleId, refreshNonce);

  function handleRefresh() {
    setRefreshNonce((current) => current + 1);
    setToast('최신 데이터로 새로고침했어.');
    // 새 앱 버전이 배포돼 있으면 적용(새 SW 활성화 시 자동 리로드)
    checkAndApplyAppUpdate();
  }

  async function handleDeleteRequest() {
    if (!coupleId || !user) return;
    setDeleteBusy(true);
    try {
      await requestCoupleDeletion(coupleId, user.uid);
      await logOut();
    } catch (err) {
      setToast(err.message || '탈퇴 처리 중 오류가 발생했어.');
      setDeleteBusy(false);
    }
  }

  async function handleDeleteNow() {
    if (!coupleId) return;
    setDeleteBusy(true);
    try {
      await setCoupleDeletionNow(coupleId);
      await logOut();
    } catch (err) {
      setToast(err.message || '삭제 처리 중 오류가 발생했어.');
      setDeleteBusy(false);
    }
  }

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
  const pingStatus = usePingStatus({
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

  if (couple.deletionStatus === 'scheduled' && user.uid !== couple.deletionRequestedBy) {
    return (
      <>
        <PartnerLeftScreen
          busy={deleteBusy}
          onDeleteNow={() => setShowDeleteNowModal(true)}
          onLogout={logOut}
        />
        {showDeleteNowModal && (
          <ConfirmModal
            body="두 사람의 모든 데이터가 즉시 영구 삭제됩니다."
            busy={deleteBusy}
            confirmLabel="삭제하기"
            onCancel={() => setShowDeleteNowModal(false)}
            onConfirm={handleDeleteNow}
            title="지금 바로 삭제하시겠어요?"
          />
        )}
        {toast ? <div className="toast">{toast}</div> : null}
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
              <button
                aria-label="최신 데이터 새로고침"
                className="icon-btn refresh-btn"
                onClick={handleRefresh}
                title="새로고침"
                type="button"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="20"
                  viewBox="0 0 24 24"
                  width="20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 11a8 8 0 1 0-.6 3.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M20 4v5h-5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
              <PingHeartButton busy={pingStatus.busy} onSend={pingStatus.sendPing} sentToday={pingStatus.sentToday} />
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
              <button className="btn-secondary" onClick={() => setShowUserSheet(true)} type="button">
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

          {activeTab === 'bucket' ? (
            <BucketSection
              coupleId={coupleId}
              currentUser={user}
              members={couple.members}
              refreshToken={refreshNonce}
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
      {showUserSheet && (
        <UserSheet
          onClose={() => setShowUserSheet(false)}
          onDelete={() => {
            setShowUserSheet(false);
            setDeleteConfirmText('');
            setShowDeleteModal(true);
          }}
          onLogout={() => {
            setShowUserSheet(false);
            logOut();
          }}
        />
      )}
      {showDeleteModal && (
        <DeleteAccountModal
          busy={deleteBusy}
          confirmText={deleteConfirmText}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteRequest}
          onConfirmTextChange={setDeleteConfirmText}
        />
      )}
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

function UserSheet({ onClose, onLogout, onDelete }) {
  return (
    <div aria-modal="true" className="overlay-backdrop" onClick={onClose} role="dialog">
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button className="sheet-item" onClick={onLogout} type="button">
          로그아웃
        </button>
        <button className="sheet-item sheet-item-danger" onClick={onDelete} type="button">
          회원 탈퇴
        </button>
      </div>
    </div>
  );
}

function DeleteAccountModal({ confirmText, onConfirmTextChange, onConfirm, onCancel, busy }) {
  return (
    <div aria-modal="true" className="overlay-backdrop center" role="dialog">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">정말 탈퇴하시겠어요?</h2>
        <p className="modal-body">
          탈퇴하면 3일 후 두 사람의 모든 데이터(일정·무드·버킷리스트·사진)가 영구 삭제됩니다.
          이 작업은 되돌릴 수 없으며, 탈퇴 후에는 취소할 수 없습니다.
        </p>
        <label className="field">
          <span>확인을 위해 <strong>탈퇴</strong>를 입력하세요</span>
          <input
            autoComplete="off"
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder="탈퇴"
            type="text"
            value={confirmText}
          />
        </label>
        <div className="modal-actions">
          <button className="btn-secondary" disabled={busy} onClick={onCancel} type="button">
            취소
          </button>
          <button
            className="btn-primary"
            disabled={confirmText !== '탈퇴' || busy}
            onClick={onConfirm}
            type="button"
          >
            탈퇴하기
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, body, onConfirm, onCancel, busy, confirmLabel = '확인' }) {
  return (
    <div aria-modal="true" className="overlay-backdrop center" role="dialog">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-body">{body}</p>
        <div className="modal-actions">
          <button className="btn-secondary" disabled={busy} onClick={onCancel} type="button">
            취소
          </button>
          <button className="btn-primary" disabled={busy} onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PartnerLeftScreen({ onLogout, onDeleteNow, busy }) {
  return (
    <div className="partner-left-screen">
      <div className="paper-card partner-left-card">
        <p>상대가 탈퇴했어요.</p>
        <p className="muted">3일 후 두 사람의 모든 데이터가 영구 삭제됩니다.</p>
        <button className="btn-primary" disabled={busy} onClick={onDeleteNow} type="button">
          지금 바로 삭제하기
        </button>
        <button className="btn-secondary" disabled={busy} onClick={onLogout} type="button">
          로그아웃
        </button>
      </div>
    </div>
  );
}
