import { createClient, type Client } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url,
  ...(authToken ? { authToken } : {}),
});

let schemaReady: Promise<void> | null = null;

async function safeAlter(sql: string) {
  try {
    await client.execute(sql);
  } catch {
    // Column already exists
  }
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          avatar_emoji TEXT NOT NULL DEFAULT '🐰',
          color_hex TEXT NOT NULL DEFAULT '#F8FAFC',
          accessory TEXT DEFAULT 'headband',
          band_color TEXT DEFAULT '#FFE600',
          role TEXT NOT NULL DEFAULT 'competitor',
          workout_type TEXT DEFAULT 'cheer',
          pet_type TEXT DEFAULT 'none',
          status_text TEXT DEFAULT '',
          pin_code TEXT NOT NULL DEFAULT '1234',
          start_weight REAL NOT NULL DEFAULT 0,
          goal_weight REAL NOT NULL DEFAULT 0,
          points INTEGER NOT NULL DEFAULT 100,
          species TEXT DEFAULT 'bunny',
          breed TEXT DEFAULT '',
          theme_id TEXT DEFAULT 'none',
          equip_hat TEXT DEFAULT 'none',
          equip_face TEXT DEFAULT 'face_none',
          equip_armor TEXT DEFAULT 'armor_none',
          equip_weapon TEXT DEFAULT 'weapon_none',
          equip_wings TEXT DEFAULT 'wings_none',
          equip_aura TEXT DEFAULT 'aura_none',
          equip_pet_gear TEXT DEFAULT 'pet_none',
          equip_mount TEXT DEFAULT 'mount_none',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ensure new RPG columns exist on existing Turso DB
      await safeAlter(`ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 100`);
      await safeAlter(`ALTER TABLE users ADD COLUMN species TEXT DEFAULT 'bunny'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN breed TEXT DEFAULT ''`);
      await safeAlter(`ALTER TABLE users ADD COLUMN theme_id TEXT DEFAULT 'none'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN equip_hat TEXT DEFAULT 'none'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN equip_face TEXT DEFAULT 'face_none'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN equip_armor TEXT DEFAULT 'armor_none'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN equip_weapon TEXT DEFAULT 'weapon_none'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN equip_wings TEXT DEFAULT 'wings_none'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN equip_aura TEXT DEFAULT 'aura_none'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN equip_pet_gear TEXT DEFAULT 'pet_none'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN equip_mount TEXT DEFAULT 'mount_none'`);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS seasons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          end_date TEXT DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS season_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          season_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          goal_type TEXT NOT NULL DEFAULT 'weight_loss',
          start_val REAL NOT NULL DEFAULT 0,
          current_val REAL NOT NULL DEFAULT 0,
          target_val REAL NOT NULL DEFAULT 0,
          max_progress_awarded INTEGER NOT NULL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(season_id, user_id),
          FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS user_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          item_id TEXT NOT NULL,
          unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, item_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS weight_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          weight REAL NOT NULL,
          excuse_tag TEXT DEFAULT 'พร้อมลุย!',
          roast_message TEXT,
          logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS interactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_name TEXT NOT NULL DEFAULT 'ผู้หวังดี',
          sender_emoji TEXT NOT NULL DEFAULT '📣',
          target_user_id INTEGER NOT NULL,
          kind TEXT NOT NULL DEFAULT 'cheer',
          gift_item TEXT NOT NULL,
          message TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      const seasonCheck = await client.execute(`SELECT id FROM seasons LIMIT 1`);
      if (seasonCheck.rows.length === 0) {
        await client.execute({
          sql: `INSERT INTO seasons (name, end_date, is_active) VALUES (?, ?, 1)`,
          args: ['SEASON 1: ขุนศึกเพาะกาย & สลัดพุงมังกร', '2026-12-31'],
        });
      }
    })();
  }
  await schemaReady;
}

export const turso: Client = new Proxy(client, {
  get(target, prop, receiver) {
    if (prop === 'execute') {
      return async (...args: Parameters<Client['execute']>) => {
        await ensureSchema();
        return target.execute(...args);
      };
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
