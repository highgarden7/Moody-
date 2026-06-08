import { deleteToken, getToken, onMessage } from 'firebase/messaging';
import { useEffect, useMemo, useState } from 'react';
import { getMessagingInstance, vapidKey } from '../firebase';
import { buildGenericPushMessage } from '../lib/pushMessage';
import { removeFcmToken, saveFcmToken } from './useCoupleData';

function isIos() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function getTokenOptions() {
  const options = { vapidKey };

  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration) {
        options.serviceWorkerRegistration = registration;
      }
    } catch {
      // 등록을 못 가져오면 FCM 기본 동작으로 진행한다.
    }
  }

  return options;
}

function getSupportState() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return {
      supported: false,
      reason: '이 기기에서는 웹 알림을 지원하지 않아.'
    };
  }

  if (!vapidKey) {
    return {
      supported: false,
      reason: '알림 설정이 아직 준비되지 않았어.'
    };
  }

  if (isIos() && !isStandaloneMode()) {
    return {
      supported: false,
      reason: 'iPhone에서는 홈 화면에 추가한 앱에서만 알림을 켤 수 있어.'
    };
  }

  return {
    supported: true,
    reason: ''
  };
}

export function usePushNotifications({ coupleId, uid, toast }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  const support = useMemo(() => getSupportState(), []);

  useEffect(() => {
    let unsub = () => {};
    let active = true;

    async function bindForegroundListener() {
      const messaging = await getMessagingInstance();
      if (!active || !messaging) {
        return;
      }

      unsub = onMessage(messaging, (payload) => {
        const message = buildGenericPushMessage({
          title: payload?.notification?.title,
          body: payload?.notification?.body,
          ...(payload?.data || {})
        });
        toast(message.body);
      });
    }

    if (support.supported) {
      bindForegroundListener();
    }

    return () => {
      active = false;
      unsub();
    };
  }, [support.supported, toast]);

  useEffect(() => {
    if (!coupleId || !uid || !support.supported) {
      setEnabled(false);
      return;
    }

    if (Notification.permission !== 'granted') {
      setPermission(Notification.permission);
      setEnabled(false);
      return;
    }

    let active = true;

    async function syncToken() {
      const messaging = await getMessagingInstance();
      if (!active || !messaging) {
        setEnabled(false);
        return;
      }

      try {
        const token = await getToken(messaging, await getTokenOptions());
        if (!active) {
          return;
        }

        if (!token) {
          setEnabled(false);
          return;
        }

        await saveFcmToken(coupleId, uid, token);
        if (active) {
          setEnabled(true);
          setPermission('granted');
        }
      } catch {
        if (active) {
          setEnabled(false);
        }
      }
    }

    syncToken();

    return () => {
      active = false;
    };
  }, [coupleId, support.supported, uid]);

  async function enableNotifications() {
    if (!support.supported || !coupleId || !uid || busy) {
      return;
    }

    setBusy(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        setEnabled(false);
        toast('알림 권한을 허용해야 켤 수 있어.');
        return;
      }

      const messaging = await getMessagingInstance();
      if (!messaging) {
        toast('이 환경에서는 알림을 켤 수 없어.');
        return;
      }

      const token = await getToken(messaging, await getTokenOptions());
      if (!token) {
        toast('알림 토큰을 받지 못했어.');
        return;
      }

      await saveFcmToken(coupleId, uid, token);
      setEnabled(true);
      toast('알림을 켰어.');
    } catch (error) {
      console.error('[push] enable failed', error);
      const detail = error?.code || error?.message || String(error);
      toast(`알림 오류: ${detail}`);
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    if (!coupleId || !uid || busy) {
      return;
    }

    setBusy(true);
    try {
      const messaging = await getMessagingInstance();
      if (messaging) {
        await deleteToken(messaging).catch(() => {});
      }

      await removeFcmToken(coupleId, uid);
      setEnabled(false);
      toast('알림을 껐어.');
    } catch {
      toast('알림 해제 중 오류가 났어.');
    } finally {
      setBusy(false);
    }
  }

  return {
    enabled,
    busy,
    permission,
    supported: support.supported,
    reason: support.reason,
    enableNotifications,
    disableNotifications
  };
}
