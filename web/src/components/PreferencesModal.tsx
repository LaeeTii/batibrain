import React, { useEffect, useState } from 'react';
import { Button, Modal, NumberInput, Select } from '@mantine/core';
import { LuSave, LuSlidersHorizontal } from 'react-icons/lu';
import {
  DEFAULT_USER_PREFERENCES,
  loadUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from '../data/supabase/preferences';

export function PreferencesModal({ opened, onClose }: { opened: boolean; onClose(): void }) {
  const [values, setValues] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    setFeedback('');
    void loadUserPreferences()
      .then(setValues)
      .catch(() => setFeedback('Les préférences n’ont pas pu être chargées.'))
      .finally(() => setLoading(false));
  }, [opened]);

  async function save() {
    if (values.defaultWallHeightCm <= 0 || values.defaultWallThicknessCm <= 0) return;
    setSaving(true);
    setFeedback('');
    try {
      await saveUserPreferences(values);
      document.documentElement.dataset.theme = values.theme;
      setFeedback('Préférences enregistrées.');
    } catch {
      setFeedback('Les préférences n’ont pas pu être enregistrées.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={<span className="preferences-title"><LuSlidersHorizontal aria-hidden="true" /> Préférences utilisateur</span>} centered>
      <div className="app-projectForm" aria-busy={loading}>
        <Select label="Unité de longueur" data={[['cm', 'Centimètres'], ['m', 'Mètres'], ['mm', 'Millimètres']].map(([value, label]) => ({ value, label }))} value={values.lengthUnit} disabled={loading} onChange={(value) => value && setValues({ ...values, lengthUnit: value as UserPreferences['lengthUnit'] })} />
        <Select label="Unité de surface" data={[['m2', 'Mètres carrés'], ['cm2', 'Centimètres carrés'], ['mm2', 'Millimètres carrés']].map(([value, label]) => ({ value, label }))} value={values.surfaceUnit} disabled={loading} onChange={(value) => value && setValues({ ...values, surfaceUnit: value as UserPreferences['surfaceUnit'] })} />
        <Select label="Thème" data={[['system', 'Système'], ['clair', 'Clair'], ['foncé', 'Foncé']].map(([value, label]) => ({ value, label }))} value={values.theme} disabled={loading} onChange={(value) => value && setValues({ ...values, theme: value as UserPreferences['theme'] })} />
        <NumberInput label="Hauteur de mur par défaut (cm)" min={0.01} value={values.defaultWallHeightCm} disabled={loading} onChange={(value) => setValues({ ...values, defaultWallHeightCm: Number(value) })} />
        <NumberInput label="Épaisseur de mur par défaut (cm)" min={0.01} value={values.defaultWallThicknessCm} disabled={loading} onChange={(value) => setValues({ ...values, defaultWallThicknessCm: Number(value) })} />
        {feedback && <p role="status">{feedback}</p>}
        <Button leftSection={<LuSave aria-hidden="true" />} loading={saving} disabled={loading || values.defaultWallHeightCm <= 0 || values.defaultWallThicknessCm <= 0} onClick={() => void save()}>Enregistrer les préférences</Button>
      </div>
    </Modal>
  );
}
