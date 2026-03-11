// useNotifications Hook - Manage push notification preferences
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  requestNotificationPermission,
  onForegroundMessage,
  showLocalNotification,
  getNotificationStatus,
} from './notifications';

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  newService: boolean;
  serviceUpdate: boolean;
  newIssue: boolean;
  issueUpdate: boolean;
  teamInvite: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  pushEnabled: false,
  emailEnabled: true,
  newService: true,
  serviceUpdate: true,
  newIssue: true,
  issueUpdate: true,
  teamInvite: true,
};

export function useNotifications() {
  const { user, profile } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  // Load settings from Firestore
  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'settings', 'notifications');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() });
        }

        // Check notification permission status
        if (typeof window !== 'undefined' && 'Notification' in window) {
          setPermissionStatus(Notification.permission);
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Subscribe to foreground messages
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('Foreground message:', payload);

      if (payload.notification) {
        showLocalNotification({
          title: payload.notification.title || 'Messier',
          body: payload.notification.body || '',
          data: payload.data as Record<string, string>,
        });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Enable push notifications
  const enablePush = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const token = await requestNotificationPermission();
      if (!token) {
        return false;
      }

      setFcmToken(token);
      setPermissionStatus('granted');

      // Save token to Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        fcmToken: token,
        updatedAt: new Date(),
      });

      // Update settings
      await updateSettings({ pushEnabled: true });

      return true;
    } catch (error) {
      console.error('Error enabling push notifications:', error);
      return false;
    }
  }, [user]);

  // Disable push notifications
  const disablePush = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      // Remove token from Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        fcmToken: null,
        updatedAt: new Date(),
      });

      setFcmToken(null);
      await updateSettings({ pushEnabled: false });

      return true;
    } catch (error) {
      console.error('Error disabling push notifications:', error);
      return false;
    }
  }, [user]);

  // Update settings
  const updateSettings = useCallback(
    async (updates: Partial<NotificationSettings>): Promise<boolean> => {
      if (!user) return false;

      try {
        const docRef = doc(db, 'users', user.uid, 'settings', 'notifications');
        const newSettings = { ...settings, ...updates };

        await setDoc(docRef, newSettings, { merge: true });
        setSettings(newSettings);

        return true;
      } catch (error) {
        console.error('Error updating notification settings:', error);
        return false;
      }
    },
    [user, settings]
  );

  return {
    settings,
    fcmToken,
    loading,
    permissionStatus,
    enablePush,
    disablePush,
    updateSettings,
  };
}