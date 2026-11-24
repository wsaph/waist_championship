'use client';

import React from 'react';
import type { FestivalShoreActionsProps } from '../types';

export function LoyKrathongShoreActions({
  isNearOcean,
  fishingPhase,
  isPairMenuOpen,
  myItemsCount,
  onOpenModal,
  onCycleMyItems,
}: FestivalShoreActionsProps) {
  return (
    <>
      {isNearOcean && !isPairMenuOpen && fishingPhase === 'idle' && (
        <button
          type="button"
          onClick={onOpenModal}
          className="neo-btn bg-gradient-to-r from-amber-300 via-pink-400 to-amber-300 text-slate-950 border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-[11.5px] sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full cursor-pointer shadow-[0_3px_0_#000] whitespace-nowrap"
        >
          🪷 ลอยกระทง<span className="hidden sm:inline">ริมหาด!</span>
        </button>
      )}
      {!isPairMenuOpen && myItemsCount > 0 && (
        <button
          type="button"
          onClick={onCycleMyItems}
          className="neo-btn bg-slate-900/95 hover:bg-slate-800 text-amber-200 border-2 border-amber-300 font-[family-name:var(--font-kanit)] font-extrabold text-[11px] sm:text-xs px-3 py-1.5 rounded-full cursor-pointer shadow-[0_3px_0_#000] whitespace-nowrap"
        >
          🔍 ส่องกระทงฉัน ({myItemsCount})
        </button>
      )}
    </>
  );
}
