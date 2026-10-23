import { QrDesign } from './design';
import { renderQrSvg, svgDataUrl } from './render';

export type DownloadFormat = 'png' | 'svg';

/** Tamaños de PNG que se ofrecen, en píxeles de lado. */
export const PNG_SIZES = [256, 512, 1024, 2048, 4096] as const;
export const DEFAULT_PNG_SIZE = 1024;

/** Nombre de archivo a partir del nombre del QR: sin tildes ni símbolos, con guiones. */
export function fileName(name: string, format: DownloadFormat): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'qr'}.${format}`;
}

export async function downloadQr(
  name: string,
  value: string,
  design: QrDesign,
  format: DownloadFormat,
  pixels: number = DEFAULT_PNG_SIZE,
): Promise<void> {
  const blob =
    format === 'svg'
      ? new Blob([renderQrSvg(value, design)], { type: 'image/svg+xml' })
      : await rasterize(renderQrSvg(value, design, pixels), pixels);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(name, format);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Pinta el SVG en un canvas del tamaño pedido, sin suavizado para que los bordes de los módulos queden nítidos. */
async function rasterize(svg: string, pixels: number): Promise<Blob> {
  const image = await loadImage(svgDataUrl(svg));
  const canvas = document.createElement('canvas');
  canvas.width = pixels;
  canvas.height = pixels;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('El navegador no permite generar el PNG.');
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, pixels, pixels);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se ha podido generar el PNG.'))), 'image/png'),
  );
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se ha podido cargar la imagen.'));
    image.src = src;
  });
}
