import type { Client } from '@libsql/client';

export async function ensureSoccerSchema(
  client: Client,
  safeAlter: (sql: string) => Promise<void>
): Promise<void> {
  await safeAlter(`ALTER TABLE users ADD COLUMN penalty_wins_date TEXT DEFAULT ''`);
  await safeAlter(`ALTER TABLE users ADD COLUMN penalty_wins_count INTEGER DEFAULT 0`);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS penalty_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_uid TEXT NOT NULL UNIQUE,
      room_code TEXT NOT NULL,
      winner_name TEXT NOT NULL,
      loser_name TEXT NOT NULL,
      winner_model TEXT NOT NULL DEFAULT 'fox_hero',
      loser_model TEXT NOT NULL DEFAULT 'bunny_hero',
      winner_score INTEGER NOT NULL DEFAULT 0,
      loser_score INTEGER NOT NULL DEFAULT 0,
      total_rounds INTEGER NOT NULL DEFAULT 5,
      sudden_death INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS penalty_player_stats (
      player_name TEXT PRIMARY KEY,
      model_id TEXT NOT NULL DEFAULT 'fox_hero',
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      goals_scored INTEGER NOT NULL DEFAULT 0,
      matches_played INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
