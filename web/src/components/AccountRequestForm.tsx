import React, { useRef, useState, type FormEvent, type RefObject } from 'react';
import { Button, TextInput } from '@mantine/core';
import { LuArrowLeft, LuCircleAlert, LuCircleCheck, LuLoaderCircle, LuMail, LuSend, LuUserRound } from 'react-icons/lu';
import {
  submitAccountRequest,
  type AccountRequestInput,
  type AccountRequestResult,
} from '../data/supabase/accountRequests';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type FieldName = keyof AccountRequestInput;

function RequestField({
  field,
  label,
  type = 'text',
  icon,
  inputRef,
  value,
  error,
  disabled,
  onChange,
}: {
  field: FieldName;
  label: string;
  type?: 'text' | 'email';
  icon: React.ReactNode;
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  error?: string;
  disabled: boolean;
  onChange(value: string): void;
}) {
  const errorId = `account-request-${field}-error`;
  return (
    <>
      <TextInput
        ref={inputRef}
        id={`account-request-${field}`}
        type={type}
        label={label}
        leftSection={icon}
        autoComplete={field === 'email' ? 'email' : field === 'firstName' ? 'given-name' : field === 'lastName' ? 'family-name' : 'nickname'}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <p id={errorId} className="login-fieldError">{error}</p>}
    </>
  );
}

export function AccountRequestForm({
  onBack,
  submit = submitAccountRequest,
}: {
  onBack(): void;
  submit?: (input: AccountRequestInput) => Promise<AccountRequestResult>;
}) {
  const [values, setValues] = useState<AccountRequestInput>({ email: '', displayName: '', firstName: '', lastName: '' });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const refs = {
    email: useRef<HTMLInputElement>(null),
    displayName: useRef<HTMLInputElement>(null),
    firstName: useRef<HTMLInputElement>(null),
    lastName: useRef<HTMLInputElement>(null),
  };

  function update(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError('');
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<FieldName, string>> = {};
    if (!EMAIL_PATTERN.test(values.email.trim())) nextErrors.email = 'Saisissez une adresse e-mail valide.';
    if (!values.displayName.trim()) nextErrors.displayName = 'Saisissez un nom d’affichage.';
    if (!values.firstName.trim()) nextErrors.firstName = 'Saisissez votre prénom.';
    if (!values.lastName.trim()) nextErrors.lastName = 'Saisissez votre nom.';
    setErrors(nextErrors);

    const firstInvalid = (['email', 'displayName', 'firstName', 'lastName'] as const)
      .find((field) => nextErrors[field]);
    if (firstInvalid) refs[firstInvalid].current?.focus();
    return !firstInvalid;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    setServerError('');

    const { error } = await submit({
      email: values.email.trim().toLowerCase(),
      displayName: values.displayName.trim(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
    });
    setSubmitting(false);

    if (error) {
      setServerError(error.message.includes('déjà')
        ? error.message
        : 'La demande n’a pas pu être envoyée. Réessayez plus tard.');
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="account-request account-request--success">
        <LuCircleCheck aria-hidden="true" />
        <h2>Demande envoyée</h2>
        <p>Votre demande est en attente. Un administrateur doit l’approuver avant que vous puissiez définir votre mot de passe.</p>
        <Button className="login-submit" onClick={onBack} leftSection={<LuArrowLeft aria-hidden="true" />}>Retour à la connexion</Button>
      </div>
    );
  }

  return (
    <div className="account-request">
      <Button variant="subtle" className="account-request__back" onClick={onBack} disabled={submitting}>
        <LuArrowLeft aria-hidden="true" /> Retour
      </Button>
      <h2>Créer un compte</h2>

      {serverError && <div className="login-message login-message--error" role="alert"><LuCircleAlert aria-hidden="true" />{serverError}</div>}

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <RequestField field="email" label="Adresse e-mail" type="email" icon={<LuMail aria-hidden="true" />}
          inputRef={refs.email} value={values.email} error={errors.email} disabled={submitting} onChange={(value) => update('email', value)} />
        <RequestField field="displayName" label="Nom d’affichage" icon={<LuUserRound aria-hidden="true" />}
          inputRef={refs.displayName} value={values.displayName} error={errors.displayName} disabled={submitting} onChange={(value) => update('displayName', value)} />
        <RequestField field="firstName" label="Prénom" icon={<LuUserRound aria-hidden="true" />}
          inputRef={refs.firstName} value={values.firstName} error={errors.firstName} disabled={submitting} onChange={(value) => update('firstName', value)} />
        <RequestField field="lastName" label="Nom" icon={<LuUserRound aria-hidden="true" />}
          inputRef={refs.lastName} value={values.lastName} error={errors.lastName} disabled={submitting} onChange={(value) => update('lastName', value)} />
        <Button className="login-submit" type="submit" loading={submitting} disabled={submitting}>
          {submitting ? <LuLoaderCircle className="is-spinning" aria-hidden="true" /> : <LuSend aria-hidden="true" />}
          {submitting ? 'Envoi…' : 'Envoyer la demande'}
        </Button>
      </form>
    </div>
  );

}
