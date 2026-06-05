import { useEffect, useState } from 'react';
import { findPairingCodeForOwner } from '../hooks/useCoupleData';

export default function PairingScreen({ user, coupleId, onLogout }) {
  const [pairingCode, setPairingCode] = useState('');
  const [copyLabel, setCopyLabel] = useState('복사');

  useEffect(() => {
    let active = true;

    findPairingCodeForOwner(user.uid).then((code) => {
      if (active) {
        setPairingCode(code ?? '');
      }
    });

    return () => {
      active = false;
    };
  }, [user.uid, coupleId]);

  async function handleCopy() {
    if (!pairingCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopyLabel('복사됨');
      window.setTimeout(() => setCopyLabel('복사'), 1800);
    } catch {
      setCopyLabel('실패');
      window.setTimeout(() => setCopyLabel('복사'), 1800);
    }
  }

  return (
    <div className="screen pairing-screen">
      <div className="pairing-grid">
        <section className="panel pairing-wait">
          <h2>상대 합류 기다리는 중</h2>
          <p className="muted">상대가 회원가입할 때 아래 커플 코드를 넣으면 바로 연결된다.</p>

          <div className="code-box">
            <span>커플 코드</span>
            <strong>{pairingCode || '생성 중...'}</strong>
          </div>

          <div className="copy-row">
            <button className="btn-secondary" disabled={!pairingCode} onClick={handleCopy} type="button">
              {copyLabel}
            </button>
            <button className="btn-secondary" onClick={() => onLogout()} type="button">
              로그아웃
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
