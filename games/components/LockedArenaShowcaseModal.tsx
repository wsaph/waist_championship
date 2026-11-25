'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  buildCharacterMesh,
  buildCustomGuardCharacter,
  type CharacterMeshParts,
} from '@/lib/character_3d';
import {
  disposeObject3D,
  getQualityConfig,
  type QualityMode,
} from '@/lib/device_perf';
import type { GameId, GameLobbyBroadcastInfo, GamePlayerSummary } from '../types';

export interface LockedArenaShowcaseModalProps {
  gameId: GameId;
  gameTitleTh: string;
  lobby: GameLobbyBroadcastInfo;
  players: GamePlayerSummary[];
  qualityMode: QualityMode;
  onClose: () => void;
}

export function LockedArenaShowcaseModal({
  gameId,
  gameTitleTh,
  lobby,
  players,
  qualityMode,
  onClose,
}: LockedArenaShowcaseModalProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);

  const rosterSig = (lobby.roster || [])
    .map((r) => `${r.slotId}:${r.playerId}:${r.name}:${r.isBot ? 1 : 0}`)
    .join('|');

  useEffect(() => {
    const container = wrapRef.current;
    const labelsLayer = labelsRef.current;
    if (!container) return;
    container.innerHTML = '';
    if (labelsLayer) labelsLayer.innerHTML = '';

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const qCfg = getQualityConfig(qualityMode);

    const scene = new THREE.Scene();
    const bgHex =
      gameId === 'soccer'
        ? 0x064e3b
        : gameId === 'sumo'
          ? 0x2e1065
          : gameId === 'taekwondo'
            ? 0x7c2d12
            : gameId === 'casino'
              ? 0x064e3b
              : 0x431407;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.025);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    const updateCam = (w: number, h: number) => {
      const aspect = Math.max(0.45, w / Math.max(1, h));
      const isPortrait = aspect < 0.95;
      camera.aspect = aspect;
      camera.position.set(0, isPortrait ? 5.6 : 4.5, isPortrait ? 13.8 : 10.6);
      camera.lookAt(0, 1.2, 0);
      camera.updateProjectionMatrix();
    };
    updateCam(width, height);

    const renderer = new THREE.WebGLRenderer({ antialias: qCfg.antialias });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qCfg.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = qCfg.shadowType;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xfef08a, 1.0));
    const dir = new THREE.DirectionalLight(0xfffbeb, 1.25);
    dir.position.set(6, 14, 10);
    dir.castShadow = true;
    scene.add(dir);

    // Game-specific 3D stage floor & props
    let ballMesh: THREE.Mesh | null = null;
    if (gameId === 'soccer') {
      const turf = new THREE.Mesh(
        new THREE.BoxGeometry(14, 0.3, 8.5),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.78 })
      );
      turf.position.y = -0.15;
      turf.receiveShadow = true;
      scene.add(turf);
      const centerRing = new THREE.Mesh(
        new THREE.RingGeometry(1.4, 1.52, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );
      centerRing.rotation.x = -Math.PI / 2;
      centerRing.position.y = 0.02;
      scene.add(centerRing);
      ballMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 18, 14),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
      );
      ballMesh.castShadow = true;
      scene.add(ballMesh);
    } else if (gameId === 'sumo') {
      const dohyo = new THREE.Mesh(
        new THREE.CylinderGeometry(3.4, 3.9, 0.4, 32),
        new THREE.MeshStandardMaterial({ color: 0xdfc198, roughness: 0.85 })
      );
      dohyo.position.y = -0.2;
      dohyo.receiveShadow = true;
      const tawara = new THREE.Mesh(
        new THREE.TorusGeometry(3.15, 0.12, 10, 36),
        new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.7 })
      );
      tawara.rotation.x = -Math.PI / 2;
      tawara.position.y = 0.04;
      scene.add(dohyo, tawara);
    } else if (gameId === 'taekwondo') {
      const matB = new THREE.Mesh(
        new THREE.BoxGeometry(10.5, 0.24, 6.2),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7 })
      );
      matB.position.y = -0.12;
      const matR = new THREE.Mesh(
        new THREE.BoxGeometry(6.4, 0.26, 4.0),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 })
      );
      matR.position.y = -0.11;
      scene.add(matB, matR);
    } else if (gameId === 'casino') {
      const table = new THREE.Mesh(
        new THREE.CylinderGeometry(3.5, 3.5, 0.3, 32),
        new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.65 })
      );
      table.position.y = -0.15;
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(3.5, 0.16, 12, 36),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
      );
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.02;
      scene.add(table, rim);
      const guardDealer = buildCustomGuardCharacter();
      guardDealer.rootGroup.position.set(0, 0, -2.55);
      guardDealer.rootGroup.rotation.y = -Math.PI / 2;
      guardDealer.rootGroup.scale.setScalar(0.92);
      scene.add(guardDealer.rootGroup);
    } else {
      // Shabu kitchen floor + central hotpot
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(11, 0.25, 7.5),
        new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 })
      );
      floor.position.y = -0.125;
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 0.8, 0.55, 20),
        new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.35, roughness: 0.4 })
      );
      pot.position.set(0, 0.3, 0);
      scene.add(floor, pot);
    }

    const effectiveRoster =
      lobby.roster && lobby.roster.length > 0
        ? lobby.roster
        : [
          {
            slotId: 'L1',
            playerId: lobby.hostUserId,
            name: lobby.hostName,
            emoji: lobby.hostEmoji,
            team: 'left' as const,
            isBot: false,
          },
        ];

    interface ShowcaseActor {
      root: THREE.Group;
      charParts: CharacterMeshParts;
      baseX: number;
      baseZ: number;
      team: 'left' | 'right' | 'coop';
      tagEl: HTMLDivElement | null;
    }

    let leftSideCount = 0;
    let rightSideCount = 0;

    const actors: ShowcaseActor[] = effectiveRoster.map((slot, idx) => {
      const fallback = players.length > 0 ? players[idx % players.length] : undefined;
      const found = slot.playerId
        ? players.find((p) => p.id === slot.playerId) || fallback
        : fallback;
      const team: 'left' | 'right' | 'coop' =
        slot.team ||
        (gameId === 'casino' || gameId === 'shabu'
          ? 'coop'
          : slot.slotId.startsWith('L') || slot.slotId.startsWith('B') || slot.slotId === 'p1'
            ? 'left'
            : slot.slotId.startsWith('R') || slot.slotId === 'p2'
              ? 'right'
              : idx % 2 === 0
                ? 'left'
                : 'right');

      const charParts = buildCharacterMesh({
        colorHex:
          found?.colorHex ||
          (team === 'left' ? '#38BDF8' : team === 'right' ? '#FB7185' : '#FACC15'),
        accessory: 'headband',
        bandColor:
          team === 'left' ? '#38BDF8' : team === 'right' ? '#EF4444' : '#FACC15',
        bellyScale: found?.bellyScale ?? found?.bmiBellyScale ?? 1,
        muscleScale: found?.muscleScale ?? 1,
        showDumbbells: false,
        species: found?.breed || found?.species || 'bunny',
        equipHat: found?.equipHat || 'none',
        equipFace: found?.equipFace || 'face_none',
        equipArmor: found?.equipArmor || 'armor_none',
        equipWeapon: found?.equipWeapon || 'weapon_none',
        equipWings: found?.equipWings || 'wings_none',
        equipAura: found?.equipAura || 'aura_none',
        equipMount: 'mount_none',
        propColors: found?.propColors,
        animMode: 'cheer',
        animSeed: idx * 1.5,
      });
      charParts.rootGroup.scale.setScalar(0.95);

      const root = new THREE.Group();
      root.add(charParts.rootGroup);

      let baseX = 0;
      let baseZ = 0;
      if (team === 'coop') {
        const total = Math.max(1, effectiveRoster.length);
        const ang = ((idx + 0.5) / total) * Math.PI - Math.PI / 2;
        baseX = Math.sin(ang) * 2.55;
        baseZ = Math.cos(ang) * 1.85 + 0.55;
        root.rotation.y = Math.atan2(baseZ, -baseX);
      } else {
        const sameSideIdx = team === 'left' ? leftSideCount++ : rightSideCount++;
        baseX = (team === 'left' ? -1 : 1) * (gameId === 'sumo' ? 1.35 : 2.35 + sameSideIdx * 1.05);
        baseZ = sameSideIdx === 0 ? 0 : sameSideIdx % 2 === 1 ? -1.35 : 1.35;
        root.rotation.y = team === 'left' ? 0 : Math.PI;
      }
      root.position.set(baseX, 0, baseZ);
      scene.add(root);

      let tagEl: HTMLDivElement | null = null;
      if (labelsLayer) {
        tagEl = document.createElement('div');
        tagEl.className = 'absolute -translate-x-1/2 -translate-y-full pointer-events-none whitespace-nowrap';
        const cls =
          team === 'left'
            ? 'bg-sky-950/90 border-sky-400 text-sky-100'
            : team === 'right'
              ? 'bg-rose-950/90 border-rose-400 text-rose-100'
              : 'bg-amber-950/90 border-amber-400 text-amber-100';
        tagEl.innerHTML = `<div class="px-2.5 py-0.5 rounded-full border ${cls} text-[11px] font-extrabold shadow">${slot.emoji} ${slot.name}${slot.isBot ? '' : ' • กำลังเล่น'}</div>`;
        labelsLayer.appendChild(tagEl);
      }

      return { root, charParts, baseX, baseZ, team, tagEl };
    });

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      updateCam(w, h);
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    const projVec = new THREE.Vector3();
    let frameId = 0;
    let elapsed = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (typeof document !== 'undefined' && document.hidden) {
        clock.getDelta();
        return;
      }
      const delta = Math.min(0.05, clock.getDelta());
      elapsed += delta;

      if (ballMesh) {
        const s = Math.sin(elapsed * 2.8);
        ballMesh.position.set(s * 2.2, 0.36 + Math.abs(Math.cos(elapsed * 5.6)) * 0.65, 0);
        ballMesh.rotation.z = -elapsed * 5;
      }

      const cw = container.clientWidth || window.innerWidth;
      const ch = container.clientHeight || window.innerHeight;

      actors.forEach((act, idx) => {
        const hop = Math.abs(Math.sin(elapsed * 5.2 + idx * 1.4)) * 0.28;
        const sway = Math.sin(elapsed * 2.6 + idx) * 0.32;
        act.root.position.set(act.baseX + sway, hop, act.baseZ);
        act.charParts.mixer?.update(delta);

        if (act.tagEl) {
          projVec.set(act.root.position.x, act.root.position.y + 2.25, act.root.position.z);
          projVec.project(camera);
          if (projVec.z < 1) {
            act.tagEl.style.left = `${((projVec.x * 0.5 + 0.5) * cw).toFixed(1)}px`;
            act.tagEl.style.top = `${((-projVec.y * 0.5 + 0.5) * ch).toFixed(1)}px`;
            act.tagEl.style.opacity = '1';
          } else {
            act.tagEl.style.opacity = '0';
          }
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      actors.forEach((a) => {
        a.charParts.rootGroup.userData.disposed = true;
      });
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, [gameId, qualityMode, rosterSig, lobby.hostUserId, lobby.hostName, lobby.hostEmoji, players]);

  const hasScores =
    typeof lobby.scoreLeft === 'number' && typeof lobby.scoreRight === 'number';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col overflow-hidden select-none">
      <div ref={wrapRef} className="fixed inset-0 w-full h-full touch-none" />
      <div ref={labelsRef} className="fixed inset-0 pointer-events-none z-10 overflow-hidden" />

      <div className="fixed top-3 inset-x-3 pt-safe z-20 flex items-center justify-between gap-2 pointer-events-none">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto rpg-panel px-3 py-1.5 rounded-xl text-xs font-extrabold text-amber-100 hover:bg-rose-600 hover:text-white cursor-pointer"
        >
          ← 🏖️ กลับเกาะหลัก
        </button>

        <div className="pointer-events-auto rpg-banner rounded-2xl px-4 py-1.5 flex items-center gap-2.5 shadow-xl border-2 border-amber-300">
          <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
            🔴 LIVE
          </span>
          <span className="font-[family-name:var(--font-kanit)] font-extrabold text-sm sm:text-base text-amber-200">
            {gameTitleTh}
          </span>
          {hasScores && (
            <span className="font-[family-name:var(--font-kanit)] font-black text-lg text-white">
              {lobby.scoreLeft} : {lobby.scoreRight}
            </span>
          )}
        </div>

        <div className="w-16" />
      </div>

      <div className="fixed bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-4 pb-safe z-30 flex justify-center pointer-events-none">
        <div className="pointer-events-auto rpg-stone-frame rounded-2xl max-w-xl w-full p-3.5 sm:p-4 space-y-2.5 shadow-2xl border-2 border-amber-400/90 bg-slate-950/90 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-rose-600 border border-amber-300 flex items-center justify-center text-lg shadow shrink-0">
              🔒
            </span>
            <div>
              <h3 className="font-[family-name:var(--font-kanit)] text-sm sm:text-base font-extrabold text-amber-300 leading-tight">
                สนามกำลังแข่งขันอยู่ • จำกัดเล่นทีละ 1 รอบ
              </h3>
              <p className="text-[11px] text-amber-100/85 font-semibold">
                ล็อกให้เล่นทีละรอบเพื่อแบ่งโควตาเซิร์ฟเวอร์ให้เพื่อนๆ เล่นกิจกรรมอื่นบนเกาะได้ลื่นไหล • พอรอบนี้จบจะเปิดให้เข้าทันที!
              </p>
            </div>
          </div>

          <div className="bg-slate-900/85 border border-amber-400/40 rounded-xl px-3 py-2 text-xs font-extrabold text-amber-100 truncate">
            👥 ผู้เล่นในรอบนี้:{' '}
            {(lobby.roster || [])
              .map((r) => `${r.emoji} ${r.name}`)
              .join('  •  ') || `${lobby.hostEmoji} ${lobby.hostName}`}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800/90 border border-slate-600 text-slate-300 text-xs font-extrabold cursor-not-allowed"
            >
              ⏳ รอรอบนี้จบก่อนนะ (จะปลดล็อกอัตโนมัติ)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rpg-btn-gold py-2 px-4 rounded-xl text-xs font-extrabold cursor-pointer shrink-0"
            >
              🏖️ ไปเล่นกิจกรรมอื่นก่อน
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
