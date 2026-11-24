'use client';

import React from 'react';
import type { FestivalPlayerIdentity } from '../types';
import type { ActiveFestivalController } from '../useActiveFestival';

export function FestivalHeaderBadge({ festival }: { festival: ActiveFestivalController }) {
  const { definition, phase, isWorldActive, toggleFestivalMode } = festival;
  if (!definition || (phase !== 'live' && phase !== 'encore')) return null;

  const { hud } = definition;

  if (phase === 'live') {
    return (
      <button
        type="button"
        onClick={toggleFestivalMode}
        className={`border text-[9.5px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 cursor-pointer transition ${
          isWorldActive
            ? 'bg-indigo-950/90 border-amber-300 text-amber-200 shadow-[0_0_10px_rgba(253,224,71,0.45)]'
            : 'bg-black/45 border-slate-500 text-slate-200'
        }`}
        title={hud.liveToggleTitle}
      >
        <span>{isWorldActive ? hud.liveActiveIcon : hud.liveInactiveIcon}</span>
        <span>{isWorldActive ? hud.liveActiveLabel : hud.liveInactiveLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleFestivalMode}
      className={`border text-[9.5px] sm:text-[10.5px] font-extrabold px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 cursor-pointer transition ${
        isWorldActive
          ? 'bg-gradient-to-r from-indigo-950 via-purple-950 to-amber-950 border-amber-300 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
          : 'bg-gradient-to-r from-amber-300 via-pink-300 to-amber-200 border-white text-slate-950 shadow-[0_2px_0_#000] animate-pulse'
      }`}
      title={hud.encoreToggleTitle}
    >
      <span>{isWorldActive ? hud.encoreActiveIcon : hud.encoreInactiveIcon}</span>
      <span>{isWorldActive ? hud.encoreActiveLabel : hud.encoreInactiveLabel}</span>
    </button>
  );
}

export function FestivalMobileMenuItem({
  festival,
  onAfterToggle,
}: {
  festival: ActiveFestivalController;
  onAfterToggle?: () => void;
}) {
  const { definition, phase, isWorldActive, toggleFestivalMode } = festival;
  if (!definition || (phase !== 'live' && phase !== 'encore')) return null;

  const { hud } = definition;
  const icon = isWorldActive
    ? hud.mobileActiveIcon
    : phase === 'encore'
      ? hud.mobileEncoreInactiveIcon
      : hud.mobileLiveInactiveIcon;
  const label = isWorldActive
    ? hud.mobileActiveLabel
    : phase === 'encore'
      ? hud.mobileEncoreInactiveLabel
      : hud.mobileLiveInactiveLabel;

  return (
    <button
      type="button"
      onClick={() => {
        toggleFestivalMode();
        onAfterToggle?.();
      }}
      className="w-full text-left px-2.5 py-2 rounded-xl bg-indigo-950/90 border border-amber-300/40 text-amber-200 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function FestivalShoreActions({
  festival,
  isNearOcean,
  fishingPhase,
  isPairMenuOpen,
}: {
  festival: ActiveFestivalController;
  isNearOcean: boolean;
  fishingPhase: 'idle' | 'waiting' | 'bite' | 'reeling';
  isPairMenuOpen: boolean;
}) {
  const ShoreComp = festival.module?.ShoreActionsComponent;
  if (!ShoreComp || !festival.isWorldActive || festival.phase === 'ended') {
    return null;
  }

  return (
    <ShoreComp
      isNearOcean={isNearOcean}
      fishingPhase={fishingPhase}
      isPairMenuOpen={isPairMenuOpen}
      myItemsCount={festival.myItemsCount}
      onOpenModal={festival.openModal}
      onCycleMyItems={festival.cycleMyItems}
    />
  );
}

export function FestivalModalHost({
  festival,
  player,
  isMusicOn,
  onToggleMusic,
}: {
  festival: ActiveFestivalController;
  player: FestivalPlayerIdentity;
  isMusicOn: boolean;
  onToggleMusic: () => void;
}) {
  const ModalComp = festival.module?.ModalComponent;
  if (!ModalComp || !festival.isModalOpen) {
    return null;
  }

  return (
    <ModalComp
      isOpen={festival.isModalOpen}
      onClose={festival.closeModal}
      player={player}
      submitting={festival.submitting}
      isMusicOn={isMusicOn}
      onToggleMusic={onToggleMusic}
      onLaunch={festival.submitAction}
    />
  );
}
