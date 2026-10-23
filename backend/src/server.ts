import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildApp } from './app.ts';
import { QrStore } from './store.ts';

const databasePath = process.env['DATABASE_PATH'] ?? 'data/qr.db';
const port = Number(process.env['PORT'] ?? 3000);
const host = process.env['HOST'] ?? '127.0.0.1';

mkdirSync(dirname(databasePath), { recursive: true });
const app = buildApp(new QrStore(databasePath), { logger: true });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port, host });
