'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface VirtualGamepadProps {
  visible: boolean;
  onMoveChange: (moveX: number, moveZ: number) => void;
  onPassPress: () => void;
  onShootChargeStart: () => void;
  onShootRelease: () => void;
  onSprintOrTackleChange: (pressed: boolean, freshPress: boolean) => void;
}

/**
 * Multi-Touch Translucent Virtual Gamepad for iPad & Mobile (Mini PES 3v3):
 * - Left: 360-degree analog Virtual Joystick (`pointerId` isolated)
 * - Right: 3 Large Ergonomic Buttons — Pass/Switch, Hold-to-Shoot, and Sprint/Slide Tackle
 * - Portrait Orientation Hint Banner recommending Landscape rotation!
 */
export function VirtualGamepad({
  visible,
  onMoveChange,
  onPassPress,
  onShootChargeStart,
  onShootRelease,
  onSprintOrTackleChange,
}: VirtualGamepadProps) {
  const knobRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);
  const joyCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const shootPointerIdRef = useRef<number | null>(null);
  const sprintPointerIdRef = useRef<number | null>(null);

  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [dismissedRotateHint, setDismissedRotateHint] = useState<boolean>(false);
  const [isChargingVisual, setIsChargingVisual] = useState<boolean>(false);
  const [isSprintingVisual, setIsSprintingVisual] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === 'undefined') return;
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 900);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const setKnobOffset = (dx: number, dy: number) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    }
  };

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerIdRef.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    joyCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoyFromPoint(e.clientX, e.clientY);
  };

  const updateJoyFromPoint = (clientX: number, clientY: number) => {
    const maxRadius = 46;
    const rawDx = clientX - joyCenterRef.current.x;
    const rawDy = clientY - joyCenterRef.current.y;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(maxRadius, dist);
    const scale = dist > 0.001 ? clampedDist / dist : 0;
    const kx = rawDx * scale;
    const ky = rawDy * scale;
    setKnobOffset(kx, ky);

    if (dist < 7) {
      onMoveChange(0, 0);
    } else {
      onMoveChange(kx / maxRadius, ky / maxRadius);
    }
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    updateJoyFromPoint(e.clientX, e.clientY);
  };

  const handleJoyEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    joyPointerIdRef.current = null;
    setKnobOffset(0, 0);
    onMoveChange(0, 0);
  };

  return (
    <>
      {/* Portrait Orientation Recommendation Banner on Mobile/iPad */}
      {isPortrait && !dismissedRotateHint && (
        <div className="fixed top-16 inset-x-3 z-30 flex justify-center pointer-events-none">
          <div className="pointer-events-auto bg-slate-950/90 border-2 border-amber-400 rounded-2xl px-3.5 py-2 flex items-center gap-2.5 shadow-2xl max-w-sm">
            <span className="text-xl animate-bounce">📱🔄</span>
            <p className="text-[11px] font-extrabold text-amber-200 leading-snug">
              แนะนำหมุนจอเป็น <strong>แนวนอน (Landscape)</strong> เพื่อมุมมองสนามฟุตบอล 3v3 แบบเต็มตา!
            </p>
            <button
              type="button"
              onClick={() => setDismissedRotateHint(true)}
              className="px-2 py-0.5 rounded-lg bg-slate-800 text-xs font-black text-slate-300 cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {visible && (
        <div
          className="fixed bottom-3 sm:bottom-5 inset-x-3 sm:inset-x-7 pb-safe z-30 flex items-end justify-between pointer-events-none select-none touch-none"
          style={{ touchAction: 'none' }}
        >
          {/* Left 360° Analog Virtual Joystick */}
          <div
            onPointerDown={handleJoyDown}
            onPointerMove={handleJoyMove}
            onPointerUp={handleJoyEnd}
            onPointerCancel={handleJoyEnd}
            className="pointer-events-auto relative w-28 h-28 sm:w-34 sm:h-34 rounded-full bg-slate-950/45 backdrop-blur-[2px] border-2 border-white/55 shadow-2xl flex items-center justify-center touch-none select-none"
          >
            <span className="absolute top-1.5 text-[10px] text-white/60 font-black pointer-events-none">▲</span>
            <span className="absolute bottom-1.5 text-[10px] text-white/60 font-black pointer-events-none">▼</span>
            <span className="absolute left-2 text-[10px] text-white/60 font-black pointer-events-none">◀</span>
            <span className="absolute right-2 text-[10px] text-white/60 font-black pointer-events-none">▶</span>
            <div
              ref={knobRef}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-b from-amber-300/90 to-amber-500/90 border-2 border-white shadow-lg flex items-center justify-center text-slate-950 font-black pointer-events-none"
            >
              🕹️
            </div>
          </div>

          {/* Right Ergonomic PES 3-Button Arc: Pass/Switch, Sprint/Slide, Hold-to-Shoot */}
          <div className="pointer-events-auto flex items-end gap-2.5 sm:gap-3.5 touch-none select-none">
            {/* 1. Pass / Call for Pass */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPassPress();
              }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-sky-500/75 active:bg-sky-400 active:scale-95 border-2 border-white/90 text-white shadow-xl flex flex-col items-center justify-center font-black touch-none cursor-pointer"
            >
              <span className="text-lg sm:text-xl leading-none">👟</span>
              <span className="text-[10px] sm:text-xs mt-0.5 leading-tight">ส่ง/ขอบอล</span>
            </button>

            <div className="flex flex-col items-center gap-2.5">
              {/* 2. Sprint / Slide Tackle */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  sprintPointerIdRef.current = e.pointerId;
                  setIsSprintingVisual(true);
                  onSprintOrTackleChange(true, true);
                }}
                onPointerUp={(e) => {
                  if (sprintPointerIdRef.current !== e.pointerId) return;
                  sprintPointerIdRef.current = null;
                  setIsSprintingVisual(false);
                  onSprintOrTackleChange(false, false);
                }}
                onPointerCancel={(e) => {
                  if (sprintPointerIdRef.current !== e.pointerId) return;
                  sprintPointerIdRef.current = null;
                  setIsSprintingVisual(false);
                  onSprintOrTackleChange(false, false);
                }}
                className={`w-15 h-15 sm:w-18 sm:h-18 rounded-full border-2 border-white/90 text-slate-950 shadow-xl flex flex-col items-center justify-center font-black touch-none cursor-pointer transition ${isSprintingVisual
                    ? 'bg-amber-300 scale-95 ring-2 ring-white'
                    : 'bg-amber-400/80'
                  }`}
              >
                <span className="text-base sm:text-lg leading-none">⚡</span>
                <span className="text-[9.5px] sm:text-[11px] mt-0.5 leading-tight">วิ่ง/สไลด์</span>
              </button>

              {/* 3. Shoot (Hold to Charge Power Gauge, Release to Shoot!) */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  shootPointerIdRef.current = e.pointerId;
                  setIsChargingVisual(true);
                  onShootChargeStart();
                }}
                onPointerUp={(e) => {
                  if (shootPointerIdRef.current !== e.pointerId) return;
                  shootPointerIdRef.current = null;
                  setIsChargingVisual(false);
                  onShootRelease();
                }}
                onPointerCancel={(e) => {
                  if (shootPointerIdRef.current !== e.pointerId) return;
                  shootPointerIdRef.current = null;
                  setIsChargingVisual(false);
                  onShootRelease();
                }}
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-3 border-amber-200 text-white shadow-2xl flex flex-col items-center justify-center font-black touch-none cursor-pointer transition ${isChargingVisual
                    ? 'bg-gradient-to-b from-amber-400 to-rose-600 scale-105 ring-4 ring-amber-300/70'
                    : 'bg-gradient-to-b from-rose-500/85 to-red-700/85'
                  }`}
              >
                <span className="text-xl sm:text-2xl leading-none">🔥</span>
                <span className="text-[11px] sm:text-xs mt-0.5 leading-tight">
                  {isChargingVisual ? 'ปล่อย=ยิง!' : 'กดค้างยิง'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
