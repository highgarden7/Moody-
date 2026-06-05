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

let controllerChangeBound = false;

// 서버에 새 버전(서비스워커)이 있는지 확인하고, 있으면 적용한다.
// sw.js가 skipWaiting + clientsClaim을 하므로 새 SW가 곧바로 활성화되며
// controllerchange가 발생하면 한 번만 리로드해 최신 화면으로 갱신한다.
// 새 버전이 없으면 아무 일도 하지 않는다(리로드 없음).
export async function checkAndApplyAppUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  const sw = navigator.serviceWorker;

  if (!controllerChangeBound) {
    controllerChangeBound = true;
    let reloaded = false;
    sw.addEventListener('controllerchange', () => {
      if (reloaded) {
        return;
      }
      reloaded = true;
      window.location.reload();
    });
  }

  try {
    const registration = await sw.getRegistration();
    if (!registration) {
      return false;
    }

    await registration.update();

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    return Boolean(registration.installing || registration.waiting);
  } catch {
    return false;
  }
}
