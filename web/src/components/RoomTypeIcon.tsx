import React from 'react';
import {
  LuBath, LuBedDouble, LuBookOpen, LuCar, LuChefHat, LuDoorOpen, LuLampDesk,
  LuSofa, LuToilet,
} from 'react-icons/lu';
import { FaChessPawn } from 'react-icons/fa6';
import type { ComponentType } from 'react';
import type { RoomType } from '../domain/types';

const ICONS: Partial<Record<RoomType, ComponentType<{ 'aria-hidden'?: boolean }>>> = {
  cuisine: LuChefHat, chambre: LuBedDouble, salon: LuSofa, salle_de_bain: LuBath,
  toilettes: LuToilet, bureau: LuLampDesk, garage: LuCar, hall: LuDoorOpen,
  salle_de_jeu: FaChessPawn, bibliotheque: LuBookOpen,
};

export function RoomTypeIcon({ type }: { type: RoomType }) {
  const Icon = ICONS[type];
  return Icon ? <Icon aria-hidden /> : null;
}
