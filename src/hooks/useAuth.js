import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth, firebaseConfigReady } from '../firebase';
import {
  getLocalSessionUser,
  localDemoLogin,
  localLogOut,
  localSignIn,
  localSignUp,
  subscribeLocalStore
} from '../lib/localStore';

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

export async function signUp(email, password) {
  if (!auth) {
    await localSignUp(email, password);
    return;
  }

  await createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email, password) {
  if (!auth) {
    await localSignIn(email, password);
    return;
  }

  await signInWithEmailAndPassword(auth, email, password);
}

export async function logOut() {
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
