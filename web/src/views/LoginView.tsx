import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Checkbox, PasswordInput, TextInput } from '@mantine/core';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuKeyRound,
  LuLoaderCircle,
  LuLogIn,
  LuMail,
  LuUserRoundPlus,
} from 'react-icons/lu';
import { useAuth } from '../components/AuthProvider';
import { AccountRequestForm } from '../components/AccountRequestForm';
import logo from '../assets/logo.svg';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginView({ sessionExpired = false }: { sessionExpired?: boolean }) {
  const { signIn, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [message, setMessage] = useState(sessionExpired ? 'Votre session a expiré. Veuillez vous reconnecter.' : '');
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('error');
  const [submitting, setSubmitting] = useState(false);
  const [requestingAccount, setRequestingAccount] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionExpired) {
      setMessage('Votre session a expiré. Veuillez vous reconnecter.');
      setMessageKind('error');
    }
  }, [sessionExpired]);

  function validate(): boolean {
    const nextEmailError = EMAIL_PATTERN.test(email.trim()) ? '' : 'Saisissez une adresse e-mail valide.';
    const nextPasswordError = password ? '' : 'Saisissez votre mot de passe.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError) emailRef.current?.focus();
    else if (nextPasswordError) passwordRef.current?.focus();
    return !nextEmailError && !nextPasswordError;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !validate()) return;

    setSubmitting(true);
    setMessage('');
    const { error } = await signIn(email.trim(), password, remember);
    setSubmitting(false);

    if (error) {
      const rateLimited = 'status' in error && error.status === 429;
      setMessage(rateLimited
        ? 'Trop de tentatives ont été détectées. Réessayez dans quelques instants.'
        : 'Connexion impossible. Vérifiez vos identifiants puis réessayez.');
      setMessageKind('error');
      setPassword('');
      passwordRef.current?.focus();
    }
  }

  async function handlePasswordReset() {
    const normalizedEmail = email.trim();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailError('Saisissez votre adresse e-mail avant de continuer.');
      emailRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setMessage('');
    const { error } = await requestPasswordReset(normalizedEmail);
    setSubmitting(false);
    setMessageKind(error ? 'error' : 'success');
    setMessage(error
      ? 'Le service de réinitialisation est indisponible. Réessayez plus tard.'
      : 'Si cette adresse correspond à un compte, un e-mail de réinitialisation vient d’être envoyé.');
  }

  const valid = EMAIL_PATTERN.test(email.trim()) && Boolean(password);

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <header className="login-brand">
          <span
            className="login-brand__logo"
            role="img"
            aria-label="Logo BatiBrain"
            style={{ '--login-logo': `url(${logo})` } as React.CSSProperties}
          />
          <p className="login-brand__name" aria-label="BatiBrain">
            <span className="login-brand__nameBati">Bati</span><span className="login-brand__nameBrain">Brain</span>
          </p>
          <h1 id="login-title">{requestingAccount ? 'Demande de compte' : 'Connexion'}</h1>
        </header>

        {requestingAccount ? (
          <AccountRequestForm onBack={() => setRequestingAccount(false)} />
        ) : (
          <>
        {message && (
          <div className={`login-message login-message--${messageKind}`} role={messageKind === 'error' ? 'alert' : 'status'}>
            {messageKind === 'error' ? <LuCircleAlert aria-hidden="true" /> : <LuCircleCheck aria-hidden="true" />}
            <span>{message}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <TextInput ref={emailRef} id="login-email" type="email" label="Adresse e-mail" leftSection={<LuMail aria-hidden="true" />} autoComplete="email" value={email} disabled={submitting}
            aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'login-email-error' : undefined}
            onBlur={() => email && setEmailError(EMAIL_PATTERN.test(email.trim()) ? '' : 'Saisissez une adresse e-mail valide.')}
            onChange={(event) => { setEmail(event.target.value); setEmailError(''); }} />
          {emailError && <p id="login-email-error" className="login-fieldError">{emailError}</p>}

          <PasswordInput ref={passwordRef} id="login-password" label="Mot de passe" autoComplete="current-password"
              value={password} disabled={submitting} aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? 'login-password-error' : undefined}
              onChange={(event) => { setPassword(event.target.value); setPasswordError(''); }} />
          {passwordError && <p id="login-password-error" className="login-fieldError">{passwordError}</p>}

          <div className="login-options">
            <Checkbox className="login-checkbox" checked={remember} disabled={submitting} label="Se souvenir de moi"
              onChange={(event) => setRemember(event.target.checked)} />
            <Button variant="subtle" type="button" className="login-link" disabled={submitting} onClick={handlePasswordReset}>
              <LuKeyRound aria-hidden="true" /> Mot de passe oublié ?
            </Button>
          </div>

          <Button className="login-submit" type="submit" disabled={!valid || submitting} loading={submitting}>
            {submitting ? <LuLoaderCircle className="is-spinning" aria-hidden="true" /> : <LuLogIn aria-hidden="true" />}
            {submitting ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>

        <Button variant="subtle" type="button" className="login-create" onClick={() => setRequestingAccount(true)}>
          <LuUserRoundPlus aria-hidden="true" /> Créer un compte
        </Button>
        <p className="login-security">Votre session est sécurisée par Supabase Auth.</p>
          </>
        )}
      </section>
    </main>
  );
}
