'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CleanService, Photo, Issue, UserProfile } from '@/types';
import { Calendar, Users, MapPin, Clock, Camera, AlertTriangle, Play, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ServiceDetailPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const serviceId = params.id as string;
  const router = useRouter();
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();

  const [service, setService] = useState<CleanService | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isAssigned = service?.assignedCleaners.includes(user?.uid || '');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}`);
    }
  }, [user, authLoading, router, locale]);

  useEffect(() => {
    loadService();
  }, [serviceId]);

  const loadService = async () => {
    try {
      // Load service
      const serviceDoc = await getDoc(doc(db, 'cleanServices', serviceId));
      if (!serviceDoc.exists()) {
        router.push(`/${locale}/services`);
        return;
      }
      const serviceData = {
        id: serviceDoc.id,
        ...serviceDoc.data(),
        date: serviceDoc.data().date?.toDate(),
        createdAt: serviceDoc.data().createdAt?.toDate(),
        clockIn: serviceDoc.data().clockIn?.toDate(),
        clockOut: serviceDoc.data().clockOut?.toDate()
      } as CleanService;
      setService(serviceData);

      // Load assigned users
      if (serviceData.assignedCleaners.length > 0) {
        const usersSnap = await getDocs(
          query(collection(db, 'users'), where('uid', 'in', serviceData.assignedCleaners))
        );
        const usersData = usersSnap.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as UserProfile[];
        setAssignedUsers(usersData);
      }

      // Load photos
      const photosSnap = await getDocs(
        query(collection(db, 'photos'), where('serviceId', '==', serviceId))
      );
      const photosData = photosSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt?.toDate()
      })) as Photo[];
      setPhotos(photosData);

      // Load issues
      const issuesSnap = await getDocs(
        query(collection(db, 'issues'), where('serviceId', '==', serviceId))
      );
      const issuesData = issuesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        reportedAt: doc.data().reportedAt?.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate()
      })) as Issue[];
      setIssues(issuesData);

    } catch (error) {
      console.error('Error loading service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!service) return;
    setClockingIn(true);
    try {
      await updateDoc(doc(db, 'cleanServices', serviceId), {
        status: 'inProgress',
        clockIn: serverTimestamp()
      });
      loadService();
    } catch (error) {
      console.error('Error clocking in:', error);
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!service) return;
    setClockingIn(true);
    try {
      await updateDoc(doc(db, 'cleanServices', serviceId), {
        status: 'completed',
        clockOut: serverTimestamp()
      });
      loadService();
    } catch (error) {
      console.error('Error clocking out:', error);
    } finally {
      setClockingIn(false);
    }
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    inProgress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
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

  if (!service) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Link
          href={`/${locale}/services`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('common.back') || 'Back'}
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{service.propertyName}</h1>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[service.status]}`}>
                  {t(`service.${service.status}`)}
                </span>
              </div>
              
              <div className="mt-3 flex items-center gap-6 text-gray-500">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {service.date?.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>

            {/* Clock In/Out Buttons */}
            {(isAssigned || isAdmin) && service.status !== 'completed' && (
              <div className="flex gap-2">
                {service.status === 'pending' && (
                  <button
                    onClick={handleClockIn}
                    disabled={clockingIn}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Play className="w-5 h-5" />
                    {t('service.clockIn')}
                  </button>
                )}
                {service.status === 'inProgress' && (
                  <button
                    onClick={handleClockOut}
                    disabled={clockingIn}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {t('service.clockOut')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Time Info */}
          {(service.clockIn || service.clockOut) && (
            <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
              {service.clockIn && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Clock in: {service.clockIn.toLocaleTimeString()}</span>
                </div>
              )}
              {service.clockOut && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Clock out: {service.clockOut.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Assigned Team */}
        {assignedUsers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('service.assignedTo')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {assignedUsers.map(user => (
                <div
                  key={user.uid}
                  className="px-3 py-2 bg-gray-100 rounded-lg text-sm"
                >
                  {user.displayName || user.email}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {service.notes && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
            <p className="text-gray-600">{service.notes}</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Walkthrough - Primary action for assigned cleaners */}
          {(isAssigned || isAdmin) && service.status !== 'completed' && (
            <Link
              href={`/${locale}/services/${serviceId}/walkthrough`}
              className="bg-primary-600 rounded-xl shadow-sm p-6 hover:bg-primary-700 transition flex items-center gap-4"
            >
              <div className="p-3 bg-white/20 rounded-lg">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div className="text-white">
                <h3 className="font-semibold">Photo Walkthrough</h3>
                <p className="text-sm opacity-90">Take step-by-step photos</p>
              </div>
            </Link>
          )}

          <Link
            href={`/${locale}/services/${serviceId}/photos`}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition flex items-center gap-4"
          >
            <div className="p-3 bg-primary-100 rounded-lg">
              <Camera className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t('photo.title')}</h3>
              <p className="text-sm text-gray-500">{photos.length} photos</p>
            </div>
          </Link>

          <Link
            href={`/${locale}/services/${serviceId}/issues`}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition flex items-center gap-4"
          >
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t('issue.title')}</h3>
              <p className="text-sm text-gray-500">{issues.filter(i => !i.resolved).length} open</p>
            </div>
          </Link>
        </div>

        {/* Photos Preview */}
        {photos.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('photo.title')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.slice(0, 4).map(photo => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={photo.url}
                    alt={photo.roomType}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            {photos.length > 4 && (
              <Link
                href={`/${locale}/services/${serviceId}/photos`}
                className="mt-4 inline-block text-primary-600 hover:text-primary-700"
              >
                View all {photos.length} photos →
              </Link>
            )}
          </div>
        )}

        {/* Issues Preview */}
        {issues.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('issue.title')}</h2>
            <div className="space-y-3">
              {issues.slice(0, 3).map(issue => (
                <div
                  key={issue.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <span className="font-medium">{t(`issue.type.${issue.type}`)}</span>
                    <p className="text-sm text-gray-500">{issue.description}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    issue.resolved 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {issue.resolved ? 'Resolved' : 'Open'}
                  </span>
                </div>
              ))}
            </div>
            {issues.length > 3 && (
              <Link
                href={`/${locale}/services/${serviceId}/issues`}
                className="mt-4 inline-block text-primary-600 hover:text-primary-700"
              >
                View all {issues.length} issues →
              </Link>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}