import { defaultDesign, isImageDataUrl, maxCornerRadius, normalizeDesign } from './design';

describe('normalizeDesign', () => {
  it('devuelve el diseño por defecto si no recibe un objeto', () => {
    expect(normalizeDesign(null)).toEqual(defaultDesign());
    expect(normalizeDesign('rojo')).toEqual(defaultDesign());
  });

  it('completa los campos que faltan (diseños guardados con versiones anteriores)', () => {
    const design = normalizeDesign({ foreground: '#123456', border: { enabled: true } });
    expect(design.foreground).toBe('#123456');
    expect(design.eyeColor).toBe('#123456');
    expect(design.border).toEqual({ enabled: true, color: '#000000', width: 1 });
    expect(design.logo).toEqual(defaultDesign().logo);
  });

  it('descarta colores, formas e imágenes no válidos', () => {
    const design = normalizeDesign({
      foreground: 'red',
      background: '#fff',
      moduleShape: 'star',
      logo: { enabled: true, image: 'javascript:alert(1)' },
    });
    expect(design.foreground).toBe('#000000');
    expect(design.background).toBe('#ffffff');
    expect(design.moduleShape).toBe('square');
    expect(design.logo.image).toBeNull();
  });

  it('pasa los colores a minúsculas', () => {
    expect(normalizeDesign({ background: '#ABCDEF' }).background).toBe('#abcdef');
  });

  it('ajusta los números a sus límites: zona de silencio mínima de 4 y logo de como mucho un 22 %', () => {
    const design = normalizeDesign({ quietZone: 1, logo: { size: 0.5, padding: -1 }, border: { width: 99 } });
    expect(design.quietZone).toBe(4);
    expect(design.logo.size).toBe(0.22);
    expect(design.logo.padding).toBe(0);
    expect(design.border.width).toBe(4);
  });

  it('limita el redondeo de las esquinas a la zona de silencio más el borde', () => {
    expect(normalizeDesign({ cornerRadius: 50 }).cornerRadius).toBe(4);
    expect(normalizeDesign({ cornerRadius: 50, border: { enabled: true, width: 2 } }).cornerRadius).toBe(6);
    expect(maxCornerRadius({ quietZone: 6, border: { enabled: false, color: '#000000', width: 3 } })).toBe(6);
  });
});

describe('isImageDataUrl', () => {
  it('solo acepta imágenes rasterizadas en base64', () => {
    expect(isImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isImageDataUrl('data:image/png;base64,"/><script>')).toBe(false);
    expect(isImageDataUrl('https://example.com/logo.png')).toBe(false);
  });
});
