import type { Client } from '@libsql/client';

export async function ensureShabuSchema(
  _client: Client,
  safeAlter: (sql: string) => Promise<void>
): Promise<void> {
  await safeAlter(`ALTER TABLE users ADD COLUMN shabu_gp_date TEXT DEFAULT ''`);
  await safeAlter(`ALTER TABLE users ADD COLUMN shabu_gp_earned_today INTEGER NOT NULL DEFAULT 0`);
}
