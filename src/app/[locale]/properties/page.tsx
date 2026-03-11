'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, RoomConfig, RoomType } from '@/types';
import { Plus, Edit2, Trash2, Bed, Bath, UtensilsCrossed, Sofa, X } from 'lucide-react';
import Link from 'next/link';

const roomTypeLabels: Record<RoomType, string> = {
  bedroom: 'property.rooms.bedroom',
  bathroom: 'property.rooms.bathroom',
  kitchen: 'property.rooms.kitchen',
  livingRoom: 'property.rooms.livingRoom',
  diningRoom: 'property.rooms.diningRoom',
  office: 'property.rooms.office',
  garage: 'property.rooms.garage',
  patio: 'property.rooms.patio',
  laundry: 'property.rooms.laundry',
  other: 'property.rooms.other'
};

export default function PropertiesPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [rooms, setRooms] = useState<RoomConfig[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || profile?.role !== 'admin')) {
      window.location.href = `/${locale}/dashboard`;
    }
  }, [user, profile, authLoading, locale]);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'properties'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Property[];
      setProperties(data);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRoom = (type: RoomType) => {
    const existing = rooms.find(r => r.type === type);
    if (existing) {
      setRooms(rooms.map(r => r.type === type ? { ...r, count: r.count + 1 } : r));
    } else {
      setRooms([...rooms, { type, count: 1 }]);
    }
  };

  const removeRoom = (type: RoomType) => {
    const existing = rooms.find(r => r.type === type);
    if (existing && existing.count > 1) {
      setRooms(rooms.map(r => r.type === type ? { ...r, count: r.count - 1 } : r));
    } else {
      setRooms(rooms.filter(r => r.type !== type));
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) return;
    
    setSaving(true);
    try {
      if (editingProperty) {
        await updateDoc(doc(db, 'properties', editingProperty.id), {
          name,
          address,
          rooms,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'properties'), {
          name,
          address,
          rooms,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user?.uid
        });
      }
      
      setShowModal(false);
      resetForm();
      loadProperties();
    } catch (error) {
      console.error('Error saving property:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    
    try {
      await deleteDoc(doc(db, 'properties', id));
      loadProperties();
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  const openEditModal = (property: Property) => {
    setEditingProperty(property);
    setName(property.name);
    setAddress(property.address);
    setRooms(property.rooms);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingProperty(null);
    setName('');
    setAddress('');
    setRooms([]);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t('property.title')}</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Plus className="w-5 h-5" />
            {t('property.add')}
          </button>
        </div>

        {/* Properties Grid */}
        {properties.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            {t('property.noProperties')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map(property => (
              <div key={property.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{property.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{property.address}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openEditModal(property)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button 
                      onClick={() => handleDelete(property.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 flex flex-wrap gap-2">
                  {property.rooms.map((room, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded">
                      {room.count} {t(roomTypeLabels[room.type])}
                    </span>
                  ))}
                </div>
                
                <div className="mt-3">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                    property.active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {property.active ? t('property.active') : t('property.inactive')}
                  </span>
                </div>

                {/* Walkthrough Link */}
                <Link
                  href={`/${locale}/properties/${property.id}/walkthrough`}
                  className="mt-4 block w-full text-center py-2 px-4 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition text-sm font-medium"
                >
                  Configure Walkthrough
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingProperty ? t('property.edit') : t('property.add')}
              </h2>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('property.name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Beach House #1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('property.address')}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="123 Ocean Dr, Miami FL"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('property.rooms.title')}
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(roomTypeLabels) as RoomType[]).map(type => {
                    const count = rooms.find(r => r.type === type)?.count || 0;
                    return (
                      <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm">{t(roomTypeLabels[type])}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => removeRoom(type)}
                            className="w-7 h-7 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 transition"
                            disabled={count === 0}
                          >
                            -
                          </button>
                          <span className="w-6 text-center">{count}</span>
                          <button
                            type="button"
                            onClick={() => addRoom(type)}
                            className="w-7 h-7 flex items-center justify-center bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                onClick={handleSave}
                disabled={saving || !name.trim() || !address.trim()}
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