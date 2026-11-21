'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeObject3D, getQualityConfig, type QualityMode } from '@/lib/device_perf';

export interface CafePetOption {
  id: string;
  name: string;
  speciesLabel: string;
  icon: string;
  modelUrl: string;
  photoUrl?: string;
  photoFlatOnFloor?: boolean;
  isRealCatSfx?: boolean;
  voicePitch: number;
  spicyThreshold: number;
  treatLabel: string;
  treatIcon: string;
  homePos: [number, number];
  moveSpeed: number;
  scaleHeight: number;
  idleQuote: string;
  petQuote: string;
  bellyQuote: string;
  spicyQuote: string;
  eatQuote: string;
  napQuote: string;
}

const CAFE_PETS: CafePetOption[] = [
  {
    id: 'belly_cat',
    name: 'น้องแมวหงายพุง (กับดักพุง!)',
    speciesLabel: 'แมวหงายพุง',
    icon: '🐱',
    modelUrl: '/models/cat_pet.glb',
    photoUrl: '/images/belly_cat.png',
    photoFlatOnFloor: true,
    isRealCatSfx: true,
    voicePitch: 660,
    spicyThreshold: 18,
    treatLabel: 'ป้อนแมวเลีย',
    treatIcon: '🐟',
    homePos: [-0.85, 1.32],
    moveSpeed: 0,
    scaleHeight: 1.05,
    idleQuote: 'ครืดดด... นอนหงายพุงล่อมนุษย์... กล้าเกามั้ยล่ะ zZz',
    petQuote: 'ครืดดดดด~ เกาคางเบาๆ แบบนี้ฟินจนเคลิ้มเลยเหมียว~ 🎵',
    bellyQuote: 'ครืดด... พุงนุ่มใช่มั้ยล่ะ... ระวังกับดักพุงแมวนะ! 🐾',
    spicyQuote: 'ฟ่อ!! กับดักพุงแมวทำงาน! กางเล็บงั่มมือซะเลย!! 😾💢',
    eatQuote: 'เหมียววว~ ขนมแมวเลียอร่อยสุดๆ เลียปากแผล็บ! 🐟💖',
    napQuote: 'ครืด... หายใจพุงกระเพื่อม หลับปุ๋ยแล้ว zZz 💤',
  },
  {
    id: 'husky',
    name: 'น้องข้าวคั่ว',
    speciesLabel: 'ข้าวคั่ว ฮัสกี้',
    icon: '🐺',
    modelUrl: '/models/husky_hero.glb',
    photoUrl: '/images/kaokua_husky.png',
    voicePitch: 360,
    spicyThreshold: 34,
    treatLabel: 'ป้อนหมูย่าง',
    treatIcon: '🍖',
    homePos: [0.55, -0.25],
    moveSpeed: 0,
    scaleHeight: 1.95,
    idleQuote: 'โฮ่ง! ข้าวคั่วเป็นลูกสาวนะ นอนรอให้เกาพุงบนเบาะอยู่!',
    petQuote: 'วู้ววว~ เกาคางหน่อย ชอบมากกก!',
    bellyQuote: 'แฮ่กๆ เกาพุงแรงๆ เลยมนุษย์ ชอบๆ!',
    spicyQuote: 'บรู้ววว!! จั๊กจี้โว้ยยย พอก่อน! 🐺💢',
    eatQuote: 'งับ!! หมูย่างของโปรด ขอกินอีกชิ้น! 🍖✨',
    napQuote: 'คร่อก... ฝันว่ากินหมูกรอบ... 💤',
  },
  {
    id: 'cat',
    name: 'น้องส้ม (แมวคาเฟ่)',
    speciesLabel: 'แมวเหมียว',
    icon: '🐱',
    modelUrl: '/models/cat_pet.glb',
    voicePitch: 680,
    spicyThreshold: 22,
    treatLabel: 'ป้อนปลาทู',
    treatIcon: '🐟',
    homePos: [-2.1, 0.85],
    moveSpeed: 1.35,
    scaleHeight: 1.05,
    idleQuote: 'เหมียว~ เดินตรวจคาเฟ่แป๊บนะ',
    petQuote: 'ครืดดด~ ลูบหัวตรงนี้แหละฟินสุด!',
    bellyQuote: 'อื้มม~ เกาพุงเบาๆ นะมนุษย์...',
    spicyQuote: 'แง้ว!! เกาพุงนานเกินไปแล้วนะ งั่มมือซะเลย! 😾',
    eatQuote: 'งั่มๆ ปลาทูอร่อยจังเลยเหมียว! 🐟💖',
    napQuote: 'เหมียว... ของีบแป๊บนะ zZz 💤',
  },
  {
    id: 'corgi',
    name: 'น้องคอร์กี้ตูดดุ๊กดิ๊ก',
    speciesLabel: 'คอร์กี้',
    icon: '🐶',
    modelUrl: '/models/corgi_pet.glb',
    voicePitch: 480,
    spicyThreshold: 32,
    treatLabel: 'ป้อนขนมหมา',
    treatIcon: '🦴',
    homePos: [2.15, 0.9],
    moveSpeed: 1.65,
    scaleHeight: 1.05,
    idleQuote: 'บ๊อกๆ! อยากวิ่งไล่เลเซอร์จังเลย!',
    petQuote: 'หูตั้งดุ๊กดิ๊ก~ ลูบอีกๆ!',
    bellyQuote: 'นอนหงายพุงรอเลย เกาอีกๆ!',
    spicyQuote: 'บ๊อก! จั๊กจี้พุงแล้วนะมนุษย์! 🐶💢',
    eatQuote: 'กรุบกรอบ! อร่อยสุดๆ เลยบ๊อก! 🦴💛',
    napQuote: 'ง่วงแล้ว... ขอนอนพักตูดแป๊บ 💤',
  },
  {
    id: 'capybara',
    name: 'น้องคาปิบาร่าชิลจัด',
    speciesLabel: 'คาปิบาร่า',
    icon: '🦫',
    modelUrl: '/models/capybara_hero.glb',
    voicePitch: 290,
    spicyThreshold: 48,
    treatLabel: 'ป้อนส้มยูซุ',
    treatIcon: '🍊',
    homePos: [-2.6, -1.6],
    moveSpeed: 0.78,
    scaleHeight: 1.15,
    idleQuote: 'นิ่งสงบสยบทุกความเครียด... 🍊',
    petQuote: 'ฟิน... จะหลับแล้วนะ...',
    bellyQuote: 'เกาไปเลย สบายตัวสุดๆ...',
    spicyQuote: 'อือ... ขยับหนีนิดนึง จั๊กจี้เบาๆ',
    eatQuote: 'งั่ม... ส้มหวานมาก ชีวิตดี๊ดี 🍊✨',
    napQuote: 'zZz... นอนชิลระดับปรมาจารย์ 💤',
  },
  {
    id: 'fox',
    name: 'น้องจิ้งจอกส้ม',
    speciesLabel: 'จิ้งจอก',
    icon: '🦊',
    modelUrl: '/models/fox.glb',
    voicePitch: 560,
    spicyThreshold: 26,
    treatLabel: 'ป้อนเบอร์รี่',
    treatIcon: '🍓',
    homePos: [2.55, -1.55],
    moveSpeed: 1.55,
    scaleHeight: 1.1,
    idleQuote: 'กิ๊ว~ แอบสำรวจมุมห้องอยู่นะ!',
    petQuote: 'หางฟูเลย~ ลูบหูนุ่มๆ สิ!',
    bellyQuote: 'ยอมให้เกาพุงแป๊บเดียวนะ!',
    spicyQuote: 'กิ๊ว!! พอแล้ว เดี๋ยวงับนิ้วเลย! 🦊💢',
    eatQuote: 'งั่มๆ เบอร์รี่หวานฉ่ำ! 🍓💖',
    napQuote: 'ขดหางนอนอุ่นๆ แป๊บนะ 💤',
  },
  {
    id: 'bunny',
    name: 'น้องกระต่ายปุยฝ้าย',
    speciesLabel: 'กระต่าย',
    icon: '🐰',
    modelUrl: '/models/bunny.glb',
    voicePitch: 740,
    spicyThreshold: 28,
    treatLabel: 'ป้อนแครอท',
    treatIcon: '🥕',
    homePos: [0.95, 1.85],
    moveSpeed: 1.45,
    scaleHeight: 0.92,
    idleQuote: 'ดุ๊กดิ๊กๆ~ แครอทอยู่ไหนน้า',
    petQuote: 'หูตกสบายใจ~ ลูบเบาๆ นะ',
    bellyQuote: 'พุงนุ่มๆ เกาเบาๆ จั๊กจี้น้า~',
    spicyQuote: 'ตุ้บ! กระทืบเท้าดุแล้วนะ! 🐰💢',
    eatQuote: 'กร้วมๆ แครอทกรอบมาก! 🥕✨',
    napQuote: 'หูกระดิกเบาๆ หลับปุ๋ยแล้ว~ 💤',
  },
];

type CafeTool = 'pet' | 'belly' | 'laser' | 'treat';
type PetAiMode = 'wander' | 'idle_look' | 'nap' | 'sniff_bowl';

interface PetRuntime {
  meta: CafePetOption;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  idleAction: THREE.AnimationAction | null;
  walkAction: THREE.AnimationAction | null;
  activeClip: 'idle' | 'walk';
  aiMode: PetAiMode;
  aiUntil: number;
  targetPos: THREE.Vector3;
  petTiltX: number;
  petTiltZ: number;
  bellyRoll: number;
  happyHopUntil: number;
  spicyUntil: number;
  eatUntil: number;
  bellyHeat: number;
  laserOffsetAngle: number;
}

interface PetCafeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qualityMode?: QualityMode;
  playerName?: string;
}

interface FloatingParticle {
  id: number;
  x: number;
  y: number;
  emoji: string;
}

const BOWL_POS = new THREE.Vector3(-2.35, 0.06, 1.85);

function pickNaturalTarget(petId: string): { mode: PetAiMode; pos: THREE.Vector3; durationMs: number } {
  const r = Math.random();
  if (r < 0.18) {
    // Walk over to sniff the food & water bowls!
    return {
      mode: 'sniff_bowl',
      pos: new THREE.Vector3(
        BOWL_POS.x + (Math.random() - 0.5) * 0.9,
        0.06,
        BOWL_POS.z + (Math.random() - 0.5) * 0.7
      ),
      durationMs: 3600 + Math.random() * 2400,
    };
  }
  if (r < 0.36) {
    // Take a cozy little nap where they are
    return {
      mode: 'nap',
      pos: new THREE.Vector3(),
      durationMs: 4200 + Math.random() * 3500,
    };
  }
  if (r < 0.56) {
    // Pause and look curiously around / at the camera
    return {
      mode: 'idle_look',
      pos: new THREE.Vector3(),
      durationMs: 2400 + Math.random() * 2200,
    };
  }
  // Wander freely around the cozy café floor (avoiding the center photo cushion where Kaokua rests)
  const angle = Math.random() * Math.PI * 2;
  const minR = petId === 'bunny' ? 1.55 : 1.75;
  const rad = minR + Math.random() * 1.95;
  return {
    mode: 'wander',
    pos: new THREE.Vector3(
      THREE.MathUtils.clamp(Math.cos(angle) * rad, -3.4, 3.4),
      0.06,
      THREE.MathUtils.clamp(Math.sin(angle) * rad * 0.78 + 0.25, -2.35, 2.35)
    ),
    durationMs: 3800 + Math.random() * 2800,
  };
}

export function PetCafeModal({
  isOpen,
  onClose,
  qualityMode = 'auto',
  playerName = 'ผู้กล้า',
}: PetCafeModalProps) {
  const [selectedPetId, setSelectedPetId] = useState<string>('belly_cat');
  const [activeTool, setActiveTool] = useState<CafeTool>('pet');
  const [moodText, setMoodText] = useState<string>(CAFE_PETS[0].idleQuote);
  const [moodState, setMoodState] = useState<'chill' | 'happy' | 'spicy' | 'play' | 'eating'>('chill');
  const [happiness, setHappiness] = useState<number>(74);
  const [bondExp, setBondExp] = useState<number>(0);
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const [loadingCount, setLoadingCount] = useState<number>(CAFE_PETS.length);
  const [scratchFlash, setScratchFlash] = useState<boolean>(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const activeToolRef = useRef<CafeTool>('pet');
  const selectedPetIdRef = useRef<string>('belly_cat');
  const isPointerDownRef = useRef<boolean>(false);
  const activeRubPetIdRef = useRef<string | null>(null);
  const lastParticleAtRef = useRef<number>(0);
  const lastSfxAtRef = useRef<number>(0);
  const particleIdRef = useRef<number>(1);
  const petsRuntimeRef = useRef<Record<string, PetRuntime>>({});

  const cafeSharedRef = useRef<{
    laserActive: boolean;
    laserTarget: THREE.Vector3;
    treatArc: { active: boolean; startedAt: number; targetX: number; targetZ: number };
    gatherUntil: number;
  }>({
    laserActive: false,
    laserTarget: new THREE.Vector3(0, 0.08, 1.3),
    treatArc: { active: false, startedAt: 0, targetX: 0, targetZ: 1.15 },
    gatherUntil: 0,
  });

  const selectedPet = CAFE_PETS.find((p) => p.id === selectedPetId) || CAFE_PETS[0];

  useEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== 'laser') {
      cafeSharedRef.current.laserActive = false;
    }
  }, [activeTool]);

  useEffect(() => {
    selectedPetIdRef.current = selectedPet.id;
    try {
      const saved = localStorage.getItem(`waist_pet_cafe_bond_${selectedPet.id}`);
      setBondExp(saved ? Math.max(0, Number(saved) || 0) : 0);
    } catch {
      setBondExp(0);
    }
  }, [selectedPet]);

  const addBond = useCallback((petId: string, delta: number) => {
    try {
      const key = `waist_pet_cafe_bond_${petId}`;
      const prev = Math.max(0, Number(localStorage.getItem(key) || 0) || 0);
      const next = prev + delta;
      localStorage.setItem(key, String(next));
      if (petId === selectedPetIdRef.current) {
        setBondExp(next);
      }
    } catch {
      if (petId === selectedPetIdRef.current) {
        setBondExp((p) => p + delta);
      }
    }
  }, []);

  const playPetSfx = useCallback(
    (kind: 'purr' | 'spicy' | 'eat' | 'bell', voicePitch?: number, isRealCat?: boolean) => {
      const now = performance.now();
      if (kind === 'purr' && now - lastSfxAtRef.current < (isRealCat ? 380 : 320)) return;
      lastSfxAtRef.current = now;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const t = ctx.currentTime;
        const base = voicePitch ?? 500;

        if (isRealCat && kind === 'purr') {
          // เสียงครางแมวจริง 26Hz (Real Cat Purr Motor Rumble!)
          const osc = ctx.createOscillator();
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(26, t);
          lfo.type = 'sine';
          lfo.frequency.setValueAtTime(5.5, t);
          lfoGain.gain.setValueAtTime(0.06, t);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(145, t);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.14, t + 0.08);
          gain.gain.linearRampToValueAtTime(0.11, t + 0.28);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

          lfo.connect(lfoGain);
          lfoGain.connect(gain.gain);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);

          osc.start(t);
          lfo.start(t);
          osc.stop(t + 0.44);
          lfo.stop(t + 0.44);
          setTimeout(() => ctx.close().catch(() => { }), 550);
          return;
        }

        if (isRealCat && kind === 'spicy') {
          // เสียงขู่ฟ่อของแมวจริง (Filtered White-Noise Cat Hiss + Quick Yowl!)
          const bufLen = Math.floor(ctx.sampleRate * 0.32);
          const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
          const ch = noiseBuf.getChannelData(0);
          for (let i = 0; i < bufLen; i++) ch[i] = Math.random() * 2 - 1;
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuf;

          const band = ctx.createBiquadFilter();
          band.type = 'bandpass';
          band.frequency.setValueAtTime(3200, t);
          band.Q.setValueAtTime(1.4, t);

          const nGain = ctx.createGain();
          nGain.gain.setValueAtTime(0.001, t);
          nGain.gain.linearRampToValueAtTime(0.22, t + 0.03);
          nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.31);

          noise.connect(band);
          band.connect(nGain);
          nGain.connect(ctx.destination);
          noise.start(t);

          const yowl = ctx.createOscillator();
          const yGain = ctx.createGain();
          yowl.type = 'sawtooth';
          yowl.frequency.setValueAtTime(760, t);
          yowl.frequency.exponentialRampToValueAtTime(420, t + 0.22);
          yGain.gain.setValueAtTime(0.09, t);
          yGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
          yowl.connect(yGain);
          yGain.connect(ctx.destination);
          yowl.start(t);
          yowl.stop(t + 0.25);

          setTimeout(() => ctx.close().catch(() => { }), 450);
          return;
        }

        if (isRealCat && kind === 'eat') {
          // เสียงเหมียวอ้อนหวานๆ (Formant-curved Meow!)
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(520, t);
          osc.frequency.exponentialRampToValueAtTime(880, t + 0.14);
          osc.frequency.exponentialRampToValueAtTime(490, t + 0.34);
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1250, t);
          filter.Q.setValueAtTime(1.8, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.16, t + 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.38);
          setTimeout(() => ctx.close().catch(() => { }), 500);
          return;
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        if (kind === 'bell') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1046, t);
          osc.frequency.exponentialRampToValueAtTime(1318, t + 0.12);
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.26);
        } else if (kind === 'purr') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(base * 0.65, t);
          osc.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.14);
          gain.gain.setValueAtTime(0.08, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.17);
        } else if (kind === 'spicy') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(base * 1.15, t);
          osc.frequency.exponentialRampToValueAtTime(base * 0.5, t + 0.22);
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.25);
        } else {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(base * 0.8, t);
          osc.frequency.exponentialRampToValueAtTime(base * 1.25, t + 0.14);
          gain.gain.setValueAtTime(0.11, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.19);
        }
        setTimeout(() => ctx.close().catch(() => { }), 420);
      } catch {
        // ignore
      }
    },
    []
  );

  const spawnParticle = useCallback((clientX: number, clientY: number, emoji: string) => {
    const now = performance.now();
    if (now - lastParticleAtRef.current < 120) return;
    lastParticleAtRef.current = now;
    const id = particleIdRef.current++;
    setParticles((prev) => [...prev.slice(-16), { id, x: clientX, y: clientY, emoji }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 900);
  }, []);

  const handleFeedTreat = useCallback(
    (targetX = (Math.random() - 0.5) * 1.2, targetZ = 1.2) => {
      const pet = CAFE_PETS.find((p) => p.id === selectedPetIdRef.current) || CAFE_PETS[0];
      const now = performance.now();
      cafeSharedRef.current.treatArc = {
        active: true,
        startedAt: now,
        targetX,
        targetZ,
      };
      // All roaming 3D pets rush excitedly toward the treat!
      Object.values(petsRuntimeRef.current).forEach((rt, idx) => {
        rt.eatUntil = now + 2200;
        rt.happyHopUntil = now + 1500;
        rt.bellyHeat = Math.max(0, rt.bellyHeat - 10);
        if (rt.meta.moveSpeed > 0) {
          const ang = (idx / 5) * Math.PI * 2;
          rt.aiMode = 'wander';
          rt.aiUntil = now + 3200;
          rt.targetPos.set(targetX + Math.cos(ang) * 0.85, 0.06, targetZ + Math.sin(ang) * 0.75);
        }
      });
      setMoodState('eating');
      setMoodText(`${pet.eatQuote} (แก๊งน้องๆ วิ่งมารุมกินด้วย!)`);
      setHappiness((h) => Math.min(100, h + 12));
      addBond(pet.id, 15);
      playPetSfx('eat', pet.voicePitch, pet.isRealCatSfx);
    },
    [addBond, playPetSfx]
  );

  const handleCallAllPets = useCallback(() => {
    const now = performance.now();
    cafeSharedRef.current.gatherUntil = now + 4500;
    Object.values(petsRuntimeRef.current).forEach((rt, idx) => {
      rt.happyHopUntil = now + 900;
      if (rt.meta.moveSpeed > 0) {
        const ang = -Math.PI * 0.15 + (idx - 1) * 0.55;
        rt.aiMode = 'wander';
        rt.aiUntil = now + 4200;
        rt.targetPos.set(Math.cos(ang) * 1.75, 0.06, 0.9 + Math.sin(ang) * 0.85);
      }
    });
    setMoodState('play');
    setMoodText(`🔔 กรุ๊งกริ๊ง! แก๊งสัตว์เลี้ยงทั้งคาเฟ่วิ่งมารวมตัวหา ${playerName} แล้ว!`);
    playPetSfx('bell');
  }, [playPetSfx, playerName]);

  // Living 3D Multi-Pet Café Scene
  useEffect(() => {
    if (!isOpen) return;
    const container = stageRef.current;
    if (!container) return;

    const qCfg = getQualityConfig(qualityMode);
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfef3c7);
    scene.fog = new THREE.Fog(0xfef3c7, 11, 26);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 60);
    camera.position.set(0, 3.25, 6.6);
    const cameraLookAt = new THREE.Vector3(0, 0.75, 0.2);
    camera.lookAt(cameraLookAt);

    const renderer = new THREE.WebGLRenderer({
      antialias: qCfg.antialias,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qCfg.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = qCfg.shadowType;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Warm Café Lighting
    scene.add(new THREE.HemisphereLight(0xfffbeb, 0xd97706, 1.2));
    const sun = new THREE.DirectionalLight(0xfff7ed, 1.45);
    sun.position.set(4.5, 8.5, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(qCfg.shadowMapSize, qCfg.shadowMapSize);
    scene.add(sun);

    const warmLamp = new THREE.PointLight(0xfdba74, 1.2, 14);
    warmLamp.position.set(-3.0, 3.5, 1.5);
    scene.add(warmLamp);

    // Warm Café Wood Floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(10.5, 44),
      new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.78 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Center Soft Pastel Rug
    const rug = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.65, 0.06, 40),
      new THREE.MeshStandardMaterial({ color: 0xfce7f3, roughness: 0.92 })
    );
    rug.position.y = 0.03;
    rug.receiveShadow = true;
    scene.add(rug);

    const rugTrim = new THREE.Mesh(
      new THREE.TorusGeometry(2.62, 0.06, 8, 44),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.85 })
    );
    rugTrim.rotation.x = Math.PI / 2;
    rugTrim.position.y = 0.06;
    scene.add(rugTrim);

    // Cozy Pet Cushions around the room (including plush cushion right under Kaokua!)
    const cushionSpecs: Array<[number, number, number, number]> = [
      [0.55, -0.25, 0xfde68a, 1.15],
      [-2.8, -1.65, 0xbfdbfe, 0.85],
      [2.8, -1.6, 0xbbf7d0, 0.85],
    ];
    cushionSpecs.forEach(([cx, cz, hex, rad]) => {
      const cush = new THREE.Mesh(
        new THREE.CylinderGeometry(rad, rad + 0.1, 0.14, 24),
        new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9 })
      );
      cush.position.set(cx, 0.07, cz);
      cush.receiveShadow = true;
      scene.add(cush);
    });

    // Pet Food & Water Bowls Station (pets wander over here to sniff!)
    const bowlStation = new THREE.Group();
    bowlStation.position.set(BOWL_POS.x, 0, BOWL_POS.z);
    const matBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.03, 0.72),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.85 })
    );
    matBase.position.y = 0.015;
    const foodBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
    );
    foodBowl.position.set(-0.32, 0.09, 0);
    const kibble = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    kibble.scale.set(1, 0.35, 1);
    kibble.position.set(-0.32, 0.17, 0);
    const waterBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 })
    );
    waterBowl.position.set(0.32, 0.09, 0);
    const waterFill = new THREE.Mesh(
      new THREE.CircleGeometry(0.21, 16),
      new THREE.MeshBasicMaterial({ color: 0xbae6fd })
    );
    waterFill.rotation.x = -Math.PI / 2;
    waterFill.position.set(0.32, 0.172, 0);
    bowlStation.add(matBase, foodBowl, kibble, waterBowl, waterFill);
    scene.add(bowlStation);

    // Cat Condo / Scratching Post
    const catTree = new THREE.Group();
    catTree.position.set(-3.4, 0, -2.5);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.22, 2.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xd6b48c, roughness: 0.95 })
    );
    post.position.y = 1.2;
    const perch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.14, 16),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.85 })
    );
    perch.position.y = 2.42;
    catTree.add(post, perch);
    scene.add(catTree);

    // Wooden Café Table + Mug
    const tableGroup = new THREE.Group();
    tableGroup.position.set(3.45, 0, -2.2);
    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.82, 0.1, 18),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 })
    );
    tableTop.position.y = 1.1;
    const tableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 1.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
    );
    tableLeg.position.y = 0.55;
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.12, 0.24, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    mug.position.set(-0.1, 1.27, 0.1);
    tableGroup.add(tableTop, tableLeg, mug);
    scene.add(tableGroup);

    // Glowing Red Laser Dot on Floor
    const laserDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 16),
      new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
    );
    laserDot.rotation.x = -Math.PI / 2;
    laserDot.position.y = 0.08;
    laserDot.visible = false;
    const laserGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.28, 16),
      new THREE.MeshBasicMaterial({
        color: 0xf87171,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    laserDot.add(laserGlow);
    scene.add(laserDot);

    // Treat Projectile Mesh
    const treatMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.4 })
    );
    treatMesh.visible = false;
    scene.add(treatMesh);

    // Spawn ALL 6 Pets Together in the Café!
    petsRuntimeRef.current = {};
    let disposed = false;
    setLoadingCount(CAFE_PETS.length);

    const gltfLoader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    CAFE_PETS.forEach((meta, idx) => {
      const petRoot = new THREE.Group();
      petRoot.position.set(meta.homePos[0], 0.06, meta.homePos[1]);
      petRoot.userData.cafePetId = meta.id;
      scene.add(petRoot);

      const bodyPivot = new THREE.Group();
      bodyPivot.userData.cafePetId = meta.id;
      petRoot.add(bodyPivot);

      const initPlan = meta.moveSpeed > 0 ? pickNaturalTarget(meta.id) : null;
      const runtime: PetRuntime = {
        meta,
        root: petRoot,
        bodyPivot,
        mixer: null,
        idleAction: null,
        walkAction: null,
        activeClip: 'idle',
        aiMode: initPlan ? initPlan.mode : 'idle_look',
        aiUntil: performance.now() + 1800 + idx * 750,
        targetPos:
          initPlan && (initPlan.mode === 'wander' || initPlan.mode === 'sniff_bowl')
            ? initPlan.pos
            : new THREE.Vector3(meta.homePos[0], 0.06, meta.homePos[1]),
        petTiltX: 0,
        petTiltZ: 0,
        bellyRoll: 0,
        happyHopUntil: 0,
        spicyUntil: 0,
        eatUntil: 0,
        bellyHeat: 0,
        laserOffsetAngle: (idx / CAFE_PETS.length) * Math.PI * 2,
      };
      petsRuntimeRef.current[meta.id] = runtime;

      if (meta.photoUrl) {
        texLoader.load(
          meta.photoUrl,
          (tex) => {
            if (disposed) {
              tex.dispose();
              return;
            }
            tex.colorSpace = THREE.SRGBColorSpace;
            const img = tex.image as HTMLImageElement | undefined;
            const aspect = img && img.height > 0 ? img.width / img.height : 1.18;
            const planeH = meta.scaleHeight;
            const planeW = planeH * aspect;
            const photoMesh = new THREE.Mesh(
              new THREE.PlaneGeometry(planeW, planeH),
              new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                alphaTest: 0.05,
                side: THREE.DoubleSide,
              })
            );
            if (meta.photoFlatOnFloor) {
              // แมวหงายพุงนอนแผ่ราบบนพรมคาเฟ่ เอียงรับมุมกล้องเล็กน้อยให้ดูสมจริงสุดๆ!
              photoMesh.rotation.x = -Math.PI * 0.34;
              photoMesh.position.set(0, 0.26, 0);
            } else {
              photoMesh.position.set(0, planeH / 2 - 0.04, 0);
            }
            photoMesh.userData.cafePetId = meta.id;
            bodyPivot.add(photoMesh);

            const shadowOval = new THREE.Mesh(
              new THREE.CircleGeometry(planeW * (meta.photoFlatOnFloor ? 0.48 : 0.42), 24),
              new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: meta.photoFlatOnFloor ? 0.28 : 0.22,
                depthWrite: false,
              })
            );
            shadowOval.rotation.x = -Math.PI / 2;
            shadowOval.scale.set(1, meta.photoFlatOnFloor ? 0.48 : 0.55, 1);
            shadowOval.position.y = 0.02;
            petRoot.add(shadowOval);

            setLoadingCount((c) => Math.max(0, c - 1));
          },
          undefined,
          () => {
            if (!disposed) setLoadingCount((c) => Math.max(0, c - 1));
          }
        );
      } else {
        gltfLoader.load(
          meta.modelUrl,
          (gltf) => {
            if (disposed) {
              disposeObject3D(gltf.scene);
              return;
            }
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const maxDim = Math.max(size.x, size.y, size.z, 0.01);
            const scale = meta.scaleHeight / maxDim;
            model.scale.setScalar(scale);
            model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
            model.traverse((child) => {
              child.userData.cafePetId = meta.id;
              const mesh = child as THREE.Mesh;
              if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
              }
            });
            bodyPivot.add(model);

            if (gltf.animations && gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(model);
              const idleClip =
                gltf.animations.find((a) => /idle|sit|breath|stand/i.test(a.name)) ||
                gltf.animations[0];
              const walkClip =
                gltf.animations.find((a) => /walk|run|trot|move|hop/i.test(a.name)) || null;
              runtime.mixer = mixer;
              runtime.idleAction = mixer.clipAction(idleClip);
              runtime.walkAction = walkClip ? mixer.clipAction(walkClip) : null;
              runtime.idleAction.play();
            }
            setLoadingCount((c) => Math.max(0, c - 1));
          },
          undefined,
          () => {
            if (!disposed) setLoadingCount((c) => Math.max(0, c - 1));
          }
        );
      }
    });

    // Pointer Interaction: Rub / Pet ANY pet in the room, or shine Laser / toss Treat!
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
    const hitPoint = new THREE.Vector3();

    const findHitPet = (): PetRuntime | null => {
      const roots = Object.values(petsRuntimeRef.current).map((r) => r.bodyPivot);
      const hits = raycaster.intersectObjects(roots, true);
      if (hits.length === 0) return null;
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData.cafePetId) {
        obj = obj.parent;
      }
      const pid = obj?.userData.cafePetId as string | undefined;
      return pid ? petsRuntimeRef.current[pid] || null : null;
    };

    const updatePointerInteraction = (e: PointerEvent, isDownEvent: boolean) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const tool = activeToolRef.current;
      const shared = cafeSharedRef.current;

      if (tool === 'laser') {
        if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
          const clampedX = THREE.MathUtils.clamp(hitPoint.x, -3.5, 3.5);
          const clampedZ = THREE.MathUtils.clamp(hitPoint.z, -2.3, 2.5);
          shared.laserTarget.set(clampedX, 0.08, clampedZ);
          shared.laserActive = true;
          setMoodState('play');
          setMoodText('🔴 แก๊งน้องๆ จ้องจุดเลเซอร์ตาแป๋ว วิ่งไล่กันใหญ่เลย!');
        }
        return;
      }

      if (tool === 'treat' && isDownEvent) {
        if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
          handleFeedTreat(
            THREE.MathUtils.clamp(hitPoint.x, -2.4, 2.4),
            THREE.MathUtils.clamp(hitPoint.z, -1.2, 2.1)
          );
        } else {
          handleFeedTreat();
        }
        const curMeta = CAFE_PETS.find((p) => p.id === selectedPetIdRef.current) || CAFE_PETS[0];
        spawnParticle(e.clientX, e.clientY, curMeta.treatIcon);
        return;
      }

      if (!isPointerDownRef.current && !isDownEvent) return;

      const hitRt = findHitPet();
      if (!hitRt) return;

      // Focus the pet you touched!
      activeRubPetIdRef.current = hitRt.meta.id;
      if (selectedPetIdRef.current !== hitRt.meta.id) {
        setSelectedPetId(hitRt.meta.id);
      }

      const now = performance.now();
      const pet = hitRt.meta;
      // Pause walking while being petted
      if (hitRt.meta.moveSpeed > 0) {
        hitRt.aiMode = 'idle_look';
        hitRt.aiUntil = now + 2600;
      }

      if (tool === 'pet') {
        hitRt.petTiltZ = THREE.MathUtils.clamp(-pointer.x * 0.3, -0.26, 0.26);
        hitRt.petTiltX = 0.14;
        hitRt.happyHopUntil = now + 450;
        hitRt.bellyHeat = Math.max(0, hitRt.bellyHeat - 0.5);
        setMoodState('happy');
        setMoodText(pet.petQuote);
        setHappiness((h) => Math.min(100, h + 0.6));
        addBond(pet.id, 1);
        playPetSfx('purr', pet.voicePitch, pet.isRealCatSfx);
        spawnParticle(e.clientX, e.clientY, pet.isRealCatSfx ? (Math.random() < 0.5 ? '💖' : '🎵') : (Math.random() < 0.5 ? '💖' : '✨'));
      } else if (tool === 'belly') {
        hitRt.bellyHeat += 1;
        if (hitRt.bellyHeat >= pet.spicyThreshold) {
          hitRt.bellyHeat = 0;
          hitRt.spicyUntil = now + 1350;
          hitRt.bellyRoll = 0;
          setMoodState('spicy');
          setMoodText(pet.spicyQuote);
          setScratchFlash(true);
          setTimeout(() => setScratchFlash(false), 380);
          playPetSfx('spicy', pet.voicePitch, pet.isRealCatSfx);
          spawnParticle(e.clientX, e.clientY, '💢');
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
              navigator.vibrate(pet.isRealCatSfx ? [80, 30, 120] : 110);
            } catch {
              // ignore
            }
          }
        } else {
          hitRt.bellyRoll = 0.68;
          hitRt.happyHopUntil = now + 350;
          setMoodState('happy');
          setMoodText(pet.bellyQuote);
          setHappiness((h) => Math.min(100, h + 0.8));
          addBond(pet.id, 1);
          playPetSfx('purr', pet.voicePitch, pet.isRealCatSfx);
          spawnParticle(e.clientX, e.clientY, Math.random() < 0.5 ? '💕' : '🐾');
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      isPointerDownRef.current = true;
      updatePointerInteraction(e, true);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (activeToolRef.current === 'laser' || isPointerDownRef.current) {
        updatePointerInteraction(e, false);
      }
    };
    const onPointerUp = () => {
      isPointerDownRef.current = false;
      activeRubPetIdRef.current = null;
      Object.values(petsRuntimeRef.current).forEach((rt) => {
        rt.petTiltX = 0;
        rt.petTiltZ = 0;
        rt.bellyRoll = 0;
      });
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!stageRef.current) return;
      const nw = stageRef.current.clientWidth || window.innerWidth;
      const nh = stageRef.current.clientHeight || window.innerHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      const now = performance.now();
      const shared = cafeSharedRef.current;

      // Update laser dot
      if (shared.laserActive) {
        laserDot.visible = true;
        laserDot.position.copy(shared.laserTarget);
      } else {
        laserDot.visible = false;
      }

      // Update treat toss arc
      if (shared.treatArc.active) {
        const tp = (now - shared.treatArc.startedAt) / 520;
        if (tp >= 1) {
          shared.treatArc.active = false;
          treatMesh.visible = false;
        } else {
          treatMesh.visible = true;
          treatMesh.position.set(
            shared.treatArc.targetX * tp,
            0.25 + (1 - tp) * 1.4 + Math.sin(tp * Math.PI) * 1.4,
            3.6 + (shared.treatArc.targetZ - 3.6) * tp
          );
          treatMesh.rotation.x = elapsed * 10;
        }
      } else {
        treatMesh.visible = false;
      }

      // Update ALL pets with natural autonomous behavior!
      Object.values(petsRuntimeRef.current).forEach((rt, idx) => {
        if (rt.mixer) rt.mixer.update(dt);

        const isPhoto = Boolean(rt.meta.photoUrl);
        let isMovingNow = false;

        if (!isPhoto && rt.meta.moveSpeed > 0) {
          // 1. Laser Chase overrides idle wandering
          if (shared.laserActive) {
            const tx = shared.laserTarget.x + Math.cos(rt.laserOffsetAngle) * 0.55;
            const tz = shared.laserTarget.z + Math.sin(rt.laserOffsetAngle) * 0.55;
            const dx = tx - rt.root.position.x;
            const dz = tz - rt.root.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 0.25) {
              isMovingNow = true;
              const step = Math.min(dist, dt * rt.meta.moveSpeed * 1.55);
              rt.root.position.x += (dx / dist) * step;
              rt.root.position.z += (dz / dist) * step;
            }
            const targetYaw = Math.atan2(shared.laserTarget.x - rt.root.position.x, shared.laserTarget.z - rt.root.position.z);
            let diff = targetYaw - rt.root.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            rt.root.rotation.y += diff * 0.16;
          } else if (activeRubPetIdRef.current === rt.meta.id) {
            // Turn affectionately toward camera when being petted
            let diff = 0 - rt.root.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            rt.root.rotation.y += diff * 0.14;
          } else {
            // Autonomous Pet AI State Machine
            if (now >= rt.aiUntil) {
              const plan = pickNaturalTarget(rt.meta.id);
              rt.aiMode = plan.mode;
              rt.aiUntil = now + plan.durationMs;
              if (plan.mode === 'wander' || plan.mode === 'sniff_bowl') {
                rt.targetPos.copy(plan.pos);
              }
            }

            if (rt.aiMode === 'wander' || rt.aiMode === 'sniff_bowl') {
              const dx = rt.targetPos.x - rt.root.position.x;
              const dz = rt.targetPos.z - rt.root.position.z;
              const dist = Math.hypot(dx, dz);
              if (dist > 0.16) {
                isMovingNow = true;
                const step = Math.min(dist, dt * rt.meta.moveSpeed);
                rt.root.position.x += (dx / dist) * step;
                rt.root.position.z += (dz / dist) * step;
                const targetYaw = Math.atan2(dx, dz);
                let diff = targetYaw - rt.root.rotation.y;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                rt.root.rotation.y += diff * 0.1;
              } else if (rt.aiMode === 'sniff_bowl') {
                // Dip head slightly to sniff bowl
                rt.bodyPivot.rotation.x += (0.24 + Math.sin(elapsed * 8) * 0.06 - rt.bodyPivot.rotation.x) * 0.15;
              }
            } else if (rt.aiMode === 'idle_look') {
              // Curious gentle look toward camera
              const targetYaw = Math.atan2(-rt.root.position.x * 0.35, 4 - rt.root.position.z);
              let diff = targetYaw - rt.root.rotation.y;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              rt.root.rotation.y += diff * 0.05;
            }
          }

          // Crossfade GLB walk vs idle clip if available
          if (rt.walkAction && rt.idleAction) {
            if (isMovingNow && rt.activeClip !== 'walk') {
              rt.activeClip = 'walk';
              rt.idleAction.fadeOut(0.2);
              rt.walkAction.reset().fadeIn(0.2).play();
            } else if (!isMovingNow && rt.activeClip !== 'idle') {
              rt.activeClip = 'idle';
              rt.walkAction.fadeOut(0.25);
              rt.idleAction.reset().fadeIn(0.25).play();
            }
          }
        } else if (isPhoto && shared.laserActive) {
          // Photorealistic Kaokua leans playfully toward the laser
          rt.bodyPivot.scale.x = shared.laserTarget.x < -0.2 ? -1 : 1;
        } else if (isPhoto) {
          rt.bodyPivot.scale.x = 1;
        }

        // Natural breathing + realistic belly-cat dream twitch & purr squirm
        const isNapping = !isPhoto && !isMovingNow && rt.aiMode === 'nap' && now >= rt.happyHopUntil && now >= rt.eatUntil;
        const isBellyCat = Boolean(rt.meta.photoFlatOnFloor);
        const breath = isBellyCat
          ? 1 + Math.sin(elapsed * 2.1) * 0.048 // พุงกระเพื่อมหายใจชัดแบบแมวหลับลึก!
          : isNapping
            ? 0.84 + Math.sin(elapsed * 1.9 + idx) * 0.03
            : 1 + Math.sin(elapsed * 2.8 + idx) * 0.022;
        rt.bodyPivot.scale.y = breath;
        if (isBellyCat) {
          // เอฟเฟกต์กระตุกตัวเบาๆ เหมือนแมวละเมอฝัน + สั่นครืดๆ ตอนโดนลูบ
          const dreamTwitch = Math.sin(elapsed * 1.3) > 0.96 ? Math.sin(elapsed * 38) * 0.04 : 0;
          const purrVibe = now < rt.happyHopUntil ? Math.sin(elapsed * 45) * 0.018 : 0;
          rt.bodyPivot.scale.x = 1 + (breath - 1) * 0.5 + purrVibe;
          rt.root.rotation.y = dreamTwitch;
        }

        // Smooth tilt & belly roll
        const curiousTilt =
          !isMovingNow && rt.aiMode === 'idle_look' && rt.petTiltZ === 0
            ? Math.sin(elapsed * 1.7 + idx * 2) * 0.08
            : rt.petTiltZ;
        const targetRoll =
          rt.bellyRoll > 0 ? rt.bellyRoll + Math.sin(elapsed * 14) * 0.12 : curiousTilt;
        if (rt.aiMode !== 'sniff_bowl' || isMovingNow) {
          rt.bodyPivot.rotation.x += (rt.petTiltX - rt.bodyPivot.rotation.x) * 0.14;
        }
        rt.bodyPivot.rotation.z += (targetRoll - rt.bodyPivot.rotation.z) * 0.14;

        // Vertical gait / hop / spicy jump
        if (now < rt.spicyUntil) {
          rt.bodyPivot.position.y = Math.abs(Math.sin(elapsed * 26)) * 0.4;
          rt.bodyPivot.rotation.z = Math.sin(elapsed * 42) * 0.24;
        } else if (now < rt.eatUntil) {
          rt.bodyPivot.position.y = Math.abs(Math.sin(elapsed * 12 + idx)) * 0.14;
          rt.bodyPivot.rotation.x = 0.2 + Math.sin(elapsed * 15) * 0.1;
        } else if (now < rt.happyHopUntil) {
          rt.bodyPivot.position.y = Math.abs(Math.sin(elapsed * 14 + idx)) * 0.16;
        } else if (isMovingNow) {
          const hopAmp = rt.meta.id === 'bunny' ? 0.26 : 0.11;
          rt.bodyPivot.position.y = Math.abs(Math.sin(elapsed * 12 + idx)) * hopAmp;
        } else {
          rt.bodyPivot.position.y += (0 - rt.bodyPivot.position.y) * 0.12;
        }
      });

      // Gently pan camera lookAt slightly toward the currently selected pet while keeping the whole café visible!
      const focusedRt = petsRuntimeRef.current[selectedPetIdRef.current];
      const targetLookX = focusedRt ? THREE.MathUtils.clamp(focusedRt.root.position.x * 0.35, -1.2, 1.2) : 0;
      const targetLookZ = focusedRt ? THREE.MathUtils.clamp(focusedRt.root.position.z * 0.25, -0.5, 0.8) : 0.2;
      cameraLookAt.x += (targetLookX - cameraLookAt.x) * 0.05;
      cameraLookAt.z += (targetLookZ - cameraLookAt.z) * 0.05;
      camera.lookAt(cameraLookAt);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, [isOpen, qualityMode, addBond, handleFeedTreat, playPetSfx, spawnParticle]);

  if (!isOpen) return null;

  const bondLevel = Math.floor(bondExp / 50) + 1;
  const bondPct = Math.min(100, ((bondExp % 50) / 50) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-amber-950/90 flex flex-col overflow-hidden select-none">
      {/* Full-screen Living 3D Pet Café Stage */}
      <div
        ref={stageRef}
        className="fixed inset-0 w-full h-full z-0 touch-none cursor-pointer"
      />

      {/* Spicy Cat Claw Slash Scratch Flash (3 diagonal claw marks!) */}
      {scratchFlash && (
        <div className="fixed inset-0 z-30 pointer-events-none bg-rose-500/30 flex items-center justify-center">
          <svg viewBox="0 0 240 240" className="w-64 h-64 drop-shadow-[0_0_18px_rgba(244,63,94,0.95)] animate-ping">
            <path d="M35 195 Q105 110 195 30" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" fill="none" />
            <path d="M55 215 Q125 130 215 50" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" fill="none" />
            <path d="M20 170 Q90 85 170 15" stroke="#ef4444" strokeWidth="11" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      )}

      {/* Floating Heart / Sparkle Particles */}
      <div className="fixed inset-0 z-20 pointer-events-none overflow-hidden">
        {particles.map((pt) => (
          <div
            key={pt.id}
            style={{ left: pt.x, top: pt.y }}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl animate-bounce drop-shadow"
          >
            {pt.emoji}
          </div>
        ))}
      </div>

      {/* TOP HUD */}
      <div className="relative z-20 p-3 sm:p-4 pt-safe flex items-start justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-amber-950/85 backdrop-blur-md border-2 border-amber-300/90 rounded-2xl px-3.5 py-2 shadow-xl max-w-[72vw]">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{selectedPet.icon}</span>
            <div className="min-w-0">
              <div className="font-[family-name:var(--font-kanit)] font-extrabold text-sm sm:text-base text-amber-200 truncate">
                ☕ Pet Café • {selectedPet.name}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-amber-100/90">
                <span>💖 ความสุข {Math.round(happiness)}%</span>
                <span className="text-pink-300">⭐ สนิท Lv.{bondLevel}</span>
              </div>
            </div>
          </div>
          <div className="mt-1.5 w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-amber-400/60">
            <div
              className="h-full bg-gradient-to-r from-pink-400 via-amber-300 to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.max(8, bondPct)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
          <button
            type="button"
            onClick={handleCallAllPets}
            className="h-10 px-3 bg-amber-400 hover:bg-amber-300 text-stone-950 border-2 border-white rounded-xl font-extrabold text-xs flex items-center gap-1 shadow-xl cursor-pointer"
            title="สั่นกระดิ่งเรียกรวมตัวแก๊งสัตว์เลี้ยง!"
          >
            <span>🔔</span>
            <span className="hidden sm:inline">เรียกรวมตัว</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 bg-rose-600 hover:bg-rose-500 text-white border-2 border-amber-200 rounded-xl font-extrabold text-lg flex items-center justify-center shadow-xl cursor-pointer"
            title="ออกจากคาเฟ่"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Speech Bubble */}
      <div className="relative z-20 flex justify-center px-3 pointer-events-none">
        <div
          className={`px-4 py-1.5 rounded-full border-2 shadow-lg text-xs sm:text-sm font-extrabold transition ${moodState === 'spicy'
            ? 'bg-rose-600 text-white border-amber-200 animate-bounce'
            : moodState === 'happy' || moodState === 'eating'
              ? 'bg-pink-100 text-rose-900 border-pink-400'
              : 'bg-white/95 text-stone-800 border-amber-400'
            }`}
        >
          {loadingCount > 0
            ? `⏳ กำลังเปิดประตูคาเฟ่เรียกแก๊งสัตว์เลี้ยงออกมาต้อนรับ ${playerName}...`
            : `💬 ${moodText}`}
        </div>
      </div>

      {/* BOTTOM CONTROLS: Pet Focus Strip + Interaction Tools */}
      <div className="relative z-20 mt-auto p-3 sm:p-4 pb-safe flex flex-col items-center gap-2 pointer-events-none">
        {/* Pet Focus Strip (all 6 pets are in the room — tap to focus or tap directly on any pet!) */}
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto max-w-[96vw] bg-amber-950/80 backdrop-blur-md border-2 border-amber-400/70 rounded-2xl p-1.5 shadow-xl">
          {CAFE_PETS.map((pet) => (
            <button
              key={pet.id}
              type="button"
              onClick={() => {
                setSelectedPetId(pet.id);
                setMoodState('chill');
                setMoodText(pet.idleQuote);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition whitespace-nowrap shrink-0 ${selectedPetId === pet.id
                ? 'bg-amber-300 text-stone-950 shadow'
                : 'bg-amber-900/60 text-amber-100 hover:bg-amber-800/80'
                }`}
            >
              <span>{pet.icon}</span>
              <span>{pet.speciesLabel}</span>
            </button>
          ))}
        </div>

        {/* Interaction Tool Dock */}
        <div className="pointer-events-auto grid grid-cols-4 gap-1.5 sm:gap-2 w-full max-w-md bg-slate-950/85 backdrop-blur-md border-2 border-amber-300 rounded-2xl p-2 shadow-2xl">
          <button
            type="button"
            onClick={() => setActiveTool('pet')}
            className={`rounded-xl py-2 px-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition border-2 ${activeTool === 'pet'
              ? 'bg-pink-400 text-black border-white shadow'
              : 'bg-slate-900 text-pink-200 border-slate-700 hover:border-pink-400'
              }`}
          >
            <span className="text-lg leading-none">✋</span>
            <span className="text-[10.5px] font-extrabold">ลูบหัว</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('belly')}
            className={`rounded-xl py-2 px-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition border-2 ${activeTool === 'belly'
              ? 'bg-amber-400 text-black border-white shadow'
              : 'bg-slate-900 text-amber-200 border-slate-700 hover:border-amber-400'
              }`}
          >
            <span className="text-lg leading-none">🐾</span>
            <span className="text-[10.5px] font-extrabold">เกาพุง</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('laser')}
            className={`rounded-xl py-2 px-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition border-2 ${activeTool === 'laser'
              ? 'bg-rose-500 text-white border-white shadow'
              : 'bg-slate-900 text-rose-200 border-slate-700 hover:border-rose-400'
              }`}
          >
            <span className="text-lg leading-none">🔴</span>
            <span className="text-[10.5px] font-extrabold">เลเซอร์</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTool('treat');
              handleFeedTreat();
            }}
            className={`rounded-xl py-2 px-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition border-2 ${activeTool === 'treat'
              ? 'bg-emerald-400 text-black border-white shadow'
              : 'bg-slate-900 text-emerald-200 border-slate-700 hover:border-emerald-400'
              }`}
          >
            <span className="text-lg leading-none">{selectedPet.treatIcon}</span>
            <span className="text-[10.5px] font-extrabold truncate max-w-full">
              {selectedPet.treatLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
