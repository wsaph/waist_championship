import { handleTaekwondoGet, handleTaekwondoPost } from '@/games/taekwondo/server';

export const dynamic = 'force-dynamic';

export const GET = handleTaekwondoGet;
export const POST = handleTaekwondoPost;
