import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
});
