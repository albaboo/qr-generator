import { create } from 'qrcode';
import { BorderDesign, EyeShape, ModuleShape, QrDesign, isHexColor, isImageDataUrl } from './design';

/** Lado de cada ojo (patrón de localización) en módulos, fijado por el estándar. */
const EYE_SIZE = 7;
/** Separación sin módulos entre el recuadro del logo y el resto del código (como en EMM). */
const LOGO_MARGIN = 1;
/** Radio de las esquinas exteriores en los módulos «redondeados unidos». */
const JOINED_RADIUS = 0.4;
/** Radio de los puntos y medio grosor de los tramos que los unen en los «puntos unidos». */
const JOINED_DOT_RADIUS = 0.4;

/** Qué módulos vecinos están pintados: las formas «unidas» dependen de ellos. */
interface Neighbours {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  bottomRight: boolean;
}

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

  // El borde es un anillo (y no un recuadro tapado por el fondo) para que el interior pueda quedar transparente.
  // Tiene sus propios redondeos por fuera y por dentro; sin borde, el fondo usa el redondeo general.
  const border = design.border.enabled ? design.border.width : 0;
  const outerRadius = border > 0 ? design.border.outerRadius : design.cornerRadius;
  const innerRadius = border > 0 ? design.border.innerRadius : design.cornerRadius;
  if (border > 0) {
    parts.push(borderShape(size, design.border, design.border.color));
  }
  if (!design.transparent) {
    parts.push(rect(border, border, size - border * 2, size - border * 2, innerRadius, design.background));
  }

  // Los ojos se dibujan aparte, y bajo el logo (más su margen) no se pinta ningún módulo: así el hueco se ve aunque
  // no haya fondo.
  const eyes = eyeOrigins(matrix.size);
  const hole = geometry.logo ? geometry.logo.position - offset - LOGO_MARGIN : 0;
  const holeSide = geometry.logo ? geometry.logo.side + LOGO_MARGIN * 2 : 0;
  const painted = (row: number, column: number): boolean =>
    row >= 0 &&
    column >= 0 &&
    row < matrix.size &&
    column < matrix.size &&
    matrix.get(row, column) &&
    !eyes.some(([top, left]) => inside(row, column, top, left, EYE_SIZE)) &&
    !inside(row, column, hole, hole, holeSide);
  let d = '';
  for (let row = 0; row < matrix.size; row++) {
    for (let column = 0; column < matrix.size; column++) {
      if (painted(row, column)) {
        d += modulePath(column + offset, row + offset, design.moduleShape, {
          top: painted(row - 1, column),
          right: painted(row, column + 1),
          bottom: painted(row + 1, column),
          left: painted(row, column - 1),
          bottomRight: painted(row + 1, column + 1),
        });
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

  // Con el exterior más redondo que el interior, las esquinas de dentro asomarían por fuera: se recorta todo a la
  // forma exterior.
  const content =
    border > 0 && outerRadius > 0
      ? `<clipPath id="qr-outline"><path d="${roundedRectPath(0, 0, size, size, outerRadius)}"/></clipPath>` +
        `<g clip-path="url(#qr-outline)">${parts.join('')}</g>`
      : parts.join('');
  const dimensions = pixels ? ` width="${pixels}" height="${pixels}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(size)} ${n(size)}"${dimensions}>${content}</svg>`;
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

/**
 * Un módulo. Todos los trazados van en el sentido de las agujas del reloj: las formas unidas se solapan y, con
 * sentidos distintos, el solape se quedaría hueco.
 */
function modulePath(x: number, y: number, shape: ModuleShape, neighbours: Neighbours): string {
  switch (shape) {
    case 'square':
      return `M${x} ${y}h1v1h-1z`;
    case 'dot':
      return circlePath(x + 0.5, y + 0.5, 0.45);
    case 'rounded':
      return roundedRectPath(x, y, 1, 1, 0.3);
    case 'rounded-joined': {
      // Solo se redondean las esquinas exteriores: donde toca otro módulo queda recto y se ven como una pieza.
      const { top, right, bottom, left } = neighbours;
      return cornersPath(x, y, {
        topLeft: !top && !left,
        topRight: !top && !right,
        bottomRight: !bottom && !right,
        bottomLeft: !bottom && !left,
      });
    }
    case 'dot-joined': {
      // Un punto por módulo y un tramo del mismo grosor hacia cada vecino de la derecha y de abajo.
      const r = JOINED_DOT_RADIUS;
      const cx = x + 0.5;
      const cy = y + 0.5;
      let d = circlePath(cx, cy, r);
      if (neighbours.right) {
        d += rectPath(cx, cy - r, 1, r * 2);
      }
      if (neighbours.bottom) {
        d += rectPath(cx - r, cy, r * 2, 1);
      }
      if (neighbours.right && neighbours.bottom && neighbours.bottomRight) {
        // En un bloque de 2 × 2 los tramos dejan un agujerito en el centro: se rellena.
        d += rectPath(cx, cy, 1, 1);
      }
      return d;
    }
  }
}

/** El borde ocupa la franja de `width` módulos que va del exterior del dibujo hacia dentro. */
/**
 * El borde ocupa la franja de `width` módulos que va del exterior del dibujo hacia dentro. El redondeo pasa
 * gradualmente del de fuera al de dentro a lo ancho de la franja (en las líneas dobles y en la central de los trazos).
 */
function borderShape(size: number, border: BorderDesign, color: string): string {
  const { width, outerRadius, innerRadius } = border;
  const radiusAt = (inset: number) => Math.max(0, outerRadius + ((innerRadius - outerRadius) * inset) / width);
  const ring = (from: number, to: number) =>
    roundedRectPath(from, from, size - from * 2, size - from * 2, radiusAt(from)) +
    roundedRectPath(to, to, size - to * 2, size - to * 2, radiusAt(to));
  switch (border.style) {
    case 'solid':
      return `<path d="${ring(0, width)}" fill="${color}" fill-rule="evenodd"/>`;
    case 'double': {
      // Dos líneas de un tercio del grosor con un tercio de separación.
      const line = width / 3;
      return `<path d="${ring(0, line) + ring(width - line, width)}" fill="${color}" fill-rule="evenodd"/>`;
    }
    case 'dashed':
    case 'dotted': {
      // Trazo sobre la línea central de la franja. Con pathLength el número de trazos es entero y cierran exactos.
      const inset = width / 2;
      const side = size - width;
      const r = Math.min(radiusAt(inset), side / 2);
      const perimeter = 4 * (side - 2 * r) + 2 * Math.PI * r;
      const dashed = border.style === 'dashed';
      const count = Math.max(4, Math.round(perimeter / (width * (dashed ? 3 : 2))));
      const pattern = dashed ? 'stroke-dasharray=".6 .4"' : 'stroke-dasharray="0 1" stroke-linecap="round"';
      const rx = r > 0 ? ` rx="${n(r)}"` : '';
      return `<rect x="${n(inset)}" y="${n(inset)}" width="${n(side)}" height="${n(side)}"${rx} fill="none" stroke="${color}" stroke-width="${n(width)}" pathLength="${count}" ${pattern}/>`;
    }
  }
}

function rectPath(x: number, y: number, width: number, height: number): string {
  return `M${n(x)} ${n(y)}h${n(width)}v${n(height)}h${n(-width)}z`;
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 1 ${n(r * 2)} 0a${n(r)} ${n(r)} 0 1 1 ${n(-r * 2)} 0z`;
}

function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height / 2);
  if (r <= 0) {
    return rectPath(x, y, width, height);
  }
  const arc = (dx: number, dy: number) => `a${n(r)} ${n(r)} 0 0 1 ${n(dx)} ${n(dy)}`;
  return (
    `M${n(x + r)} ${n(y)}h${n(width - r * 2)}${arc(r, r)}v${n(height - r * 2)}${arc(-r, r)}` +
    `h${n(-(width - r * 2))}${arc(-r, -r)}v${n(-(height - r * 2))}${arc(r, -r)}z`
  );
}

/** Un módulo de 1 × 1 con las esquinas indicadas redondeadas (radio JOINED_RADIUS) y el resto en ángulo recto. */
function cornersPath(
  x: number,
  y: number,
  round: { topLeft: boolean; topRight: boolean; bottomRight: boolean; bottomLeft: boolean },
): string {
  const r = JOINED_RADIUS;
  const [tl, tr, br, bl] = [round.topLeft, round.topRight, round.bottomRight, round.bottomLeft].map((on) =>
    on ? r : 0,
  );
  const arc = (radius: number, dx: number, dy: number) =>
    radius > 0 ? `a${n(radius)} ${n(radius)} 0 0 1 ${n(dx)} ${n(dy)}` : '';
  return (
    `M${n(x + tl)} ${n(y)}h${n(1 - tl - tr)}${arc(tr, tr, tr)}` +
    `v${n(1 - tr - br)}${arc(br, -br, br)}` +
    `h${n(-(1 - br - bl))}${arc(bl, -bl, -bl)}` +
    `v${n(-(1 - bl - tl))}${arc(tl, tl, -tl)}z`
  );
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
 * El logo: el recuadro del color elegido, en el hueco sin módulos que le deja el código, y dentro la imagen,
 * recortada a la forma del recuadro.
 */
function logo(position: number, side: number, design: QrDesign): string {
  const { boxColor, boxTransparent, padding, image } = design.logo;
  const radius = side * design.logo.radius;
  const parts = boxTransparent ? [] : [rect(position, position, side, side, radius, boxColor)];
  if (image) {
    const inset = side * padding;
    const imageSide = side - inset * 2;
    parts.push(
      `<clipPath id="qr-logo-clip"><path d="${roundedRectPath(position, position, side, side, radius)}"/></clipPath>`,
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
