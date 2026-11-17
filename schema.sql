CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  avatar_emoji TEXT NOT NULL DEFAULT '🏃',
  color_hex TEXT NOT NULL DEFAULT '#FF6B6B',
  pin_code TEXT NOT NULL DEFAULT '1234',
  start_weight REAL NOT NULL,
  goal_weight REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weight_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  weight REAL NOT NULL,
  excuse_tag TEXT DEFAULT 'ชั่งตอนเช้าหลังเข้าห้องน้ำ',
  roast_message TEXT,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO users (name, avatar_emoji, color_hex, pin_code, start_weight, goal_weight) VALUES
  ('ปอม', '🦊', '#FF6B6B', '1234', 78.0, 68.0),
  ('วศิน', '🐼', '#4ECDC4', '1234', 85.0, 74.0);

INSERT INTO weight_logs (user_id, weight, excuse_tag, roast_message) VALUES
  (1, 76.5, 'วิ่งสวนลุมมา 5 โล', '(-1.5 กก.) โหดจัด! ไขมันกำลังร้องไห้แล้ว ⚡'),
  (2, 85.8, 'เมื่อคืนหมูกระทะเยียวยา', '(+0.8 กก.) น้ำหนักดีดขึ้น! สงสัยเมื่อคืนหมูกระทะเรียกหา 🥓');
