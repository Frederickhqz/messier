'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CleanService, Property, UserProfile } from '@/types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid } from 'lucide-react';
import Link from 'next/link';

type ViewMode = 'month' | 'week' | 'day';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  inProgress: 'bg-blue-500',
  completed: 'bg-green-500'
};

export default function CalendarPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const router = useRouter();
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();

  const [services, setServices] = useState<CleanService[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [cleanerFilter, setCleanerFilter] = useState<string>('all');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}`);
    }
  }, [user, authLoading, router, locale]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
      setServices(servicesData);

      // Load properties
      const propertiesSnap = await getDocs(collection(db, 'properties'));
      const propertiesData = propertiesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Property[];
      setProperties(propertiesData);

      // Load users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = usersSnap.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(usersData);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter services
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      if (propertyFilter !== 'all' && service.propertyId !== propertyFilter) return false;
      if (cleanerFilter !== 'all' && !service.assignedCleaners.includes(cleanerFilter)) return false;
      // Non-admins only see their assigned services
      if (!isAdmin && !service.assignedCleaners.includes(user?.uid || '')) return false;
      return true;
    });
  }, [services, propertyFilter, cleanerFilter, isAdmin, user]);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getServicesForDate = (date: Date) => {
    return filteredServices.filter(service => {
      const serviceDate = new Date(service.date);
      return serviceDate.toDateString() === date.toDateString();
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const today = new Date();
  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{t('calendar.title')}</h1>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition ${
                viewMode === 'month' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Grid className="w-4 h-4" />
              {t('calendar.month')}
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition ${
                viewMode === 'week' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {t('calendar.week')}
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition ${
                viewMode === 'day' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {t('calendar.day')}
            </button>
          </div>
        </div>

        {/* Filters */}
        {(isAdmin || cleanerFilter === 'all') && (
          <div className="flex flex-wrap gap-4">
            {isAdmin && (
              <>
                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">{t('common.all')} {t('property.title').toLowerCase()}</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <select
                  value={cleanerFilter}
                  onChange={(e) => setCleanerFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">{t('common.all')} cleaners</option>
                  {users.filter(u => u.active).map(u => (
                    <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                  ))}
                </select>
              </>
            )}

            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              {t('calendar.today')}
            </button>
          </div>
        )}

        {/* Month View */}
        {viewMode === 'month' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Month Navigation */}
            <div className="flex items-center justify-between p-4 border-b">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold">{formatMonthYear(currentDate)}</h2>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {/* Weekday Headers */}
              {weekDays.map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 border-b">
                  {day}
                </div>
              ))}

              {/* Empty cells for days before first of month */}
              {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, i) => (
                <div key={`empty-${i}`} className="h-24 border-b border-r bg-gray-50" />
              ))}

              {/* Days of month */}
              {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
                const dayServices = getServicesForDate(date);
                const isCurrentDay = isToday(date);

                return (
                  <div
                    key={i}
                    className={`h-24 border-b border-r p-1 ${
                      isCurrentDay ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className={`text-sm font-medium ${isCurrentDay ? 'text-primary-600' : 'text-gray-900'}`}>
                      {i + 1}
                    </div>
                    <div className="mt-1 space-y-1 overflow-y-auto max-h-16">
                      {dayServices.slice(0, 3).map(service => (
                        <Link
                          key={service.id}
                          href={`/${locale}/services/${service.id}`}
                          className={`block text-xs p-1 rounded truncate text-white ${statusColors[service.status]}`}
                        >
                          {service.propertyName}
                        </Link>
                      ))}
                      {dayServices.length > 3 && (
                        <div className="text-xs text-gray-500 pl-1">
                          +{dayServices.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Week Navigation */}
            <div className="flex items-center justify-between p-4 border-b">
              <button
                onClick={() => navigateWeek(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold">
                {formatDate(getWeekDays(currentDate)[0])} - {formatDate(getWeekDays(currentDate)[6])}
              </h2>
              <button
                onClick={() => navigateWeek(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Week Grid */}
            <div className="grid grid-cols-7">
              {getWeekDays(currentDate).map((date, i) => {
                const dayServices = getServicesForDate(date);
                const isCurrentDay = isToday(date);

                return (
                  <div key={i} className={`min-h-[300px] border-r last:border-r-0 ${isCurrentDay ? 'bg-primary-50' : ''}`}>
                    <div className={`p-2 text-center border-b ${isCurrentDay ? 'bg-primary-100 text-primary-700' : 'bg-gray-50'}`}>
                      <div className="text-sm font-medium">{weekDays[i]}</div>
                      <div className={`text-lg font-bold ${isCurrentDay ? 'text-primary-600' : ''}`}>
                        {date.getDate()}
                      </div>
                    </div>
                    <div className="p-2 space-y-2">
                      {dayServices.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-4">
                          -
                        </div>
                      ) : (
                        dayServices.map(service => (
                          <Link
                            key={service.id}
                            href={`/${locale}/services/${service.id}`}
                            className="block p-2 bg-white rounded-lg border hover:shadow-md transition"
                          >
                            <div className="font-medium text-sm truncate">{service.propertyName}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`w-2 h-2 rounded-full ${statusColors[service.status]}`} />
                              <span className="text-xs text-gray-500">
                                {t(`service.${service.status}`)}
                              </span>
                            </div>
                            {service.assignedCleaners.length > 0 && (
                              <div className="text-xs text-gray-400 mt-1">
                                {service.assignedCleaners.length} cleaner{service.assignedCleaners.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day View */}
        {viewMode === 'day' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Day Navigation */}
            <div className="flex items-center justify-between p-4 border-b">
              <button
                onClick={() => navigateDay(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold">
                {currentDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
                {isToday(currentDate) && <span className="ml-2 text-primary-600 text-sm">(Today)</span>}
              </h2>
              <button
                onClick={() => navigateDay(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day Services */}
            <div className="p-4">
              {getServicesForDate(currentDate).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{t('service.noServices')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getServicesForDate(currentDate).map(service => (
                    <Link
                      key={service.id}
                      href={`/${locale}/services/${service.id}`}
                      className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{service.propertyName}</h3>
                          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              service.status === 'completed' ? 'bg-green-100 text-green-800' :
                              service.status === 'inProgress' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {t(`service.${service.status}`)}
                            </span>
                            {service.assignedCleaners.length > 0 && (
                              <span>{service.assignedCleaners.length} cleaner{service.assignedCleaners.length > 1 ? 's' : ''}</span>
                            )}
                          </div>
                          {service.notes && (
                            <p className="mt-2 text-sm text-gray-600">{service.notes}</p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}