import dynamic from 'next/dynamic';
import type { FestivalModalProps, FestivalModule } from '../types';
import {
  LOY_KRATHONG_DEFINITION,
  type KrathongItem,
  type KrathongLaunchInput,
} from './catalog';
import { registerLoyKrathongBgm } from './bgm';
import { loyKrathongClientAdapter } from './clientAdapter';
import { createLoyKrathongFullMoonSky } from './sky3d';
import { createLoyKrathongSceneController } from './sceneController';
import { LoyKrathongShoreActions } from './LoyKrathongShoreActions';

const DynamicLoyKrathongModal = dynamic<FestivalModalProps<KrathongLaunchInput>>(
  () => import('./LoyKrathongModal').then((m) => m.LoyKrathongModal),
  { ssr: false }
);

export const loyKrathongFestivalModule: FestivalModule<KrathongItem, KrathongLaunchInput> = {
  definition: LOY_KRATHONG_DEFINITION,
  registerBgm: registerLoyKrathongBgm,
  clientAdapter: loyKrathongClientAdapter,
  createSkyController: createLoyKrathongFullMoonSky,
  createSceneController: createLoyKrathongSceneController,
  ShoreActionsComponent: LoyKrathongShoreActions,
  ModalComponent: DynamicLoyKrathongModal,
};

export * from './catalog';
export * from './krathong3d';
export * from './bgm';
export * from './sky3d';
export * from './sceneController';
export * from './LoyKrathongShoreActions';
