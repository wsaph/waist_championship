import type { Metadata } from 'next';
import { PenaltyShootoutGame } from '@/components/PenaltyShootoutGame';

export const metadata: Metadata = {
  title: '3D Penalty Shootout Online 1v1 — ดวลจุดโทษ 3 มิติ',
  description:
    'เว็บเกมดวลจุดโทษ 3 มิติ ออนไลน์ 1v1 มุมกล้องสไตล์ PES เล็ง 6 โซน หยุดแถบพลังยิง รองรับโมเดล .glb เล่นได้ทั้งคอมพิวเตอร์ iPad และมือถือ',
};

export default function PenaltyShootoutPage() {
  return <PenaltyShootoutGame />;
}
