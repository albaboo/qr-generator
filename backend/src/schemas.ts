/**
 * Validación de lo que llega a la API (esquemas JSON que comprueba Fastify). Copia los límites de
 * frontend/src/app/qr/design.ts: si cambian allí, hay que cambiarlos aquí.
 */

const color = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' } as const;

/** La imagen del centro: un PNG, JPEG, WebP o GIF en base64. La web la reduce a 512 px, que ocupan bastante menos. */
const imageDataUrl = {
  type: 'string',
  pattern: '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$',
  maxLength: 2_000_000,
} as const;

const design = {
  type: 'object',
  additionalProperties: false,
  required: [
    'foreground',
    'background',
    'transparent',
    'eyeColor',
    'moduleShape',
    'eyeShape',
    'quietZone',
    'cornerRadius',
    'border',
    'logo',
  ],
  properties: {
    foreground: color,
    background: color,
    transparent: { type: 'boolean' },
    eyeColor: color,
    moduleShape: { enum: ['square', 'rounded', 'rounded-joined', 'dot', 'dot-joined'] },
    eyeShape: { enum: ['square', 'rounded', 'circle'] },
    quietZone: { type: 'number', minimum: 4, maximum: 10 },
    cornerRadius: { type: 'number', minimum: 0, maximum: 10 },
    border: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'style', 'color', 'width', 'outerRadius', 'innerRadius'],
      properties: {
        enabled: { type: 'boolean' },
        style: { enum: ['solid', 'double', 'dashed', 'dotted'] },
        color,
        width: { type: 'number', minimum: 0.5, maximum: 4 },
        outerRadius: { type: 'number', minimum: 0, maximum: 14 },
        innerRadius: { type: 'number', minimum: 0, maximum: 10 },
      },
    },
    logo: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'image', 'size', 'boxColor', 'boxTransparent', 'padding', 'radius'],
      properties: {
        enabled: { type: 'boolean' },
        image: { anyOf: [imageDataUrl, { type: 'null' }] },
        size: { type: 'number', minimum: 0.1, maximum: 0.22 },
        boxColor: color,
        boxTransparent: { type: 'boolean' },
        padding: { type: 'number', minimum: 0, maximum: 0.3 },
        radius: { type: 'number', minimum: 0, maximum: 0.5 },
      },
    },
  },
} as const;

export const qrInput = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'value', 'design'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    // Un QR con corrección H admite como mucho 1273 bytes; la web avisa antes de llegar ahí.
    value: { type: 'string', minLength: 1, maxLength: 2000 },
    design,
  },
} as const;

export const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;
