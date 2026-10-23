import { loadImage } from './download';

/** Lado máximo de la imagen del centro: de sobra para un PNG de 4096 px, donde el logo ocupa menos de 1000 px. */
export const LOGO_MAX_PIXELS = 512;
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

/**
 * Convierte el archivo que sube Alba en un PNG como data URL, reducido para que el QR guardado no pese demasiado.
 * También pasa a PNG los SVG, que así no pueden llevar scripts ni enlaces externos dentro del QR.
 */
export async function prepareLogo(file: File): Promise<string> {
  if (!LOGO_ACCEPT.split(',').includes(file.type)) {
    throw new Error('El archivo tiene que ser una imagen PNG, JPEG, WebP, GIF o SVG.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const width = image.naturalWidth || LOGO_MAX_PIXELS;
    const height = image.naturalHeight || LOGO_MAX_PIXELS;
    const scale = Math.min(1, LOGO_MAX_PIXELS / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('El navegador no permite preparar la imagen.');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
