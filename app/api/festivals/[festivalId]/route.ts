import { dispatchFestivalGet, dispatchFestivalPost } from '@/festivals/server';

export async function GET(
  req: Request,
  context: { params: Promise<{ festivalId: string }> }
) {
  const { festivalId } = await context.params;
  return dispatchFestivalGet(festivalId, req);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ festivalId: string }> }
) {
  const { festivalId } = await context.params;
  return dispatchFestivalPost(festivalId, req);
}
