'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Property, CleanService } from '@/types';
import { WalkthroughSpace, WalkthroughItem, PhotoRequest } from '@/types/walkthrough';
import { Check, ChevronRight, Camera, CheckCircle, Circle, Loader2, ChevronDown, ChevronUp, X, AlertCircle, ArrowLeft } from 'lucide-react';

type TaskType = 'photo_required' | 'photo_optional' | 'simple';

interface Task {
  id: string;
  spaceId: string;
  spaceName: string;
  spaceOrder: number;
  itemId?: string;
  itemName?: string;
  instruction: string;
  location?: string;
  hint?: string;
  type: TaskType;
  allowMultiple: boolean;
}

type SpaceProgress = {
  spaceId: string;
  total: number;
  completed: number;
  required: number;
  requiredCompleted: number;
};

type TaskCompletion = {
  taskId: string;
  photoUrl?: string;
  markedDone: boolean;
  timestamp: Date;
};

export default function WalkthroughCompletionPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string || 'en';
  const { user, loading: authLoading } = useAuth();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [service, setService] = useState<CleanService | null>(null);
  const [spaces, setSpaces] = useState<WalkthroughSpace[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [spaceProgress, setSpaceProgress] = useState<Record<string, SpaceProgress>>({});
  const [completions, setCompletions] = useState<Record<string, TaskCompletion>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // View state
  const [currentView, setCurrentView] = useState<'spaces' | 'space_tasks' | 'task' | 'review'>('spaces');
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const propertyId = params.propertyId as string;
  const serviceId = params.serviceId as string;

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, propertyId, serviceId]);

  const loadData = async () => {
    try {
      const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
      if (!propertyDoc.exists()) {
        router.push(`/${locale}/services`);
        return;
      }
      setProperty({ id: propertyDoc.id, ...propertyDoc.data() } as Property);

      const serviceDoc = await getDoc(doc(db, 'cleanServices', serviceId));
      if (!serviceDoc.exists()) {
        router.push(`/${locale}/services`);
        return;
      }
      setService({ id: serviceDoc.id, ...serviceDoc.data() } as CleanService);

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
        
        // Flatten to tasks
        const allTasks: Task[] = [];
        const progress: Record<string, SpaceProgress> = {};
        
        spacesData.forEach((space, spaceIndex) => {
          const spaceTasks: Task[] = [];
          
          // Add tasks for each item
          space.items?.forEach(item => {
            item.photoRequests?.forEach(req => {
              const taskType: TaskType = req.required ? 'photo_required' : 'photo_optional';
              const task: Task = {
                id: `${space.id}_${item.id}_${req.id}`,
                spaceId: space.id,
                spaceName: space.name,
                spaceOrder: spaceIndex,
                itemId: item.id,
                itemName: item.name,
                instruction: req.instruction,
                location: req.location,
                hint: req.hint,
                type: req.multiplePhotos ? taskType : taskType,
                allowMultiple: req.multiplePhotos || false
              };
              spaceTasks.push(task);
              allTasks.push(task);
            });
          });
          
          // Add space-level tasks
          space.photoRequests?.forEach(req => {
            const taskType: TaskType = req.required ? 'photo_required' : 'photo_optional';
            const task: Task = {
              id: `${space.id}_${req.id}`,
              spaceId: space.id,
              spaceName: space.name,
              spaceOrder: spaceIndex,
              instruction: req.instruction,
              location: req.location,
              hint: req.hint,
              type: taskType,
              allowMultiple: req.multiplePhotos || false
            };
            spaceTasks.push(task);
            allTasks.push(task);
          });
          
          progress[space.id] = {
            spaceId: space.id,
            total: spaceTasks.length,
            completed: 0,
            required: spaceTasks.filter(t => t.type === 'photo_required').length,
            requiredCompleted: 0
          };
        });
        
        setTasks(allTasks);
        setSpaceProgress(progress);
      }
    } catch (error) {
      console.error('Error loading walkthrough:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get tasks for current space
  const getCurrentSpaceTasks = (): Task[] => {
    if (!currentSpaceId) return [];
    return tasks.filter(t => t.spaceId === currentSpaceId).sort((a, b) => {
      // Sort by item first, then by order in photo requests
      if (a.itemId && b.itemId && a.itemId !== b.itemId) return 0;
      return 0;
    });
  };

  // Get current task
  const getCurrentTask = (): Task | null => {
    const spaceTasks = getCurrentSpaceTasks();
    return spaceTasks[currentTaskIndex] || null;
  };

  // Handle photo upload
  const handlePhotoUpload = async (file: File) => {
    if (!currentSpaceId) return;
    
    const task = getCurrentTask();
    if (!task) return;
    
    setUploading(true);
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `services/${serviceId}/${currentSpaceId}/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      // Mark task complete with photo
      setCompletions(prev => ({
        ...prev,
        [task.id]: {
          taskId: task.id,
          photoUrl: downloadUrl,
          markedDone: false,
          timestamp: new Date()
        }
      }));
      
      // Update space progress
      updateSpaceProgress(task.spaceId);
      
      // Auto-advance to next task
      advanceToNextTask();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Mark task done (for photo_optional or simple tasks)
  const markTaskDone = () => {
    const task = getCurrentTask();
    if (!task) return;
    
    setCompletions(prev => ({
      ...prev,
      [task.id]: {
        taskId: task.id,
        markedDone: true,
        timestamp: new Date()
      }
    }));
    
    updateSpaceProgress(task.spaceId);
    advanceToNextTask();
  };

  // Update space progress
  const updateSpaceProgress = (spaceId: string) => {
    setTimeout(() => {
      const spaceTasks = tasks.filter(t => t.spaceId === spaceId);
      const completed = spaceTasks.filter(t => completions[t.id]).length;
      const requiredCompleted = spaceTasks.filter(t => t.type === 'photo_required' && completions[t.id]).length;
      
      setSpaceProgress(prev => ({
        ...prev,
        [spaceId]: {
          ...prev[spaceId],
          completed,
          requiredCompleted
        }
      }));
    }, 100);
  };

  // Advance to next task
  const advanceToNextTask = () => {
    const spaceTasks = getCurrentSpaceTasks();
    if (currentTaskIndex < spaceTasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
    } else {
      // End of space tasks - go to review
      setCurrentView('review');
    }
  };

  // Open a space
  const openSpace = (spaceId: string) => {
    const spaceTasks = tasks.filter(t => t.spaceId === spaceId);
    const firstIncomplete = spaceTasks.findIndex(t => !completions[t.id]);
    
    setCurrentSpaceId(spaceId);
    setCurrentTaskIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
    setCurrentView('space_tasks');
  };

  // Start task from task list
  const startTask = (taskIndex: number) => {
    setCurrentTaskIndex(taskIndex);
    setCurrentView('task');
  };

  // Check if space is complete
  const isSpaceComplete = (spaceId: string): boolean => {
    const progress = spaceProgress[spaceId];
    return progress && progress.requiredCompleted === progress.required;
  };

  // Check if all spaces complete
  const areAllSpacesComplete = (): boolean => {
    return Object.values(spaceProgress).every(p => p.requiredCompleted === p.required);
  };

  // Close service
  const closeService = async () => {
    if (!areAllSpacesComplete()) {
      alert('Please complete all required tasks before closing the service.');
      return;
    }
    
    try {
      await setDoc(doc(db, 'cleanServices', serviceId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        walkthroughCompletions: Object.entries(completions).map(([taskId, comp]) => ({
          taskId,
          photoUrl: comp.photoUrl,
          markedDone: comp.markedDone,
          timestamp: comp.timestamp
        }))
      }, { merge: true });
      
      router.push(`/${locale}/services/${serviceId}`);
    } catch (error) {
      console.error('Error closing service:', error);
      alert('Failed to close service. Please try again.');
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

  // ========== SPACES VIEW ==========
  if (currentView === 'spaces') {
    const totalProgress = Object.values(spaceProgress).reduce((acc, p) => ({
      total: acc.total + p.total,
      completed: acc.completed + p.completed,
      required: acc.required + p.required,
      requiredCompleted: acc.requiredCompleted + p.requiredCompleted
    }), { total: 0, completed: 0, required: 0, requiredCompleted: 0 });

    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h1 className="text-xl font-bold">{property?.name}</h1>
            <p className="text-sm text-gray-500">Service Walkthrough</p>
            
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Overall Progress</span>
                <span>{totalProgress.requiredCompleted}/{totalProgress.required} required</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-600 transition-all"
                  style={{ width: `${totalProgress.required > 0 ? (totalProgress.requiredCompleted / totalProgress.required) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Spaces List */}
          <div className="space-y-2">
            {spaces.map((space, index) => {
              const progress = spaceProgress[space.id];
              const isComplete = isSpaceComplete(space.id);
              
              return (
                <button
                  key={space.id}
                  onClick={() => openSpace(space.id)}
                  className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 text-left"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isComplete ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {isComplete ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{space.name}</div>
                    <div className="text-sm text-gray-500">
                      {progress?.completed || 0}/{progress?.total || 0} tasks
                      {progress && progress.requiredCompleted < progress.required && (
                        <span className="text-red-500 ml-2">
                          ({progress.required - progress.requiredCompleted} required remaining)
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              );
            })}
          </div>

          {/* Close Service Button */}
          {areAllSpacesComplete() && (
            <button
              onClick={closeService}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700"
            >
              Complete Service
            </button>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ========== SPACE TASKS VIEW ==========
  if (currentView === 'space_tasks') {
    const spaceTasks = getCurrentSpaceTasks();
    const space = spaces.find(s => s.id === currentSpaceId);
    const progress = spaceProgress[currentSpaceId || ''];

    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <button
              onClick={() => setCurrentView('spaces')}
              className="flex items-center gap-2 text-gray-600 mb-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Spaces
            </button>
            <h1 className="text-xl font-bold">{space?.name}</h1>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span>{progress?.completed}/{progress?.total} completed</span>
              {progress && progress.requiredCompleted < progress.required && (
                <span className="text-red-500">
                  {progress.required - progress.requiredCompleted} required remaining
                </span>
              )}
            </div>
            
            <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-600 transition-all"
                style={{ width: `${progress && progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Task List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {spaceTasks.map((task, index) => {
              const completion = completions[task.id];
              const isComplete = !!completion;
              
              return (
                <button
                  key={task.id}
                  onClick={() => startTask(index)}
                  className="w-full p-4 flex items-center gap-4 text-left border-b last:border-b-0 hover:bg-gray-50"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isComplete ? 'bg-green-100 text-green-600' :
                    task.type === 'photo_required' ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isComplete ? <Check className="w-5 h-5" /> : <span>{index + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    {task.itemName && (
                      <div className="text-xs text-gray-500">{task.itemName}</div>
                    )}
                    <div className="font-medium truncate">{task.instruction}</div>
                    {task.location && (
                      <div className="text-sm text-gray-500">{task.location}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {task.type === 'photo_required' && !isComplete && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded">Required</span>
                    )}
                    {task.type === 'photo_optional' && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Optional</span>
                    )}
                    {task.type === 'simple' && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded">Task</span>
                    )}
                    {isComplete && completion.photoUrl && (
                      <img src={completion.photoUrl} className="w-10 h-10 rounded object-cover" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Close Space Button */}
          <button
            onClick={() => {
              if (isSpaceComplete(currentSpaceId || '')) {
                setCurrentView('spaces');
              } else {
                // Show warning with option to continue
                const incompleteTasks = spaceTasks.filter(t => t.type === 'photo_required' && !completions[t.id]);
                const proceed = confirm(`This space has ${incompleteTasks.length} incomplete required task(s). Continue anyway?`);
                if (proceed) {
                  setCurrentView('spaces');
                }
              }
            }}
            className={`w-full py-3 rounded-xl font-medium ${
              isSpaceComplete(currentSpaceId || '')
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isSpaceComplete(currentSpaceId || '') ? 'Space Complete ✓' : 'Close Space'}
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // ========== TASK VIEW ==========
  if (currentView === 'task') {
    const task = getCurrentTask();
    const spaceTasks = getCurrentSpaceTasks();
    const completion = task ? completions[task.id] : null;
    const isComplete = !!completion;

    if (!task) {
      setCurrentView('space_tasks');
      return null;
    }

    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
            className="hidden"
          />

          {/* Header */}
          <div className="bg-white shadow-sm p-4 flex items-center justify-between">
            <button onClick={() => setCurrentView('space_tasks')} className="text-gray-600">
              <X className="w-6 h-6" />
            </button>
            <div className="text-sm text-gray-500">
              {currentTaskIndex + 1} of {spaceTasks.length}
            </div>
            <div className="w-6" />
          </div>

          {/* Task Content */}
          <div className="p-4 space-y-6">
            {/* Space & Item Info */}
            <div className="text-sm text-gray-500">
              {task.spaceName}
              {task.itemName && ` → ${task.itemName}`}
            </div>

            {/* Instruction */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-2">{task.instruction}</h2>
              {task.location && (
                <p className="text-gray-600"><span className="font-medium">Location:</span> {task.location}</p>
              )}
              {task.hint && (
                <p className="text-sm text-gray-500 mt-2">💡 {task.hint}</p>
              )}
            </div>

            {/* Task Type Badge */}
            <div className="text-center">
              {task.type === 'photo_required' && (
                <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm">Photo Required</span>
              )}
              {task.type === 'photo_optional' && (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">Photo Optional</span>
              )}
              {task.type === 'simple' && (
                <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm">Task</span>
              )}
            </div>

            {/* Completion Status */}
            {isComplete && (
              <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <div className="font-medium text-green-800">Completed</div>
                  {completion.photoUrl && (
                    <img src={completion.photoUrl} className="mt-2 rounded-lg max-h-32" />
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Photo Upload */}
              {(task.type === 'photo_required' || task.type === 'photo_optional') && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-4 bg-primary-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                  {uploading ? 'Uploading...' : isComplete ? 'Retake Photo' : 'Take Photo'}
                </button>
              )}

              {/* Mark Done (for optional/simple tasks) */}
              {(task.type === 'photo_optional' || task.type === 'simple') && !isComplete && (
                <button
                  onClick={markTaskDone}
                  className="w-full py-4 bg-gray-200 text-gray-700 rounded-xl font-medium"
                >
                  {task.type === 'simple' ? 'Mark Done' : 'Done (No Photo)'}
                </button>
              )}
            </div>

            {/* Progress Dots */}
            <div className="flex justify-center gap-2">
              {spaceTasks.map((t, i) => (
                <div
                  key={t.id}
                  className={`w-2 h-2 rounded-full ${
                    i === currentTaskIndex ? 'bg-primary-600' :
                    completions[t.id] ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
            <button
              onClick={() => currentTaskIndex > 0 && setCurrentTaskIndex(currentTaskIndex - 1)}
              disabled={currentTaskIndex === 0}
              className="flex-1 py-4 text-center text-gray-600 disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              onClick={() => {
                if (currentTaskIndex < spaceTasks.length - 1) {
                  setCurrentTaskIndex(currentTaskIndex + 1);
                } else {
                  setCurrentView('review');
                }
              }}
              className="flex-1 py-4 text-center text-primary-600 border-l"
            >
              {currentTaskIndex < spaceTasks.length - 1 ? 'Next →' : 'Review →'}
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ========== REVIEW VIEW ==========
  if (currentView === 'review') {
    const spaceTasks = getCurrentSpaceTasks();
    const space = spaces.find(s => s.id === currentSpaceId);
    const incompleteTasks = spaceTasks.filter(t => !completions[t.id]);
    const requiredIncomplete = incompleteTasks.filter(t => t.type === 'photo_required');

    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h1 className="text-xl font-bold mb-2">Review: {space?.name}</h1>
            <p className="text-gray-500">
              {spaceTasks.filter(t => completions[t.id]).length} of {spaceTasks.length} tasks completed
            </p>
          </div>

          {/* Completed Tasks */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-3 bg-green-50 text-green-800 font-medium">
              Completed ({spaceTasks.filter(t => completions[t.id]).length})
            </div>
            {spaceTasks.filter(t => completions[t.id]).map(task => {
              const comp = completions[task.id];
              return (
                <div key={task.id} className="p-4 flex items-center gap-3 border-b">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div className="flex-1">
                    <div className="font-medium">{task.instruction}</div>
                    {task.itemName && <div className="text-sm text-gray-500">{task.itemName}</div>}
                  </div>
                  {comp.photoUrl && (
                    <img src={comp.photoUrl} className="w-12 h-12 rounded object-cover" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Incomplete Tasks */}
          {incompleteTasks.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className={`p-3 font-medium ${requiredIncomplete.length > 0 ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-800'}`}>
                Incomplete ({incompleteTasks.length})
                {requiredIncomplete.length > 0 && ` - ${requiredIncomplete.length} required`}
              </div>
              {incompleteTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => {
                    const idx = spaceTasks.findIndex(t => t.id === task.id);
                    setCurrentTaskIndex(idx);
                    setCurrentView('task');
                  }}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50"
                >
                  {task.type === 'photo_required' ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{task.instruction}</div>
                    {task.itemName && <div className="text-sm text-gray-500">{task.itemName}</div>}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => setCurrentView('spaces')}
              className={`w-full py-3 rounded-xl font-medium ${
                requiredIncomplete.length === 0
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {requiredIncomplete.length === 0 ? 'Space Complete ✓' : 'Close Space Anyway'}
            </button>
            
            {requiredIncomplete.length > 0 && (
              <button
                onClick={() => {
                  const firstIncomplete = spaceTasks.findIndex(t => !completions[t.id] && t.type === 'photo_required');
                  if (firstIncomplete >= 0) {
                    setCurrentTaskIndex(firstIncomplete);
                    setCurrentView('task');
                  }
                }}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium"
              >
                Complete Required Tasks
              </button>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return null;
}