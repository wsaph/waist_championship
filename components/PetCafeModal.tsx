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
  voicePitch: number;
  spicyThreshold: number; // how much belly rub before swatting!
  treatLabel: string;
  treatIcon: string;
  idleQuote: string;
  petQuote: string;
  bellyQuote: string;
  spicyQuote: string;
  eatQuote: string;
}

const CAFE_PETS: CafePetOption[] = [
  {
    id: 'husky',
    name: 'น้องข้าวคั่ว (สมจริง!)',
    speciesLabel: 'ข้าวคั่ว ฮัสกี้',
    icon: '🐺',
    modelUrl: '/models/husky_hero.glb',
    photoUrl: '/images/kaokua_husky.png',
    voicePitch: 360,
    spicyThreshold: 34,
    treatLabel: 'ป้อนหมูย่าง',
    treatIcon: '🍖',
    idleQuote: 'โฮ่ง! ข้าวคั่วเป็นลูกสาวนะ ไม่ใช่บักข้าวคั่ว!',
    petQuote: 'วู้ววว~ เกาคางหน่อย ชอบมากกก!',
    bellyQuote: 'แฮ่กๆ เกาพุงแรงๆ เลยมนุษย์ ชอบๆ!',
    spicyQuote: 'บรู้ววว!! จั๊กจี้โว้ยยย พอก่อน! 🐺💢',
    eatQuote: 'งับ!! ของโปรดเลย ขอกินอีกชิ้น! 🍖✨',
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
    idleQuote: 'เหมียว~ มานั่งเล่นกันสิ',
    petQuote: 'ครืดดด~ ลูบหัวตรงนี้แหละฟินสุด!',
    bellyQuote: 'อื้มม~ เกาพุงเบาๆ นะมนุษย์...',
    spicyQuote: 'แง้ว!! เกาพุงนานเกินไปแล้วนะ งั่มมือซะเลย! 😾',
    eatQuote: 'งั่มๆ อร่อยจังเลยเหมียว! 🐟💖',
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
    idleQuote: 'บ๊อกๆ! อยากวิ่งไล่เลเซอร์จังเลย!',
    petQuote: 'หูตั้งดุ๊กดิ๊ก~ ลูบอีกๆ!',
    bellyQuote: 'นอนหงายพุงรอเลย เกาอีกๆ!',
    spicyQuote: 'บ๊อก! จั๊กจี้พุงแล้วนะมนุษย์! 🐶',
    eatQuote: 'กรุบกรอบ! อร่อยสุดๆ เลยบ๊อก! 🦴💛',
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
    idleQuote: 'นิ่งสงบสยบทุกความเครียด... 🍊',
    petQuote: 'ฟิน... จะหลับแล้วนะ...',
    bellyQuote: 'เกาไปเลย สบายตัวสุดๆ...',
    spicyQuote: 'อือ... ขยับหนีนิดนึง จั๊กจี้เบาๆ',
    eatQuote: 'งั่ม... ส้มหวานมาก ชีวิตดี๊ดี 🍊✨',
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
    idleQuote: 'กิ๊ว~ แอบมองอยู่นะ!',
    petQuote: 'หางฟูเลย~ ลูบหูนุ่มๆ สิ!',
    bellyQuote: 'ยอมให้เกาพุงแป๊บเดียวนะ!',
    spicyQuote: 'กิ๊ว!! พอแล้ว เดี๋ยวงับนิ้วเลย! 🦊💢',
    eatQuote: 'งั่มๆ เบอร์รี่หวานฉ่ำ! 🍓💖',
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
    idleQuote: 'ดุ๊กดิ๊กๆ~ แครอทอยู่ไหนน้า',
    petQuote: 'หูตกสบายใจ~ ลูบเบาๆ นะ',
    bellyQuote: 'พุงนุ่มๆ เกาเบาๆ จั๊กจี้น้า~',
    spicyQuote: 'ตุ้บ! กระทืบเท้าดุแล้วนะ! 🐰💢',
    eatQuote: 'กร้วมๆ แครอทกรอบมาก! 🥕✨',
  },
];

type CafeTool = 'pet' | 'belly' | 'laser' | 'treat';

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

export function PetCafeModal({
  isOpen,
  onClose,
  qualityMode = 'auto',
  playerName = 'ผู้กล้า',
}: PetCafeModalProps) {
  const [selectedPetId, setSelectedPetId] = useState<string>('husky');
  const [activeTool, setActiveTool] = useState<CafeTool>('pet');
  const [moodText, setMoodText] = useState<string>(CAFE_PETS[0].idleQuote);
  const [moodState, setMoodState] = useState<'chill' | 'happy' | 'spicy' | 'play' | 'eating'>('chill');
  const [happiness, setHappiness] = useState<number>(68);
  const [bondExp, setBondExp] = useState<number>(0);
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const [loadingModel, setLoadingModel] = useState<boolean>(true);
  const [scratchFlash, setScratchFlash] = useState<boolean>(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const activeToolRef = useRef<CafeTool>('pet');
  const selectedPetRef = useRef<CafePetOption>(CAFE_PETS[0]);
  const isPointerDownRef = useRef<boolean>(false);
  const bellyHeatRef = useRef<number>(0);
  const lastParticleAtRef = useRef<number>(0);
  const lastSfxAtRef = useRef<number>(0);
  const particleIdRef = useRef<number>(1);

  // Refs shared with 3D loop
  const petStateRef = useRef<{
    petTiltX: number;
    petTiltZ: number;
    bellyRoll: number;
    happyHopUntil: number;
    spicyUntil: number;
    eatUntil: number;
    laserActive: boolean;
    laserTarget: THREE.Vector3;
    treatArc: { active: boolean; startedAt: number; targetX: number; targetZ: number };
  }>({
    petTiltX: 0,
    petTiltZ: 0,
    bellyRoll: 0,
    happyHopUntil: 0,
    spicyUntil: 0,
    eatUntil: 0,
    laserActive: false,
    laserTarget: new THREE.Vector3(0, 0.06, 0),
    treatArc: { active: false, startedAt: 0, targetX: 0, targetZ: 0.7 },
  });

  const selectedPet = CAFE_PETS.find((p) => p.id === selectedPetId) || CAFE_PETS[0];

  useEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== 'laser') {
      petStateRef.current.laserActive = false;
    }
  }, [activeTool]);

  useEffect(() => {
    selectedPetRef.current = selectedPet;
    setMoodText(selectedPet.idleQuote);
    setMoodState('chill');
    bellyHeatRef.current = 0;
    try {
      const saved = localStorage.getItem(`waist_pet_cafe_bond_${selectedPet.id}`);
      setBondExp(saved ? Math.max(0, Number(saved) || 0) : 0);
    } catch {
      setBondExp(0);
    }
  }, [selectedPet]);

  const addBond = useCallback((petId: string, delta: number) => {
    setBondExp((prev) => {
      const next = prev + delta;
      try {
        localStorage.setItem(`waist_pet_cafe_bond_${petId}`, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const playPetSfx = useCallback((kind: 'purr' | 'spicy' | 'eat' | 'laser') => {
    const now = performance.now();
    if (kind === 'purr' && now - lastSfxAtRef.current < 320) return;
    lastSfxAtRef.current = now;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const t = ctx.currentTime;
      const base = selectedPetRef.current.voicePitch;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      if (kind === 'purr') {
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
      } else if (kind === 'eat') {
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
      setTimeout(() => ctx.close().catch(() => {}), 400);
    } catch {
      // ignore
    }
  }, []);

  const spawnParticle = useCallback((clientX: number, clientY: number, emoji: string) => {
    const now = performance.now();
    if (now - lastParticleAtRef.current < 130) return;
    lastParticleAtRef.current = now;
    const id = particleIdRef.current++;
    setParticles((prev) => [...prev.slice(-14), { id, x: clientX, y: clientY, emoji }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 900);
  }, []);

  const handleFeedTreat = useCallback(() => {
    const pet = selectedPetRef.current;
    const now = performance.now();
    petStateRef.current.treatArc = {
      active: true,
      startedAt: now,
      targetX: (Math.random() - 0.5) * 0.6,
      targetZ: 0.75,
    };
    petStateRef.current.eatUntil = now + 1800;
    petStateRef.current.happyHopUntil = now + 1400;
    bellyHeatRef.current = Math.max(0, bellyHeatRef.current - 12);
    setMoodState('eating');
    setMoodText(pet.eatQuote);
    setHappiness((h) => Math.min(100, h + 12));
    addBond(pet.id, 15);
    playPetSfx('eat');
  }, [addBond, playPetSfx]);

  // 3D Cozy Pet Café Scene
  useEffect(() => {
    if (!isOpen) return;
    const container = stageRef.current;
    if (!container) return;

    const qCfg = getQualityConfig(qualityMode);
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfef3c7); // Warm sunlit café cream
    scene.fog = new THREE.Fog(0xfef3c7, 10, 24);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
    camera.position.set(0, 2.35, 5.1);
    camera.lookAt(0, 0.85, 0);

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
    const hemi = new THREE.HemisphereLight(0xfffbeb, 0xd97706, 1.15);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff7ed, 1.45);
    sun.position.set(4.5, 7.5, 5.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(qCfg.shadowMapSize, qCfg.shadowMapSize);
    scene.add(sun);

    const warmLamp = new THREE.PointLight(0xfdba74, 1.2, 12);
    warmLamp.position.set(-2.5, 3.2, 1.5);
    scene.add(warmLamp);

    // Cozy Wood Floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 40),
      new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.78 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Soft Pastel Café Rug
    const rug = new THREE.Mesh(
      new THREE.CylinderGeometry(2.35, 2.4, 0.06, 36),
      new THREE.MeshStandardMaterial({ color: 0xfce7f3, roughness: 0.92 })
    );
    rug.position.y = 0.03;
    rug.receiveShadow = true;
    scene.add(rug);

    const rugTrim = new THREE.Mesh(
      new THREE.TorusGeometry(2.36, 0.06, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.85 })
    );
    rugTrim.rotation.x = Math.PI / 2;
    rugTrim.position.y = 0.06;
    scene.add(rugTrim);

    // Cozy Café Backdrop Props (Cat Tree + Window Frame + Plant + Cushion)
    const catTree = new THREE.Group();
    catTree.position.set(-2.4, 0, -2.0);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.2, 2.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xd6b48c, roughness: 0.95 })
    );
    post.position.y = 1.1;
    const perch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 0.14, 16),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.85 })
    );
    perch.position.y = 2.22;
    catTree.add(post, perch);
    scene.add(catTree);

    // Coffee table + steaming mug on right
    const tableGroup = new THREE.Group();
    tableGroup.position.set(2.55, 0, -1.7);
    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.1, 18),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 })
    );
    tableTop.position.y = 1.05;
    const tableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 1.05, 10),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
    );
    tableLeg.position.y = 0.52;
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.12, 0.24, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    mug.position.set(-0.1, 1.22, 0.1);
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

    // Pet Root Group
    const petRoot = new THREE.Group();
    petRoot.position.set(0, 0.06, 0);
    scene.add(petRoot);

    const petBodyPivot = new THREE.Group();
    petRoot.add(petBodyPivot);

    let mixer: THREE.AnimationMixer | null = null;
    let disposed = false;

    setLoadingModel(true);
    if (selectedPet.photoUrl) {
      // โหมด 2.5D ภาพสมจริง (วางบนพรมคาเฟ่ 3D พร้อมเงา ลูบหัว เกาพุง ไล่เลเซอร์ ป้อนขนมได้ครบ!)
      const texLoader = new THREE.TextureLoader();
      texLoader.load(
        selectedPet.photoUrl,
        (tex) => {
          if (disposed) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          const img = tex.image as HTMLImageElement | undefined;
          const aspect = img && img.height > 0 ? img.width / img.height : 1.18;
          const planeH = 2.05;
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
          photoMesh.position.set(0, planeH / 2 - 0.04, 0);
          petBodyPivot.add(photoMesh);

          // Soft ground shadow oval under the photorealistic pet
          const shadowOval = new THREE.Mesh(
            new THREE.CircleGeometry(planeW * 0.42, 24),
            new THREE.MeshBasicMaterial({
              color: 0x000000,
              transparent: true,
              opacity: 0.22,
              depthWrite: false,
            })
          );
          shadowOval.rotation.x = -Math.PI / 2;
          shadowOval.scale.set(1, 0.55, 1);
          shadowOval.position.y = 0.02;
          petRoot.add(shadowOval);

          setLoadingModel(false);
        },
        undefined,
        () => {
          if (!disposed) setLoadingModel(false);
        }
      );
    } else {
      const loader = new GLTFLoader();
      loader.load(
        selectedPet.modelUrl,
        (gltf) => {
          if (disposed) {
            disposeObject3D(gltf.scene);
            return;
          }
          const model = gltf.scene;
          // Normalize bounding box so every pet (.glb or custom realistic .glb) sits nicely at ~1.65m height on the rug!
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const maxDim = Math.max(size.x, size.y, size.z, 0.01);
          const scale = 1.65 / maxDim;
          model.scale.setScalar(scale);
          model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
          model.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          petBodyPivot.add(model);

          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            const idleClip =
              gltf.animations.find((a) => /idle|sit|breath|stand/i.test(a.name)) || gltf.animations[0];
            mixer.clipAction(idleClip).play();
          }
          setLoadingModel(false);
        },
        undefined,
        () => {
          if (!disposed) setLoadingModel(false);
        }
      );
    }

    // Pointer Interaction (Pet Head / Rub Belly / Chase Laser)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
    const hitPoint = new THREE.Vector3();

    const updatePointerInteraction = (e: PointerEvent, isDownEvent: boolean) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const tool = activeToolRef.current;
      const pet = selectedPetRef.current;
      const st = petStateRef.current;

      if (tool === 'laser') {
        if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
          const clampedR = Math.min(2.15, Math.hypot(hitPoint.x, hitPoint.z));
          const ang = Math.atan2(hitPoint.z, hitPoint.x);
          st.laserTarget.set(Math.cos(ang) * clampedR, 0.08, Math.sin(ang) * clampedR);
          st.laserActive = true;
          setMoodState('play');
          setMoodText('🔴 สายตาจ้องเลเซอร์ไม่กะพริบ! วิ่งไล่ใหญ่เลย!');
        }
        return;
      }

      if (tool === 'treat' && isDownEvent) {
        handleFeedTreat();
        spawnParticle(e.clientX, e.clientY, pet.treatIcon);
        return;
      }

      if (!isPointerDownRef.current && !isDownEvent) return;

      // Check if touching/rubbing the pet
      const petHits = raycaster.intersectObject(petBodyPivot, true);
      if (petHits.length === 0) return;

      const now = performance.now();
      if (tool === 'pet') {
        st.petTiltZ = THREE.MathUtils.clamp(-pointer.x * 0.32, -0.28, 0.28);
        st.petTiltX = 0.14;
        st.happyHopUntil = now + 450;
        bellyHeatRef.current = Math.max(0, bellyHeatRef.current - 0.5);
        setMoodState('happy');
        setMoodText(pet.petQuote);
        setHappiness((h) => Math.min(100, h + 0.6));
        addBond(pet.id, 1);
        playPetSfx('purr');
        spawnParticle(e.clientX, e.clientY, Math.random() < 0.5 ? '💖' : '✨');
      } else if (tool === 'belly') {
        bellyHeatRef.current += 1;
        if (bellyHeatRef.current >= pet.spicyThreshold) {
          // Cat/Pet gets spicy & swats hand!
          bellyHeatRef.current = 0;
          st.spicyUntil = now + 1350;
          st.bellyRoll = 0;
          setMoodState('spicy');
          setMoodText(pet.spicyQuote);
          setScratchFlash(true);
          setTimeout(() => setScratchFlash(false), 320);
          playPetSfx('spicy');
          spawnParticle(e.clientX, e.clientY, '💢');
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
              navigator.vibrate(110);
            } catch {
              // ignore
            }
          }
        } else {
          st.bellyRoll = 0.68;
          st.happyHopUntil = now + 350;
          setMoodState('happy');
          setMoodText(pet.bellyQuote);
          setHappiness((h) => Math.min(100, h + 0.8));
          addBond(pet.id, 1);
          playPetSfx('purr');
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
      petStateRef.current.petTiltX = 0;
      petStateRef.current.petTiltZ = 0;
      petStateRef.current.bellyRoll = 0;
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
      const st = petStateRef.current;

      if (mixer) mixer.update(dt);

      // Gentle breathing
      const breath = 1 + Math.sin(elapsed * 2.8) * 0.022;
      petBodyPivot.scale.set(1, breath, 1);

      // Smoothly interpolate head tilt & belly roll
      petBodyPivot.rotation.x += (st.petTiltX - petBodyPivot.rotation.x) * 0.14;
      const targetRoll = st.bellyRoll > 0 ? st.bellyRoll + Math.sin(elapsed * 14) * 0.12 : st.petTiltZ;
      petBodyPivot.rotation.z += (targetRoll - petBodyPivot.rotation.z) * 0.14;

      if (now < st.spicyUntil) {
        // Spicy swat jump!
        petBodyPivot.position.y = Math.abs(Math.sin(elapsed * 26)) * 0.42;
        petBodyPivot.rotation.z = Math.sin(elapsed * 42) * 0.25;
      } else if (now < st.eatUntil) {
        petBodyPivot.position.y = Math.abs(Math.sin(elapsed * 12)) * 0.14;
        petBodyPivot.rotation.x = 0.22 + Math.sin(elapsed * 16) * 0.12;
      } else if (now < st.happyHopUntil) {
        petBodyPivot.position.y = Math.abs(Math.sin(elapsed * 14)) * 0.16;
      } else {
        petBodyPivot.position.y += (0 - petBodyPivot.position.y) * 0.12;
      }

      // Laser pointer chase!
      if (st.laserActive) {
        laserDot.visible = true;
        laserDot.position.copy(st.laserTarget);
        const dx = st.laserTarget.x - petRoot.position.x;
        const dz = st.laserTarget.z - petRoot.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.28) {
          const step = Math.min(dist, dt * 2.5);
          petRoot.position.x += (dx / dist) * step;
          petRoot.position.z += (dz / dist) * step;
          petBodyPivot.position.y = Math.abs(Math.sin(elapsed * 16)) * 0.22;
        }
        // For 2.5D photorealistic pet, keep facing camera & flip horizontally toward laser; for 3D GLB, rotate yaw
        if (selectedPetRef.current.photoUrl) {
          petBodyPivot.scale.x = dx < -0.1 ? -1 : 1;
        } else {
          const targetYaw = Math.atan2(dx, dz);
          let diff = targetYaw - petRoot.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          petRoot.rotation.y += diff * 0.18;
        }
      } else {
        laserDot.visible = false;
        // Gently drift back toward rug center & face camera
        petRoot.position.x += (0 - petRoot.position.x) * 0.03;
        petRoot.position.z += (0 - petRoot.position.z) * 0.03;
        let diff = 0 - petRoot.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        petRoot.rotation.y += diff * 0.06;
      }

      // Treat toss arc
      if (st.treatArc.active) {
        const tp = (now - st.treatArc.startedAt) / 520;
        if (tp >= 1) {
          st.treatArc.active = false;
          treatMesh.visible = false;
        } else {
          treatMesh.visible = true;
          treatMesh.position.set(
            st.treatArc.targetX * tp,
            0.25 + (1 - tp) * 1.4 + Math.sin(tp * Math.PI) * 1.3,
            3.2 + (st.treatArc.targetZ - 3.2) * tp
          );
          treatMesh.rotation.x = elapsed * 10;
        }
      } else {
        treatMesh.visible = false;
      }

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
  }, [isOpen, selectedPet.modelUrl, selectedPet.photoUrl, qualityMode, addBond, handleFeedTreat, playPetSfx, spawnParticle]);

  if (!isOpen) return null;

  const bondLevel = Math.floor(bondExp / 50) + 1;
  const bondPct = Math.min(100, ((bondExp % 50) / 50) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-amber-950/90 flex flex-col overflow-hidden select-none">
      {/* Full-screen 3D Cozy Pet Café Stage */}
      <div
        ref={stageRef}
        className="fixed inset-0 w-full h-full z-0 touch-none cursor-pointer"
      />

      {/* Spicy Claw Scratch Flash */}
      {scratchFlash && (
        <div className="fixed inset-0 z-30 pointer-events-none bg-rose-500/35 flex items-center justify-center">
          <div className="text-7xl animate-ping">💢</div>
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
        <div className="pointer-events-auto bg-amber-950/85 backdrop-blur-md border-2 border-amber-300/90 rounded-2xl px-3.5 py-2 shadow-xl max-w-[75vw]">
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

        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto w-10 h-10 bg-rose-600 hover:bg-rose-500 text-white border-2 border-amber-200 rounded-xl font-extrabold text-lg flex items-center justify-center shadow-xl cursor-pointer shrink-0"
          title="ออกจากคาเฟ่"
        >
          ✕
        </button>
      </div>

      {/* Speech Bubble */}
      <div className="relative z-20 flex justify-center px-3 pointer-events-none">
        <div
          className={`px-4 py-1.5 rounded-full border-2 shadow-lg text-xs sm:text-sm font-extrabold transition ${
            moodState === 'spicy'
              ? 'bg-rose-600 text-white border-amber-200 animate-bounce'
              : moodState === 'happy' || moodState === 'eating'
              ? 'bg-pink-100 text-rose-900 border-pink-400'
              : 'bg-white/95 text-stone-800 border-amber-400'
          }`}
        >
          {loadingModel ? `⏳ กำลังเรียก ${selectedPet.name} ออกมาต้อนรับ ${playerName}...` : `💬 ${moodText}`}
        </div>
      </div>

      {/* BOTTOM CONTROLS: Pet Selector + Interaction Tools */}
      <div className="relative z-20 mt-auto p-3 sm:p-4 pb-safe flex flex-col items-center gap-2 pointer-events-none">
        {/* Pet Switcher Strip */}
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto max-w-[96vw] bg-amber-950/80 backdrop-blur-md border-2 border-amber-400/70 rounded-2xl p-1.5 shadow-xl">
          {CAFE_PETS.map((pet) => (
            <button
              key={pet.id}
              type="button"
              onClick={() => setSelectedPetId(pet.id)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition whitespace-nowrap shrink-0 ${
                selectedPetId === pet.id
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
            className={`rounded-xl py-2 px-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition border-2 ${
              activeTool === 'pet'
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
            className={`rounded-xl py-2 px-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition border-2 ${
              activeTool === 'belly'
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
            className={`rounded-xl py-2 px-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition border-2 ${
              activeTool === 'laser'
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
            className={`rounded-xl py-2 px-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition border-2 ${
              activeTool === 'treat'
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
