import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setReady(true);
    });

    return unsubscribe;
  }, []);

  return { user, ready };
}

export async function signUp(email, password) {
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logOut() {
  await signOut(auth);
}
