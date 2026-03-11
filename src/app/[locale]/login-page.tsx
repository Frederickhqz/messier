'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations();
  const { signIn, signUp, user, profile, loading } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        if (!displayName.trim()) {
          setError('Name is required');
          setSubmitting(false);
          return;
        }
        await signUp(email, password, displayName);
      }
      router.push(`/${locale}/dashboard`);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (user && profile) {
    router.push(`/${locale}/dashboard`);
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-xl">
        <div className="text-center">
          {/* Logo */}
          <div className="mx-auto w-16 h-16 mb-4">
            <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="512" height="512" rx="108" fill="#0ea5e9"/>
              <path d="M256 110L115 220V370C115 385.464 127.536 398 143 398H210V295C210 284.507 218.507 276 229 276H283C293.493 276 302 284.507 302 295V398H369C384.464 398 397 385.464 397 370V220L256 110Z" fill="white"/>
              <rect x="227" y="302" width="58" height="96" rx="6" fill="#0ea5e9"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Messier</h1>
          <p className="mt-2 text-gray-600">Property Housekeeping</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                  placeholder="Your name"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.email')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                placeholder="email@example.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.password')}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting 
              ? t('auth.loggingIn') 
              : isLogin 
                ? t('auth.login') 
                : t('auth.signUp')}
          </button>

          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary-600 hover:text-primary-700"
            >
              {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}