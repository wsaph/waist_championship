'use client';

import React from 'react';
import Link from 'next/link';
import { PenaltyLeaderboardPanel } from '@/components/PenaltyShootoutGame';

export default function PenaltyLeaderboardPage() {
  return (
    <main className="min-h-dvh w-full bg-gradient-to-b from-sky-950 via-emerald-950 to-slate-950 py-6 px-3 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-start px-3 mb-3">
        <Link
          href="/penalty"
          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black shadow"
        >
          ← กลับไปหน้าเกมดวลจุดโทษ 3D
        </Link>
      </div>
      <PenaltyLeaderboardPanel />
    </main>
  );
}
