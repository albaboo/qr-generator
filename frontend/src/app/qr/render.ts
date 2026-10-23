import { create } from 'qrcode';
import { EyeShape, ModuleShape, QrDesign, isHexColor, isImageDataUrl, maxCornerRadius } from './design';

/** Lado de cada ojo (patrón de localización) en módulos, fijado por el estándar. */
const EYE_SIZE = 7;
/** Separación, del color del fondo, entre el recuadro del logo y los módulos (como en EMM). */
const LOGO_MARGIN = 1;

export interface QrGeometry {
  /** Lado de la matriz en módulos. */
  modules: number;
  /** Lado total del dibujo (matriz, zona de silencio y borde) en módulos: es el viewBox. */
  size: number;
  /** Desde dónde empieza la matriz (zona de silencio más borde). */
  offset: number;
  /** Recuadro del logo en módulos, o null si no hay logo. */
  logo: { position: number; side: number } | null;
}

/** Matriz del QR con corrección de errores alta (H), que es la que permite tapar el centro con un logo. */
export function qrMatrix(value: string): { size: number; get(row: number, column: number): boolean } {
  const modules = create(value, { errorCorrectionLevel: 'H' }).modules;
  return { size: modules.size, get: (row, column) => Boolean(modules.get(row, column)) };
}

export function qrGeometry(modules: number, design: QrDesign): QrGeometry {
  const border = design.border.enabled ? design.border.width : 0;
  const offset = border + design.quietZone;
  const size = modules + offset * 2;
  if (!design.logo.enabled) {
    return { modules, size, offset, logo: null };
  }
  // Mismo número impar de módulos que la matriz para que el recuadro quede alineado con la cuadrícula.
  let side = Math.floor(modules * design.logo.size);
  if (side % 2 !== modules % 2) {
    side -= 1;
  }
  side = Math.max(3, side);
  return { modules, size, offset, logo: { side, position: offset + (modules - side) / 2 } };
}

/**
 * Dibuja el QR como un SVG independiente (se puede guardar tal cual en un archivo). Solo inserta colores y data URLs
 * que han pasado la validación, así que no puede colarse marcado ajeno. Con `pixels` añade ancho y alto, que hacen
 * falta para pasarlo a PNG.
 */
export function renderQrSvg(value: string, design: QrDesign, pixels?: number): string {
  assertSafe(design);
  const matrix = qrMatrix(value);
  const geometry = qrGeometry(matrix.size, design);
  const { size, offset } = geometry;
  const parts: string[] = [];

  const radius = Math.min(design.cornerRadius, maxCornerRadius(design));
  if (design.border.enabled) {
    const width = design.border.width;
    parts.push(rect(0, 0, size, size, radius, design.border.color));
    parts.push(rect(width, width, size - width * 2, size - width * 2, Math.max(0, radius - width), design.background));
  } else {
    parts.push(rect(0, 0, size, size, radius, design.background));
  }

  const eyes = eyeOrigins(matrix.size);
  let d = '';
  for (let row = 0; row < matrix.size; row++) {
    for (let column = 0; column < matrix.size; column++) {
      if (matrix.get(row, column) && !eyes.some(([r, c]) => inside(row, column, r, c, EYE_SIZE))) {
        d += modulePath(column + offset, row + offset, design.moduleShape);
      }
    }
  }
  const crisp = design.moduleShape === 'square' ? ' shape-rendering="crispEdges"' : '';
  parts.push(`<path d="${d}" fill="${design.foreground}"${crisp}/>`);

  for (const [row, column] of eyes) {
    parts.push(eye(column + offset, row + offset, design.eyeShape, design.eyeColor));
  }

  if (geometry.logo) {
    parts.push(logo(geometry.logo.position, geometry.logo.side, design));
  }

  const dimensions = pixels ? ` width="${pixels}" height="${pixels}"` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(size)} ${n(size)}"${dimensions}>` +
    parts.join('') +
    '</svg>'
  );
}

/** El SVG como data URL, para mostrarlo en un `<img>` o pintarlo en un canvas. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function assertSafe(design: QrDesign): void {
  const colors = [design.foreground, design.background, design.eyeColor, design.border.color, design.logo.boxColor];
  if (!colors.every(isHexColor)) {
    throw new Error('El diseño tiene un color no válido.');
  }
  if (design.logo.image !== null && !isImageDataUrl(design.logo.image)) {
    throw new Error('La imagen del centro no es válida.');
  }
}

function eyeOrigins(modules: number): [number, number][] {
  return [
    [0, 0],
    [0, modules - EYE_SIZE],
    [modules - EYE_SIZE, 0],
  ];
}

function inside(row: number, column: number, top: number, left: number, side: number): boolean {
  return row >= top && row < top + side && column >= left && column < left + side;
}

function modulePath(x: number, y: number, shape: ModuleShape): string {
  switch (shape) {
    case 'square':
      return `M${x} ${y}h1v1h-1z`;
    case 'dot':
      return `M${n(x + 0.05)} ${n(y + 0.5)}a.45 .45 0 1 0 .9 0a.45 .45 0 1 0 -.9 0z`;
    case 'rounded':
      return `M${n(x + 0.3)} ${y}h.4a.3 .3 0 0 1 .3 .3v.4a.3 .3 0 0 1 -.3 .3h-.4a.3 .3 0 0 1 -.3 -.3v-.4a.3 .3 0 0 1 .3 -.3z`;
  }
}

/** Un ojo: un anillo de 7 × 7 módulos (de un módulo de grosor) con un cuadro de 3 × 3 en el centro. */
function eye(x: number, y: number, shape: EyeShape, color: string): string {
  if (shape === 'circle') {
    return (
      `<circle cx="${n(x + 3.5)}" cy="${n(y + 3.5)}" r="3" fill="none" stroke="${color}" stroke-width="1"/>` +
      `<circle cx="${n(x + 3.5)}" cy="${n(y + 3.5)}" r="1.5" fill="${color}"/>`
    );
  }
  const [outer, inner] = shape === 'rounded' ? [1.5, 0.75] : [0, 0];
  const crisp = shape === 'square' ? ' shape-rendering="crispEdges"' : '';
  return (
    `<rect x="${n(x + 0.5)}" y="${n(y + 0.5)}" width="6" height="6" rx="${outer}" fill="none" stroke="${color}" stroke-width="1"${crisp}/>` +
    `<rect x="${n(x + 2)}" y="${n(y + 2)}" width="3" height="3" rx="${inner}" fill="${color}"${crisp}/>`
  );
}

/**
 * El logo: un marco del color del fondo con un módulo de margen que lo separa del código, encima el recuadro del
 * color elegido y dentro la imagen, recortada a la forma del recuadro.
 */
function logo(position: number, side: number, design: QrDesign): string {
  const { boxColor, padding, image } = design.logo;
  const radius = side * design.logo.radius;
  const frame = side + LOGO_MARGIN * 2;
  const parts = [
    rect(
      position - LOGO_MARGIN,
      position - LOGO_MARGIN,
      frame,
      frame,
      radius > 0 ? radius + LOGO_MARGIN : 0,
      design.background,
    ),
    rect(position, position, side, side, radius, boxColor),
  ];
  if (image) {
    const inset = side * padding;
    const imageSide = side - inset * 2;
    parts.push(
      `<clipPath id="qr-logo-clip">${rect(position, position, side, side, radius, boxColor)}</clipPath>`,
      `<image href="${image}" x="${n(position + inset)}" y="${n(position + inset)}" width="${n(imageSide)}" height="${n(imageSide)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#qr-logo-clip)"/>`,
    );
  }
  return parts.join('');
}

function rect(x: number, y: number, width: number, height: number, radius: number, fill: string): string {
  const rx = radius > 0 ? ` rx="${n(radius)}"` : '';
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}"${rx} fill="${fill}"/>`;
}

/** Números cortos y sin ruido de coma flotante (0.30000000000000004 → 0.3). */
function n(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
