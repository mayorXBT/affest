import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { PostgresCoordinationStore } from './postgres.js';

export type PostgresStoreHandle = {
  readonly store: PostgresCoordinationStore;
  readonly close: () => Promise<void>;
};

export function createPostgresStore(connectionString: string): PostgresStoreHandle {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return {
    store: new PostgresCoordinationStore(db),
    close: () => pool.end(),
  };
}
