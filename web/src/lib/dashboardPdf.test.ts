import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USER_PREFERENCES } from '../domain/userPreferences';
import type { Level } from '../domain/types';
import type { RoomSnapshot } from '../services/rooms';

const pdf = vi.hoisted(() => ({
  setFontSize: vi.fn(), text: vi.fn(), setDrawColor: vi.fn(), setLineWidth: vi.fn(),
  line: vi.fn(), addPage: vi.fn(), save: vi.fn(),
}));

vi.mock('jspdf', () => ({
  default: function JsPdfMock() {
    return pdf;
  },
}));

const { exportDashboardPdf } = await import('./dashboardPdf');

const level: Level = { id: 'niveau-1', projectId: 'projet-1', name: 'RDC', number: 0, isVisible: true };
const snapshot: RoomSnapshot = {
  room: { id: 'pièce-1', levelId: level.id, name: 'Cuisine', type: 'cuisine', floorColor: '#fff' },
  vertices: [
    { id: 'a', pieceId: 'pièce-1', order: 0, x: 0, y: 0 },
    { id: 'b', pieceId: 'pièce-1', order: 1, x: 300, y: 0 },
    { id: 'c', pieceId: 'pièce-1', order: 2, x: 300, y: 200 },
    { id: 'd', pieceId: 'pièce-1', order: 3, x: 0, y: 200 },
  ],
  walls: [],
  openings: [],
};

beforeEach(() => vi.clearAllMocks());

describe('export PDF du dashboard', () => {
  it('convertit les mesures dans les unités actives au déclenchement', () => {
    exportDashboardPdf('Maison', [level], [snapshot], 'détail', {
      ...DEFAULT_USER_PREFERENCES,
      lengthUnit: 'mm',
      surfaceUnit: 'cm2',
    });

    expect(pdf.text).toHaveBeenCalledWith(expect.stringMatching(/^Surface : 60.000 cm²$/), 20, 190);
    expect(pdf.text).toHaveBeenCalledWith(expect.stringMatching(/^Périmètre : 10.000 mm$/), 20, 198);
    expect(pdf.save).toHaveBeenCalledWith('maison-plans-detail.pdf');
  });
});
