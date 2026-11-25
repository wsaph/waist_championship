import dynamic from 'next/dynamic';
import type { GameModalHostProps, GameModule } from '../types';
import { createVolleyballIslandZone } from './islandZone3d';

const DynamicVolleyballModalHost = dynamic<GameModalHostProps>(
  () => import('./ModalHost').then((m) => m.VolleyballModalHost),
  { ssr: false }
);

export const volleyballGameModule: GameModule = {
  definition: {
    id: 'volleyball',
    nameTh: 'วอลเลย์บอลชายหาด 3D',
    shortNameTh: 'วอลเลย์',
    emoji: '🏐',
    defaultRoomCode: '7777',
    defaultMode: '2v2',
    realtimeEvent: 'vb_lobby',
    pairActivityAnimType: 'volleyball',
    busyStatusLabel: '🏐 กำลังตีวอลเลย์บอล...',
    singleSessionLock: true,
    proximitySource: 'own_zone',
    bannerBorderClass: 'border-amber-300',
    proximityBtnClass:
      'bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 text-slate-950 border-2 border-white animate-bounce',
    proximityIdleText: 'เข้าสนามวอลเลย์บอล',
    proximitySubText: '(เข้าห้องรอตี้ 1v1 / 2v2!)',
    rewardWinTitleTh: 'ชนะวอลเลย์บอลชายหาด!',
  },
  createIslandZone: createVolleyballIslandZone,
  ModalComponent: DynamicVolleyballModalHost,
};

export * from './engine';
export * from './stats';
