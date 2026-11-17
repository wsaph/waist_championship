'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import confetti from 'canvas-confetti';
import { Trophy, Flame, Plus, Sparkles, Camera, MessageCircle, UserPlus } from 'lucide-react';

interface Participant {
  id: number;
  name: string;
  avatar_emoji: string;
  color_hex: string;
  start_weight: number;
  goal_weight: number;
  current_weight: number;
  lost_kg: number;
  progress_pct: number;
}

interface FeedItem {
  id: number;
  name: string;
  avatar_emoji: string;
  color_hex: string;
  weight: number;
  excuse_tag: string;
  roast_message: string;
  logged_at: string;
}

const EXCUSES = [
  'ชั่งตอนเช้าหลังเข้าห้องน้ำ 🚽',
  'เมื่อคืนหมกระทะเยียวยาทุกสิ่ง 🥓',
  'บวมน้ำเยๆ ไม่ได้อ้วน 💧',
  'วิ่งสวนลุมมา 5 ลถ้วน 🏃‍♂️',
  'งดชานมไข่มุกครบ 7 วัน 🧋',
  'กินคลีนแบบ 100% (ทิพย) 🥗',
];

const AVATARS = ['🦊', '🐼', '🐰', '🐱', '🐶', '🐸', '🦁', '🐷', '🐨', '🦄'];

export default function WaistChampionshipPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number>(1);
  const [pinCode, setPinCode] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [excuseTag, setExcuseTag] = useState(EXCUSES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('🦊');
  const [newPin, setNewPin] = useState('');
  const [newStartWeight, setNewStartWeight] = useState('');
  const [newGoalWeight, setNewGoalWeight] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/weights');
      const data = await res.json();
      if (data.participants) {
        setParticipants(data.participants);
        if (data.participants.length > 0) {
          setSelectedUserId((prev) =>
            data.participants.some((p: Participant) => p.id === prev) ? prev : data.participants[0].id
          );
        }
      }
      if (data.feed) setFeed(data.feed);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!mountRef.current || participants.length === 0) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#FFF8E7');
    scene.fog = new THREE.Fog('#FFF8E7', 18, 45);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 8.5, 14);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.1;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(8, 15, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const trackLength = 14;
    const trackWidth = Math.max(6, participants.length * 2.2);
    const groundGeo = new THREE.BoxGeometry(trackLength + 3, 0.8, trackWidth + 1.5);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#A8E6CF', roughness: 0.6 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.4;
    ground.receiveShadow = true;
    scene.add(ground);

    const finishGeo = new THREE.BoxGeometry(0.4, 0.05, trackWidth);
    const finishMat = new THREE.MeshStandardMaterial({ color: '#FF6B6B' });
    const finishLine = new THREE.Mesh(finishGeo, finishMat);
    finishLine.position.set(trackLength / 2 - 0.5, 0.03, 0);
    scene.add(finishLine);

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#2D3436' });
    const pole1 = new THREE.Mesh(poleGeo, poleMat);
    pole1.position.set(trackLength / 2 - 0.5, 1.6, -trackWidth / 2 + 0.3);
    const pole2 = new THREE.Mesh(poleGeo, poleMat);
    pole2.position.set(trackLength / 2 - 0.5, 1.6, trackWidth / 2 - 0.3);
    scene.add(pole1, pole2);

    const bannerGeo = new THREE.BoxGeometry(0.15, 0.6, trackWidth - 0.5);
    const bannerMat = new THREE.MeshStandardMaterial({ color: '#FFE66D' });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(trackLength / 2 - 0.5, 2.9, 0);
    scene.add(banner);

    const characterGroups: {
      group: THREE.Group;
      phase: number;
      crown?: THREE.Mesh;
      flame?: THREE.Mesh;
    }[] = [];

    participants.forEach((p, idx) => {
      const charGroup = new THREE.Group();
      const zPos = (idx - (participants.length - 1) / 2) * 2.1;

      const laneGeo = new THREE.BoxGeometry(trackLength, 0.04, 1.5);
      const laneMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? '#FFFFFF' : '#F7F9FC',
      });
      const lane = new THREE.Mesh(laneGeo, laneMat);
      lane.position.set(0, 0.02, zPos);
      lane.receiveShadow = true;
      scene.add(lane);

      const weightRatio = Math.max(0.75, Math.min(1.45, p.current_weight / p.start_weight));
      const bellyScale = 1 + (weightRatio - 1) * 2.5;

      const bodyGeo = new THREE.SphereGeometry(0.55, 24, 24);
      bodyGeo.scale(bellyScale, 1.15, bellyScale);
      const bodyMat = new THREE.MeshStandardMaterial({ color: p.color_hex, roughness: 0.35 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.65;
      body.castShadow = true;
      charGroup.add(body);

      const headGeo = new THREE.SphereGeometry(0.42, 24, 24);
      const headMat = new THREE.MeshStandardMaterial({ color: '#FFEAA7', roughness: 0.4 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.45;
      head.castShadow = true;
      charGroup.add(head);

      const eyeGeo = new THREE.SphereGeometry(0.06, 12, 12);
      const eyeMat = new THREE.MeshStandardMaterial({ color: '#2D3436' });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(0.35, 1.5, 0.16);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.35, 1.5, -0.16);
      charGroup.add(leftEye, rightEye);

      const blushGeo = new THREE.SphereGeometry(0.06, 12, 12);
      const blushMat = new THREE.MeshStandardMaterial({ color: '#FF7675' });
      const leftBlush = new THREE.Mesh(blushGeo, blushMat);
      leftBlush.position.set(0.33, 1.4, 0.25);
      const rightBlush = new THREE.Mesh(blushGeo, blushMat);
      rightBlush.position.set(0.33, 1.4, -0.25);
      charGroup.add(leftBlush, rightBlush);

      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256;
      labelCanvas.height = 96;
      const ctx = labelCanvas.getContext('2d')!;
      ctx.fillStyle = '#2D3436';
      ctx.roundRect(8, 8, 240, 80, 24);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.avatar_emoji} ${p.name}`, 128, 45);
      ctx.fillStyle = '#FFE66D';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`${p.current_weight} kg (${p.progress_pct}%)`, 128, 76);

      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const spriteMat = new THREE.SpriteMaterial({ map: labelTex });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, 2.35, 0);
      sprite.scale.set(2.2, 0.85, 1);
      charGroup.add(sprite);

      let crown: THREE.Mesh | undefined;
      if (idx === 0) {
        const crownGeo = new THREE.ConeGeometry(0.28, 0.35, 6);
        const crownMat = new THREE.MeshStandardMaterial({
          color: '#FFD700',
          metalness: 0.6,
          roughness: 0.2,
        });
        crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(0, 1.98, 0);
        charGroup.add(crown);
      }

      let flame: THREE.Mesh | undefined;
      if (idx === participants.length - 1 && participants.length > 1) {
        const flameGeo = new THREE.ConeGeometry(0.25, 0.6, 8);
        const flameMat = new THREE.MeshStandardMaterial({
          color: '#FF4757',
          emissive: '#FF6B81',
          emissiveIntensity: 0.8,
        });
        flame = new THREE.Mesh(flameGeo, flameMat);
        flame.rotation.z = Math.PI / 2;
        flame.position.set(-0.75, 0.55, 0);
        charGroup.add(flame);
      }

      const clampedPct = Math.max(0, Math.min(100, p.progress_pct));
      const xPos = -trackLength / 2 + 1.2 + (clampedPct / 100) * (trackLength - 2.2);
      charGroup.position.set(xPos, 0, zPos);

      scene.add(charGroup);
      characterGroups.push({ group: charGroup, phase: idx * 1.4, crown, flame });
    });

    let frameId: number;
    const clock = new THREE.Clock();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      characterGroups.forEach((item) => {
        item.group.position.y = Math.abs(Math.sin(t * 4 + item.phase)) * 0.22;
        item.group.rotation.z = Math.sin(t * 4 + item.phase) * 0.06;
        if (item.crown) {
          item.crown.rotation.y = t * 2;
          item.crown.position.y = 1.98 + Math.sin(t * 3) * 0.05;
        }
        if (item.flame) {
          const s = 0.85 + Math.sin(t * 15) * 0.25;
          item.flame.scale.set(s, s, s);
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [participants]);

  const setCameraView = (mode: 'overview' | 'leader' | 'last') => {
    if (!cameraRef.current || !controlsRef.current || participants.length === 0) return;
    if (mode === 'overview') {
      cameraRef.current.position.set(0, 8.5, 14);
      controlsRef.current.target.set(0, 0.5, 0);
    } else if (mode === 'leader') {
      const z = (0 - (participants.length - 1) / 2) * 2.1;
      cameraRef.current.position.set(5.5, 3.5, z + 4.5);
      controlsRef.current.target.set(3, 1, z);
    } else if (mode === 'last') {
      const lastIdx = participants.length - 1;
      const z = (lastIdx - (participants.length - 1) / 2) * 2.1;
      cameraRef.current.position.set(-4.5, 3.5, z + 4.5);
      controlsRef.current.target.set(-3, 1, z);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: Number(selectedUserId),
          pinCode,
          weight: parseFloat(weightInput),
          excuseTag,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาด');
      } else {
        if (data.diff <= 0) {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        }
        setIsModalOpen(false);
        setPinCode('');
        setWeightInput('');
        await fetchData();
      }
    } catch {
      setErrorMsg('เชื่อมต่อเิรฟเวอรไม่ได้');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoining(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          avatarEmoji: newAvatar,
          pinCode: newPin,
          startWeight: parseFloat(newStartWeight),
          goalWeight: parseFloat(newGoalWeight),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'สมัครไม่สำเรจ');
      } else {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        setIsJoinModalOpen(false);
        setNewName('');
        setNewPin('');
        setNewStartWeight('');
        setNewGoalWeight('');
        await fetchData();
      }
    } catch {
      setJoinError('เชื่อมต่อเิรฟเวอรไม่ได้');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8E7] text-[#2D3436] pb-12">
      <header className="border-b-4 border-[#2D3436] bg-[#FFE66D] px-4 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl bg-white border-2 border-[#2D3436] rounded-xl p-1.5 shadow-[3px_3px_0px_#2D3436]">
              🏆
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">ศึกชิงบัลลังกเอวเอส 3D</h1>
              <p className="text-xs font-bold text-[#2D3436]/80">ลดได้มงลง • น้ำหนักพุ่งไฟลุกก้น!</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-100 text-[#2D3436] font-black px-4 py-2.5 rounded-2xl border-3 border-[#2D3436] shadow-[4px_4px_0px_#2D3436] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-sm"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              สมัครลงแข่ง
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#FF6B6B] hover:bg-[#ff5252] text-white font-black px-5 py-2.5 rounded-2xl border-3 border-[#2D3436] shadow-[4px_4px_0px_#2D3436] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-sm"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              อัปเดตน้ำหนัก
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-6 space-y-6">
        <section className="bg-white border-4 border-[#2D3436] rounded-3xl shadow-[6px_6px_0px_#2D3436] overflow-hidden relative">
          <div className="bg-[#4ECDC4] border-b-4 border-[#2D3436] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="font-black text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> สนามวิ่งหนีความอ้วน 3D (ลากหมุนดรอบสนามได้!)
            </span>
            <div className="flex gap-1.5 text-xs font-bold">
              <button
                onClick={() => setCameraView('overview')}
                className="bg-white px-2.5 py-1 rounded-lg border-2 border-[#2D3436] hover:bg-[#FFE66D] cursor-pointer flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5" /> ภาพรวม
              </button>
              <button
                onClick={() => setCameraView('leader')}
                className="bg-white px-2.5 py-1 rounded-lg border-2 border-[#2D3436] hover:bg-[#FFE66D] cursor-pointer"
              >
                👑 มผ้นำ
              </button>
              <button
                onClick={() => setCameraView('last')}
                className="bg-white px-2.5 py-1 rounded-lg border-2 border-[#2D3436] hover:bg-[#FF6B6B] hover:text-white cursor-pointer"
              >
                🔥 ส่องคนบวย
              </button>
            </div>
          </div>

          <div ref={mountRef} className="w-full h-[360px] md:h-[420px] cursor-grab active:cursor-grabbing" />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white border-4 border-[#2D3436] rounded-3xl p-5 shadow-[6px_6px_0px_#2D3436]">
            <h2 className="text-lg font-black mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#FFB703]" /> ตารางอันดับความเพรียว (% เข้าใกล้เป้าหมาย)
            </h2>

            {loading ? (
              <p className="text-center py-8 font-bold text-gray-500">กำลังหลดข้อมลจาก Turso...</p>
            ) : participants.length === 0 ? (
              <p className="text-center py-8 font-bold text-gray-500">
                ยังไม่มีผ้เข้าแข่งขัน กดปุ่ม &quot;สมัครลงแข่ง&quot; ด้านบนได้เลย!
              </p>
            ) : (
              <div className="space-y-3">
                {participants.map((p, index) => {
                  const isFirst = index === 0;
                  const isLast = index === participants.length - 1 && participants.length > 1;
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-2xl border-3 border-[#2D3436] flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isFirst ? 'bg-[#FFF3BF]' : isLast ? 'bg-[#FFE3E3]' : 'bg-[#F8F9FA]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white border-2 border-[#2D3436] flex items-center justify-center font-black text-base">
                          #{index + 1}
                        </div>
                        <span className="text-3xl">{p.avatar_emoji}</span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-base">{p.name}</span>
                            {isFirst && (
                              <span className="text-[11px] font-black bg-[#FFD700] px-2 py-0.5 rounded-full border border-[#2D3436]">
                                👑 ร่างทองแห่งปี
                              </span>
                            )}
                            {isLast && (
                              <span className="text-[11px] font-black bg-[#FF6B6B] text-white px-2 py-0.5 rounded-full border border-[#2D3436] flex items-center gap-1">
                                <Flame className="w-3 h-3" /> ตัวเตงเจ้ามือชาบ
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-gray-600">
                            เริ่มต้น {p.start_weight} กก. → เป้าหมาย {p.goal_weight} กก.
                          </p>
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <div className="text-lg font-black">
                          {p.current_weight} <span className="text-xs">กก.</span>
                        </div>
                        <div
                          className={`text-xs font-black ${
                            p.lost_kg >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {p.lost_kg >= 0 ? `ลดไป ${p.lost_kg} กก.` : `เพิ่มขึ้น ${Math.abs(p.lost_kg)} กก.`} (
                          {p.progress_pct}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white border-4 border-[#2D3436] rounded-3xl p-5 shadow-[6px_6px_0px_#2D3436]">
            <h2 className="text-lg font-black mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#FF6B6B]" /> กระดานแวสด
            </h2>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {feed.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-[#FFF8E7] border-2 border-[#2D3436] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-black">
                    <span>
                      {item.avatar_emoji} {item.name} • {item.weight} กก.
                    </span>
                  </div>
                  <p className="font-bold text-[#2D3436]">{item.roast_message}</p>
                  <span className="inline-block bg-white px-2 py-0.5 rounded-md border border-[#2D3436] text-[11px] font-bold text-gray-600">
                    💬 {item.excuse_tag}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-[#2D3436] rounded-3xl max-w-md w-full p-6 shadow-[8px_8px_0px_#2D3436]">
            <h3 className="text-xl font-black mb-4">⚖️ รายงานตัวขึ้นตาชั่ง</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black mb-1">เลือกชื่อผ้เข้าแข่งขัน</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border-3 border-[#2D3436] font-bold bg-[#FFF8E7]"
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.avatar_emoji} {p.name} (ล่าสุด {p.current_weight} กก.)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black mb-1">น้ำหนักวันนี้ (กก.)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="เช่น 72.5"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-3 border-[#2D3436] font-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">รหัส PIN 4 หลัก</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="1234"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-3 border-[#2D3436] font-black tracking-widest"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black mb-1">เลือกแคปชัน / ข้อแก้ตัว</label>
                <select
                  value={excuseTag}
                  onChange={(e) => setExcuseTag(e.target.value)}
                  className="w-full p-2.5 rounded-xl border-3 border-[#2D3436] font-bold text-xs bg-[#F8F9FA]"
                >
                  {EXCUSES.map((ex) => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
                </select>
              </div>

              {errorMsg && (
                <p className="text-xs font-black text-rose-600 bg-rose-100 p-2 rounded-xl border border-rose-400">
                  {errorMsg}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border-3 border-[#2D3436] font-black bg-gray-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl border-3 border-[#2D3436] font-black bg-[#4ECDC4] shadow-[3px_3px_0px_#2D3436] cursor-pointer"
                >
                  {submitting ? 'กำลังบันทึก...' : 'ส่งผลชั่ง! 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-[#2D3436] rounded-3xl max-w-md w-full p-6 shadow-[8px_8px_0px_#2D3436]">
            <h3 className="text-xl font-black mb-4">🔥 ลงทะเบียนเข้าศึกชิงเอวเอส</h3>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-black mb-1">เลือกตัวละครประจำตัว</label>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map((emo) => (
                    <button
                      type="button"
                      key={emo}
                      onClick={() => setNewAvatar(emo)}
                      className={`text-2xl p-2 rounded-xl border-2 cursor-pointer ${
                        newAvatar === emo
                          ? 'bg-[#FFE66D] border-[#2D3436] scale-110'
                          : 'bg-gray-50 border-gray-300'
                      }`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black mb-1">ชื่อเล่น</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ปอม"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-3 border-[#2D3436] font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">ตั้งรหัส PIN 4 หลัก</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="เช่น 1234"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-3 border-[#2D3436] font-black tracking-widest"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black mb-1">น้ำหนักเริ่มต้น (กก.)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="เช่น 78.0"
                    value={newStartWeight}
                    onChange={(e) => setNewStartWeight(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-3 border-[#2D3436] font-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">น้ำหนักเป้าหมาย (กก.)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="เช่น 68.0"
                    value={newGoalWeight}
                    onChange={(e) => setNewGoalWeight(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-3 border-[#2D3436] font-black"
                  />
                </div>
              </div>

              {joinError && (
                <p className="text-xs font-black text-rose-600 bg-rose-100 p-2 rounded-xl border border-rose-400">
                  {joinError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border-3 border-[#2D3436] font-black bg-gray-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="flex-1 py-2.5 rounded-xl border-3 border-[#2D3436] font-black bg-[#FFE66D] shadow-[3px_3px_0px_#2D3436] cursor-pointer"
                >
                  {joining ? 'กำลังสมัคร...' : 'เข้าส่สนาม! 🏁'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
