import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  LuArrowLeft,
  LuCircleCheck,
  LuCloudAlert,
  LuEye,
  LuFlipHorizontal2,
  LuLink,
  LuLoaderCircle,
  LuLock,
  LuPlus,
  LuRedo2,
  LuTrash2,
  LuUndo2,
  LuUnlink,
} from 'react-icons/lu';
import { ActionHistoryProvider, useActionHistory } from '../components/ActionHistory';
import { DashboardLayout } from '../components/DashboardLayout';
import { ManualLockButton } from '../components/ManualLockButton';
import { usePreferences } from '../components/PreferencesContext';
import { WallElevationCanvas } from '../components/WallElevationCanvas';
import { useEditorAutosave } from '../components/useEditorAutosave';
import {
  findWallEditorContext,
  interiorFaceForRoom,
  replaceWallAndSyncConnectedEndpoints,
  replaceWallAcrossLevel,
  setSharedVertexLock,
  topologyWallFromProjection,
} from '../domain/editorGeometry';
import { profileLockState } from '../domain/manualLock';
import { validateOpening } from '../domain/opening';
import type {
  Level,
  Opening,
  Project,
  TopologyOpening,
  Wall,
  WallFaceSide,
  WallHeightProfilePoint,
  WallHeightProfiles,
} from '../domain/types';
import {
  centimetersToDisplay,
  displayToCentimeters,
  formatLength,
} from '../domain/userPreferences';
import {
  relinkWallHeightProfiles,
  unlinkWallHeightProfiles,
  updateWallHeightProfile,
} from '../domain/wallHeightProfile';
import { wallQualification } from '../domain/wall';
import { hasSupabaseConfig } from '../lib/supabase';
import { getLevel } from '../services/levels';
import { canWriteProject, getProject } from '../services/projects';
import {
  loadLevelGeometrySnapshot,
  saveLevelRoomSnapshots,
  type RoomSnapshot,
} from '../services/rooms';

interface WallEditorViewProps {
  projectId: string;
  levelId: string;
  wallId: string;
  roomId?: string;
  onBack(): void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Le mur n’a pas pu être chargé.';
}

function opposite(side: WallFaceSide): WallFaceSide {
  return side === 'gauche' ? 'droite' : 'gauche';
}

function intermediateProfileLabel(index: number): string {
  let remaining = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return label;
}

function profilePointLabel(index: number, pointCount: number): string {
  if (index === 0) return 'Gauche';
  if (index === pointCount - 1) return 'Droite';
  return intermediateProfileLabel(index - 1);
}

function toTopologyOpening(opening: Opening): TopologyOpening {
  if (!opening.templateId || !opening.openingKind || !opening.placementType) {
    throw new Error('L’ouverture ne possède pas toutes ses données canoniques.');
  }
  return {
    id: opening.id,
    wallId: opening.wallId,
    templateId: opening.templateId,
    type: opening.openingKind,
    placementType: opening.placementType,
    positionCm: opening.offsetCm,
    widthCm: opening.widthCm,
    heightCm: opening.heightCm,
    bottomCm: opening.bottomCm,
    orientation: opening.orientation ?? null,
  };
}

function assertOpeningsFit(
  wall: Wall,
  profiles: WallHeightProfiles,
  lengthCm: number,
  openings: readonly Opening[],
  templates: RoomSnapshot['openingTemplates'],
) {
  const topologyWall = topologyWallFromProjection(wall);
  const topologyOpenings = openings.map(toTopologyOpening);
  for (const opening of topologyOpenings) {
    const template = templates?.[opening.templateId];
    if (!template) throw new Error('Le template d’une ouverture est introuvable.');
    const [issue] = validateOpening(opening, {
      wall: topologyWall,
      profiles,
      wallLengthCm: lengthCm,
      template,
      siblingOpenings: topologyOpenings,
    });
    if (issue) throw new Error(issue.message);
  }
}

export function WallEditorView(props: WallEditorViewProps) {
  return <ActionHistoryProvider><WallEditorContent {...props} /></ActionHistoryProvider>;
}

function WallEditorContent({ projectId, levelId, wallId, roomId, onBack }: WallEditorViewProps) {
  const { preferences } = usePreferences();
  const { canUndo, canRedo, record, undo, redo } = useActionHistory();
  const [project, setProject] = useState<Project | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [rooms, setRooms] = useState<RoomSnapshot[]>([]);
  const roomsRef = useRef<RoomSnapshot[]>([]);
  const [revision, setRevision] = useState(0);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [face, setFace] = useState<WallFaceSide>('gauche');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);

  roomsRef.current = rooms;
  const context = useMemo(
    () => findWallEditorContext(rooms, wallId, roomId),
    [roomId, rooms, wallId],
  );
  const owner = context
    ? rooms.find(({ room }) => room.id === context.ownerRoomId) ?? null
    : null;
  const wall = context?.projection ?? null;
  const profiles = wall?.heightProfiles ?? null;
  const openings = owner?.openings.filter((opening) => opening.wallId === wallId) ?? [];
  const qualification = wall ? wallQualification(topologyWallFromProjection(wall)) : null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    void Promise.all([
      getProject(projectId),
      getLevel(levelId),
      loadLevelGeometrySnapshot(levelId),
      canWriteProject(projectId),
    ]).then(([nextProject, nextLevel, geometry, writeAllowed]) => {
      if (!active) return;
      if (nextLevel.projectId !== projectId) throw new Error('Le niveau n’appartient pas au projet courant.');
      const nextContext = findWallEditorContext(geometry.rooms, wallId, roomId);
      if (!nextContext) throw new Error('Le mur demandé n’existe plus ou n’est pas accessible.');
      const nextOwner = geometry.rooms.find(({ room }) => room.id === nextContext.ownerRoomId)!;
      const initialFace = roomId || nextContext.projection.pieceIds?.length === 1
        ? interiorFaceForRoom(nextOwner)
        : 'gauche';
      setProject(nextProject);
      setLevel(nextLevel);
      setRooms(geometry.rooms);
      setRevision(geometry.revision);
      setCanWrite(writeAllowed);
      setFace(initialFace);
    }).catch((caught) => {
      if (active) setLoadError(message(caught));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [levelId, projectId, roomId, wallId]);

  const autosave = useEditorAutosave({
    source: 'wall-editor',
    dirty,
    enabled: canWrite && !loading && !loadError,
    save: async () => {
      const saved = await saveLevelRoomSnapshots(levelId, roomsRef.current, revision);
      setRooms(saved.rooms);
      setRevision(saved.revision);
      setDirty(false);
    },
  });

  const applyRooms = (label: string, nextRooms: RoomSnapshot[]) => {
    const previous = roomsRef.current;
    roomsRef.current = nextRooms;
    setRooms(nextRooms);
    setDirty(true);
    setValidationError('');
    record({
      label,
      undo: async () => { roomsRef.current = previous; setRooms(previous); setDirty(true); },
      redo: async () => { roomsRef.current = nextRooms; setRooms(nextRooms); setDirty(true); },
    });
  };

  const commitWall = (
    label: string,
    nextWall: Wall,
    nextProfiles: WallHeightProfiles,
    nextOpenings = openings,
  ) => {
    if (!wall || !context) return;
    try {
      assertOpeningsFit(nextWall, nextProfiles, context.lengthCm, nextOpenings, owner?.openingTemplates);
      applyRooms(label, replaceWallAndSyncConnectedEndpoints(
        roomsRef.current,
        context.ownerRoomId,
        nextWall,
        profiles ?? nextProfiles,
        nextProfiles,
        nextOpenings,
      ));
    } catch (caught) {
      setValidationError(message(caught));
    }
  };

  const updatePoints = (points: WallHeightProfilePoint[]) => {
    if (!wall || !profiles || !context) return;
    try {
      const state = updateWallHeightProfile(
        topologyWallFromProjection(wall),
        profiles,
        face,
        points,
        context.lengthCm,
      );
      commitWall('Modifier le profil de hauteur', {
        ...wall,
        heightProfilesLinked: state.wall.heightProfilesLinked,
      }, state.profiles);
    } catch (caught) {
      setValidationError(message(caught));
    }
  };

  const facePoints = profiles?.[face] ?? [];
  const wallVertices = wall
    ? rooms.flatMap(({ vertices }) => vertices).filter(({ id }) => (
      id === wall.startVertexId || id === wall.endVertexId
    ))
    : [];
  const wallLocked = wallVertices.length > 0 && wallVertices.every(({ isLocked }) => isLocked);
  const profileLocked = profileLockState(facePoints);
  const selectedOpening = openings.find(({ id }) => id === selectedOpeningId) ?? null;
  const ownerInteriorFace = owner && wall ? interiorFaceForRoom(owner) : 'gauche';
  const otherRoom = wall?.pieceIds
    ?.map((pieceId) => rooms.find(({ room }) => room.id === pieceId)?.room)
    .find((room) => room && room.id !== owner?.room.id);
  const faceOptions = (['gauche', 'droite'] as const).map((side) => ({
    value: side,
    label: qualification === 'exterior'
      ? side === ownerInteriorFace ? 'Face intérieure' : 'Face extérieure'
      : qualification === 'interior'
        ? side === ownerInteriorFace ? `Face ${owner?.room.name ?? 'pièce'}` : `Face ${otherRoom?.name ?? 'pièce voisine'}`
        : side === 'gauche' ? 'Face gauche' : 'Face droite',
  }));

  if (!hasSupabaseConfig()) return <DashboardLayout><Alert color="red">Configure Supabase pour afficher le mur.</Alert></DashboardLayout>;

  return <DashboardLayout>
    <header className="global-editor__header">
      <div>
        <p className="dashboard-eyebrow">Vue mur</p>
        <h1 className="dashboard-pageTitle">{project?.name ?? 'Projet'} · {level?.name ?? 'Niveau'} · Mur {wallId.slice(0, 8)}</h1>
        {roomId ? <Text size="sm">Pièce d’origine : {owner?.room.name ?? roomId.slice(0, 8)}</Text> : null}
        {qualification ? <Text size="sm">Mur {qualification === 'interior' ? 'mitoyen' : qualification === 'exterior' ? 'extérieur' : 'détaché'}</Text> : null}
      </div>
      <Group>
        {autosave.status === 'saving' ? <Text><LuLoaderCircle aria-hidden /> Enregistrement…</Text> : null}
        {autosave.status === 'synced' ? <Text><LuCircleCheck aria-hidden /> Synchronisé</Text> : null}
        {autosave.status === 'error' ? <Text c="red"><LuCloudAlert aria-hidden /> Échec</Text> : null}
        {!canWrite && !loading ? <Text><LuEye aria-hidden /> Lecture seule</Text> : null}
        <Button variant="default" disabled={!dirty || !canWrite || autosave.status === 'saving'} onClick={() => void autosave.saveNow().catch(() => undefined)}>Sauvegarder</Button>
        <ActionIcon variant="default" aria-label="Annuler" disabled={!canWrite || !canUndo} onClick={undo}><LuUndo2 /></ActionIcon>
        <ActionIcon variant="default" aria-label="Rétablir" disabled={!canWrite || !canRedo} onClick={redo}><LuRedo2 /></ActionIcon>
        <Button variant="default" leftSection={<LuArrowLeft />} onClick={onBack}>Retour</Button>
      </Group>
    </header>
    {loading ? <div className="dashboard-loading" aria-live="polite">Chargement du mur…</div> : null}
    {loadError ? <Alert color="red" role="alert">{loadError}<Button variant="subtle" onClick={onBack}>Retour</Button></Alert> : null}
    {autosave.error ? <Alert color="red" role="status">Échec de l’enregistrement automatique : {autosave.error}</Alert> : null}
    {validationError ? <Alert color="red" role="alert">{validationError}</Alert> : null}
    {!loading && !loadError && wall && profiles && context ? <>
      <Group className="global-editor__levelBar">
        <NativeSelect
          aria-label="Face affichée"
          value={face}
          data={faceOptions}
          onChange={(event) => { setFace(event.currentTarget.value as WallFaceSide); setSelectedPointId(null); }}
        />
        <Button
          variant="default"
          leftSection={<LuFlipHorizontal2 />}
          onClick={() => setFace(opposite(face))}
        >Changer de face</Button>
        <Button
          variant="default"
          disabled={!canWrite}
          leftSection={wall.heightProfilesLinked ? <LuUnlink /> : <LuLink />}
          onClick={() => {
            try {
              const topologyWall = topologyWallFromProjection(wall);
              const profilesAlreadyIdentical = profiles.gauche.length === profiles.droite.length
                && profiles.gauche.every((point, index) => point.positionCm === profiles.droite[index]?.positionCm && point.heightCm === profiles.droite[index]?.heightCm);
              const confirmed = wall.heightProfilesLinked || profilesAlreadyIdentical
                ? true
                : window.confirm('Le profil de la face affichée remplacera celui de l’autre face. Continuer ?');
              if (!confirmed) return;
              const state = wall.heightProfilesLinked
                ? unlinkWallHeightProfiles({ wall: topologyWall, profiles })
                : relinkWallHeightProfiles(
                  { wall: topologyWall, profiles },
                  face,
                  context.lengthCm,
                  true,
                );
              commitWall(wall.heightProfilesLinked ? 'Dissocier les profils' : 'Lier les profils', {
                ...wall,
                heightProfilesLinked: state.wall.heightProfilesLinked,
              }, state.profiles);
            } catch (caught) { setValidationError(message(caught)); }
          }}
        >{wall.heightProfilesLinked ? 'Dissocier les hauteurs' : 'Lier les hauteurs'}</Button>
      </Group>
      <section className="wall-editor__body">
        <div className="global-editor__canvasArea">
          <WallElevationCanvas
            wallLengthCm={context.lengthCm}
            points={facePoints}
            oppositePoints={profiles[opposite(face)]}
            openings={openings}
            lengthUnit={preferences.lengthUnit}
            editingEnabled={canWrite && autosave.status !== 'saving'}
            selectedOpeningId={selectedOpeningId}
            selectedPointId={selectedPointId}
            onSelectOpening={(id) => { setSelectedOpeningId(id); setSelectedPointId(null); }}
            onSelectPoint={(id) => { setSelectedPointId(id); setSelectedOpeningId(null); }}
            onMovePoint={(id, positionCm, heightCm) => updatePoints(facePoints.map((point) => point.id === id ? { ...point, positionCm, heightCm } : point))}
            onTogglePointLock={(id) => {
              const index = facePoints.findIndex((point) => point.id === id);
              if (index < 0) return;
              const locked = !facePoints[index].isLocked;
              const nextProfiles = {
                ...profiles,
                [face]: profiles[face].map((point) => point.id === id ? { ...point, isLocked: locked } : point),
                ...(wall.heightProfilesLinked ? {
                  [opposite(face)]: profiles[opposite(face)].map((point, pointIndex) => pointIndex === index ? { ...point, isLocked: locked } : point),
                } : {}),
              };
              const unlockedIds = locked ? [] : [id, wall.heightProfilesLinked ? profiles[opposite(face)][index]?.id : null].filter((value): value is string => Boolean(value));
              const nextRooms = replaceWallAcrossLevel(roomsRef.current, wall, nextProfiles, openings)
                .map((snapshot) => ({ ...snapshot, unlockedProfilePointIds: [...new Set([...(snapshot.unlockedProfilePointIds ?? []), ...unlockedIds])] }));
              applyRooms(locked ? 'Verrouiller un point de profil' : 'Déverrouiller un point de profil', nextRooms);
            }}
          />
        </div>
        <aside className="editor-panel wall-editor__panel">
          <Stack>
            <Text fw={700}>Mur</Text>
            <ManualLockButton
              isLocked={wallLocked}
              canChangeLock={canWrite}
              onChange={(locked) => {
                const vertexIds = new Set([wall.startVertexId, wall.endVertexId]);
                const next = setSharedVertexLock(roomsRef.current, vertexIds, locked).map((snapshot) => ({
                  ...snapshot,
                  unlockedVertexIds: locked ? snapshot.unlockedVertexIds : [...new Set([...(snapshot.unlockedVertexIds ?? []), ...vertexIds])],
                }));
                applyRooms(locked ? 'Verrouiller le mur' : 'Déverrouiller le mur', next);
              }}
            />
            <NumberInput
              label={`Épaisseur (${preferences.lengthUnit})`}
              value={centimetersToDisplay(wall.thicknessCm ?? 0, preferences.lengthUnit)}
              disabled={!canWrite || wallLocked}
              min={0.01}
              onChange={(value) => {
                const centimeters = displayToCentimeters(Number(value), preferences.lengthUnit);
                if (centimeters > 0) commitWall('Modifier l’épaisseur du mur', { ...wall, thicknessCm: centimeters }, profiles);
              }}
            />
            <TextInput label="Matériau" value={wall.material ?? ''} disabled={!canWrite} onChange={(event) => commitWall('Modifier le matériau du mur', { ...wall, material: event.currentTarget.value || null }, profiles)} />
            <TextInput label="Isolation" value={wall.insulation ?? ''} disabled={!canWrite} onChange={(event) => commitWall('Modifier l’isolation du mur', { ...wall, insulation: event.currentTarget.value || null }, profiles)} />
            <Text size="sm">Longueur intérieure : {formatLength(context.lengthCm, preferences.lengthUnit)}</Text>
            <Text fw={700}>Profil de hauteur</Text>
            <ManualLockButton
              isLocked={profileLocked}
              canChangeLock={canWrite}
              onChange={(locked) => {
                const nextProfiles = {
                  ...profiles,
                  [face]: profiles[face].map((point) => ({ ...point, isLocked: locked })),
                  ...(wall.heightProfilesLinked ? { [opposite(face)]: profiles[opposite(face)].map((point) => ({ ...point, isLocked: locked })) } : {}),
                };
                const unlockedIds = locked ? [] : [
                  ...profiles[face].map(({ id }) => id),
                  ...(wall.heightProfilesLinked ? profiles[opposite(face)].map(({ id }) => id) : []),
                ];
                const next = replaceWallAcrossLevel(roomsRef.current, wall, nextProfiles, openings).map((snapshot) => ({
                  ...snapshot,
                  unlockedProfilePointIds: [...new Set([...(snapshot.unlockedProfilePointIds ?? []), ...unlockedIds])],
                }));
                applyRooms(locked ? 'Verrouiller le profil' : 'Déverrouiller le profil', next);
              }}
            />
            {facePoints.map((point, index) => {
              const pointLabel = profilePointLabel(index, facePoints.length);
              const intermediate = index > 0 && index < facePoints.length - 1;
              return <Group key={point.id} align="end" wrap="nowrap" className="wall-editor__profile-point-row">
              <Text
                fw={700}
                size="sm"
                className="wall-editor__profile-point-label"
                aria-label={`Point de profil ${pointLabel}`}
              >{pointLabel}</Text>
              <NumberInput
                label="Position"
                aria-label={`Position ${pointLabel}`}
                className="wall-editor__profile-point-field"
                value={centimetersToDisplay(point.positionCm, preferences.lengthUnit)}
                disabled={!canWrite || point.isLocked || index === 0 || index === facePoints.length - 1}
                onChange={(value) => updatePoints(facePoints.map((candidate) => candidate.id === point.id ? { ...candidate, positionCm: displayToCentimeters(Number(value), preferences.lengthUnit) } : candidate))}
              />
              <NumberInput
                label="Hauteur"
                aria-label={`Hauteur ${pointLabel}`}
                className="wall-editor__profile-point-field"
                value={centimetersToDisplay(point.heightCm, preferences.lengthUnit)}
                min={0.01}
                disabled={!canWrite || point.isLocked}
                onChange={(value) => updatePoints(facePoints.map((candidate) => candidate.id === point.id ? { ...candidate, heightCm: displayToCentimeters(Number(value), preferences.lengthUnit) } : candidate))}
              />
              {intermediate ? <ActionIcon
                color="red"
                aria-label={`Supprimer le point intermédiaire ${pointLabel}`}
                className="wall-editor__profile-point-action"
                disabled={!canWrite || point.isLocked}
                onClick={() => updatePoints(facePoints.filter(({ id }) => id !== point.id))}
              ><LuTrash2 /></ActionIcon> : <span className="wall-editor__profile-point-action" aria-hidden="true" />}
            </Group>;
            })}
            <Button
              variant="default"
              leftSection={<LuPlus />}
              disabled={!canWrite || profileLocked}
              onClick={() => {
                const gaps = facePoints.slice(0, -1).map((point, index) => ({ point, next: facePoints[index + 1], index })).sort((a, b) => (b.next.positionCm - b.point.positionCm) - (a.next.positionCm - a.point.positionCm));
                const gap = gaps[0];
                if (!gap) return;
                const added: WallHeightProfilePoint = {
                  id: crypto.randomUUID(), wallId, faceSide: face, order: gap.index + 1,
                  positionCm: (gap.point.positionCm + gap.next.positionCm) / 2,
                  heightCm: (gap.point.heightCm + gap.next.heightCm) / 2,
                  isLocked: false,
                };
                updatePoints([...facePoints.slice(0, gap.index + 1), added, ...facePoints.slice(gap.index + 1)]);
              }}
            >Ajouter un point intermédiaire</Button>
            <Text fw={700}>Ouvertures</Text>
            {openings.length === 0 ? <Text size="sm" c="dimmed">Aucune ouverture.</Text> : null}
            {openings.map((opening) => <Button key={opening.id} variant={selectedOpeningId === opening.id ? 'light' : 'subtle'} onClick={() => setSelectedOpeningId(opening.id)}>{opening.openingKind ?? opening.type} · {formatLength(opening.widthCm, preferences.lengthUnit)}</Button>)}
            {selectedOpening ? <Stack>
              {(['offsetCm', 'widthCm', 'heightCm', 'bottomCm'] as const).map((key) => <NumberInput
                key={key}
                label={{ offsetCm: 'Position', widthCm: 'Largeur', heightCm: 'Hauteur', bottomCm: 'Allège' }[key]}
                value={centimetersToDisplay(selectedOpening[key], preferences.lengthUnit)}
                disabled={!canWrite}
                min={key === 'offsetCm' || key === 'bottomCm' ? 0 : 0.01}
                onChange={(value) => commitWall('Modifier une ouverture', wall, profiles, openings.map((opening) => opening.id === selectedOpening.id ? { ...opening, [key]: displayToCentimeters(Number(value), preferences.lengthUnit) } : opening))}
              />)}
            </Stack> : null}
          </Stack>
        </aside>
      </section>
    </> : null}
  </DashboardLayout>;
}
