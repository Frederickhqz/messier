'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';

export default function DashboardPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const t = useTranslations();
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}`);
    }
  }, [user, loading, router, locale]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('dashboard.welcome', { name: profile?.displayName || 'User' })}
          </h1>
          <p className="text-gray-600 mt-1">
            {isAdmin ? 'Admin Dashboard' : 'Member Dashboard'}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-primary-600">0</div>
            <div className="text-gray-600 text-sm">{t('dashboard.todayServices')}</div>
          </div>
          
          {isAdmin && (
            <>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="text-3xl font-bold text-primary-600">8</div>
                <div className="text-gray-600 text-sm">{t('dashboard.allProperties')}</div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="text-3xl font-bold text-primary-600">10</div>
                <div className="text-gray-600 text-sm">{t('team.title')}</div>
              </div>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {isAdmin && (
              <button className="p-4 bg-primary-50 hover:bg-primary-100 rounded-lg text-primary-700 font-medium transition">
                + {t('property.add')}
              </button>
            )}
            <button className="p-4 bg-primary-50 hover:bg-primary-100 rounded-lg text-primary-700 font-medium transition">
              + {t('service.new')}
            </button>
            <button className="p-4 bg-primary-50 hover:bg-primary-100 rounded-lg text-primary-700 font-medium transition">
              {t('photo.upload')}
            </button>
            <button className="p-4 bg-primary-50 hover:bg-primary-100 rounded-lg text-primary-700 font-medium transition">
              {t('issue.report')}
            </button>
          </div>
        </div>

        {/* Today's Services Placeholder */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.todayServices')}</h2>
          <div className="text-gray-500 text-center py-8">
            {t('service.noServices')}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}