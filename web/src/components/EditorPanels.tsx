import React, { useEffect, useMemo, useState } from 'react';
import { Accordion, ActionIcon, Badge, Button, ScrollArea, Stack, Text } from '@mantine/core';
import { LuArrowLeft, LuBrickWall, LuChevronDown, LuChevronRight, LuDoorOpen, LuLayers3, LuListTree, LuPanelLeftClose, LuPanelLeftOpen, LuPanelRightClose, LuRuler, LuSquareDashed, LuStickyNote } from 'react-icons/lu';
import { polygonAreaCm2, sortVertices } from '../domain/geometry';
import { uniqueLevelOpenings, uniqueLevelWalls } from '../domain/roomOverlap';
import type { Level } from '../domain/types';
import type { CanvasLevelData } from './Canvas2D';
import { useEditorSelection } from './SelectionSyncBridge';

type SectionType = 'level' | 'room' | 'wall' | 'opening' | 'dimension' | 'note';
const sectionDetails = {
  level: ['Niveaux', LuLayers3], room: ['Pièces', LuSquareDashed], wall: ['Murs', LuBrickWall],
  opening: ['Ouvertures', LuDoorOpen], dimension: ['Côtes', LuRuler], note: ['Notes', LuStickyNote],
} as const;

function shortId(id: string) { return id.slice(0, 8); }

export function EditorCreationPanel({ levels, levelData, activeLevelId, readOnly = false, selectionLocked = false, creationMessage = '', onStartRoomCreation }: { levels: Level[]; levelData: CanvasLevelData[]; activeLevelId: string; readOnly?: boolean; selectionLocked?: boolean; creationMessage?: string; onStartRoomCreation?(): void }) {
  const { selection, select } = useEditorSelection(); const [collapsed, setCollapsed] = useState(false); const [section, setSection] = useState<string | null>(null);
  useEffect(() => { if (selection && selection.type !== 'point') setSection(selection.type); }, [selection]);
  const data = levelData.find(({ level }) => level.id === activeLevelId);
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
      {items[type].length ? items[type].map((item) => <Button key={item.id} variant={selection?.type === type && selection.id === item.id ? 'light' : 'subtle'} justify="flex-start" onClick={() => select({ source: 'creation-list', type, id: item.id, levelId: item.levelId })}>{item.label}</Button>) : <Text size="sm" c="dimmed">Aucun élément.</Text>}
      {type === 'room' ? <Button disabled={readOnly || !onStartRoomCreation} onClick={onStartRoomCreation}>Dessiner une pièce</Button> : <Button disabled>Création disponible dans une prochaine étape</Button>}
    </Stack></Accordion.Panel></Accordion.Item>)}</Accordion></ScrollArea>
  </aside>;
}

interface TreeNode { key: string; type: SectionType; id: string; levelId: string; label: string; children?: TreeNode[] }

function DetailTreeNode({ node }: { node: TreeNode }) {
  const { selection, select } = useEditorSelection(); const [open, setOpen] = useState(true); const selected = selection?.type === node.type && selection.id === node.id;
  return <li><div className={`detail-tree__row${selected ? ' is-selected' : ''}`}>{node.children?.length ? <ActionIcon size="sm" variant="subtle" onClick={() => setOpen((value) => !value)} aria-label={`${open ? 'Replier' : 'Déplier'} ${node.label}`}>{open ? <LuChevronDown /> : <LuChevronRight />}</ActionIcon> : <span className="detail-tree__spacer" />}<Button variant="subtle" onClick={() => select({ source: 'détail-tree', type: node.type, id: node.id, levelId: node.levelId })}>{node.label}</Button></div>{open && node.children?.length ? <ul>{node.children.map((child) => <DetailTreeNode key={child.key} node={child} />)}</ul> : null}</li>;
}

export function DetailTree({ data }: { data: CanvasLevelData }) {
  const tree = useMemo<TreeNode>(() => ({ key: `level:${data.level.id}`, type: 'level', id: data.level.id, levelId: data.level.id, label: `${data.level.name} (${data.rooms.length} pièce${data.rooms.length > 1 ? 's' : ''})`, children: data.rooms.map((snapshot) => ({ key: `room:${snapshot.room.id}`, type: 'room', id: snapshot.room.id, levelId: data.level.id, label: `${snapshot.room.name} - ${(polygonAreaCm2(sortVertices(snapshot.vertices)) / 10000).toFixed(2)} m²`, children: snapshot.walls.map((wall) => ({ key: `wall:${wall.id}`, type: 'wall', id: wall.id, levelId: data.level.id, label: `Mur ${shortId(wall.id)} - ${wall.thicknessCm ?? '—'} cm`, children: snapshot.openings.filter(({ wallId }) => wallId === wall.id).map((opening) => ({ key: `opening:${opening.id}`, type: 'opening', id: opening.id, levelId: data.level.id, label: `${opening.type === 'door' ? 'Porte' : opening.type === 'window' ? 'Fenêtre' : 'Ouverture'} - ${opening.widthCm} × ${opening.heightCm} cm` })) })) })) }), [data]);
  return <ul className="detail-tree"><DetailTreeNode node={tree} /></ul>;
}

export function EditorDetailPanel({ data }: { data: CanvasLevelData | undefined }) {
  const [open, setOpen] = useState(false);
  if (!open) return <aside className="editor-panel editor-panel--collapsed"><ActionIcon variant="default" size="lg" onClick={() => setOpen(true)} aria-label="Ouvrir le panneau de détail"><LuListTree aria-hidden /></ActionIcon></aside>;
  return <aside className="editor-panel editor-panel--detail"><div className="editor-panel__header"><strong>Détail</strong><ActionIcon variant="subtle" onClick={() => setOpen(false)} aria-label="Fermer le panneau de détail"><LuPanelRightClose aria-hidden /></ActionIcon></div>{data ? <ScrollArea h={620}><DetailTree data={data} /></ScrollArea> : <Badge color="gray">Aucun niveau</Badge>}</aside>;
}
