'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { collection, doc, getDoc, getDocs, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property } from '@/types';
import { WalkthroughSpace, PhotoRequest } from '@/types/walkthrough';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Save, Loader2, Languages } from 'lucide-react';

const spaceTypeLabels: Record<string, string> = {
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

const supportedLanguages = ['en', 'es', 'pt', 'fr', 'de', 'it'];

const languageLabels: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  it: 'Italian'
};

export default function WalkthroughConfigPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string || 'en';
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [spaces, setSpaces] = useState<WalkthroughSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  const [translating, setTranslating] = useState<string | null>(null);
  
  const propertyId = params.id as string;

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, propertyId]);

  const loadData = async () => {
    try {
      // Load property
      const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
      if (!propertyDoc.exists()) {
        router.push(`/${locale}/properties`);
        return;
      }
      
      const propertyData = { id: propertyDoc.id, ...propertyDoc.data() } as Property;
      setProperty(propertyData);
      
      // Load existing walkthrough config
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
        // Initialize spaces from bedroom config
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
        spaces.push({
          id: `bedroom-${index}`,
          name: room.name || `Bedroom ${index + 1}`,
          type: 'bedroom',
          order: order++,
          photoRequests: generateDefaultPhotoRequests('bedroom', room.bathroomType)
        });
        
        // Add ensuite bathroom if exists
        if (room.bathroomType === 'full') {
          spaces.push({
            id: `bathroom-ensuite-${index}`,
            name: `${room.name || `Bedroom ${index + 1}`} Bathroom`,
            type: 'bathroom',
            order: order++,
            photoRequests: generateDefaultPhotoRequests('bathroom')
          });
        } else if (room.bathroomType === 'half') {
          spaces.push({
            id: `bathroom-ensuite-${index}`,
            name: `${room.name || `Bedroom ${index + 1}`} Half Bath`,
            type: 'bathroom',
            order: order++,
            photoRequests: generateDefaultPhotoRequests('bathroom', 'half')
          });
        }
      });
    }
    
    // Add remaining bathrooms
    const totalBathrooms = property.bathrooms || 0;
    const ensuiteBathrooms = property.bedroomConfig?.filter(r => r.bathroomType === 'full').length || 0;
    const ensuiteHalfBaths = property.bedroomConfig?.filter(r => r.bathroomType === 'half').length || 0;
    const remainingFullBaths = totalBathrooms - ensuiteBathrooms;
    const remainingHalfBaths = (property.halfBathrooms || 0) - ensuiteHalfBaths;
    
    for (let i = 0; i < remainingFullBaths; i++) {
      spaces.push({
        id: `bathroom-${i}`,
        name: `Bathroom ${i + 1}`,
        type: 'bathroom',
        order: order++,
        photoRequests: generateDefaultPhotoRequests('bathroom')
      });
    }
    
    for (let i = 0; i < remainingHalfBaths; i++) {
      spaces.push({
        id: `halfbath-${i}`,
        name: `Half Bath ${i + 1}`,
        type: 'bathroom',
        order: order++,
        photoRequests: generateDefaultPhotoRequests('bathroom', 'half')
      });
    }
    
    // Add common areas
    spaces.push({
      id: 'kitchen',
      name: 'Kitchen',
      type: 'kitchen',
      order: order++,
      photoRequests: generateDefaultPhotoRequests('kitchen')
    });
    
    spaces.push({
      id: 'livingroom',
      name: 'Living Room',
      type: 'livingRoom',
      order: order++,
      photoRequests: generateDefaultPhotoRequests('livingRoom')
    });
    
    return spaces;
  };

  const generateDefaultPhotoRequests = (type: string, subType?: string): PhotoRequest[] => {
    const requests: PhotoRequest[] = [];
    
    switch (type) {
      case 'bedroom':
        requests.push({
          id: `${type}-bed`,
          instruction: 'Take photo of bed made',
          location: 'Center of room',
          hint: 'Ensure pillows are fluffed and bedspread is straight',
          required: true,
          multiplePhotos: false,
          order: 0
        });
        requests.push({
          id: `${type}-closet`,
          instruction: 'Take photo of closet interior',
          location: 'Inside closet',
          hint: 'Open closet doors fully',
          required: true,
          multiplePhotos: false,
          order: 1
        });
        requests.push({
          id: `${type}-overall`,
          instruction: 'Take overall photo of room',
          location: 'Doorway',
          hint: 'Stand at entrance for best angle',
          required: true,
          multiplePhotos: false,
          order: 2
        });
        break;
        
      case 'bathroom':
        const isHalf = subType === 'half';
        if (!isHalf) {
          requests.push({
            id: `${type}-tub`,
            instruction: 'Take photo of shower/tub area',
            location: 'Inside shower',
            hint: 'Ensure shower curtain is closed or glass is clean',
            required: true,
            multiplePhotos: false,
            order: 0
          });
        }
        requests.push({
          id: `${type}-sink`,
          instruction: 'Take photo of sink and counter',
          location: 'In front of sink',
          hint: 'Clear any personal items from counter',
          required: true,
          multiplePhotos: false,
          order: isHalf ? 0 : 1
        });
        requests.push({
          id: `${type}-toilet`,
          instruction: 'Take photo of toilet',
          location: 'Side angle',
          hint: 'Ensure seat is down and clean',
          required: true,
          multiplePhotos: false,
          order: isHalf ? 1 : 2
        });
        requests.push({
          id: `${type}-overall`,
          instruction: 'Take overall photo of bathroom',
          location: 'Doorway',
          required: true,
          multiplePhotos: false,
          order: isHalf ? 2 : 3
        });
        break;
        
      case 'kitchen':
        requests.push({
          id: `${type}-counters`,
          instruction: 'Take photo of clean countertops',
          location: 'Center of kitchen',
          hint: 'Ensure all appliances are in place',
          required: true,
          multiplePhotos: false,
          order: 0
        });
        requests.push({
          id: `${type}-sink`,
          instruction: 'Take photo of sink area',
          location: 'In front of sink',
          hint: 'Sink should be empty and clean',
          required: true,
          multiplePhotos: false,
          order: 1
        });
        requests.push({
          id: `${type}-appliances`,
          instruction: 'Take photo of appliances (stove, refrigerator)',
          location: 'Side angle',
          required: true,
          multiplePhotos: true,
          order: 2
        });
        break;
        
      case 'livingRoom':
        requests.push({
          id: `${type}-sofa`,
          instruction: 'Take photo of sofa/seating area',
          location: 'Center of room',
          hint: 'Fluff pillows and straighten cushions',
          required: true,
          multiplePhotos: false,
          order: 0
        });
        requests.push({
          id: `${type}-overall`,
          instruction: 'Take overall photo of living room',
          location: 'Doorway or corner',
          required: true,
          multiplePhotos: false,
          order: 1
        });
        break;
    }
    
    return requests;
  };

  const toggleSpace = (spaceId: string) => {
    const newExpanded = new Set(expandedSpaces);
    if (newExpanded.has(spaceId)) {
      newExpanded.delete(spaceId);
    } else {
      newExpanded.add(spaceId);
    }
    setExpandedSpaces(newExpanded);
  };

  const addSpace = () => {
    const newSpace: WalkthroughSpace = {
      id: `space-${Date.now()}`,
      name: `New Space ${spaces.length + 1}`,
      type: 'other',
      order: spaces.length,
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

  const addPhotoRequest = (spaceId: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    
    const newRequest: PhotoRequest = {
      id: `photo-${Date.now()}`,
      instruction: '',
      location: '',
      hint: '',
      required: true,
      multiplePhotos: false,
      order: space.photoRequests.length
    };
    
    updateSpace(spaceId, {
      photoRequests: [...space.photoRequests, newRequest]
    });
  };

  const removePhotoRequest = (spaceId: string, requestId: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    
    updateSpace(spaceId, {
      photoRequests: space.photoRequests.filter(r => r.id !== requestId)
    });
  };

  const updatePhotoRequest = (spaceId: string, requestId: string, updates: Partial<PhotoRequest>) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    
    updateSpace(spaceId, {
      photoRequests: space.photoRequests.map(r => 
        r.id === requestId ? { ...r, ...updates } : r
      )
    });
  };

  const translateInstruction = async (spaceId: string, requestId: string, text: string, field: 'instruction' | 'hint') => {
    if (!text) return;
    
    setTranslating(`${spaceId}-${requestId}-${field}`);
    
    try {
      // Translate using a translation API or service
      // For now, we'll store the original text
      // In production, you'd call a translation API here
      
      const translations: Record<string, string> = {
        en: text
      };
      
      // Simple translation simulation - in production use Google Translate API
      for (const lang of supportedLanguages.filter(l => l !== 'en')) {
        // Store empty for now - will be filled by translation API
        translations[lang] = '';
      }
      
      updatePhotoRequest(spaceId, requestId, {
        [field]: text,
        [`${field}Translations`]: translations
      });
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setTranslating(null);
    }
  };

  const saveWalkthrough = async () => {
    setSaving(true);
    
    try {
      // Save each space as a separate document
      for (const space of spaces) {
        await setDoc(
          doc(db, 'properties', propertyId, 'walkthroughConfig', space.id),
          space
        );
      }
      
      router.push(`/${locale}/properties/${propertyId}`);
    } catch (error) {
      console.error('Error saving walkthrough:', error);
      alert('Failed to save walkthrough configuration');
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configure Walkthrough</h1>
            <p className="text-gray-500">{property.name}</p>
          </div>
          <button
            onClick={saveWalkthrough}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Configuration
              </>
            )}
          </button>
        </div>

        {/* Spaces */}
        <div className="space-y-4">
          {spaces.map((space, index) => (
            <div key={space.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Space Header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSpace(space.id)}
              >
                <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                <div className="flex-1">
                  <div className="font-medium">{space.name}</div>
                  <div className="text-sm text-gray-500">
                    {spaceTypeLabels[space.type]} • {space.photoRequests.length} photo requests
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSpace(space.id); }}
                  className="p-2 hover:bg-red-50 rounded text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {expandedSpaces.has(space.id) ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Space Details */}
              {expandedSpaces.has(space.id) && (
                <div className="border-t p-4 space-y-4">
                  {/* Space Name & Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Space Name</label>
                      <input
                        type="text"
                        value={space.name}
                        onChange={(e) => updateSpace(space.id, { name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., Master Bedroom"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={space.type}
                        onChange={(e) => updateSpace(space.id, { type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        {Object.entries(spaceTypeLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Photo Requests */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Photo Requests</label>
                      <button
                        onClick={() => addPhotoRequest(space.id)}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        + Add Photo Request
                      </button>
                    </div>

                    {space.photoRequests.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 text-center bg-gray-50 rounded-lg">
                        No photo requests. Click "Add Photo Request" to start.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {space.photoRequests.map((request, reqIndex) => (
                          <div key={request.id} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-sm font-medium text-gray-500">Request #{reqIndex + 1}</span>
                              <button
                                onClick={() => removePhotoRequest(space.id, request.id)}
                                className="text-red-500 hover:text-red-600 text-sm"
                              >
                                Remove
                              </button>
                            </div>

                            <div className="space-y-3">
                              {/* Instruction */}
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">Instruction</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={request.instruction}
                                    onChange={(e) => updatePhotoRequest(space.id, request.id, { instruction: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    placeholder="e.g., Take photo of bed made"
                                  />
                                  <button
                                    onClick={() => translateInstruction(space.id, request.id, request.instruction, 'instruction')}
                                    disabled={!request.instruction || translating === `${space.id}-${request.id}-instruction`}
                                    className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                                    title="Translate to all languages"
                                  >
                                    {translating === `${space.id}-${request.id}-instruction` ? (
                                      <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                      <Languages className="w-5 h-5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Location */}
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">Location (where to stand)</label>
                                <input
                                  type="text"
                                  value={request.location || ''}
                                  onChange={(e) => updatePhotoRequest(space.id, request.id, { location: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                  placeholder="e.g., Center of room, doorway"
                                />
                              </div>

                              {/* Hint */}
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">Hint (optional)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={request.hint || ''}
                                    onChange={(e) => updatePhotoRequest(space.id, request.id, { hint: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    placeholder="e.g., Make sure curtains are open"
                                  />
                                  <button
                                    onClick={() => translateInstruction(space.id, request.id, request.hint || '', 'hint')}
                                    disabled={!request.hint || translating === `${space.id}-${request.id}-hint`}
                                    className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                                    title="Translate to all languages"
                                  >
                                    {translating === `${space.id}-${request.id}-hint` ? (
                                      <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                      <Languages className="w-5 h-5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Options */}
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={request.required}
                                    onChange={(e) => updatePhotoRequest(space.id, request.id, { required: e.target.checked })}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                  <span className="text-sm text-gray-600">Required</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={request.multiplePhotos}
                                    onChange={(e) => updatePhotoRequest(space.id, request.id, { multiplePhotos: e.target.checked })}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                  <span className="text-sm text-gray-600">Allow multiple photos</span>
                                </label>
                              </div>
                            </div>
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

        {/* Add Space Button */}
        <button
          onClick={addSpace}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-500 hover:text-primary-600 transition"
        >
          <Plus className="w-5 h-5 inline-block mr-2" />
          Add Space
        </button>
      </div>
    </DashboardLayout>
  );
}