"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { User, Calendar, Mail, LogOut, CheckCircle, Phone } from 'lucide-react';

export default function ProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, userProfile, loading, logout, refreshProfile } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${lang}/login`);
    }
  }, [user, loading, router, lang]);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.fullName) setFullName(userProfile.fullName);
      if (userProfile.dateOfBirth) setDateOfBirth(userProfile.dateOfBirth);
      if (userProfile.phone) setPhone(userProfile.phone);
    }
  }, [userProfile]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;
    
    try {
      setIsSubmitting(true);
      setError(null);
      const userRef = doc(db, 'users', user.uid);
      // merge:true so editing the profile never wipes fields set elsewhere
      // (requester_id/type/role from the admin space, consent flags, createdAt).
      await setDoc(userRef, {
        uid: user.uid,
        fullName,
        dateOfBirth,
        phone,
        email: user.email,
      }, { merge: true });
      await refreshProfile();
      setIsEditing(false);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setError(err.message || "Failed to save profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push(`/${lang}/login`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background-default)]">
        <div className="animate-spin rounded-lg h-12 w-12 border-4 border-[#E3004F] border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  // Profile Completion Form
  if (!userProfile || !userProfile.phone) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
        <div className="max-w-md w-full space-y-8 bg-[var(--background-card)] p-8 rounded-lg shadow-xl border border-[var(--border-default)]">
          <div>
            <div className="mx-auto h-12 w-12 bg-[var(--color-bordeaux-primary)] text-white rounded-lg flex items-center justify-center font-bold">
              <User size={24} />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--text-primary)]">
              {t('complete_profile', 'Compléter votre profil')}
            </h2>
            <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
              {t('complete_profile_desc', 'Veuillez renseigner vos informations pour continuer.')}
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleProfileSubmit}>
            {error && (
              <div className="p-3 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)] rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            
            <div className="rounded-lg shadow-sm space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent sm:text-sm transition-colors"
                  placeholder={t('full_name', 'Nom complet')}
                />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent sm:text-sm transition-colors"
                  placeholder={t('date_of_birth', 'Date de naissance')}
                />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent sm:text-sm transition-colors"
                  placeholder={t('phone', 'Téléphone')}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full button-bordeaux justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <CheckCircle className="h-5 w-5 text-white/70 group-hover:text-white" aria-hidden="true" />
                </span>
                {isSubmitting ? "..." : t('save_profile', 'Enregistrer')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Normal Profile View
  return (
    <div className="min-h-[80vh] py-12 px-4 sm:px-6 lg:px-8 bg-[var(--background-default)]">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Profile Header */}
        <div className="card p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="h-24 w-24 bg-[var(--color-fuchsia-accent)]/10 text-[var(--color-fuchsia-accent)] rounded-lg flex items-center justify-center font-bold text-4xl flex-shrink-0">
            {userProfile.fullName ? userProfile.fullName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-grow text-center md:text-left">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{userProfile.fullName}</h1>
            <p className="text-[var(--text-secondary)] flex items-center justify-center md:justify-start gap-2 mt-2">
              <Mail size={16} />
              {userProfile.email || user.email}
            </p>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-2.5 border-2 border-[var(--border-default)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--background-tertiary)] hover:border-[var(--color-bordeaux-primary)] transition-all font-medium"
            >
              <LogOut size={18} />
              {t('logout', 'Déconnexion')}
            </button>
          </div>
        </div>

        {/* Profile Details */}
        <div className="card p-8">
          <div className="flex justify-between items-center mb-6 border-b border-[var(--border-default)] pb-4">
            <h2 className="text-xl font-bold text-[var(--color-bordeaux-primary)]">
              {t('personal_information', 'Informations Personnelles')}
            </h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-sm font-semibold text-[var(--color-fuchsia-accent)] hover:bg-[var(--background-secondary)] rounded-lg transition-colors border border-[var(--color-fuchsia-accent)]"
              >
                {t('edit', 'Modifier')}
              </button>
            )}
          </div>
          
          {isEditing ? (
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              {error && (
                <div className="p-3 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)] rounded-lg text-sm text-center">
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">{t('full_name', 'Nom complet')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent sm:text-sm transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">{t('date_of_birth', 'Date de naissance')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      required
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent sm:text-sm transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">{t('phone', 'Téléphone')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fuchsia-accent)] focus:border-transparent sm:text-sm transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">{t('email', 'Adresse Email')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      disabled
                      value={userProfile.email || user.email || ''}
                      className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-[var(--border-default)] bg-[var(--background-secondary)] text-[var(--text-secondary)] placeholder-[var(--text-tertiary)] focus:outline-none sm:text-sm transition-colors cursor-not-allowed opacity-75"
                    />
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)]">L'adresse email d'authentification ne peut pas être modifiée.</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setError(null);
                    if (userProfile) {
                      setFullName(userProfile.fullName || '');
                      setDateOfBirth(userProfile.dateOfBirth || '');
                      setPhone(userProfile.phone || '');
                    }
                  }}
                  className="px-6 py-2.5 border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--background-secondary)] transition-colors font-medium text-sm"
                >
                  {t('cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[var(--color-bordeaux-primary)] hover:bg-[var(--color-fuchsia-accent)] text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? '...' : t('save', 'Enregistrer')}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-[var(--background-secondary)]">
                <div className="mt-1">
                  <User className="text-[var(--color-fuchsia-accent)]" size={20} />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-tertiary)] font-medium mb-1">{t('full_name', 'Nom complet')}</p>
                  <p className="text-[var(--text-primary)] font-semibold">{userProfile.fullName}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-[var(--background-secondary)]">
                <div className="mt-1">
                  <Calendar className="text-[var(--color-fuchsia-accent)]" size={20} />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-tertiary)] font-medium mb-1">{t('date_of_birth', 'Date de naissance')}</p>
                  <p className="text-[var(--text-primary)] font-semibold">{formatDateDisplay(userProfile.dateOfBirth)}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 rounded-lg bg-[var(--background-secondary)]">
                <div className="mt-1">
                  <Mail className="text-[var(--color-fuchsia-accent)]" size={20} />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-tertiary)] font-medium mb-1">{t('email', 'Adresse Email')}</p>
                  <p className="text-[var(--text-primary)] font-semibold">{userProfile.email || user.email}</p>
                </div>
              </div>

              {userProfile.phone && (
                <div className="flex items-start gap-4 p-4 rounded-lg bg-[var(--background-secondary)]">
                  <div className="mt-1">
                    <Phone className="text-[var(--color-fuchsia-accent)]" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-tertiary)] font-medium mb-1">{t('phone', 'Téléphone')}</p>
                    <p className="text-[var(--text-primary)] font-semibold">{userProfile.phone}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
