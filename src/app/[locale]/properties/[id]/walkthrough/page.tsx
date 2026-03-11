'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property } from '@/types';
import { WalkthroughSpace, WalkthroughItem, PhotoRequest, SpaceType, ItemType, BedCount } from '@/types/walkthrough';
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Loader2, GripVertical, X, MapPin, Bed } from 'lucide-react';

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
  { value: 'king', label: 'King', sheets: 'King sheets' },
  { value: 'queen', label: 'Queen', sheets: 'Queen sheets' },
  { value: 'full', label: 'Full/Double', sheets: 'Full sheets' },
  { value: 'twin', label: 'Twin', sheets: 'Twin sheets' },
  { value: 'twinXL', label: 'Twin XL', sheets: 'Twin XL sheets' },
  { value: 'californiaKing', label: 'California King', sheets: 'Cal King sheets' }
];

const bunkBedConfigs = [
  { value: 'twin+twin', label: 'Twin + Twin Bunk', sheets: ['Twin sheets', 'Twin sheets'] },
  { value: 'full+twin', label: 'Full + Twin Bunk', sheets: ['Full sheets', 'Twin sheets'] },
  { value: 'queen+twin', label: 'Queen + Twin Bunk', sheets: ['Queen sheets', 'Twin sheets'] },
  { value: 'full+full', label: 'Full + Full Bunk', sheets: ['Full sheets', 'Full sheets'] }
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
  const [draggedSpace, setDraggedSpace] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{spaceId: string, itemId: string} | null>(null);
  
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
      }
    } catch (error) {
      console.error('Error loading walkthrough:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate bed counts from spaces
  const calculateBedCounts = (): BedCount => {
    const counts: BedCount = {
      king: 0,
      queen: 0,
      full: 0,
      twin: 0,
      twinXL: 0,
      californiaKing: 0,
      total: 0
    };
    
    spaces.forEach(space => {
      space.items?.forEach(item => {
        if (item.type === 'bed' && item.subType) {
          counts[item.subType as keyof BedCount]++;
          counts.total++;
        } else if (item.type === 'bunkbed' && item.subType) {
          const config = bunkBedConfigs.find(c => c.value === item.subType);
          if (config) {
            // Parse bunk bed config (e.g., "twin+twin" = 2 twin beds)
            const [bed1, bed2] = item.subType.split('+');
            if (bed1) counts[bed1 as keyof BedCount]++;
            if (bed2) counts[bed2 as keyof BedCount]++;
            counts.total += 2;
          }
        }
      });
    });
    
    return counts;
  };

  // Drag and drop for spaces
  const handleSpaceDragStart = (spaceId: string) => {
    setDraggedSpace(spaceId);
  };

  const handleSpaceDragOver = (e: React.DragEvent, targetSpaceId: string) => {
    e.preventDefault();
    if (!draggedSpace || draggedSpace === targetSpaceId) return;
    
    const newSpaces = [...spaces];
    const draggedIndex = newSpaces.findIndex(s => s.id === draggedSpace);
    const targetIndex = newSpaces.findIndex(s => s.id === targetSpaceId);
    
    const [removed] = newSpaces.splice(draggedIndex, 1);
    newSpaces.splice(targetIndex, 0, removed);
    
    newSpaces.forEach((space, index) => {
      space.order = index;
    });
    
    setSpaces(newSpaces);
  };

  const handleSpaceDragEnd = () => {
    setDraggedSpace(null);
  };

  // Drag and drop for items within a space
  const handleItemDragStart = (spaceId: string, itemId: string) => {
    setDraggedItem({ spaceId, itemId });
  };

  const handleItemDragOver = (e: React.DragEvent, spaceId: string, targetItemId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.spaceId !== spaceId || draggedItem.itemId === targetItemId) return;
    
    setSpaces(prevSpaces => {
      const newSpaces = [...prevSpaces];
      const spaceIndex = newSpaces.findIndex(s => s.id === spaceId);
      const space = newSpaces[spaceIndex];
      
      const draggedIndex = space.items.findIndex(i => i.id === draggedItem.itemId);
      const targetIndex = space.items.findIndex(i => i.id === targetItemId);
      
      const [removed] = space.items.splice(draggedIndex, 1);
      space.items.splice(targetIndex, 0, removed);
      
      space.items.forEach((item, index) => {
        item.order = index;
      });
      
      return newSpaces;
    });
  };

  const handleItemDragEnd = () => {
    setDraggedItem(null);
  };

  // Space management
  const addSpace = (type: SpaceType) => {
    const newSpace: WalkthroughSpace = {
      id: `space-${Date.now()}`,
      name: `${spaceTypeLabels[type]} ${spaces.filter(s => s.type === type).length + 1}`,
      type,
      location: '',
      order: spaces.length,
      items: [],
      photoRequests: []
    };
    setSpaces([...spaces, newSpace]);
    setExpandedSpaces(new Set([...expandedSpaces, newSpace.id]));
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
    setExpandedItems(new Set([...expandedItems, newItem.id]));
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
      // Get existing space IDs
      const existingSnapshot = await getDocs(
        collection(db, 'properties', propertyId, 'walkthroughConfig')
      );
      const existingIds = existingSnapshot.docs.map(d => d.id);
      
      // Save each space
      for (const space of spaces) {
        await setDoc(
          doc(db, 'properties', propertyId, 'walkthroughConfig', space.id),
          space
        );
      }
      
      // Delete removed spaces
      for (const id of existingIds) {
        if (!spaces.find(s => s.id === id)) {
          await deleteDoc(doc(db, 'properties', propertyId, 'walkthroughConfig', id));
        }
      }
      
      // Update bed counts on property
      const bedCounts = calculateBedCounts();
      await setDoc(doc(db, 'properties', propertyId), {
        bedCounts,
        bedroomCount: spaces.filter(s => s.type === 'bedroom').length,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
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

  const bedCounts = calculateBedCounts();

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

        {/* Bed Count Summary */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Bed className="w-5 h-5" />
            Bed Count Summary (for linen calculations)
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {Object.entries(bedCounts).filter(([k]) => k !== 'total').map(([size, count]) => (
              <div key={size} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary-600">{count}</div>
                <div className="text-sm text-gray-500 capitalize">{size}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Total beds: {bedCounts.total} • Bedrooms: {spaces.filter(s => s.type === 'bedroom').length}
          </p>
        </div>

        {/* Add Space Buttons */}
        <div className="flex flex-wrap gap-2">
          {(['bedroom', 'bathroom', 'kitchen', 'livingRoom', 'pool', 'patio', 'other'] as SpaceType[]).map(type => {
            const count = spaces.filter(s => s.type === type).length;
            return (
              <button
                key={type}
                onClick={() => addSpace(type)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                <span>{spaceTypeLabels[type]}</span>
                {count > 0 && <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Spaces */}
        <div className="space-y-4">
          {spaces.map((space) => (
            <div 
              key={space.id} 
              className="bg-white rounded-xl shadow-sm overflow-hidden"
              draggable
              onDragStart={() => handleSpaceDragStart(space.id)}
              onDragOver={(e) => handleSpaceDragOver(e, space.id)}
              onDragEnd={handleSpaceDragEnd}
            >
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
                <div className="flex-1">
                  <input
                    type="text"
                    value={space.name}
                    onChange={(e) => updateSpace(space.id, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none"
                  />
                  {space.location && (
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {space.location}
                    </div>
                  )}
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
                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location / Directions
                    </label>
                    <input
                      type="text"
                      value={space.location || ''}
                      onChange={(e) => updateSpace(space.id, { location: e.target.value })}
                      placeholder="e.g., First floor, right of stairs"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Items */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-700">Items in this space</h4>
                      <div className="flex gap-2 flex-wrap">
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
                          <div 
                            key={item.id} 
                            className="border border-gray-200 rounded-lg"
                            draggable
                            onDragStart={() => handleItemDragStart(space.id, item.id)}
                            onDragOver={(e) => handleItemDragOver(e, space.id, item.id)}
                            onDragEnd={handleItemDragEnd}
                          >
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
                                {item.photoRequests.map((req) => (
                                  <div key={req.id} className="flex gap-2 items-start p-2 bg-white rounded">
                                    <div className="flex-1 space-y-2">
                                      <input
                                        type="text"
                                        value={req.instruction}
                                        onChange={(e) => updatePhotoRequest(space.id, req.id, { instruction: e.target.value }, item.id)}
                                        placeholder="Instruction (e.g., Take photo under the bed)"
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                                      />
                                      <input
                                        type="text"
                                        value={req.hint || ''}
                                        onChange={(e) => updatePhotoRequest(space.id, req.id, { hint: e.target.value }, item.id)}
                                        placeholder="Hint (optional)"
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                                      />
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
                                    <button onClick={() => removePhotoRequest(space.id, req.id, item.id)} className="p-1 hover:bg-red-50 rounded text-red-500">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                                <button onClick={() => addPhotoRequest(space.id, item.id)} className="text-sm text-primary-600 hover:text-primary-700">
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
                              <input
                                type="text"
                                value={req.hint || ''}
                                onChange={(e) => updatePhotoRequest(space.id, req.id, { hint: e.target.value })}
                                placeholder="Hint (optional)"
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                              />
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
                            <button onClick={() => removePhotoRequest(space.id, req.id)} className="p-1 hover:bg-red-50 rounded text-red-500">
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

        {/* Empty State */}
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