'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { doc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { CleanService, Issue, IssueType } from '@/types';
import { AlertTriangle, Plus, ArrowLeft, CheckCircle, X, Camera, Upload } from 'lucide-react';
import Link from 'next/link';

const issueTypes: IssueType[] = ['extraDirty', 'maintenance', 'inventory'];

export default function IssuesPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const serviceId = params.id as string;
  const router = useRouter();
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();

  const [service, setService] = useState<CleanService | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [issueType, setIssueType] = useState<IssueType>('maintenance');
  const [description, setDescription] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === 'admin';
  const isAssigned = service?.assignedCleaners.includes(user?.uid || '');
  const canCreate = isAdmin || isAssigned;

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

      // Load issues
      const issuesSnap = await getDocs(
        query(collection(db, 'issues'), where('serviceId', '==', serviceId))
      );
      const issuesData = issuesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        reportedAt: doc.data().reportedAt?.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate()
      })) as Issue[];
      setIssues(issuesData.sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime()));

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const timestamp = Date.now();
        const fileName = `${serviceId}/issues/${timestamp}_${file.name}`;
        const storageRef = ref(storage, `photos/${fileName}`);

        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        newUrls.push(url);
      }
      setPhotoUrls([...photoUrls, ...newUrls]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !service) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'issues'), {
        serviceId,
        propertyId: service.propertyId,
        type: issueType,
        description,
        photos: photoUrls,
        reportedBy: user.uid,
        reportedAt: serverTimestamp(),
        resolved: false
      });

      // Reset form
      setIssueType('maintenance');
      setDescription('');
      setPhotoUrls([]);
      setShowForm(false);

      // Reload issues
      loadData();
    } catch (error) {
      console.error('Error creating issue:', error);
      alert('Failed to submit issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (issue: Issue) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'issues', issue.id), {
        resolved: true,
        resolvedAt: serverTimestamp(),
        resolvedBy: user.uid
      });

      // Update local state
      setIssues(issues.map(i => 
        i.id === issue.id 
          ? { ...i, resolved: true, resolvedAt: new Date(), resolvedBy: user.uid }
          : i
      ));
    } catch (error) {
      console.error('Error resolving issue:', error);
      alert('Failed to resolve issue. Please try again.');
    }
  };

  const handleUnresolve = async (issue: Issue) => {
    try {
      await updateDoc(doc(db, 'issues', issue.id), {
        resolved: false,
        resolvedAt: null,
        resolvedBy: null
      });

      setIssues(issues.map(i => 
        i.id === issue.id 
          ? { ...i, resolved: false, resolvedAt: undefined, resolvedBy: undefined }
          : i
      ));
    } catch (error) {
      console.error('Error unresolving issue:', error);
    }
  };

  const openIssues = issues.filter(i => !i.resolved);
  const resolvedIssues = issues.filter(i => i.resolved);

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
            <h1 className="text-2xl font-bold text-gray-900">{t('issue.title')}</h1>
            <p className="text-gray-500">{service?.propertyName}</p>
          </div>
          {canCreate && service?.status !== 'completed' && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <Plus className="w-5 h-5" />
              {t('issue.report')}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{openIssues.length}</p>
                <p className="text-sm text-gray-500">Open Issues</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{resolvedIssues.length}</p>
                <p className="text-sm text-gray-500">Resolved</p>
              </div>
            </div>
          </div>
        </div>

        {/* Create Issue Form */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">{t('issue.report')}</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Issue Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('issue.type.title')}
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value as IssueType)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {issueTypes.map(type => (
                      <option key={type} value={type}>
                        {t(`issue.type.${type}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('issue.description')}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Describe the issue..."
                    required
                  />
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('issue.photos')}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    {uploading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                    {uploading ? 'Uploading...' : 'Add Photos'}
                  </button>

                  {photoUrls.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {photoUrls.map((url, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPhotoUrls(photoUrls.filter((_, j) => j !== i))}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !description.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : t('common.confirm')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Open Issues */}
        {openIssues.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Open Issues ({openIssues.length})
            </h2>
            <div className="space-y-4">
              {openIssues.map(issue => (
                <div key={issue.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          {t(`issue.type.${issue.type}`)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {issue.reportedAt?.toLocaleDateString()} {issue.reportedAt?.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-2 text-gray-700">{issue.description}</p>
                      {issue.photos.length > 0 && (
                        <div className="mt-3 flex gap-2 overflow-x-auto">
                          {issue.photos.map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt=""
                              className="w-16 h-16 object-cover rounded"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleResolve(issue)}
                        className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolved Issues */}
        {resolvedIssues.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Resolved Issues ({resolvedIssues.length})
            </h2>
            <div className="space-y-3">
              {resolvedIssues.map(issue => (
                <div key={issue.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                          {t(`issue.type.${issue.type}`)}
                        </span>
                        <span className="text-sm text-gray-400">
                          Resolved {issue.resolvedAt?.toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-gray-600">{issue.description}</p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleUnresolve(issue)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {issues.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-300" />
            <p className="text-gray-500">No issues reported for this service.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}