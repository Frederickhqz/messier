// Push Notification Utilities - Firebase Cloud Messaging
import { getMessagingInstance } from './firebase';
import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';

// VAPID key for push notifications (generate in Firebase Console > Project Settings > Cloud Messaging)
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, string>;
  clickAction?: string;
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.log('Messaging not supported in this environment');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Get FCM token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
}

/**
 * Subscribe to foreground messages
 */
export function onForegroundMessage(callback: (payload: MessagePayload) => void): () => void {
  let unsubscribe: (() => void) | null = null;
  
  getMessagingInstance().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, callback);
    }
  });

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

/**
 * Show a local notification (for foreground messages)
 */
export function showLocalNotification(payload: NotificationPayload): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon.svg',
      badge: payload.badge || '/icon.svg',
      data: payload.data,
    });
  }
}

/**
 * Check if notifications are supported and permitted
 */
export function getNotificationStatus(): 'supported' | 'denied' | 'default' | 'granted' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'supported';
  }
  return Notification.permission;
}

/**
 * Check if push notifications are enabled for this device
 */
export async function isPushEnabled(): Promise<boolean> {
  const token = await requestNotificationPermission();
  return token !== null;
}