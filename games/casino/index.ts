import dynamic from 'next/dynamic';
import type { GameModalHostProps, GameModule } from '../types';

const DynamicCasinoModalHost = dynamic<GameModalHostProps>(
  () => import('./ModalHost').then((m) => m.CasinoModalHost),
  { ssr: false }
);

export const casinoGameModule: GameModule = {
  definition: {
    id: 'casino',
    nameTh: 'คาสิโนพี่ยาม (ป๊อกเด้ง / แบล็คแจ็ค / โป๊กเกอร์ / อีแก่)',
    shortNameTh: 'วงไพ่',
    emoji: '🃏',
    defaultRoomCode: '9999',
    defaultMode: 'pokdeng',
    realtimeEvent: 'card_lobby',
    pairActivityAnimType: 'play_cards',
    busyStatusLabel: '🃏 กำลังตั้งวงไพ่กับพี่ยาม...',
    singleSessionLock: true,
    proximitySource: 'guard',
    bannerBorderClass: 'border-yellow-300',
    proximityBtnClass:
      'bg-gradient-to-r from-emerald-500 via-teal-400 to-yellow-300 text-slate-950 border-2 border-white',
    proximityIdleText: 'ตั้งวงไพ่เจ้ามือพี่ยาม',
    proximitySubText: '(ป๊อกเด้ง / แบล็คแจ็ค / โป๊กเกอร์ / อีแก่!)',
    rewardWinTitleTh: 'ชนะวงไพ่พี่ยาม!',
  },
  ModalComponent: DynamicCasinoModalHost,
};

export * from './modes';
