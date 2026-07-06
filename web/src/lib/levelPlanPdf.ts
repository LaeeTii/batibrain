import jsPDF from 'jspdf';

interface ExportSimpleLevelPlanPdfOptions {
  svgElement: SVGSVGElement;
  projectName: string;
  levelName: string;
  exportedAt?: Date;
}

interface PageLayout {
  widthMm: number;
  heightMm: number;
  marginMm: number;
}

const PX_PER_MM = 3.78;
const PAGE_MARGIN_MM = 12;
const CARTOUCHE_HEIGHT_MM = 24;
const PDF_FORMAT = 'a4';

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
