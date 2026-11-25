import dynamic from 'next/dynamic';
import type { GameModalHostProps, GameModule } from '../types';
import { createSoccerIslandZone } from './islandZone3d';

const DynamicSoccerModalHost = dynamic<GameModalHostProps>(
  () => import('./ModalHost').then((m) => m.SoccerModalHost),
  { ssr: false }
);

export const soccerGameModule: GameModule = {
  definition: {
    id: 'soccer',
    nameTh: 'ฟุตบอล 3D (โกลหนู 3v3 & จุดโทษ)',
    shortNameTh: 'สนามบอล',
    emoji: '⚽',
    defaultRoomCode: '6666',
    defaultMode: '3v3',
    realtimeEvent: 'penalty_lobby',
    pairActivityAnimType: 'soccer_kick',
    busyStatusLabel: '⚽ กำลังดวลฟุตบอลโกลหนู 3D...',
    singleSessionLock: true,
    proximitySource: 'own_zone',
    bannerBorderClass: 'border-emerald-400',
    proximityBtnClass:
      'bg-gradient-to-r from-emerald-400 via-lime-300 to-amber-300 text-slate-950 border-2 border-white animate-bounce',
    proximityIdleText: 'สนามฟุตบอลโกลหนู 3D',
    proximitySubText: '(ปาร์ตี้โกลหนู 3v3 สูงสุด 6 คน & ดวลจุดโทษ!)',
    rewardWinTitleTh: 'ชนะศึกฟุตบอล 3D!',
  },
  createIslandZone: createSoccerIslandZone,
  ModalComponent: DynamicSoccerModalHost,
};

export * from './stats';
