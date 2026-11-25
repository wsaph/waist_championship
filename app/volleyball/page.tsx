import type { Metadata } from 'next';
import { PikachuVolleyballGame } from '@/games/volleyball/2d/PikachuCanvasVolleyball';

export const metadata: Metadata = {
  title: 'Pikachu Chibi Volleyball 2D Online (1v1 & 2v2)',
  description:
    'เว็บเกมวอลเลย์บอลชายหาด 2D แนว Pikachu Volleyball รองรับ 1v1 และ 2v2 ออนไลน์แบบลื่นไหล 60 FPS ด้วย HTML5 Canvas และ Supabase Realtime',
};

export default function VolleyballPage() {
  return <PikachuVolleyballGame />;
}
