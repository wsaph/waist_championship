import type { Client } from '@libsql/client';

export async function ensureCasinoSchema(
  client: Client,
  _safeAlter: (sql: string) => Promise<void>
): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS casino_bank (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      guard_balance INTEGER NOT NULL DEFAULT 0,
      guard_total_won INTEGER NOT NULL DEFAULT 0,
      guard_rounds_played INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.execute(`
    INSERT OR IGNORE INTO casino_bank (id, guard_balance, guard_total_won, guard_rounds_played)
    VALUES (1, 0, 0, 0)
  `);
}
