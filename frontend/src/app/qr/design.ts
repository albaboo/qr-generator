/** Forma de cada módulo (cuadradito) del código. */
export type ModuleShape = 'square' | 'rounded' | 'dot';
/** Forma de los tres «ojos» (los cuadros de las esquinas que usan las cámaras para encontrar el código). */
export type EyeShape = 'square' | 'rounded' | 'circle';

export interface BorderDesign {
  enabled: boolean;
  color: string;
  /** Grosor en módulos. */
  width: number;
}

export interface LogoDesign {
  enabled: boolean;
  /** Imagen como data URL (PNG, JPEG, WebP o GIF), o null si aún no se ha subido. */
  image: string | null;
  /** Lado del recuadro respecto al lado del código (de LOGO_SIZE.min a LOGO_SIZE.max). */
  size: number;
  /** Color del recuadro sobre el que va la imagen. */
  boxColor: string;
  /** Margen interior entre el recuadro y la imagen, como fracción del lado del recuadro. */
  padding: number;
  /** Redondeo de las esquinas del recuadro, como fracción del lado (0,5 = círculo). */
  radius: number;
}

export interface QrDesign {
  foreground: string;
  background: string;
  eyeColor: string;
  moduleShape: ModuleShape;
  eyeShape: EyeShape;
  /** Zona de silencio en módulos: el estándar pide al menos 4 para que se pueda leer. */
  quietZone: number;
  /** Redondeo de las esquinas del fondo (y del borde), en módulos. */
  cornerRadius: number;
  border: BorderDesign;
  logo: LogoDesign;
}

/** Un QR guardado en el servidor. */
export interface SavedQr {
  id: string;
  name: string;
  value: string;
  design: QrDesign;
  createdAt: string;
  updatedAt: string;
}

export interface Range {
  min: number;
  max: number;
  step: number;
}

export const QUIET_ZONE: Range = { min: 4, max: 10, step: 1 };
export const BORDER_WIDTH: Range = { min: 0.5, max: 4, step: 0.5 };
/** Hasta un 22 % del lado, como en EMM: la corrección de errores alta (H) recupera hasta un 30 %. */
export const LOGO_SIZE: Range = { min: 0.1, max: 0.22, step: 0.01 };
export const LOGO_PADDING: Range = { min: 0, max: 0.3, step: 0.01 };
export const LOGO_RADIUS: Range = { min: 0, max: 0.5, step: 0.01 };

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_DATA_URL.test(value);
}

/** Radio máximo de las esquinas: el recorte tiene que quedarse dentro de la zona de silencio y del borde. */
export function maxCornerRadius(design: Pick<QrDesign, 'quietZone' | 'border'>): number {
  return design.quietZone + (design.border.enabled ? design.border.width : 0);
}

export function defaultDesign(): QrDesign {
  return {
    foreground: '#000000',
    background: '#ffffff',
    eyeColor: '#000000',
    moduleShape: 'square',
    eyeShape: 'square',
    quietZone: 4,
    cornerRadius: 0,
    border: { enabled: false, color: '#000000', width: 1 },
    logo: { enabled: false, image: null, size: 0.22, boxColor: '#ffffff', padding: 0.1, radius: 0.2 },
  };
}

/**
 * Completa y corrige un diseño que viene de fuera (el servidor, o uno guardado con una versión anterior de la web):
 * cada campo que falte o no sea válido toma el valor por defecto, y los números se ajustan a sus límites.
 */
export function normalizeDesign(raw: unknown): QrDesign {
  const base = defaultDesign();
  const source = isRecord(raw) ? raw : {};
  const border = isRecord(source['border']) ? source['border'] : {};
  const logo = isRecord(source['logo']) ? source['logo'] : {};
  const quietZone = clampNumber(source['quietZone'], QUIET_ZONE, base.quietZone);
  const design: QrDesign = {
    foreground: color(source['foreground'], base.foreground),
    background: color(source['background'], base.background),
    eyeColor: color(source['eyeColor'], color(source['foreground'], base.eyeColor)),
    moduleShape: oneOf(source['moduleShape'], ['square', 'rounded', 'dot'], base.moduleShape),
    eyeShape: oneOf(source['eyeShape'], ['square', 'rounded', 'circle'], base.eyeShape),
    quietZone,
    cornerRadius: 0,
    border: {
      enabled: border['enabled'] === true,
      color: color(border['color'], base.border.color),
      width: clampNumber(border['width'], BORDER_WIDTH, base.border.width),
    },
    logo: {
      enabled: logo['enabled'] === true,
      image: isImageDataUrl(logo['image']) ? logo['image'] : null,
      size: clampNumber(logo['size'], LOGO_SIZE, base.logo.size),
      boxColor: color(logo['boxColor'], base.logo.boxColor),
      padding: clampNumber(logo['padding'], LOGO_PADDING, base.logo.padding),
      radius: clampNumber(logo['radius'], LOGO_RADIUS, base.logo.radius),
    },
  };
  design.cornerRadius = clampNumber(source['cornerRadius'], cornerRadiusRange(design), base.cornerRadius);
  return design;
}

export function cornerRadiusRange(design: Pick<QrDesign, 'quietZone' | 'border'>): Range {
  return { min: 0, max: maxCornerRadius(design), step: 0.5 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function color(value: unknown, fallback: string): string {
  return isHexColor(value) ? value.toLowerCase() : fallback;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function clampNumber(value: unknown, range: Range, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(range.max, Math.max(range.min, value));
}
