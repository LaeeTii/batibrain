import React from 'react';
import {
  LuBath, LuBedDouble, LuBookOpen, LuBriefcaseBusiness, LuCar, LuCookingPot,
  LuGamepad2, LuHouse, LuToilet,
} from 'react-icons/lu';
import type { ComponentType } from 'react';
import type { RoomType } from '../domain/types';

const ICONS: Partial<Record<RoomType, ComponentType<{ 'aria-hidden'?: boolean }>>> = {
  cuisine: LuCookingPot, chambre: LuBedDouble, salon: LuHouse, salle_de_bain: LuBath,
  toilettes: LuToilet, bureau: LuBriefcaseBusiness, garage: LuCar, hall: LuHouse,
  salle_de_jeu: LuGamepad2, bibliotheque: LuBookOpen,
};

export function RoomTypeIcon({ type }: { type: RoomType }) {
  const Icon = ICONS[type];
  return Icon ? <Icon aria-hidden /> : null;
}
