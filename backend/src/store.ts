import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

/** El diseño se guarda tal cual lo manda la web (ya validado): la web completa los campos que falten al leerlo. */
export type Design = Record<string, unknown>;

export interface QrInput {
  name: string;
  value: string;
  design: Design;
}

export interface SavedQr extends QrInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  name: string;
  value: string;
  design: string;
  created_at: string;
  updated_at: string;
}

/** Los QR guardados, en una base de datos SQLite (un único archivo, o en memoria para los tests). */
export class QrStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS qrs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        value TEXT NOT NULL,
        design TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  /** Del más reciente al más antiguo según la última modificación. */
  list(): SavedQr[] {
    const rows = this.db
      .prepare('SELECT * FROM qrs ORDER BY updated_at DESC, created_at DESC')
      .all() as unknown as Row[];
    return rows.map(toQr);
  }

  get(id: string): SavedQr | null {
    const row = this.db.prepare('SELECT * FROM qrs WHERE id = ?').get(id) as unknown as Row | undefined;
    return row ? toQr(row) : null;
  }

  create(input: QrInput, now = new Date()): SavedQr {
    const id = randomUUID();
    const timestamp = now.toISOString();
    this.db
      .prepare('INSERT INTO qrs (id, name, value, design, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.name, input.value, JSON.stringify(input.design), timestamp, timestamp);
    return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
  }

  update(id: string, input: QrInput, now = new Date()): SavedQr | null {
    const result = this.db
      .prepare('UPDATE qrs SET name = ?, value = ?, design = ?, updated_at = ? WHERE id = ?')
      .run(input.name, input.value, JSON.stringify(input.design), now.toISOString(), id);
    return result.changes > 0 ? this.get(id) : null;
  }

  remove(id: string): boolean {
    return this.db.prepare('DELETE FROM qrs WHERE id = ?').run(id).changes > 0;
  }

  close(): void {
    this.db.close();
  }
}

function toQr(row: Row): SavedQr {
  return {
    id: row.id,
    name: row.name,
    value: row.value,
    design: JSON.parse(row.design) as Design,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
