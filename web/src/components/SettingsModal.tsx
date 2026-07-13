import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  LuCircleAlert,
  LuCircleCheck,
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
  gateway = supabaseAccountGateway,
}: {
  onClose(): void;
  onSignOut(): Promise<void>;
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
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    void gateway.loadProfile().then(({ profile: loadedProfile, email, error }) => {
      setLoading(false);
      if (error || !loadedProfile) {
        setFeedback({ kind: 'error', text: 'Le profil n’a pas pu être chargé.' });
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
      setFeedback({ kind: 'error', text: error });
      return;
    }
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
    setFeedback(null);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!values.displayName.trim() || !values.firstName.trim() || !values.lastName.trim()) {
      setFeedback({ kind: 'error', text: 'Le nom d’affichage, le prénom et le nom sont obligatoires.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const { profile: updatedProfile, error } = await gateway.updateProfile(values, avatar);
    setSaving(false);
    if (error || !updatedProfile) {
      setFeedback({
        kind: 'error',
        text: error?.message.includes('duplicate') || error?.message.includes('unique')
          ? 'Ce nom d’affichage est déjà utilisé.'
          : error?.message ?? 'Le profil n’a pas pu être enregistré.',
      });
      return;
    }
    setProfile(updatedProfile);
    setValues({ displayName: updatedProfile.displayName, firstName: updatedProfile.firstName, lastName: updatedProfile.lastName });
    setAvatar(null);
    setAvatarPreview(updatedProfile.avatarUrl);
    setFeedback({ kind: 'success', text: 'Profil enregistré.' });
  }

  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(newEmail.trim())) {
      setFeedback({ kind: 'error', text: 'Saisissez une adresse e-mail valide.' });
      return;
    }
    setSaving(true);
    const { error } = await gateway.requestEmailChange(newEmail.trim().toLowerCase());
    setSaving(false);
    setFeedback(error
      ? { kind: 'error', text: 'Le changement d’adresse e-mail a échoué.' }
      : { kind: 'success', text: `Un message de confirmation a été envoyé. L’adresse active reste ${activeEmail}.` });
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setFeedback({ kind: 'error', text: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
      return;
    }
    if (password !== passwordConfirmation) {
      setFeedback({ kind: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }
    setSaving(true);
    const { error } = await gateway.updatePassword(password);
    setSaving(false);
    if (!error) {
      setPassword('');
      setPasswordConfirmation('');
    }
    setFeedback(error
      ? { kind: 'error', text: 'Le mot de passe n’a pas pu être modifié.' }
      : { kind: 'success', text: 'Mot de passe modifié.' });
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <p className="dashboard-eyebrow">Gestion du compte</p>
            <h2 id="settings-title">Compte</h2>
          </div>
          <button ref={closeRef} type="button" className="settings-close" aria-label="Fermer la gestion du compte" onClick={onClose}><LuX aria-hidden="true" /></button>
        </header>

        {feedback && (
          <div className={`login-message login-message--${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
            {feedback.kind === 'error' ? <LuCircleAlert aria-hidden="true" /> : <LuCircleCheck aria-hidden="true" />}{feedback.text}
          </div>
        )}

        {loading ? <p className="settings-loading"><LuLoaderCircle className="is-spinning" aria-hidden="true" /> Chargement du profil…</p> : (
          <div className="settings-content">
            <div className="settings-profileSummary">
              {avatarPreview ? <img src={avatarPreview} alt="Avatar du compte" /> : <span aria-hidden="true">{initials(values)}</span>}
              <div><strong>{profile?.displayName}</strong><p>{activeEmail}</p></div>
            </div>

            <form className="settings-section" onSubmit={saveProfile}>
              <h3>Profil</h3>
              <label className="settings-avatarPicker"><LuUpload aria-hidden="true" /> Choisir un avatar
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={saving} onChange={(event) => chooseAvatar(event.target.files?.[0])} />
              </label>
              <label>Nom d’affichage<input value={values.displayName} disabled={saving} onChange={(event) => setValues({ ...values, displayName: event.target.value })} /></label>
              <div className="settings-fieldRow">
                <label>Prénom<input autoComplete="given-name" value={values.firstName} disabled={saving} onChange={(event) => setValues({ ...values, firstName: event.target.value })} /></label>
                <label>Nom<input autoComplete="family-name" value={values.lastName} disabled={saving} onChange={(event) => setValues({ ...values, lastName: event.target.value })} /></label>
              </div>
              <button type="submit" className="login-submit" disabled={saving}><LuSave aria-hidden="true" /> Enregistrer le profil</button>
            </form>

            <form className="settings-section" onSubmit={changeEmail}>
              <h3>Adresse e-mail</h3>
              <p>Adresse active : <strong>{activeEmail}</strong></p>
              <label>Nouvelle adresse e-mail<input type="email" autoComplete="email" value={newEmail} disabled={saving} onChange={(event) => setNewEmail(event.target.value)} /></label>
              <button type="submit" className="settings-secondaryButton" disabled={saving || newEmail.trim().toLowerCase() === activeEmail.toLowerCase()}><LuMail aria-hidden="true" /> Demander le changement</button>
            </form>

            <form className="settings-section" onSubmit={changePassword}>
              <h3>Sécurité</h3>
              <label>Nouveau mot de passe<input type="password" autoComplete="new-password" value={password} disabled={saving} onChange={(event) => setPassword(event.target.value)} /></label>
              <label>Confirmer le mot de passe<input type="password" autoComplete="new-password" value={passwordConfirmation} disabled={saving} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label>
              <button type="submit" className="settings-secondaryButton" disabled={saving}><LuKeyRound aria-hidden="true" /> Modifier le mot de passe</button>
            </form>

            <button type="button" className="settings-signOut" disabled={saving} onClick={() => void onSignOut()}><LuLogOut aria-hidden="true" /> Se déconnecter</button>
          </div>
        )}
      </section>
    </div>
  );
}

function initials(profile: ProfileInput): string {
  return `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase() || '?';
}
