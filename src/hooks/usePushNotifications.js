import { deleteToken, getToken, onMessage } from 'firebase/messaging';
import { useEffect, useMemo, useState } from 'react';
import { auth, getMessagingInstance, vapidKey } from '../firebase';
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
        console.debug('[push] SW registration found:', registration.scope);
      }
    } catch (error) {
      console.warn('[push] SW ready failed:', error);
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
      console.debug('[push] syncToken start — uid:', uid, 'coupleId:', coupleId);
      const messaging = await getMessagingInstance();
      if (!active || !messaging) {
        console.debug('[push] syncToken skip — messaging unavailable or unmounted');
        setEnabled(false);
        return;
      }

      try {
        const token = await getToken(messaging, await getTokenOptions());
        if (!active) {
          return;
        }

        if (!token) {
          console.warn('[push] syncToken — getToken returned empty');
          setEnabled(false);
          return;
        }

        console.debug('[push] syncToken — saving token, auth uid:', auth.currentUser?.uid);
        await saveFcmToken(coupleId, uid, token);
        if (active) {
          console.debug('[push] syncToken success');
          setEnabled(true);
          setPermission('granted');
        }
      } catch (error) {
        console.error('[push] syncToken failed — code:', error?.code, 'message:', error?.message, error);
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
      console.debug('[push] enableNotifications start — uid:', uid, 'coupleId:', coupleId);

      const nextPermission = await Notification.requestPermission();
      console.debug('[push] notification permission:', nextPermission);
      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        setEnabled(false);
        toast('알림 권한을 허용해야 켤 수 있어.');
        return;
      }

      const messaging = await getMessagingInstance();
      if (!messaging) {
        console.warn('[push] messaging instance unavailable');
        toast('이 환경에서는 알림을 켤 수 없어.');
        return;
      }

      const token = await getToken(messaging, await getTokenOptions());
      console.debug('[push] getToken result:', token ? `${token.slice(0, 20)}...` : 'empty');
      if (!token) {
        toast('알림 토큰을 받지 못했어.');
        return;
      }

      const currentUser = auth.currentUser;
      console.debug('[push] auth.currentUser uid:', currentUser?.uid, '/ hook uid:', uid);
      if (!currentUser) {
        console.error('[push] auth.currentUser is null — session expired');
        toast('세션이 만료됐어. 다시 로그인해줘.');
        return;
      }

      await saveFcmToken(coupleId, uid, token);
      console.debug('[push] saveFcmToken success');
      setEnabled(true);
      toast('알림을 켰어.');
    } catch (error) {
      console.error('[push] enable failed — code:', error?.code, 'message:', error?.message, error);
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
