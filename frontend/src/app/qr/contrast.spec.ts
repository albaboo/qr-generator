import { contrastRatio, designWarnings, luminance } from './contrast';
import { defaultDesign } from './design';

describe('contraste', () => {
  it('calcula la luminancia y la relación de contraste como WCAG', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBe(1);
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#000000')).toBe(21);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('no avisa con negro sobre blanco', () => {
    expect(designWarnings(defaultDesign())).toEqual([]);
  });

  it('avisa de poco contraste como error', () => {
    const warnings = designWarnings({ ...defaultDesign(), foreground: '#cccccc', eyeColor: '#cccccc' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe('error');
    expect(warnings[0].message).toContain('Poco contraste');
  });

  it('avisa de contraste justo', () => {
    // #767676 sobre blanco ≈ 4,5:1; #888888 ≈ 3,5:1.
    const warnings = designWarnings({ ...defaultDesign(), foreground: '#888888', eyeColor: '#888888' });
    expect(warnings.map((warning) => warning.level)).toEqual(['warning']);
  });

  it('avisa si el código está invertido (módulos más claros que el fondo)', () => {
    const warnings = designWarnings({
      ...defaultDesign(),
      foreground: '#ffffff',
      background: '#000000',
      eyeColor: '#ffffff',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('invertidos');
  });

  it('comprueba también el color de los ojos si es distinto', () => {
    const warnings = designWarnings({ ...defaultDesign(), eyeColor: '#eeeeee' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('los ojos');
  });

  it('sin fondo avisa de qué fondo necesitará detrás', () => {
    const dark = designWarnings({ ...defaultDesign(), transparent: true });
    expect(dark).toHaveLength(1);
    expect(dark[0].message).toContain('fondo liso y claro');
    const light = designWarnings({ ...defaultDesign(), transparent: true, foreground: '#ffffff', eyeColor: '#ffffff' });
    expect(light[0].message).toContain('fondo liso y oscuro');
  });
});
