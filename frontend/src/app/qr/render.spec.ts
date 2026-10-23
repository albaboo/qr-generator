import { QrDesign, defaultDesign } from './design';
import { qrGeometry, qrMatrix, renderQrSvg } from './render';

const URL_EXAMPLE = 'https://example.com';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function design(changes: Partial<QrDesign> = {}): QrDesign {
  return { ...defaultDesign(), ...changes };
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
    const geometry = qrGeometry(29, design({ quietZone: 4, border: { enabled: true, color: '#000000', width: 2 } }));
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

  it('dibuja el borde por fuera y el fondo dentro, con las esquinas redondeadas', () => {
    const svg = parse(
      renderQrSvg(URL_EXAMPLE, design({ cornerRadius: 3, border: { enabled: true, color: '#ff0000', width: 1 } })),
    );
    const [border, background] = Array.from(svg.querySelectorAll('svg > rect'));
    expect(border.getAttribute('fill')).toBe('#ff0000');
    expect(border.getAttribute('rx')).toBe('3');
    expect(background.getAttribute('x')).toBe('1');
    expect(background.getAttribute('rx')).toBe('2');
  });

  it('pone la imagen del centro sobre su recuadro, con un módulo de margen del color del fondo', () => {
    const svg = parse(
      renderQrSvg(
        URL_EXAMPLE,
        design({ logo: { enabled: true, image: PNG, size: 0.22, boxColor: '#00ff00', padding: 0.1, radius: 0 } }),
      ),
    );
    const image = svg.querySelector('image');
    expect(image?.getAttribute('href')).toBe(PNG);
    expect(image?.getAttribute('x')).toBe('16.5');
    expect(image?.getAttribute('width')).toBe('4');
    const frame = Array.from(svg.querySelectorAll('svg > rect')).find((rect) => rect.getAttribute('width') === '7');
    expect(frame?.getAttribute('fill')).toBe('#ffffff');
    expect(frame?.getAttribute('x')).toBe('15');
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

  it('dibuja las otras formas de módulos y ojos', () => {
    const dots = renderQrSvg(URL_EXAMPLE, design({ moduleShape: 'dot', eyeShape: 'circle' }));
    expect(dots).toContain('a.45 .45');
    expect(parse(dots).querySelectorAll('circle')).toHaveLength(6);
    const rounded = renderQrSvg(URL_EXAMPLE, design({ moduleShape: 'rounded', eyeShape: 'rounded' }));
    expect(rounded).toContain('rx="1.5"');
    expect(rounded).not.toContain('crispEdges');
  });

  it('falla con un texto que no cabe en un QR', () => {
    expect(() => renderQrSvg('x'.repeat(3000), design())).toThrow();
  });
});
