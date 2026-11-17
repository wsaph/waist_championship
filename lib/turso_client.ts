import { createClient, type Client } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url,
  ...(authToken ? { authToken } : {}),
});

let schemaReady: Promise<void> | null = null;

async function ensureLocalSchema() {
  if (url !== 'file:local.db') return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          avatar_emoji TEXT NOT NULL DEFAULT '🏃',
          color_hex TEXT NOT NULL DEFAULT '#38BDF8',
          accessory TEXT DEFAULT 'headband',
          band_color TEXT DEFAULT '#FFE600',
          role TEXT NOT NULL DEFAULT 'competitor',
          workout_type TEXT DEFAULT 'cheer',
          pet_type TEXT DEFAULT 'none',
          pin_code TEXT NOT NULL DEFAULT '1234',
          start_weight REAL NOT NULL,
          goal_weight REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    })();
  }
  await schemaReady;
}

export const turso: Client = new Proxy(client, {
  get(target, prop, receiver) {
    if (prop === 'execute') {
      return async (...args: Parameters<Client['execute']>) => {
        await ensureLocalSchema();
        return target.execute(...args);
      };
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
