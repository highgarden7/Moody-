import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];

export const firebaseConfigReady = requiredKeys.every((key) => {
  const value = firebaseConfig[key];
  return typeof value === 'string' && value.trim().length > 0;
});

export const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY?.trim() || '';

let app = null;
let auth = null;
let db = null;
let storage = null;
let firebaseInitError = '';
let messagingInstance = null;

if (firebaseConfigReady) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    firebaseInitError = error instanceof Error ? error.message : 'Firebase init failed';
  }
} else {
  firebaseInitError = 'Firebase env is missing';
}

const messagingSupportPromise =
  app && typeof window !== 'undefined'
    ? isMessagingSupported().catch(() => false)
    : Promise.resolve(false);

export async function getMessagingInstance() {
  if (!app || typeof window === 'undefined') {
    return null;
  }

  const supported = await messagingSupportPromise;
  if (!supported) {
    return null;
  }

  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }

  return messagingInstance;
}

export { app, auth, db, storage, firebaseConfig, firebaseInitError, messagingSupportPromise };
