'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Property, CleanService } from '@/types';
import { WalkthroughSpace, WalkthroughItem, PhotoRequest } from '@/types/walkthrough';
import { Check, ChevronRight, Camera, CheckCircle, Circle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface Step {
  spaceId: string;
  spaceName: string;
  itemId?: string;
  itemName?: string;
  requestId: string;
  request: PhotoRequest;
}

export default function WalkthroughCompletionPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string || 'en';
  const { user, profile, loading: authLoading } = useAuth();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [service, setService] = useState<CleanService | null>(null);
  const [spaces, setSpaces] = useState<WalkthroughSpace[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  
  const propertyId = params.propertyId as string;
  const serviceId = params.serviceId as string;

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, propertyId, serviceId]);

  const loadData = async () => {
    try {
      // Load property
      const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
      if (!propertyDoc.exists()) {
        router.push(`/${locale}/services`);
        return;
      }
      setProperty({ id: propertyDoc.id, ...propertyDoc.data() } as Property);

      // Load service
      const serviceDoc = await getDoc(doc(db, 'cleanServices', serviceId));
      if (!serviceDoc.exists()) {
        router.push(`/${locale}/services`);
        return;
      }
      setService({ id: serviceDoc.id, ...serviceDoc.data() } as CleanService);

      // Load walkthrough config
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
        
        // Flatten to steps
        const allSteps: Step[] = [];
        spacesData.forEach(space => {
          // Add steps for each item
          space.items?.forEach(item => {
            item.photoRequests?.forEach(req => {
              allSteps.push({
                spaceId: space.id,
                spaceName: space.name,
                itemId: item.id,
                itemName: item.name,
                requestId: req.id,
                request: req
              });
            });
          });
          
          // Add space-level steps
          space.photoRequests?.forEach(req => {
            allSteps.push({
              spaceId: space.id,
              spaceName: space.name,
              requestId: req.id,
              request: req
            });
          });
        });
        
        setSteps(allSteps);
        setExpandedSpaces(new Set(spacesData.map(s => s.id)));
      }
    } catch (error) {
      console.error('Error loading walkthrough:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (step: Step, files: FileList) => {
    if (!user || !files[0]) return;
    
    setUploading(true);
    try {
      const file = files[0];
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `services/${serviceId}/${step.spaceId}/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      // Mark step as completed
      setCompletedSteps(prev => ({
        ...prev,
        [step.requestId]: [downloadUrl]
      }));
      
      // Auto-advance to next step
      if (currentStep < steps.length - 1) {
        setTimeout(() => setCurrentStep(currentStep + 1), 300);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleMarkComplete = (step: Step) => {
    setCompletedSteps(prev => ({
      ...prev,
      [step.requestId]: ['completed']
    }));
    
    // Auto-advance to next step
    if (currentStep < steps.length - 1) {
      setTimeout(() => setCurrentStep(currentStep + 1), 300);
    }
  };

  const handleSkipStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completedCount = Object.keys(completedSteps).filter(id => completedSteps[id]?.length > 0).length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;
  const requiredSteps = steps.filter(s => s.request.required);
  const requiredCompleted = requiredSteps.filter(s => completedSteps[s.requestId]?.length > 0).length;
  const canComplete = requiredSteps.every(s => completedSteps[s.requestId]?.length > 0);

  const handleSubmitWalkthrough = async () => {
    if (!canComplete) {
      alert('Please complete all required steps');
      return;
    }
    
    try {
      // Save completion data
      await setDoc(doc(db, 'walkthroughCompletions', `${serviceId}_${propertyId}`), {
        serviceId,
        propertyId,
        completedBy: user?.uid,
        completedAt: serverTimestamp(),
        steps: Object.entries(completedSteps).map(([requestId, urls]) => ({
          requestId,
          photoUrls: urls.filter(u => u !== 'completed'),
          markedComplete: urls.includes('completed')
        }))
      });
      
      // Update service status
      await setDoc(doc(db, 'cleanServices', serviceId), {
        walkthroughProgress: steps.length,
        walkthroughTotal: steps.length,
        walkthroughCompletedAt: serverTimestamp()
      }, { merge: true });
      
      router.push(`/${locale}/services/${serviceId}`);
    } catch (error) {
      console.error('Error saving walkthrough:', error);
      alert('Failed to save walkthrough. Please try again.');
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

  if (steps.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">No Walkthrough Configured</h2>
            <p className="text-gray-500 mb-4">This property doesn't have a walkthrough set up yet.</p>
            <button
              onClick={() => router.push(`/${locale}/services/${serviceId}`)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg"
            >
              Back to Service
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const currentStepData = steps[currentStep];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Progress Header */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-semibold">{property?.name}</h1>
              <p className="text-sm text-gray-500">
                {completedCount} of {steps.length} steps completed
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-600">
                {Math.round(progress)}%
              </div>
              <div className="text-xs text-gray-500">
                {requiredCompleted}/{requiredSteps.length} required
              </div>
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Space Overview */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-medium">Spaces</h2>
          </div>
          <div className="divide-y">
            {spaces.map(space => {
              const spaceSteps = steps.filter(s => s.spaceId === space.id);
              const spaceCompleted = spaceSteps.filter(s => completedSteps[s.requestId]?.length > 0).length;
              const isExpanded = expandedSpaces.has(space.id);
              
              return (
                <div key={space.id}>
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedSpaces);
                      if (newExpanded.has(space.id)) newExpanded.delete(space.id);
                      else newExpanded.add(space.id);
                      setExpandedSpaces(newExpanded);
                    }}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      {spaceCompleted === spaceSteps.length ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300" />
                      )}
                      <span className="font-medium">{space.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{spaceCompleted}/{spaceSteps.length}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-1">
                      {spaceSteps.map(step => (
                        <button
                          key={step.requestId}
                          onClick={() => setCurrentStep(steps.findIndex(s => s.requestId === step.requestId))}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg text-left ${
                            steps.findIndex(s => s.requestId === step.requestId) === currentStep
                              ? 'bg-primary-50 border border-primary-200'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {completedSteps[step.requestId]?.length > 0 ? (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : step.request.required ? (
                            <Circle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {step.itemName ? `${step.itemName}: ` : ''}{step.request.instruction}
                            </div>
                            {step.request.required && !completedSteps[step.requestId]?.length && (
                              <span className="text-xs text-red-500">Required</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Step */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <span>{currentStepData.spaceName}</span>
              {currentStepData.itemName && (
                <>
                  <ChevronRight className="w-4 h-4" />
                  <span>{currentStepData.itemName}</span>
                </>
              )}
            </div>
            
            <h2 className="text-xl font-semibold mb-2">
              {currentStepData.request.instruction}
            </h2>
            
            {currentStepData.request.location && (
              <p className="text-gray-600 mb-1">
                <span className="font-medium">Location:</span> {currentStepData.request.location}
              </p>
            )}
            
            {currentStepData.request.hint && (
              <p className="text-sm text-gray-500 mb-4">
                💡 {currentStepData.request.hint}
              </p>
            )}

            {currentStepData.request.required && !completedSteps[currentStepData.requestId]?.length && (
              <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
                ⚠️ This step is required
              </div>
            )}

            {/* Already completed */}
            {completedSteps[currentStepData.requestId]?.length > 0 && (
              <div className="mb-4 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                <Check className="w-4 h-4" />
                Step completed
                {completedSteps[currentStepData.requestId][0] !== 'completed' && (
                  <a 
                    href={completedSteps[currentStepData.requestId][0]} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View photo
                  </a>
                )}
              </div>
            )}

            {/* Upload area */}
            {currentStepData.request.multiplePhotos || !completedSteps[currentStepData.requestId]?.length ? (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && handlePhotoUpload(currentStepData, e.target.files)}
                  className="hidden"
                  id="photo-upload"
                  disabled={uploading}
                />
                <label
                  htmlFor="photo-upload"
                  className={`flex flex-col items-center gap-2 cursor-pointer ${uploading ? 'opacity-50' : ''}`}
                >
                  {uploading ? (
                    <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
                  ) : (
                    <Camera className="w-12 h-12 text-gray-400" />
                  )}
                  <span className="text-gray-600">
                    {uploading ? 'Uploading...' : 'Tap to take photo'}
                  </span>
                  {currentStepData.request.multiplePhotos && (
                    <span className="text-xs text-gray-400">Multiple photos allowed</span>
                  )}
                </label>
              </div>
            ) : null}

            {/* Action buttons */}
            <div className="mt-4 flex gap-2">
              {!currentStepData.request.required && !completedSteps[currentStepData.requestId]?.length && (
                <button
                  onClick={() => handleMarkComplete(currentStepData)}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Mark Complete (No Photo)
                </button>
              )}
              
              {!currentStepData.request.required && currentStep < steps.length - 1 && (
                <button
                  onClick={handleSkipStep}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Skip
                </button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex border-t">
            <button
              onClick={handlePreviousStep}
              disabled={currentStep === 0}
              className="flex-1 py-3 text-center text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              onClick={() => currentStep < steps.length - 1 && setCurrentStep(currentStep + 1)}
              disabled={currentStep === steps.length - 1}
              className="flex-1 py-3 text-center text-primary-600 hover:bg-primary-50 disabled:opacity-50 border-l"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Submit Button */}
        {canComplete && (
          <button
            onClick={handleSubmitWalkthrough}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700"
          >
            Complete Walkthrough
          </button>
        )}
      </div>
    </DashboardLayout>
  );
}