import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { formatDateKey, parseDateKey } from '../lib/date';
import {
  getLocalCoupleSnapshot,
  localAddEvent,
  localCreateCouple,
  localEditEvent,
  localFindCoupleIdForUser,
  localFindPairingCodeForOwner,
  localJoinCouple,
  localRemoveDday,
  localRemoveEvent,
  localSaveDday,
  localSaveMood,
  subscribeLocalStore
} from '../lib/localStore';

export function useCoupleData(coupleId) {
  const [couple, setCouple] = useState(null);
  const [events, setEvents] = useState([]);
  const [moods, setMoods] = useState({});
  const [ddays, setDdays] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!coupleId) {
      setCouple(null);
      setEvents([]);
      setMoods({});
      setDdays([]);
      setLoading(false);
      return undefined;
    }

    if (!db) {
      const applyLocalSnapshot = () => {
        const snapshot = getLocalCoupleSnapshot(coupleId);
        setCouple(snapshot.couple);
        setEvents(snapshot.events);
        setMoods(snapshot.moods);
        setDdays(snapshot.ddays);
        setLoading(false);
      };

      setLoading(true);
      applyLocalSnapshot();
      return subscribeLocalStore(applyLocalSnapshot);
    }

    setLoading(true);
    const unsubs = [];

    unsubs.push(
      onSnapshot(doc(db, 'couples', coupleId), (snapshot) => {
        setCouple(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      })
    );

    unsubs.push(
      onSnapshot(query(collection(db, 'couples', coupleId, 'events')), (snapshot) => {
        setEvents(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
          }))
        );
      })
    );

    unsubs.push(
      onSnapshot(query(collection(db, 'couples', coupleId, 'moods')), (snapshot) => {
        const next = {};
        snapshot.docs.forEach((item) => {
          next[item.id] = item.data();
        });
        setMoods(next);
      })
    );

    unsubs.push(
      onSnapshot(query(collection(db, 'couples', coupleId, 'ddays')), (snapshot) => {
        setDdays(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
      })
    );

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [coupleId]);

  const calendarEvents = useMemo(() => {
    if (!db) {
      return events;
    }

    return events.map((event) => ({
      ...event,
      startDate: event.start.toDate(),
      endDate: event.end.toDate()
    }));
  }, [events]);

  const moodEntries = useMemo(() => {
    const next = {};
    Object.entries(moods).forEach(([dateKey, value]) => {
      next[dateKey] = value;
    });
    return next;
  }, [moods]);

  return {
    couple,
    events: calendarEvents,
    moods: moodEntries,
    ddays,
    loading
  };
}

export async function findCoupleIdForUser(uid) {
  if (!db) {
    return localFindCoupleIdForUser(uid);
  }

  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.exists() ? userDoc.data().coupleId ?? null : null;
}

export async function findPairingCodeForOwner(uid) {
  if (!db) {
    return localFindPairingCodeForOwner(uid);
  }

  const snapshot = await getDocs(
    query(collection(db, 'pairingCodes'), where('ownerUid', '==', uid), limit(1))
  );

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].id;
}

export async function saveUserCouple(uid, coupleId) {
  ensureDb();
  await setDoc(doc(db, 'users', uid), { coupleId }, { merge: true });
}

export async function createCouple({ uid, anniversary, pairingCode }) {
  if (!db) {
    return localCreateCouple({ uid, anniversary, pairingCode });
  }

  const coupleRef = doc(collection(db, 'couples'));
  await setDoc(coupleRef, {
    members: [uid],
    anniversary,
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, 'pairingCodes', pairingCode), {
    coupleId: coupleRef.id,
    ownerUid: uid,
    createdAt: serverTimestamp()
  });
  await saveUserCouple(uid, coupleRef.id);
  return coupleRef.id;
}

export async function joinCouple({ uid, code }) {
  if (!db) {
    return localJoinCouple({ uid, code });
  }

  const pairingRef = doc(db, 'pairingCodes', code.trim().toUpperCase());
  const pairingSnap = await getDoc(pairingRef);

  if (!pairingSnap.exists()) {
    throw new Error('커플 코드가 없거나 만료됐어.');
  }

  const { coupleId } = pairingSnap.data();
  const coupleRef = doc(db, 'couples', coupleId);
  const coupleSnap = await getDoc(coupleRef);

  if (!coupleSnap.exists()) {
    throw new Error('커플 정보를 찾을 수 없어.');
  }

  const members = coupleSnap.data().members || [];
  if (members.includes(uid)) {
    await saveUserCouple(uid, coupleId);
    return coupleId;
  }
  if (members.length >= 2) {
    throw new Error('이미 두 명이 모두 연결된 커플이야.');
  }

  await updateDoc(coupleRef, {
    members: [...members, uid]
  });
  await saveUserCouple(uid, coupleId);
  return coupleId;
}

export async function addEvent(coupleId, payload) {
  if (!db) {
    return localAddEvent(coupleId, payload);
  }

  await addDoc(collection(db, 'couples', coupleId, 'events'), {
    ...payload,
    createdAt: serverTimestamp()
  });
}

export async function editEvent(coupleId, eventId, payload) {
  if (!db) {
    return localEditEvent(coupleId, eventId, payload);
  }

  await updateDoc(doc(db, 'couples', coupleId, 'events', eventId), payload);
}

export async function removeEvent(coupleId, eventId) {
  if (!db) {
    return localRemoveEvent(coupleId, eventId);
  }

  await deleteDoc(doc(db, 'couples', coupleId, 'events', eventId));
}

export async function saveMood(coupleId, uid, dateKey, payload) {
  if (!db) {
    return localSaveMood(coupleId, uid, dateKey, payload);
  }

  const moodRef = doc(db, 'couples', coupleId, 'moods', dateKey);
  const snapshot = await getDoc(moodRef);
  const current = snapshot.exists() ? snapshot.data() : {};

  await setDoc(
    moodRef,
    {
      ...current,
      [uid]: payload
    },
    { merge: true }
  );
}

export async function saveDday(coupleId, payload, ddayId = null) {
  if (!db) {
    return localSaveDday(coupleId, payload, ddayId);
  }

  if (ddayId) {
    await updateDoc(doc(db, 'couples', coupleId, 'ddays', ddayId), payload);
    return;
  }

  await addDoc(collection(db, 'couples', coupleId, 'ddays'), payload);
}

export async function removeDday(coupleId, ddayId) {
  if (!db) {
    return localRemoveDday(coupleId, ddayId);
  }

  await deleteDoc(doc(db, 'couples', coupleId, 'ddays', ddayId));
}

export function eventsForDate(events, date) {
  const key = formatDateKey(date);
  return events.filter((event) => {
    const start = formatDateKey(event.startDate);
    const end = formatDateKey(event.endDate);
    return key >= start && key <= end;
  });
}

export function getMoodForDate(moods, date) {
  return moods[formatDateKey(date)] || {};
}

export function createMoodDate(dateKey) {
  return parseDateKey(dateKey);
}

function ensureDb() {
  if (!db) {
    throw new Error('Firebase 설정이 비어 있거나 잘못됐어.');
  }
}
