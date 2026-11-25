import type { Client } from '@libsql/client';

export async function ensureSumoSchema(
  client: Client,
  safeAlter: (sql: string) => Promise<void>
): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sumo_progress (
      user_id INTEGER PRIMARY KEY,
      total_xp INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      matches_played INTEGER NOT NULL DEFAULT 0,
      max_rank_rewarded INTEGER NOT NULL DEFAULT 0,
      equipped_rank_tier INTEGER,
      daily_win_date TEXT DEFAULT '',
      daily_win_coins INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeAlter(`ALTER TABLE sumo_progress ADD COLUMN equipped_rank_tier INTEGER`);
  await safeAlter(`ALTER TABLE sumo_progress ADD COLUMN daily_win_date TEXT DEFAULT ''`);
  await safeAlter(`ALTER TABLE sumo_progress ADD COLUMN daily_win_coins INTEGER NOT NULL DEFAULT 0`);
}
