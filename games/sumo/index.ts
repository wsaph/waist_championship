import dynamic from 'next/dynamic';
import type { GameModalHostProps, GameModule } from '../types';
import { createSumoIslandZone } from './islandZone3d';

const DynamicSumoModalHost = dynamic<GameModalHostProps>(
  () => import('./ModalHost').then((m) => m.SumoModalHost),
  { ssr: false }
);

export const sumoGameModule: GameModule = {
  definition: {
    id: 'sumo',
    nameTh: 'สังเวียนซูโม่ฮอกไกโด',
    shortNameTh: 'ซูโม่',
    emoji: '🏯',
    defaultRoomCode: 'SUMO',
    realtimeEvent: 'sumo_lobby',
    busyStatusLabel: '🏯 กำลังประลองในสังเวียนซูโม่...',
    singleSessionLock: true,
    proximitySource: 'own_zone',
    bannerBorderClass: 'border-amber-300',
    proximityBtnClass:
      'bg-gradient-to-r from-purple-900 via-red-700 to-amber-500 text-amber-100 border-2 border-amber-200 animate-bounce',
    proximityIdleText: 'ขึ้นสังเวียนซูโม่',
    proximitySubText: '(ชนพุงดันตกเวที 1v1 / ไต่ยศโยโกซึนะ!)',
    rewardWinTitleTh: 'ชนะสังเวียนซูโม่!',
  },
  createIslandZone: createSumoIslandZone,
  ModalComponent: DynamicSumoModalHost,
};

export * from './catalog';
