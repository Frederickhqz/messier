'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { doc, getDoc, getDocs, collection, query, where, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { CleanService, Property, WalkthroughStep, WalkthroughCompletion, RoomType } from '@/types';
import { Camera, ArrowLeft, ArrowRight, CheckCircle, X, Lightbulb, RotateCcw } from 'lucide-react';

export default function WalkthroughPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const serviceId = params.id as string;
  const router = useRouter();
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();

  const [service, setService] = useState<CleanService | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [steps, setSteps] = useState<WalkthroughStep[]>([]);
  const [completions, setCompletions] = useState<Map<string, WalkthroughCompletion>>(new Map());
  const [loading, setLoading] = useState(true);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => completions.has(s.id)).length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}`);
    }
  }, [user, authLoading, router, locale]);

  useEffect(() => {
    loadData();
    return () => {
      // Cleanup camera stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [serviceId]);

  const loadData = async () => {
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
        createdAt: serviceDoc.data().createdAt?.toDate()
      } as CleanService;
      setService(serviceData);

      // Load property
      const propertyDoc = await getDoc(doc(db, 'properties', serviceData.propertyId));
      if (propertyDoc.exists()) {
        setProperty({
          id: propertyDoc.id,
          ...propertyDoc.data(),
          createdAt: propertyDoc.data().createdAt?.toDate()
        } as Property);
      }

      // Load walkthrough steps
      const stepsQuery = query(
        collection(db, 'walkthroughSteps'),
        where('propertyId', '==', serviceData.propertyId),
        where('required', '==', true)
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

      // Load existing completions
      const completionsQuery = query(
        collection(db, 'walkthroughCompletions'),
        where('serviceId', '==', serviceId)
      );
      const completionsSnap = await getDocs(completionsQuery);
      const completionsMap = new Map();
      completionsSnap.docs.forEach(doc => {
        const data = {
          id: doc.id,
          ...doc.data(),
          completedAt: doc.data().completedAt?.toDate()
        } as WalkthroughCompletion;
        completionsMap.set(data.stepId, data);
      });
      setCompletions(completionsMap);

      // Find first incomplete step
      const firstIncomplete = stepsData.findIndex(s => !completionsMap.has(s.id));
      if (firstIncomplete !== -1) {
        setCurrentStepIndex(firstIncomplete);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCapturedPhoto(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  const uploadPhoto = async () => {
    if (!capturedPhoto || !currentStep || !user) return;

    setUploading(true);
    try {
      // Create thumbnail
      const thumbnail = await createThumbnail(capturedPhoto);

      // Upload to Firebase Storage
      const photoPath = `services/${serviceId}/walkthrough/${currentStep.id}_${Date.now()}.jpg`;
      const thumbPath = `services/${serviceId}/walkthrough/${currentStep.id}_${Date.now()}_thumb.jpg`;

      const photoRef = ref(storage, photoPath);
      const thumbRef = ref(storage, thumbPath);

      // Upload original
      await uploadString(photoRef, capturedPhoto, 'data_url');
      const photoUrl = await getDownloadURL(photoRef);

      // Upload thumbnail
      await uploadString(thumbRef, thumbnail, 'data_url');
      const thumbUrl = await getDownloadURL(thumbRef);

      // Save to Firestore
      await addDoc(collection(db, 'walkthroughCompletions'), {
        serviceId,
        propertyId: service?.propertyId,
        stepId: currentStep.id,
        photoUrl,
        thumbnailUrl: thumbUrl,
        notes: notes || null,
        completedBy: user.uid,
        completedAt: serverTimestamp(),
        approved: false
      });

      // Also save to device gallery
      try {
        const response = await fetch(capturedPhoto);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${property?.name || 'property'}_${currentStep.roomType}_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.log('Could not save to gallery:', e);
      }

      // Reload completions
      const completionsQuery = query(
        collection(db, 'walkthroughCompletions'),
        where('serviceId', '==', serviceId)
      );
      const completionsSnap = await getDocs(completionsQuery);
      const completionsMap = new Map();
      completionsSnap.docs.forEach(doc => {
        const data = {
          id: doc.id,
          ...doc.data(),
          completedAt: doc.data().completedAt?.toDate()
        } as WalkthroughCompletion;
        completionsMap.set(data.stepId, data);
      });
      setCompletions(completionsMap);

      // Move to next step
      setCapturedPhoto(null);
      setNotes('');
      
      const nextIncompleteIndex = steps.findIndex((s, i) => i > currentStepIndex && !completionsMap.has(s.id));
      if (nextIncompleteIndex !== -1) {
        setCurrentStepIndex(nextIncompleteIndex);
      } else if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      }

    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const createThumbnail = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 400;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = dataUrl;
    });
  };

  const goToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
      setCapturedPhoto(null);
      setNotes('');
    }
  };

  const skipStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setCapturedPhoto(null);
      setNotes('');
    }
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

  if (steps.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Walkthrough Configured</h2>
            <p className="text-gray-500 mb-4">This property doesn't have a photo walkthrough set up yet.</p>
            <button
              onClick={() => router.push(`/${locale}/services/${serviceId}`)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              Back to Service
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push(`/${locale}/services/${serviceId}`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <span className="text-sm text-gray-500">
              {completedSteps} / {totalSteps} completed
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Property name */}
          <p className="mt-2 text-sm text-gray-500">{property?.name}</p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const isCompleted = completions.has(step.id);
            const isCurrent = index === currentStepIndex;
            return (
              <button
                key={step.id}
                onClick={() => goToStep(index)}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-medium transition ${
                  isCompleted 
                    ? 'bg-green-500 text-white' 
                    : isCurrent 
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
              </button>
            );
          })}
        </div>

        {/* Camera View */}
        {showCamera && (
          <div className="fixed inset-0 z-50 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex justify-center gap-4">
                <button
                  onClick={stopCamera}
                  className="p-4 bg-red-500 text-white rounded-full"
                >
                  <X className="w-8 h-8" />
                </button>
                <button
                  onClick={capturePhoto}
                  className="p-4 bg-white text-black rounded-full"
                >
                  <Camera className="w-8 h-8" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview View */}
        {capturedPhoto && !showCamera && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="relative">
              <img src={capturedPhoto} alt="Captured" className="w-full" />
              <button
                onClick={() => setCapturedPhoto(null)}
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-500">
                Review your photo before submitting. Make sure it clearly shows what's required.
              </p>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Any additional notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setCapturedPhoto(null); startCamera(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  <RotateCcw className="w-5 h-5" />
                  Retake
                </button>
                <button
                  onClick={uploadPhoto}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step Content */}
        {!capturedPhoto && !showCamera && currentStep && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            {/* Room type badge */}
            <div className="mb-4">
              <span className="px-3 py-1 bg-primary-100 text-primary-700 text-sm font-medium rounded-full">
                {roomTypeLabels[currentStep.roomType]}
              </span>
            </div>

            {/* Instruction */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {currentStep.instruction}
            </h2>

            {/* Hint */}
            {currentStep.hint && (
              <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg mb-6">
                <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">{currentStep.hint}</p>
              </div>
            )}

            {/* Completion status */}
            {completions.has(currentStep.id) && (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg mb-6">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Photo completed</p>
                  <p className="text-sm text-green-600">
                    {completions.get(currentStep.id)?.completedAt?.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {!completions.has(currentStep.id) && (
                <button
                  onClick={startCamera}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  <Camera className="w-6 h-6" />
                  Take Photo
                </button>
              )}
              {!currentStep.required && !completions.has(currentStep.id) && (
                <button
                  onClick={skipStep}
                  className="px-6 py-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => goToStep(currentStepIndex - 1)}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Previous
          </button>
          
          <button
            onClick={() => goToStep(currentStepIndex + 1)}
            disabled={currentStepIndex === steps.length - 1}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Completion message */}
        {completedSteps === totalSteps && (
          <div className="bg-green-50 rounded-xl p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-800 mb-2">All Photos Complete!</h3>
            <p className="text-green-600 mb-4">You've completed the photo walkthrough for this service.</p>
            <button
              onClick={() => router.push(`/${locale}/services/${serviceId}`)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Return to Service
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}