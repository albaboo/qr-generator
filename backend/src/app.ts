import Fastify, { type FastifyInstance } from 'fastify';
import { idParams, qrInput } from './schemas.ts';
import { type QrInput, QrStore } from './store.ts';

interface IdParams {
  id: string;
}

/** Cabe un QR con su imagen del centro (2 MB como mucho en base64) y el resto del diseño. */
const BODY_LIMIT = 3 * 1024 * 1024;

/** La API: `/api/qrs` para listar, crear, leer, actualizar y borrar QR, y `/api/health` para Docker. */
export function buildApp(store: QrStore, options: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: BODY_LIMIT });

  app.addHook('onClose', () => store.close());

  app.get('/api/health', () => ({ ok: true }));

  app.get('/api/qrs', () => store.list());

  app.get<{ Params: IdParams }>('/api/qrs/:id', { schema: { params: idParams } }, (request, reply) => {
    const qr = store.get(request.params.id);
    return qr ?? reply.code(404).send(notFound());
  });

  app.post<{ Body: QrInput }>('/api/qrs', { schema: { body: qrInput } }, (request, reply) =>
    reply.code(201).send(store.create(clean(request.body))),
  );

  app.put<{ Params: IdParams; Body: QrInput }>(
    '/api/qrs/:id',
    { schema: { params: idParams, body: qrInput } },
    (request, reply) => {
      const qr = store.update(request.params.id, clean(request.body));
      return qr ?? reply.code(404).send(notFound());
    },
  );

  app.delete<{ Params: IdParams }>('/api/qrs/:id', { schema: { params: idParams } }, (request, reply) =>
    store.remove(request.params.id) ? reply.code(204).send() : reply.code(404).send(notFound()),
  );

  return app;
}

function clean(input: QrInput): QrInput {
  return { ...input, name: input.name.trim(), value: input.value.trim() };
}

function notFound() {
  return { statusCode: 404, error: 'Not Found', message: 'No existe ese QR.' };
}
