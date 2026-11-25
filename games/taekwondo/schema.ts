import type { Client } from '@libsql/client';

export async function ensureTaekwondoSchema(
  client: Client,
  safeAlter: (sql: string) => Promise<void>
): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS taekwondo_progress (
      user_id INTEGER PRIMARY KEY,
      total_xp INTEGER NOT NULL DEFAULT 0,
      best_score INTEGER NOT NULL DEFAULT 0,
      max_belt_rewarded INTEGER NOT NULL DEFAULT 0,
      equipped_belt_tier INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeAlter(`ALTER TABLE taekwondo_progress ADD COLUMN equipped_belt_tier INTEGER`);
}
