'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  KRATHONG_PRESET_WISHES,
  KRATHONG_STYLES,
  getKrathongStyleMeta,
  type KrathongStyleId,
} from '@/lib/krathong_catalog';
import {
  animateKrathongParts,
  buildKrathongMesh,
  type KrathongMeshParts,
} from '@/lib/krathong_3d';
import { disposeObject3D } from '@/lib/device_perf';

export interface LoyKrathongModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: {
    id: number | null;
    name: string;
    emoji: string;
    colorHex: string;
    bandColor: string;
    species: string;
  };
  submitting?: boolean;
  isMusicOn?: boolean;
  onToggleMusic?: () => void;
  onLaunch: (styleId: KrathongStyleId, caption: string) => Promise<void> | void;
}

export function LoyKrathongModal({
  isOpen,
  onClose,
  player,
  submitting = false,
  isMusicOn = false,
  onToggleMusic,
  onLaunch,
}: LoyKrathongModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<KrathongStyleId>('my_character');
  const [caption, setCaption] = useState<string>(KRATHONG_PRESET_WISHES[0]);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const krathongHolderRef = useRef<THREE.Group | null>(null);
  const activePartsRef = useRef<KrathongMeshParts | null>(null);

  // Initialize Three.js 360° Moonlit Water Preview
  useEffect(() => {
    if (!isOpen) return;
    const container = previewRef.current;
    if (!container) return;

    container.innerHTML = '';
    const width = container.clientWidth || 340;
    const height = container.clientHeight || 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 40);
    camera.position.set(0, 1.45, 2.55);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.75;
    controls.maxDistance = 4.2;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = Math.PI * 0.16;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.1;
    controls.target.set(0, 0.28, 0);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e1b4b, 1.05);
    scene.add(hemiLight);

    const warmLight = new THREE.DirectionalLight(0xfef08a, 1.2);
    warmLight.position.set(2.5, 4.5, 3.2);
    scene.add(warmLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    rimLight.position.set(-3, 2, -2.5);
    scene.add(rimLight);

    // Moonlit lagoon water pond pad
    const waterPond = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.55, 0.14, 32),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0c4a6e,
        emissiveIntensity: 0.45,
        roughness: 0.18,
        metalness: 0.2,
        transparent: true,
        opacity: 0.88,
      })
    );
    waterPond.position.y = -0.07;
    scene.add(waterPond);

    const holder = new THREE.Group();
    scene.add(holder);
    krathongHolderRef.current = holder;

    const clock = new THREE.Clock();
    let frameId = 0;
    let elapsed = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min(0.05, clock.getDelta());
      elapsed += delta;
      if (activePartsRef.current) {
        animateKrathongParts(activePartsRef.current, elapsed, 0.15, 0.25);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 340;
      const h = container.clientHeight || 200;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      activePartsRef.current = null;
      krathongHolderRef.current = null;
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, [isOpen]);

  // Rebuild Krathong 3D mesh whenever selectedStyle or player avatar changes
  useEffect(() => {
    if (!isOpen) return;
    const holder = krathongHolderRef.current;
    if (!holder) return;

    disposeObject3D(holder);
    holder.clear();

    const parts = buildKrathongMesh(selectedStyle, {
      colorHex: player.colorHex,
      bandColor: player.bandColor,
      species: player.species,
      emoji: player.emoji,
    });
    holder.add(parts.group);
    activePartsRef.current = parts;
  }, [isOpen, selectedStyle, player.colorHex, player.bandColor, player.species, player.emoji]);

  if (!isOpen) return null;

  const activeMeta = getKrathongStyleMeta(selectedStyle);

  const handleRandomWish = () => {
    const others = KRATHONG_PRESET_WISHES.filter((w) => w !== caption);
    const pick = others[Math.floor(Math.random() * others.length)] || KRATHONG_PRESET_WISHES[0];
    setCaption(pick);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    void onLaunch(selectedStyle, caption.trim() || 'ขอให้มีความสุข สมหวังทุกประการ 🪷');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2.5 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="rpg-panel relative w-full max-w-lg rounded-3xl border-2 border-amber-300/80 bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#0f172a] text-white shadow-[0_12px_42px_rgba(0,0,0,0.85)] overflow-hidden my-auto max-h-[94vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-400/25 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl animate-bounce">🪷</span>
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-kanit)] font-extrabold text-base sm:text-lg text-amber-200 leading-tight truncate">
                กิจกรรมลอยกระทงริมหาด
              </h2>
              <p className="text-[11px] text-cyan-200/85 font-semibold truncate">
                เลือกกระทงน่ารักๆ ใส่คำอธิษฐาน แล้วปล่อยลอยวนรอบเกาะได้เลย! (ลอยกี่ใบก็ได้)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleMusic && (
              <button
                type="button"
                onClick={onToggleMusic}
                className={`h-8 px-2.5 rounded-xl font-extrabold text-xs flex items-center gap-1 border cursor-pointer transition ${
                  isMusicOn
                    ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-100 border-amber-300/40'
                }`}
                title="เปิด/ปิดทำนองเพลงลอยกระทง"
              >
                <span>{isMusicOn ? '🎵' : '🔇'}</span>
                <span className="hidden sm:inline">เพลง</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 text-amber-100 font-extrabold text-sm flex items-center justify-center border border-amber-300/40 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-3.5 sm:p-4 space-y-3.5 overflow-y-auto">
          {/* 3D Preview Stage */}
          <div className="relative rounded-2xl border-2 border-cyan-400/40 bg-[radial-gradient(circle_at_50%_20%,#312e81_0%,#0c4a6e_58%,#020617_100%)] h-44 sm:h-48 overflow-hidden shadow-inner">
            {/* Twinkling stars */}
            <div className="pointer-events-none absolute inset-0 opacity-75 text-[10px] select-none">
              <span className="absolute top-2.5 left-4 animate-pulse">✨</span>
              <span className="absolute top-5 right-6">🌕</span>
              <span className="absolute top-3 left-1/3 opacity-70">⭐</span>
              <span className="absolute top-8 right-1/4 animate-pulse">✨</span>
            </div>

            {/* Live Floating Caption Bubble Preview */}
            <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-10 max-w-[88%]">
              <div className="rounded-full bg-gradient-to-r from-amber-950/90 via-rose-950/90 to-indigo-950/90 border border-amber-300 px-3 py-1 shadow-lg text-center">
                <div className="text-[10px] font-extrabold text-amber-300 truncate">
                  {player.emoji} {player.name}
                </div>
                <div className="text-[11px] font-bold text-white truncate max-w-[260px] sm:max-w-[340px]">
                  “{caption.trim() || 'ขอพรดีๆ คืนวันเพ็ญ~'}”
                </div>
              </div>
            </div>

            <div ref={previewRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            <div className="pointer-events-none absolute bottom-2 inset-x-3 flex items-center justify-between text-[10px] font-bold text-cyan-100/90">
              <span className="bg-black/55 px-2.5 py-0.5 rounded-full border border-white/15 truncate max-w-[70%]">
                {activeMeta.emoji} {activeMeta.name}
              </span>
              <span className="bg-black/45 px-2 py-0.5 rounded-full">🔄 หมุนดู 360°</span>
            </div>
          </div>

          {/* Active Style Description */}
          <div className="rounded-xl bg-slate-900/80 border border-amber-300/30 px-3 py-2 flex items-center gap-2 text-xs">
            <span className="text-lg shrink-0">{activeMeta.emoji}</span>
            <span className="text-amber-100/90 font-semibold leading-snug">{activeMeta.desc}</span>
          </div>

          {/* 12 Cute Styles Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-extrabold text-amber-200">
                🎨 เลือกรูปแบบกระทง (12 ธีมฟรี!)
              </label>
              <span className="text-[10.5px] text-cyan-300 font-semibold">ลอยซ้ำเปลี่ยนลายได้ไม่อั้น</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {KRATHONG_STYLES.map((st) => {
                const isSelected = st.id === selectedStyle;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStyle(st.id)}
                    className={`relative rounded-xl px-2 py-2 text-center border-2 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-gradient-to-b from-amber-400/30 to-pink-500/30 border-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.45)] scale-[1.02]'
                        : 'bg-slate-900/75 hover:bg-slate-800/90 border-slate-700/80 text-slate-200'
                    }`}
                  >
                    {st.badge && (
                      <span className="absolute -top-1.5 right-1 bg-gradient-to-r from-pink-500 to-amber-400 text-slate-950 text-[8.5px] font-black px-1.5 py-0.2 rounded-full border border-white/80">
                        {st.badge}
                      </span>
                    )}
                    <span className="text-xl leading-none">
                      {st.id === 'my_character' ? player.emoji || st.emoji : st.emoji}
                    </span>
                    <span className="text-[10.5px] font-extrabold leading-tight truncate w-full text-amber-50">
                      {st.shortName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Caption / Wish Input + Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-amber-200">
                💬 แคปชั่น / คำอธิษฐานบนกระทง
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRandomWish}
                  className="text-[10.5px] font-extrabold bg-indigo-600/80 hover:bg-indigo-500 text-white px-2 py-0.5 rounded-full border border-indigo-300/50 cursor-pointer"
                >
                  🎲 สุ่มคำขอพร
                </button>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {caption.length}/75
                </span>
              </div>
            </div>
            <input
              type="text"
              maxLength={75}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="พิมพ์คำอธิษฐานหรือแคปชั่นน่ารักๆ..."
              className="w-full rounded-xl bg-white text-slate-950 placeholder:text-slate-400 border-2 border-amber-300 px-3 py-2 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
            <div className="flex flex-wrap gap-1 pt-0.5">
              {KRATHONG_PRESET_WISHES.slice(0, 5).map((wish) => (
                <button
                  key={wish}
                  type="button"
                  onClick={() => setCaption(wish)}
                  className="text-[10px] font-bold bg-slate-800/90 hover:bg-amber-500/25 text-amber-100 border border-amber-400/30 rounded-full px-2.5 py-0.5 cursor-pointer transition truncate max-w-full"
                >
                  {wish}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="px-4 py-3 border-t border-amber-400/25 bg-slate-950/75 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-extrabold border border-slate-600 cursor-pointer"
          >
            ไว้ก่อน
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="neo-btn flex-1 sm:flex-none bg-gradient-to-r from-amber-300 via-pink-400 to-amber-300 text-slate-950 border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-5 py-2 rounded-xl cursor-pointer shadow-[0_3px_0_#000] disabled:opacity-60"
          >
            {submitting ? '🪷 กำลังปล่อยลงน้ำ...' : '🪷 อธิษฐานแล้วปล่อยลงน้ำเลย!'}
          </button>
        </div>
      </form>
    </div>
  );
}
