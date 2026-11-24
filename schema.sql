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
  theme_id TEXT DEFAULT 'none',
  equip_hat TEXT DEFAULT 'none',
  equip_armor TEXT DEFAULT 'armor_none',
  equip_wings TEXT DEFAULT 'wings_none',
  equip_pet_gear TEXT DEFAULT 'pet_none',
  last_checkin_date TEXT DEFAULT '',
  coin_pickups_date TEXT DEFAULT '',
  coin_pickups_count INTEGER NOT NULL DEFAULT 0,
  dividend_earned_date TEXT DEFAULT '',
  dividend_earned_today INTEGER NOT NULL DEFAULT 0,
  sync_key TEXT DEFAULT '',
  active_session_token TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_sync_key ON users(sync_key);

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  end_date TEXT DEFAULT '',
  step_target INTEGER NOT NULL DEFAULT 300000,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS user_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weight_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  weight REAL NOT NULL,
  excuse_tag TEXT DEFAULT 'พร้อมลุย!',
  roast_message TEXT,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
);

CREATE TABLE IF NOT EXISTS arena_coins (
  slot_id INTEGER PRIMARY KEY,
  spawn_token TEXT NOT NULL,
  pos_x REAL NOT NULL,
  pos_z REAL NOT NULL,
  spawn_at INTEGER NOT NULL DEFAULT 0,
  claimed_by INTEGER DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  quest_type TEXT NOT NULL DEFAULT 'custom',
  template_key TEXT DEFAULT '',
  target_value REAL DEFAULT 0,
  target_unit TEXT DEFAULT '',
  ai_summary TEXT DEFAULT '',
  duration_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'open',
  acceptor_id INTEGER DEFAULT NULL,
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  accepted_at TEXT DEFAULT NULL,
  betting_ends_at TEXT DEFAULT NULL,
  submitted_at TEXT DEFAULT NULL,
  resolved_at TEXT DEFAULT NULL,
  resolved_by INTEGER DEFAULT NULL,
  resolution_note TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quest_sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quest_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  payout_amount INTEGER DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(quest_id, user_id),
  FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quest_party (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quest_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invite_status TEXT NOT NULL DEFAULT 'accepted',
  proof_text TEXT DEFAULT '',
  member_completed INTEGER NOT NULL DEFAULT 0,
  payout_amount INTEGER DEFAULT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(quest_id, user_id),
  FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quest_bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quest_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  side TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payout_amount INTEGER DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(quest_id, user_id),
  FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quest_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quest_id INTEGER NOT NULL,
  voter_id INTEGER NOT NULL,
  vote TEXT NOT NULL,
  comment TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(quest_id, voter_id),
  FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE,
  FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE
);
