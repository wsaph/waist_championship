import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { evaluateSessionMatch, type SessionEvalResult } from '@/lib/client_session';

export { evaluateSessionMatch, type SessionEvalResult };

export function extractRequestSessionToken(
  req: Request,
  fallbackQueryToken?: string | null
): string {
  return (req.headers.get('x-session-token') || fallbackQueryToken || '').trim();
}

export async function broadcastServerSessionKick(
  userId: number,
  sessionToken: string
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
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
            event: 'session_kick',
            payload: {
              userId,
              sessionToken,
              ts: Date.now(),
            },
          },
        ],
      }),
    });
  } catch {
    // Non-fatal: clients also broadcast over Realtime/BroadcastChannel and verify on /api/weights
  } finally {
    clearTimeout(timer);
  }
}

export async function issueUserSessionToken(userId: number): Promise<string> {
  const token = crypto.randomUUID();
  await turso.execute({
    sql: 'UPDATE users SET active_session_token = ? WHERE id = ?',
    args: [token, userId],
  });
  await broadcastServerSessionKick(userId, token);
  return token;
}

export async function verifyOrMigrateSessionToken(
  userId: number,
  rawDbToken: unknown,
  rawClientToken?: string | null
): Promise<{ valid: boolean; migratedToken?: string }> {
  const dbToken = typeof rawDbToken === 'string' ? rawDbToken : String(rawDbToken ?? '');
  const clientToken = typeof rawClientToken === 'string' ? rawClientToken.trim() : '';
  const evalStatus = evaluateSessionMatch(dbToken, clientToken);

  if (evalStatus === 'valid') {
    return { valid: true };
  }
  if (evalStatus === 'invalid') {
    return { valid: false };
  }

  // Seamless first-time migration when `active_session_token` is still empty in DB:
  // First active device/tab atomically binds its token; any competing second device loses the race and gets kicked.
  const candidateToken = clientToken.length >= 16 ? clientToken : crypto.randomUUID();
  const claimRes = await turso.execute({
    sql: `
      UPDATE users
      SET active_session_token = ?
      WHERE id = ? AND (active_session_token IS NULL OR active_session_token = '')
    `,
    args: [candidateToken, userId],
  });

  if (Number(claimRes.rowsAffected ?? 0) > 0) {
    return { valid: true, migratedToken: candidateToken };
  }

  const recheck = await turso.execute({
    sql: 'SELECT active_session_token FROM users WHERE id = ? LIMIT 1',
    args: [userId],
  });
  const latestDb = String(recheck.rows[0]?.active_session_token || '').trim();
  return { valid: clientToken.length > 0 && clientToken === latestDb };
}

export async function assertActiveUserSession(
  req: Request,
  userId: number | null | undefined
): Promise<NextResponse | null> {
  const uid = Number(userId || 0);
  if (!uid || uid <= 0) return null;

  const clientToken = extractRequestSessionToken(req);
  const res = await turso.execute({
    sql: 'SELECT active_session_token FROM users WHERE id = ? LIMIT 1',
    args: [uid],
  });
  if (res.rows.length === 0) return null;

  const check = await verifyOrMigrateSessionToken(
    uid,
    res.rows[0].active_session_token,
    clientToken
  );
  if (!check.valid) {
    return NextResponse.json(
      {
        error: 'มีการเข้าสู่ระบบตัวละครนี้จากเครื่องหรือแท็บอื่น กรุณาเข้าสู่ระบบใหม่',
        sessionKicked: true,
      },
      { status: 401 }
    );
  }
  return null;
}
