import crypto from 'crypto';
import type { Client } from '@libsql/client';
import { turso } from '@/lib/turso_client';

export type StepSyncMode = 'daily_sync' | 'add' | 'set';
export type StepSyncSource =
  | 'apple_shortcut'
  | 'ocr_screenshot'
  | 'web_daily_sync'
  | 'manual_add'
  | 'manual_set';

export interface DividendPayout {
  userId: number;
  name: string;
  emoji: string;
  kind: 'cheer' | 'tempt';
  stacks: number;
  payout: number;
  jackpot?: boolean;
}

export interface RecordStepsResult {
  success: true;
  logType: 'steps';
  mode: StepSyncMode;
  alreadySynced: boolean;
  syncDate: string;
  todaySteps?: number;
  prevSyncedToday: number;
  todaySyncedSteps: number;
  diff: number;
  roast: string;
  message: string;
  progressPct: number;
  stepCount: number;
  stepTarget: number;
  seasonId: number;
  isInFoodStall: false;
  progressBonus: number;
  dailyLogBonus: number;
  earnedPoints: number;
  dividends: DividendPayout[];
  points: number;
  currentVal: number;
  user: {
    id: number;
    name: string;
    emoji: string;
  };
}

export class StepSyncError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'StepSyncError';
    this.status = status;
  }
}

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

export function normalizeNumericText(input: string): string {
  let out = input;
  for (let i = 0; i < 10; i++) {
    out = out.replaceAll(THAI_DIGITS[i], String(i));
  }
  // Strip optional leading/trailing step unit words (e.g. "8,452 count", "8,452 steps", "8,452 ก้าว")
  out = out
    .trim()
    .replace(/^(?:steps?|counts?|ก้าวเดิน|ก้าว|นับ)\s*[:=]?\s*/i, '')
    .replace(/\s*(?:steps?|counts?|ก้าวเดิน|ก้าว|นับ)$/i, '')
    .trim();

  // Allow valid thousands separators (commas, underscores, or spaces grouped by 3 digits like "8 450")
  if (/^[+-]?\d{1,3}(?:[ ,\u00A0_]\d{3})+(?:\.\d+)?$/.test(out)) {
    return out.replace(/[ ,\u00A0_]/g, '');
  }
  return out.replace(/[,_]/g, '').trim();
}

/**
 * Parses step counts from numbers or formatted strings (e.g. "8,450", "8450.0", "๘,๔๕๐", "8,450 count").
 * When allowEmptyAsZero is true (e.g. Apple Shortcuts Sum of 0 samples = ""), empty string/null maps to 0.
 */
export function parseStepsValue(
  raw: unknown,
  allowEmptyAsZero = false
): { ok: true; steps: number; emptyAsZero?: boolean } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: false, error: 'กรุณาระบุจำนวนก้าวเดิน (steps)' };
  }
  if (Array.isArray(raw)) {
    return {
      ok: false,
      error:
        'ดูเหมือนคุณส่งรายการข้อมูลหลายแถว กรุณาเลือกตัวแปร "ผลรวม (Sum)" จากคำสั่งคำนวณสถิติใน Apple Shortcuts',
    };
  }
  if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    if (allowEmptyAsZero) {
      return { ok: true, steps: 0, emptyAsZero: true };
    }
    return { ok: false, error: 'กรุณากรอกจำนวนก้าวเดิน' };
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return { ok: false, error: 'ตัวเลขจำนวนก้าวไม่ถูกต้อง' };
    }
    return { ok: true, steps: Math.round(raw) };
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/[\r\n]/.test(trimmed)) {
      return {
        ok: false,
        error:
          'พบข้อมูลหลายบรรทัด กรุณาเลือกตัวแปร "ผลรวม (Sum)" แทน "ตัวอย่างข้อมูลสุขภาพ (Health Samples)" ใน Apple Shortcuts',
      };
    }
    const cleaned = normalizeNumericText(trimmed);
    if (!cleaned || !/^[+-]?\d+(\.\d+)?$/.test(cleaned)) {
      return { ok: false, error: 'รูปแบบตัวเลขจำนวนก้าวไม่ถูกต้อง' };
    }
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) {
      return { ok: false, error: 'ตัวเลขจำนวนก้าวไม่ถูกต้อง' };
    }
    return { ok: true, steps: Math.round(parsed) };
  }
  return { ok: false, error: 'รูปแบบข้อมูลจำนวนก้าวไม่รองรับ' };
}

/**
 * Returns YYYY-MM-DD in Asia/Bangkok (UTC+7), matching midnight reset of Apple Health & Health Connect in Thailand.
 */
export function getBangkokDateKey(nowMs: number = Date.now()): string {
  const bkk = new Date(nowMs + 7 * 3600 * 1000);
  return bkk.toISOString().slice(0, 10);
}

export function generateSyncKey(): string {
  return `wc_${crypto.randomBytes(12).toString('hex')}`;
}

async function generateUniqueSyncKey(db: Client = turso): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generateSyncKey();
    const existing = await db.execute({
      sql: `SELECT id FROM users WHERE sync_key = ? LIMIT 1`,
      args: [candidate],
    });
    if (existing.rows.length === 0) {
      return candidate;
    }
  }
  return `wc_${crypto.randomBytes(16).toString('hex')}`;
}

export async function ensureUserSyncKey(userId: number, db: Client = turso): Promise<string> {
  const check = await db.execute({
    sql: `SELECT id, sync_key FROM users WHERE id = ? LIMIT 1`,
    args: [userId],
  });
  if (check.rows.length === 0) {
    throw new StepSyncError('ไม่พบผู้เล่นนี้ในระบบ', 404);
  }
  const currentKey = String(check.rows[0].sync_key || '').trim();
  if (currentKey.length >= 10) {
    return currentKey;
  }

  const nextKey = await generateUniqueSyncKey(db);
  await db.execute({
    sql: `UPDATE users SET sync_key = ? WHERE id = ? AND (sync_key IS NULL OR sync_key = '')`,
    args: [nextKey, userId],
  });

  const reread = await db.execute({
    sql: `SELECT sync_key FROM users WHERE id = ? LIMIT 1`,
    args: [userId],
  });
  return String(reread.rows[0]?.sync_key || nextKey).trim();
}

export async function rotateUserSyncKey(userId: number, db: Client = turso): Promise<string> {
  const check = await db.execute({
    sql: `SELECT id FROM users WHERE id = ? LIMIT 1`,
    args: [userId],
  });
  if (check.rows.length === 0) {
    throw new StepSyncError('ไม่พบผู้เล่นนี้ในระบบ', 404);
  }
  const nextKey = await generateUniqueSyncKey(db);
  await db.execute({
    sql: `UPDATE users SET sync_key = ? WHERE id = ?`,
    args: [nextKey, userId],
  });
  return nextKey;
}

export async function findUserBySyncKey(syncKey: string, db: Client = turso) {
  const clean = typeof syncKey === 'string' ? syncKey.trim() : '';
  if (clean.length < 10 || !clean.startsWith('wc_')) {
    return null;
  }
  const res = await db.execute({
    sql: `SELECT * FROM users WHERE sync_key = ? LIMIT 1`,
    args: [clean],
  });
  return res.rows.length > 0 ? res.rows[0] : null;
}

export async function resolveActiveSeason(
  requestedSeasonId?: number,
  db: Client = turso
): Promise<{ seasonId: number; stepTarget: number }> {
  const DEFAULT_STEP_TARGET = 300000;
  const reqId = Number(requestedSeasonId || 0);
  if (reqId > 0) {
    const sRes = await db.execute({
      sql: `SELECT id, step_target FROM seasons WHERE id = ? LIMIT 1`,
      args: [reqId],
    });
    if (sRes.rows.length > 0) {
      return {
        seasonId: Number(sRes.rows[0].id),
        stepTarget: Math.max(1000, Number(sRes.rows[0].step_target || DEFAULT_STEP_TARGET)),
      };
    }
  }

  const sRes = await db.execute(
    `SELECT id, step_target FROM seasons WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
  );
  if (sRes.rows.length > 0) {
    return {
      seasonId: Number(sRes.rows[0].id),
      stepTarget: Math.max(1000, Number(sRes.rows[0].step_target || DEFAULT_STEP_TARGET)),
    };
  }
  return { seasonId: 1, stepTarget: DEFAULT_STEP_TARGET };
}

export async function getTodaySyncStatus(
  userId: number,
  requestedSeasonId?: number,
  nowMs: number = Date.now(),
  db: Client = turso
) {
  const syncKey = await ensureUserSyncKey(userId, db);
  const { seasonId, stepTarget } = await resolveActiveSeason(requestedSeasonId, db);
  const syncDate = getBangkokDateKey(nowMs);

  const [dailyRes, entryRes] = await Promise.all([
    db.execute({
      sql: `SELECT max_synced_steps, sync_count, last_source, updated_at FROM daily_step_syncs WHERE season_id = ? AND user_id = ? AND sync_date = ? LIMIT 1`,
      args: [seasonId, userId, syncDate],
    }),
    db.execute({
      sql: `SELECT step_count FROM season_entries WHERE season_id = ? AND user_id = ? LIMIT 1`,
      args: [seasonId, userId],
    }),
  ]);

  const row = dailyRes.rows[0];
  const stepCount = Math.max(0, Number(entryRes.rows[0]?.step_count ?? 0));

  return {
    syncKey,
    seasonId,
    stepTarget,
    stepCount,
    syncDate,
    todaySyncedSteps: Math.max(0, Number(row?.max_synced_steps ?? 0)),
    syncCount: Math.max(0, Number(row?.sync_count ?? 0)),
    lastSource: String(row?.last_source || ''),
    updatedAt: String(row?.updated_at || ''),
  };
}

export async function broadcastServerArenaSync(payload: {
  actorId: number;
  actorName: string;
  actorEmoji: string;
  dividends?: DividendPayout[];
  detail?: string;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    await fetch(`${supabaseUrl.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic: 'waist-arena-live',
            event: 'arena_sync',
            payload: {
              reason: 'weight_logged',
              actorId: payload.actorId,
              actorName: payload.actorName,
              actorEmoji: payload.actorEmoji,
              detail: payload.detail || '',
              dividends: payload.dividends || [],
              ts: Date.now(),
            },
          },
        ],
      }),
    });
  } catch {
    // Non-fatal: clients also diff-poll on tab focus & background interval
  } finally {
    clearTimeout(timer);
  }
}

export async function recordStepsWithRewards(
  params: {
    userId: number;
    mode: StepSyncMode;
    stepsInput: number;
    seasonId?: number;
    source?: StepSyncSource;
    note?: string;
    nowMs?: number;
    broadcastServerRealtime?: boolean;
  },
  db: Client = turso
): Promise<RecordStepsResult> {
  const {
    userId,
    mode,
    stepsInput,
    seasonId: requestedSeasonId,
    source = mode === 'daily_sync'
      ? 'web_daily_sync'
      : mode === 'set'
      ? 'manual_set'
      : 'manual_add',
    note,
    nowMs = Date.now(),
    broadcastServerRealtime = false,
  } = params;

  const rawSteps = Math.round(Number(stepsInput));
  if (!Number.isFinite(rawSteps)) {
    throw new StepSyncError('ตัวเลขจำนวนก้าวไม่ถูกต้อง', 400);
  }

  if (mode === 'daily_sync' && (rawSteps < 0 || rawSteps > 300000)) {
    throw new StepSyncError('ยอดก้าวเดินรายวันต้องอยู่ระหว่าง 0 – 300,000 ก้าว', 400);
  }
  if (mode === 'add' && (rawSteps < 1 || rawSteps > 500000)) {
    throw new StepSyncError('กรุณากรอกจำนวนก้าวที่เพิ่มระหว่าง 1 – 500,000 ก้าว', 400);
  }
  if (mode === 'set' && (rawSteps < 0 || rawSteps > 10000000)) {
    throw new StepSyncError('กรุณากรอกยอดก้าวรวมระหว่าง 0 – 10,000,000 ก้าว', 400);
  }

  const userRes = await db.execute({
    sql: `SELECT * FROM users WHERE id = ? LIMIT 1`,
    args: [userId],
  });
  if (userRes.rows.length === 0) {
    throw new StepSyncError('ไม่พบรายชื่อผู้เข้าแข่งขัน', 404);
  }
  const user = userRes.rows[0];
  const userName = String(user.name || 'ผู้กล้า');
  const userEmoji = String(user.avatar_emoji || '👟');

  const { seasonId: targetSeasonId, stepTarget: seasonStepTarget } = await resolveActiveSeason(
    requestedSeasonId,
    db
  );

  // Ensure season_entries row exists atomically
  const defaultStartVal = Number(user.start_weight || 65);
  const defaultTargetVal = Number(user.goal_weight || 55);
  await db.execute({
    sql: `INSERT OR IGNORE INTO season_entries (
      season_id, user_id, goal_type, start_val, current_val, target_val,
      max_progress_awarded, side_coins_awarded, step_count, max_steps_pct_awarded
    ) VALUES (?, ?, 'weight_loss', ?, ?, ?, 0, 0, 0, 0)`,
    args: [targetSeasonId, userId, defaultStartVal, defaultStartVal, defaultTargetVal],
  });

  const entryRes = await db.execute({
    sql: `SELECT * FROM season_entries WHERE season_id = ? AND user_id = ? LIMIT 1`,
    args: [targetSeasonId, userId],
  });
  const entryRow = entryRes.rows[0];
  const prevVal = Number(entryRow?.current_val ?? defaultStartVal);
  const prevStepCount = Math.max(0, Number(entryRow?.step_count ?? 0));

  const syncDate = getBangkokDateKey(nowMs);
  const utcIso = new Date(nowMs).toISOString();
  const utcDateKey = utcIso.slice(0, 10);
  const utcTimestamp = utcIso.replace('T', ' ').slice(0, 19);

  let prevSyncedToday = 0;
  let todaySyncedSteps = 0;
  let diff = 0;

  if (mode === 'daily_sync') {
    await db.execute({
      sql: `INSERT OR IGNORE INTO daily_step_syncs (
        season_id, user_id, sync_date, max_synced_steps, sync_count, last_source
      ) VALUES (?, ?, ?, 0, 0, ?)`,
      args: [targetSeasonId, userId, syncDate, source],
    });

    // Optimistic Compare-And-Swap (CAS) loop to prevent concurrent double-counting
    let casWon = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const syncCheck = await db.execute({
        sql: `SELECT max_synced_steps FROM daily_step_syncs WHERE season_id = ? AND user_id = ? AND sync_date = ? LIMIT 1`,
        args: [targetSeasonId, userId, syncDate],
      });
      prevSyncedToday = Math.max(0, Number(syncCheck.rows[0]?.max_synced_steps ?? 0));

      if (rawSteps <= prevSyncedToday) {
        await db.execute({
          sql: `UPDATE daily_step_syncs SET sync_count = sync_count + 1, last_source = ?, updated_at = CURRENT_TIMESTAMP WHERE season_id = ? AND user_id = ? AND sync_date = ?`,
          args: [source, targetSeasonId, userId, syncDate],
        });
        const latestEntryRes = await db.execute({
          sql: `SELECT step_count FROM season_entries WHERE season_id = ? AND user_id = ? LIMIT 1`,
          args: [targetSeasonId, userId],
        });
        const latestUserRes = await db.execute({
          sql: `SELECT points FROM users WHERE id = ? LIMIT 1`,
          args: [userId],
        });
        const curSteps = Math.max(0, Number(latestEntryRes.rows[0]?.step_count ?? prevStepCount));
        const curPct = Math.round((curSteps / Math.max(1, seasonStepTarget)) * 1000) / 10;
        const curPoints = Number(latestUserRes.rows[0]?.points ?? user.points ?? 100);
        const alreadyMsg =
          rawSteps === 0 && prevSyncedToday === 0
            ? '👟 วันนี้ยังไม่มีก้าวเดินใหม่ให้ซิงก์ (0 ก้าว)'
            : `✅ ยอดก้าววันนี้ (${prevSyncedToday.toLocaleString()} ก้าว) ซิงก์เข้าสนามครบแล้ว ยังไม่มีก้าวเดินเพิ่มจากรอบก่อน`;

        return {
          success: true,
          logType: 'steps',
          mode: 'daily_sync',
          alreadySynced: true,
          syncDate,
          todaySteps: rawSteps,
          prevSyncedToday,
          todaySyncedSteps: prevSyncedToday,
          diff: 0,
          roast: alreadyMsg,
          message: alreadyMsg,
          progressPct: curPct,
          stepCount: curSteps,
          stepTarget: seasonStepTarget,
          seasonId: targetSeasonId,
          isInFoodStall: false,
          progressBonus: 0,
          dailyLogBonus: 0,
          earnedPoints: 0,
          dividends: [],
          points: curPoints,
          currentVal: prevVal,
          user: { id: userId, name: userName, emoji: userEmoji },
        };
      }

      const casUpd = await db.execute({
        sql: `UPDATE daily_step_syncs
              SET max_synced_steps = ?, sync_count = sync_count + 1, last_source = ?, updated_at = CURRENT_TIMESTAMP
              WHERE season_id = ? AND user_id = ? AND sync_date = ? AND max_synced_steps = ?`,
        args: [rawSteps, source, targetSeasonId, userId, syncDate, prevSyncedToday],
      });

      if (Number(casUpd.rowsAffected ?? 0) === 1) {
        casWon = true;
        diff = rawSteps - prevSyncedToday;
        todaySyncedSteps = rawSteps;
        break;
      }
    }

    if (!casWon) {
      throw new StepSyncError('มีการซิงก์ซ้อนกัน กรุณาลองใหม่อีกครั้ง', 409);
    }
  } else {
    // Manual 'add' or 'set': read today's synced count for status metadata
    const syncCheck = await db.execute({
      sql: `SELECT max_synced_steps FROM daily_step_syncs WHERE season_id = ? AND user_id = ? AND sync_date = ? LIMIT 1`,
      args: [targetSeasonId, userId, syncDate],
    });
    prevSyncedToday = Math.max(0, Number(syncCheck.rows[0]?.max_synced_steps ?? 0));
    todaySyncedSteps = prevSyncedToday;
  }

  let nextStepCount = prevStepCount;
  if (mode === 'daily_sync') {
    await db.execute({
      sql: `UPDATE season_entries SET step_count = step_count + ?, updated_at = CURRENT_TIMESTAMP WHERE season_id = ? AND user_id = ?`,
      args: [diff, targetSeasonId, userId],
    });
  } else if (mode === 'add') {
    diff = rawSteps;
    await db.execute({
      sql: `UPDATE season_entries SET step_count = step_count + ?, updated_at = CURRENT_TIMESTAMP WHERE season_id = ? AND user_id = ?`,
      args: [diff, targetSeasonId, userId],
    });
  } else {
    // mode === 'set'
    diff = rawSteps - prevStepCount;
    await db.execute({
      sql: `UPDATE season_entries SET step_count = ?, updated_at = CURRENT_TIMESTAMP WHERE season_id = ? AND user_id = ?`,
      args: [rawSteps, targetSeasonId, userId],
    });
    // If user manually reduced total season steps to fix a mistake, clamp today's max_synced_steps down proportionally
    if (diff < 0 && prevSyncedToday > 0) {
      const adjustedToday = Math.max(0, prevSyncedToday + diff);
      todaySyncedSteps = adjustedToday;
      await db.execute({
        sql: `UPDATE daily_step_syncs SET max_synced_steps = ?, updated_at = CURRENT_TIMESTAMP WHERE season_id = ? AND user_id = ? AND sync_date = ?`,
        args: [adjustedToday, targetSeasonId, userId, syncDate],
      });
    }
  }

  // Re-read authoritative step_count & max_steps_pct_awarded
  const updatedEntryRes = await db.execute({
    sql: `SELECT step_count, max_steps_pct_awarded FROM season_entries WHERE season_id = ? AND user_id = ? LIMIT 1`,
    args: [targetSeasonId, userId],
  });
  nextStepCount = Math.max(0, Number(updatedEntryRes.rows[0]?.step_count ?? prevStepCount + diff));
  const nextPct = Math.round((nextStepCount / Math.max(1, seasonStepTarget)) * 1000) / 10;
  const nextIntStepPct = Math.min(100, Math.floor(nextPct));

  const defaultNote =
    mode === 'daily_sync'
      ? source === 'apple_shortcut'
        ? `🍎 Apple Health Sync: วันนี้ ${rawSteps.toLocaleString()} ก้าว (+${diff.toLocaleString()})`
        : source === 'ocr_screenshot'
        ? `📸 AI Health Screenshot: วันนี้ ${rawSteps.toLocaleString()} ก้าว (+${diff.toLocaleString()})`
        : `🔄 ซิงก์ก้าวเดินวันนี้: ${rawSteps.toLocaleString()} ก้าว (+${diff.toLocaleString()})`
      : 'อัปเดตก้าวเดิน Step Challenge';

  // Insert step_logs BEFORE evaluating daily first-log bonus so AUTOINCREMENT id strictly orders concurrent requests
  const stepLogIns = await db.execute({
    sql: `INSERT INTO step_logs (season_id, user_id, steps_added, total_steps, note, logged_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [targetSeasonId, userId, diff, nextStepCount, note?.trim() || defaultNote, utcTimestamp],
  });
  const thisStepLogId = Number(stepLogIns.lastInsertRowid ?? 0);

  // Daily first-log bonus (+10 coins once per UTC day / 07:00 BKK reset) ONLY when actual positive steps were added
  let dailyLogBonus = 0;
  if (diff > 0) {
    const [wTodayRes, sTodayRes] = await Promise.all([
      db.execute({
        sql: `SELECT COUNT(*) AS cnt FROM weight_logs WHERE user_id = ? AND date(logged_at) = ?`,
        args: [userId, utcDateKey],
      }),
      db.execute({
        sql:
          thisStepLogId > 0
            ? `SELECT COUNT(*) AS cnt FROM step_logs WHERE user_id = ? AND date(logged_at) = ? AND steps_added > 0 AND id < ?`
            : `SELECT COUNT(*) AS cnt FROM step_logs WHERE user_id = ? AND date(logged_at) = ? AND steps_added > 0`,
        args: thisStepLogId > 0 ? [userId, utcDateKey, thisStepLogId] : [userId, utcDateKey],
      }),
    ]);
    const priorLogsToday =
      Number(wTodayRes.rows[0]?.cnt ?? 0) +
      (thisStepLogId > 0 ? Number(sTodayRes.rows[0]?.cnt ?? 0) : Math.max(0, Number(sTodayRes.rows[0]?.cnt ?? 0) - 1));
    dailyLogBonus = priorLogsToday > 0 ? 0 : 10;
  }

  // Award step progress milestone coins (+10 coins per +1% up to 100% = 1,000 coins/season) with CAS
  let progressBonus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const pctRes = await db.execute({
      sql: `SELECT max_steps_pct_awarded FROM season_entries WHERE season_id = ? AND user_id = ? LIMIT 1`,
      args: [targetSeasonId, userId],
    });
    const curMaxPct = Number(pctRes.rows[0]?.max_steps_pct_awarded ?? 0);
    if (nextIntStepPct <= curMaxPct) break;
    const pctUpd = await db.execute({
      sql: `UPDATE season_entries SET max_steps_pct_awarded = ? WHERE season_id = ? AND user_id = ? AND max_steps_pct_awarded = ?`,
      args: [nextIntStepPct, targetSeasonId, userId, curMaxPct],
    });
    if (Number(pctUpd.rowsAffected ?? 0) === 1) {
      progressBonus = (nextIntStepPct - curMaxPct) * 10;
      break;
    }
  }

  const earnedPoints = progressBonus + dailyLogBonus;
  if (earnedPoints > 0) {
    await db.execute({
      sql: `UPDATE users SET points = points + ? WHERE id = ?`,
      args: [earnedPoints, userId],
    });
  }

  const finalUserRes = await db.execute({
    sql: `SELECT points FROM users WHERE id = ? LIMIT 1`,
    args: [userId],
  });
  const nextPoints = Number(finalUserRes.rows[0]?.points ?? Number(user.points ?? 100) + earnedPoints);

  // Cheer Dividend system (cap 40 coins/person/day) with atomic claim token
  const isGoodProgress = diff > 0;
  const DAILY_DIVIDEND_CAP = 40;
  const dividends: DividendPayout[] = [];

  if (isGoodProgress || progressBonus > 0) {
    const claimToken = crypto.randomInt(2, 2_000_000_000);
    const claimRes = await db.execute({
      sql: `UPDATE interactions SET dividend_claimed = ? WHERE target_user_id = ? AND dividend_claimed = 0`,
      args: [claimToken, userId],
    });

    if (Number(claimRes.rowsAffected ?? 0) > 0) {
      const backersRes = await db.execute({
        sql: `
          SELECT i.sender_id, i.kind, COUNT(*) AS cnt, u.name, u.avatar_emoji,
                 u.dividend_earned_date, u.dividend_earned_today
          FROM interactions i
          JOIN users u ON u.id = i.sender_id
          WHERE i.target_user_id = ?
            AND i.dividend_claimed = ?
            AND i.sender_id IS NOT NULL
            AND i.sender_id != ?
          GROUP BY i.sender_id, i.kind
        `,
        args: [userId, claimToken, userId],
      });

      const shareBonusFromProgress = Math.round(progressBonus * 0.25);
      const earnedTodayMap = new Map<number, number>();

      for (const bRow of backersRes.rows) {
        const sid = Number(bRow.sender_id);
        const bKind = String(bRow.kind) === 'tempt' ? 'tempt' : 'cheer';
        if (bKind !== 'cheer') continue;
        const stacks = Math.min(3, Math.max(1, Number(bRow.cnt)));

        if (!earnedTodayMap.has(sid)) {
          const prevDate = String(bRow.dividend_earned_date || '');
          const prevAmt = prevDate === utcDateKey ? Number(bRow.dividend_earned_today ?? 0) : 0;
          earnedTodayMap.set(sid, prevAmt);
        }
        const alreadyToday = earnedTodayMap.get(sid) ?? 0;
        const remainingCap = Math.max(0, DAILY_DIVIDEND_CAP - alreadyToday);
        if (remainingCap <= 0) continue;

        const rawPayout = Math.min(DAILY_DIVIDEND_CAP, stacks * 8 + shareBonusFromProgress);
        const payout = Math.min(rawPayout, remainingCap);
        if (payout > 0) {
          const nextToday = alreadyToday + payout;
          earnedTodayMap.set(sid, nextToday);
          await db.execute({
            sql: `UPDATE users SET points = points + ?, dividend_earned_date = ?, dividend_earned_today = ? WHERE id = ?`,
            args: [payout, utcDateKey, nextToday, sid],
          });
          dividends.push({
            userId: sid,
            name: String(bRow.name),
            emoji: String(bRow.avatar_emoji),
            kind: 'cheer',
            stacks,
            payout,
          });
        }
      }
    }
  }

  const roastText =
    mode === 'daily_sync'
      ? prevSyncedToday > 0
        ? `👟 ซิงก์ยอดวันนี้ ${rawSteps.toLocaleString()} ก้าว (บวกส่วนต่าง +${diff.toLocaleString()} ก้าว) รวมซีซั่น ${nextStepCount.toLocaleString()} / ${seasonStepTarget.toLocaleString()} ก้าว (${nextPct}%)`
        : `👟 ซิงก์ก้าววันนี้ +${diff.toLocaleString()} ก้าว! รวมซีซั่น ${nextStepCount.toLocaleString()} / ${seasonStepTarget.toLocaleString()} ก้าว (${nextPct}%)`
      : diff > 0
      ? `👟 สับขาสุดปัง! สะสมเพิ่ม +${diff.toLocaleString()} ก้าว รวม ${nextStepCount.toLocaleString()} / ${seasonStepTarget.toLocaleString()} ก้าว (${nextPct}%)`
      : `👟 อัปเดตยอดก้าวเดินรวมเป็น ${nextStepCount.toLocaleString()} / ${seasonStepTarget.toLocaleString()} ก้าว (${nextPct}%)`;

  const shortcutMessage =
    earnedPoints > 0
      ? `${roastText} • รับโบนัส +${earnedPoints} เหรียญ!`
      : roastText;

  if (broadcastServerRealtime) {
    await broadcastServerArenaSync({
      actorId: userId,
      actorName: userName,
      actorEmoji: userEmoji,
      dividends,
      detail: `ซิงก์ก้าวเดิน +${diff.toLocaleString()} ก้าว!`,
    });
  }

  return {
    success: true,
    logType: 'steps',
    mode,
    alreadySynced: false,
    syncDate,
    ...(mode === 'daily_sync' ? { todaySteps: rawSteps } : {}),
    prevSyncedToday,
    todaySyncedSteps,
    diff,
    roast: roastText,
    message: shortcutMessage,
    progressPct: nextPct,
    stepCount: nextStepCount,
    stepTarget: seasonStepTarget,
    seasonId: targetSeasonId,
    isInFoodStall: false,
    progressBonus,
    dailyLogBonus,
    earnedPoints,
    dividends,
    points: nextPoints,
    currentVal: prevVal,
    user: { id: userId, name: userName, emoji: userEmoji },
  };
}
