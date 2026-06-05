'use strict';

const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

const REGION = 'asia-northeast3';
const DAY_MS = 24 * 60 * 60 * 1000;
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token'
]);

const RECORD_MESSAGE = {
  title: 'moody',
  body: '오늘의 기록이 도착했어요 — moody에서 확인'
};

const DDAY_MESSAGES = {
  7: {
    title: 'moody',
    body: '곧 다가와요 — moody에서 확인해요'
  },
  1: {
    title: 'moody',
    body: '내일이에요! moody 열어보기'
  }
};

exports.sendDdayNotifications = onSchedule(
  {
    region: REGION,
    schedule: '0 7 * * *',
    timeZone: 'Asia/Seoul'
  },
  async () => {
    const couplesSnapshot = await db.collection('couples').get();
    const todayKst = getKstDayStart();
    let sentCount = 0;

    for (const coupleDoc of couplesSnapshot.docs) {
      const coupleData = coupleDoc.data();
      const tokenEntries = getAllTokenEntries(coupleData);
      if (tokenEntries.length === 0) {
        continue;
      }

      const ddaysSnapshot = await coupleDoc.ref.collection('ddays').get();
      const notifications = [];

      for (const ddayDoc of ddaysSnapshot.docs) {
        const dday = ddayDoc.data();
        const baseDate = toKstDayStart(dday.date);
        const nextOccurrence = getNextOccurrenceDate(baseDate, todayKst, dday.repeatEvery);
        const daysLeft = diffDays(nextOccurrence, todayKst);

        if (daysLeft === 7 || daysLeft === 1) {
          notifications.push(DDAY_MESSAGES[daysLeft]);
        }
      }

      if (notifications.length === 0) {
        continue;
      }

      for (const notification of notifications) {
        sentCount += await sendMessagesToTokenEntries(
          coupleDoc.ref,
          tokenEntries,
          notification,
          'dday'
        );
      }
    }

    logger.info('sendDdayNotifications complete', { sentCount });
  }
);

exports.notifyOnMoodWrite = onDocumentWritten(
  {
    region: REGION,
    document: 'couples/{coupleId}/moods/{date}'
  },
  async (event) => {
    const afterData = event.data.after.exists ? event.data.after.data() : null;
    if (!afterData) {
      return;
    }

    const beforeData = event.data.before.exists ? event.data.before.data() : {};
    const { coupleId } = event.params;

    const coupleSnap = await db.collection('couples').doc(coupleId).get();
    if (!coupleSnap.exists) {
      return;
    }

    const coupleData = coupleSnap.data();
    const members = Array.isArray(coupleData.members) ? coupleData.members : [];
    if (members.length < 2) {
      return;
    }

    const changedAuthors = members.filter((uid) => {
      const beforeValue = beforeData[uid] ?? null;
      const afterValue = afterData[uid] ?? null;
      return afterValue && JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
    });

    if (changedAuthors.length === 0) {
      return;
    }

    const targetEntries = getPartnerTokenEntries(coupleData, changedAuthors);
    if (targetEntries.length === 0) {
      return;
    }

    await sendMessagesToTokenEntries(coupleSnap.ref, targetEntries, RECORD_MESSAGE, 'mood');
  }
);

exports.notifyOnEventCreate = onDocumentCreated(
  {
    region: REGION,
    document: 'couples/{coupleId}/events/{eventId}'
  },
  async (event) => {
    const eventData = event.data.data();
    const authorUid = eventData.ownerUid;
    if (!authorUid) {
      return;
    }

    const coupleRef = db.collection('couples').doc(event.params.coupleId);
    const coupleSnap = await coupleRef.get();
    if (!coupleSnap.exists) {
      return;
    }

    const targetEntries = getPartnerTokenEntries(coupleSnap.data(), [authorUid]);
    if (targetEntries.length === 0) {
      return;
    }

    await sendMessagesToTokenEntries(coupleRef, targetEntries, RECORD_MESSAGE, 'event');
  }
);

async function sendMessagesToTokenEntries(coupleRef, tokenEntries, notification, kind) {
  if (tokenEntries.length === 0) {
    return 0;
  }

  const messages = tokenEntries.map(({ token }) => ({
    token,
    notification: {
      title: notification.title,
      body: notification.body
    },
    data: {
      type: kind,
      link: '/'
    },
    webpush: {
      headers: {
        Urgency: 'high'
      },
      notification: {
        title: notification.title,
        body: notification.body,
        icon: '/files/icon-192.png'
      },
      fcmOptions: {
        link: '/'
      }
    }
  }));

  const response = await messaging.sendEach(messages);
  await cleanupInvalidTokens(coupleRef, tokenEntries, response.responses);

  return response.responses.filter((item) => item.success).length;
}

async function cleanupInvalidTokens(coupleRef, tokenEntries, responses) {
  const cleanup = {};

  responses.forEach((response, index) => {
    if (response.success) {
      return;
    }

    const code = response.error?.code;
    if (!INVALID_TOKEN_CODES.has(code)) {
      logger.warn('FCM send failed', {
        code,
        uid: tokenEntries[index]?.uid
      });
      return;
    }

    cleanup[`fcmTokens.${tokenEntries[index].uid}`] = admin.firestore.FieldValue.delete();
  });

  if (Object.keys(cleanup).length === 0) {
    return;
  }

  await coupleRef.update(cleanup);
}

function getAllTokenEntries(coupleData) {
  const tokens = coupleData.fcmTokens || {};
  return Object.entries(tokens)
    .filter(([, token]) => typeof token === 'string' && token.trim().length > 0)
    .map(([uid, token]) => ({
      uid,
      token
    }));
}

function getPartnerTokenEntries(coupleData, authorUids) {
  const members = Array.isArray(coupleData.members) ? coupleData.members : [];
  const tokens = coupleData.fcmTokens || {};
  const targets = new Map();

  authorUids.forEach((authorUid) => {
    members
      .filter((uid) => uid !== authorUid)
      .forEach((targetUid) => {
        const token = tokens[targetUid];
        if (typeof token === 'string' && token.trim().length > 0) {
          targets.set(targetUid, token);
        }
      });
  });

  return Array.from(targets.entries()).map(([uid, token]) => ({
    uid,
    token
  }));
}

function getKstDayStart(date = new Date()) {
  return toUtcDayFromKey(getKstDateKey(date));
}

function toKstDayStart(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return toUtcDayFromKey(getKstDateKey(date));
}

function getKstDateKey(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function toUtcDayFromKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getNextOccurrenceDate(baseDate, todayDate, repeatEvery) {
  if (repeatEvery !== '100days') {
    return baseDate;
  }

  if (baseDate > todayDate) {
    return baseDate;
  }

  const daysElapsed = Math.floor((todayDate.getTime() - baseDate.getTime()) / DAY_MS);
  const cyclesPassed = Math.floor(daysElapsed / 100) + 1;
  return addDays(baseDate, cyclesPassed * 100);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffDays(targetDate, baseDate) {
  return Math.round((targetDate.getTime() - baseDate.getTime()) / DAY_MS);
}
