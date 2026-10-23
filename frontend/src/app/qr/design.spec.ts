import { defaultDesign, isImageDataUrl, normalizeDesign } from './design';

describe('normalizeDesign', () => {
  it('devuelve el diseño por defecto si no recibe un objeto', () => {
    expect(normalizeDesign(null)).toEqual(defaultDesign());
    expect(normalizeDesign('rojo')).toEqual(defaultDesign());
  });

  it('completa los campos que faltan (diseños guardados con versiones anteriores)', () => {
    const design = normalizeDesign({ foreground: '#123456', border: { enabled: true } });
    expect(design.foreground).toBe('#123456');
    expect(design.eyeColor).toBe('#123456');
    expect(design.border).toEqual({
      enabled: true,
      style: 'solid',
      color: '#000000',
      width: 1,
      outerRadius: 0,
      innerRadius: 0,
    });
    expect(design.transparent).toBe(false);
    expect(design.logo).toEqual(defaultDesign().logo);
  });

  it('descarta colores, formas e imágenes no válidos', () => {
    const design = normalizeDesign({
      foreground: 'red',
      background: '#fff',
      moduleShape: 'star',
      transparent: 'sí',
      border: { style: 'wavy' },
      logo: { enabled: true, image: 'javascript:alert(1)' },
    });
    expect(design.foreground).toBe('#000000');
    expect(design.background).toBe('#ffffff');
    expect(design.moduleShape).toBe('square');
    expect(design.transparent).toBe(false);
    expect(design.border.style).toBe('solid');
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

  it('limita los redondeos para que no se coman los ojos', () => {
    expect(normalizeDesign({ cornerRadius: 50 }).cornerRadius).toBe(4);
    // Por fuera del borde cabe la zona de silencio más el grosor; por dentro, solo la zona de silencio.
    const border = normalizeDesign({ border: { enabled: true, width: 2, outerRadius: 50, innerRadius: 50 } }).border;
    expect(border.outerRadius).toBe(6);
    expect(border.innerRadius).toBe(4);
  });

  it('los diseños con un solo redondeo de antes sacan de él los del borde y se ven igual', () => {
    const design = normalizeDesign({ cornerRadius: 5, border: { enabled: true, width: 2 } });
    expect(design.border.outerRadius).toBe(5);
    expect(design.border.innerRadius).toBe(3);
  });

  it('el recuadro del logo es opaco salvo que se pida lo contrario', () => {
    expect(normalizeDesign({}).logo.boxTransparent).toBe(false);
    expect(normalizeDesign({ logo: { boxTransparent: true } }).logo.boxTransparent).toBe(true);
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
