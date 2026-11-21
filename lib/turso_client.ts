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
          body_weight REAL NOT NULL DEFAULT 0,
          height_cm REAL NOT NULL DEFAULT 0,
          gender TEXT DEFAULT 'female',
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
          equip_marker TEXT DEFAULT 'marker_wood',
          is_roaming INTEGER NOT NULL DEFAULT 0,
          prop_colors TEXT DEFAULT '{}',
          last_checkin_date TEXT DEFAULT '',
          coin_pickups_date TEXT DEFAULT '',
          coin_pickups_count INTEGER NOT NULL DEFAULT 0,
          dividend_earned_date TEXT DEFAULT '',
          dividend_earned_today INTEGER NOT NULL DEFAULT 0,
          sync_key TEXT DEFAULT '',
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
      await safeAlter(`ALTER TABLE users ADD COLUMN equip_marker TEXT DEFAULT 'marker_wood'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN is_roaming INTEGER NOT NULL DEFAULT 0`);
      await client.execute(`UPDATE users SET role = 'competitor' WHERE role = 'spectator'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN prop_colors TEXT DEFAULT '{}'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN body_weight REAL NOT NULL DEFAULT 0`);
      await safeAlter(`ALTER TABLE users ADD COLUMN height_cm REAL NOT NULL DEFAULT 0`);
      await safeAlter(`ALTER TABLE users ADD COLUMN gender TEXT DEFAULT 'female'`);
      await safeAlter(`ALTER TABLE users ADD COLUMN last_checkin_date TEXT DEFAULT ''`);
      await safeAlter(`ALTER TABLE users ADD COLUMN coin_pickups_date TEXT DEFAULT ''`);
      await safeAlter(`ALTER TABLE users ADD COLUMN coin_pickups_count INTEGER NOT NULL DEFAULT 0`);
      await safeAlter(`ALTER TABLE users ADD COLUMN dividend_earned_date TEXT DEFAULT ''`);
      await safeAlter(`ALTER TABLE users ADD COLUMN dividend_earned_today INTEGER NOT NULL DEFAULT 0`);
      await safeAlter(`ALTER TABLE users ADD COLUMN volleyball_wins_date TEXT DEFAULT ''`);
      await safeAlter(`ALTER TABLE users ADD COLUMN volleyball_wins_count INTEGER NOT NULL DEFAULT 0`);
      await safeAlter(`ALTER TABLE users ADD COLUMN shabu_gp_date TEXT DEFAULT ''`);
      await safeAlter(`ALTER TABLE users ADD COLUMN shabu_gp_earned_today INTEGER NOT NULL DEFAULT 0`);
      await safeAlter(`ALTER TABLE users ADD COLUMN sync_key TEXT DEFAULT ''`);
      await safeAlter(`CREATE INDEX IF NOT EXISTS idx_users_sync_key ON users(sync_key)`);

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

      await client.execute(`
        CREATE TABLE IF NOT EXISTS seasons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          end_date TEXT DEFAULT '',
          step_target INTEGER NOT NULL DEFAULT 300000,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await safeAlter(`ALTER TABLE seasons ADD COLUMN step_target INTEGER NOT NULL DEFAULT 300000`);

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
          side_coins_awarded INTEGER NOT NULL DEFAULT 0,
          step_count INTEGER NOT NULL DEFAULT 0,
          max_steps_pct_awarded INTEGER NOT NULL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(season_id, user_id),
          FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await safeAlter(`ALTER TABLE season_entries ADD COLUMN side_coins_awarded INTEGER NOT NULL DEFAULT 0`);
      await safeAlter(`ALTER TABLE season_entries ADD COLUMN step_count INTEGER NOT NULL DEFAULT 0`);
      await safeAlter(`ALTER TABLE season_entries ADD COLUMN max_steps_pct_awarded INTEGER NOT NULL DEFAULT 0`);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS step_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          season_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          steps_added INTEGER NOT NULL DEFAULT 0,
          total_steps INTEGER NOT NULL DEFAULT 0,
          note TEXT DEFAULT '',
          logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS daily_step_syncs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          season_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          sync_date TEXT NOT NULL,
          max_synced_steps INTEGER NOT NULL DEFAULT 0,
          sync_count INTEGER NOT NULL DEFAULT 0,
          last_source TEXT DEFAULT '',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(season_id, user_id, sync_date),
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
          sender_id INTEGER DEFAULT NULL,
          sender_name TEXT NOT NULL DEFAULT 'ผู้หวังดี',
          sender_emoji TEXT NOT NULL DEFAULT '📣',
          target_user_id INTEGER NOT NULL,
          kind TEXT NOT NULL DEFAULT 'cheer',
          gift_item TEXT NOT NULL,
          message TEXT DEFAULT '',
          dividend_claimed INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await safeAlter(`ALTER TABLE interactions ADD COLUMN sender_id INTEGER DEFAULT NULL`);
      await safeAlter(`ALTER TABLE interactions ADD COLUMN dividend_claimed INTEGER NOT NULL DEFAULT 0`);
      await safeAlter(`ALTER TABLE users ADD COLUMN last_feedback_bonus_date TEXT DEFAULT ''`);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS beta_feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER DEFAULT NULL,
          user_name TEXT NOT NULL DEFAULT 'ผู้เล่นนิรนาม',
          user_emoji TEXT NOT NULL DEFAULT '💬',
          category TEXT NOT NULL DEFAULT 'bug',
          message TEXT NOT NULL,
          device_info TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'open',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS arena_coins (
          slot_id INTEGER PRIMARY KEY,
          spawn_token TEXT NOT NULL,
          pos_x REAL NOT NULL,
          pos_z REAL NOT NULL,
          spawn_at INTEGER NOT NULL DEFAULT 0,
          claimed_by INTEGER DEFAULT NULL
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
