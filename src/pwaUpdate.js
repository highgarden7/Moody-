import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

const listeners = new Set();

const state = {
  needRefresh: false,
  updateSW: null
};

let initialized = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(nextState) {
  Object.assign(state, nextState);
  emit();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function initPwaUpdate() {
  if (initialized || typeof window === 'undefined') {
    return;
  }

  initialized = true;

  let updateSW = () => Promise.resolve();

  updateSW = registerSW({
    onNeedRefresh() {
      setState({
        needRefresh: true,
        updateSW
      });
    },
    onOfflineReady() {
      console.info('moody pwa ready offline');
    }
  });

  const checkForUpdate = () => {
    updateSW().catch(() => {});
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate();
    }
  });
}

export function usePwaUpdate() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
