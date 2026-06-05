/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const navigationRoute = new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//]
});

registerRoute(navigationRoute);

// FCM 백그라운드 수신. getToken()이 이 서비스워커를 찾으려면
// 메시징이 여기서 초기화되어 있어야 한다. 백엔드가 webpush.notification을
// 함께 보내므로 알림 표시/클릭은 FCM SDK가 자동으로 처리한다.
const swFirebaseConfig = __SW_FIREBASE_CONFIG__;

if (swFirebaseConfig && swFirebaseConfig.apiKey) {
  try {
    const firebaseApp = initializeApp(swFirebaseConfig);
    getMessaging(firebaseApp);
  } catch {
    // 이 환경에서 메시징을 못 쓰더라도 PWA 캐싱은 계속 동작한다.
  }
}
