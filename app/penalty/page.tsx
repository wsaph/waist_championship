import type { Metadata } from 'next';
import { PenaltyShootoutGame } from '@/games/soccer/SoccerArenaModal';

export const metadata: Metadata = {
  title: 'ศึกฟุตบอลโกลหนู 3v3 (สูงสุด 6 คน) & ดวลจุดโทษ 3D Online',
  description:
    'เว็บเกมสตรีทฟุตบอลอาร์เคด 3 มิติ โหมดโกลหนู 3v3 ปาร์ตี้ออนไลน์สูงสุด 6 คน บังคับตัวใครตัวมัน และโหมดดวลจุดโทษ 1v1 เล่นข้ามเครื่องได้ทั้งคอมพิวเตอร์ iPad และมือถือ',
};

export default function PenaltyShootoutPage() {
  return <PenaltyShootoutGame />;
}
