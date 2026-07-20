import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { ActionIcon, Button, FileInput, PasswordInput, TextInput } from '@mantine/core';
import {
  LuCircleAlert,
  LuKeyRound,
  LuLoaderCircle,
  LuLogOut,
  LuMail,
  LuSave,
  LuUpload,
  LuX,
} from 'react-icons/lu';
import type { UserProfile } from '../domain/types';
import {
  supabaseAccountGateway,
  validateAvatar,
  type AccountGateway,
  type ProfileInput,
} from '../data/supabase/account';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_PROFILE: ProfileInput = { displayName: '', firstName: '', lastName: '' };

export function SettingsModal({
  onClose,
  onSignOut,
  onProfileUpdated,
  gateway = supabaseAccountGateway,
}: {
  onClose(): void;
  onSignOut(): Promise<void>;
  onProfileUpdated?(profile: UserProfile): void;
  gateway?: AccountGateway;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [values, setValues] = useState<ProfileInput>(EMPTY_PROFILE);
  const [activeEmail, setActiveEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    void gateway.loadProfile().then(({ profile: loadedProfile, email, error }) => {
      setLoading(false);
      if (error || !loadedProfile) {
        setError('Le profil n’a pas pu être chargé.');
        return;
      }
      setProfile(loadedProfile);
      setValues({ displayName: loadedProfile.displayName, firstName: loadedProfile.firstName, lastName: loadedProfile.lastName });
      setActiveEmail(email);
      setNewEmail(email);
      setAvatarPreview(loadedProfile.avatarUrl);
    });
  }, [gateway]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => () => {
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  function chooseAvatar(file: File | undefined) {
    if (!file) return;
    const error = validateAvatar(file);
    if (error) {
      setError(error);
      return;
    }
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError(null);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!values.displayName.trim() || !values.firstName.trim() || !values.lastName.trim()) {
      setError('Le nom d’affichage, le prénom et le nom sont obligatoires.');
      return;
    }
    setSaving(true);
    setError(null);
    setEmailNotice('');
    const { profile: updatedProfile, error } = await gateway.updateProfile(values, avatar);
    setSaving(false);
    if (error || !updatedProfile) {
      setError(
        error?.message.includes('duplicate') || error?.message.includes('unique')
          ? 'Ce nom d’affichage est déjà utilisé.'
          : error?.message ?? 'Le profil n’a pas pu être enregistré.',
      );
      return;
    }
    setProfile(updatedProfile);
    setValues({ displayName: updatedProfile.displayName, firstName: updatedProfile.firstName, lastName: updatedProfile.lastName });
    setAvatar(null);
    setAvatarPreview(updatedProfile.avatarUrl);
    onProfileUpdated?.(updatedProfile);
  }

  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(newEmail.trim())) {
      setError('Saisissez une adresse e-mail valide.');
      return;
    }
    setSaving(true);
    setError(null);
    setEmailNotice('');
    const { error } = await gateway.requestEmailChange(newEmail.trim().toLowerCase());
    setSaving(false);
    if (error) setError('Le changement d’adresse e-mail a échoué.');
    else setEmailNotice(`Un message de confirmation a été envoyé. L’adresse active reste ${activeEmail}.`);
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    setError(null);
    setEmailNotice('');
    const { error } = await gateway.updatePassword(password);
    setSaving(false);
    if (!error) {
      setPassword('');
      setPasswordConfirmation('');
    }
    if (error) setError('Le mot de passe n’a pas pu être modifié.');
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <p className="dashboard-eyebrow">Gestion du compte</p>
            <h2 id="settings-title">Compte</h2>
          </div>
          <ActionIcon ref={closeRef} variant="subtle" className="settings-close" aria-label="Fermer la gestion du compte" onClick={onClose}><LuX aria-hidden="true" /></ActionIcon>
        </header>

        {error && <div className="login-message login-message--error" role="alert"><LuCircleAlert aria-hidden="true" />{error}</div>}
        {emailNotice && <div className="login-message login-message--success" role="status">{emailNotice}</div>}

        {loading ? <p className="settings-loading"><LuLoaderCircle className="is-spinning" aria-hidden="true" /> Chargement du profil…</p> : (
          <div className="settings-content">
            <div className="settings-profileSummary">
              {avatarPreview ? <img src={avatarPreview} alt="Avatar du compte" /> : <span aria-hidden="true">{initials(values)}</span>}
              <div><strong>{profile?.displayName}</strong><p>{activeEmail}</p></div>
            </div>

            <form className="settings-section" onSubmit={saveProfile}>
              <h3>Profil</h3>
              <FileInput className="settings-avatarPicker" label="Choisir un avatar" leftSection={<LuUpload aria-hidden="true" />} accept="image/jpeg,image/png,image/webp,image/gif" disabled={saving} onChange={(file) => chooseAvatar(file ?? undefined)} />
              <TextInput label="Nom d’affichage" value={values.displayName} disabled={saving} onChange={(event) => setValues({ ...values, displayName: event.target.value })} />
              <div className="settings-fieldRow">
                <TextInput label="Prénom" autoComplete="given-name" value={values.firstName} disabled={saving} onChange={(event) => setValues({ ...values, firstName: event.target.value })} />
                <TextInput label="Nom" autoComplete="family-name" value={values.lastName} disabled={saving} onChange={(event) => setValues({ ...values, lastName: event.target.value })} />
              </div>
              <Button type="submit" className="login-submit" loading={saving} leftSection={<LuSave aria-hidden="true" />}>Enregistrer le profil</Button>
            </form>

            <form className="settings-section" onSubmit={changeEmail}>
              <h3>Adresse e-mail</h3>
              <p>Adresse active : <strong>{activeEmail}</strong></p>
              <TextInput label="Nouvelle adresse e-mail" type="email" autoComplete="email" value={newEmail} disabled={saving} onChange={(event) => setNewEmail(event.target.value)} />
              <Button type="submit" variant="light" className="settings-secondaryButton" disabled={saving || newEmail.trim().toLowerCase() === activeEmail.toLowerCase()} leftSection={<LuMail aria-hidden="true" />}>Demander le changement</Button>
            </form>

            <form className="settings-section" onSubmit={changePassword}>
              <h3>Sécurité</h3>
              <PasswordInput label="Nouveau mot de passe" autoComplete="new-password" value={password} disabled={saving} onChange={(event) => setPassword(event.target.value)} />
              <PasswordInput label="Confirmer le mot de passe" autoComplete="new-password" value={passwordConfirmation} disabled={saving} onChange={(event) => setPasswordConfirmation(event.target.value)} />
              <Button type="submit" variant="light" className="settings-secondaryButton" loading={saving} leftSection={<LuKeyRound aria-hidden="true" />}>Modifier le mot de passe</Button>
            </form>

            <Button color="red" variant="light" className="settings-signOut" disabled={saving} onClick={() => void onSignOut()} leftSection={<LuLogOut aria-hidden="true" />}>Se déconnecter</Button>
          </div>
        )}
      </section>
    </div>
  );
}

function initials(profile: ProfileInput): string {
  return `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase() || '?';
}
