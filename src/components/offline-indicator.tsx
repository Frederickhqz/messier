'use client';

import { useOffline } from '@/lib/offline-context';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineIndicator() {
  const { isOnline } = useOffline();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
      <div className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span className="text-sm font-medium">Offline Mode</span>
        <span className="text-xs opacity-90">Changes will sync when online</span>
      </div>
    </div>
  );
}

export function OnlineIndicator() {
  const { isOnline, lastSync } = useOffline();

  if (!isOnline) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <Wifi className="h-3 w-3 text-green-500" />
      {lastSync && (
        <span>Synced {lastSync.toLocaleTimeString()}</span>
      )}
    </div>
  );
}