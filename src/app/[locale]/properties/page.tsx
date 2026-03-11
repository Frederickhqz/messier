'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import AddressAutocomplete from '@/components/address-autocomplete';
import PropertyPreview from '@/components/property-preview';
import ImageUpload from '@/components/image-upload';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, RoomConfig, RoomType, BedroomConfig, BedSize } from '@/types';
import { Plus, Edit2, Trash2, Bed, Bath, Building2, X, Loader2 } from 'lucide-react';
import Link from 'next/link';

const roomTypeLabels: Record<RoomType, string> = {
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  kitchen: 'Kitchen',
  livingRoom: 'Living Room',
  diningRoom: 'Dining Room',
  office: 'Office',
  garage: 'Garage',
  patio: 'Patio',
  laundry: 'Laundry',
  other: 'Other'
};

const bedSizes: BedSize[] = ['king', 'queen', 'full', 'twin', 'twinXL', 'californiaKing'];

const bedSizeLabels: Record<BedSize, string> = {
  king: 'King',
  queen: 'Queen',
  full: 'Full',
  twin: 'Twin',
  twinXL: 'Twin XL',
  californiaKing: 'California King'
};

const bathroomTypes = ['full', 'half', 'none'] as const;

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
  const [mainPhoto, setMainPhoto] = useState('');
  const [description, setDescription] = useState('');
  const [bedroomConfig, setBedroomConfig] = useState<BedroomConfig[]>([]);
  const [bathrooms, setBathrooms] = useState<number>(0);
  const [halfBathrooms, setHalfBathrooms] = useState<number>(0);

  // Enrichment state
  const [enriching, setEnriching] = useState(false);
  const [enrichedData, setEnrichedData] = useState<Partial<Property> | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [placeId, setPlaceId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!user) return;
    loadProperties();
  }, [user]);

  const loadProperties = async () => {
    try {
      const propertiesSnapshot = await getDocs(collection(db, 'properties'));
      const propertiesData = propertiesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        };
      }) as Property[];
      
      setProperties(propertiesData);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceSelect = async (selectedPlaceId: string, selectedAddress: string) => {
    setAddress(selectedAddress);
    setPlaceId(selectedPlaceId);
    setEnriching(true);
    
    try {
      const response = await fetch(
        `/api/property/enrich?action=enrich&address=${encodeURIComponent(selectedAddress)}&placeId=${selectedPlaceId}`
      );
      const data = await response.json();
      
      if (data.error) {
        console.error('Enrichment error:', data.error);
        setEnrichedData({ address: selectedAddress });
      } else {
        setEnrichedData(data);
        setName(data.name || selectedAddress.split(',')[0]);
        
        // Auto-populate bathrooms
        if (data.bathrooms) {
          setBathrooms(data.bathrooms);
        }
        
        // Auto-populate bedroom config
        if (data.bedroomConfig) {
          setBedroomConfig(data.bedroomConfig);
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

  const handleSaveProperty = async () => {
    if (!address.trim()) {
      alert('Please enter an address');
      return;
    }

    setSaving(true);
    
    try {
      const propertyData: any = {
        name: name || address.split(',')[0] || 'Untitled Property',
        address,
        rooms,
        mainPhoto: mainPhoto || null,
        description: description || null,
        bathrooms,
        halfBathrooms,
        bedroomConfig,
        active: true,
        updatedAt: serverTimestamp()
      };
      
      // Add enrichment fields if available
      if (enrichedData) {
        if (enrichedData.enriched !== undefined) propertyData.enriched = enrichedData.enriched;
        if (placeId) propertyData.placeId = placeId;
        if (enrichedData.propertyType) propertyData.propertyType = enrichedData.propertyType;
        if (enrichedData.bedrooms) propertyData.bedrooms = enrichedData.bedrooms;
        if (enrichedData.squareFeet) propertyData.squareFeet = enrichedData.squareFeet;
        if (enrichedData.yearBuilt) propertyData.yearBuilt = enrichedData.yearBuilt;
        if (enrichedData.latitude) propertyData.latitude = enrichedData.latitude;
        if (enrichedData.longitude) propertyData.longitude = enrichedData.longitude;
        if (enrichedData.photos) propertyData.photos = enrichedData.photos.slice(0, 5);
        if (enrichedData.rentcastData) propertyData.rentcastData = enrichedData.rentcastData;
      }
      
      if (editingProperty) {
        // Update existing property
        await updateDoc(doc(db, 'properties', editingProperty.id), propertyData);
      } else {
        // Create new property
        propertyData.createdAt = serverTimestamp();
        propertyData.createdBy = user?.uid;
        await addDoc(collection(db, 'properties'), propertyData);
      }
      
      // Reset form
      setShowModal(false);
      setShowPreview(false);
      setEnrichedData(null);
      setName('');
      setAddress('');
      setRooms([]);
      setPlaceId(null);
      setMainPhoto('');
      setDescription('');
      setBedroomConfig([]);
      setBathrooms(0);
      setHalfBathrooms(0);
      setEditingProperty(null);
      
      loadProperties();
    } catch (error) {
      console.error('Error saving property:', error);
      alert('Failed to save property: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (property: Property) => {
    setEditingProperty(property);
    setName(property.name);
    setAddress(property.address);
    setRooms(property.rooms || []);
    setMainPhoto(property.mainPhoto || '');
    setDescription(property.description || '');
    setBedroomConfig(property.bedroomConfig || []);
    setBathrooms(property.bathrooms || 0);
    setHalfBathrooms(property.halfBathrooms || 0);
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
    setMainPhoto('');
    setDescription('');
    setBedroomConfig([]);
    setBathrooms(0);
    setHalfBathrooms(0);
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

  // Bedroom config helpers
  const addBedroom = () => {
    setBedroomConfig([...bedroomConfig, {
      roomNumber: bedroomConfig.length + 1,
      name: `Bedroom ${bedroomConfig.length + 1}`,
      beds: [{ size: 'queen', quantity: 1 }],
      bathroomType: 'none'
    }]);
  };

  const updateBedroom = (index: number, updates: Partial<BedroomConfig>) => {
    const updated = [...bedroomConfig];
    updated[index] = { ...updated[index], ...updates };
    setBedroomConfig(updated);
  };

  const removeBedroom = (index: number) => {
    const updated = bedroomConfig.filter((_, i) => i !== index);
    // Renumber rooms
    updated.forEach((room, i) => {
      room.roomNumber = i + 1;
    });
    setBedroomConfig(updated);
  };

  const addBedToRoom = (roomIndex: number) => {
    const updated = [...bedroomConfig];
    updated[roomIndex].beds.push({ size: 'queen', quantity: 1 });
    setBedroomConfig(updated);
  };

  const updateBed = (roomIndex: number, bedIndex: number, field: 'size' | 'quantity', value: BedSize | number) => {
    const updated = [...bedroomConfig];
    if (field === 'size') {
      updated[roomIndex].beds[bedIndex].size = value as BedSize;
    } else {
      updated[roomIndex].beds[bedIndex].quantity = value as number;
    }
    setBedroomConfig(updated);
  };

  const removeBed = (roomIndex: number, bedIndex: number) => {
    const updated = [...bedroomConfig];
    updated[roomIndex].beds.splice(bedIndex, 1);
    setBedroomConfig(updated);
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
              onClick={() => { resetForm(); setShowModal(true); }}
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
              <Link
                key={property.id}
                href={`/${locale}/properties/${property.id}`}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition"
              >
                {/* Property Image */}
                <div className="h-40 bg-gray-100 relative">
                  {property.mainPhoto ? (
                    <img src={property.mainPhoto} alt={property.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
                      <Building2 className="w-16 h-16 text-primary-400" />
                    </div>
                  )}
                  {property.enriched && (
                    <span className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full bg-blue-500 text-white">
                      Enriched
                    </span>
                  )}
                </div>
                
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{property.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">{property.address}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 ml-2" onClick={e => e.preventDefault()}>
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(property); }}
                          className="p-1.5 hover:bg-gray-100 rounded transition"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(property.id); }}
                          className="p-1.5 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Stats */}
                  <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Bed className="w-4 h-4" />
                      {property.bedroomConfig?.length || property.bedrooms || '-'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      {property.bathrooms || '-'}
                      {property.halfBathrooms ? ` +${property.halfBathrooms}½` : ''}
                    </span>
                    {property.squareFeet && (
                      <span>{property.squareFeet.toLocaleString()} sqft</span>
                    )}
                  </div>
                  
                  {/* Bedroom config preview */}
                  {property.bedroomConfig && property.bedroomConfig.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      {property.bedroomConfig.slice(0, 2).map((room, i) => (
                        <span key={i} className="mr-2">
                          {room.beds.map(b => `${b.quantity}×${b.size}`).join(' + ')}
                          {room.bathroomType === 'full' ? ' (ensuite)' : room.bathroomType === 'half' ? ' (½ bath)' : ''}
                        </span>
                      ))}
                      {property.bedroomConfig.length > 2 && ` +${property.bedroomConfig.length - 2} more`}
                    </div>
                  )}
                  
                  <div className="mt-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      property.active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {property.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-8">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-xl font-semibold">
                {editingProperty ? 'Edit Property' : 'Add Property'}
              </h2>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Property Photo</label>
                <ImageUpload
                  value={mainPhoto}
                  onChange={setMainPhoto}
                  folder="properties"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Property Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Beach House"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                {editingProperty ? (
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                ) : (
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="Start typing address..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                )}
                {enriching && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Fetching property details...
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Property description..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Bathrooms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Bathrooms</label>
                  <input
                    type="number"
                    min="0"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Half Bathrooms</label>
                  <input
                    type="number"
                    min="0"
                    value={halfBathrooms}
                    onChange={(e) => setHalfBathrooms(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Bedroom Configuration */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Bedroom Configuration</label>
                  <button
                    type="button"
                    onClick={addBedroom}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + Add Bedroom
                  </button>
                </div>

                {bedroomConfig.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center bg-gray-50 rounded-lg">
                    No bedrooms configured. Click "Add Bedroom" to start.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {bedroomConfig.map((room, roomIndex) => (
                      <div key={roomIndex} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <input
                            type="text"
                            value={room.name || `Bedroom ${room.roomNumber}`}
                            onChange={(e) => updateBedroom(roomIndex, { name: e.target.value })}
                            placeholder="Room name"
                            className="font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeBedroom(roomIndex)}
                            className="text-red-500 hover:text-red-600 text-sm"
                          >
                            Remove
                          </button>
                        </div>

                        {/* Beds */}
                        <div className="space-y-2 mb-3">
                          {room.beds.map((bed, bedIndex) => (
                            <div key={bedIndex} className="flex items-center gap-2">
                              <select
                                value={bed.size}
                                onChange={(e) => updateBed(roomIndex, bedIndex, 'size', e.target.value as BedSize)}
                                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                              >
                                {bedSizes.map(size => (
                                  <option key={size} value={size}>{bedSizeLabels[size]}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="1"
                                value={bed.quantity}
                                onChange={(e) => updateBed(roomIndex, bedIndex, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                              />
                              {room.beds.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeBed(roomIndex, bedIndex)}
                                  className="text-red-500 hover:text-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addBedToRoom(roomIndex)}
                            className="text-sm text-primary-600 hover:text-primary-700"
                          >
                            + Add Bed
                          </button>
                        </div>

                        {/* Bathroom type */}
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">Bathroom:</label>
                          <select
                            value={room.bathroomType || 'none'}
                            onChange={(e) => updateBedroom(roomIndex, { bathroomType: e.target.value as any })}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="none">No bathroom</option>
                            <option value="half">Half bathroom</option>
                            <option value="full">Full bathroom (ensuite)</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProperty}
                disabled={saving || !address.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingProperty ? 'Update Property' : 'Create Property'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}