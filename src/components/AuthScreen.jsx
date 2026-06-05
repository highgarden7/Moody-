import { useState } from 'react';
import { signIn, signUp } from '../hooks/useAuth';

export default function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (mode === 'signup') {
        await signUp(form.email, form.password);
      } else {
        await signIn(form.email, form.password);
      }
    } catch (nextError) {
      setError(mapAuthError(nextError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen auth-screen">
      <div className="auth-card">
        <p className="eyebrow">Moody</p>
        <h1>둘만 쓰는 일정판</h1>
        <p className="muted">같은 커플 코드로 연결하면 실시간으로 같이 본다.</p>

        <div className="segmented">
          <button
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => setMode('signin')}
            type="button"
          >
            로그인
          </button>
          <button
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
            type="button"
          >
            회원가입
          </button>
        </div>

        <form className="stack" onSubmit={handleSubmit}>
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

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? '처리 중...' : mode === 'signup' ? '계정 만들기' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

function mapAuthError(error) {
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
