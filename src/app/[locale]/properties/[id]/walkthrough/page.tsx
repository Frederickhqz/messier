'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { doc, getDoc, getDocs, collection, query, where, addDoc, deleteDoc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, WalkthroughStep, RoomType } from '@/types';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Lightbulb } from 'lucide-react';

export default function WalkthroughEditorPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const propertyId = params.id as string;
  const router = useRouter();
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [steps, setSteps] = useState<WalkthroughStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New step form
  const [newInstruction, setNewInstruction] = useState('');
  const [newRoomType, setNewRoomType] = useState<RoomType>('bedroom');
  const [newHint, setNewHint] = useState('');
  const [newRequired, setNewRequired] = useState(true);

  // Editing state
  const [editingStep, setEditingStep] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push(`/${locale}/dashboard`);
    }
  }, [user, profile, authLoading, router, locale]);

  useEffect(() => {
    loadData();
  }, [propertyId]);

  const loadData = async () => {
    try {
      // Load property
      const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
      if (!propertyDoc.exists()) {
        router.push(`/${locale}/properties`);
        return;
      }
      setProperty({
        id: propertyDoc.id,
        ...propertyDoc.data(),
        createdAt: propertyDoc.data().createdAt?.toDate()
      } as Property);

      // Load walkthrough steps
      const stepsQuery = query(
        collection(db, 'walkthroughSteps'),
        where('propertyId', '==', propertyId)
      );
      const stepsSnap = await getDocs(stepsQuery);
      const stepsData = stepsSnap.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }))
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0)) as WalkthroughStep[];
      setSteps(stepsData);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addStep = async () => {
    if (!newInstruction.trim()) return;

    setSaving(true);
    try {
      const stepData = {
        propertyId,
        order: steps.length,
        instruction: newInstruction.trim(),
        roomType: newRoomType,
        hint: newHint.trim() || null,
        required: newRequired,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'walkthroughSteps'), stepData);
      
      setSteps([...steps, {
        id: docRef.id,
        ...stepData,
        createdAt: new Date()
      } as WalkthroughStep]);

      // Reset form
      setNewInstruction('');
      setNewHint('');
      setNewRequired(true);

    } catch (error) {
      console.error('Error adding step:', error);
      alert('Failed to add step');
    } finally {
      setSaving(false);
    }
  };

  const updateStep = async (stepId: string, updates: Partial<WalkthroughStep>) => {
    try {
      await updateDoc(doc(db, 'walkthroughSteps', stepId), updates);
      setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s));
    } catch (error) {
      console.error('Error updating step:', error);
    }
  };

  const deleteStep = async (stepId: string) => {
    if (!confirm('Are you sure you want to delete this step?')) return;

    try {
      await deleteDoc(doc(db, 'walkthroughSteps', stepId));
      setSteps(steps.filter(s => s.id !== stepId));
    } catch (error) {
      console.error('Error deleting step:', error);
    }
  };

  const moveStep = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    
    // Update order in Firestore
    const batch = [];
    for (let i = 0; i < newSteps.length; i++) {
      batch.push(updateDoc(doc(db, 'walkthroughSteps', newSteps[i].id), { order: i }));
    }
    await Promise.all(batch);
    
    setSteps(newSteps);
  };

  const roomTypeLabels: Record<RoomType, string> = {
    bedroom: t('property.rooms.bedroom'),
    bathroom: t('property.rooms.bathroom'),
    kitchen: t('property.rooms.kitchen'),
    livingRoom: t('property.rooms.livingRoom'),
    diningRoom: t('property.rooms.diningRoom'),
    office: t('property.rooms.office'),
    garage: t('property.rooms.garage'),
    patio: t('property.rooms.patio'),
    laundry: t('property.rooms.laundry'),
    other: t('property.rooms.other')
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Photo Walkthrough Editor</h1>
            <p className="text-gray-500">{property?.name}</p>
          </div>
          <button
            onClick={() => router.push(`/${locale}/properties`)}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition"
          >
            Done
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-xl p-4">
          <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Create step-by-step photo instructions for housekeepers</li>
            <li>• Each step shows an instruction before taking the photo</li>
            <li>• Housekeepers see a preview before submitting</li>
            <li>• Required steps must be completed, optional steps can be skipped</li>
          </ul>
        </div>

        {/* Add new step form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Step</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Type
              </label>
              <select
                value={newRoomType}
                onChange={(e) => setNewRoomType(e.target.value as RoomType)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {Object.entries(roomTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instruction *
              </label>
              <input
                type="text"
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                placeholder="e.g., Take a photo of the master bedroom showing the bed is made"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hint (optional)
              </label>
              <input
                type="text"
                value={newHint}
                onChange={(e) => setNewHint(e.target.value)}
                placeholder="e.g., Make sure the pillows are visible"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="required"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <label htmlFor="required" className="text-sm text-gray-700">
                Required step (housekeepers must complete)
              </label>
            </div>

            <button
              onClick={addStep}
              disabled={!newInstruction.trim() || saving}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              {saving ? 'Adding...' : 'Add Step'}
            </button>
          </div>
        </div>

        {/* Steps list */}
        {steps.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            No walkthrough steps yet. Add your first step above.
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="bg-white rounded-xl shadow-sm p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Drag handle and order */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-gray-500">{index + 1}</span>
                    <button
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full mb-2">
                          {roomTypeLabels[step.roomType]}
                        </span>
                        <h3 className="font-medium text-gray-900">{step.instruction}</h3>
                        {step.hint && (
                          <div className="flex items-start gap-2 mt-2 text-sm text-gray-500">
                            <Lightbulb className="w-4 h-4 flex-shrink-0" />
                            {step.hint}
                          </div>
                        )}
                        <span className={`inline-block mt-2 text-xs font-medium ${
                          step.required ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {step.required ? 'Required' : 'Optional'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => deleteStep(step.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="font-medium text-gray-900 mb-3">Preview</h3>
          <p className="text-sm text-gray-500 mb-4">
            Housekeepers will see steps in this order with your instructions.
          </p>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium">
                  {index + 1}
                </span>
                <span className="text-gray-700">{step.instruction}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}