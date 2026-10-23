import { BorderDesign, QrDesign, defaultDesign } from './design';
import { qrGeometry, qrMatrix, renderQrSvg } from './render';

const URL_EXAMPLE = 'https://example.com';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function design(changes: Partial<QrDesign> = {}): QrDesign {
  return { ...defaultDesign(), ...changes };
}

function border(changes: Partial<BorderDesign> = {}): BorderDesign {
  return { enabled: true, style: 'solid', color: '#ff0000', width: 1, outerRadius: 0, innerRadius: 0, ...changes };
}

/** Esquinas superiores izquierdas de los módulos cuadrados de un trazado. */
function squares(d: string): [number, number][] {
  return Array.from(d.matchAll(/M([\d.]+) ([\d.]+)/g), (match) => [Number(match[1]), Number(match[2])]);
}

function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('qrMatrix', () => {
  it('usa la corrección de errores alta (H): el mismo texto da una matriz mayor que con la baja', () => {
    // Con H, «https://example.com» necesita la versión 3 (29 × 29); con L cabría en la 2 (25 × 25).
    expect(qrMatrix(URL_EXAMPLE).size).toBe(29);
  });
});

describe('qrGeometry', () => {
  it('rodea la matriz con la zona de silencio y el borde', () => {
    const geometry = qrGeometry(29, design({ quietZone: 4, border: border({ width: 2 }) }));
    expect(geometry.offset).toBe(6);
    expect(geometry.size).toBe(41);
    expect(geometry.logo).toBeNull();
  });

  it('centra el logo alineado con la cuadrícula y sin pasar del tamaño pedido', () => {
    const geometry = qrGeometry(29, design({ logo: { ...defaultDesign().logo, enabled: true, size: 0.22 } }));
    // 29 × 0,22 = 6,38 → 5 módulos (impar, como la matriz), centrado: (29 − 5) / 2 = 12 desde la matriz.
    expect(geometry.logo).toEqual({ side: 5, position: 4 + 12 });
    expect((geometry.logo?.side ?? 0) / 29).toBeLessThanOrEqual(0.22);
  });
});

describe('renderQrSvg', () => {
  it('genera un SVG válido con fondo, módulos y los tres ojos', () => {
    const svg = parse(renderQrSvg(URL_EXAMPLE, design()));
    expect(svg.querySelector('parsererror')).toBeNull();
    const root = svg.documentElement;
    expect(root.getAttribute('viewBox')).toBe('0 0 37 37');
    const background = root.querySelector('rect');
    expect(background?.getAttribute('fill')).toBe('#ffffff');
    expect(root.querySelector('path')?.getAttribute('fill')).toBe('#000000');
    // Cada ojo es un anillo y un cuadro central.
    expect(root.querySelectorAll('rect[stroke]')).toHaveLength(3);
  });

  it('usa los colores elegidos', () => {
    const svg = renderQrSvg(URL_EXAMPLE, design({ foreground: '#112233', background: '#fafafa', eyeColor: '#aa0000' }));
    expect(svg).toContain('fill="#112233"');
    expect(svg).toContain('fill="#fafafa"');
    expect(svg).toContain('stroke="#aa0000"');
  });

  it('pinta un módulo por cada celda oscura fuera de los ojos', () => {
    const matrix = qrMatrix(URL_EXAMPLE);
    let dark = 0;
    for (let row = 0; row < matrix.size; row++) {
      for (let column = 0; column < matrix.size; column++) {
        const inEye =
          (row < 7 && column < 7) || (row < 7 && column >= matrix.size - 7) || (row >= matrix.size - 7 && column < 7);
        if (matrix.get(row, column) && !inEye) {
          dark++;
        }
      }
    }
    const d = parse(renderQrSvg(URL_EXAMPLE, design())).querySelector('path')?.getAttribute('d') ?? '';
    expect(d.match(/M/g)).toHaveLength(dark);
  });

  it('dibuja el borde como un anillo con sus propias esquinas por fuera y por dentro', () => {
    const svg = parse(
      renderQrSvg(URL_EXAMPLE, design({ border: border({ width: 1, outerRadius: 3, innerRadius: 1 }) })),
    );
    // Todo va recortado a la forma exterior.
    expect(svg.querySelector('clipPath#qr-outline path')?.getAttribute('d')).toMatch(/^M3 0h/);
    const ring = svg.querySelector('g[clip-path] > path');
    expect(ring?.getAttribute('fill')).toBe('#ff0000');
    expect(ring?.getAttribute('fill-rule')).toBe('evenodd');
    // Exterior de radio 3 desde la esquina e interior de radio 1 a un módulo hacia dentro.
    expect(ring?.getAttribute('d')).toMatch(/^M3 0h33a3 3 0 0 1 3 3.*M2 1h35a1 1 0 0 1 1 1/);
    const background = svg.querySelector('g[clip-path] > rect');
    expect(background?.getAttribute('x')).toBe('1');
    expect(background?.getAttribute('rx')).toBe('1');
  });

  it('admite un borde redondo por fuera y recto por dentro', () => {
    const svg = parse(
      renderQrSvg(URL_EXAMPLE, design({ border: border({ width: 1, outerRadius: 5, innerRadius: 0 }) })),
    );
    expect(svg.querySelector('clipPath#qr-outline')).not.toBeNull();
    expect(svg.querySelector('g[clip-path] > rect')?.hasAttribute('rx')).toBe(false);
  });

  it('sin borde redondea el fondo con el redondeo general', () => {
    const svg = parse(renderQrSvg(URL_EXAMPLE, design({ cornerRadius: 2 })));
    expect(svg.querySelector('svg > rect')?.getAttribute('rx')).toBe('2');
    expect(svg.querySelector('clipPath')).toBeNull();
  });

  it('dibuja el borde doble como dos anillos de un tercio del grosor', () => {
    const d = parse(renderQrSvg(URL_EXAMPLE, design({ border: border({ style: 'double', width: 3 }) })))
      .querySelector('svg > path')
      ?.getAttribute('d');
    // Anillos de 0 a 1 y de 2 a 3 módulos hacia dentro.
    expect(d?.match(/M(\d+) \1h/g)).toEqual(['M0 0h', 'M1 1h', 'M2 2h', 'M3 3h']);
  });

  it('dibuja los bordes discontinuo y de puntos con un número entero de trazos', () => {
    for (const style of ['dashed', 'dotted'] as const) {
      const stroke = parse(renderQrSvg(URL_EXAMPLE, design({ border: border({ style, width: 2 }) }))).querySelector(
        'rect[stroke="#ff0000"]',
      );
      expect(stroke?.getAttribute('x')).toBe('1');
      expect(stroke?.getAttribute('stroke-width')).toBe('2');
      expect(Number.isInteger(Number(stroke?.getAttribute('pathLength')))).toBe(true);
      expect(stroke?.getAttribute('stroke-dasharray')).toBe(style === 'dashed' ? '.6 .4' : '0 1');
    }
  });

  it('sin fondo no pinta el fondo, pero sí el borde', () => {
    const svg = parse(renderQrSvg(URL_EXAMPLE, design({ transparent: true, border: border({ width: 1 }) })));
    expect(svg.querySelector('[fill="#ffffff"]')).toBeNull();
    expect(svg.querySelector('svg > path')?.getAttribute('fill')).toBe('#ff0000');
    expect(renderQrSvg(URL_EXAMPLE, design({ transparent: true }))).not.toContain('#ffffff');
  });

  it('pone la imagen del centro sobre su recuadro, sin módulos en un margen de un módulo alrededor', () => {
    const svg = parse(
      renderQrSvg(
        URL_EXAMPLE,
        design({ logo: { ...defaultDesign().logo, enabled: true, image: PNG, boxColor: '#00ff00', radius: 0 } }),
      ),
    );
    const image = svg.querySelector('image');
    expect(image?.getAttribute('href')).toBe(PNG);
    expect(image?.getAttribute('x')).toBe('16.5');
    expect(image?.getAttribute('width')).toBe('4');
    const box = svg.querySelector('rect[fill="#00ff00"]');
    expect(box?.getAttribute('x')).toBe('16');
    expect(box?.getAttribute('width')).toBe('5');
    // El hueco va de 15 a 22 (recuadro de 16 a 21 más un módulo): ningún módulo empieza dentro.
    const modules = squares(svg.querySelector('path')?.getAttribute('d') ?? '');
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.filter(([x, y]) => x >= 15 && x < 22 && y >= 15 && y < 22)).toEqual([]);
  });

  it('con el recuadro transparente solo dibuja la imagen, recortada a su forma', () => {
    const svg = renderQrSvg(
      URL_EXAMPLE,
      design({
        logo: { ...defaultDesign().logo, enabled: true, image: PNG, boxColor: '#00ff00', boxTransparent: true },
      }),
    );
    const doc = parse(svg);
    expect(doc.querySelector('svg > rect[fill="#00ff00"]')).toBeNull();
    expect(doc.querySelector('clipPath#qr-logo-clip path')).not.toBeNull();
    expect(doc.querySelector('image')?.getAttribute('href')).toBe(PNG);
  });

  it('con logo pero sin imagen dibuja solo el recuadro', () => {
    const svg = renderQrSvg(
      URL_EXAMPLE,
      design({ logo: { ...defaultDesign().logo, enabled: true, boxColor: '#00ff00' } }),
    );
    expect(svg).toContain('fill="#00ff00"');
    expect(svg).not.toContain('<image');
  });

  it('añade ancho y alto solo cuando se piden píxeles (para el PNG)', () => {
    expect(renderQrSvg(URL_EXAMPLE, design())).not.toContain('width="1024"');
    expect(renderQrSvg(URL_EXAMPLE, design(), 1024)).toContain('width="1024" height="1024"');
  });

  it('se niega a dibujar colores o imágenes que podrían inyectar marcado', () => {
    expect(() => renderQrSvg(URL_EXAMPLE, design({ background: '"/><script>' }))).toThrow();
    expect(() =>
      renderQrSvg(URL_EXAMPLE, design({ logo: { ...defaultDesign().logo, image: 'x" onload="alert(1)' } })),
    ).toThrow();
  });

  it('une los redondeados: solo redondea las esquinas que no tocan otro módulo', () => {
    const d = renderQrSvg(URL_EXAMPLE, design({ moduleShape: 'rounded-joined' }));
    const path = parse(d).querySelector('path')?.getAttribute('d') ?? '';
    // Un módulo por celda, como los cuadrados, pero con arcos de radio 0,4 en algunas esquinas.
    const squarePath = parse(renderQrSvg(URL_EXAMPLE, design())).querySelector('path')?.getAttribute('d') ?? '';
    expect(path.match(/M/g)).toHaveLength(squarePath.match(/M/g)?.length ?? -1);
    expect(path).toContain('a0.4 0.4 0 0 1');
    // Alguno queda totalmente recto (todos sus lados tocan otro módulo) y alguno es una pieza suelta redonda.
    expect(path).toMatch(/M\d+ \d+h1v1h-1v-1z/);
    expect(path).toMatch(/h0\.2a0\.4 0\.4 0 0 1 0\.4 0\.4v0\.2a/);
  });

  it('une los puntos con tramos hacia los vecinos de la derecha y de abajo', () => {
    const path =
      parse(renderQrSvg(URL_EXAMPLE, design({ moduleShape: 'dot-joined' })))
        .querySelector('path')
        ?.getAttribute('d') ?? '';
    expect(path).toContain('a0.4 0.4 0 1 1 0.8 0');
    expect(path).toMatch(/h1v0\.8h-1z/);
    expect(path).toMatch(/h0\.8v1h-0\.8z/);
  });

  it('dibuja las otras formas de módulos y ojos', () => {
    const dots = renderQrSvg(URL_EXAMPLE, design({ moduleShape: 'dot', eyeShape: 'circle' }));
    expect(dots).toContain('a0.45 0.45');
    expect(parse(dots).querySelectorAll('circle')).toHaveLength(6);
    const rounded = renderQrSvg(URL_EXAMPLE, design({ moduleShape: 'rounded', eyeShape: 'rounded' }));
    expect(rounded).toContain('rx="1.5"');
    expect(rounded).not.toContain('crispEdges');
  });

  it('falla con un texto que no cabe en un QR', () => {
    expect(() => renderQrSvg('x'.repeat(3000), design())).toThrow();
  });
});
