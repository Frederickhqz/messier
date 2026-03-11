'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { collection, getDocs, doc, updateDoc, serverTimestamp, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, UserRole } from '@/types';
import { UserPlus, Edit, X, Check, Mail, Shield, User as UserIcon, Ban, CheckCircle } from 'lucide-react';

export default function TeamPage() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const router = useRouter();
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('member');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}`);
    }
    if (!authLoading && profile && profile.role !== 'admin') {
      router.push(`/${locale}/dashboard`);
    }
  }, [user, authLoading, profile, router, locale]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = usersSnap.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as UserProfile[];
      setUsers(usersData.sort((a, b) => {
        if (a.displayName && b.displayName) return a.displayName.localeCompare(b.displayName);
        return (a.email || '').localeCompare(b.email || '');
      }));
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      // Check if user already exists
      const existingSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', inviteEmail.toLowerCase()))
      );
      
      if (!existingSnap.empty) {
        alert(t('team.userAlreadyExists'));
        setSubmitting(false);
        return;
      }

      // Create pending invitation (in production, you'd send an email)
      await addDoc(collection(db, 'invitations'), {
        email: inviteEmail.toLowerCase(),
        displayName: inviteName,
        role: inviteRole,
        invitedBy: user.uid,
        createdAt: serverTimestamp(),
        accepted: false
      });

      // For now, create the user profile directly (simulating invitation acceptance)
      // In production, this would be done via email link
      await addDoc(collection(db, 'users'), {
        email: inviteEmail.toLowerCase(),
        displayName: inviteName,
        role: inviteRole,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Reset and reload
      setInviteEmail('');
      setInviteName('');
      setInviteRole('member');
      setShowInviteModal(false);
      loadUsers();
    } catch (error) {
      console.error('Error inviting user:', error);
      alert(t('team.inviteFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
      setUsers(users.map(u => u.uid === userId ? { ...u, role: newRole } : u));
      setEditUserId(null);
    } catch (error) {
      console.error('Error updating role:', error);
      alert(t('team.roleUpdateFailed'));
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    if (userId === user?.uid) {
      alert(t('team.cannotDeactivateSelf'));
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        active: !currentActive,
        updatedAt: serverTimestamp()
      });
      setUsers(users.map(u => u.uid === userId ? { ...u, active: !currentActive } : u));
    } catch (error) {
      console.error('Error toggling active:', error);
      alert(t('team.statusUpdateFailed'));
    }
  };

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-800',
    member: 'bg-blue-100 text-blue-800'
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

  if (!isAdmin) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{t('team.title')}</h1>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <UserPlus className="w-5 h-5" />
            {t('team.addMember')}
          </button>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                <p className="text-sm text-gray-500">Total Members</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'admin').length}</p>
                <p className="text-sm text-gray-500">Admins</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.active).length}</p>
                <p className="text-sm text-gray-500">Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('team.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('team.email')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('team.role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('team.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(member => (
                <tr key={member.uid} className={!member.active ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-600">
                          {(member.displayName || member.email || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {member.displayName || 'No name'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {member.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editUserId === member.uid ? (
                      <select
                        defaultValue={member.role}
                        onChange={(e) => handleUpdateRole(member.uid, e.target.value as UserRole)}
                        className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                        onBlur={() => setEditUserId(null)}
                      >
                        <option value="member">{t('roles.member')}</option>
                        <option value="admin">{t('roles.admin')}</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${roleColors[member.role]}`}>
                        {t(`roles.${member.role}`)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      member.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {member.active ? t('team.activeMember') : t('team.inactiveMember')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditUserId(member.uid)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition"
                        title={t('team.changeRole')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(member.uid, member.active)}
                        className={`p-2 transition ${
                          member.active ? 'text-red-400 hover:text-red-600' : 'text-green-400 hover:text-green-600'
                        }`}
                        title={member.active ? t('team.deactivate') : t('team.activate')}
                        disabled={member.uid === user?.uid}
                      >
                        {member.active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <UserIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">{t('team.noTeamMembers')}</p>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{t('team.addMember')}</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('team.name')}
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder={t('common.placeholders.memberName')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('team.email')}
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder={t('common.placeholders.memberEmail')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('team.role')}
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="member">{t('roles.member')}</option>
                  <option value="admin">{t('roles.admin')}</option>
                </select>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <Mail className="w-5 h-5 mt-0.5" />
                  <div>
                    <p className="font-medium">Invitation will be sent</p>
                    <p className="text-blue-600">The user will receive an email to set their password and join.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}