import React, { useEffect, useState } from 'react';
import { Alert, Button, Modal, NumberInput, Select, Stack } from '@mantine/core';
import { LuCircleAlert, LuSave, LuSlidersHorizontal } from 'react-icons/lu';
import {
  centimetersToDisplay,
  displayToCentimeters,
  validateUserPreferences,
  type LengthUnit,
  type UserPreferences,
} from '../domain/userPreferences';
import { usePreferences } from './PreferencesContext';

export function PreferencesModal({ opened, onClose }: { opened: boolean; onClose(): void }) {
  const { preferences, loading, loadError, save } = usePreferences();
  const [values, setValues] = useState(preferences);
  const [height, setHeight] = useState<number | string>(preferences.defaultWallHeightCm);
  const [thickness, setThickness] = useState<number | string>(preferences.defaultWallThicknessCm);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (!opened) return;
    setValues(preferences);
    setHeight(centimetersToDisplay(preferences.defaultWallHeightCm, preferences.lengthUnit));
    setThickness(centimetersToDisplay(preferences.defaultWallThicknessCm, preferences.lengthUnit));
    setFeedback(null);
  }, [opened, preferences]);

  function changeLengthUnit(unit: LengthUnit) {
    setHeight(centimetersToDisplay(displayToCentimeters(Number(height), values.lengthUnit), unit));
    setThickness(centimetersToDisplay(displayToCentimeters(Number(thickness), values.lengthUnit), unit));
    setValues({ ...values, lengthUnit: unit });
  }

  async function submit() {
    const next: UserPreferences = {
      ...values,
      defaultWallHeightCm: displayToCentimeters(Number(height), values.lengthUnit),
      defaultWallThicknessCm: displayToCentimeters(Number(thickness), values.lengthUnit),
    };
    const validationError = validateUserPreferences(next);
    if (validationError) {
      setFeedback({ kind: 'error', text: validationError });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await save(next);
      setFeedback({ kind: 'success', text: 'Préférences enregistrées.' });
    } catch {
      setFeedback({ kind: 'error', text: 'Les préférences n’ont pas pu être enregistrées.' });
    } finally {
      setSaving(false);
    }
  }

  const unitLabel = values.lengthUnit;

  return (
    <Modal opened={opened} onClose={onClose} title={<span className="preferences-title"><LuSlidersHorizontal aria-hidden="true" /> Préférences utilisateur</span>} centered>
      <Stack aria-busy={loading}>
        {loadError && <Alert icon={<LuCircleAlert aria-hidden="true" />} color="orange">{loadError}</Alert>}
        <Select label="Unité de longueur" data={[['cm', 'Centimètres'], ['m', 'Mètres'], ['mm', 'Millimètres']].map(([value, label]) => ({ value, label }))} value={values.lengthUnit} disabled={loading} onChange={(value) => value && changeLengthUnit(value as LengthUnit)} />
        <Select label="Unité de surface" data={[['m2', 'Mètres carrés'], ['cm2', 'Centimètres carrés'], ['mm2', 'Millimètres carrés']].map(([value, label]) => ({ value, label }))} value={values.surfaceUnit} disabled={loading} onChange={(value) => value && setValues({ ...values, surfaceUnit: value as UserPreferences['surfaceUnit'] })} />
        <Select label="Thème" data={[['system', 'Système'], ['clair', 'Clair'], ['foncé', 'Foncé']].map(([value, label]) => ({ value, label }))} value={values.theme} disabled={loading} onChange={(value) => value && setValues({ ...values, theme: value as UserPreferences['theme'] })} />
        <NumberInput label={`Hauteur de mur par défaut (${unitLabel})`} min={Number.MIN_VALUE} value={height} disabled={loading} onChange={setHeight} error={Number(height) <= 0 ? 'La valeur doit être strictement positive.' : undefined} />
        <NumberInput label={`Épaisseur de mur par défaut (${unitLabel})`} min={Number.MIN_VALUE} value={thickness} disabled={loading} onChange={setThickness} error={Number(thickness) <= 0 ? 'La valeur doit être strictement positive.' : undefined} />
        {feedback && <p className={`preferences-feedback preferences-feedback--${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
        <Button leftSection={<LuSave aria-hidden="true" />} loading={saving} disabled={loading || Number(height) <= 0 || Number(thickness) <= 0} onClick={() => void submit()}>Enregistrer les préférences</Button>
      </Stack>
    </Modal>
  );
}
