import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth, firebaseConfigReady } from '../firebase';
import {
  getLocalSessionUser,
  localDeleteUser,
  localDemoLogin,
  localLogOut,
  localSignIn,
  localSignUp,
  subscribeLocalStore
} from '../lib/localStore';
import { createPairingCode } from '../lib/pairing';
import { createCouple, joinCouple } from './useCoupleData';

const PENDING_SIGNUP_KEY = 'moody-pending-signup';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!firebaseConfigReady || !auth) {
      setUser(getLocalSessionUser());
      setReady(true);
      return subscribeLocalStore(() => {
        setUser(getLocalSessionUser());
        setReady(true);
      });
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setReady(true);
    });

    return unsubscribe;
  }, []);

  return { user, ready };
}

export function getPendingSignupContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(PENDING_SIGNUP_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingSignupContext() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(PENDING_SIGNUP_KEY);
}

function setPendingSignupContext(value) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(value));
}

export async function signUpFounder({ email, password, anniversary }) {
  const pairingCode = createPairingCode();

  if (!auth) {
    const localUser = await localSignUp(email, password);

    try {
      const coupleId = await createCouple({
        uid: localUser.uid,
        anniversary: new Date(`${anniversary}T00:00:00`),
        pairingCode
      });
      setPendingSignupContext({ uid: localUser.uid, coupleId, pairingCode, role: 'founder' });
      return { pairingCode, coupleId };
    } catch (error) {
      await localDeleteUser(localUser.uid);
      throw error;
    }
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);

  try {
    const coupleId = await createCouple({
      uid: credential.user.uid,
      anniversary: new Date(`${anniversary}T00:00:00`),
      pairingCode
    });
    setPendingSignupContext({ uid: credential.user.uid, coupleId, pairingCode, role: 'founder' });
    return { pairingCode, coupleId };
  } catch (error) {
    try {
      await deleteUser(credential.user);
    } catch {
      // keep original signup error
    }
    throw error;
  }
}

export async function signUpJoiner({ email, password, code }) {
  if (!auth) {
    const localUser = await localSignUp(email, password);

    try {
      const coupleId = await joinCouple({ uid: localUser.uid, code });
      setPendingSignupContext({ uid: localUser.uid, coupleId, role: 'joiner' });
      return { coupleId };
    } catch (error) {
      await localDeleteUser(localUser.uid);
      throw error;
    }
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);

  try {
    const coupleId = await joinCouple({ uid: credential.user.uid, code });
    setPendingSignupContext({ uid: credential.user.uid, coupleId, role: 'joiner' });
    return { coupleId };
  } catch (error) {
    try {
      await deleteUser(credential.user);
    } catch {
      // keep original join error
    }
    throw error;
  }
}

export async function signIn(email, password) {
  if (!auth) {
    await localSignIn(email, password);
    return;
  }

  await signInWithEmailAndPassword(auth, email, password);
}

export async function logOut() {
  clearPendingSignupContext();

  if (!auth) {
    await localLogOut();
    return;
  }

  await signOut(auth);
}

export async function signInDemo() {
  if (!auth) {
    await localDemoLogin();
    return;
  }

  throw new Error('테스트 로그인은 로컬 데모 모드에서만 사용할 수 있어.');
}
