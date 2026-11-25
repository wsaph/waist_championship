import type { Client } from '@libsql/client';
import { ensureVolleyballSchema } from './volleyball/schema';
import { ensureSoccerSchema } from './soccer/schema';
import { ensureSumoSchema } from './sumo/schema';
import { ensureTaekwondoSchema } from './taekwondo/schema';
import { ensureCasinoSchema } from './casino/schema';
import { ensureShabuSchema } from './shabu/schema';

/**
 * Runs idempotent DB migrations for every registered competitive/party game module.
 * Kept strictly free of `@/lib/turso_client` imports to prevent circular dependencies.
 */
export async function ensureGameSchemas(
  client: Client,
  safeAlter: (sql: string) => Promise<void>
): Promise<void> {
  await ensureVolleyballSchema(client, safeAlter);
  await ensureSoccerSchema(client, safeAlter);
  await ensureSumoSchema(client, safeAlter);
  await ensureTaekwondoSchema(client, safeAlter);
  await ensureCasinoSchema(client, safeAlter);
  await ensureShabuSchema(client, safeAlter);
}
