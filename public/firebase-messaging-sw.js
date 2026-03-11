// Firebase Cloud Messaging Service Worker
// This file handles background push notifications

import { getMessagingInstance } from '@/lib/firebase';

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY,
  authDomain: self.FIREBASE_AUTH_DOMAIN,
  projectId: self.FIREBASE_PROJECT_ID,
  storageBucket: self.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID,
  appId: self.FIREBASE_APP_ID,
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Messier';
  const notificationBody = payload.notification?.body || 'You have a new update';
  const notificationIcon = payload.notification?.icon || '/icon.svg';
  const notificationBadge = payload.notification?.badge || '/icon.svg';

  const notificationOptions: NotificationOptions = {
    body: notificationBody,
    icon: notificationIcon,
    badge: notificationBadge,
    data: payload.data || {},
    tag: payload.data?.tag || 'messier-notification',
    requireInteraction: payload.data?.requireInteraction === 'true',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const clickAction = event.notification.data?.clickAction || '/';
  const urlToOpen = new URL(clickAction, self.location.origin).href;

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if not
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});