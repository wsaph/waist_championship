import { NextResponse } from 'next/server';
import {
  DIVINATION_METHODS,
  FORTUNE_TOPICS,
  buildFallbackFortuneReading,
  type DivinationMethodId,
  type FortuneTopicId,
} from '@/lib/fortune_teller';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

// Light anti-double-click rate guard
const recentRequestAtByKey = new Map<string, number>();
const COOLDOWN_MS = 2500;

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
    const rawMethod = String(body.methodId ?? 'tarot').trim() as DivinationMethodId;
    const rawTopic = String(body.topicId ?? 'overall').trim() as FortuneTopicId;
    const question = String(body.question ?? '').trim().slice(0, 240);
    const artifactSummary = String(body.artifactSummary ?? '').trim().slice(0, 500);
    const playerName = String(body.playerName ?? '').trim().slice(0, 50);

    const method = DIVINATION_METHODS.find((m) => m.id === rawMethod) || DIVINATION_METHODS[0];
    const topic = FORTUNE_TOPICS.find((t) => t.id === rawTopic) || FORTUNE_TOPICS[4];

    if (!question) {
      return NextResponse.json(
        { error: 'กรุณาพิมพ์คำถามที่อยากถามแม่หมอก่อนดูดวงนะครับ' },
        { status: 400 }
      );
    }

    if (!artifactSummary) {
      return NextResponse.json(
        { error: 'กรุณากดสุ่มเสี่ยงทายด้านบนให้เสร็จก่อนดูคำทำนายนะครับ' },
        { status: 400 }
      );
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const guardKey = `${clientIp}:${playerName || 'anon'}`;
    const now = Date.now();
    const prevAt = recentRequestAtByKey.get(guardKey) || 0;
    if (now - prevAt < COOLDOWN_MS) {
      return NextResponse.json(
        { error: 'รอสักครู่นะจ๊ะ แม่หมอกำลังอ่านดวงให้อยู่ 🔮' },
        { status: 429 }
      );
    }
    recentRequestAtByKey.set(guardKey, now);
    if (recentRequestAtByKey.size > 500) {
      for (const [k, ts] of recentRequestAtByKey.entries()) {
        if (now - ts > 60_000) recentRequestAtByKey.delete(k);
      }
    }

    const fallback = buildFallbackFortuneReading({
      methodId: method.id,
      topicId: topic.id,
      question,
      artifactSummary,
      playerName,
    });

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json(fallback);
    }

    const prompt = `คุณคือ "แม่หมอจันทรา" หมอดูใจดี พูดภาษาไทยเข้าใจง่ายมากๆ เป็นกันเอง ตอบตรงคำถาม ชัดเจน ไม่อ้อมค้อม ไม่ใช้ศัพท์ยากหรือคำโบราณซับซ้อน

ข้อมูลของผู้ที่มาดูดวง:
- ชื่อผู้ถาม: ${playerName || 'ผู้กล้า'}
- วิธีดูดวงที่เลือก: ${method.name}
- ผลที่สุ่มจับได้: ${artifactSummary}
- หมวดเรื่อง: ${topic.label}
- คำถามที่ถาม: "${question}"

กติกาการตอบ (สำคัญมาก):
1. ตอบ "คำถามที่ถาม" ให้ตรงประเด็นที่สุด โดยแปลความหมายจาก "ผลที่สุ่มจับได้" ออกมาเป็นภาษาพูดธรรมดาที่คนทั่วไปอ่านปุ๊บเข้าใจทันที
2. ห้ามใช้คำราชาศัพท์ คำกลอนซับซ้อน หรือคำพูดกำกวมชวนงง
3. ถ้าผลเสี่ยงทายออกมาแนวเตือน ให้เตือนอย่างสร้างสรรค์เข้าใจง่าย และบอกวิธีรับมือตรงๆ ไม่ทักเรื่องร้ายน่ากลัว
4. ตอบเป็น JSON เท่านั้น ตามโครงสร้างนี้:
{
  "headline": "สรุปคำตอบสั้นๆ ฟันธงเข้าใจง่ายใน 1 ประโยค (ไม่เกิน 65 ตัวอักษร)",
  "reading": "คำอธิบายดวงแบบเข้าใจง่ายๆ เชื่อมผลที่ได้เข้ากับคำถามที่ถามโดยตรง ประมาณ 3-4 ประโยคสั้นๆ (ไม่เกิน 420 ตัวอักษร)",
  "advice": "ต้องทำตัวยังไงหรือระวังอะไรต่อจากนี้ บอกเป็นข้อแนะนำทำตามได้จริง 1-2 ประโยค (ไม่เกิน 160 ตัวอักษร)",
  "luckyColor": "สีนำโชคเข้าใจง่าย เช่น สีฟ้าสดใส, สีเหลือง, สีชมพู",
  "luckyNumbers": "เลขนำโชค 2 ชุด เช่น 19, 42",
  "starRating": 4
}
หมายเหตุ: starRating ต้องเป็นตัวเลขจำนวนเต็มตั้งแต่ 3 ถึง 5 เท่านั้น`;

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
                temperature: 0.65,
                maxOutputTokens: 550,
                responseMimeType: 'application/json',
              },
            }),
            signal: AbortSignal.timeout(11000),
          }
        );

        if (!res.ok) continue;
        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || '')
            .join('') || '';
        const parsed = extractJson(text);
        if (parsed && typeof parsed.reading === 'string' && parsed.reading.trim()) {
          const rawStars = Number(parsed.starRating ?? fallback.starRating);
          const starRating = Number.isFinite(rawStars)
            ? Math.max(1, Math.min(5, Math.round(rawStars)))
            : fallback.starRating;
          return NextResponse.json({
            headline:
              typeof parsed.headline === 'string' && parsed.headline.trim()
                ? parsed.headline.trim().slice(0, 120)
                : fallback.headline,
            reading: parsed.reading.trim().slice(0, 700),
            advice:
              typeof parsed.advice === 'string' && parsed.advice.trim()
                ? parsed.advice.trim().slice(0, 260)
                : fallback.advice,
            luckyColor:
              typeof parsed.luckyColor === 'string' && parsed.luckyColor.trim()
                ? parsed.luckyColor.trim().slice(0, 60)
                : fallback.luckyColor,
            luckyNumbers:
              typeof parsed.luckyNumbers === 'string' && parsed.luckyNumbers.trim()
                ? parsed.luckyNumbers.trim().slice(0, 40)
                : fallback.luckyNumbers,
            starRating,
            source: 'gemini',
          });
        }
      } catch {
        // Try next Gemini model candidate
      }
    }

    return NextResponse.json(fallback);
  } catch (err) {
    console.error('POST /api/fortune error:', err);
    return NextResponse.json({ error: 'ระบบดูดวงขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
