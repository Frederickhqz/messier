'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, CleanService, UserProfile } from '@/types';
import { Plus, Calendar, Users, MapPin, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';

type ServiceStatus = 'pending' | 'inProgress' | 'completed';

const statusColors: Record<ServiceStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  inProgress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800'
};

export default function ServicesPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const router = useRouter();
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();
  
  const [services, setServices] = useState<CleanService[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<ServiceStatus | 'all'>('all');

  // Form state
  const [propertyId, setPropertyId] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [assignedCleaners, setAssignedCleaners] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

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
      // Load properties
      const propertiesSnap = await getDocs(collection(db, 'properties'));
      const propertiesData = propertiesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Property[];
      setProperties(propertiesData);

      // Load services
      const servicesQuery = query(
        collection(db, 'cleanServices'),
        orderBy('date', 'desc')
      );
      const servicesSnap = await getDocs(servicesQuery);
      const servicesData = servicesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        clockIn: doc.data().clockIn?.toDate(),
        clockOut: doc.data().clockOut?.toDate()
      })) as CleanService[];
      setServices(servicesData);

      // Load users (team members)
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = usersSnap.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as UserProfile[];
      setUsers(usersData);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async () => {
    if (!propertyId || !serviceDate) return;
    
    setSaving(true);
    try {
      const property = properties.find(p => p.id === propertyId);
      
      await addDoc(collection(db, 'cleanServices'), {
        propertyId,
        propertyName: property?.name || '',
        date: new Date(serviceDate),
        assignedCleaners,
        status: 'pending',
        notes,
        createdAt: serverTimestamp(),
        createdBy: user?.uid
      });

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating service:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setPropertyId('');
    setServiceDate('');
    setAssignedCleaners([]);
    setNotes('');
  };

  const toggleCleaner = (uid: string) => {
    setAssignedCleaners(prev => 
      prev.includes(uid) 
        ? prev.filter(id => id !== uid)
        : [...prev, uid]
    );
  };

  const isAdmin = profile?.role === 'admin';
  const filteredServices = filter === 'all' 
    ? services 
    : services.filter(s => s.status === filter);

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t('service.title')}</h1>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              <Plus className="w-5 h-5" />
              {t('service.new')}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('common.all')}
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('service.pending')}
          </button>
          <button
            onClick={() => setFilter('inProgress')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'inProgress' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('service.inProgress')}
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('service.completed')}
          </button>
        </div>

        {/* Services List */}
        {filteredServices.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            {t('service.noServices')}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredServices.map(service => (
              <Link
                key={service.id}
                href={`/${locale}/services/${service.id}`}
                className="block bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{service.propertyName}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[service.status]}`}>
                        {t(`service.${service.status}`)}
                      </span>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {service.date?.toLocaleDateString()}
                      </div>
                      {service.assignedCleaners.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {service.assignedCleaners.length} {t('team.title').toLowerCase()}
                        </div>
                      )}
                    </div>

                    {service.notes && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-1">{service.notes}</p>
                    )}
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Service Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">{t('service.new')}</h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Property Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('service.property')}
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select property</option>
                  {properties.filter(p => p.active).map(property => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('service.date')}
                </label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Team Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('service.assign')}
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {users.filter(u => u.active).map(user => (
                    <label
                      key={user.uid}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition"
                    >
                      <input
                        type="checkbox"
                        checked={assignedCleaners.includes(user.uid)}
                        onChange={() => toggleCleaner(user.uid)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span className="text-sm">{user.displayName || user.email}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('common.notes') || 'Notes'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Special instructions..."
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreateService}
                disabled={saving || !propertyId || !serviceDate}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}