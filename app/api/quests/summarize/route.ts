import { NextResponse } from 'next/server';
import { buildFallbackQuestSummary, QUEST_MIN_DURATION_DAYS } from '@/lib/quest_board';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

function extractJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const a = cleaned.indexOf('{');
    const b = cleaned.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        const parsed = JSON.parse(cleaned.slice(a, b + 1));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    const durationDays = Math.max(
      QUEST_MIN_DURATION_DAYS,
      Math.floor(Number(body.durationDays ?? QUEST_MIN_DURATION_DAYS) || QUEST_MIN_DURATION_DAYS)
    );

    if (!title && !description) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อหรือรายละเอียดเควสก่อน' }, { status: 400 });
    }

    const fallback = buildFallbackQuestSummary(title || 'เควสท้าทาย', description, durationDays);
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json({ ...fallback, source: 'fallback' });
    }

    const prompt = `คุณคือผู้ช่วยสรุปกติกาเควสในเกมออกกำลังกายและสุขภาพ (ภาษาไทย กระชับ อ่านง่าย สนุกแบบ RPG)
ช่วยสรุปเควสนี้ให้เพื่อนในกลุ่มเข้าใจตรงกันและตรวจผลตอนจบได้ง่าย:
- ชื่อเควส: ${title}
- รายละเอียด: ${description}
- ระยะเวลาขั้นต่ำ: ${durationDays} วัน

ตอบเป็น JSON เท่านั้น:
{
  "summary": "สรุปกติกาและเป้าหมายที่ชัดเจนใน 1-2 ประโยค (ไม่เกิน 180 ตัวอักษร)",
  "verificationTip": "แนะนำหลักฐานที่ควรส่งตอนจบเควสเพื่อให้เพื่อนโหวตตรวจได้ง่าย (ไม่เกิน 140 ตัวอักษร)"
}`;

    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 256,
                responseMimeType: 'application/json',
              },
            }),
            signal: AbortSignal.timeout(9000),
          }
        );

        if (!res.ok) continue;
        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || '')
            .join('') || '';
        const parsed = extractJson(text);
        if (parsed && typeof parsed.summary === 'string' && parsed.summary.trim()) {
          return NextResponse.json({
            summary: parsed.summary.trim().slice(0, 260),
            verificationTip:
              typeof parsed.verificationTip === 'string' && parsed.verificationTip.trim()
                ? parsed.verificationTip.trim().slice(0, 200)
                : fallback.verificationTip,
            source: 'gemini',
          });
        }
      } catch {
        // Try next candidate
      }
    }

    return NextResponse.json({ ...fallback, source: 'fallback' });
  } catch (err) {
    console.error('POST /api/quests/summarize error:', err);
    return NextResponse.json({ error: 'สรุปกติกาไม่สำเร็จ' }, { status: 500 });
  }
}
