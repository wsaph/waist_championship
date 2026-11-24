import type { Client } from '@libsql/client';

export async function ensureLoyKrathongSchema(
  client: Client,
  safeAlter: (sql: string) => Promise<void>
): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS krathongs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT NULL,
      user_name TEXT NOT NULL DEFAULT 'นักเดินทางริมหาด',
      user_emoji TEXT NOT NULL DEFAULT '🪷',
      style_id TEXT NOT NULL DEFAULT 'lotus_classic',
      caption TEXT NOT NULL DEFAULT '',
      avatar_color TEXT DEFAULT '#F472B6',
      avatar_band TEXT DEFAULT '#FFE600',
      avatar_species TEXT DEFAULT 'bunny',
      orbit_seed REAL NOT NULL DEFAULT 0,
      lane_offset REAL NOT NULL DEFAULT 5.2,
      start_x REAL DEFAULT NULL,
      start_z REAL DEFAULT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  await safeAlter(
    `CREATE INDEX IF NOT EXISTS idx_krathongs_created_at ON krathongs(created_at DESC)`
  );
}
