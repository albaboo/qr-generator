import { QrDesign } from './design';

export type WarningLevel = 'error' | 'warning';

export interface DesignWarning {
  level: WarningLevel;
  message: string;
}

/** Por debajo de esta relación de contraste muchas cámaras no distinguen los módulos del fondo. */
export const MIN_CONTRAST = 3;
/** A partir de esta relación se lee bien incluso con poca luz o pantallas con brillo bajo. */
export const GOOD_CONTRAST = 4.5;

/** Luminancia relativa de un color #rrggbb (fórmula de WCAG 2). */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Relación de contraste entre dos colores, de 1 (iguales) a 21 (negro sobre blanco). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Avisos sobre combinaciones de colores que pueden impedir que las cámaras lean el código. */
export function designWarnings(design: QrDesign): DesignWarning[] {
  const warnings: DesignWarning[] = [];
  warnings.push(...pairWarnings('los módulos', design.foreground, design.background));
  if (design.eyeColor !== design.foreground) {
    warnings.push(...pairWarnings('los ojos (las esquinas)', design.eyeColor, design.background));
  }
  return warnings;
}

function pairWarnings(subject: string, color: string, background: string): DesignWarning[] {
  const ratio = contrastRatio(color, background);
  const shown = ratio.toFixed(1).replace('.', ',');
  const warnings: DesignWarning[] = [];
  if (ratio < MIN_CONTRAST) {
    warnings.push({
      level: 'error',
      message: `Poco contraste entre ${subject} y el fondo (${shown}:1): muchas cámaras no podrán leerlo. Busca al menos ${MIN_CONTRAST}:1.`,
    });
  } else if (ratio < GOOD_CONTRAST) {
    warnings.push({
      level: 'warning',
      message: `Contraste justo entre ${subject} y el fondo (${shown}:1): puede fallar con poca luz. Mejor a partir de ${String(GOOD_CONTRAST).replace('.', ',')}:1.`,
    });
  }
  if (luminance(color) > luminance(background)) {
    warnings.push({
      level: 'warning',
      message: `${capitalize(subject)} son más claros que el fondo: algunos lectores no leen los QR invertidos.`,
    });
  }
  return warnings;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
