import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { QrStore } from '../src/store.ts';

const design = {
  foreground: '#000000',
  background: '#ffffff',
  eyeColor: '#000000',
  moduleShape: 'square',
  eyeShape: 'square',
  quietZone: 4,
  cornerRadius: 0,
  border: { enabled: false, color: '#000000', width: 1 },
  logo: {
    enabled: true,
    image: 'data:image/png;base64,iVBORw0KGgo=',
    size: 0.22,
    boxColor: '#ffffff',
    padding: 0.1,
    radius: 0.2,
  },
};
const input = { name: 'Web de EMM', value: 'https://example.com', design };

describe('API de QR', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp(new QrStore(':memory:'));
  });

  afterEach(async () => {
    await app.close();
  });

  async function create(body: unknown = input) {
    return app.inject({ method: 'POST', url: '/api/qrs', payload: body as object });
  }

  it('responde al chequeo de salud', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.json()).toEqual({ ok: true });
  });

  it('crea un QR y lo devuelve con id y fechas', async () => {
    const response = await create({ ...input, name: '  Web de EMM  ' });
    expect(response.statusCode).toBe(201);
    const qr = response.json();
    expect(qr).toMatchObject({ ...input, name: 'Web de EMM' });
    expect(qr.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(qr.createdAt).toBe(qr.updatedAt);
  });

  it('lista, lee, actualiza y borra', async () => {
    const created = (await create()).json();

    const list = await app.inject({ method: 'GET', url: '/api/qrs' });
    expect(list.json()).toEqual([created]);

    const read = await app.inject({ method: 'GET', url: `/api/qrs/${created.id}` });
    expect(read.json()).toEqual(created);

    const changed = { ...input, name: 'Otro nombre', design: { ...design, foreground: '#112233' } };
    const updated = await app.inject({ method: 'PUT', url: `/api/qrs/${created.id}`, payload: changed });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ ...changed, id: created.id, createdAt: created.createdAt });

    const removed = await app.inject({ method: 'DELETE', url: `/api/qrs/${created.id}` });
    expect(removed.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/api/qrs' })).json()).toEqual([]);
  });

  it('ordena la lista por la última modificación', async () => {
    const first = (await create({ ...input, name: 'Primero' })).json();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await create({ ...input, name: 'Segundo' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await app.inject({ method: 'PUT', url: `/api/qrs/${first.id}`, payload: { ...input, name: 'Primero editado' } });
    const names = (await app.inject({ method: 'GET', url: '/api/qrs' })).json().map((qr: { name: string }) => qr.name);
    expect(names).toEqual(['Primero editado', 'Segundo']);
  });

  it('da 404 si el QR no existe', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    expect((await app.inject({ method: 'GET', url: `/api/qrs/${id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: `/api/qrs/${id}`, payload: input })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/qrs/${id}` })).statusCode).toBe(404);
  });

  it('rechaza ids que no son UUID', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/qrs/abc' })).statusCode).toBe(400);
  });

  it.each([
    ['sin nombre', { ...input, name: '' }],
    ['sin enlace', { ...input, value: '' }],
    ['un color no válido', { ...input, design: { ...design, background: 'red' } }],
    ['una zona de silencio menor que 4', { ...input, design: { ...design, quietZone: 2 } }],
    ['un logo mayor del 22 %', { ...input, design: { ...design, logo: { ...design.logo, size: 0.4 } } }],
    [
      'una imagen que no es un data URL',
      { ...input, design: { ...design, logo: { ...design.logo, image: 'https://x.es/a.png' } } },
    ],
    [
      'una imagen SVG',
      { ...input, design: { ...design, logo: { ...design.logo, image: 'data:image/svg+xml;base64,PHN2Zz4=' } } },
    ],
    ['una forma desconocida', { ...input, design: { ...design, moduleShape: 'star' } }],
  ])('rechaza un QR con %s', async (_case, body) => {
    expect((await create(body)).statusCode).toBe(400);
  });

  it('descarta los campos que no conoce', async () => {
    const qr = (await create({ ...input, design: { ...design, extra: true } })).json();
    expect(qr.design).not.toHaveProperty('extra');
  });
});
