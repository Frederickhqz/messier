'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { doc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { CleanService, Photo, RoomType } from '@/types';
import { Camera, Upload, X, ArrowLeft, Trash2, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

const roomTypes: RoomType[] = [
  'bedroom', 'bathroom', 'kitchen', 'livingRoom', 
  'diningRoom', 'office', 'garage', 'patio', 'laundry', 'other'
];

export default function PhotosPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const serviceId = params.id as string;
  const router = useRouter();
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();

  const [service, setService] = useState<CleanService | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomType>('bedroom');
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === 'admin';
  const isAssigned = service?.assignedCleaners.includes(user?.uid || '');
  const canUpload = isAdmin || isAssigned;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}`);
    }
  }, [user, authLoading, router, locale]);

  useEffect(() => {
    loadData();
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

      // Load photos
      const photosSnap = await getDocs(
        query(collection(db, 'photos'), where('serviceId', '==', serviceId))
      );
      const photosData = photosSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt?.toDate()
      })) as Photo[];
      setPhotos(photosData);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // Create unique filename
        const timestamp = Date.now();
        const fileName = `${serviceId}/${selectedRoom}/${timestamp}_${file.name}`;
        const storageRef = ref(storage, `photos/${fileName}`);

        // Upload to Firebase Storage
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        // Save metadata to Firestore
        await addDoc(collection(db, 'photos'), {
          serviceId,
          propertyId: service?.propertyId,
          roomType: selectedRoom,
          url,
          thumbnailUrl: url,
          uploadedBy: user.uid,
          uploadedAt: serverTimestamp()
        });
      }

      // Reload photos
      loadData();
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async (photo: Photo) => {
    if (!confirm('Delete this photo?')) return;

    try {
      // Delete from Storage
      const storageRef = ref(storage, photo.url);
      await deleteObject(storageRef).catch(() => {}); // Ignore if already deleted

      // Delete from Firestore
      await deleteDoc(doc(db, 'photos', photo.id));

      // Update local state
      setPhotos(photos.filter(p => p.id !== photo.id));
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo. Please try again.');
    }
  };

  const photosByRoom = roomTypes.reduce((acc, room) => {
    acc[room] = photos.filter(p => p.roomType === room);
    return acc;
  }, {} as Record<RoomType, Photo[]>);

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
        {/* Back Button */}
        <Link
          href={`/${locale}/services/${serviceId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('common.back') || 'Back'}
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('photo.title')}</h1>
            <p className="text-gray-500">{service?.propertyName}</p>
          </div>
          <div className="text-sm text-gray-500">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
          </div>
        </div>

        {/* Upload Section */}
        {canUpload && service?.status !== 'completed' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('photo.upload')}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Room Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('photo.roomType')}
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value as RoomType)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  {roomTypes.map(room => (
                    <option key={room} value={room}>
                      {t(`property.rooms.${room}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload Button */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  &nbsp;
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      {t('photo.uploading')}
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      {t('photo.upload')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Mobile Camera Button */}
            <div className="mt-4 md:hidden">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
                id="camera-input"
              />
              <label
                htmlFor="camera-input"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </label>
            </div>
          </div>
        )}

        {/* Photos by Room */}
        {photos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">{t('photo.noPhotos')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {roomTypes.map(room => {
              const roomPhotos = photosByRoom[room];
              if (roomPhotos.length === 0) return null;

              return (
                <div key={room} className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {t(`property.rooms.${room}`)}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({roomPhotos.length})
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {roomPhotos.map(photo => (
                      <div key={photo.id} className="relative group">
                        <button
                          onClick={() => setViewPhoto(photo)}
                          className="aspect-square rounded-lg overflow-hidden bg-gray-100 w-full"
                        >
                          <img
                            src={photo.url}
                            alt={photo.roomType}
                            className="w-full h-full object-cover"
                          />
                        </button>
                        {canUpload && service?.status !== 'completed' && (
                          <button
                            onClick={() => handleDeletePhoto(photo)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Photo Viewer Modal */}
        {viewPhoto && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
            onClick={() => setViewPhoto(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] p-4">
              <button
                onClick={() => setViewPhoto(null)}
                className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={viewPhoto.url}
                alt={viewPhoto.roomType}
                className="max-w-full max-h-[80vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="mt-2 text-center text-white">
                <p className="font-medium">{t(`property.rooms.${viewPhoto.roomType}`)}</p>
                <p className="text-sm text-gray-300">
                  {viewPhoto.uploadedAt?.toLocaleDateString()} {viewPhoto.uploadedAt?.toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}