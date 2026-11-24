import { assertActiveUserSession } from '@/lib/session_guard';
import { loyKrathongServerHandler } from './loy-krathong/server';
export { ensureFestivalSchemas, FESTIVAL_SCHEMA_INITIALIZERS } from './schema';

export interface FestivalServerHandler {
  festivalId: string;
  handleGet?: (req: Request) => Promise<Response>;
  handlePost?: (req: Request) => Promise<Response>;
}

export interface FestivalPostDispatchOptions {
  assertSession?: (
    req: Request,
    userId: number | null | undefined
  ) => Promise<Response | null>;
}

/**
 * Register API route handlers for seasonal festivals here (`GET/POST /api/festivals/[festivalId]`).
 * Register DB table schema initializers in `festivals/schema.ts`.
 */
export const FESTIVAL_SERVER_HANDLERS: readonly FestivalServerHandler[] = [
  loyKrathongServerHandler,
];

function findServerHandler(festivalId: string): FestivalServerHandler | undefined {
  const normalized = festivalId.trim().toLowerCase().replace(/-/g, '_');
  return FESTIVAL_SERVER_HANDLERS.find((h) => h.festivalId === normalized);
}

export async function dispatchFestivalGet(
  festivalId: string,
  req: Request
): Promise<Response> {
  const handler = findServerHandler(festivalId);
  if (!handler || !handler.handleGet) {
    return Response.json(
      { error: `ไม่พบข้อมูลเทศกาล "${festivalId}"` },
      { status: 404 }
    );
  }
  return handler.handleGet(req);
}

export async function dispatchFestivalPost(
  festivalId: string,
  req: Request,
  options?: FestivalPostDispatchOptions
): Promise<Response> {
  const handler = findServerHandler(festivalId);
  if (!handler || !handler.handlePost) {
    return Response.json(
      { error: `ไม่พบกิจกรรมเทศกาล "${festivalId}"` },
      { status: 404 }
    );
  }

  const sessionCheck = options?.assertSession ?? assertActiveUserSession;
  try {
    const peek = await req.clone().json();
    if (peek && typeof peek === 'object' && !Array.isArray(peek) && peek.userId) {
      const uid = Number(peek.userId);
      if (Number.isFinite(uid) && uid > 0) {
        const kickResp = await sessionCheck(req, uid);
        if (kickResp) return kickResp;
      }
    }
  } catch {
    // Let the festival POST handler return its standard 400 malformed JSON response
  }

  return handler.handlePost(req);
}
