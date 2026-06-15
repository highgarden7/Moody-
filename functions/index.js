'use strict';

const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten
} = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

const REGION = 'asia-northeast3';
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token'
]);

const RECORD_MESSAGE = {
  title: 'moody',
  body: '오늘의 기록이 도착했어요 — moody에서 확인'
};

const MOOD_RECORDED_MESSAGE = {
  title: 'moody',
  body: '오늘의 Moody가 도착했어요 — moody에서 확인'
};

const MOOD_REMINDER_1250 = {
  title: 'moody',
  body: '오늘의 무드를 상대에게 알려줘요'
};

const MOOD_REMINDER_2320 = {
  title: 'moody',
  body: '오늘의 Moody를 아직 기록하지 않았어요. 오늘이 지나기 전에 남겨봐요'
};

const DELETION_NOTICE_MESSAGE = {
  title: 'moody',
  body: '상대가 탈퇴했어요. 3일 뒤 모든 데이터가 영구 삭제됩니다.'
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

const PING_MESSAGE = {
  body: '보고싶대요 💛'
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

    const newAuthors = members.filter((uid) => !beforeData[uid] && !!afterData[uid]);

    if (newAuthors.length === 0) {
      return;
    }

    const targetEntries = getPartnerTokenEntries(coupleData, newAuthors);
    if (targetEntries.length === 0) {
      return;
    }

    await sendMessagesToTokenEntries(coupleSnap.ref, targetEntries, MOOD_RECORDED_MESSAGE, 'mood');
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

exports.notifyOnPingCreate = onDocumentCreated(
  {
    region: REGION,
    document: 'couples/{coupleId}/pings/{pingId}'
  },
  async (event) => {
    const pingData = event.data.data();
    const fromUid = pingData.fromUid;
    const createdAt = pingData.createdAt?.toDate?.();

    if (!fromUid || !createdAt) {
      await event.data.ref.delete().catch(() => {});
      return;
    }

    const { coupleId } = event.params;
    const { start, end } = getKstDayBoundsFromDate(createdAt);
    const sameDaySnapshot = await db
      .collection('couples')
      .doc(coupleId)
      .collection('pings')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(end))
      .get();

    const sameAuthorCount = sameDaySnapshot.docs.filter((doc) => doc.data().fromUid === fromUid).length;
    if (sameAuthorCount > 1) {
      await event.data.ref.delete().catch(() => {});
      logger.info('duplicate ping removed', { coupleId, fromUid });
      return;
    }

    const coupleRef = db.collection('couples').doc(coupleId);
    const coupleSnap = await coupleRef.get();
    if (!coupleSnap.exists) {
      return;
    }

    const targetEntries = getPartnerTokenEntries(coupleSnap.data(), [fromUid]);
    if (targetEntries.length === 0) {
      return;
    }

    await sendMessagesToTokenEntries(coupleRef, targetEntries, PING_MESSAGE, 'ping');
  }
);

exports.onCoupleUpdateForDeletion = onDocumentUpdated(
  {
    region: REGION,
    document: 'couples/{coupleId}'
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const { coupleId } = event.params;

    if (before.deletionStatus === after.deletionStatus) {
      return;
    }

    if (after.deletionStatus === 'requested') {
      const requestedByUid = after.deletionRequestedBy;
      const requestedAt = after.deletionRequestedAt?.toDate?.() ?? new Date();
      const scheduledAt = new Date(requestedAt.getTime() + 3 * DAY_MS);

      try {
        await event.data.after.ref.update({
          deletionStatus: 'scheduled',
          deletionScheduledAt: admin.firestore.Timestamp.fromDate(scheduledAt)
        });
      } catch (error) {
        logger.error('Failed to set scheduledAt', { coupleId, error: error.message });
      }

      const coupleSnap = await db.collection('couples').doc(coupleId).get();
      if (coupleSnap.exists) {
        const partnerEntries = getPartnerTokenEntries(coupleSnap.data(), [requestedByUid]);
        if (partnerEntries.length > 0) {
          await sendMessagesToTokenEntries(
            coupleSnap.ref,
            partnerEntries,
            DELETION_NOTICE_MESSAGE,
            'deletion'
          );
        }
      }

      try {
        await admin.auth().deleteUser(requestedByUid);
      } catch (error) {
        logger.warn('Requestor auth delete failed', {
          requestedByUid,
          code: error.code
        });
      }

      return;
    }

    if (after.deletionStatus === 'delete_now') {
      const members = Array.isArray(after.members) ? after.members : [];
      const requestedBy = after.deletionRequestedBy;
      const remaining = members.filter((uid) => uid !== requestedBy);
      await purgeCouple(coupleId, remaining);
    }
  }
);

exports.dailyCleanup = onSchedule(
  {
    region: REGION,
    schedule: '0 4 * * *',
    timeZone: 'Asia/Seoul'
  },
  async () => {
    const now = new Date();
    const couplesSnap = await db.collection('couples').get();

    for (const coupleDoc of couplesSnap.docs) {
      const data = coupleDoc.data();
      const coupleId = coupleDoc.id;

      if (data.deletionStatus === 'scheduled') {
        const scheduledAt = data.deletionScheduledAt?.toDate?.();
        if (scheduledAt && scheduledAt <= now) {
          const members = Array.isArray(data.members) ? data.members : [];
          const remaining = members.filter((uid) => uid !== data.deletionRequestedBy);
          await purgeCouple(coupleId, remaining);
        }
        continue;
      }

      if (!data.deletionStatus && Array.isArray(data.members) && data.members.length === 1) {
        const createdAt = data.createdAt?.toDate?.();
        if (createdAt && now.getTime() - createdAt.getTime() >= 4 * DAY_MS) {
          await purgeCouple(coupleId, data.members);
        }
      }
    }

    logger.info('dailyCleanup complete');
  }
);

exports.notifyMoodReminder1250 = onSchedule(
  {
    region: REGION,
    schedule: '50 12 * * *',
    timeZone: 'Asia/Seoul'
  },
  async () => {
    const sentCount = await sendMoodReminders(MOOD_REMINDER_1250);
    logger.info('notifyMoodReminder1250 complete', { sentCount });
  }
);

exports.notifyMoodReminder2320 = onSchedule(
  {
    region: REGION,
    schedule: '20 23 * * *',
    timeZone: 'Asia/Seoul'
  },
  async () => {
    const sentCount = await sendMoodReminders(MOOD_REMINDER_2320);
    logger.info('notifyMoodReminder2320 complete', { sentCount });
  }
);

async function sendMoodReminders(notification) {
  const couplesSnapshot = await db.collection('couples').get();
  const todayKey = getKstDateKey(new Date());
  let sentCount = 0;

  for (const coupleDoc of couplesSnapshot.docs) {
    const coupleData = coupleDoc.data();
    const members = Array.isArray(coupleData.members) ? coupleData.members : [];
    if (members.length === 0) {
      continue;
    }

    const moodSnap = await coupleDoc.ref.collection('moods').doc(todayKey).get();
    const moodData = moodSnap.exists ? moodSnap.data() : {};

    const tokens = coupleData.fcmTokens || {};
    const unrecordedEntries = members
      .filter((uid) => !moodData[uid])
      .map((uid) => ({ uid, token: tokens[uid] }))
      .filter(({ token }) => typeof token === 'string' && token.trim().length > 0);

    if (unrecordedEntries.length === 0) {
      continue;
    }

    sentCount += await sendMessagesToTokenEntries(
      coupleDoc.ref,
      unrecordedEntries,
      notification,
      'mood-reminder'
    );
  }

  return sentCount;
}

async function sendMessagesToTokenEntries(coupleRef, tokenEntries, notification, kind) {
  if (tokenEntries.length === 0) {
    return 0;
  }

  const notificationPayload = buildNotificationPayload(notification);
  const messages = tokenEntries.map(({ token }) => ({
    token,
    notification: notificationPayload,
    data: {
      type: kind,
      link: '/'
    },
    webpush: {
      headers: {
        Urgency: 'high'
      },
      notification: {
        ...notificationPayload,
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

async function purgeCouple(coupleId, memberUids) {
  logger.info('purgeCouple start', { coupleId, memberUids });

  try {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: `couples/${coupleId}/` });
    await Promise.allSettled(files.map((file) => file.delete()));
    logger.info('Storage purged', { coupleId, count: files.length });
  } catch (error) {
    logger.error('Storage purge failed', { coupleId, error: error.message });
  }

  try {
    const codesSnapshot = await db.collection('pairingCodes').where('coupleId', '==', coupleId).get();
    await Promise.allSettled(codesSnapshot.docs.map((doc) => doc.ref.delete()));
  } catch (error) {
    logger.error('PairingCodes purge failed', { coupleId, error: error.message });
  }

  await Promise.allSettled(
    memberUids.map((uid) =>
      db.collection('users').doc(uid).delete().catch((error) => {
        logger.warn('User doc delete failed', { uid, error: error.message });
      })
    )
  );

  try {
    await db.recursiveDelete(db.collection('couples').doc(coupleId));
    logger.info('Couple recursive delete done', { coupleId });
  } catch (error) {
    logger.error('Couple recursive delete failed', { coupleId, error: error.message });
  }

  await Promise.allSettled(
    memberUids.map((uid) =>
      admin.auth().deleteUser(uid).catch((error) => {
        logger.warn('Auth delete failed', { uid, code: error.code });
      })
    )
  );

  logger.info('purgeCouple complete', { coupleId });
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

function getKstDayBoundsFromDate(date) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  const startMs =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - KST_OFFSET_MS;

  return {
    start: new Date(startMs),
    end: new Date(startMs + DAY_MS)
  };
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
  if (repeatEvery === '100days') {
    if (baseDate > todayDate) {
      return baseDate;
    }

    const daysElapsed = Math.floor((todayDate.getTime() - baseDate.getTime()) / DAY_MS);
    const cyclesPassed = Math.floor(daysElapsed / 100) + 1;
    return addDays(baseDate, cyclesPassed * 100);
  }

  if (repeatEvery === 'yearly') {
    return getNextYearlyOccurrenceDate(baseDate, todayDate);
  }

  return baseDate;
}

function getNextYearlyOccurrenceDate(baseDate, todayDate) {
  const year = todayDate.getUTCFullYear();
  let candidate = createUtcYearlyOccurrence(baseDate, year);

  if (candidate < todayDate) {
    candidate = createUtcYearlyOccurrence(baseDate, year + 1);
  }

  return candidate;
}

function createUtcYearlyOccurrence(baseDate, year) {
  const month = baseDate.getUTCMonth();
  const day = baseDate.getUTCDate();
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfMonth)));
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffDays(targetDate, baseDate) {
  return Math.round((targetDate.getTime() - baseDate.getTime()) / DAY_MS);
}

function buildNotificationPayload(notification) {
  const payload = {};

  if (typeof notification.title === 'string' && notification.title.trim().length > 0) {
    payload.title = notification.title;
  }

  if (typeof notification.body === 'string' && notification.body.trim().length > 0) {
    payload.body = notification.body;
  }

  return payload;
}
