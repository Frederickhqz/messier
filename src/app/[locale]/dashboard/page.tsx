'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CleanService, Property, UserProfile } from '@/types';
import { Calendar, Building2, Users, ClipboardList, Plus, Camera, AlertTriangle, Clock, CheckCircle, Play } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [services, setServices] = useState<CleanService[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}`);
    }
  }, [user, authLoading, router, locale]);

  useEffect(() => {
    loadData();
  }, [isAdmin, user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      // Load services
      const servicesQuery = query(
        collection(db, 'cleanServices'),
        orderBy('date', 'asc')
      );
      const servicesSnap = await getDocs(servicesQuery);
      const servicesData = servicesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      })) as CleanService[];

      // Filter for non-admins: only their assigned services
      const filteredServices = isAdmin 
        ? servicesData 
        : servicesData.filter(s => s.assignedCleaners.includes(user.uid));
      
      setServices(filteredServices);

      // Load properties (admin only)
      if (isAdmin) {
        const propertiesSnap = await getDocs(collection(db, 'properties'));
        const propertiesData = propertiesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        })) as Property[];
        setProperties(propertiesData.filter(p => p.active));

        // Load team
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersData = usersSnap.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as UserProfile[];
        setTeam(usersData.filter(u => u.active));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayServices = services.filter(s => {
    const serviceDate = new Date(s.date);
    serviceDate.setHours(0, 0, 0, 0);
    return serviceDate.getTime() === today.getTime();
  });

  const pendingServices = services.filter(s => s.status === 'pending');
  const inProgressServices = services.filter(s => s.status === 'inProgress');
  const completedServices = services.filter(s => s.status === 'completed');

  const upcomingServices = services.filter(s => {
    const serviceDate = new Date(s.date);
    return serviceDate >= today && s.status !== 'completed';
  }).slice(0, 5);

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    inProgress: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200'
  };

  const statusIcons = {
    pending: Clock,
    inProgress: Play,
    completed: CheckCircle
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl shadow-sm p-6 text-white">
          <h1 className="text-2xl font-bold">
            {t('dashboard.welcome', { name: profile?.displayName || 'User' })}
          </h1>
          <p className="opacity-90 mt-1">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href={`/${locale}/services?status=pending`}
            className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingServices.length}</p>
                <p className="text-sm text-gray-500">{t('service.pending')}</p>
              </div>
            </div>
          </Link>

          <Link
            href={`/${locale}/services?status=inProgress`}
            className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Play className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{inProgressServices.length}</p>
                <p className="text-sm text-gray-500">{t('service.inProgress')}</p>
              </div>
            </div>
          </Link>

          <Link
            href={`/${locale}/services?status=completed`}
            className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{completedServices.length}</p>
                <p className="text-sm text-gray-500">{t('service.completed')}</p>
              </div>
            </div>
          </Link>

          {isAdmin && (
            <Link
              href={`/${locale}/properties`}
              className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{properties.length}</p>
                  <p className="text-sm text-gray-500">{t('property.title')}</p>
                </div>
              </div>
            </Link>
          )}

          {!isAdmin && (
            <Link
              href={`/${locale}/calendar`}
              className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{todayServices.length}</p>
                  <p className="text-sm text-gray-500">{t('dashboard.todayServices')}</p>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Admin Stats */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-4">
            <Link
              href={`/${locale}/team`}
              className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{team.length}</p>
                  <p className="text-sm text-gray-500">{t('team.title')}</p>
                </div>
              </div>
            </Link>

            <Link
              href={`/${locale}/calendar`}
              className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{todayServices.length}</p>
                  <p className="text-sm text-gray-500">{t('dashboard.todayServices')}</p>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {isAdmin && (
              <Link
                href={`/${locale}/properties`}
                className="p-4 bg-primary-50 hover:bg-primary-100 rounded-lg text-primary-700 font-medium transition flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {t('property.add')}
              </Link>
            )}
            <Link
              href={`/${locale}/services`}
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-700 font-medium transition flex items-center gap-2"
            >
              <ClipboardList className="w-5 h-5" />
              {t('service.new')}
            </Link>
            <Link
              href={`/${locale}/calendar`}
              className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-orange-700 font-medium transition flex items-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              {t('calendar.title')}
            </Link>
            <Link
              href={`/${locale}/settings`}
              className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 font-medium transition flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              {t('nav.settings')}
            </Link>
          </div>
        </div>

        {/* Today's Services */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.todayServices')}</h2>
            <Link
              href={`/${locale}/calendar`}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View Calendar →
            </Link>
          </div>

          {todayServices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t('service.noServices')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayServices.map(service => {
                const StatusIcon = statusIcons[service.status];
                return (
                  <Link
                    key={service.id}
                    href={`/${locale}/services/${service.id}`}
                    className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{service.propertyName}</h3>
                        <p className="text-sm text-gray-500">
                          {service.assignedCleaners.length} cleaner{service.assignedCleaners.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[service.status]}`}>
                        {t(`service.${service.status}`)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Services */}
        {upcomingServices.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Services</h2>
              <Link
                href={`/${locale}/services`}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingServices.map(service => {
                const StatusIcon = statusIcons[service.status];
                return (
                  <Link
                    key={service.id}
                    href={`/${locale}/services/${service.id}`}
                    className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 rounded-lg">
                          <Calendar className="w-4 h-4 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{service.propertyName}</h3>
                          <p className="text-sm text-gray-500">
                            {service.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[service.status]}`}>
                        {t(`service.${service.status}`)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}