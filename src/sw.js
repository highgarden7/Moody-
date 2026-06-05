/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { buildGenericPushMessage } from './lib/pushMessage';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const navigationRoute = new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//]
});

registerRoute(navigationRoute);

const firebaseConfig = __SW_FIREBASE_CONFIG__;

const hasFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId
].every((value) => typeof value === 'string' && value.trim().length > 0);

if (hasFirebaseConfig) {
  self.importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js');
  self.importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js');

  self.firebase.initializeApp(firebaseConfig);

  const messaging = self.firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const message = buildGenericPushMessage(payload?.data || {});

    self.registration.showNotification(message.title, {
      body: message.body,
      icon: '/files/icon-192.png',
      badge: '/files/icon-192.png',
      data: {
        url: '/',
        kind: payload?.data?.kind || 'generic'
      }
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList[0];

      if (existingClient) {
        existingClient.focus();
        existingClient.navigate('/');
        return;
      }

      return self.clients.openWindow('/');
    })
  );
});
