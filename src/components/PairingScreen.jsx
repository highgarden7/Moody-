import { useState } from 'react';
import {
  createCouple,
  joinCouple,
} from '../hooks/useCoupleData';
import { createPairingCode } from '../lib/pairing';

export default function PairingScreen({ user, onPaired }) {
  const [anniversary, setAnniversary] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const pairingCode = createPairingCode();
      const coupleId = await createCouple({
        uid: user.uid,
        anniversary: new Date(`${anniversary}T00:00:00`),
        pairingCode,
      });
      setCreatedCode(pairingCode);
      onPaired(coupleId);
    } catch (nextError) {
      setError(nextError.message || '커플 생성에 실패했어.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const coupleId = await joinCouple({
        uid: user.uid,
        code: joinCode,
      });
      onPaired(coupleId);
    } catch (nextError) {
      setError(nextError.message || '페어링에 실패했어.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen pairing-screen">
      <div className="pairing-grid">
        <section className="panel">
          <p className="eyebrow">1명째</p>
          <h2>커플 공간 만들기</h2>
          <form className="stack" onSubmit={handleCreate}>
            <label className="field">
              <span>만난 날</span>
              <input
                onChange={(event) => setAnniversary(event.target.value)}
                required
                type="date"
                value={anniversary}
              />
            </label>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? '생성 중...' : '커플 생성'}
            </button>
          </form>

          {createdCode ? (
            <div className="code-box">
              <span>페어링 코드</span>
              <strong>{createdCode}</strong>
            </div>
          ) : (
            <p className="muted">생성 후 이 코드를 상대에게 보내면 끝.</p>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">2명째</p>
          <h2>코드로 합류</h2>
          <form className="stack" onSubmit={handleJoin}>
            <label className="field">
              <span>페어링 코드</span>
              <input
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="ABC123"
                required
                value={joinCode}
              />
            </label>
            <button className="secondary-button" disabled={busy} type="submit">
              {busy ? '연결 중...' : '합류하기'}
            </button>
          </form>
          <p className="muted">둘째 기기에서는 만난 날 입력 없이 코드만 넣는다.</p>
        </section>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
    </div>
  );
}
