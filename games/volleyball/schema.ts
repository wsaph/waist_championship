import type { Client } from '@libsql/client';

export async function ensureVolleyballSchema(
  client: Client,
  safeAlter: (sql: string) => Promise<void>
): Promise<void> {
  await safeAlter(`ALTER TABLE users ADD COLUMN volleyball_wins_date TEXT DEFAULT ''`);
  await safeAlter(`ALTER TABLE users ADD COLUMN volleyball_wins_count INTEGER NOT NULL DEFAULT 0`);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS vb_match_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_uid TEXT NOT NULL UNIQUE,
      room_code TEXT NOT NULL,
      mode TEXT NOT NULL,
      winning_team TEXT NOT NULL,
      winners_json TEXT NOT NULL DEFAULT '[]',
      losers_json TEXT NOT NULL DEFAULT '[]',
      score_blue INTEGER NOT NULL DEFAULT 0,
      score_red INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS vb_player_stats (
      player_name TEXT PRIMARY KEY,
      skin TEXT NOT NULL DEFAULT 'pikamouse',
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      total_points INTEGER NOT NULL DEFAULT 0,
      matches_played INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
