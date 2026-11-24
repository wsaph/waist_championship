import type { Client } from '@libsql/client';
import { ensureLoyKrathongSchema } from './loy-krathong/schema';

export type FestivalSchemaInitializer = (
  client: Client,
  safeAlter: (sql: string) => Promise<void>
) => Promise<void>;

/**
 * Register festival DB schema initializers here (must NOT import `lib/turso_client`
 * so schema initialization remains strictly acyclic).
 */
export const FESTIVAL_SCHEMA_INITIALIZERS: readonly FestivalSchemaInitializer[] = [
  ensureLoyKrathongSchema,
];

export async function ensureFestivalSchemas(
  client: Client,
  safeAlter: (sql: string) => Promise<void>
): Promise<void> {
  for (const init of FESTIVAL_SCHEMA_INITIALIZERS) {
    await init(client, safeAlter);
  }
}
