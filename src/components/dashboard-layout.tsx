'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { OfflineIndicator } from '@/components/offline-indicator';
import { 
  Home, 
  Building2, 
  Calendar, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Globe,
  ClipboardList
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const t = useTranslations();
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const navItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: Home },
    { href: '/services', label: t('nav.services'), icon: ClipboardList },
    { href: '/properties', label: t('nav.properties'), icon: Building2, adminOnly: true },
    { href: '/team', label: t('nav.team'), icon: Users, adminOnly: true },
    { href: '/settings', label: t('nav.settings'), icon: Settings },
  ].filter(item => !item.adminOnly || isAdmin);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const changeLocale = (locale: string) => {
    const newPath = pathname.replace(/^\/[a-z]{2}/, `/${locale}`);
    router.push(newPath);
    setLangMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline indicator */}
      <OfflineIndicator />
      
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 512 512" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="512" height="512" rx="108" fill="#0ea5e9"/>
            <path d="M256 110L115 220V370C115 385.464 127.536 398 143 398H210V295C210 284.507 218.507 276 229 276H283C293.493 276 302 284.507 302 295V398H369C384.464 398 397 385.464 397 370V220L256 110Z" fill="white"/>
            <rect x="227" y="302" width="58" height="96" rx="6" fill="#0ea5e9"/>
          </svg>
          <span className="font-bold text-gray-900">Messier</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-xl transform transition-transform duration-300
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 512 512" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="512" height="512" rx="108" fill="#0ea5e9"/>
                <path d="M256 110L115 220V370C115 385.464 127.536 398 143 398H210V295C210 284.507 218.507 276 229 276H283C293.493 276 302 284.507 302 295V398H369C384.464 398 397 385.464 397 370V220L256 110Z" fill="white"/>
                <rect x="227" y="302" width="58" height="96" rx="6" fill="#0ea5e9"/>
              </svg>
              <span className="text-xl font-bold text-gray-900">Messier</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">{profile?.displayName || user?.email}</p>
          <span className="inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-700">
            {t(`roles.${profile?.role || 'member'}`)}
          </span>
        </div>

        <nav className="px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === `/${pathname.split('/')[1]}${item.href}`;
            
            return (
              <Link
                key={item.href}
                href={`/${pathname.split('/')[1]}${item.href}`}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition
                  ${isActive 
                    ? 'bg-primary-50 text-primary-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-50'}
                `}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Language selector */}
          <div className="relative">
            <button 
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg transition"
            >
              <Globe className="w-5 h-5" />
              Language
            </button>
            
            {langMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border overflow-hidden">
                <button 
                  onClick={() => changeLocale('en')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition"
                >
                  English
                </button>
                <button 
                  onClick={() => changeLocale('es')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition"
                >
                  Español
                </button>
                <button 
                  onClick={() => changeLocale('pt')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition"
                >
                  Português
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            {t('auth.signOut')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}