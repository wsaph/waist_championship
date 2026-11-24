import { dispatchFestivalGet, dispatchFestivalPost } from '@/festivals/server';
import { LOY_KRATHONG_FESTIVAL_ID } from '@/festivals/loy-krathong/catalog';

export async function GET(req: Request) {
  return dispatchFestivalGet(LOY_KRATHONG_FESTIVAL_ID, req);
}

export async function POST(req: Request) {
  return dispatchFestivalPost(LOY_KRATHONG_FESTIVAL_ID, req);
}
