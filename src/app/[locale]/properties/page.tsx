'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import AddressAutocomplete from '@/components/address-autocomplete';
import PropertyPreview from '@/components/property-preview';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, RoomConfig, RoomType, BedroomConfig } from '@/types';
import { Plus, Edit2, Trash2, Bed, Bath, UtensilsCrossed, Sofa, X, Loader2, Sparkles } from 'lucide-react';
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

  // Enrichment state
  const [enriching, setEnriching] = useState(false);
  const [enrichedData, setEnrichedData] = useState<Partial<Property> | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [placeId, setPlaceId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
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

  const handlePlaceSelect = async (selectedPlaceId: string, selectedAddress: string) => {
    setAddress(selectedAddress);
    setPlaceId(selectedPlaceId);
    setEnriching(true);
    
    try {
      // Fetch enrichment data
      const response = await fetch(
        `/api/property/enrich?action=enrich&address=${encodeURIComponent(selectedAddress)}&placeId=${selectedPlaceId}`
      );
      const data = await response.json();
      
      if (data.error) {
        console.error('Enrichment error:', data.error);
        // Still use address without enrichment
        setEnrichedData({ address: selectedAddress });
      } else {
        setEnrichedData(data);
        setName(data.name || selectedAddress.split(',')[0]);
        
        // Auto-populate rooms based on enrichment
        if (data.bathrooms) {
          const existing = rooms.find(r => r.type === 'bathroom');
          if (existing) {
            setRooms(prev => prev.map(r => r.type === 'bathroom' ? { ...r, count: data.bathrooms } : r));
          } else {
            setRooms(prev => [...prev, { type: 'bathroom', count: data.bathrooms }]);
          }
        }
        
        if (data.bedrooms) {
          const existing = rooms.find(r => r.type === 'bedroom');
          if (existing) {
            setRooms(prev => prev.map(r => r.type === 'bedroom' ? { ...r, count: data.bedrooms } : r));
          } else {
            setRooms(prev => [...prev, { type: 'bedroom', count: data.bedrooms }]);
          }
        }
      }
      
      setShowPreview(true);
    } catch (error) {
      console.error('Error enriching property:', error);
      setEnrichedData({ address: selectedAddress });
      setShowPreview(true);
    } finally {
      setEnriching(false);
    }
  };

  const uploadPhoto = async (photoUrl: string, propertyId: string): Promise<string> => {
    // For now, just return the original URL
    // Photo uploads will be handled server-side or via direct storage upload
    return photoUrl;
  };

  const handleConfirmProperty = async (data: Partial<Property>) => {
    setSaving(true);
    
    try {
      // Create property with basic data
      const propertyData: any = {
        name: name || (data.address ? data.address.split(',')[0] : 'Untitled Property'),
        address: address || data.address || '',
        rooms: rooms,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid
      };
      
      // Only add enrichment fields if they exist
      if (data.enriched !== undefined) propertyData.enriched = data.enriched;
      if (placeId) propertyData.placeId = placeId;
      if (data.propertyType) propertyData.propertyType = data.propertyType;
      if (data.bedrooms) propertyData.bedrooms = data.bedrooms;
      if (data.bathrooms) propertyData.bathrooms = data.bathrooms;
      if (data.squareFeet) propertyData.squareFeet = data.squareFeet;
      if (data.yearBuilt) propertyData.yearBuilt = data.yearBuilt;
      if (data.bedroomConfig) propertyData.bedroomConfig = data.bedroomConfig;
      if (data.description) propertyData.description = data.description;
      if (data.latitude) propertyData.latitude = data.latitude;
      if (data.longitude) propertyData.longitude = data.longitude;
      if (data.mainPhoto) propertyData.mainPhoto = data.mainPhoto;
      if (data.photos) propertyData.photos = data.photos.slice(0, 5);
      
      // Reset form
      setShowModal(false);
      setShowPreview(false);
      setEnrichedData(null);
      setName('');
      setAddress('');
      setRooms([]);
      setPlaceId(null);
      
      // Reload properties
      loadProperties();
    } catch (error) {
      console.error('Error saving property:', error);
      alert('Failed to save property');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (property: Property) => {
    setEditingProperty(property);
    setName(property.name);
    setAddress(property.address);
    setRooms(property.rooms || []);
    setShowModal(true);
    setShowPreview(false);
    setEnrichedData(null);
  };

  const resetForm = () => {
    setName('');
    setAddress('');
    setRooms([]);
    setEditingProperty(null);
    setShowPreview(false);
    setEnrichedData(null);
    setPlaceId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    
    try {
      await deleteDoc(doc(db, 'properties', id));
      setProperties(properties.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting property:', error);
    }
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t('property.title')}</h1>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              <Plus className="w-5 h-5" />
              {t('property.add')}
            </button>
          )}
        </div>

        {/* Properties Grid */}
        {properties.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            {t('property.noProperties')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map(property => (
              <div key={property.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {property.mainPhoto && (
                  <div className="h-40 bg-gray-100">
                    <img src={property.mainPhoto} alt={property.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{property.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">{property.address}</p>
                    </div>
                    <div className="flex gap-1">
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
                  
                  {/* Property stats */}
                  {(property.bedrooms || property.bathrooms || property.squareFeet) && (
                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                      {property.bedrooms && (
                        <span className="flex items-center gap-1">
                          <Bed className="w-4 h-4" />
                          {property.bedrooms} bd
                        </span>
                      )}
                      {property.bathrooms && (
                        <span className="flex items-center gap-1">
                          <Bath className="w-4 h-4" />
                          {property.bathrooms} ba
                        </span>
                      )}
                      {property.squareFeet && (
                        <span>{property.squareFeet.toLocaleString()} sqft</span>
                      )}
                    </div>
                  )}
                  
                  {/* Room config fallback */}
                  {(!property.bedrooms && !property.bathrooms) && property.rooms && property.rooms.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {property.rooms.map((room, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {room.count} {t(roomTypeLabels[room.type])}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      property.active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {property.active ? t('property.active') : t('property.inactive')}
                    </span>
                    {property.enriched && (
                      <span className="ml-2 inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        Enriched
                      </span>
                    )}
                  </div>

                  {/* Walkthrough Link */}
                  <Link
                    href={`/${locale}/properties/${property.id}/walkthrough`}
                    className="mt-3 block w-full text-center py-2 px-4 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition text-sm font-medium"
                  >
                    Configure Walkthrough
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && !showPreview && (
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
              {/* Address with Autocomplete */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('property.address')}
                </label>
                <div className="relative">
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="123 Ocean Dr, Miami FL"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {enriching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-primary-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Enriching...</span>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Start typing the address to auto-fetch property details
                </p>
              </div>

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

              {/* Manual room configuration (fallback) */}
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
                onClick={() => {
                  if (enrichedData) {
                    setShowPreview(true);
                  } else {
                    handleConfirmProperty({ address });
                  }
                }}
                disabled={saving || !address.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {saving ? t('common.loading') : enrichedData ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Preview & Create
                  </span>
                ) : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showModal && showPreview && enrichedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Review Property</h2>
              <button 
                onClick={() => { setShowPreview(false); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <PropertyPreview
                data={{ ...enrichedData, name, address }}
                onConfirm={handleConfirmProperty}
                loading={saving}
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}