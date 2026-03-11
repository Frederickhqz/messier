'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property } from '@/types';
import { WalkthroughSpace, WalkthroughItem, PhotoRequest, SpaceType, ItemType } from '@/types/walkthrough';
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Loader2, Languages, Bed, Bath, Home, TreePalm, Waves, X, GripVertical } from 'lucide-react';

const spaceTypeIcons: Record<SpaceType, any> = {
  bedroom: Bed,
  bathroom: Bath,
  kitchen: Home,
  livingRoom: Home,
  diningRoom: Home,
  office: Home,
  garage: Home,
  patio: TreePalm,
  pool: Waves,
  laundry: Home,
  other: Home
};

const spaceTypeLabels: Record<SpaceType, string> = {
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  kitchen: 'Kitchen',
  livingRoom: 'Living Room',
  diningRoom: 'Dining Room',
  office: 'Office',
  garage: 'Garage',
  patio: 'Patio',
  pool: 'Pool',
  laundry: 'Laundry',
  other: 'Other'
};

const itemTypeLabels: Record<ItemType, string> = {
  bed: 'Bed',
  bunkbed: 'Bunk Bed',
  sofa: 'Sofa',
  dining_table: 'Dining Table',
  tv: 'TV',
  toilet: 'Toilet',
  sink: 'Sink',
  shower: 'Shower',
  bathtub: 'Bathtub',
  hot_tub: 'Hot Tub',
  pool: 'Pool',
  patio_furniture: 'Patio Furniture',
  appliances: 'Appliances',
  other: 'Other'
};

const bedSubTypes = [
  { value: 'king', label: 'King' },
  { value: 'queen', label: 'Queen' },
  { value: 'full', label: 'Full/Double' },
  { value: 'twin', label: 'Twin' },
  { value: 'twinXL', label: 'Twin XL' },
  { value: 'californiaKing', label: 'California King' }
];

const bunkBedConfigs = [
  { value: 'full+twin', label: 'Full + Twin Bunk' },
  { value: 'twin+twin', label: 'Twin + Twin Bunk' },
  { value: 'queen+twin', label: 'Queen + Twin Bunk' },
  { value: 'full+full', label: 'Full + Full Bunk' }
];

const sinkSubTypes = [
  { value: 'single', label: 'Single Sink' },
  { value: 'double', label: 'Double Sink' }
];

export default function WalkthroughConfigPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string || 'en';
  const { user, loading: authLoading } = useAuth();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [spaces, setSpaces] = useState<WalkthroughSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  const propertyId = params.id as string;

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, propertyId]);

  const loadData = async () => {
    try {
      const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
      if (!propertyDoc.exists()) {
        router.push(`/${locale}/properties`);
        return;
      }
      
      const propertyData = { id: propertyDoc.id, ...propertyDoc.data() } as Property;
      setProperty(propertyData);
      
      const configSnapshot = await getDocs(
        collection(db, 'properties', propertyId, 'walkthroughConfig')
      );
      
      if (!configSnapshot.empty) {
        const spacesData = configSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WalkthroughSpace[];
        spacesData.sort((a, b) => a.order - b.order);
        setSpaces(spacesData);
      } else {
        const initialSpaces = generateInitialSpaces(propertyData);
        setSpaces(initialSpaces);
      }
    } catch (error) {
      console.error('Error loading walkthrough:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInitialSpaces = (property: Property): WalkthroughSpace[] => {
    const spaces: WalkthroughSpace[] = [];
    let order = 0;
    
    // Add bedrooms from bedroom config
    if (property.bedroomConfig && property.bedroomConfig.length > 0) {
      property.bedroomConfig.forEach((room, index) => {
        const items: WalkthroughItem[] = [];
        
        // Add beds based on config
        room.beds.forEach((bed, bedIndex) => {
          items.push({
            id: `bed-${bedIndex}`,
            name: bed.quantity > 1 ? `${bed.quantity}× ${bed.size}` : `${bed.size.charAt(0).toUpperCase() + bed.size.slice(1)} Bed`,
            type: 'bed',
            subType: bed.size,
            photoRequests: generateDefaultBedPhotos(bed.size),
            order: bedIndex
          });
        });
        
        // Add overall room request
        items.push({
          id: 'room-overall',
          name: 'Overall Room',
          type: 'other',
          photoRequests: [{
            id: 'overall-photo',
            instruction: 'Take overall photo of room',
            location: 'Doorway',
            required: true,
            multiplePhotos: false,
            order: 0
          }],
          order: items.length
        });
        
        spaces.push({
          id: `bedroom-${index}`,
          name: room.name || `Bedroom ${index + 1}`,
          type: 'bedroom',
          order: order++,
          items,
          photoRequests: []
        });
        
        // Add ensuite if exists
        if (room.bathroomType === 'full') {
          spaces.push({
            id: `bathroom-ensuite-${index}`,
            name: `${room.name || `Bedroom ${index + 1}`} Bathroom`,
            type: 'bathroom',
            order: order++,
            items: generateBathroomItems(),
            photoRequests: []
          });
        } else if (room.bathroomType === 'half') {
          spaces.push({
            id: `bathroom-ensuite-${index}`,
            name: `${room.name || `Bedroom ${index + 1}`} Half Bath`,
            type: 'bathroom',
            order: order++,
            items: generateHalfBathItems(),
            photoRequests: []
          });
        }
      });
    }
    
    // Add shared bathrooms
    const ensuiteBathrooms = property.bedroomConfig?.filter(r => r.bathroomType === 'full').length || 0;
    const ensuiteHalfBaths = property.bedroomConfig?.filter(r => r.bathroomType === 'half').length || 0;
    const remainingFullBaths = (property.bathrooms || 0) - ensuiteBathrooms;
    const remainingHalfBaths = (property.halfBathrooms || 0) - ensuiteHalfBaths;
    
    for (let i = 0; i < remainingFullBaths; i++) {
      spaces.push({
        id: `bathroom-shared-${i}`,
        name: `Shared Bathroom ${i + 1}`,
        type: 'bathroom',
        order: order++,
        items: generateBathroomItems(),
        photoRequests: [],
        sharedWith: spaces.filter(s => s.type === 'bedroom').map(s => s.id)
      });
    }
    
    for (let i = 0; i < remainingHalfBaths; i++) {
      spaces.push({
        id: `halfbath-${i}`,
        name: `Half Bath ${i + 1}`,
        type: 'bathroom',
        order: order++,
        items: generateHalfBathItems(),
        photoRequests: [],
        sharedWith: []
      });
    }
    
    // Add kitchen
    spaces.push({
      id: 'kitchen',
      name: 'Kitchen',
      type: 'kitchen',
      order: order++,
      items: generateKitchenItems(),
      photoRequests: []
    });
    
    // Add living room
    spaces.push({
      id: 'livingroom',
      name: 'Living Room',
      type: 'livingRoom',
      order: order++,
      items: generateLivingRoomItems(),
      photoRequests: []
    });
    
    return spaces;
  };

  const generateDefaultBedPhotos = (bedSize: string): PhotoRequest[] => ([
    { id: 'bed-made', instruction: 'Take photo of bed made', location: 'Center of room', required: true, multiplePhotos: false, order: 0 },
    { id: 'bed-under', instruction: 'Take photo under the bed', location: 'Lift bed skirt if present', hint: 'Check for forgotten items', required: false, multiplePhotos: false, order: 1 },
    { id: 'bed-pillows', instruction: 'Take photo of pillows', location: 'Above bed', required: true, multiplePhotos: false, order: 2 }
  ]);

  const generateBathroomItems = (): WalkthroughItem[] => ([
    { id: 'toilet', name: 'Toilet', type: 'toilet', photoRequests: [
      { id: 'toilet-seat', instruction: 'Take photo of toilet with seat down', location: 'Side angle', required: true, multiplePhotos: false, order: 0 },
      { id: 'toilet-base', instruction: 'Take photo around toilet base', location: 'Floor level', hint: 'Check for stains', required: true, multiplePhotos: false, order: 1 }
    ], order: 0 },
    { id: 'sink', name: 'Sink', type: 'sink', subType: 'single', photoRequests: [
      { id: 'sink-counter', instruction: 'Take photo of sink and counter', location: 'In front of sink', required: true, multiplePhotos: false, order: 0 },
      { id: 'sink-drain', instruction: 'Take photo of drain', location: 'Above sink', hint: 'Ensure drain is clean', required: true, multiplePhotos: false, order: 1 }
    ], order: 1 },
    { id: 'shower', name: 'Shower', type: 'shower', photoRequests: [
      { id: 'shower-overall', instruction: 'Take photo of shower area', location: 'Inside shower or doorway', required: true, multiplePhotos: false, order: 0 },
      { id: 'shower-floor', instruction: 'Take photo of shower floor', location: 'Looking down', hint: 'Check for hair or debris', required: true, multiplePhotos: false, order: 1 }
    ], order: 2 },
    { id: 'tub', name: 'Bathtub', type: 'bathtub', photoRequests: [
      { id: 'tub-overall', instruction: 'Take photo of bathtub', location: 'Side angle', required: true, multiplePhotos: false, order: 0 },
      { id: 'tub-clean', instruction: 'Take photo of tub interior', location: 'Above tub', required: true, multiplePhotos: false, order: 1 }
    ], order: 3 },
    { id: 'towels', name: 'Towels', type: 'other', photoRequests: [
      { id: 'towels', instruction: 'Take photo of towel arrangement', location: 'Towel rack or shelf', required: true, multiplePhotos: false, order: 0 }
    ], order: 4 }
  ]);

  const generateHalfBathItems = (): WalkthroughItem[] => ([
    { id: 'toilet', name: 'Toilet', type: 'toilet', photoRequests: [
      { id: 'toilet-seat', instruction: 'Take photo of toilet with seat down', location: 'Side angle', required: true, multiplePhotos: false, order: 0 }
    ], order: 0 },
    { id: 'sink', name: 'Sink', type: 'sink', subType: 'single', photoRequests: [
      { id: 'sink-counter', instruction: 'Take photo of sink and counter', location: 'In front of sink', required: true, multiplePhotos: false, order: 0 }
    ], order: 1 }
  ]);

  const generateKitchenItems = (): WalkthroughItem[] => ([
    { id: 'counters', name: 'Countertops', type: 'other', photoRequests: [
      { id: 'counter-overall', instruction: 'Take photo of clean countertops', location: 'Center of kitchen', required: true, multiplePhotos: false, order: 0 }
    ], order: 0 },
    { id: 'sink', name: 'Sink', type: 'sink', photoRequests: [
      { id: 'sink-clean', instruction: 'Take photo of sink area', location: 'In front of sink', hint: 'Sink should be empty and clean', required: true, multiplePhotos: false, order: 0 }
    ], order: 1 },
    { id: 'appliances', name: 'Appliances', type: 'appliances', photoRequests: [
      { id: 'stove', instruction: 'Take photo of stove/cooktop', location: 'Front angle', required: true, multiplePhotos: false, order: 0 },
      { id: 'fridge', instruction: 'Take photo of refrigerator', location: 'Front angle', required: true, multiplePhotos: false, order: 1 }
    ], order: 2 }
  ]);

  const generateLivingRoomItems = (): WalkthroughItem[] => ([
    { id: 'sofa', name: 'Sofa', type: 'sofa', photoRequests: [
      { id: 'sofa-overall', instruction: 'Take photo of sofa/seating area', location: 'Center of room', hint: 'Fluff pillows', required: true, multiplePhotos: false, order: 0 }
    ], order: 0 },
    { id: 'tv', name: 'TV Area', type: 'tv', photoRequests: [
      { id: 'tv-clean', instruction: 'Take photo of TV screen', location: 'Front', hint: 'Clean screen if dusty', required: true, multiplePhotos: false, order: 0 }
    ], order: 1 }
  ]);

  // Space management
  const addSpace = (type: SpaceType) => {
    const newSpace: WalkthroughSpace = {
      id: `space-${Date.now()}`,
      name: `${spaceTypeLabels[type]} ${spaces.filter(s => s.type === type).length + 1}`,
      type,
      order: spaces.length,
      items: [],
      photoRequests: []
    };
    setSpaces([...spaces, newSpace]);
    const newExpanded = new Set(expandedSpaces);
    newExpanded.add(newSpace.id);
    setExpandedSpaces(newExpanded);
  };

  const removeSpace = (spaceId: string) => {
    setSpaces(spaces.filter(s => s.id !== spaceId));
  };

  const updateSpace = (spaceId: string, updates: Partial<WalkthroughSpace>) => {
    setSpaces(spaces.map(s => s.id === spaceId ? { ...s, ...updates } : s));
  };

  // Item management
  const addItem = (spaceId: string, type: ItemType) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    
    const newItem: WalkthroughItem = {
      id: `item-${Date.now()}`,
      name: itemTypeLabels[type],
      type,
      photoRequests: [],
      order: space.items.length
    };
    
    updateSpace(spaceId, { items: [...space.items, newItem] });
    const newExpanded = new Set(expandedItems);
    newExpanded.add(newItem.id);
    setExpandedItems(newExpanded);
  };

  const removeItem = (spaceId: string, itemId: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    updateSpace(spaceId, { items: space.items.filter(i => i.id !== itemId) });
  };

  const updateItem = (spaceId: string, itemId: string, updates: Partial<WalkthroughItem>) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    updateSpace(spaceId, {
      items: space.items.map(i => i.id === itemId ? { ...i, ...updates } : i)
    });
  };

  // Photo request management
  const addPhotoRequest = (spaceId: string, itemId?: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    
    const newRequest: PhotoRequest = {
      id: `photo-${Date.now()}`,
      instruction: '',
      location: '',
      hint: '',
      required: true,
      multiplePhotos: false,
      order: 0
    };
    
    if (itemId) {
      const item = space.items.find(i => i.id === itemId);
      if (item) {
        updateItem(spaceId, itemId, {
          photoRequests: [...item.photoRequests, newRequest]
        });
      }
    } else {
      updateSpace(spaceId, {
        photoRequests: [...space.photoRequests, newRequest]
      });
    }
  };

  const removePhotoRequest = (spaceId: string, requestId: string, itemId?: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    
    if (itemId) {
      const item = space.items.find(i => i.id === itemId);
      if (item) {
        updateItem(spaceId, itemId, {
          photoRequests: item.photoRequests.filter(r => r.id !== requestId)
        });
      }
    } else {
      updateSpace(spaceId, {
        photoRequests: space.photoRequests.filter(r => r.id !== requestId)
      });
    }
  };

  const updatePhotoRequest = (spaceId: string, requestId: string, updates: Partial<PhotoRequest>, itemId?: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    
    if (itemId) {
      const item = space.items.find(i => i.id === itemId);
      if (item) {
        updateItem(spaceId, itemId, {
          photoRequests: item.photoRequests.map(r => r.id === requestId ? { ...r, ...updates } : r)
        });
      }
    } else {
      updateSpace(spaceId, {
        photoRequests: space.photoRequests.map(r => r.id === requestId ? { ...r, ...updates } : r)
      });
    }
  };

  // Save
  const saveWalkthrough = async () => {
    setSaving(true);
    try {
      for (const space of spaces) {
        await setDoc(
          doc(db, 'properties', propertyId, 'walkthroughConfig', space.id),
          space
        );
      }
      router.push(`/${locale}/properties/${propertyId}`);
    } catch (error) {
      console.error('Error saving walkthrough:', error);
      alert('Failed to save');
    } finally {
      setSaving(false);
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

  if (!property) return null;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configure Walkthrough</h1>
            <p className="text-gray-500">{property.name} • {spaces.length} spaces</p>
          </div>
          <button
            onClick={saveWalkthrough}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {/* Add Space Buttons */}
        <div className="flex flex-wrap gap-2">
          {(['bedroom', 'bathroom', 'kitchen', 'livingRoom', 'pool', 'patio', 'other'] as SpaceType[]).map(type => {
            const Icon = spaceTypeIcons[type];
            const count = spaces.filter(s => s.type === type).length;
            return (
              <button
                key={type}
                onClick={() => addSpace(type)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Icon className="w-4 h-4" />
                <span>+ {spaceTypeLabels[type]}</span>
                {count > 0 && <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Spaces */}
        <div className="space-y-4">
          {spaces.map((space, index) => (
            <div key={space.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Space Header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  const newExpanded = new Set(expandedSpaces);
                  if (newExpanded.has(space.id)) newExpanded.delete(space.id);
                  else newExpanded.add(space.id);
                  setExpandedSpaces(newExpanded);
                }}
              >
                <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                {spaceTypeIcons[space.type] && (() => { const Icon = spaceTypeIcons[space.type]; return <Icon className="w-5 h-5 text-primary-600" /> })()}
                <div className="flex-1">
                  <input
                    type="text"
                    value={space.name}
                    onChange={(e) => updateSpace(space.id, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none"
                  />
                  <div className="text-sm text-gray-500">
                    {space.items.length} items • {space.photoRequests.length + space.items.reduce((sum, i) => sum + i.photoRequests.length, 0)} photo requests
                    {space.sharedWith && space.sharedWith.length > 0 && ' • Shared'}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSpace(space.id); }}
                  className="p-2 hover:bg-red-50 rounded text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {expandedSpaces.has(space.id) ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>

              {/* Space Details */}
              {expandedSpaces.has(space.id) && (
                <div className="border-t p-4 space-y-4">
                  {/* Shared toggle for bathrooms */}
                  {space.type === 'bathroom' && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={space.sharedWith && space.sharedWith.length > 0}
                        onChange={(e) => updateSpace(space.id, { 
                          sharedWith: e.target.checked ? spaces.filter(s => s.type === 'bedroom').map(s => s.id) : [] 
                        })}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <span className="text-sm">Shared bathroom (accessible from multiple bedrooms)</span>
                    </label>
                  )}

                  {/* Items */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-700">Items in this space</h4>
                      <div className="flex gap-2">
                        {space.type === 'bedroom' && (
                          <>
                            <button onClick={() => addItem(space.id, 'bed')} className="text-sm text-primary-600 hover:text-primary-700">+ Bed</button>
                            <button onClick={() => addItem(space.id, 'bunkbed')} className="text-sm text-primary-600 hover:text-primary-700">+ Bunk Bed</button>
                          </>
                        )}
                        {space.type === 'bathroom' && (
                          <>
                            <button onClick={() => addItem(space.id, 'toilet')} className="text-sm text-primary-600 hover:text-primary-700">+ Toilet</button>
                            <button onClick={() => addItem(space.id, 'sink')} className="text-sm text-primary-600 hover:text-primary-700">+ Sink</button>
                            <button onClick={() => addItem(space.id, 'shower')} className="text-sm text-primary-600 hover:text-primary-700">+ Shower</button>
                            <button onClick={() => addItem(space.id, 'bathtub')} className="text-sm text-primary-600 hover:text-primary-700">+ Bathtub</button>
                          </>
                        )}
                        <button onClick={() => addItem(space.id, 'other')} className="text-sm text-primary-600 hover:text-primary-700">+ Other</button>
                      </div>
                    </div>

                    {space.items.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 text-center bg-gray-50 rounded-lg">No items. Add beds, fixtures, or other items above.</p>
                    ) : (
                      <div className="space-y-3">
                        {space.items.map((item) => (
                          <div key={item.id} className="border border-gray-200 rounded-lg">
                            {/* Item Header */}
                            <div
                              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                              onClick={() => {
                                const newExpanded = new Set(expandedItems);
                                if (newExpanded.has(item.id)) newExpanded.delete(item.id);
                                else newExpanded.add(item.id);
                                setExpandedItems(newExpanded);
                              }}
                            >
                              <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => updateItem(space.id, item.id, { name: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none"
                                />
                                <div className="text-xs text-gray-500">{item.photoRequests.length} photo requests</div>
                              </div>
                              {item.type === 'bed' && (
                                <select
                                  value={item.subType || 'queen'}
                                  onChange={(e) => updateItem(space.id, item.id, { subType: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sm border border-gray-300 rounded px-2 py-1"
                                >
                                  {bedSubTypes.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
                                </select>
                              )}
                              {item.type === 'bunkbed' && (
                                <select
                                  value={item.subType || 'twin+twin'}
                                  onChange={(e) => updateItem(space.id, item.id, { subType: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sm border border-gray-300 rounded px-2 py-1"
                                >
                                  {bunkBedConfigs.map(bc => <option key={bc.value} value={bc.value}>{bc.label}</option>)}
                                </select>
                              )}
                              {item.type === 'sink' && (
                                <select
                                  value={item.subType || 'single'}
                                  onChange={(e) => updateItem(space.id, item.id, { subType: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sm border border-gray-300 rounded px-2 py-1"
                                >
                                  {sinkSubTypes.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                                </select>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); removeItem(space.id, item.id); }}
                                className="p-1 hover:bg-red-50 rounded text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              {expandedItems.has(item.id) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>

                            {/* Item Photo Requests */}
                            {expandedItems.has(item.id) && (
                              <div className="border-t p-3 space-y-2 bg-gray-50">
                                {item.photoRequests.map((req, reqIdx) => (
                                  <div key={req.id} className="flex gap-2 items-start p-2 bg-white rounded">
                                    <div className="flex-1 space-y-2">
                                      <input
                                        type="text"
                                        value={req.instruction}
                                        onChange={(e) => updatePhotoRequest(space.id, req.id, { instruction: e.target.value }, item.id)}
                                        placeholder="Instruction (e.g., Take photo under the bed)"
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                                      />
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={req.location || ''}
                                          onChange={(e) => updatePhotoRequest(space.id, req.id, { location: e.target.value }, item.id)}
                                          placeholder="Location (e.g., Behind nightstand)"
                                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                                        />
                                        <input
                                          type="text"
                                          value={req.hint || ''}
                                          onChange={(e) => updatePhotoRequest(space.id, req.id, { hint: e.target.value }, item.id)}
                                          placeholder="Hint (optional)"
                                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <label className="flex items-center gap-1 text-xs">
                                        <input type="checkbox" checked={req.required} onChange={(e) => updatePhotoRequest(space.id, req.id, { required: e.target.checked }, item.id)} />
                                        Required
                                      </label>
                                      <label className="flex items-center gap-1 text-xs">
                                        <input type="checkbox" checked={req.multiplePhotos} onChange={(e) => updatePhotoRequest(space.id, req.id, { multiplePhotos: e.target.checked }, item.id)} />
                                        Multiple
                                      </label>
                                    </div>
                                    <button
                                      onClick={() => removePhotoRequest(space.id, req.id, item.id)}
                                      className="p-1 hover:bg-red-50 rounded text-red-500"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => addPhotoRequest(space.id, item.id)}
                                  className="text-sm text-primary-600 hover:text-primary-700"
                                >
                                  + Add photo request
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Space-level photo requests */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-700">Space photos (overall, etc.)</h4>
                      <button onClick={() => addPhotoRequest(space.id)} className="text-sm text-primary-600 hover:text-primary-700">+ Add</button>
                    </div>
                    {space.photoRequests.length > 0 && (
                      <div className="space-y-2">
                        {space.photoRequests.map((req) => (
                          <div key={req.id} className="flex gap-2 items-start p-2 bg-gray-50 rounded">
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                value={req.instruction}
                                onChange={(e) => updatePhotoRequest(space.id, req.id, { instruction: e.target.value })}
                                placeholder="Instruction (e.g., Take overall photo of pool)"
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                              />
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={req.location || ''}
                                  onChange={(e) => updatePhotoRequest(space.id, req.id, { location: e.target.value })}
                                  placeholder="Location"
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                                />
                                <input
                                  type="text"
                                  value={req.hint || ''}
                                  onChange={(e) => updatePhotoRequest(space.id, req.id, { hint: e.target.value })}
                                  placeholder="Hint (optional)"
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1 text-xs">
                                <input type="checkbox" checked={req.required} onChange={(e) => updatePhotoRequest(space.id, req.id, { required: e.target.checked })} />
                                Required
                              </label>
                              <label className="flex items-center gap-1 text-xs">
                                <input type="checkbox" checked={req.multiplePhotos} onChange={(e) => updatePhotoRequest(space.id, req.id, { multiplePhotos: e.target.checked })} />
                                Multiple
                              </label>
                            </div>
                            <button
                              onClick={() => removePhotoRequest(space.id, req.id)}
                              className="p-1 hover:bg-red-50 rounded text-red-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Space (bottom) */}
        {spaces.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <p className="text-gray-500 mb-4">No spaces configured yet</p>
            <p className="text-sm text-gray-400">Click the buttons above to add spaces</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}