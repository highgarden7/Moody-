import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      __SW_FIREBASE_CONFIG__: JSON.stringify({
        apiKey: env.VITE_FIREBASE_API_KEY || '',
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: env.VITE_FIREBASE_PROJECT_ID || '',
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: env.VITE_FIREBASE_APP_ID || ''
      })
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'prompt',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']
        },
        manifest: {
          name: 'moody',
          short_name: 'moody',
          description: '커플 둘만 쓰는 일정과 컨디션 캘린더',
          theme_color: '#FFC83D',
          background_color: '#FFF9EC',
          display: 'standalone',
          lang: 'ko',
          icons: [
            {
              src: '/files/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/files/icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: '/files/icon-maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/files/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    server: {
      host: true,
      port: 5173
    }
  };
});
