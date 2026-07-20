import jsPDF from 'jspdf';
import { polygonPerimeterCm, sortVertices } from '../domain/geometry';
import { getRoomAreaM2 } from './roomMetrics';
import type { Level } from '../domain/types';
import type { RoomSnapshot } from '../services/rooms';
import type { RoomPdfMode } from '../components/RoomCard';
import {
  DEFAULT_USER_PREFERENCES,
  formatLength,
  formatSurfaceFromSquareMeters,
  type UserPreferences,
} from '../domain/userPreferences';

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'projet';
}

function drawRoom(pdf: jsPDF, snapshot: RoomSnapshot) {
  const vertices = sortVertices(snapshot.vertices);
  if (vertices.length < 3) throw new Error(`Le plan de « ${snapshot.room.name} » est indisponible.`);
  const xs = vertices.map(({ x }) => x);
  const ys = vertices.map(({ y }) => y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const scale = Math.min(160 / Math.max(maxX - minX, 1), 120 / Math.max(maxY - minY, 1));
  const points = vertices.map(({ x, y }) => ({ x: 25 + (x - minX) * scale, y: 45 + (y - minY) * scale }));
  pdf.setDrawColor(40, 50, 68); pdf.setLineWidth(1.2);
  points.forEach((point, index) => { const next = points[(index + 1) % points.length]; pdf.line(point.x, point.y, next.x, next.y); });
}

function addRoomPage(pdf: jsPDF, snapshot: RoomSnapshot, level: Level | undefined, projectName: string, mode: RoomPdfMode, preferences: UserPreferences) {
  pdf.setFontSize(18); pdf.text(snapshot.room.name.trim() || 'Nouvelle pièce', 20, 20);
  pdf.setFontSize(10); pdf.text(`${projectName} · ${level?.name ?? 'Niveau non disponible'}`, 20, 29);
  drawRoom(pdf, snapshot);
  if (mode === 'détail') {
    const y = 180;
    pdf.setFontSize(13); pdf.text('Synthèse', 20, y);
    pdf.setFontSize(10);
    pdf.text(`Surface : ${formatSurfaceFromSquareMeters(getRoomAreaM2(snapshot.vertices), preferences.surfaceUnit)}`, 20, y + 10);
    pdf.text(`Périmètre : ${formatLength(polygonPerimeterCm(snapshot.vertices), preferences.lengthUnit)}`, 20, y + 18);
    pdf.text(`Murs : ${snapshot.walls.length} · Ouvertures : ${snapshot.openings.length}`, 20, y + 26);
    if (snapshot.room.notes?.trim()) pdf.text(`Notes : ${snapshot.room.notes.trim()}`, 20, y + 38, { maxWidth: 170 });
  }
  pdf.setFontSize(8); pdf.text(mode === 'plan' ? 'pdf_dashboard_global_plan_simple' : 'pdf_dashboard_global_plan_detail', 20, 285);
}

export function exportDashboardPdf(projectName: string, levels: Level[], snapshots: RoomSnapshot[], mode: RoomPdfMode, preferences: UserPreferences = DEFAULT_USER_PREFERENCES) {
  if (snapshots.length === 0) throw new Error('Aucune pièce visible à exporter.');
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
  snapshots.forEach((snapshot, index) => {
    if (index > 0) pdf.addPage();
    addRoomPage(pdf, snapshot, levels.find(({ id }) => id === snapshot.room.levelId), projectName, mode, preferences);
  });
  const suffix = mode === 'plan' ? 'plans' : 'plans-detail';
  pdf.save(`${slug(projectName)}-${suffix}.pdf`);
}
