'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface OfflineContextType {
  isOnline: boolean;
  pendingActions: number;
  lastSync: Date | null;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setLastSync(new Date());
      
      // Notify user they're back online
      if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        new Notification('Back Online', {
          body: 'Your changes are now syncing.',
          icon: '/icon-192.png'
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      
      // Notify user they're offline
      if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        new Notification('Offline Mode', {
          body: 'Changes will sync when you\'re back online.',
          icon: '/icon-192.png'
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingActions, lastSync }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}