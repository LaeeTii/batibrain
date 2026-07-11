import jsPDF from 'jspdf';
import { formatLengthCm, sortVertices, wallsFromVertices } from '../domain/geometry';
import type { LevelMetricSummary } from './roomMetrics';
import type { RoomSnapshot } from '../services/rooms';

interface ExportSimpleLevelPlanPdfOptions {
  svgElement: SVGSVGElement;
  projectName: string;
  levelName: string;
  exportedAt?: Date;
}

interface ExportDetailedLevelPlanPdfOptions {
  svgElement: SVGSVGElement;
  projectName: string;
  levelName: string;
  metrics: LevelMetricSummary;
  snapshots: RoomSnapshot[];
  exportedAt?: Date;
}

interface PageLayout {
  widthMm: number;
  heightMm: number;
  marginMm: number;
}

interface TableColumn {
  label: string;
  widthMm: number;
  align?: 'left' | 'right';
}

const PX_PER_MM = 3.78;
const PAGE_MARGIN_MM = 12;
const CARTOUCHE_HEIGHT_MM = 24;
const PDF_FORMAT = 'a4';
const AREA_FORMATTER = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateDisplay(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatDateForFile(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sans-nom';
}

function buildFileName(projectName: string, levelName: string, exportedAt: Date): string {
  const projectSlug = slugify(projectName);
  const levelSlug = slugify(levelName);
  const dateSegment = formatDateForFile(exportedAt);

  return `${projectSlug}-${levelSlug}-${dateSegment}.pdf`;
}

function buildDetailedFileName(projectName: string, levelName: string, exportedAt: Date): string {
  const projectSlug = slugify(projectName);
  const levelSlug = slugify(levelName);
  const dateSegment = formatDateForFile(exportedAt);

  return `${projectSlug}-${levelSlug}-detail-${dateSegment}.pdf`;
}

function formatArea(areaM2: number): string {
  return `${AREA_FORMATTER.format(areaM2)} m2`;
}

function formatOptionalLength(lengthCm: number | null): string {
  return lengthCm === null ? 'n/d' : formatLengthCm(lengthCm);
}

function formatOpeningType(type: 'door' | 'window' | 'other'): string {
  if (type === 'door') {
    return 'Porte';
  }
  if (type === 'window') {
    return 'Fenêtre';
  }
  return 'Ouverture';
}

function drawTableHeader(pdf: jsPDF, columns: TableColumn[], xStart: number, y: number) {
  let cursorX = xStart;
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(35, 45, 64);
  pdf.setFontSize(9);

  for (const column of columns) {
    const x = column.align === 'right' ? cursorX + column.widthMm - 1 : cursorX + 1;
    pdf.text(column.label, x, y, {
      align: column.align === 'right' ? 'right' : 'left',
      baseline: 'middle',
    });
    cursorX += column.widthMm;
  }
}

function drawTableRow(
  pdf: jsPDF,
  columns: TableColumn[],
  row: string[],
  xStart: number,
  y: number,
  isEven: boolean,
) {
  const rowHeight = 7;
  const totalWidth = columns.reduce((sum, column) => sum + column.widthMm, 0);

  if (isEven) {
    pdf.setFillColor(248, 250, 252);
    pdf.rect(xStart, y - rowHeight + 1, totalWidth, rowHeight, 'F');
  }

  let cursorX = xStart;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(52, 63, 84);
  pdf.setFontSize(8.5);

  columns.forEach((column, index) => {
    const cellValue = row[index] ?? '';
    const x = column.align === 'right' ? cursorX + column.widthMm - 1 : cursorX + 1;
    pdf.text(cellValue, x, y - 2, {
      align: column.align === 'right' ? 'right' : 'left',
      baseline: 'middle',
      maxWidth: Math.max(column.widthMm - 2, 8),
    });
    cursorX += column.widthMm;
  });

  pdf.setDrawColor(221, 227, 236);
  pdf.line(xStart, y + 1, xStart + totalWidth, y + 1);
}

function buildWallsRows(snapshots: RoomSnapshot[]): string[][] {
  return snapshots.flatMap((snapshot) => {
    const derivedWalls = wallsFromVertices(sortVertices(snapshot.vertices));

    return derivedWalls.map((derivedWall) => {
      const wall = snapshot.walls[derivedWall.index];
      return [
        snapshot.room.name,
        `Mur ${derivedWall.index + 1}`,
        formatLengthCm(derivedWall.lengthCm),
        formatOptionalLength(wall?.thicknessCm ?? null),
        formatOptionalLength(wall?.heightLeftCm ?? null),
        formatOptionalLength(wall?.heightRightCm ?? null),
      ];
    });
  });
}

function getSvgAspectRatio(svgElement: SVGSVGElement): number {
  const viewBox = svgElement.viewBox.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return viewBox.width / viewBox.height;
  }

  const rect = svgElement.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return rect.width / rect.height;
  }

  return 1.4;
}

async function rasterizeRenderedSvg(svgElement: SVGSVGElement): Promise<string> {
  const { default: html2canvas } = await import('html2canvas');
  const renderedCanvas = await html2canvas(svgElement as unknown as HTMLElement, {
    backgroundColor: '#ffffff',
    scale: Math.max(window.devicePixelRatio || 1, 2),
    useCORS: true,
    logging: false,
  });

  return renderedCanvas.toDataURL('image/png', 1);
}

async function rasterizeSvg(
  svgElement: SVGSVGElement,
  targetWidthPx: number,
  targetHeightPx: number,
): Promise<string> {
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clonedSvg.setAttribute('width', String(targetWidthPx));
  clonedSvg.setAttribute('height', String(targetHeightPx));
  clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const xml = new XMLSerializer().serializeToString(clonedSvg);
  const encoded = window.btoa(unescape(encodeURIComponent(xml)));
  const source = `data:image/svg+xml;base64,${encoded}`;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error('Impossible de convertir le plan SVG en image.'));
    nextImage.src = source;
  });

  const canvas = document.createElement('canvas');
  canvas.width = targetWidthPx;
  canvas.height = targetHeightPx;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Le contexte de rendu canvas est indisponible.');
  }

  const sourceAspectRatio = image.width > 0 && image.height > 0
    ? image.width / image.height
    : 1;
  const targetAspectRatio = canvas.width / canvas.height;

  let drawWidth = canvas.width;
  let drawHeight = canvas.height;
  let drawX = 0;
  let drawY = 0;

  if (sourceAspectRatio > targetAspectRatio) {
    drawHeight = drawWidth / sourceAspectRatio;
    drawY = (canvas.height - drawHeight) / 2;
  } else {
    drawWidth = drawHeight * sourceAspectRatio;
    drawX = (canvas.width - drawWidth) / 2;
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  return canvas.toDataURL('image/png', 1);
}

async function drawSvgInPdf(
  pdf: jsPDF,
  svgElement: SVGSVGElement,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
): Promise<void> {
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // jsPDF exposes the SVG plugin at runtime; typings can vary by version.
  const pdfWithSvg = pdf as unknown as {
    svg?: (
      element: SVGElement,
      options: { x: number; y: number; width: number; height: number; preserveAspectRatio?: string },
    ) => Promise<void>;
  };

  if (!pdfWithSvg.svg) {
    throw new Error('Le moteur SVG de jsPDF est indisponible.');
  }

  await pdfWithSvg.svg(clonedSvg, {
    x: xMm,
    y: yMm,
    width: widthMm,
    height: heightMm,
    preserveAspectRatio: 'xMidYMid meet',
  });
}

function getPageLayout(orientation: 'portrait' | 'landscape'): PageLayout {
  return orientation === 'landscape'
    ? { widthMm: 297, heightMm: 210, marginMm: PAGE_MARGIN_MM }
    : { widthMm: 210, heightMm: 297, marginMm: PAGE_MARGIN_MM };
}

function drawCartouche(
  pdf: jsPDF,
  layout: PageLayout,
  projectName: string,
  levelName: string,
  exportedAt: Date,
) {
  const cartoucheWidth = layout.widthMm - layout.marginMm * 2;
  const cartoucheY = layout.heightMm - layout.marginMm - CARTOUCHE_HEIGHT_MM;

  pdf.setDrawColor(80, 88, 103);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(layout.marginMm, cartoucheY, cartoucheWidth, CARTOUCHE_HEIGHT_MM, 2, 2, 'FD');

  pdf.setTextColor(23, 34, 52);
  pdf.setFontSize(10);
  pdf.text(`Projet: ${projectName}`, layout.marginMm + 4, cartoucheY + 8);
  pdf.text(`Niveau: ${levelName}`, layout.marginMm + 4, cartoucheY + 14);
  pdf.text(`Date: ${formatDateDisplay(exportedAt)}`, layout.marginMm + 4, cartoucheY + 20);

  pdf.setFontSize(9);
  pdf.setTextColor(88, 96, 111);
  pdf.text('Export plan simple (grille + echelle)', layout.widthMm - layout.marginMm - 4, cartoucheY + 20, {
    align: 'right',
  });
}

export async function exportSimpleLevelPlanPdf({
  svgElement,
  projectName,
  levelName,
  exportedAt = new Date(),
}: ExportSimpleLevelPlanPdfOptions): Promise<string> {
  const renderedRect = svgElement.getBoundingClientRect();
  const renderedAspectRatio = renderedRect.width > 0 && renderedRect.height > 0
    ? renderedRect.width / renderedRect.height
    : getSvgAspectRatio(svgElement);

  const orientation: 'portrait' | 'landscape' = renderedAspectRatio > 1.1 ? 'landscape' : 'portrait';
  const layout = getPageLayout(orientation);
  const contentHeightMm = layout.heightMm - layout.marginMm * 2 - CARTOUCHE_HEIGHT_MM - 6;
  const contentWidthMm = layout.widthMm - layout.marginMm * 2;

  let drawWidthMm = contentWidthMm;
  let drawHeightMm = drawWidthMm / renderedAspectRatio;

  if (drawHeightMm > contentHeightMm) {
    drawHeightMm = contentHeightMm;
    drawWidthMm = drawHeightMm * renderedAspectRatio;
  }

  const drawXmm = layout.marginMm + (contentWidthMm - drawWidthMm) / 2;
  const drawYmm = layout.marginMm + (contentHeightMm - drawHeightMm) / 2;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: PDF_FORMAT,
    compress: true,
  });

  try {
    const renderedImageData = await rasterizeRenderedSvg(svgElement);

    pdf.addImage(
      renderedImageData,
      'PNG',
      drawXmm,
      drawYmm,
      drawWidthMm,
      drawHeightMm,
      undefined,
      'FAST',
    );
  } catch {
    try {
      await drawSvgInPdf(pdf, svgElement, drawXmm, drawYmm, drawWidthMm, drawHeightMm);
    } catch {
      const contentWidthPx = Math.max(Math.round(drawWidthMm * PX_PER_MM), 1200);
      const contentHeightPx = Math.max(Math.round(drawHeightMm * PX_PER_MM), 900);
      const imageData = await rasterizeSvg(svgElement, contentWidthPx, contentHeightPx);

      pdf.addImage(
        imageData,
        'PNG',
        drawXmm,
        drawYmm,
        drawWidthMm,
        drawHeightMm,
        undefined,
        'FAST',
      );
    }
  }

  drawCartouche(pdf, layout, projectName, levelName, exportedAt);

  const fileName = buildFileName(projectName, levelName, exportedAt);
  pdf.save(fileName);

  return fileName;
}

export async function exportDetailedLevelPlanPdf({
  svgElement,
  projectName,
  levelName,
  metrics,
  snapshots,
  exportedAt = new Date(),
}: ExportDetailedLevelPlanPdfOptions): Promise<string> {
  const renderedRect = svgElement.getBoundingClientRect();
  const renderedAspectRatio = renderedRect.width > 0 && renderedRect.height > 0
    ? renderedRect.width / renderedRect.height
    : getSvgAspectRatio(svgElement);

  const orientation: 'portrait' | 'landscape' = 'landscape';
  const layout = getPageLayout(orientation);
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: PDF_FORMAT,
    compress: true,
  });

  const topY = layout.marginMm;
  const bottomY = layout.heightMm - layout.marginMm;
  const contentWidthMm = layout.widthMm - layout.marginMm * 2;
  let cursorY = topY;
  let pageNumber = 1;

  const drawPageHeader = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(23, 34, 52);
    pdf.setFontSize(14);
    pdf.text('Export détaillé - Niveau', layout.marginMm, layout.marginMm + 4);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(74, 85, 104);
    pdf.text(`Projet: ${projectName}`, layout.marginMm, layout.marginMm + 10);
    pdf.text(`Niveau: ${levelName}`, layout.marginMm + 72, layout.marginMm + 10);
    pdf.text(`Date: ${formatDateDisplay(exportedAt)}`, layout.marginMm + 145, layout.marginMm + 10);

    pdf.setDrawColor(214, 221, 230);
    pdf.line(layout.marginMm, layout.marginMm + 13, layout.marginMm + contentWidthMm, layout.marginMm + 13);

    pdf.setFontSize(8);
    pdf.setTextColor(129, 140, 156);
    pdf.text(`Page ${pageNumber}`, layout.marginMm + contentWidthMm, bottomY, { align: 'right' });
    cursorY = layout.marginMm + 18;
  };

  const ensureSpace = (heightNeeded: number) => {
    if (cursorY + heightNeeded <= bottomY - 5) {
      return;
    }

    pdf.addPage(PDF_FORMAT, orientation);
    pageNumber += 1;
    drawPageHeader();
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(35, 45, 64);
    pdf.setFontSize(11);
    pdf.text(title, layout.marginMm, cursorY);
    cursorY += 5;
  };

  const drawTableSection = (title: string, columns: TableColumn[], rows: string[][]) => {
    drawSectionTitle(title);
    ensureSpace(10);

    const xStart = layout.marginMm;
    const rowHeight = 7;

    drawTableHeader(pdf, columns, xStart, cursorY + 2);
    cursorY += 5;

    rows.forEach((row, index) => {
      ensureSpace(rowHeight + 2);
      drawTableRow(pdf, columns, row, xStart, cursorY + rowHeight - 1, index % 2 === 0);
      cursorY += rowHeight;
    });

    cursorY += 4;
  };

  drawPageHeader();

  const planMaxHeightMm = 82;
  const planMaxWidthMm = contentWidthMm;
  let planWidthMm = planMaxWidthMm;
  let planHeightMm = planWidthMm / renderedAspectRatio;
  if (planHeightMm > planMaxHeightMm) {
    planHeightMm = planMaxHeightMm;
    planWidthMm = planHeightMm * renderedAspectRatio;
  }

  const planX = layout.marginMm + (planMaxWidthMm - planWidthMm) / 2;
  const planY = cursorY;
  ensureSpace(planHeightMm + 10);

  try {
    const renderedImageData = await rasterizeRenderedSvg(svgElement);
    pdf.addImage(renderedImageData, 'PNG', planX, planY, planWidthMm, planHeightMm, undefined, 'FAST');
  } catch {
    try {
      await drawSvgInPdf(pdf, svgElement, planX, planY, planWidthMm, planHeightMm);
    } catch {
      const contentWidthPx = Math.max(Math.round(planWidthMm * PX_PER_MM), 1200);
      const contentHeightPx = Math.max(Math.round(planHeightMm * PX_PER_MM), 900);
      const imageData = await rasterizeSvg(svgElement, contentWidthPx, contentHeightPx);
      pdf.addImage(imageData, 'PNG', planX, planY, planWidthMm, planHeightMm, undefined, 'FAST');
    }
  }

  cursorY += planHeightMm + 8;

  drawSectionTitle('Métriques principales');
  ensureSpace(20);
  pdf.setFillColor(246, 248, 252);
  pdf.roundedRect(layout.marginMm, cursorY, contentWidthMm, 16, 2, 2, 'F');
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(52, 63, 84);
  pdf.setFontSize(9.5);
  const metricLine1 = [
    `Surface totale: ${formatArea(metrics.totalAreaM2)}`,
    `Pièces: ${metrics.roomCount}`,
    `Murs exterieurs: ${metrics.exteriorWallsCount}`,
  ].join(' | ');
  const metricLine2 = [
    `Ouvertures: ${metrics.openingsCount}`,
    `Portes: ${metrics.doorsCount}`,
    `Fenêtres: ${metrics.windowsCount}`,
    `H min/max: ${formatOptionalLength(metrics.minHeightCm)} / ${formatOptionalLength(metrics.maxHeightCm)}`,
  ].join(' | ');
  pdf.text(metricLine1, layout.marginMm + 3, cursorY + 6);
  pdf.text(metricLine2, layout.marginMm + 3, cursorY + 12);
  cursorY += 21;

  drawTableSection(
    'Liste des pièces',
    [
      { label: 'Pièce', widthMm: 66 },
      { label: 'Surface', widthMm: 30, align: 'right' },
      { label: 'Murs', widthMm: 20, align: 'right' },
      { label: 'Ouvertures', widthMm: 26, align: 'right' },
      { label: 'Portes', widthMm: 20, align: 'right' },
      { label: 'Fenêtres', widthMm: 22, align: 'right' },
      { label: 'H min/max', widthMm: 77 },
    ],
    metrics.rooms.map((room) => [
      room.name,
      formatArea(room.areaM2),
      String(room.wallCount),
      String(room.openingsCount),
      String(room.doorsCount),
      String(room.windowsCount),
      `${formatOptionalLength(room.minHeightCm)} / ${formatOptionalLength(room.maxHeightCm)}`,
    ]),
  );

  drawTableSection(
    'Liste des murs',
    [
      { label: 'Pièce', widthMm: 70 },
      { label: 'Mur', widthMm: 20 },
      { label: 'Longueur', widthMm: 28, align: 'right' },
      { label: 'Épaisseur', widthMm: 28, align: 'right' },
      { label: 'H gauche', widthMm: 28, align: 'right' },
      { label: 'H droite', widthMm: 28, align: 'right' },
    ],
    buildWallsRows(snapshots),
  );

  drawTableSection(
    'Liste des ouvertures',
    [
      { label: 'Pièce', widthMm: 52 },
      { label: 'Mur', widthMm: 18 },
      { label: 'Type', widthMm: 24 },
      { label: 'Largeur', widthMm: 24, align: 'right' },
      { label: 'Hauteur', widthMm: 24, align: 'right' },
      { label: 'Allège', widthMm: 24, align: 'right' },
      { label: 'Position', widthMm: 24, align: 'right' },
      { label: 'ID', widthMm: 33 },
    ],
    metrics.openings.map((opening) => [
      opening.roomName,
      `M${opening.wallIndex + 1}`,
      formatOpeningType(opening.type),
      formatLengthCm(opening.widthCm),
      formatLengthCm(opening.heightCm),
      formatLengthCm(opening.bottomCm),
      formatLengthCm(opening.offsetCm),
      opening.openingId.slice(0, 8),
    ]),
  );

  const fileName = buildDetailedFileName(projectName, levelName, exportedAt);
  pdf.save(fileName);

  return fileName;
}
