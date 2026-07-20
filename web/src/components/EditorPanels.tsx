import React, { useEffect, useMemo, useState } from 'react';
import { Accordion, ActionIcon, Badge, Button, ColorInput, NativeSelect, NumberInput, ScrollArea, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { LuArrowLeft, LuArrowUpRight, LuBrickWall, LuChevronDown, LuChevronRight, LuDoorOpen, LuLayers3, LuListTree, LuPanelLeftClose, LuPanelLeftOpen, LuPanelRightClose, LuRuler, LuSquareDashed, LuStickyNote } from 'react-icons/lu';
import { polygonAreaCm2, sortVertices } from '../domain/geometry';
import { uniqueLevelOpenings, uniqueLevelWalls } from '../domain/roomOverlap';
import type { Level } from '../domain/types';
import type { CanvasLevelData } from './Canvas2D';
import { useEditorSelection } from './SelectionSyncBridge';
import { formatLength, formatSurface, type LengthUnit, type SurfaceUnit } from '../domain/userPreferences';
import { centimetersToDisplay, displayToCentimeters } from '../domain/userPreferences';
import type { EditorDimension, EditorNote, Opening, OpeningTemplate, Room, RoomType, Wall } from '../domain/types';
import { ManualLockButton } from './ManualLockButton';

type SectionType = 'level' | 'room' | 'wall' | 'opening' | 'dimension' | 'note';
const sectionDetails = {
  level: ['Niveaux', LuLayers3], room: ['Pièces', LuSquareDashed], wall: ['Murs', LuBrickWall],
  opening: ['Ouvertures', LuDoorOpen], dimension: ['Côtes', LuRuler], note: ['Notes', LuStickyNote],
} as const;

function shortId(id: string) { return id.slice(0, 8); }

interface EditorCreationPanelProps {
  levels: Level[];
  levelData: CanvasLevelData[];
  activeLevelId: string;
  projectId?: string;
  readOnly?: boolean;
  selectionLocked?: boolean;
  creationMessage?: string;
  lengthUnit?: LengthUnit;
  onStartRoomCreation?(): void;
  onCreateLevel?(name: string, number: number): Promise<void> | void;
  onUpdateLevel?(level: Level): Promise<void> | void;
  onDeleteLevel?(level: Level): Promise<void> | void;
  onSaveDimension?(dimension: EditorDimension): Promise<void> | void;
  onDeleteDimension?(id: string): Promise<void> | void;
  onSaveNote?(note: EditorNote): Promise<void> | void;
  onDeleteNote?(id: string): Promise<void> | void;
  onOpenWall?(wallId: string, levelId: string): void;
  onUpdateRoom?(room: Room): void;
  onUpdateWall?(wall: Wall): void;
  onUpdateOpening?(opening: Opening): void;
  onCreateOpening?(templateId: string): void;
  onToggleSelectionLock?(locked: boolean): void;
  onDeleteSelection?(): void;
}

const ROOM_TYPE_OPTIONS: { value: RoomType; label: string }[] = [
  ['cuisine', 'Cuisine'], ['chambre', 'Chambre'], ['salon', 'Salon'], ['salle_de_bain', 'Salle de bain'],
  ['toilettes', 'Toilettes'], ['bureau', 'Bureau'], ['garage', 'Garage'], ['hall', 'Hall'],
  ['salle_de_jeu', 'Salle de jeu'], ['bibliotheque', 'Bibliothèque'], ['autre', 'Autre'],
].map(([value, label]) => ({ value: value as RoomType, label }));

export function EditorCreationPanel({ levels, levelData, activeLevelId, projectId = '', readOnly = false, selectionLocked = false, creationMessage = '', lengthUnit = 'cm', onStartRoomCreation, onCreateLevel, onUpdateLevel, onDeleteLevel, onSaveDimension, onDeleteDimension, onSaveNote, onDeleteNote, onOpenWall, onUpdateRoom, onUpdateWall, onUpdateOpening, onCreateOpening, onToggleSelectionLock, onDeleteSelection }: EditorCreationPanelProps) {
  const { selection, select } = useEditorSelection(); const [collapsed, setCollapsed] = useState(false); const [section, setSection] = useState<string | null>(null);
  useEffect(() => { if (selection && selection.type !== 'point') setSection(selection.type); }, [selection]);
  const data = levelData.find(({ level }) => level.id === activeLevelId);
  const selectedRoom = selection?.type === 'room' ? data?.rooms.find(({ room }) => room.id === selection.id)?.room : undefined;
  const selectedWall = selection?.type === 'wall' ? uniqueLevelWalls(data?.rooms ?? []).find(({ id }) => id === selection.id) : undefined;
  const selectedOpening = selection?.type === 'opening' ? uniqueLevelOpenings(data?.rooms ?? []).find(({ id }) => id === selection.id) : undefined;
  const templates = [...new Map<string, OpeningTemplate>(
    (data?.rooms.flatMap(({ openingTemplates }) => Object.values(openingTemplates ?? {})) ?? [])
      .map((template) => [template.id, template]),
  ).values()];
  const [openingTemplateId, setOpeningTemplateId] = useState('');
  const [levelName, setLevelName] = useState('');
  const [levelNumber, setLevelNumber] = useState<number | string>('');
  const selectedLevel = selection?.type === 'level' ? levels.find(({ id }) => id === selection.id) : undefined;
  const selectedDimension = selection?.type === 'dimension' ? data?.dimensions?.find(({ id }) => id === selection.id) : undefined;
  const selectedNote = selection?.type === 'note' ? data?.notes?.find(({ id }) => id === selection.id) : undefined;
  const [dimensionName, setDimensionName] = useState('');
  const [dimensionStartX, setDimensionStartX] = useState<number | string>(0);
  const [dimensionStartY, setDimensionStartY] = useState<number | string>(0);
  const [dimensionEndX, setDimensionEndX] = useState<number | string>(100);
  const [dimensionEndY, setDimensionEndY] = useState<number | string>(0);
  const [dimensionOffset, setDimensionOffset] = useState<number | string>(20);
  const [noteText, setNoteText] = useState('');
  if (collapsed) return <aside className="editor-panel editor-panel--collapsed"><ActionIcon variant="default" size="lg" onClick={() => setCollapsed(false)} aria-label="Rouvrir le panneau de création"><LuPanelLeftOpen aria-hidden /></ActionIcon></aside>;
  const items: Record<SectionType, { id: string; label: string; levelId: string }[]> = {
    level: levels.map((level) => ({ id: level.id, label: `${level.name} (niveau ${level.number})`, levelId: level.id })),
    room: (data?.rooms ?? []).map(({ room }) => ({ id: room.id, label: room.name, levelId: activeLevelId })),
    wall: uniqueLevelWalls(data?.rooms ?? []).map((wall) => ({ id: wall.id, label: `Mur ${shortId(wall.id)}`, levelId: activeLevelId })),
    opening: uniqueLevelOpenings(data?.rooms ?? []).map((opening) => ({ id: opening.id, label: `${opening.type === 'door' ? 'Porte' : opening.type === 'window' ? 'Fenêtre' : 'Ouverture'} ${shortId(opening.id)}`, levelId: activeLevelId })),
    dimension: (data?.dimensions ?? []).map((item) => ({ id: item.id, label: item.label ?? `Côte ${shortId(item.id)}`, levelId: activeLevelId })),
    note: (data?.notes ?? []).map((item) => ({ id: item.id, label: item.text, levelId: activeLevelId })),
  };
  return <aside className="editor-panel editor-panel--creation"><div className="editor-panel__header"><strong>Création et édition</strong><ActionIcon variant="subtle" onClick={() => setCollapsed(true)} aria-label="Replier le panneau de création"><LuPanelLeftClose aria-hidden /></ActionIcon></div>
    {section ? <Button variant="subtle" leftSection={<LuArrowLeft />} onClick={() => setSection(null)}>Retour</Button> : null}
    {readOnly ? <Text size="sm" c="dimmed">Consultation uniquement : les modifications sont indisponibles.</Text> : null}
    {selectionLocked ? <Text size="sm" c="dimmed">Élément verrouillé : ses informations restent consultables.</Text> : null}
    {creationMessage ? <Text size="sm">{creationMessage}</Text> : null}
    <ScrollArea h={620}><Accordion value={section} onChange={setSection}>{(Object.entries(sectionDetails) as [SectionType, typeof sectionDetails[SectionType]][]).map(([type, [label, Icon]]) => <Accordion.Item key={type} value={type}><Accordion.Control icon={<Icon aria-hidden />}>{label}</Accordion.Control><Accordion.Panel><Stack gap="xs">
      {type === 'wall' && selection?.type === 'wall' && selection.levelId === activeLevelId && onOpenWall ? <Button leftSection={<LuArrowUpRight />} onClick={() => onOpenWall(selection.id, activeLevelId)}>Ouvrir la vue Mur</Button> : null}
      {type === 'room' && selectedRoom ? <Stack gap="xs">
        <ManualLockButton isLocked={selectionLocked} canChangeLock={!readOnly && Boolean(onToggleSelectionLock)} onChange={(locked) => onToggleSelectionLock?.(locked)} />
        <TextInput label="Nom" disabled={readOnly} value={selectedRoom.name} onChange={(event) => onUpdateRoom?.({ ...selectedRoom, name: event.currentTarget.value })} />
        <NativeSelect label="Type" disabled={readOnly} value={selectedRoom.type} data={ROOM_TYPE_OPTIONS} onChange={(event) => onUpdateRoom?.({ ...selectedRoom, type: event.currentTarget.value as RoomType })} />
        <ColorInput
          label="Couleur du sol"
          format="hex"
          disabled={readOnly}
          value={selectedRoom.floorColor}
          popoverProps={{ withinPortal: true }}
          onChange={(floorColor) => onUpdateRoom?.({ ...selectedRoom, floorColor })}
        />
        <Textarea label="Notes" disabled={readOnly} value={selectedRoom.notes ?? ''} onChange={(event) => onUpdateRoom?.({ ...selectedRoom, notes: event.currentTarget.value || null })} />
        {onDeleteSelection ? <Button color="red" variant="light" disabled={readOnly || selectionLocked} onClick={onDeleteSelection}>Supprimer la pièce</Button> : null}
      </Stack> : null}
      {type === 'wall' && selectedWall ? <Stack gap="xs">
        <ManualLockButton isLocked={selectionLocked} canChangeLock={!readOnly && Boolean(onToggleSelectionLock)} onChange={(locked) => onToggleSelectionLock?.(locked)} />
        <NumberInput label={`Épaisseur (${lengthUnit})`} disabled={readOnly || selectionLocked} min={0.01} value={centimetersToDisplay(selectedWall.thicknessCm ?? 0, lengthUnit)} onChange={(value) => onUpdateWall?.({ ...selectedWall, thicknessCm: displayToCentimeters(Number(value), lengthUnit) })} />
        <TextInput label="Matériau" disabled={readOnly} value={selectedWall.material ?? ''} onChange={(event) => onUpdateWall?.({ ...selectedWall, material: event.currentTarget.value || null })} />
        <TextInput label="Isolation" disabled={readOnly} value={selectedWall.insulation ?? ''} onChange={(event) => onUpdateWall?.({ ...selectedWall, insulation: event.currentTarget.value || null })} />
        <Textarea label="Notes" disabled={readOnly} value={selectedWall.notes ?? ''} onChange={(event) => onUpdateWall?.({ ...selectedWall, notes: event.currentTarget.value || null })} />
      </Stack> : null}
      {type === 'opening' && selectedOpening ? <Stack gap="xs">
        {(['offsetCm', 'widthCm', 'heightCm', 'bottomCm'] as const).map((key) => <NumberInput key={key} label={{ offsetCm: 'Position', widthCm: 'Largeur', heightCm: 'Hauteur', bottomCm: 'Allège' }[key]} disabled={readOnly} min={key === 'offsetCm' || key === 'bottomCm' ? 0 : 0.01} value={centimetersToDisplay(selectedOpening[key], lengthUnit)} onChange={(value) => onUpdateOpening?.({ ...selectedOpening, [key]: displayToCentimeters(Number(value), lengthUnit) })} />)}
        <TextInput label="Orientation" disabled={readOnly} value={selectedOpening.orientation ?? ''} onChange={(event) => onUpdateOpening?.({ ...selectedOpening, orientation: event.currentTarget.value || null })} />
        {onDeleteSelection ? <Button color="red" variant="light" disabled={readOnly} onClick={onDeleteSelection}>Supprimer l’ouverture</Button> : null}
      </Stack> : null}
      {type === 'opening' && !selectedOpening && onCreateOpening ? <Stack gap="xs">
        <NativeSelect label="Template" value={openingTemplateId} data={[{ value: '', label: 'Choisir un template' }, ...templates.map((template) => ({ value: template.id, label: `${template.name} · ${template.placementType}` }))]} onChange={(event) => setOpeningTemplateId(event.currentTarget.value)} />
        <Button disabled={readOnly || selection?.type !== 'wall' || !openingTemplateId} onClick={() => onCreateOpening(openingTemplateId)}>Poser sur le mur sélectionné</Button>
      </Stack> : null}
      {type === 'level' && onCreateLevel ? <Stack gap="xs">
        <TextInput label="Nom" value={levelName} disabled={readOnly} onChange={(event) => setLevelName(event.currentTarget.value)} />
        <NumberInput label="Niveau" value={levelNumber} disabled={readOnly} allowDecimal={false} onChange={setLevelNumber} />
        <Button disabled={readOnly || !levelName.trim() || typeof levelNumber !== 'number'} onClick={() => { if (typeof levelNumber === 'number') void onCreateLevel(levelName, levelNumber); }}>Créer le niveau</Button>
      </Stack> : null}
      {type === 'level' && selectedLevel && onUpdateLevel ? <Stack gap="xs">
        <TextInput label="Nom du niveau" value={selectedLevel.name} disabled={readOnly || selectedLevel.number === 0} onChange={(event) => void onUpdateLevel({ ...selectedLevel, name: event.currentTarget.value })} />
        <NumberInput label={`Altitude (${lengthUnit})`} value={centimetersToDisplay(selectedLevel.altitudeCm ?? 0, lengthUnit)} disabled={readOnly} onChange={(value) => void onUpdateLevel({ ...selectedLevel, altitudeCm: displayToCentimeters(Number(value), lengthUnit) })} />
        {onDeleteLevel && selectedLevel.number !== 0 ? <Button color="red" variant="light" disabled={readOnly} onClick={() => void onDeleteLevel(selectedLevel)}>Supprimer le niveau</Button> : null}
      </Stack> : null}
      {type === 'dimension' && onSaveDimension ? <Stack gap="xs">
        <TextInput label="Nom" value={dimensionName} disabled={readOnly} onChange={(event) => setDimensionName(event.currentTarget.value)} />
        <NumberInput label={`Point 1 X (${lengthUnit})`} value={dimensionStartX} disabled={readOnly} onChange={setDimensionStartX} />
        <NumberInput label={`Point 1 Y (${lengthUnit})`} value={dimensionStartY} disabled={readOnly} onChange={setDimensionStartY} />
        <NumberInput label={`Point 2 X (${lengthUnit})`} value={dimensionEndX} disabled={readOnly} onChange={setDimensionEndX} />
        <NumberInput label={`Point 2 Y (${lengthUnit})`} value={dimensionEndY} disabled={readOnly} onChange={setDimensionEndY} />
        <NumberInput label={`Décalage (${lengthUnit})`} value={dimensionOffset} disabled={readOnly} onChange={setDimensionOffset} />
        <Button disabled={readOnly || [dimensionStartX, dimensionStartY, dimensionEndX, dimensionEndY, dimensionOffset].some((value) => typeof value !== 'number') || (dimensionStartX === dimensionEndX && dimensionStartY === dimensionEndY)} onClick={() => {
          if ([dimensionStartX, dimensionStartY, dimensionEndX, dimensionEndY, dimensionOffset].some((value) => typeof value !== 'number')) return;
          const start = { x: displayToCentimeters(Number(dimensionStartX), lengthUnit), y: displayToCentimeters(Number(dimensionStartY), lengthUnit) };
          const end = { x: displayToCentimeters(Number(dimensionEndX), lengthUnit), y: displayToCentimeters(Number(dimensionEndY), lengthUnit) };
          void onSaveDimension({ id: crypto.randomUUID(), levelId: activeLevelId, name: dimensionName.trim() || 'Nouvelle côte', type: 'point-point', distanceCm: Math.hypot(end.x - start.x, end.y - start.y), offsetCm: displayToCentimeters(Number(dimensionOffset), lengthUnit), referenceA: { type: 'point', ...start }, referenceB: { type: 'point', ...end } });
        }}>Créer la côte</Button>
      </Stack> : null}
      {type === 'dimension' && selectedDimension && onSaveDimension ? <Stack gap="xs">
        <TextInput label="Nom de la côte" value={selectedDimension.label ?? ''} disabled={readOnly} onChange={(event) => void onSaveDimension({ id: selectedDimension.id, levelId: selectedDimension.levelId, name: event.currentTarget.value, type: selectedDimension.type ?? 'point-point', distanceCm: Math.hypot(selectedDimension.end.x - selectedDimension.start.x, selectedDimension.end.y - selectedDimension.start.y), offsetCm: selectedDimension.offsetCm ?? 0, referenceA: { type: 'point', ...selectedDimension.start }, referenceB: { type: 'point', ...selectedDimension.end } })} />
        {onDeleteDimension ? <Button color="red" variant="light" disabled={readOnly} onClick={() => void onDeleteDimension(selectedDimension.id)}>Supprimer la côte</Button> : null}
      </Stack> : null}
      {type === 'note' && onSaveNote ? <Stack gap="xs">
        <Textarea label="Texte" value={noteText} disabled={readOnly} onChange={(event) => setNoteText(event.currentTarget.value)} />
        <Button disabled={readOnly || !noteText.trim()} onClick={() => {
          const originType: EditorNote['originType'] = !selection ? 'projet' : selection.type === 'room' ? 'pièce' : selection.type === 'wall' ? 'mur' : selection.type === 'opening' ? 'ouverture' : selection.type === 'point' ? 'sommet' : selection.type === 'level' ? 'niveau' : 'projet';
          void onSaveNote({ id: crypto.randomUUID(), projectId, originType, originId: originType === 'projet' ? null : selection?.id ?? null, text: noteText });
        }}>Créer la note</Button>
      </Stack> : null}
      {type === 'note' && selectedNote && onSaveNote ? <Stack gap="xs">
        <Textarea label="Texte de la note" value={selectedNote.text} disabled={readOnly} onChange={(event) => void onSaveNote({ id: selectedNote.id, projectId, originType: selectedNote.originType ?? 'projet', originId: selectedNote.originId ?? null, text: event.currentTarget.value })} />
        {onDeleteNote ? <Button color="red" variant="light" disabled={readOnly} onClick={() => void onDeleteNote(selectedNote.id)}>Supprimer la note</Button> : null}
      </Stack> : null}
      {type === 'room' ? <Button disabled={readOnly || !onStartRoomCreation} onClick={onStartRoomCreation}>Dessiner une pièce</Button> : <Button disabled>Création disponible dans une prochaine étape</Button>}
      <Stack gap={2} className="editor-panel__object-list">
        {items[type].length ? items[type].map((item) => <Button key={item.id} size="compact-sm" variant={selection?.type === type && selection.id === item.id ? 'light' : 'subtle'} justify="flex-start" onClick={() => select({ source: 'creation-list', type, id: item.id, levelId: item.levelId })}>{item.label}</Button>) : <Text size="sm" c="dimmed">Aucun élément.</Text>}
      </Stack>
    </Stack></Accordion.Panel></Accordion.Item>)}</Accordion></ScrollArea>
  </aside>;
}

interface TreeNode { key: string; type: SectionType; id: string; levelId: string; roomId?: string; label: string; children?: TreeNode[] }

function DetailTreeNode({ node, allowedRoomId }: { node: TreeNode; allowedRoomId?: string }) {
  const { selection, select } = useEditorSelection(); const [open, setOpen] = useState(true); const selected = selection?.type === node.type && selection.id === node.id;
  const outsideScope = Boolean(allowedRoomId && node.roomId && node.roomId !== allowedRoomId);
  return <li><div className={`detail-tree__row${selected ? ' is-selected' : ''}${outsideScope ? ' is-disabled' : ''}`}>{node.children?.length ? <ActionIcon size="sm" variant="subtle" onClick={() => setOpen((value) => !value)} aria-label={`${open ? 'Replier' : 'Déplier'} ${node.label}`}>{open ? <LuChevronDown /> : <LuChevronRight />}</ActionIcon> : <span className="detail-tree__spacer" />}<Button variant="subtle" disabled={outsideScope} onClick={() => select({ source: 'détail-tree', type: node.type, id: node.id, levelId: node.levelId })}>{node.label}</Button></div>{open && node.children?.length ? <ul>{node.children.map((child) => <DetailTreeNode key={child.key} node={child} allowedRoomId={allowedRoomId} />)}</ul> : null}</li>;
}

export function DetailTree({ data, lengthUnit = 'cm', surfaceUnit = 'm2', allowedRoomId }: { data: CanvasLevelData; lengthUnit?: LengthUnit; surfaceUnit?: SurfaceUnit; allowedRoomId?: string }) {
  const tree = useMemo<TreeNode>(() => ({ key: `level:${data.level.id}`, type: 'level', id: data.level.id, levelId: data.level.id, label: `${data.level.name} (${data.rooms.length} pièce${data.rooms.length > 1 ? 's' : ''})`, children: data.rooms.map((snapshot) => ({ key: `room:${snapshot.room.id}`, type: 'room', id: snapshot.room.id, roomId: snapshot.room.id, levelId: data.level.id, label: `${snapshot.room.name} - ${formatSurface(polygonAreaCm2(sortVertices(snapshot.vertices)), surfaceUnit)}`, children: snapshot.walls.map((wall) => ({ key: `wall:${wall.id}`, type: 'wall', id: wall.id, roomId: snapshot.room.id, levelId: data.level.id, label: `Mur ${shortId(wall.id)} - ${wall.thicknessCm === null || wall.thicknessCm === undefined ? '—' : formatLength(wall.thicknessCm, lengthUnit)}`, children: snapshot.openings.filter(({ wallId }) => wallId === wall.id).map((opening) => ({ key: `opening:${opening.id}`, type: 'opening', id: opening.id, roomId: snapshot.room.id, levelId: data.level.id, label: `${opening.type === 'door' ? 'Porte' : opening.type === 'window' ? 'Fenêtre' : 'Ouverture'} - ${formatLength(opening.widthCm, lengthUnit)} × ${formatLength(opening.heightCm, lengthUnit)}` })) })) })) }), [data, lengthUnit, surfaceUnit]);
  return <ul className="detail-tree"><DetailTreeNode node={tree} allowedRoomId={allowedRoomId} /></ul>;
}

export function EditorDetailPanel({ data, lengthUnit = 'cm', surfaceUnit = 'm2', allowedRoomId }: { data: CanvasLevelData | undefined; lengthUnit?: LengthUnit; surfaceUnit?: SurfaceUnit; allowedRoomId?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <aside className="editor-panel editor-panel--collapsed"><ActionIcon variant="default" size="lg" onClick={() => setOpen(true)} aria-label="Ouvrir le panneau de détail"><LuListTree aria-hidden /></ActionIcon></aside>;
  return <aside className="editor-panel editor-panel--detail"><div className="editor-panel__header"><strong>Détail</strong><ActionIcon variant="subtle" onClick={() => setOpen(false)} aria-label="Fermer le panneau de détail"><LuPanelRightClose aria-hidden /></ActionIcon></div>{data ? <ScrollArea h={620}><DetailTree data={data} lengthUnit={lengthUnit} surfaceUnit={surfaceUnit} allowedRoomId={allowedRoomId} /></ScrollArea> : <Badge color="gray">Aucun niveau</Badge>}</aside>;
}
