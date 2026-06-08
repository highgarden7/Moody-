import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getKstTodayRange() {
  const now = new Date();
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  const startUtcMs =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - KST_OFFSET_MS;

  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + DAY_MS)
  };
}

export function usePingStatus({ coupleId, uid, toast }) {
  const [sentToday, setSentToday] = useState(false);
  const [busy, setBusy] = useState(false);
  const [optimisticSent, setOptimisticSent] = useState(false);

  const effectiveSent = useMemo(() => sentToday || optimisticSent, [optimisticSent, sentToday]);

  useEffect(() => {
    setOptimisticSent(false);
  }, [coupleId, uid]);

  useEffect(() => {
    if (!db || !coupleId || !uid) {
      setSentToday(false);
      return undefined;
    }

    const { start, end } = getKstTodayRange();
    const pingsRef = collection(db, 'couples', coupleId, 'pings');
    const pingQuery = query(
      pingsRef,
      where('createdAt', '>=', start),
      where('createdAt', '<', end)
    );

    return onSnapshot(pingQuery, (snapshot) => {
      const hasSent = snapshot.docs.some((item) => item.data().fromUid === uid);
      setSentToday(hasSent);
      if (hasSent) {
        setOptimisticSent(false);
      }
    });
  }, [coupleId, uid]);

  async function sendPing() {
    if (busy || effectiveSent) {
      return;
    }

    if (!db) {
      toast('Firebase 연결 후 사용할 수 있어.');
      return;
    }

    setBusy(true);
    setOptimisticSent(true);

    try {
      await addDoc(collection(db, 'couples', coupleId, 'pings'), {
        fromUid: uid,
        createdAt: serverTimestamp()
      });
      toast('보고싶다를 보냈어.');
    } catch (error) {
      setOptimisticSent(false);
      toast(error?.message || '보고싶다 보내기에 실패했어.');
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    sentToday: effectiveSent,
    sendPing
  };
}
