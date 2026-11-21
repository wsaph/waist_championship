'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildCustomGuardCharacter } from '@/lib/character_3d';
import { disposeObject3D } from '@/lib/device_perf';

type DanceId =
  | 'morlam'
  | 'disco'
  | 'robot'
  | 'ballet'
  | 'rock'
  | 'salsa'
  | 'moonwalk'
  | 'aerobic';

interface GuardDanceStyle {
  id: DanceId;
  title: string;
  badge: string;
  caption: string;
  bgClass: string;
  accentClass: string;
  stageRingHex: number;
  lightHex: number;
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
    stageRingHex: 0xfacc15,
    lightHex: 0xf472b6,
    bgEmojis: ['🎶', '✨', '💃', '🎺'],
  },
  {
    id: 'disco',
    title: 'ดิสโก้ฟีเวอร์ยุค 80',
    badge: '🪩 DISCO FEVER',
    caption: 'ดิสโก้เปิดสนาม! เตรียมสเต็ปเดินให้พร้อมเลย!',
    bgClass: 'from-indigo-950 via-violet-950 to-pink-950',
    accentClass: 'border-cyan-300 text-cyan-300',
    stageRingHex: 0x38bdf8,
    lightHex: 0xc084fc,
    bgEmojis: ['🪩', '⚡', '💜', '🌟'],
  },
  {
    id: 'robot',
    title: 'หุ่นยนต์ป๊อปปิ้ง',
    badge: '🤖 ROBOT POPPING',
    caption: 'กำลังโหลดระบบสนาม 3D... บี๊บๆ บู๊บๆ!',
    bgClass: 'from-slate-950 via-cyan-950 to-blue-950',
    accentClass: 'border-sky-300 text-sky-300',
    stageRingHex: 0x06b6d4,
    lightHex: 0x38bdf8,
    bgEmojis: ['🤖', '⚡', '💠', '🔋'],
  },
  {
    id: 'ballet',
    title: 'บัลเลต์สายพลิ้ว',
    badge: '🩰 SWAN BALLET',
    caption: 'พี่ยามขอวอร์มปลายเท้าแบบนุ่มนวลแป๊บนะ~',
    bgClass: 'from-rose-950 via-pink-950 to-slate-950',
    accentClass: 'border-pink-300 text-pink-200',
    stageRingHex: 0xf9a8d4,
    lightHex: 0xfbcfe8,
    bgEmojis: ['🩰', '🌸', '✨', '💫'],
  },
  {
    id: 'rock',
    title: 'ร็อกเกอร์หัวสั่น',
    badge: '🎸 HEAVY METAL',
    caption: 'ร็อกแอนด์โรล!! วิ่งให้ยับอย่าให้แพ้หมูกรอบ!',
    bgClass: 'from-zinc-950 via-red-950 to-orange-950',
    accentClass: 'border-orange-400 text-orange-300',
    stageRingHex: 0xf97316,
    lightHex: 0xef4444,
    bgEmojis: ['🔥', '⚡', '🎸', '💥'],
  },
  {
    id: 'salsa',
    title: 'ซัลซ่าลาตินไฟลุก',
    badge: '🌹 SALSA FIESTA',
    caption: 'อูลาล่า~ จังหวะนี้ต้องเบิร์นแคลอรี่แล้ว!',
    bgClass: 'from-red-950 via-amber-950 to-rose-950',
    accentClass: 'border-rose-300 text-rose-200',
    stageRingHex: 0xfb7185,
    lightHex: 0xfbbf24,
    bgEmojis: ['🌹', '🔥', '💃', '🌶️'],
  },
  {
    id: 'moonwalk',
    title: 'ราชาเพลงป๊อป มูนวอล์ค',
    badge: '🎩 MOONWALK KING',
    caption: 'ฮี๊~ฮี! ลื่นปรื๊ดๆ รอโหลดสนามแป๊บเดียว!',
    bgClass: 'from-slate-950 via-zinc-900 to-indigo-950',
    accentClass: 'border-yellow-200 text-yellow-200',
    stageRingHex: 0xfef08a,
    lightHex: 0xe2e8f0,
    bgEmojis: ['✨', '⭐', '🎵', '💫'],
  },
  {
    id: 'aerobic',
    title: 'แอโรบิกหน้าโลตัส',
    badge: '🏃 AEROBIC 90s',
    caption: 'หนึ่ง สอง ซั่ม! วอร์มอัพรอเข้าสนามกันหน่อย!',
    bgClass: 'from-emerald-950 via-teal-950 to-sky-950',
    accentClass: 'border-lime-300 text-lime-300',
    stageRingHex: 0x84cc16,
    lightHex: 0x34d399,
    bgEmojis: ['👟', '💦', '⚡', '🔥'],
  },
];

interface GuardDanceLoaderProps {
  visible: boolean;
}

export function GuardDanceLoader({ visible }: GuardDanceLoaderProps) {
  const [styleIdx, setStyleIdx] = useState<number>(0);
  const [mounted, setMounted] = useState<boolean>(true);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const danceIdRef = useRef<DanceId>('morlam');

  useEffect(() => {
    const picked = Math.floor(Math.random() * GUARD_DANCE_STYLES.length);
    setStyleIdx(picked);
    danceIdRef.current = GUARD_DANCE_STYLES[picked].id;
  }, []);

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => setMounted(false), 420);
      return () => clearTimeout(t);
    }
    setMounted(true);
  }, [visible]);

  const dance = GUARD_DANCE_STYLES[styleIdx] || GUARD_DANCE_STYLES[0];

  useEffect(() => {
    danceIdRef.current = dance.id;
  }, [dance.id]);

  // Real 3D Guard Character Dancing Stage
  useEffect(() => {
    if (!mounted) return;
    const container = stageContainerRef.current;
    if (!container) return;

    const width = container.clientWidth || 280;
    const height = container.clientHeight || 280;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 40);
    camera.position.set(0, 1.65, 6.4);
    camera.lookAt(0, 1.35, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x334155, 1.35);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.3);
    keyLight.position.set(3, 6, 5);
    scene.add(keyLight);

    const discoSpot = new THREE.PointLight(dance.lightHex, 2.2, 10);
    discoSpot.position.set(-2.2, 3.2, 2.2);
    scene.add(discoSpot);

    // Glowing Stage Platform
    const stageDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.5, 0.16, 28),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.5 })
    );
    stageDisc.position.y = -0.08;
    scene.add(stageDisc);

    const stageRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.38, 0.06, 10, 32),
      new THREE.MeshBasicMaterial({ color: dance.stageRingHex })
    );
    stageRing.rotation.x = Math.PI / 2;
    stageRing.position.y = 0.02;
    scene.add(stageRing);

    // Real 3D Guard Character (same body + real face texture as in the arena!)
    const guard = buildCustomGuardCharacter('/images/guard_face_tex.jpg');
    // Face forward toward the camera (+Z)
    guard.rootGroup.rotation.y = -Math.PI / 2;
    guard.rootGroup.position.set(0, 0.02, 0);
    scene.add(guard.rootGroup);

    const clock = new THREE.Clock();
    let frameId = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const d = danceIdRef.current;

      // Reset base transforms each frame
      guard.rootGroup.position.set(0, 0.02, 0);
      guard.rootGroup.rotation.set(0, -Math.PI / 2, 0);
      guard.bounceGroup.position.set(0, 0, 0);
      guard.bounceGroup.rotation.set(0, 0, 0);
      guard.armL.rotation.set(0, 0, 0);
      guard.armR.rotation.set(0, 0, 0);
      guard.legL.rotation.set(0, 0, 0);
      guard.legR.rotation.set(0, 0, 0);

      // Orbit disco light
      discoSpot.position.x = Math.cos(t * 3.5) * 2.4;
      discoSpot.position.z = Math.sin(t * 3.5) * 2.4;

      if (d === 'morlam') {
        guard.bounceGroup.position.y = Math.abs(Math.sin(t * 11)) * 0.28;
        guard.rootGroup.rotation.y = -Math.PI / 2 + Math.sin(t * 5.5) * 0.65;
        guard.bounceGroup.rotation.z = Math.sin(t * 5.5) * 0.16;
        guard.armL.rotation.z = 1.1 + Math.sin(t * 11) * 0.65;
        guard.armR.rotation.z = -1.1 - Math.sin(t * 11) * 0.65;
        guard.legL.rotation.z = Math.sin(t * 11) * 0.45;
        guard.legR.rotation.z = -Math.sin(t * 11) * 0.45;
      } else if (d === 'disco') {
        const beat = Math.sin(t * 8.5);
        guard.bounceGroup.position.y = Math.abs(beat) * 0.22;
        guard.rootGroup.rotation.y = -Math.PI / 2 + Math.sin(t * 4.25) * 0.45;
        guard.armL.rotation.z = beat > 0 ? 1.55 : -0.35;
        guard.armR.rotation.z = beat > 0 ? 0.35 : -1.55;
        guard.legL.rotation.z = beat * 0.35;
        guard.legR.rotation.z = -beat * 0.35;
      } else if (d === 'robot') {
        const step = Math.floor(t * 4) % 4;
        guard.rootGroup.rotation.y = -Math.PI / 2 + (step - 1.5) * 0.22;
        guard.armL.rotation.z = step % 2 === 0 ? 1.45 : 0.25;
        guard.armR.rotation.z = step % 2 === 0 ? -0.25 : -1.45;
        guard.armL.rotation.x = step < 2 ? 0.7 : -0.3;
        guard.armR.rotation.x = step < 2 ? -0.3 : 0.7;
        guard.legL.rotation.z = step === 1 ? 0.35 : 0;
        guard.legR.rotation.z = step === 3 ? -0.35 : 0;
      } else if (d === 'ballet') {
        guard.rootGroup.rotation.y = -Math.PI / 2 + t * 4.8;
        guard.bounceGroup.position.y = 0.14 + Math.abs(Math.sin(t * 5)) * 0.22;
        guard.armL.rotation.z = 1.45;
        guard.armR.rotation.z = -1.45;
        guard.legL.rotation.z = 0.55;
        guard.legR.rotation.z = -0.1;
      } else if (d === 'rock') {
        guard.bounceGroup.position.y = Math.abs(Math.sin(t * 15)) * 0.22;
        guard.bounceGroup.rotation.z = Math.sin(t * 15) * 0.24;
        guard.rootGroup.rotation.y = -Math.PI / 2 + Math.sin(t * 7.5) * 0.4;
        guard.armL.rotation.z = 0.9 + Math.sin(t * 15) * 0.55;
        guard.armR.rotation.z = -1.35 + Math.cos(t * 15) * 0.35;
        guard.legL.rotation.z = Math.sin(t * 15) * 0.35;
        guard.legR.rotation.z = -Math.sin(t * 15) * 0.35;
      } else if (d === 'salsa') {
        guard.rootGroup.position.x = Math.sin(t * 6) * 0.42;
        guard.bounceGroup.position.y = Math.abs(Math.sin(t * 12)) * 0.18;
        guard.rootGroup.rotation.y = -Math.PI / 2 + Math.cos(t * 6) * 0.55;
        guard.armL.rotation.z = 0.8 + Math.sin(t * 12) * 0.5;
        guard.armR.rotation.z = -0.8 + Math.sin(t * 12) * 0.5;
        guard.legL.rotation.z = Math.sin(t * 12) * 0.4;
        guard.legR.rotation.z = -Math.sin(t * 12) * 0.4;
      } else if (d === 'moonwalk') {
        guard.rootGroup.position.x = Math.sin(t * 3.2) * 0.65;
        guard.rootGroup.rotation.y = -Math.PI / 2 + 0.55;
        guard.bounceGroup.rotation.x = 0.14;
        guard.armL.rotation.z = Math.sin(t * 9) * 0.55;
        guard.armR.rotation.z = -1.2;
        guard.legL.rotation.z = Math.sin(t * 9) * 0.65;
        guard.legR.rotation.z = -Math.sin(t * 9) * 0.65;
      } else if (d === 'aerobic') {
        const jump = Math.abs(Math.sin(t * 10));
        guard.bounceGroup.position.y = jump * 0.42;
        guard.armL.rotation.z = -0.2 + jump * 1.8;
        guard.armR.rotation.z = 0.2 - jump * 1.8;
        guard.legL.rotation.x = jump * 0.42;
        guard.legR.rotation.x = -jump * 0.42;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, [mounted, dance.lightHex, dance.stageRingHex]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center p-6 bg-gradient-to-br ${dance.bgClass} transition-opacity duration-400 ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
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

      {/* Real 3D Dancing Guard Stage */}
      <div
        ref={stageContainerRef}
        className="relative z-10 w-[260px] h-[260px] sm:w-[300px] sm:h-[300px]"
      />

      {/* Caption & Loading Bar */}
      <div className="relative z-10 text-center mt-1 space-y-2.5 max-w-sm w-full">
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
