import React from 'react';
import { ActionIcon, Button, Menu } from '@mantine/core';
import { LuFileDown, LuMessageSquarePlus, LuTrash2 } from 'react-icons/lu';
import type { RoomType } from '../domain/types';
import { RoomPreview } from './RoomPreview';
import type { RoomSnapshot } from '../services/rooms';
import { RoomTypeIcon } from './RoomTypeIcon';

export type RoomPdfMode = 'plan' | 'détail';

const TYPE_LABELS: Record<RoomType, string> = {
  cuisine: 'Cuisine', chambre: 'Chambre', salon: 'Salon', salle_de_bain: 'Salle de bain',
  toilettes: 'Toilettes', bureau: 'Bureau', garage: 'Garage', hall: 'Hall',
  salle_de_jeu: 'Salle de jeu', bibliotheque: 'Bibliothèque', autre: 'Autre',
};
interface RoomCardProps {
  snapshot: RoomSnapshot;
  levelName: string;
  areaM2: number;
  canEdit: boolean;
  onOpen(): void;
  onAddNote(): void;
  onDelete(): void;
  onExport(mode: RoomPdfMode): void;
}

export function RoomCard({ snapshot, levelName, areaM2, canEdit, onOpen, onAddNote, onDelete, onExport }: RoomCardProps) {
  const roomName = snapshot.room.name.trim() || 'Nouvelle pièce';
  const hasTypeIcon = snapshot.room.type !== 'autre';

  return <article className="room-card">
    <Button variant="subtle" type="button" className="room-card__open" onClick={onOpen} aria-label={`Ouvrir ${roomName}`}>
      <RoomPreview vertices={snapshot.vertices} walls={snapshot.walls} openings={snapshot.openings} accentColor={snapshot.room.floorColor} />
      <span className="room-card__body">
        <span className="room-card__titleRow"><span><strong className="room-card__title">{roomName}</strong><span className="room-card__area">{areaM2.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m²</span></span></span>
        <span className="room-card__finish">{levelName}</span>
        {hasTypeIcon ? <span className="room-card__type"><RoomTypeIcon type={snapshot.room.type} /> {TYPE_LABELS[snapshot.room.type]}</span> : null}
      </span>
    </Button>
    <div className="room-card__actions" aria-label={`Actions pour ${roomName}`}>
      {canEdit ? <ActionIcon variant="subtle" className="room-card__iconAction" onClick={onAddNote} aria-label={`Ajouter une note à ${roomName}`} title="Ajouter une note"><LuMessageSquarePlus aria-hidden /></ActionIcon> : null}
      <Menu position="bottom-end" withinPortal>
        <Menu.Target><ActionIcon variant="subtle" className="room-card__iconAction" aria-label={`Exporter ${roomName}`} title="Exporter la pièce"><LuFileDown aria-hidden /></ActionIcon></Menu.Target>
        <Menu.Dropdown><Menu.Item onClick={() => onExport('plan')}>Plan simple</Menu.Item><Menu.Item onClick={() => onExport('détail')}>Plan + détail</Menu.Item></Menu.Dropdown>
      </Menu>
      {canEdit ? <ActionIcon variant="subtle" color="red" className="room-card__iconAction room-card__iconAction--danger" onClick={onDelete} aria-label={`Supprimer ${roomName}`} title="Supprimer la pièce"><LuTrash2 aria-hidden /></ActionIcon> : null}
    </div>
  </article>;
}
