import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initPwaUpdate } from './pwaUpdate';
import './styles.css';

function ZoomGuard({ children }) {
  useEffect(() => {
    const preventGesture = (event) => event.preventDefault();
    let lastTouch = 0;

    const preventDoubleTap = (event) => {
      const now = Date.now();
      if (now - lastTouch <= 300) {
        event.preventDefault();
      }
      lastTouch = now;
    };

    document.addEventListener('gesturestart', preventGesture);
    document.addEventListener('gesturechange', preventGesture);
    document.addEventListener('gestureend', preventGesture);
    document.addEventListener('touchend', preventDoubleTap, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchend', preventDoubleTap);
    };
  }, []);

  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ZoomGuard>
        <App />
      </ZoomGuard>
    </ErrorBoundary>
  </React.StrictMode>
);

initPwaUpdate();
