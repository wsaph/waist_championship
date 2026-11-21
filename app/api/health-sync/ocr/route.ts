import { NextResponse } from 'next/server';
import { getTodaySyncStatus, parseStepsValue } from '@/lib/health_sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

interface ModelCandidate {
  model: string;
  thinkingConfig?: Record<string, unknown>;
}

const DEFAULT_GEMINI_CANDIDATES: ModelCandidate[] = [
  { model: 'gemini-flash-lite-latest', thinkingConfig: { thinkingLevel: 'MINIMAL' } },
  { model: 'gemini-3.5-flash-lite', thinkingConfig: { thinkingLevel: 'MINIMAL' } },
  { model: 'gemini-3.1-flash-lite', thinkingConfig: { thinkingBudget: 0 } },
  { model: 'gemini-3.8-flash', thinkingConfig: { thinkingLevel: 'LOW' } },
  { model: 'gemini-3.7-flash', thinkingConfig: { thinkingLevel: 'LOW' } },
  { model: 'gemini-flash-latest' },
];

const OCR_PROMPT = `You are an OCR assistant for a step-counting fitness challenge app.
Analyze this screenshot from a mobile health/fitness app, widget, or smartwatch app (such as Apple Health, Google Health Connect, Samsung Health, Google Fit, Huawei Health, Zepp / Mi Fitness, Garmin Connect, Fitbit, Strava, or similar).

Extract the user's ACTUAL TOTAL step count for a SINGLE day (preferably Today / วันนี้ / the currently selected single day).

CRITICAL RULES:
1. DO NOT extract the step goal/target (e.g., if screen shows "8,452 / 10,000 ก้าว" or "Goal 6,000", extract 8452, NOT 10000 or 6000).
2. DO NOT extract clock time (e.g. 16:42), battery percentage, calories (kcal/แคล), distance (km/กม.), heart rate (bpm), active minutes, floors, or weight.
3. DO NOT extract weekly, monthly, 6-month, or yearly totals OR multi-day averages (e.g. "AVERAGE / เฉลี่ย" on W / M / 6M / Y tabs in Apple Health). If ONLY a multi-day total or multi-day average is shown without Today's single-day step total, set "steps" to null and explain in Thai in "reason".
4. If the screen shows BOTH Today's total steps at the top AND smaller hourly/session sub-entries below (such as in Google Health Connect or Apple Health), extract Today's TOTAL steps, NOT a single sub-entry.
5. If the image does NOT contain a single-day step count at all, set "steps" to null and explain briefly in Thai in "reason".
6. "steps" must be a non-negative integer or null.

Respond strictly in JSON matching this schema:
{
  "steps": number | null,
  "appName": string,
  "dateHint": string,
  "reason": string
}`;

function normalizeMimeType(rawMime: string): string {
  const lower = rawMime.trim().toLowerCase();
  if (lower === 'image/jpg') return 'image/jpeg';
  return lower;
}

function detectImageMimeType(headerBuf: Buffer, declaredMime: string, fileName = ''): string {
  if (headerBuf.length >= 12) {
    if (headerBuf[0] === 0xff && headerBuf[1] === 0xd8 && headerBuf[2] === 0xff) {
      return 'image/jpeg';
    }
    if (
      headerBuf[0] === 0x89 &&
      headerBuf[1] === 0x50 &&
      headerBuf[2] === 0x4e &&
      headerBuf[3] === 0x47
    ) {
      return 'image/png';
    }
    if (
      headerBuf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      headerBuf.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
    if (headerBuf.subarray(4, 8).toString('ascii') === 'ftyp') {
      const brand = headerBuf.subarray(8, 12).toString('ascii').toLowerCase();
      if (brand === 'mif1' || brand === 'msf1' || brand === 'heif') {
        return 'image/heif';
      }
      if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') {
        return 'image/heic';
      }
    }
  }

  const normDeclared = normalizeMimeType(declaredMime);
  if (ALLOWED_MIMES.has(normDeclared)) {
    return normDeclared;
  }

  const ext = fileName.trim().toLowerCase().split('.').pop() || '';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';

  return normDeclared || 'image/jpeg';
}

function extractJsonObject(rawText: string): Record<string, unknown> | null {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const sub = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
          return sub as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ (หากรันบน Vercel กรุณาเพิ่ม Environment Variable ชื่อ GEMINI_API_KEY แล้วกด Redeploy)',
        },
        { status: 503 }
      );
    }

    let base64Data = '';
    let mimeType = 'image/jpeg';
    let userId = 0;
    let seasonId = 0;

    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = (formData.get('file') || formData.get('image')) as File | null;
      userId = Number(formData.get('userId') || 0);
      seasonId = Number(formData.get('seasonId') || 0);
      if (!file || typeof file.arrayBuffer !== 'function') {
        return NextResponse.json(
          { success: false, error: 'กรุณาแนบไฟล์รูปภาพแคปหน้าจอแอปสุขภาพ' },
          { status: 400 }
        );
      }
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'ไฟล์รูปภาพใหญ่เกินไป (จำกัดไม่เกิน 8MB)' },
          { status: 413 }
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      mimeType = detectImageMimeType(buf.subarray(0, 32), file.type || '', file.name || '');
      base64Data = buf.toString('base64');
    } else {
      const body = await req.json();
      userId = Number(body.userId || 0);
      seasonId = Number(body.seasonId || 0);
      const rawImg = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
      const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
      if (!rawImg) {
        return NextResponse.json(
          { success: false, error: 'กรุณาแนบรูปภาพแคปหน้าจอแอปสุขภาพ' },
          { status: 400 }
        );
      }
      let declaredMime = typeof body.mimeType === 'string' ? body.mimeType.trim() : '';
      const dataUrlMatch = rawImg.match(/^data:([a-zA-Z0-9.+/-]+);base64,([\s\S]+)$/);
      if (dataUrlMatch) {
        declaredMime = dataUrlMatch[1];
        base64Data = dataUrlMatch[2].replace(/\s+/g, '');
      } else {
        base64Data = rawImg.replace(/\s+/g, '');
      }
      const headerBuf = Buffer.from(base64Data.slice(0, 64), 'base64');
      mimeType = detectImageMimeType(headerBuf, declaredMime, fileName);
    }

    if (!base64Data || base64Data.length < 32) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลรูปภาพไม่ถูกต้องหรือว่างเปล่า' },
        { status: 400 }
      );
    }
    if (base64Data.length > 11_000_000) {
      return NextResponse.json(
        { success: false, error: 'ขนาดรูปภาพใหญ่เกินไป กรุณาย่อรูปหรือเลือกภาพแคปหน้าจอใหม่' },
        { status: 413 }
      );
    }
    if (!ALLOWED_MIMES.has(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'รองรับเฉพาะไฟล์รูปภาพ PNG, JPG, WEBP หรือ HEIC เท่านั้น',
        },
        { status: 400 }
      );
    }

    const customModel = (process.env.GEMINI_MODEL || '').trim().replace(/^models\//, '');
    const modelCandidates: ModelCandidate[] = [
      ...(customModel ? [{ model: customModel }] : []),
      ...DEFAULT_GEMINI_CANDIDATES,
    ];

    let parsedJson: Record<string, unknown> | null = null;
    let usedModel = '';
    let lastErrorDetail = '';
    const deadlineMs = Date.now() + 26000;

    for (const candidate of modelCandidates) {
      const remainingMs = deadlineMs - Date.now();
      if (remainingMs < 1500) break;

      const modelName = candidate.model;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(6500, remainingMs));
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelName
        )}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const geminiRes = await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: OCR_PROMPT },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
              ...(candidate.thinkingConfig ? { thinkingConfig: candidate.thinkingConfig } : {}),
            },
          }),
        });

        const rawBody = await geminiRes.text();
        if (!geminiRes.ok) {
          let apiErrMsg = rawBody.slice(0, 200);
          try {
            const errObj = JSON.parse(rawBody);
            apiErrMsg = String(errObj?.error?.message || apiErrMsg);
          } catch {
            // keep raw slice
          }
          lastErrorDetail = `${modelName} (${geminiRes.status}): ${apiErrMsg}`;

          // Fatal API key error -> stop immediately instead of retrying 6 models
          if (
            geminiRes.status === 403 ||
            (geminiRes.status === 400 && /api[_ ]?key/i.test(apiErrMsg))
          ) {
            return NextResponse.json(
              {
                success: false,
                error: 'รหัส GEMINI_API_KEY ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน กรุณาตรวจสอบค่าใน Environment Variables',
              },
              { status: 502 }
            );
          }
          continue;
        }

        const data = JSON.parse(rawBody);
        const rawParts: Array<{ text?: string; thought?: boolean }> =
          data?.candidates?.[0]?.content?.parts || [];
        const textPart = rawParts
          .filter((p) => !p?.thought && typeof p?.text === 'string')
          .map((p) => p.text || '')
          .join('\n')
          .trim();

        if (!textPart) {
          lastErrorDetail = `${modelName}: empty candidate response`;
          continue;
        }

        const candidateObj = extractJsonObject(textPart);
        if (!candidateObj) {
          lastErrorDetail = `${modelName}: invalid JSON output`;
          continue;
        }

        parsedJson = candidateObj;
        usedModel = modelName;
        break;
      } catch (err) {
        lastErrorDetail = `${modelName}: ${err instanceof Error ? err.message : 'network error'}`;
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!parsedJson) {
      console.error('Gemini OCR failed across all models:', lastErrorDetail);
      return NextResponse.json(
        {
          success: false,
          error:
            'ระบบ AI อ่านรูปภาพขัดข้องชั่วคราว (เซิร์ฟเวอร์ Gemini คิวเต็ม) กรุณากดลองใหม่อีกครั้งหรือพิมพ์ตัวเลขก้าวเองได้เลยครับ',
        },
        { status: 503 }
      );
    }

    const rawStepsVal = parsedJson.steps;
    const reasonText = typeof parsedJson.reason === 'string' ? parsedJson.reason.trim() : '';
    const appName = typeof parsedJson.appName === 'string' ? parsedJson.appName.trim().slice(0, 50) : '';
    const dateHint = typeof parsedJson.dateHint === 'string' ? parsedJson.dateHint.trim().slice(0, 40) : '';

    if (rawStepsVal === null || rawStepsVal === undefined || rawStepsVal === '') {
      return NextResponse.json(
        {
          success: false,
          error:
            reasonText ||
            'ไม่พบตัวเลขก้าวเดินรายวันในรูปภาพนี้ กรุณาใช้ภาพแคปหน้าจอแอปสุขภาพที่แสดงยอดก้าวของวันนี้ชัดเจน',
        },
        { status: 422 }
      );
    }

    const stepCheck = parseStepsValue(rawStepsVal, false);
    if (!stepCheck.ok || stepCheck.steps < 0 || stepCheck.steps > 300000) {
      return NextResponse.json(
        {
          success: false,
          error:
            reasonText ||
            'ตัวเลขก้าวเดินที่อ่านได้ไม่อยู่ในเกณฑ์รายวัน (0 – 300,000 ก้าว) กรุณาใช้ภาพหน้าสรุปยอดก้าวของวันนี้',
        },
        { status: 422 }
      );
    }

    let todaySyncedSteps = 0;
    if (userId > 0) {
      try {
        const status = await getTodaySyncStatus(userId, seasonId > 0 ? seasonId : undefined);
        todaySyncedSteps = status.todaySyncedSteps;
      } catch {
        // ignore if user lookup fails during OCR preview
      }
    }

    const estimatedDelta = Math.max(0, stepCheck.steps - todaySyncedSteps);

    return NextResponse.json({
      success: true,
      steps: stepCheck.steps,
      appName,
      dateHint,
      todaySyncedSteps,
      estimatedDelta,
      model: usedModel,
    });
  } catch (error) {
    console.error('POST /api/health-sync/ocr error:', error);
    return NextResponse.json(
      { success: false, error: 'อ่านตัวเลขก้าวจากรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
