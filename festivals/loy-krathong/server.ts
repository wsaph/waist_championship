import type { Client } from '@libsql/client';
import { turso } from '@/lib/turso_client';
import {
  LOY_KRATHONG_FESTIVAL_ID,
  mapRowToKrathong,
  sanitizeKrathongLaunchPayload,
  type KrathongItem,
} from './catalog';
import { ensureLoyKrathongSchema } from './schema';

export { ensureLoyKrathongSchema };

export async function listRecentKrathongs(
  db: Client = turso,
  limit = 45
): Promise<KrathongItem[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const res = await db.execute({
    sql: `
      SELECT
        id,
        user_id,
        user_name,
        user_emoji,
        style_id,
        caption,
        avatar_color,
        avatar_band,
        avatar_species,
        orbit_seed,
        lane_offset,
        start_x,
        start_z,
        created_at
      FROM krathongs
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    args: [safeLimit],
  });
  return res.rows.map((r) => mapRowToKrathong(r as unknown as Record<string, unknown>));
}

export async function createKrathongRecord(
  body: Record<string, unknown>,
  db: Client = turso
): Promise<KrathongItem> {
  const sanitized = sanitizeKrathongLaunchPayload(body);
  let { userName, userEmoji, avatarColor, avatarBand, avatarSpecies } = sanitized;

  if (sanitized.uid) {
    const userRes = await db.execute({
      sql: 'SELECT name, avatar_emoji, color_hex, band_color, species FROM users WHERE id = ?',
      args: [sanitized.uid],
    });
    if (userRes.rows.length > 0) {
      const u = userRes.rows[0];
      userName = String(u.name || userName);
      userEmoji = String(u.avatar_emoji || userEmoji);
      avatarColor = String(u.color_hex || avatarColor);
      avatarBand = String(u.band_color || avatarBand);
      avatarSpecies = String(u.species || avatarSpecies);
    }
  }

  const createdAt = Date.now();
  const insertRes = await db.execute({
    sql: `
      INSERT INTO krathongs (
        user_id,
        user_name,
        user_emoji,
        style_id,
        caption,
        avatar_color,
        avatar_band,
        avatar_species,
        orbit_seed,
        lane_offset,
        start_x,
        start_z,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      sanitized.uid,
      userName,
      userEmoji,
      sanitized.styleId,
      sanitized.cleanCaption,
      avatarColor,
      avatarBand,
      avatarSpecies,
      sanitized.orbitSeed,
      sanitized.laneOffset,
      sanitized.startX,
      sanitized.startZ,
      createdAt,
    ],
  });

  const newId = Number(insertRes.lastInsertRowid || createdAt);
  return {
    id: newId,
    userId: sanitized.uid,
    userName,
    userEmoji,
    styleId: sanitized.styleId,
    caption: sanitized.cleanCaption,
    avatarColor,
    avatarBand,
    avatarSpecies,
    orbitSeed: sanitized.orbitSeed,
    laneOffset: sanitized.laneOffset,
    startX: sanitized.startX,
    startZ: sanitized.startZ,
    createdAt,
  };
}

export async function handleGetKrathongs(db: Client = turso): Promise<Response> {
  try {
    const krathongs = await listRecentKrathongs(db);
    return Response.json({ krathongs });
  } catch (error) {
    console.error('GET /api/krathong error:', error);
    return Response.json({ krathongs: [] }, { status: 500 });
  }
}

export async function handlePostKrathong(
  req: Request,
  db: Client = turso
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: 'รูปแบบข้อมูลไม่ถูกต้อง (Invalid JSON)' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json(
      { error: 'ข้อมูลกระทงไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' },
      { status: 400 }
    );
  }

  try {
    const krathong = await createKrathongRecord(body as Record<string, unknown>, db);
    return Response.json({
      success: true,
      krathong,
    });
  } catch (error) {
    console.error('POST /api/krathong error:', error);
    return Response.json(
      { error: 'ปล่อยกระทงไม่สำเร็จ กรุณาลองใหม่อีกครั้งนะ' },
      { status: 500 }
    );
  }
}

export const loyKrathongServerHandler = {
  festivalId: LOY_KRATHONG_FESTIVAL_ID,
  handleGet: (_req: Request) => handleGetKrathongs(),
  handlePost: (req: Request) => handlePostKrathong(req),
};
