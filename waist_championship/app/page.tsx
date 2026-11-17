'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import confetti from 'canvas-confetti';
import { Trophy, Scale, UserPlus } from 'lucide-react';

interface Player {
  id: number;
  name: string;
  emoji: string;
  colorHex: string;
  startWeight: number;
  currentWeight: number;
  goalWeight: number;
  taunt: string;
  lostKg?: number;
  pctLost?: number;
  progressRatio?: number;
  bellyScale?: number;
}

interface FeedItem {
  id: number;
  user: string;
  emoji: string;
  weight: number;
  diff: number;
  roast: string;
  excuse: string;
  time: string;
}

const STYLES = [
  { bodyColor: 0x38BDF8, bandColor: 0xFFE600, accessory: 'headband' },
  { bodyColor: 0xA3E635, bandColor: 0xFF4D8D, accessory: 'ears' },
  { bodyColor: 0xFACC15, bandColor: 0x18181B, accessory: 'shades' },
  { bodyColor: 0xF472B6, bandColor: 0xFFFFFF, accessory: 'cat' },
  { bodyColor: 0xFB923C, bandColor: 0xEF4444, accessory: 'chubby' },
  { bodyColor: 0xC084FC, bandColor: 0xFFE600, accessory: 'ears' },
];

const EXCUSES = [
  { icon: '🥓', text: 'ชาบูเมื่อคืนเป็นเหตุ 🥓' },
  { icon: '🥗', text: 'คลีนจัดปลัดบอก 🥗' },
  { icon: '💧', text: 'บวมน้ำเฉยๆ ไม่ได้อ้วน 💧' },
  { icon: '👟', text: 'เดิน 10,000 ก้าวแล้ว 👟' },
  { icon: '🧋', text: 'แพ้ชานมไข่มุก 🧋' },
  { icon: '💪', text: 'กล้ามเนื้อล้วนๆ 💪' },
];

const AVATARS = ['🦊', '🐰', '🐸', '🐱', '🐷', '🐼', '🐶', '🦁', '🐨', '🦄'];

const TRACK_START_X = -13;
const TRACK_END_X = 13;

export default function Arena3DPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [roastFeed, setRoastFeed] = useState<FeedItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [shakeScreen, setShakeScreen] = useState(false);

  // Modal อัปเดตน้ำหนัก
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(1);
  const [pinInput, setPinInput] = useState('');
  const [newWeightInput, setNewWeightInput] = useState('');
  const [selectedExcuse, setSelectedExcuse] = useState(EXCUSES[0].text);
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal สมัครลงแข่ง
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinEmoji, setJoinEmoji] = useState('🦊');
  const [joinPin, setJoinPin] = useState('');
  const [joinStart, setJoinStart] = useState('');
  const [joinGoal, setJoinGoal] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; emoji: string; title: string; text: string }>({
    show: false,
    emoji: '🎉',
    title: '',
    text: '',
  });

  // Three.js Refs
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraTargetPosRef = useRef<THREE.Vector3 | null>(null);
  const cameraLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.2, 0));
  const charMeshesRef = useRef<any[]>([]);
  const leaderIdRef = useRef<number | null>(null);
  const loserIdRef = useRef<number | null>(null);

  const showToast = (emoji: string, title: string, text: string) => {
    setToast({ show: true, emoji, title, text });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 4000);
  };

  const fetchArenaData = useCallback(async () => {
    try {
      const res = await fetch('/api/weights');
      const data = await res.json();
      if (data.participants) {
        setPlayers(data.participants);
        if (data.participants.length > 0) {
          setSelectedPlayerId((prev) =>
            data.participants.some((p: Player) => p.id === prev) ? prev : data.participants[0].id
          );
        }
      }
      if (data.feed) setRoastFeed(data.feed);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchArenaData();
  }, [fetchArenaData]);

  // คำนวณอันดับและค่า Scaling
  const rankedPlayers = React.useMemo(() => {
    return players
      .map((p) => {
        const lostKg = p.startWeight - p.currentWeight;
        const pctLost = p.startWeight > 0 ? (lostKg / p.startWeight) * 100 : 0;
        const totalGoalKg = p.startWeight - p.goalWeight;
        const progressRatio = totalGoalKg > 0 ? Math.max(0, Math.min(1, lostKg / totalGoalKg)) : 0;
        const weightDiffRatio = p.startWeight > 0 ? (p.currentWeight - p.startWeight) / p.startWeight : 0;
        const bellyScale = Math.max(0.76, Math.min(1.48, 1.0 + weightDiffRatio * 4.2));

        return {
          ...p,
          lostKg: Number(lostKg.toFixed(1)),
          pctLost: Number(pctLost.toFixed(2)),
          progressRatio,
          bellyScale,
        };
      })
      .sort((a, b) => (b.pctLost ?? 0) - (a.pctLost ?? 0));
  }, [players]);

  const focusOnCharacter = useCallback((playerId: number) => {
    const charObj = charMeshesRef.current.find((c) => c.id === playerId);
    if (!charObj) return;
    const pos = charObj.rootGroup.position;
    cameraLookAtRef.current.set(pos.x, 1.6, pos.z);
    cameraTargetPosRef.current = new THREE.Vector3(pos.x + 2.5, 5.2, pos.z + 7.5);
  }, []);

  const setCameraView = (mode: 'overview' | 'leader' | 'loser') => {
    if (mode === 'overview') {
      cameraTargetPosRef.current = new THREE.Vector3(0, 15, 22);
      cameraLookAtRef.current.set(0, 1.2, 0);
    } else if (mode === 'leader' && leaderIdRef.current !== null) {
      focusOnCharacter(leaderIdRef.current);
    } else if (mode === 'loser' && loserIdRef.current !== null) {
      focusOnCharacter(loserIdRef.current);
    }
  };

  // สร้างฉาก 3D เหมือนต้นแบบ 100%
  useEffect(() => {
    if (!canvasRef.current || !labelsRef.current || rankedPlayers.length === 0) return;

    const container = canvasRef.current;
    const labelsContainer = labelsRef.current;
    container.innerHTML = '';
    labelsContainer.innerHTML = '';

    leaderIdRef.current = rankedPlayers[0].id;
    loserIdRef.current = rankedPlayers[rankedPlayers.length - 1].id;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xdbeafe, 0.014);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 15, 22);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minDistance = 8;
    controls.maxDistance = 42;
    controls.target.copy(cameraLookAtRef.current);
    controlsRef.current = controls;

    controls.addEventListener('start', () => {
      cameraTargetPosRef.current = null;
    });

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfef08a, 0.75);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(12, 24, 14);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 65;
    const d = 22;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // ปรับความกว้างเกาะตามจำนวนผู้เล่นจริง
    const laneCount = Math.max(5, players.length);
    const trackDepth = laneCount * 2.4 + 0.6;
    const islandDepth = trackDepth + 4.4;

    // เกาะลอยฟ้าฐานหญ้าสีเขียว
    const island = new THREE.Mesh(
      new THREE.BoxGeometry(34, 2.2, islandDepth),
      new THREE.MeshStandardMaterial({ color: 0x86EFAC, roughness: 0.7 })
    );
    island.position.set(0, -1.15, 0);
    island.receiveShadow = true;
    scene.add(island);

    // ชั้นดินใต้เกาะ
    const dirt = new THREE.Mesh(
      new THREE.BoxGeometry(33.2, 1.8, islandDepth - 0.8),
      new THREE.MeshStandardMaterial({ color: 0xFDBA74, roughness: 0.9 })
    );
    dirt.position.set(0, -3.1, 0);
    scene.add(dirt);

    // พื้นลู่วิ่งสีชมพูอมแดง
    const track = new THREE.Mesh(
      new THREE.BoxGeometry(29, 0.25, trackDepth),
      new THREE.MeshStandardMaterial({ color: 0xFB7185, roughness: 0.6 })
    );
    track.position.set(0, 0.05, 0);
    track.receiveShadow = true;
    scene.add(track);

    // เส้นแบ่งเลนสีขาว
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const halfTrackZ = (laneCount * 2.4) / 2;
    for (let i = 0; i <= laneCount; i++) {
      const zPos = -halfTrackZ + i * 2.4;
      const line = new THREE.Mesh(new THREE.BoxGeometry(28.5, 0.04, 0.12), lineMat);
      line.position.set(0, 0.19, zPos);
      scene.add(line);
    }

    // เส้น Start ด้านซ้าย
    const startLine = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, trackDepth - 0.2), lineMat);
    startLine.position.set(TRACK_START_X, 0.2, 0);
    scene.add(startLine);

    // เส้นชัยตารางหมากรุกด้านขวา
    const checkerGroup = new THREE.Group();
    const sqSize = 0.6;
    const rows = Math.floor((trackDepth - 0.4) / sqSize);
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x18181B });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 3; c++) {
        const sq = new THREE.Mesh(
          new THREE.BoxGeometry(sqSize, 0.06, sqSize),
          (r + c) % 2 === 0 ? blackMat : whiteMat
        );
        sq.position.set(TRACK_END_X - 0.6 + c * sqSize, 0.2, -(rows * sqSize) / 2 + r * sqSize + sqSize / 2);
        checkerGroup.add(sq);
      }
    }
    scene.add(checkerGroup);

    // ซุ้มประตูเส้นชัย + ถ้วยรางวัลยักษ์
    const archGroup = new THREE.Group();
    const pillarGeo = new THREE.CylinderGeometry(0.35, 0.4, 5.2, 16);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xFFE600, roughness: 0.3 });

    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(TRACK_END_X, 2.6, -halfTrackZ - 0.3);
    leftPillar.castShadow = true;
    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(TRACK_END_X, 2.6, halfTrackZ + 0.3);
    rightPillar.castShadow = true;

    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, trackDepth + 0.8),
      new THREE.MeshStandardMaterial({ color: 0x18181B, roughness: 0.4 })
    );
    banner.position.set(TRACK_END_X, 5.2, 0);
    banner.castShadow = true;

    const trophyMesh = new THREE.Group();
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xFACC15, metalness: 0.6, roughness: 0.2 });
    const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.35, 1.1, 16), cupMat);
    cupBody.position.y = 0.7;
    const cupBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.3, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x18181B })
    );
    cupBase.position.y = 0.15;
    trophyMesh.add(cupBody, cupBase);
    trophyMesh.position.set(TRACK_END_X, 5.8, 0);

    archGroup.add(leftPillar, rightPillar, banner, trophyMesh);
    scene.add(archGroup);

    // ต้นไม้ Low-poly รอบสนาม
    const treeZ = halfTrackZ + 1.5;
    const treePositions = [
      [-14, -treeZ], [-6, -treeZ - 0.1], [4, -treeZ], [14.5, -treeZ + 0.1],
      [-13.5, treeZ], [-3, treeZ + 0.1], [7, treeZ], [14.5, treeZ - 0.1],
    ];
    treePositions.forEach(([tx, tz], idx) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.3, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x92400E })
      );
      trunk.position.y = 0.6;
      trunk.castShadow = true;
      const leaves = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.05, 1),
        new THREE.MeshStandardMaterial({ color: idx % 2 === 0 ? 0x22C55E : 0x4ADE80, roughness: 0.6 })
      );
      leaves.position.y = 1.8;
      leaves.castShadow = true;
      tree.add(trunk, leaves);
      tree.position.set(tx, 0, tz);
      scene.add(tree);
    });

    // ก้อนเมฆปุยๆ
    const clouds: THREE.Group[] = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random() * 0.5, 12, 12), cloudMat);
        puff.position.set((j - 1) * 0.9, Math.random() * 0.3, 0);
        cloud.add(puff);
      }
      cloud.position.set(-18 + i * 7, 8 + (i % 3) * 1.8, -treeZ - 3 - (i % 2) * 4);
      scene.add(cloud);
      clouds.push(cloud);
    }

    // มงกุฎทองคำ (อันดับ 1)
    const crownMesh = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xFACC15,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0xCA8A04,
      emissiveIntensity: 0.25,
    });
    crownMesh.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.22, 16), goldMat));
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), goldMat);
      spike.position.set(Math.cos(angle) * 0.26, 0.22, Math.sin(angle) * 0.26);
      crownMesh.add(spike);
    }
    scene.add(crownMesh);

    // อนุภาคไฟลุกก้น 14 ลูก (อันดับบ๊วย)
    const flameParticles: { mesh: THREE.Mesh; offset: number; speed: number }[] = [];
    const fireGeo = new THREE.SphereGeometry(0.18, 8, 8);
    for (let i = 0; i < 14; i++) {
      const fireMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xFF4D8D : 0xFACC15,
        transparent: true,
        opacity: 0.85,
      });
      const pMesh = new THREE.Mesh(fireGeo, fireMat);
      scene.add(pMesh);
      flameParticles.push({ mesh: pMesh, offset: Math.random() * Math.PI * 2, speed: 1.5 + Math.random() * 1.5 });
    }

    // สร้างตัวละคร 3D ของผู้เข้าแข่งขันทุกคน
    const meshes: any[] = [];
    players.forEach((p, idx) => {
      const rankedInfo = rankedPlayers.find((r) => r.id === p.id)!;
      const rankIndex = rankedPlayers.findIndex((r) => r.id === p.id);
      const style = STYLES[idx % STYLES.length];
      const laneZ = (idx - (players.length - 1) / 2) * 2.4;

      const targetX = TRACK_START_X + (rankedInfo.progressRatio ?? 0) * (TRACK_END_X - TRACK_START_X - 0.8);
      const rootGroup = new THREE.Group();
      rootGroup.position.set(targetX, 0.2, laneZ);

      const bounceGroup = new THREE.Group();
      rootGroup.add(bounceGroup);

      const bodyMat = new THREE.MeshStandardMaterial({
        color: p.colorHex || style.bodyColor,
        roughness: 0.35,
        metalness: 0.05,
      });
      const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 24), bodyMat);
      bodyMesh.position.y = 1.05;
      bodyMesh.scale.set(rankedInfo.bellyScale ?? 1, 1.0, rankedInfo.bellyScale ?? 1);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      bounceGroup.add(bodyMesh);

      // พุงกลมสีขาวน่ารักด้านหน้า
      const bellyMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0xFFFBEB, roughness: 0.5 })
      );
      bellyMesh.position.set(0.32, 0.0, 0);
      bodyMesh.add(bellyMesh);

      // หัว + ตา + แก้มชมพู
      const headGroup = new THREE.Group();
      headGroup.position.set(0.05, 2.05, 0);
      bounceGroup.add(headGroup);

      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 24, 24), bodyMat);
      headMesh.castShadow = true;
      headGroup.add(headMesh);

      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18181B });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), eyeMat);
      eyeL.position.set(0.48, 0.08, -0.22);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), eyeMat);
      eyeR.position.set(0.48, 0.08, 0.22);
      headGroup.add(eyeL, eyeR);

      const cheekMat = new THREE.MeshBasicMaterial({ color: 0xFB7185 });
      const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), cheekMat);
      cheekL.position.set(0.46, -0.06, -0.32);
      const cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), cheekMat);
      cheekR.position.set(0.46, -0.06, 0.32);
      headGroup.add(cheekL, cheekR);

      // เครื่องประดับเฉพาะตัว
      const accMat = new THREE.MeshStandardMaterial({ color: style.bandColor, roughness: 0.3 });
      if (style.accessory === 'headband' || style.accessory === 'chubby') {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.07, 10, 24), accMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.2;
        headGroup.add(band);
      } else if (style.accessory === 'ears' || style.accessory === 'cat') {
        const earGeo =
          style.accessory === 'ears'
            ? new THREE.CylinderGeometry(0.08, 0.1, 0.65, 12)
            : new THREE.ConeGeometry(0.16, 0.38, 12);
        const earL = new THREE.Mesh(earGeo, bodyMat);
        earL.position.set(0, 0.65, -0.22);
        const earR = new THREE.Mesh(earGeo, bodyMat);
        earR.position.set(0, 0.65, 0.22);
        headGroup.add(earL, earR);
      } else if (style.accessory === 'shades') {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.65), accMat);
        glass.position.set(0.52, 0.08, 0);
        headGroup.add(glass);
      }

      // ขา & แขน
      const legGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.45, 12);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x18181B });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(0, 0.25, -0.25);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(0, 0.25, 0.25);

      const armGeo = new THREE.SphereGeometry(0.18, 12, 12);
      const armL = new THREE.Mesh(armGeo, bodyMat);
      armL.position.set(0, 1.15, -0.78);
      const armR = new THREE.Mesh(armGeo, bodyMat);
      armR.position.set(0, 1.15, 0.78);
      bounceGroup.add(legL, legR, armL, armR);

      scene.add(rootGroup);

      // ป้ายชื่อลอยบนหัว (Projected 3D -> 2D)
      const tagEl = document.createElement('div');
      tagEl.className = 'player-tag';
      tagEl.onclick = () => focusOnCharacter(p.id);
      const rankLabel =
        rankIndex === 0 ? '👑 #1' : rankIndex === rankedPlayers.length - 1 && rankedPlayers.length > 1 ? '🔥 บ๊วย' : `#${rankIndex + 1}`;
      const pctVal = rankedInfo.pctLost ?? 0;
      const sign = pctVal > 0 ? '-' : pctVal < 0 ? '+' : '';
      const pctColor = pctVal >= 0 ? 'text-emerald-600' : 'text-rose-600';

      tagEl.innerHTML = `
        <div class="bg-white border-2 border-black rounded-xl px-2.5 py-1 shadow-[3px_3px_0px_#18181B] text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1 font-[family-name:var(--font-kanit)] font-extrabold text-xs text-black">
            <span>${rankLabel}</span>
            <span>${p.emoji} ${p.name}</span>
            <span class="${pctColor}">${sign}${Math.abs(pctVal)}%</span>
          </div>
          <div class="text-[10px] font-semibold text-zinc-600 max-w-[145px] truncate">
            ${p.taunt}
          </div>
        </div>
        <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black mx-auto"></div>
      `;
      labelsContainer.appendChild(tagEl);

      meshes.push({
        id: p.id,
        rootGroup,
        bounceGroup,
        bodyMesh,
        legL,
        legR,
        armL,
        armR,
        tagEl,
        targetX,
        targetBellyScale: rankedInfo.bellyScale ?? 1,
      });
    });

    charMeshesRef.current = meshes;

    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      trophyMesh.rotation.y = elapsed * 1.2;

      clouds.forEach((c) => {
        c.position.x += 0.012;
        if (c.position.x > 22) c.position.x = -22;
      });

      meshes.forEach((c, idx) => {
        c.rootGroup.position.x += (c.targetX - c.rootGroup.position.x) * 0.06;
        const curScale = c.bodyMesh.scale.x;
        const nextScale = curScale + (c.targetBellyScale - curScale) * 0.08;
        c.bodyMesh.scale.set(nextScale, 1.0, nextScale);

        const speed = 7.5 + idx * 0.4;
        const bounce = Math.abs(Math.sin(elapsed * speed));
        c.bounceGroup.position.y = bounce * 0.22;
        c.bounceGroup.rotation.z = Math.sin(elapsed * speed) * 0.06;

        c.legL.rotation.z = Math.sin(elapsed * speed) * 0.65;
        c.legR.rotation.z = -Math.sin(elapsed * speed) * 0.65;
        c.armL.position.x = Math.sin(elapsed * speed) * 0.25;
        c.armR.position.x = -Math.sin(elapsed * speed) * 0.25;

        if (c.id === leaderIdRef.current) {
          crownMesh.position.set(
            c.rootGroup.position.x + 0.05,
            c.rootGroup.position.y + c.bounceGroup.position.y + 2.85 + Math.sin(elapsed * 4) * 0.08,
            c.rootGroup.position.z
          );
          crownMesh.rotation.y = elapsed * 2.2;
        }

        if (c.id === loserIdRef.current && meshes.length > 1) {
          flameParticles.forEach((fp, fIdx) => {
            const t = (elapsed * fp.speed + fp.offset) % 1;
            fp.mesh.position.set(
              c.rootGroup.position.x - 0.7 - t * 1.4,
              c.rootGroup.position.y + 0.6 + t * 1.1,
              c.rootGroup.position.z + Math.sin(elapsed * 8 + fIdx) * 0.28
            );
            const s = (1 - t) * 1.1;
            fp.mesh.scale.set(s, s, s);
          });
        }

        const headWorldPos = new THREE.Vector3(
          c.rootGroup.position.x,
          c.rootGroup.position.y + 3.15,
          c.rootGroup.position.z
        );
        headWorldPos.project(camera);

        if (headWorldPos.z < 1) {
          const x = (headWorldPos.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-headWorldPos.y * 0.5 + 0.5) * window.innerHeight;
          c.tagEl.style.left = `${x}px`;
          c.tagEl.style.top = `${y}px`;
          c.tagEl.style.opacity = '1';
          c.tagEl.style.zIndex = String(Math.round((1 - headWorldPos.z) * 100));
        } else {
          c.tagEl.style.opacity = '0';
        }
      });

      if (cameraTargetPosRef.current) {
        camera.position.lerp(cameraTargetPosRef.current, 0.06);
        controls.target.lerp(cameraLookAtRef.current, 0.08);
        if (camera.position.distanceTo(cameraTargetPosRef.current) < 0.15) {
          cameraTargetPosRef.current = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [players, rankedPlayers, focusOnCharacter]);

  // ส่งอัปเดตน้ำหนัก
  const handleWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedPlayerId,
          pinCode: pinInput,
          weight: parseFloat(newWeightInput),
          excuseTag: selectedExcuse,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'เกิดข้อผิดพลาด');
      } else {
        const player = players.find((p) => p.id === selectedPlayerId);
        if (data.diff < 0) {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          showToast('🎉', 'น้ำหนักลดลง! หุ่น 3D เพรียวขึ้นแล้ว', `${player?.name} ลดไป ${Math.abs(data.diff)} กก. วิ่งนำลิ่ว!`);
        } else if (data.diff > 0) {
          setShakeScreen(true);
          setTimeout(() => setShakeScreen(false), 500);
          showToast('🚨', 'อุ๊ย! พุง 3D ขยายใหญ่ขึ้น!', `${player?.name} น้ำหนักเพิ่ม +${data.diff} กก. โดนระบบแฉแล้ว!`);
        } else {
          showToast('⚖️', 'อัปเดตเรียบร้อย', `น้ำหนักเท่าเดิมเป๊ะ ${newWeightInput} กก.`);
        }
        setIsLogOpen(false);
        setPinInput('');
        await fetchArenaData();
        setTimeout(() => focusOnCharacter(selectedPlayerId), 300);
      }
    } catch {
      setModalError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSubmitting(false);
    }
  };

  // สมัครลงแข่ง
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoining(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: joinName,
          avatarEmoji: joinEmoji,
          pinCode: joinPin,
          startWeight: parseFloat(joinStart),
          goalWeight: parseFloat(joinGoal),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'สมัครไม่สำเร็จ');
      } else {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        showToast('🏁', 'ลงทะเบียนสำเร็จ!', `ยินดีต้อนรับ ${joinEmoji} ${joinName} เข้าสู่สนาม 3D!`);
        setIsJoinOpen(false);
        setJoinName('');
        setJoinPin('');
        setJoinStart('');
        setJoinGoal('');
        await fetchArenaData();
      }
    } catch {
      setJoinError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setJoining(false);
    }
  };

  const selectedPlayerObj = players.find((p) => p.id === selectedPlayerId);

  return (
    <div className={`w-full h-screen overflow-hidden relative ${shakeScreen ? 'shake-active' : ''}`}>
      {/* 3D WebGL Canvas Fullscreen */}
      <div ref={canvasRef} className="fixed inset-0 w-full h-full z-[1] cursor-grab active:cursor-grabbing" />

      {/* 3D Projected Floating Nameplates */}
      <div ref={labelsRef} className="fixed inset-0 pointer-events-none z-10 overflow-hidden" />

      {/* TOP HUD HEADER */}
      <header className="fixed top-3 left-3 right-3 z-20 pointer-events-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="neo-card rounded-2xl px-4 py-2.5 pointer-events-auto flex items-center gap-3 bg-[#FFE600]">
          <div className="w-10 h-10 bg-[#FF4D8D] border-2 border-black rounded-xl flex items-center justify-center text-xl shadow-[2px_2px_0px_#000] shrink-0">
            🏆
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-[family-name:var(--font-kanit)] font-extrabold text-lg sm:text-xl text-black leading-none">
                ศึกชิงบัลลังก์เอวเอส 3D
              </h1>
              <span className="bg-black text-[#BEF264] text-[10px] font-bold px-1.5 py-0.5 rounded">LIVE</span>
            </div>
            <p className="text-[11px] font-semibold text-zinc-800 mt-0.5">
              หมุนดูพุงเพื่อนได้ 360° • ใครแพ้เลี้ยงชาบู!
            </p>
          </div>
        </div>

        {/* Action Buttons & Camera Presets */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="neo-card rounded-xl p-1 flex items-center gap-1 bg-white">
            <button
              onClick={() => setCameraView('overview')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#38BDF8] hover:text-black transition cursor-pointer flex items-center gap-1"
            >
              🎥 <span className="hidden md:inline">มุมมองรวม</span>
            </button>
            <button
              onClick={() => setCameraView('leader')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#FFE600] transition cursor-pointer flex items-center gap-1"
            >
              👑 <span className="hidden md:inline">ซูมผู้นำ</span>
            </button>
            <button
              onClick={() => setCameraView('loser')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#FF4D8D] hover:text-white transition cursor-pointer flex items-center gap-1"
            >
              🔥 <span className="hidden md:inline">ส่องคนบ๊วย</span>
            </button>
          </div>

          <button
            onClick={() => setIsDrawerOpen((v) => !v)}
            className="neo-btn bg-white text-black font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">อันดับ & แซวสด</span>
          </button>

          <button
            onClick={() => {
              setJoinError('');
              setIsJoinOpen(true);
            }}
            className="neo-btn bg-[#38BDF8] hover:bg-[#7dd3fc] text-black font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>+ สมัครลงแข่ง</span>
          </button>

          <button
            onClick={() => {
              if (selectedPlayerObj) setNewWeightInput(String(selectedPlayerObj.currentWeight));
              setModalError('');
              setIsLogOpen(true);
            }}
            className="neo-btn bg-[#A3E635] hover:bg-[#bef264] text-black font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Scale className="w-4 h-4 stroke-[2.5]" />
            <span>+ อัปเดตน้ำหนักวันนี้</span>
          </button>
        </div>
      </header>

      {/* FLOATING SIDE DRAWER */}
      <aside
        className={`fixed top-20 right-3 bottom-3 w-[340px] max-w-[calc(100vw-24px)] z-20 flex flex-col gap-3 transition-transform duration-300 pointer-events-none ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-[120%]'
        }`}
      >
        {/* Leaderboard Card */}
        <div className="neo-card rounded-2xl p-3.5 pointer-events-auto flex flex-col max-h-[48%]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-black shrink-0">
            <h2 className="font-[family-name:var(--font-kanit)] font-extrabold text-base flex items-center gap-1.5">
              <span>📊 อันดับเอวเอส</span>
            </h2>
            <span className="text-[10px] font-bold bg-[#FFE600] border border-black px-2 py-0.5 rounded-full">
              วัดจาก % ที่ลดได้
            </span>
          </div>
          <div className="overflow-y-auto space-y-2 pr-1">
            {rankedPlayers.length === 0 ? (
              <p className="text-xs text-center py-4 font-bold text-zinc-500">
                ยังไม่มีผู้เข้าแข่งขัน กด &quot;+ สมัครลงแข่ง&quot; ได้เลย!
              </p>
            ) : (
              rankedPlayers.map((p, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === rankedPlayers.length - 1 && rankedPlayers.length > 1;
                const pctVal = p.pctLost ?? 0;
                const sign = pctVal > 0 ? '-' : pctVal < 0 ? '+' : '';
                const cardBg = isFirst ? 'bg-[#FFE600]' : isLast ? 'bg-[#FF4D8D]/20' : 'bg-white';

                return (
                  <div
                    key={p.id}
                    onClick={() => focusOnCharacter(p.id)}
                    className={`${cardBg} border-2 border-black rounded-xl p-2 flex items-center justify-between gap-2 cursor-pointer hover:translate-x-0.5 transition`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-black text-white font-[family-name:var(--font-kanit)] font-extrabold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xl shrink-0">{p.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs text-black truncate">
                          {p.name} {isFirst ? '👑' : isLast ? '🔥' : ''}
                        </div>
                        <div className="text-[10px] font-semibold text-zinc-600">
                          {p.startWeight} ➔ <strong className="text-black">{p.currentWeight} กก.</strong>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-[family-name:var(--font-kanit)] font-extrabold text-sm ${
                          pctVal >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {sign}
                        {Math.abs(pctVal)}%
                      </div>
                      <div className="text-[9px] font-bold text-zinc-500">เป้า {p.goalWeight} กก.</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Roast Feed Card */}
        <div className="neo-card rounded-2xl p-3.5 pointer-events-auto flex flex-col flex-1 min-h-0 bg-[#FEF08A]/95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-black shrink-0">
            <h2 className="font-[family-name:var(--font-kanit)] font-extrabold text-base flex items-center gap-1.5">
              <span>📢 กระดานแซวสด</span>
            </h2>
            <span className="bg-[#FF4D8D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-black animate-pulse">
              ROAST
            </span>
          </div>
          <div className="overflow-y-auto space-y-2 pr-1 flex-1">
            {roastFeed.map((item) => {
              const isUp = item.diff > 0;
              return (
                <div key={item.id} className="bg-white border-2 border-black rounded-xl p-2.5 shadow-[2px_2px_0px_#18181B]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs">
                      {item.emoji} {item.user} ({item.weight} กก.)
                    </span>
                    {isUp ? (
                      <span className="bg-[#FF4D8D] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-black">
                        +{item.diff.toFixed(1)} กก.
                      </span>
                    ) : (
                      <span className="bg-[#A3E635] text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-black">
                        {item.diff.toFixed(1)} กก.
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-zinc-800 bg-zinc-100 px-2 py-1 rounded border border-zinc-200 mb-1">
                    {item.roast}
                  </p>
                  <div className="text-[10px] text-zinc-500 font-semibold truncate">
                    💬 &quot;{item.excuse}&quot;
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* BOTTOM CONTROL HINT */}
      <div className="fixed bottom-3 left-3 z-20 pointer-events-none hidden sm:block">
        <div className="neo-card rounded-xl px-3 py-1.5 text-[11px] font-bold text-zinc-700 flex items-center gap-2 bg-white/90">
          <span>🖱️ ลากเพื่อหมุนกล้อง</span>
          <span>•</span>
          <span>🔍 สกรอลล์เพื่อซูม</span>
          <span>•</span>
          <span>👆 คลิกป้ายชื่อเพื่อส่องตัวละคร</span>
        </div>
      </div>

      {/* MODAL 1: อัปเดตน้ำหนักวันนี้ */}
      {isLogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-3 border-black shadow-[6px_6px_0px_#18181B] rounded-2xl max-w-md w-full p-5 relative">
            <button
              onClick={() => setIsLogOpen(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 bg-[#FF4D8D] text-white neo-btn rounded-lg flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-3xl">⚖️</span>
              <div>
                <h3 className="font-[family-name:var(--font-kanit)] text-xl font-extrabold">ขึ้นเขียงชั่งน้ำหนัก 3D</h3>
                <p className="text-xs text-zinc-600 font-medium">น้ำหนักเปลี่ยน = หุ่น 3D เปลี่ยนทันที!</p>
              </div>
            </div>

            <form onSubmit={handleWeightSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold mb-1">1. เลือกตัวละครของคุณ</label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedPlayerId(id);
                    const found = players.find((p) => p.id === id);
                    if (found) setNewWeightInput(String(found.currentWeight));
                  }}
                  className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 font-bold text-sm"
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.name} (ล่าสุด {p.currentWeight} กก.)
                    </option>
                  ))}
                </select>
                {selectedPlayerObj && (
                  <p className="text-[11px] text-zinc-500 font-semibold mt-1">
                    เริ่มต้น {selectedPlayerObj.startWeight} กก. • ปัจจุบัน {selectedPlayerObj.currentWeight} กก. • เป้าหมาย {selectedPlayerObj.goalWeight} กก.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">2. รหัส PIN 4 หลัก</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="1234"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 font-bold text-center tracking-widest text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">3. น้ำหนักวันนี้ (กก.)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="250"
                    required
                    value={newWeightInput}
                    onChange={(e) => setNewWeightInput(e.target.value)}
                    className="w-full bg-[#BEF264]/40 border-2 border-black rounded-xl px-3 py-2 font-[family-name:var(--font-kanit)] font-extrabold text-center text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5">4. เลือกสถานะ / ข้อแก้ตัวสุดกวน</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {EXCUSES.map((ex) => (
                    <button
                      type="button"
                      key={ex.text}
                      onClick={() => setSelectedExcuse(ex.text)}
                      className={`${
                        selectedExcuse === ex.text ? 'bg-[#FFE600]' : 'bg-zinc-100'
                      } border-2 border-black rounded-lg px-2.5 py-1.5 text-xs font-bold text-left cursor-pointer`}
                    >
                      {ex.text}
                    </button>
                  ))}
                </div>
              </div>

              {modalError && (
                <div className="bg-[#FF4D8D] text-white border-2 border-black rounded-xl p-2 text-xs font-bold text-center">
                  {modalError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full neo-btn bg-[#A3E635] hover:bg-[#bef264] text-black font-[family-name:var(--font-kanit)] font-extrabold text-base py-3 rounded-xl cursor-pointer mt-1"
              >
                {submitting ? 'กำลังอัปเดต...' : '🚀 อัปเดตลงสนาม 3D!'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: สมัครลงแข่ง */}
      {isJoinOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-3 border-black shadow-[6px_6px_0px_#18181B] rounded-2xl max-w-md w-full p-5 relative">
            <button
              onClick={() => setIsJoinOpen(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 bg-[#FF4D8D] text-white neo-btn rounded-lg flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-3xl">🔥</span>
              <div>
                <h3 className="font-[family-name:var(--font-kanit)] text-xl font-extrabold">ลงทะเบียนเข้าศึก 3D</h3>
                <p className="text-xs text-zinc-600 font-medium">สร้างตัวละครใหม่ลงสนามแข่งทันที</p>
              </div>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold mb-1">1. เลือกตัวละครประจำตัว</label>
                <div className="flex flex-wrap gap-1.5">
                  {AVATARS.map((emo) => (
                    <button
                      type="button"
                      key={emo}
                      onClick={() => setJoinEmoji(emo)}
                      className={`text-xl p-2 rounded-xl border-2 border-black cursor-pointer ${
                        joinEmoji === emo ? 'bg-[#FFE600] scale-110' : 'bg-zinc-100'
                      }`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">2. ชื่อเล่น</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ปอม"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">3. ตั้งรหัส PIN 4 หลัก</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="1234"
                    value={joinPin}
                    onChange={(e) => setJoinPin(e.target.value)}
                    className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 font-bold text-center tracking-widest"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">4. น้ำหนักเริ่มต้น (กก.)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="78.0"
                    value={joinStart}
                    onChange={(e) => setJoinStart(e.target.value)}
                    className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 font-extrabold text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">5. น้ำหนักเป้าหมาย (กก.)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="68.0"
                    value={joinGoal}
                    onChange={(e) => setJoinGoal(e.target.value)}
                    className="w-full bg-[#BEF264]/40 border-2 border-black rounded-xl px-3 py-2 font-extrabold text-center"
                  />
                </div>
              </div>

              {joinError && (
                <div className="bg-[#FF4D8D] text-white border-2 border-black rounded-xl p-2 text-xs font-bold text-center">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={joining}
                className="w-full neo-btn bg-[#FFE600] hover:bg-[#fef08a] text-black font-[family-name:var(--font-kanit)] font-extrabold text-base py-3 rounded-xl cursor-pointer mt-1"
              >
                {joining ? 'กำลังลงทะเบียน...' : '🏁 เข้าสู่สนามแข่ง 3D!'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none ${
          toast.show ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'
        }`}
      >
        <div className="bg-[#18181B] text-white border-2 border-black shadow-[4px_4px_0px_#FF4D8D] rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">{toast.emoji}</span>
          <div>
            <div className="font-[family-name:var(--font-kanit)] font-extrabold text-sm text-[#BEF264]">
              {toast.title}
            </div>
            <div className="text-xs text-zinc-200">{toast.text}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
