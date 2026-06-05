import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db, firebaseConfigReady } from '../firebase';
import { signIn, signInDemo, signUpFounder, signUpJoiner } from '../hooks/useAuth';

export default function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [signupPath, setSignupPath] = useState('founder');
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(Boolean(firebaseConfigReady));
  const [form, setForm] = useState({
    email: '',
    password: '',
    anniversary: '',
    coupleCode: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showDemoLogin = !import.meta.env.PROD && !firebaseConfigReady;

  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSignupConfig() {
      if (!db) {
        if (active) {
          setSignupEnabled(true);
          setLoadingConfig(false);
        }
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, 'config', 'app'));
        if (!active) {
          return;
        }

        const enabled = snapshot.exists() && snapshot.data().signupEnabled === true;
        setSignupEnabled(enabled);
        if (!enabled) {
          setMode('signin');
        }
      } catch {
        if (active) {
          setSignupEnabled(false);
          setMode('signin');
        }
      } finally {
        if (active) {
          setLoadingConfig(false);
        }
      }
    }

    loadSignupConfig();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (mode === 'signin') {
        await signIn(form.email, form.password);
      } else if (signupPath === 'founder') {
        await signUpFounder({
          email: form.email,
          password: form.password,
          anniversary: form.anniversary
        });
      } else {
        await signUpJoiner({
          email: form.email,
          password: form.password,
          code: form.coupleCode
        });
      }
    } catch (nextError) {
      setError(mapAuthError(nextError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setSubmitting(true);
    setError('');

    try {
      await signInDemo();
    } catch (nextError) {
      setError(mapAuthError(nextError));
    } finally {
      setSubmitting(false);
    }
  }

  const showSignup = signupEnabled && !loadingConfig;

  return (
    <div className="screen auth-screen auth-screen-offset landing-screen">
      <div className="auth-card paper-card auth-paper landing-card auth-card-scroll">
        <div className="auth-intro auth-brand-intro">
          <img className="auth-logotype" src="/files/logotype.svg" alt="moody" />
          <p className="muted">가볍게 같이 보는 하루 기록</p>
        </div>

        {showDemoLogin ? (
          <div className="demo-actions">
            <button className="btn-secondary" disabled={submitting} onClick={handleDemoLogin} type="button">
              테스트 로그인
            </button>
            <p className="muted">데모로 둘러보기</p>
          </div>
        ) : null}

        {!showSignup ? (
          <div className="info-banner">
            <p>현재 신규 가입이 닫혀 있어요.</p>
          </div>
        ) : null}

        <div className="segmented auth-toggle-group auth-toggle-spacer">
          <button
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => setMode('signin')}
            type="button"
          >
            로그인
          </button>
          {showSignup ? (
            <button
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => setMode('signup')}
              type="button"
            >
              회원가입
            </button>
          ) : null}
        </div>

        <form className="stack auth-form-stack" onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <div className="segmented auth-toggle-group auth-toggle-spacer signup-paths">
              <button
                className={signupPath === 'founder' ? 'active' : ''}
                onClick={() => setSignupPath('founder')}
                type="button"
              >
                커플 새로 만들기
              </button>
              <button
                className={signupPath === 'joiner' ? 'active' : ''}
                onClick={() => setSignupPath('joiner')}
                type="button"
              >
                커플 코드로 합류
              </button>
            </div>
          ) : null}

          <label className="field">
            <span>이메일</span>
            <input
              autoComplete="email"
              name="email"
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              required
              type="email"
              value={form.email}
            />
          </label>

          <label className="field">
            <span>비밀번호</span>
            <input
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              name="password"
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              required
              type="password"
              value={form.password}
            />
          </label>

          {mode === 'signup' && signupPath === 'founder' ? (
            <label className="field">
              <span>만난 날</span>
              <input
                onChange={(event) =>
                  setForm((current) => ({ ...current, anniversary: event.target.value }))
                }
                required
                type="date"
                value={form.anniversary}
              />
            </label>
          ) : null}

          {mode === 'signup' && signupPath === 'joiner' ? (
            <label className="field">
              <span>커플 코드</span>
              <input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    coupleCode: event.target.value.toUpperCase()
                  }))
                }
                placeholder="ABC123"
                required
                value={form.coupleCode}
              />
            </label>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}

          <button className="btn-primary" disabled={submitting || loadingConfig} type="submit">
            {submitting
              ? '처리 중...'
              : mode === 'signin'
                ? '로그인'
                : signupPath === 'founder'
                  ? '가입하고 코드 만들기'
                  : '가입하고 합류하기'}
          </button>
        </form>
      </div>
    </div>
  );
}

function mapAuthError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  switch (error.code) {
    case 'auth/email-already-in-use':
      return '이미 쓰는 이메일이야.';
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일이나 비밀번호가 맞지 않아.';
    case 'auth/weak-password':
      return '비밀번호를 6자 이상으로 넣어줘.';
    default:
      return '인증 처리 중 오류가 났어.';
  }
}
