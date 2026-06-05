const STORAGE_KEY = 'moody-local-store';
const EVENT_NAME = 'moody-local-store-change';

function createInitialState() {
  return {
    sessionUid: null,
    users: {},
    couples: {},
    pairingCodes: {}
  };
}

function readState() {
  if (typeof window === 'undefined') {
    return createInitialState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createInitialState();
  }

  try {
    return JSON.parse(raw);
  } catch {
    return createInitialState();
  }
}

function writeState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function updateState(updater) {
  const state = readState();
  const nextState = updater(state);
  writeState(nextState);
  return nextState;
}

export function subscribeLocalStore(listener) {
  const handler = () => listener(readState());
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

export function getLocalSessionUser() {
  const state = readState();
  if (!state.sessionUid) {
    return null;
  }
  return state.users[state.sessionUid] || null;
}

export async function localSignUp(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const state = readState();
  const exists = Object.values(state.users).some((user) => user.email === normalizedEmail);
  if (exists) {
    throw new Error('이미 쓰는 이메일이야.');
  }

  const uid = crypto.randomUUID();
  updateState((current) => ({
    ...current,
    sessionUid: uid,
    users: {
      ...current.users,
      [uid]: {
        uid,
        email: normalizedEmail,
        password,
        coupleId: null
      }
    }
  }));

  return getLocalSessionUser();
}

export async function localSignIn(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const state = readState();
  const user = Object.values(state.users).find(
    (item) => item.email === normalizedEmail && item.password === password
  );

  if (!user) {
    throw new Error('이메일이나 비밀번호가 맞지 않아.');
  }

  updateState((current) => ({
    ...current,
    sessionUid: user.uid
  }));

  return getLocalSessionUser();
}

export async function localLogOut() {
  updateState((current) => ({
    ...current,
    sessionUid: null
  }));
}

export async function localFindCoupleIdForUser(uid) {
  const state = readState();
  return state.users[uid]?.coupleId ?? null;
}

export async function localCreateCouple({ uid, anniversary, pairingCode }) {
  const coupleId = crypto.randomUUID();
  const now = new Date().toISOString();

  updateState((current) => ({
    ...current,
    users: {
      ...current.users,
      [uid]: {
        ...current.users[uid],
        coupleId
      }
    },
    pairingCodes: {
      ...current.pairingCodes,
      [pairingCode]: {
        ownerUid: uid,
        coupleId,
        createdAt: now
      }
    },
    couples: {
      ...current.couples,
      [coupleId]: {
        id: coupleId,
        members: [uid],
        anniversary: anniversary.toISOString(),
        createdAt: now,
        events: {},
        moods: {},
        ddays: {}
      }
    }
  }));

  return coupleId;
}

export async function localJoinCouple({ uid, code }) {
  const pairingCode = code.trim().toUpperCase();
  const state = readState();
  const pairing = state.pairingCodes[pairingCode];

  if (!pairing) {
    throw new Error('페어링 코드를 찾을 수 없어.');
  }

  const couple = state.couples[pairing.coupleId];
  if (!couple) {
    throw new Error('커플 정보를 찾을 수 없어.');
  }

  if (!couple.members.includes(uid) && couple.members.length >= 2) {
    throw new Error('이미 2명이 연결된 커플이야.');
  }

  updateState((current) => {
    const currentCouple = current.couples[pairing.coupleId];
    const nextMembers = currentCouple.members.includes(uid)
      ? currentCouple.members
      : [...currentCouple.members, uid];

    return {
      ...current,
      users: {
        ...current.users,
        [uid]: {
          ...current.users[uid],
          coupleId: pairing.coupleId
        }
      },
      couples: {
        ...current.couples,
        [pairing.coupleId]: {
          ...currentCouple,
          members: nextMembers
        }
      }
    };
  });

  return pairing.coupleId;
}

export function getLocalCoupleSnapshot(coupleId) {
  const state = readState();
  const couple = state.couples[coupleId];
  if (!couple) {
    return {
      couple: null,
      events: [],
      moods: {},
      ddays: []
    };
  }

  return {
    couple: {
      ...couple,
      anniversary: new Date(couple.anniversary)
    },
    events: Object.values(couple.events).map((item) => ({
      ...item,
      startDate: new Date(item.start),
      endDate: new Date(item.end)
    })),
    moods: couple.moods,
    ddays: Object.values(couple.ddays).map((item) => ({
      ...item,
      date: new Date(item.date)
    }))
  };
}

export async function localAddEvent(coupleId, payload) {
  const eventId = crypto.randomUUID();
  updateState((current) => ({
    ...current,
    couples: {
      ...current.couples,
      [coupleId]: {
        ...current.couples[coupleId],
        events: {
          ...current.couples[coupleId].events,
          [eventId]: {
            id: eventId,
            ...payload,
            start: payload.start.toISOString(),
            end: payload.end.toISOString(),
            createdAt: new Date().toISOString()
          }
        }
      }
    }
  }));
}

export async function localEditEvent(coupleId, eventId, payload) {
  updateState((current) => ({
    ...current,
    couples: {
      ...current.couples,
      [coupleId]: {
        ...current.couples[coupleId],
        events: {
          ...current.couples[coupleId].events,
          [eventId]: {
            ...current.couples[coupleId].events[eventId],
            ...payload,
            start: payload.start.toISOString(),
            end: payload.end.toISOString()
          }
        }
      }
    }
  }));
}

export async function localRemoveEvent(coupleId, eventId) {
  updateState((current) => {
    const nextEvents = { ...current.couples[coupleId].events };
    delete nextEvents[eventId];
    return {
      ...current,
      couples: {
        ...current.couples,
        [coupleId]: {
          ...current.couples[coupleId],
          events: nextEvents
        }
      }
    };
  });
}

export async function localSaveMood(coupleId, uid, dateKey, payload) {
  updateState((current) => ({
    ...current,
    couples: {
      ...current.couples,
      [coupleId]: {
        ...current.couples[coupleId],
        moods: {
          ...current.couples[coupleId].moods,
          [dateKey]: {
            ...(current.couples[coupleId].moods[dateKey] || {}),
            [uid]: payload
          }
        }
      }
    }
  }));
}

export async function localSaveDday(coupleId, payload, ddayId = null) {
  const nextId = ddayId || crypto.randomUUID();
  updateState((current) => ({
    ...current,
    couples: {
      ...current.couples,
      [coupleId]: {
        ...current.couples[coupleId],
        ddays: {
          ...current.couples[coupleId].ddays,
          [nextId]: {
            id: nextId,
            ...payload,
            date: payload.date.toISOString()
          }
        }
      }
    }
  }));
}

export async function localRemoveDday(coupleId, ddayId) {
  updateState((current) => {
    const nextDdays = { ...current.couples[coupleId].ddays };
    delete nextDdays[ddayId];
    return {
      ...current,
      couples: {
        ...current.couples,
        [coupleId]: {
          ...current.couples[coupleId],
          ddays: nextDdays
        }
      }
    };
  });
}

export async function localDemoLogin() {
  const demoEmail = 'demo@moody.local';
  const demoUid = 'demo-user-1';
  const partnerUid = 'demo-user-2';
  const coupleId = 'demo-couple-1';
  const today = new Date();
  const todayKey = formatDateKey(today);
  const anniversary = new Date(today);
  anniversary.setDate(anniversary.getDate() - 286);

  updateState((current) => ({
    ...current,
    sessionUid: demoUid,
    users: {
      ...current.users,
      [demoUid]: {
        uid: demoUid,
        email: demoEmail,
        password: 'demo1234',
        coupleId
      },
      [partnerUid]: {
        uid: partnerUid,
        email: 'partner@moody.local',
        password: 'demo1234',
        coupleId
      }
    },
    couples: {
      ...current.couples,
      [coupleId]: {
        id: coupleId,
        members: [demoUid, partnerUid],
        anniversary: anniversary.toISOString(),
        createdAt: today.toISOString(),
        events: {
          'demo-event-1': {
            id: 'demo-event-1',
            title: '저녁 약속',
            start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 0).toISOString(),
            end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 21, 0).toISOString(),
            allDay: false,
            ownerUid: demoUid,
            createdAt: today.toISOString()
          },
          'demo-event-2': {
            id: 'demo-event-2',
            title: '주말 산책',
            start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 14, 0).toISOString(),
            end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 16, 0).toISOString(),
            allDay: false,
            ownerUid: partnerUid,
            createdAt: today.toISOString()
          }
        },
        moods: {
          [todayKey]: {
            [demoUid]: {
              emoji: '😮‍💨',
              note: '오후에 좀 기빨림. 저녁엔 괜찮아질 듯'
            },
            [partnerUid]: {
              emoji: '😀',
              note: '오늘은 비교적 괜찮음'
            }
          }
        },
        ddays: {
          'demo-dday-1': {
            id: 'demo-dday-1',
            label: '다음 여행',
            date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 18).toISOString(),
            repeatEvery: 'none'
          },
          'demo-dday-2': {
            id: 'demo-dday-2',
            label: '만난 날',
            date: anniversary.toISOString(),
            repeatEvery: '100days'
          }
        }
      }
    }
  }));

  return getLocalSessionUser();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
