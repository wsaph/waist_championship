import dynamic from 'next/dynamic';
import type { GameModalHostProps, GameModule } from '../types';

const DynamicShabuModalHost = dynamic<GameModalHostProps>(
  () => import('./ModalHost').then((m) => m.ShabuModalHost),
  { ssr: false }
);

export const shabuGameModule: GameModule = {
  definition: {
    id: 'shabu',
    nameTh: 'ปาร์ตี้ชาบู Co-op',
    shortNameTh: 'หม้อชาบู',
    emoji: '🍲',
    defaultRoomCode: '5555',
    realtimeEvent: 'shabu_lobby',
    pairActivityAnimType: 'picnic_shabu',
    busyStatusLabel: '🍲 กำลังช่วยกันลวกชาบู...',
    singleSessionLock: true,
    proximitySource: 'food_stall',
    bannerBorderClass: 'border-rose-400',
    proximityBtnClass:
      'bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300 text-slate-950 border-2 border-white',
    proximityIdleText: 'เปิดหม้อชาบู Co-op',
    proximitySubText: '(เล่นกับเพื่อน 1–4 คน!)',
    rewardWinTitleTh: 'ปาร์ตี้ชาบูสำเร็จ!',
  },
  ModalComponent: DynamicShabuModalHost,
};

export * from './engine';
