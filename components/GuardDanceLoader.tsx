'use client';

import React, { useEffect, useState } from 'react';

interface GuardDanceStyle {
  id: string;
  title: string;
  badge: string;
  caption: string;
  bgClass: string;
  accentClass: string;
  bodyAnim: string;
  armLAnim: string;
  armRAnim: string;
  legLAnim: string;
  legRAnim: string;
  propTop?: string;
  propHandL?: string;
  propHandR?: string;
  bgEmojis: string[];
}

const GUARD_DANCE_STYLES: GuardDanceStyle[] = [
  {
    id: 'morlam',
    title: 'หมอลำซิ่งหน้าป้อม',
    badge: '🎤 MORLAM SING',
    caption: 'เอ้าโย่ว! พี่ยามกำลังจัดลู่วิ่งให้ผู้กล้าจ้าา~',
    bgClass: 'from-fuchsia-950 via-purple-950 to-amber-950',
    accentClass: 'border-amber-300 text-amber-300',
    bodyAnim: 'gd-morlam-body',
    armLAnim: 'gd-morlam-armL',
    armRAnim: 'gd-morlam-armR',
    legLAnim: 'gd-bounce-legL',
    legRAnim: 'gd-bounce-legR',
    propTop: '🌺',
    propHandL: '🎤',
    propHandR: '✨',
    bgEmojis: ['🎶', '✨', '💃', '🎺'],
  },
  {
    id: 'disco',
    title: 'ดิสโก้ฟีเวอร์ยุค 80',
    badge: '🪩 DISCO FEVER',
    caption: 'ดิสโก้เปิดสนาม! เตรียมสเต็ปเดินให้พร้อมเลย!',
    bgClass: 'from-indigo-950 via-violet-950 to-pink-950',
    accentClass: 'border-cyan-300 text-cyan-300',
    bodyAnim: 'gd-disco-body',
    armLAnim: 'gd-disco-armL',
    armRAnim: 'gd-disco-armR',
    legLAnim: 'gd-disco-legL',
    legRAnim: 'gd-disco-legR',
    propTop: '🪩',
    propHandL: '👉',
    propHandR: '☝️',
    bgEmojis: ['🪩', '⚡', '💜', '🌟'],
  },
  {
    id: 'robot',
    title: 'หุ่นยนต์ป๊อปปิ้ง',
    badge: '🤖 ROBOT POPPING',
    caption: 'กำลังโหลดระบบสนาม 3D... บี๊บๆ บู๊บๆ!',
    bgClass: 'from-slate-950 via-cyan-950 to-blue-950',
    accentClass: 'border-sky-300 text-sky-300',
    bodyAnim: 'gd-robot-body',
    armLAnim: 'gd-robot-armL',
    armRAnim: 'gd-robot-armR',
    legLAnim: 'gd-robot-legL',
    legRAnim: 'gd-robot-legR',
    propTop: '📡',
    propHandL: '🦾',
    propHandR: '⚙️',
    bgEmojis: ['🤖', '⚡', '💠', '🔋'],
  },
  {
    id: 'ballet',
    title: 'บัลเลต์สายพลิ้ว',
    badge: '🩰 SWAN BALLET',
    caption: 'พี่ยามขอวอร์มปลายเท้าแบบนุ่มนวลแป๊บนะ~',
    bgClass: 'from-rose-950 via-pink-950 to-slate-950',
    accentClass: 'border-pink-300 text-pink-200',
    bodyAnim: 'gd-ballet-body',
    armLAnim: 'gd-ballet-armL',
    armRAnim: 'gd-ballet-armR',
    legLAnim: 'gd-ballet-legL',
    legRAnim: 'gd-ballet-legR',
    propTop: '👑',
    propHandL: '🌸',
    propHandR: '🌸',
    bgEmojis: ['🩰', '🌸', '✨', '💫'],
  },
  {
    id: 'rock',
    title: 'ร็อกเกอร์หัวสั่น',
    badge: '🎸 HEAVY METAL',
    caption: 'ร็อกแอนด์โรล!! วิ่งให้ยับอย่าให้แพ้หมูกรอบ!',
    bgClass: 'from-zinc-950 via-red-950 to-orange-950',
    accentClass: 'border-orange-400 text-orange-300',
    bodyAnim: 'gd-rock-body',
    armLAnim: 'gd-rock-armL',
    armRAnim: 'gd-rock-armR',
    legLAnim: 'gd-bounce-legL',
    legRAnim: 'gd-bounce-legR',
    propTop: '🔥',
    propHandL: '🎸',
    propHandR: '🤘',
    bgEmojis: ['🔥', '⚡', '🎸', '💥'],
  },
  {
    id: 'salsa',
    title: 'ซัลซ่าลาตินไฟลุก',
    badge: '🌹 SALSA FIESTA',
    caption: 'อูลาล่า~ จังหวะนี้ต้องเบิร์นแคลอรี่แล้ว!',
    bgClass: 'from-red-950 via-amber-950 to-rose-950',
    accentClass: 'border-rose-300 text-rose-200',
    bodyAnim: 'gd-salsa-body',
    armLAnim: 'gd-salsa-armL',
    armRAnim: 'gd-salsa-armR',
    legLAnim: 'gd-disco-legL',
    legRAnim: 'gd-disco-legR',
    propTop: '🌹',
    propHandL: '🪇',
    propHandR: '🪇',
    bgEmojis: ['🌹', '🔥', '💃', '🌶️'],
  },
  {
    id: 'moonwalk',
    title: 'ราชาเพลงป๊อป มูนวอล์ค',
    badge: '🎩 MOONWALK KING',
    caption: 'ฮี๊~ฮี! ลื่นปรื๊ดๆ รอโหลดสนามแป๊บเดียว!',
    bgClass: 'from-slate-950 via-zinc-900 to-indigo-950',
    accentClass: 'border-yellow-200 text-yellow-200',
    bodyAnim: 'gd-moonwalk-body',
    armLAnim: 'gd-moonwalk-armL',
    armRAnim: 'gd-moonwalk-armR',
    legLAnim: 'gd-moonwalk-legL',
    legRAnim: 'gd-moonwalk-legR',
    propTop: '🎩',
    propHandL: '🧤',
    propHandR: '✨',
    bgEmojis: ['✨', '⭐', '🎵', '💫'],
  },
  {
    id: 'aerobic',
    title: 'แอโรบิกหน้าโลตัส',
    badge: '🏃 AEROBIC 90s',
    caption: 'หนึ่ง สอง ซั่ม! วอร์มอัพรอเข้าสนามกันหน่อย!',
    bgClass: 'from-emerald-950 via-teal-950 to-sky-950',
    accentClass: 'border-lime-300 text-lime-300',
    bodyAnim: 'gd-aerobic-body',
    armLAnim: 'gd-aerobic-armL',
    armRAnim: 'gd-aerobic-armR',
    legLAnim: 'gd-aerobic-legL',
    legRAnim: 'gd-aerobic-legR',
    propTop: '💦',
    propHandL: '🏋️',
    propHandR: '💪',
    bgEmojis: ['👟', '💦', '⚡', '🔥'],
  },
];

interface GuardDanceLoaderProps {
  visible: boolean;
}

export function GuardDanceLoader({ visible }: GuardDanceLoaderProps) {
  const [styleIdx, setStyleIdx] = useState<number>(0);
  const [mounted, setMounted] = useState<boolean>(true);

  useEffect(() => {
    setStyleIdx(Math.floor(Math.random() * GUARD_DANCE_STYLES.length));
  }, []);

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => setMounted(false), 420);
      return () => clearTimeout(t);
    }
    setMounted(true);
  }, [visible]);

  if (!mounted) return null;

  const dance = GUARD_DANCE_STYLES[styleIdx] || GUARD_DANCE_STYLES[0];

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center p-6 bg-gradient-to-br ${dance.bgClass} transition-opacity duration-400 ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <style>{`
        @keyframes gd-morlam-body { 0%,100%{transform:translateY(0) rotate(-5deg) scale(1)} 50%{transform:translateY(-14px) rotate(5deg) scale(1.04)} }
        @keyframes gd-morlam-armL { 0%,100%{transform:rotate(-55deg)} 50%{transform:rotate(-130deg)} }
        @keyframes gd-morlam-armR { 0%,100%{transform:rotate(130deg)} 50%{transform:rotate(55deg)} }

        @keyframes gd-disco-body { 0%,100%{transform:translateY(0) skewX(-4deg)} 50%{transform:translateY(-10px) skewX(4deg)} }
        @keyframes gd-disco-armL { 0%,100%{transform:rotate(35deg)} 50%{transform:rotate(-145deg)} }
        @keyframes gd-disco-armR { 0%,100%{transform:rotate(-145deg)} 50%{transform:rotate(35deg)} }
        @keyframes gd-disco-legL { 0%,100%{transform:rotate(14deg)} 50%{transform:rotate(-18deg)} }
        @keyframes gd-disco-legR { 0%,100%{transform:rotate(-18deg)} 50%{transform:rotate(14deg)} }

        @keyframes gd-robot-body { 0%,20%{transform:translate(0,0)} 25%,45%{transform:translate(-6px,-4px)} 50%,70%{transform:translate(6px,0)} 75%,95%{transform:translate(0,-6px)} }
        @keyframes gd-robot-armL { 0%,30%{transform:rotate(-90deg)} 35%,65%{transform:rotate(-20deg)} 70%,100%{transform:rotate(-110deg)} }
        @keyframes gd-robot-armR { 0%,30%{transform:rotate(20deg)} 35%,65%{transform:rotate(95deg)} 70%,100%{transform:rotate(40deg)} }
        @keyframes gd-robot-legL { 0%,45%{transform:rotate(0deg)} 50%,95%{transform:rotate(18deg)} }
        @keyframes gd-robot-legR { 0%,45%{transform:rotate(-18deg)} 50%,95%{transform:rotate(0deg)} }

        @keyframes gd-ballet-body { 0%{transform:translateY(0) scaleX(1)} 25%{transform:translateY(-16px) scaleX(0.35)} 50%{transform:translateY(-8px) scaleX(-1)} 75%{transform:translateY(-16px) scaleX(0.35)} 100%{transform:translateY(0) scaleX(1)} }
        @keyframes gd-ballet-armL { 0%,100%{transform:rotate(-125deg)} 50%{transform:rotate(-155deg)} }
        @keyframes gd-ballet-armR { 0%,100%{transform:rotate(125deg)} 50%{transform:rotate(155deg)} }
        @keyframes gd-ballet-legL { 0%,100%{transform:rotate(6deg)} 50%{transform:rotate(34deg)} }
        @keyframes gd-ballet-legR { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(-14deg)} }

        @keyframes gd-rock-body { 0%,100%{transform:translateY(0) rotate(-8deg)} 50%{transform:translateY(-8px) rotate(10deg)} }
        @keyframes gd-rock-armL { 0%,100%{transform:rotate(-40deg)} 50%{transform:rotate(-85deg)} }
        @keyframes gd-rock-armR { 0%,100%{transform:rotate(115deg)} 50%{transform:rotate(155deg)} }

        @keyframes gd-salsa-body { 0%,100%{transform:translateX(-12px) rotate(-7deg)} 50%{transform:translateX(12px) rotate(7deg)} }
        @keyframes gd-salsa-armL { 0%,100%{transform:rotate(-105deg)} 50%{transform:rotate(-50deg)} }
        @keyframes gd-salsa-armR { 0%,100%{transform:rotate(50deg)} 50%{transform:rotate(105deg)} }

        @keyframes gd-moonwalk-body { 0%{transform:translateX(26px) skewX(-8deg)} 50%{transform:translateX(-26px) skewX(-8deg)} 100%{transform:translateX(26px) skewX(-8deg)} }
        @keyframes gd-moonwalk-armL { 0%,100%{transform:rotate(-25deg)} 50%{transform:rotate(35deg)} }
        @keyframes gd-moonwalk-armR { 0%,100%{transform:rotate(-120deg)} 50%{transform:rotate(-95deg)} }
        @keyframes gd-moonwalk-legL { 0%,100%{transform:rotate(24deg)} 50%{transform:rotate(-26deg)} }
        @keyframes gd-moonwalk-legR { 0%,100%{transform:rotate(-26deg)} 50%{transform:rotate(24deg)} }

        @keyframes gd-aerobic-body { 0%,100%{transform:translateY(0) scaleY(0.95)} 50%{transform:translateY(-22px) scaleY(1.05)} }
        @keyframes gd-aerobic-armL { 0%,100%{transform:rotate(15deg)} 50%{transform:rotate(-155deg)} }
        @keyframes gd-aerobic-armR { 0%,100%{transform:rotate(-15deg)} 50%{transform:rotate(155deg)} }
        @keyframes gd-aerobic-legL { 0%,100%{transform:rotate(4deg)} 50%{transform:rotate(28deg)} }
        @keyframes gd-aerobic-legR { 0%,100%{transform:rotate(-4deg)} 50%{transform:rotate(-28deg)} }

        @keyframes gd-bounce-legL { 0%,100%{transform:rotate(-12deg)} 50%{transform:rotate(22deg)} }
        @keyframes gd-bounce-legR { 0%,100%{transform:rotate(22deg)} 50%{transform:rotate(-12deg)} }

        .gd-morlam-body { animation: gd-morlam-body 0.55s ease-in-out infinite; }
        .gd-morlam-armL { animation: gd-morlam-armL 0.55s ease-in-out infinite; }
        .gd-morlam-armR { animation: gd-morlam-armR 0.55s ease-in-out infinite; }
        .gd-disco-body { animation: gd-disco-body 0.6s ease-in-out infinite; }
        .gd-disco-armL { animation: gd-disco-armL 0.6s ease-in-out infinite; }
        .gd-disco-armR { animation: gd-disco-armR 0.6s ease-in-out infinite; }
        .gd-disco-legL { animation: gd-disco-legL 0.6s ease-in-out infinite; }
        .gd-disco-legR { animation: gd-disco-legR 0.6s ease-in-out infinite; }
        .gd-robot-body { animation: gd-robot-body 0.9s steps(1,end) infinite; }
        .gd-robot-armL { animation: gd-robot-armL 0.9s steps(1,end) infinite; }
        .gd-robot-armR { animation: gd-robot-armR 0.9s steps(1,end) infinite; }
        .gd-robot-legL { animation: gd-robot-legL 0.9s steps(1,end) infinite; }
        .gd-robot-legR { animation: gd-robot-legR 0.9s steps(1,end) infinite; }
        .gd-ballet-body { animation: gd-ballet-body 1.2s ease-in-out infinite; }
        .gd-ballet-armL { animation: gd-ballet-armL 1.2s ease-in-out infinite; }
        .gd-ballet-armR { animation: gd-ballet-armR 1.2s ease-in-out infinite; }
        .gd-ballet-legL { animation: gd-ballet-legL 0.6s ease-in-out infinite; }
        .gd-ballet-legR { animation: gd-ballet-legR 0.6s ease-in-out infinite; }
        .gd-rock-body { animation: gd-rock-body 0.36s ease-in-out infinite; }
        .gd-rock-armL { animation: gd-rock-armL 0.36s ease-in-out infinite; }
        .gd-rock-armR { animation: gd-rock-armR 0.36s ease-in-out infinite; }
        .gd-salsa-body { animation: gd-salsa-body 0.52s ease-in-out infinite; }
        .gd-salsa-armL { animation: gd-salsa-armL 0.52s ease-in-out infinite; }
        .gd-salsa-armR { animation: gd-salsa-armR 0.52s ease-in-out infinite; }
        .gd-moonwalk-body { animation: gd-moonwalk-body 1.3s ease-in-out infinite; }
        .gd-moonwalk-armL { animation: gd-moonwalk-armL 0.65s ease-in-out infinite; }
        .gd-moonwalk-armR { animation: gd-moonwalk-armR 0.65s ease-in-out infinite; }
        .gd-moonwalk-legL { animation: gd-moonwalk-legL 0.65s ease-in-out infinite; }
        .gd-moonwalk-legR { animation: gd-moonwalk-legR 0.65s ease-in-out infinite; }
        .gd-aerobic-body { animation: gd-aerobic-body 0.5s ease-in-out infinite; }
        .gd-aerobic-armL { animation: gd-aerobic-armL 0.5s ease-in-out infinite; }
        .gd-aerobic-armR { animation: gd-aerobic-armR 0.5s ease-in-out infinite; }
        .gd-aerobic-legL { animation: gd-aerobic-legL 0.5s ease-in-out infinite; }
        .gd-aerobic-legR { animation: gd-aerobic-legR 0.5s ease-in-out infinite; }
        .gd-bounce-legL { animation: gd-bounce-legL 0.5s ease-in-out infinite; }
        .gd-bounce-legR { animation: gd-bounce-legR 0.5s ease-in-out infinite; }
      `}</style>

      {/* Ambient floating music/sparkle emojis */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        {dance.bgEmojis.map((em, i) => (
          <span
            key={i}
            style={{
              left: `${16 + i * 22}%`,
              top: `${18 + (i % 2) * 52}%`,
              animationDelay: `${i * 180}ms`,
            }}
            className="absolute text-4xl sm:text-5xl animate-bounce"
          >
            {em}
          </span>
        ))}
      </div>

      {/* Dance Style Badge */}
      <div
        className={`relative z-10 px-4 py-1 rounded-full border-2 bg-black/50 text-xs font-extrabold tracking-wider mb-5 shadow-lg ${dance.accentClass}`}
      >
        {dance.badge} • {dance.title}
      </div>

      {/* Dancing Guard Figure */}
      <div className="relative z-10 h-56 w-52 flex items-center justify-center">
        {/* Stage Spotlight Floor */}
        <div className="absolute bottom-3 w-40 h-7 rounded-full bg-amber-300/25 blur-md" />

        <div className={`relative flex flex-col items-center ${dance.bodyAnim}`}>
          {/* Top Prop / Hat */}
          {dance.propTop && (
            <div className="text-3xl -mb-2 z-20 drop-shadow-lg">{dance.propTop}</div>
          )}

          {/* Guard Real Face Head */}
          <div className="relative z-10 w-20 h-20 rounded-full border-4 border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.55)] overflow-hidden bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/guard_face.jpg"
              alt="พี่ยามเต้นรอโหลด"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Torso + Arms */}
          <div className="relative -mt-1 flex items-start justify-center">
            {/* Left Arm */}
            <div
              className={`origin-top-right w-4 h-14 rounded-full bg-sky-700 border-2 border-amber-300 -mr-1.5 mt-1 relative ${dance.armLAnim}`}
            >
              {dance.propHandL && (
                <span className="absolute -bottom-4 -left-2 text-2xl">{dance.propHandL}</span>
              )}
            </div>

            {/* Guard Uniform Shirt */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-sky-600 to-slate-800 border-2 border-amber-300 shadow-lg flex flex-col items-center justify-center relative z-10">
              <div className="w-5 h-5 rounded-full bg-amber-400 border border-black text-[10px] flex items-center justify-center font-black text-black">
                ★
              </div>
              <div className="w-full h-2 bg-black/70 mt-2 border-y border-amber-400/70" />
              {dance.id === 'ballet' && (
                <div className="absolute -bottom-3 w-24 h-5 rounded-full bg-pink-300/90 border-2 border-pink-100" />
              )}
            </div>

            {/* Right Arm */}
            <div
              className={`origin-top-left w-4 h-14 rounded-full bg-sky-700 border-2 border-amber-300 -ml-1.5 mt-1 relative ${dance.armRAnim}`}
            >
              {dance.propHandR && (
                <span className="absolute -bottom-4 -right-2 text-2xl">{dance.propHandR}</span>
              )}
            </div>
          </div>

          {/* Legs */}
          <div className="flex items-start gap-3 -mt-1">
            <div
              className={`origin-top w-5 h-14 rounded-b-xl bg-slate-900 border-2 border-slate-600 ${dance.legLAnim}`}
            />
            <div
              className={`origin-top w-5 h-14 rounded-b-xl bg-slate-900 border-2 border-slate-600 ${dance.legRAnim}`}
            />
          </div>
        </div>
      </div>

      {/* Caption & Loading Bar */}
      <div className="relative z-10 text-center mt-2 space-y-2.5 max-w-sm w-full">
        <p className="font-[family-name:var(--font-kanit)] text-base sm:text-lg font-extrabold text-amber-200 drop-shadow">
          {dance.caption}
        </p>
        <div className="w-full h-2.5 bg-black/60 border border-amber-400/60 rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-gradient-to-r from-amber-400 via-pink-400 to-cyan-400 rounded-full animate-pulse" />
        </div>
        <div className="text-[11px] font-bold text-amber-100/75">
          ⏳ กำลังอัญเชิญผู้กล้าลงสนาม 3D...
        </div>
      </div>
    </div>
  );
}
