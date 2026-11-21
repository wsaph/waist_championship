import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import {
  StepSyncError,
  findUserBySyncKey,
  getTodaySyncStatus,
  parseStepsValue,
  recordStepsWithRewards,
  rotateUserSyncKey,
  type StepSyncSource,
} from '@/lib/health_sync';

export const dynamic = 'force-dynamic';

const EXTERNAL_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key',
  'Cache-Control': 'no-store, max-age=0',
};

const INTERNAL_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, max-age=0',
  Vary: 'Origin',
};

const SYNC_KEY_ALIASES = new Set(['synckey', 'sync_key', 'key', 'token']);
const STEPS_KEY_ALIASES = new Set([
  'steps',
  'step',
  'stepcount',
  'step_count',
  'count',
  'value',
  'sum',
  'total',
  'ก้าว',
]);
const META_KEY_ALIASES = new Set([
  ...SYNC_KEY_ALIASES,
  'seasonid',
  'season_id',
  'note',
  'source',
  'userid',
  'user_id',
  'isself',
  'pincode',
]);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: EXTERNAL_CORS_HEADERS });
}

function isSameOriginRequest(req: Request): boolean {
  const secFetchSite = (req.headers.get('sec-fetch-site') || '').toLowerCase();
  if (secFetchSite === 'cross-site') {
    return false;
  }
  const origin = req.headers.get('origin')?.trim();
  if (!origin) {
    return true;
  }
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const targetHost = (
      req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
      req.headers.get('host')?.trim() ||
      new URL(req.url).host
    ).toLowerCase();
    return Boolean(originHost && targetHost && originHost === targetHost);
  } catch {
    return false;
  }
}

function findParamCaseInsensitive(
  searchParams: URLSearchParams,
  aliases: Set<string>
): { found: boolean; value: string } {
  for (const [k, v] of searchParams.entries()) {
    if (aliases.has(k.trim().toLowerCase())) {
      return { found: true, value: v };
    }
  }
  return { found: false, value: '' };
}

function findBodyKeyCaseInsensitive(
  body: Record<string, unknown>,
  aliases: Set<string>
): { found: boolean; value: unknown } {
  for (const [k, v] of Object.entries(body)) {
    if (aliases.has(k.trim().toLowerCase())) {
      return { found: true, value: v };
    }
  }
  return { found: false, value: undefined };
}

function extractHeaderSyncKey(req: Request): string {
  const direct = req.headers.get('x-sync-key')?.trim();
  if (direct) return direct;
  const auth = req.headers.get('authorization')?.trim() || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  if (auth.startsWith('wc_')) {
    return auth;
  }
  return '';
}

export async function GET(req: Request) {
  let isExternal = false;
  try {
    const urlObj = new URL(req.url);
    const paramKey = findParamCaseInsensitive(urlObj.searchParams, SYNC_KEY_ALIASES);
    const queryKey = (paramKey.found ? paramKey.value.trim() : '') || extractHeaderSyncKey(req);

    if (queryKey) {
      isExternal = true;
      const user = await findUserBySyncKey(queryKey);
      if (!user) {
        return NextResponse.json(
          {
            success: false,
            error: 'รหัส Sync Key ไม่ถูกต้อง หรือถูกสุ่มเปลี่ยนใหม่แล้ว',
          },
          { status: 401, headers: EXTERNAL_CORS_HEADERS }
        );
      }
      const uid = Number(user.id);
      const status = await getTodaySyncStatus(uid);
      return NextResponse.json(
        {
          success: true,
          ok: true,
          message: `เชื่อมต่อสำเร็จ! พร้อมรับยอดก้าวเดินของ ${String(user.avatar_emoji || '👟')} ${String(user.name)} ผ่าน Method POST`,
          user: {
            id: uid,
            name: String(user.name),
            emoji: String(user.avatar_emoji || '👟'),
          },
          syncDate: status.syncDate,
          todaySyncedSteps: status.todaySyncedSteps,
          stepCount: status.stepCount,
          stepTarget: status.stepTarget,
        },
        { headers: EXTERNAL_CORS_HEADERS }
      );
    }

    if (!isSameOriginRequest(req)) {
      return NextResponse.json(
        { error: 'ไม่อนุญาตให้ดึงรหัส Sync Key ข้ามโดเมน' },
        { status: 403, headers: INTERNAL_HEADERS }
      );
    }

    const userId = Number(urlObj.searchParams.get('userId') || 0);
    const viewerId = Number(urlObj.searchParams.get('viewerId') || 0);
    const pinCode = urlObj.searchParams.get('pinCode') ?? '';
    const seasonId = Number(urlObj.searchParams.get('seasonId') || 0);
    if (!userId || userId <= 0) {
      return NextResponse.json(
        { error: 'กรุณาระบุ userId หรือ key' },
        { status: 400, headers: INTERNAL_HEADERS }
      );
    }

    if (viewerId !== userId) {
      if (!pinCode) {
        return NextResponse.json(
          { error: 'เฉพาะเจ้าของตัวละครเท่านั้นที่สามารถดูรหัส Sync Key ได้' },
          { status: 401, headers: INTERNAL_HEADERS }
        );
      }
      const uRes = await turso.execute({
        sql: `SELECT id, pin_code FROM users WHERE id = ? LIMIT 1`,
        args: [userId],
      });
      if (uRes.rows.length === 0) {
        return NextResponse.json(
          { error: 'ไม่พบผู้เล่นนี้ในระบบ' },
          { status: 404, headers: INTERNAL_HEADERS }
        );
      }
      if (String(uRes.rows[0].pin_code) !== String(pinCode)) {
        return NextResponse.json(
          { error: 'รหัส PIN ไม่ถูกต้อง!' },
          { status: 401, headers: INTERNAL_HEADERS }
        );
      }
    }

    const status = await getTodaySyncStatus(userId, seasonId > 0 ? seasonId : undefined);
    return NextResponse.json(
      {
        success: true,
        ...status,
      },
      { headers: INTERNAL_HEADERS }
    );
  } catch (error) {
    const respHeaders = isExternal ? EXTERNAL_CORS_HEADERS : INTERNAL_HEADERS;
    if (error instanceof StepSyncError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: respHeaders }
      );
    }
    console.error('GET /api/health-sync error:', error);
    return NextResponse.json(
      { error: 'ดึงข้อมูลการซิงก์ก้าวเดินไม่สำเร็จ' },
      { status: 500, headers: respHeaders }
    );
  }
}

async function parseFlexibleBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    try {
      const fd = await req.formData();
      const obj: Record<string, unknown> = {};
      fd.forEach((val, key) => {
        if (typeof val === 'string') obj[key] = val;
      });
      return obj;
    } catch {
      return {};
    }
  }

  const rawText = await req.text();
  const trimmed = rawText.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Repair Apple Shortcuts empty Number variable syntax: e.g. {"steps": } -> {"steps": null}
      try {
        const repaired = trimmed
          .replace(/:\s*(?=[,}])/g, ': null')
          .replace(/,\s*(?=[}])/g, '');
        const parsedRepaired = JSON.parse(repaired);
        if (parsedRepaired && typeof parsedRepaired === 'object' && !Array.isArray(parsedRepaired)) {
          return parsedRepaired as Record<string, unknown>;
        }
      } catch {
        // Fall through to structured error
      }
      throw new StepSyncError(
        'รูปแบบ JSON ไม่ถูกต้อง (ตรวจสอบฟิลด์ steps ในคำสั่งลัด Apple Shortcuts)',
        400
      );
    }
  }

  if (trimmed.includes('=')) {
    const params = new URLSearchParams(trimmed);
    const obj: Record<string, unknown> = {};
    params.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  }

  // Plain text number body fallback (e.g. body = "8450")
  return { steps: trimmed };
}

export async function POST(req: Request) {
  let respHeaders: Record<string, string> = EXTERNAL_CORS_HEADERS;
  try {
    const urlObj = new URL(req.url);
    const body = await parseFlexibleBody(req);

    const bodyKeyMatch = findBodyKeyCaseInsensitive(body, SYNC_KEY_ALIASES);
    const paramKeyMatch = findParamCaseInsensitive(urlObj.searchParams, SYNC_KEY_ALIASES);
    const rawSyncKey =
      (bodyKeyMatch.found && typeof bodyKeyMatch.value === 'string'
        ? bodyKeyMatch.value.trim()
        : '') ||
      (paramKeyMatch.found ? paramKeyMatch.value.trim() : '') ||
      extractHeaderSyncKey(req);

    let targetUserId = 0;
    let isExternalKeyAuth = false;

    if (rawSyncKey) {
      const user = await findUserBySyncKey(rawSyncKey);
      if (!user) {
        return NextResponse.json(
          {
            success: false,
            error: 'รหัส Sync Key ไม่ถูกต้อง หรือถูกเปลี่ยนใหม่แล้ว กรุณาคัดลอกรหัสล่าสุดจากหน้าเว็บ',
          },
          { status: 401, headers: EXTERNAL_CORS_HEADERS }
        );
      }
      targetUserId = Number(user.id);
      isExternalKeyAuth = true;
      respHeaders = EXTERNAL_CORS_HEADERS;
    } else if (body.userId) {
      respHeaders = INTERNAL_HEADERS;
      if (!isSameOriginRequest(req)) {
        return NextResponse.json(
          { success: false, error: 'ไม่อนุญาตให้เรียกใช้งานข้ามโดเมนโดยไม่ระบุ Sync Key' },
          { status: 403, headers: INTERNAL_HEADERS }
        );
      }
      const reqUid = Number(body.userId);
      const isSelf = Boolean(body.isSelf);
      const pinCode = body.pinCode !== undefined ? String(body.pinCode) : '';
      const uRes = await turso.execute({
        sql: `SELECT id, pin_code FROM users WHERE id = ? LIMIT 1`,
        args: [reqUid],
      });
      if (uRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'ไม่พบผู้เล่นนี้ในระบบ' },
          { status: 404, headers: INTERNAL_HEADERS }
        );
      }
      if (!isSelf && String(uRes.rows[0].pin_code) !== pinCode) {
        return NextResponse.json(
          { success: false, error: 'รหัส PIN ไม่ถูกต้อง!' },
          { status: 401, headers: INTERNAL_HEADERS }
        );
      }
      targetUserId = reqUid;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'กรุณาระบุรหัส Sync Key (?key=wc_... หรือส่ง syncKey ใน JSON)',
        },
        { status: 401, headers: EXTERNAL_CORS_HEADERS }
      );
    }

    const bodyStepsMatch = findBodyKeyCaseInsensitive(body, STEPS_KEY_ALIASES);
    const paramStepsMatch = findParamCaseInsensitive(urlObj.searchParams, STEPS_KEY_ALIASES);

    let rawStepsInput: unknown = bodyStepsMatch.found
      ? bodyStepsMatch.value
      : paramStepsMatch.found
      ? paramStepsMatch.value
      : undefined;

    if (rawStepsInput === undefined && isExternalKeyAuth) {
      const unknownKeys = Object.keys(body).filter(
        (k) => !META_KEY_ALIASES.has(k.trim().toLowerCase())
      );
      if (unknownKeys.length === 0) {
        // Apple Shortcuts omitted the steps key because Sum of 0 samples evaluated to nil -> treat as 0 steps
        rawStepsInput = '';
      } else {
        return NextResponse.json(
          {
            success: false,
            error: `ไม่พบฟิลด์ steps ในข้อมูลที่ส่งมา (พบฟิลด์: ${unknownKeys.join(', ')}) กรุณาตั้งชื่อฟิลด์เป็น steps`,
          },
          { status: 400, headers: respHeaders }
        );
      }
    }

    const parsedSteps = parseStepsValue(rawStepsInput, isExternalKeyAuth);
    if (!parsedSteps.ok) {
      return NextResponse.json(
        { success: false, error: parsedSteps.error },
        { status: 400, headers: respHeaders }
      );
    }

    const validSources = new Set<StepSyncSource>([
      'apple_shortcut',
      'ocr_screenshot',
      'web_daily_sync',
      'manual_add',
      'manual_set',
    ]);
    const source: StepSyncSource = isExternalKeyAuth
      ? 'apple_shortcut'
      : typeof body.source === 'string' && validSources.has(body.source as StepSyncSource)
      ? (body.source as StepSyncSource)
      : 'web_daily_sync';

    const seasonId = Number(body.seasonId || urlObj.searchParams.get('seasonId') || 0);
    const note = typeof body.note === 'string' ? body.note.slice(0, 140) : undefined;

    const result = await recordStepsWithRewards({
      userId: targetUserId,
      mode: 'daily_sync',
      stepsInput: parsedSteps.steps,
      seasonId: seasonId > 0 ? seasonId : undefined,
      source,
      note,
      broadcastServerRealtime: isExternalKeyAuth,
    });

    return NextResponse.json(result, { headers: respHeaders });
  } catch (error) {
    if (error instanceof StepSyncError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status, headers: respHeaders }
      );
    }
    console.error('POST /api/health-sync error:', error);
    return NextResponse.json(
      { success: false, error: 'ซิงก์ข้อมูลก้าวเดินไม่สำเร็จ' },
      { status: 500, headers: respHeaders }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json(
        { error: 'ไม่อนุญาตให้สุ่มรหัส Sync Key ข้ามโดเมน' },
        { status: 403, headers: INTERNAL_HEADERS }
      );
    }

    const body = await req.json();
    const userId = Number(body.userId || 0);
    const isSelf = Boolean(body.isSelf);
    const pinCode = body.pinCode !== undefined ? String(body.pinCode) : '';

    if (!userId || userId <= 0) {
      return NextResponse.json(
        { error: 'กรุณาระบุตัวละคร' },
        { status: 400, headers: INTERNAL_HEADERS }
      );
    }

    const uRes = await turso.execute({
      sql: `SELECT id, pin_code FROM users WHERE id = ? LIMIT 1`,
      args: [userId],
    });
    if (uRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบผู้เล่นนี้ในระบบ' },
        { status: 404, headers: INTERNAL_HEADERS }
      );
    }
    if (!isSelf && String(uRes.rows[0].pin_code) !== pinCode) {
      return NextResponse.json(
        { error: 'รหัส PIN ไม่ถูกต้อง!' },
        { status: 401, headers: INTERNAL_HEADERS }
      );
    }

    const nextKey = await rotateUserSyncKey(userId);
    return NextResponse.json(
      {
        success: true,
        syncKey: nextKey,
      },
      { headers: INTERNAL_HEADERS }
    );
  } catch (error) {
    if (error instanceof StepSyncError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: INTERNAL_HEADERS }
      );
    }
    console.error('PATCH /api/health-sync error:', error);
    return NextResponse.json(
      { error: 'สุ่มเปลี่ยนรหัส Sync Key ไม่สำเร็จ' },
      { status: 500, headers: INTERNAL_HEADERS }
    );
  }
}
