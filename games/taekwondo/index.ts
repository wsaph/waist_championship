import dynamic from 'next/dynamic';
import type { GameModalHostProps, GameModule } from '../types';
import { createTaekwondoIslandZone } from './islandZone3d';

const DynamicTaekwondoModalHost = dynamic<GameModalHostProps>(
  () => import('./ModalHost').then((m) => m.TaekwondoModalHost),
  { ssr: false }
);

export const taekwondoGameModule: GameModule = {
  definition: {
    id: 'taekwondo',
    nameTh: 'สำนักเทควันโด Dojang',
    shortNameTh: 'เทควันโด',
    emoji: '🥋',
    defaultRoomCode: 'DOJO',
    realtimeEvent: 'tkd_lobby',
    busyStatusLabel: '🥋 กำลังฝึกในสำนักเทควันโด...',
    singleSessionLock: true,
    proximitySource: 'own_zone',
    bannerBorderClass: 'border-sky-400',
    proximityBtnClass:
      'bg-gradient-to-r from-red-600 via-amber-400 to-blue-600 text-white border-2 border-white',
    proximityIdleText: 'สำนักเทควันโด',
    proximitySubText: '(เตะเป้าเลื่อนสาย & ดวล PvP!)',
    rewardWinTitleTh: 'เลื่อนสายเทควันโด!',
  },
  createIslandZone: createTaekwondoIslandZone,
  ModalComponent: DynamicTaekwondoModalHost,
};

export * from './catalog';
