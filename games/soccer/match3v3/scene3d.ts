// games/soccer/match3v3/scene3d.ts
// Three.js 3D Street Mini-Goal 3v3 ("โกลหนู 3v3") Stadium Renderer (Up to 6 Real Players!):
// - Full 3v3 pitch with authentic compact Street Mini-Goals ("โกลหนู" 3.60m × 1.70m + angled steel rear frame)
// - PES-Style Sideline Broadcast Camera with Smooth Ball Follow & Stadium Boundary Clamping
// - Per-Slot 3D RPG Island Characters (`buildCharacterMesh`) or `SkeletonUtils.clone()` .glb fallback
// - Gold Glowing Foot Ring + Aim Arrow + Stamina/Shot Charge Gauge on `mySlotId`, plus Team Rings on fellow humans!
// - devicePixelRatio capped <= 2 and full GPU memory cleanup via disposeObject3D

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  buildCharacterMesh,
  resolveRpgAnimPatterns,
  type CharacterMeshParts,
} from '@/lib/character_3d';
import type { PropColorMap } from '@/lib/rpg_catalog';
import { disposeObject3D } from '@/lib/device_perf';
import {
  getPenaltyCharacter,
  type FootballAvatarProfile,
  type PenaltyCharacterDef,
} from '../penalty/rules';
import { playPenaltySfx } from '../penalty/scene3d';
import {
  BALL_RADIUS,
  GOAL_3V3_DEPTH,
  GOAL_3V3_HALF_Z,
  GOAL_3V3_HEIGHT,
  PENALTY_BOX_DEPTH_X,
  PENALTY_BOX_HALF_Z,
  PITCH_HALF_D,
  PITCH_HALF_W,
  type FootballPlayerEntity,
  type FootballSlotId,
  type FootballTeam,
} from './physics';

const gltfCache3v3 = new Map<string, Promise<GLTF>>();
const sharedLoader3v3 = new GLTFLoader();

function loadCachedModel(url: string): Promise<GLTF> {
  const hit = gltfCache3v3.get(url);
  if (hit) return hit;
  const p = new Promise<GLTF>((resolve, reject) => {
    sharedLoader3v3.load(url, resolve, undefined, reject);
  });
  gltfCache3v3.set(url, p);
  return p;
}

// ============================================================================
// Procedural Stadium Textures
// ============================================================================

function buildStripedTurfTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const stripes = 14;
    const sw = canvas.width / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#16a34a';
      ctx.fillRect(i * sw, 0, sw + 1, canvas.height);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildGoalNetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 3.5;
    for (let i = 0; i <= 128; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2.2);
  return tex;
}

function buildAdBannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.25, '#1d4ed8');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(0.75, '#be123c');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 128);

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 1018, 122);

    ctx.fillStyle = '#fef08a';
    ctx.font = '900 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚽ STREET FOOTBALL โกลหนู 3v3  •  6P PARTY ARENA  •  NO GK! ⚽', 512, 66);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildMatchBallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#0f172a';
    [
      [34, 34],
      [102, 28],
      [174, 34],
      [234, 30],
      [68, 92],
      [142, 94],
      [208, 88],
    ].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// 6-Player Squad Character Builder (RPG Island Characters + .glb Fallback)
// ============================================================================

interface PitchPlayerVisual {
  id: FootballSlotId;
  team: FootballTeam;
  isCaptain: boolean;
  root: THREE.Group;
  bodyTiltGroup: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  charParts?: CharacterMeshParts;
  setAnimMode: (mode: 'idle' | 'run' | 'slide') => void;
  markDisposed: () => void;
  activeRing: THREE.Mesh;
  aimArrow: THREE.Mesh;
  shadowDisc: THREE.Mesh;
  hudEl: HTMLDivElement;
  nameBadgeEl: HTMLDivElement;
  callBadgeEl: HTMLDivElement;
  staminaTrackEl: HTMLDivElement;
  staminaFillEl: HTMLDivElement;
  chargeWrapEl: HTMLDivElement;
  chargeFillEl: HTMLDivElement;
  baseDisplayName: string;
}

function attachTeamKitAndHeadband(
  parent: THREE.Group,
  team: FootballTeam,
  isCaptain: boolean,
  skipHeadband = false
): void {
  const primaryHex = team === 'blue' ? 0x2563eb : 0xe11d48;
  const bandHex = team === 'blue' ? 0x38bdf8 : 0xfb7185;

  const jerseyMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    emissive: primaryHex,
    emissiveIntensity: 0.18,
    roughness: 0.45,
  });
  const jerseyRing = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.39, 0.28, 16), jerseyMat);
  jerseyRing.position.y = 0.62;
  parent.add(jerseyRing);

  if (!skipHeadband) {
    const bandMat = new THREE.MeshStandardMaterial({
      color: bandHex,
      emissive: bandHex,
      emissiveIntensity: 0.32,
      roughness: 0.35,
    });
    const headband = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.048, 8, 20), bandMat);
    headband.rotation.x = Math.PI / 2;
    headband.position.y = 1.36;
    parent.add(headband);
  }

  if (isCaptain) {
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11, 0),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.45,
      })
    );
    star.position.set(0, 1.98, 0);
    parent.add(star);
  }
}

function buildFallbackChibiBody(charDef: PenaltyCharacterDef): THREE.Group {
  const g = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(charDef.accentColor),
    roughness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.32, 6, 12), furMat);
  torso.position.y = 0.62;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), furMat);
  head.position.y = 1.24;
  head.castShadow = true;
  [-0.12, 0.12].forEach((ez) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), darkMat);
    eye.position.set(0.32, 1.28, ez);
    g.add(eye);
  });
  [-0.16, 0.16].forEach((ez) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 7), furMat);
    ear.position.set(0, 1.62, ez);
    g.add(ear);
  });
  g.add(torso, head);
  return g;
}

async function buildSlotVisual(
  ent: FootballPlayerEntity,
  idx: number,
  mySlotId: FootballSlotId | null,
  hudLayer: HTMLElement,
  avatarProfile?: FootballAvatarProfile
): Promise<PitchPlayerVisual> {
  const team = ent.team;
  const isMe = ent.id === mySlotId;
  const charDef = getPenaltyCharacter(ent.modelId);
  let loadedGltf: GLTF | null = null;

  if (!avatarProfile) {
    const candidateUrls = [charDef.glbPath];
    if (charDef.fallbackGlbPath && charDef.fallbackGlbPath !== charDef.glbPath) {
      candidateUrls.push(charDef.fallbackGlbPath);
    }
    for (const u of candidateUrls) {
      try {
        loadedGltf = await loadCachedModel(u);
        break;
      } catch {
        // try fallback
      }
    }
  }

  const root = new THREE.Group();
  const bodyTiltGroup = new THREE.Group();
  let mixer: THREE.AnimationMixer | null = null;
  let charParts: CharacterMeshParts | undefined;
  let currentClip = '';
  let setAnimMode: (mode: 'idle' | 'run' | 'slide') => void = () => { };
  let markDisposed: () => void = () => { };

  if (avatarProfile) {
    charParts = buildCharacterMesh({
      colorHex: avatarProfile.colorHex || (team === 'blue' ? '#38BDF8' : '#FB7185'),
      accessory: 'headband',
      bandColor: team === 'blue' ? '#38BDF8' : '#EF4444',
      bellyScale: avatarProfile.bellyScale ?? 1,
      muscleScale: avatarProfile.muscleScale ?? 1,
      showDumbbells: false,
      species: avatarProfile.species || 'bunny',
      equipHat: avatarProfile.equipHat || 'none',
      equipFace: avatarProfile.equipFace || 'face_none',
      equipArmor: avatarProfile.equipArmor || 'armor_none',
      equipWeapon: 'weapon_none',
      equipWings: avatarProfile.equipWings || 'wings_none',
      equipAura: avatarProfile.equipAura || 'aura_none',
      equipMount: 'mount_none',
      propColors: avatarProfile.propColors as PropColorMap | undefined,
      animMode: 'idle',
      animSeed: idx * 1.35 + (team === 'blue' ? 0.2 : 0.9),
    });
    const sc = isMe || ent.isCaptain ? 0.84 : 0.81;
    charParts.rootGroup.scale.setScalar(sc);
    bodyTiltGroup.add(charParts.rootGroup);
    attachTeamKitAndHeadband(bodyTiltGroup, team, ent.isCaptain, true);

    let lastRpgMode = '';
    setAnimMode = (mode) => {
      if (!charParts?.playClip || mode === lastRpgMode) return;
      lastRpgMode = mode;
      if (mode === 'run') {
        charParts.playClip(resolveRpgAnimPatterns('run'));
      } else if (mode === 'slide') {
        charParts.playClip([/jump|attack|leap/i, ...resolveRpgAnimPatterns('run')]);
      } else {
        charParts.playClip(resolveRpgAnimPatterns('idle'));
      }
    };
    markDisposed = () => {
      if (charParts) {
        charParts.rootGroup.userData.disposed = true;
      }
    };
  } else if (loadedGltf) {
    const cloned = cloneSkinned(loadedGltf.scene) as THREE.Group;
    cloned.traverse((ch) => {
      if ((ch as THREE.Mesh).isMesh) {
        const m = ch as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        m.userData.isSharedGltfResource = true;
        if (m.geometry) m.geometry.userData.isSharedGltfResource = true;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          if (mat) mat.userData.isSharedGltfResource = true;
        });
      }
    });

    const norm = new THREE.Group();
    cloned.rotation.y = Math.PI / 2;
    norm.add(cloned);
    norm.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(norm);
    const sz = new THREE.Vector3();
    box.getSize(sz);
    const targetH = isMe || ent.isCaptain ? 1.78 : 1.72;
    const sc = targetH / Math.max(0.05, sz.y);
    norm.scale.setScalar(sc);
    norm.updateMatrixWorld(true);

    const box2 = new THREE.Box3().setFromObject(norm);
    const ctr = new THREE.Vector3();
    box2.getCenter(ctr);
    norm.position.x -= ctr.x;
    norm.position.z -= ctr.z;
    norm.position.y -= box2.min.y;

    bodyTiltGroup.add(norm);
    attachTeamKitAndHeadband(bodyTiltGroup, team, ent.isCaptain, false);

    const clips = loadedGltf.animations || [];
    if (clips.length > 0) {
      mixer = new THREE.AnimationMixer(cloned);
      setAnimMode = (mode) => {
        if (!mixer) return;
        const pats =
          mode === 'run'
            ? [/^run$/i, /run|sprint|gallop/i, /walk/i]
            : mode === 'slide'
              ? [/jump|fall|slide|attack/i, /run/i]
              : [/^idle$/i, /idle/i, /walk/i];
        let clip: THREE.AnimationClip | undefined;
        for (const p of pats) {
          clip = clips.find((c) => p.test(c.name));
          if (clip) break;
        }
        if (!clip) clip = clips[0];
        if (!clip || clip.name === currentClip) return;
        mixer.stopAllAction();
        const act = mixer.clipAction(clip);
        act.reset();
        act.play();
        currentClip = clip.name;
      };
      setAnimMode('idle');
    }
  } else {
    bodyTiltGroup.add(buildFallbackChibiBody(charDef));
    attachTeamKitAndHeadband(bodyTiltGroup, team, ent.isCaptain, false);
  }

  root.add(bodyTiltGroup);

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 16),
    new THREE.MeshBasicMaterial({ color: 0x052e16, transparent: true, opacity: 0.42 })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  // Glowing Foot Ring: Bright Gold for `mySlotId`, Team Sky/Rose for other human players!
  const ringHex = isMe ? 0xfacc15 : team === 'blue' ? 0x38bdf8 : 0xfb7185;
  const activeRing = new THREE.Mesh(
    new THREE.RingGeometry(isMe ? 0.64 : 0.58, isMe ? 0.88 : 0.76, 24),
    new THREE.MeshBasicMaterial({
      color: ringHex,
      transparent: true,
      opacity: isMe ? 0.96 : 0.65,
      side: THREE.DoubleSide,
    })
  );
  activeRing.rotation.x = -Math.PI / 2;
  activeRing.position.y = 0.035;
  activeRing.visible = !ent.isBot;
  root.add(activeRing);

  const aimArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.19, 0.36, 3),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  aimArrow.rotation.z = -Math.PI / 2;
  aimArrow.position.set(0.98, 0.05, 0);
  aimArrow.visible = isMe;
  bodyTiltGroup.add(aimArrow);

  // Projected HTML HUD (Call-for-Pass Bubble + Name Badge + Stamina + Shot Charge)
  const hudEl = document.createElement('div');
  hudEl.className = 'absolute -translate-x-1/2 pointer-events-none flex flex-col items-center gap-0.5';
  hudEl.style.left = '-999px';
  hudEl.style.top = '-999px';

  const callBadgeEl = document.createElement('div');
  callBadgeEl.className =
    'px-1.5 py-0.5 rounded-full bg-amber-300 text-slate-950 text-[9px] font-black shadow hidden animate-bounce';
  callBadgeEl.textContent = '🙋 ส่งมา!';
  hudEl.appendChild(callBadgeEl);

  const nameBadgeEl = document.createElement('div');
  nameBadgeEl.className = `px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black whitespace-nowrap border shadow ${isMe
      ? 'bg-amber-400 text-slate-950 border-white'
      : team === 'blue'
        ? 'bg-sky-950/90 text-sky-200 border-sky-400/70'
        : 'bg-rose-950/90 text-rose-200 border-rose-400/70'
    }`;
  const baseDisplayName = avatarProfile?.name || ent.name;
  nameBadgeEl.textContent = isMe
    ? `⭐ ${baseDisplayName} (คุณ)`
    : ent.isBot
      ? `🤖 ${baseDisplayName}`
      : `🎮 ${baseDisplayName}`;
  hudEl.appendChild(nameBadgeEl);

  const staminaTrackEl = document.createElement('div');
  staminaTrackEl.className =
    'w-12 h-1.5 rounded-full bg-slate-950/90 border border-white/40 overflow-hidden';
  staminaTrackEl.style.display = isMe ? 'block' : 'none';
  const staminaFillEl = document.createElement('div');
  staminaFillEl.className = 'h-full bg-cyan-400 transition-none';
  staminaFillEl.style.width = '100%';
  staminaTrackEl.appendChild(staminaFillEl);
  hudEl.appendChild(staminaTrackEl);

  const chargeWrapEl = document.createElement('div');
  chargeWrapEl.className =
    'w-14 h-2 rounded-full bg-slate-950 border border-amber-300 overflow-hidden hidden shadow';
  const chargeFillEl = document.createElement('div');
  chargeFillEl.className = 'h-full bg-gradient-to-r from-yellow-300 via-emerald-400 to-rose-500';
  chargeFillEl.style.width = '0%';
  chargeWrapEl.appendChild(chargeFillEl);
  hudEl.appendChild(chargeWrapEl);

  hudLayer.appendChild(hudEl);

  return {
    id: ent.id,
    team,
    isCaptain: ent.isCaptain,
    root,
    bodyTiltGroup,
    mixer,
    charParts,
    setAnimMode,
    markDisposed,
    activeRing,
    aimArrow,
    shadowDisc,
    hudEl,
    nameBadgeEl,
    callBadgeEl,
    staminaTrackEl,
    staminaFillEl,
    chargeWrapEl,
    chargeFillEl,
    baseDisplayName,
  };
}

// ============================================================================
// Render Snapshot Contract (Shared by Local Host State & Lerped Guest State)
// ============================================================================

export interface RenderPlayerFrame {
  id: FootballSlotId;
  isBot: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  stamina: number;
  shootCharge: number;
  slideTimer: number;
  callForPass: boolean;
}

export interface RenderPitchSnapshot {
  ballX: number;
  ballY: number;
  ballZ: number;
  ballVx: number;
  ballVz: number;
  isPowerShot: boolean;
  players: RenderPlayerFrame[];
}

export interface Football3v3SceneController {
  pushRenderState: (snap: RenderPitchSnapshot) => void;
  triggerGoalFx: (scoringTeam: FootballTeam) => void;
  setMuted: (muted: boolean) => void;
  dispose: () => void;
}

export function createFootball3v3StadiumScene(opts: {
  container: HTMLElement;
  hudOverlay: HTMLElement;
  mySlotId: FootballSlotId | null;
  entities: FootballPlayerEntity[];
  slotAvatars?: Partial<Record<FootballSlotId, FootballAvatarProfile>>;
  muted?: boolean;
}): Football3v3SceneController {
  const { container, hudOverlay } = opts;
  container.innerHTML = '';
  hudOverlay.innerHTML = '';

  let disposed = false;
  let muted = Boolean(opts.muted);
  void muted;

  const initW = container.clientWidth || window.innerWidth;
  const initH = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0ea5e9);
  scene.fog = new THREE.FogExp2(0x38bdf8, 0.0065);

  const camera = new THREE.PerspectiveCamera(42, initW / Math.max(1, initH), 0.1, 220);
  let camMaxTrackX = 9.5;
  let camHeightY = 15.8;
  let camOffsetZ = 20.6;

  const updateCameraProfile = (w: number, h: number) => {
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    if (aspect < 0.9) {
      camera.fov = 52;
      camHeightY = 21.5;
      camOffsetZ = 26.5;
      camMaxTrackX = 6.5;
    } else if (aspect < 1.45) {
      camera.fov = 45;
      camHeightY = 17.2;
      camOffsetZ = 22.4;
      camMaxTrackX = 8.2;
    } else {
      camera.fov = 40;
      camHeightY = 15.4;
      camOffsetZ = 20.2;
      camMaxTrackX = 9.8;
    }
    camera.updateProjectionMatrix();
  };
  updateCameraProfile(initW, initH);

  const camCurrentLook = new THREE.Vector3(0, 0.3, -0.5);
  camera.position.set(0, camHeightY, camOffsetZ);
  camera.lookAt(camCurrentLook);

  // Cap devicePixelRatio <= 2 for buttery 60 FPS on iPad & Mobile!
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(initW, initH);
  renderer.setPixelRatio(
    Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
  );
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.userSelect = 'none';
  container.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0x14532d, 0.98));
  const sun = new THREE.DirectionalLight(0xfffbeb, 1.4);
  sun.position.set(12, 28, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  scene.add(sun);

  // 1. Surrounds & Lush Striped 3v3 Turf
  const outerTrack = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH_HALF_W * 2 + 18, PITCH_HALF_D * 2 + 16),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.9 })
  );
  outerTrack.rotation.x = -Math.PI / 2;
  outerTrack.position.y = -0.02;
  scene.add(outerTrack);

  const turfTex = buildStripedTurfTexture();
  const pitchMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH_HALF_W * 2 + 2.4, PITCH_HALF_D * 2 + 2.4),
    new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.84 })
  );
  pitchMesh.rotation.x = -Math.PI / 2;
  pitchMesh.receiveShadow = true;
  scene.add(pitchMesh);

  // Crisp White Pitch Markings (Touchlines, Halfway Line, Center Circle, Mini-Goal Creases)
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const addLine = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.015, z);
    scene.add(m);
  };
  const lw = 0.14;
  addLine(PITCH_HALF_W * 2, lw, 0, -PITCH_HALF_D);
  addLine(PITCH_HALF_W * 2, lw, 0, PITCH_HALF_D);
  addLine(lw, PITCH_HALF_D * 2, -PITCH_HALF_W, 0);
  addLine(lw, PITCH_HALF_D * 2, PITCH_HALF_W, 0);
  addLine(lw, PITCH_HALF_D * 2, 0, 0);

  const centerCircle = new THREE.Mesh(new THREE.RingGeometry(3.55, 3.7, 40), lineMat);
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.y = 0.016;
  scene.add(centerCircle);

  const centerSpot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), lineMat);
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.y = 0.018;
  scene.add(centerSpot);

  [-1, 1].forEach((side) => {
    const gx = side * PITCH_HALF_W;
    const innerX = gx - side * PENALTY_BOX_DEPTH_X;
    addLine(lw, PENALTY_BOX_HALF_Z * 2, innerX, 0);
    addLine(PENALTY_BOX_DEPTH_X, lw, gx - side * (PENALTY_BOX_DEPTH_X / 2), -PENALTY_BOX_HALF_Z);
    addLine(PENALTY_BOX_DEPTH_X, lw, gx - side * (PENALTY_BOX_DEPTH_X / 2), PENALTY_BOX_HALF_Z);
  });

  // 2. Two Authentic 3D Street Mini-Goals ("โกลหนู" 3.60m × 1.70m) with Steel Rear Frames & Rippling Nets!
  const netTex = buildGoalNetTexture();
  const netGroups: Record<FootballTeam, THREE.Group> = {
    blue: new THREE.Group(),
    red: new THREE.Group(),
  };

  (['blue', 'red'] as const).forEach((teamSide) => {
    const sign = teamSide === 'blue' ? -1 : 1;
    const gx = sign * PITCH_HALF_W;
    const gGroup = new THREE.Group();
    gGroup.position.set(gx, 0, 0);

    const postColor = teamSide === 'blue' ? 0xbae6fd : 0xfecdd3;
    const postMat = new THREE.MeshStandardMaterial({
      color: postColor,
      roughness: 0.28,
      metalness: 0.25,
    });
    const rearSteelMat = new THREE.MeshStandardMaterial({
      color: teamSide === 'blue' ? 0x0284c7 : 0xe11d48,
      roughness: 0.4,
      metalness: 0.35,
    });
    const goalW = GOAL_3V3_HALF_Z * 2;

    [-GOAL_3V3_HALF_Z, GOAL_3V3_HALF_Z].forEach((pz) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, GOAL_3V3_HEIGHT, 12),
        postMat
      );
      post.position.set(0, GOAL_3V3_HEIGHT / 2, pz);
      post.castShadow = true;
      gGroup.add(post);

      // Ground rear base bar + angled street mini-goal support strut!
      const baseStrut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, GOAL_3V3_DEPTH, 10),
        rearSteelMat
      );
      baseStrut.rotation.z = Math.PI / 2;
      baseStrut.position.set(sign * (GOAL_3V3_DEPTH / 2), 0.06, pz);
      gGroup.add(baseStrut);

      const diagLen = Math.hypot(GOAL_3V3_DEPTH, GOAL_3V3_HEIGHT);
      const diagStrut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, diagLen, 10),
        rearSteelMat
      );
      diagStrut.rotation.z = sign * Math.atan2(GOAL_3V3_DEPTH, GOAL_3V3_HEIGHT);
      diagStrut.position.set(sign * (GOAL_3V3_DEPTH / 2), GOAL_3V3_HEIGHT / 2, pz);
      gGroup.add(diagStrut);
    });

    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, goalW + 0.17, 12),
      postMat
    );
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(0, GOAL_3V3_HEIGHT, 0);
    crossbar.castShadow = true;
    gGroup.add(crossbar);

    const rearGroundBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, goalW + 0.12, 10),
      rearSteelMat
    );
    rearGroundBar.rotation.x = Math.PI / 2;
    rearGroundBar.position.set(sign * GOAL_3V3_DEPTH, 0.06, 0);
    gGroup.add(rearGroundBar);

    const netMat = new THREE.MeshBasicMaterial({
      map: netTex,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
    });
    const netWrap = netGroups[teamSide];
    const backNet = new THREE.Mesh(new THREE.PlaneGeometry(goalW, GOAL_3V3_HEIGHT), netMat);
    backNet.rotation.y = Math.PI / 2;
    backNet.position.set(sign * GOAL_3V3_DEPTH, GOAL_3V3_HEIGHT / 2, 0);

    const topNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_3V3_DEPTH, goalW), netMat);
    topNet.rotation.x = Math.PI / 2;
    topNet.position.set(sign * (GOAL_3V3_DEPTH / 2), GOAL_3V3_HEIGHT, 0);

    [-GOAL_3V3_HALF_Z, GOAL_3V3_HALF_Z].forEach((sz) => {
      const sideNet = new THREE.Mesh(
        new THREE.PlaneGeometry(GOAL_3V3_DEPTH, GOAL_3V3_HEIGHT),
        netMat
      );
      sideNet.position.set(sign * (GOAL_3V3_DEPTH / 2), GOAL_3V3_HEIGHT / 2, sz);
      netWrap.add(sideNet);
    });

    netWrap.add(backNet, topNet);
    gGroup.add(netWrap);
    scene.add(gGroup);
  });

  // 3. Sideline LED Advertising Boards & Colorful Stadium Bleachers!
  const adTex = buildAdBannerTexture();
  const adMat = new THREE.MeshStandardMaterial({ map: adTex, roughness: 0.4 });
  const northAd = new THREE.Mesh(new THREE.BoxGeometry(PITCH_HALF_W * 2 + 4, 1.0, 0.25), adMat);
  northAd.position.set(0, 0.5, -PITCH_HALF_D - 1.65);
  scene.add(northAd);

  [-1, 1].forEach((endSign) => {
    [-7.8, 7.8].forEach((zPos) => {
      const sideAd = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.95, 6.6), adMat);
      sideAd.position.set(endSign * (PITCH_HALF_W + 2.3), 0.48, zPos);
      scene.add(sideAd);
    });
  });

  const standColors = [0x1d4ed8, 0xf59e0b, 0xe11d48, 0x7c3aed];
  for (let tier = 0; tier < 4; tier++) {
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(PITCH_HALF_W * 2 + 12 + tier * 2, 1.0, 1.7),
      new THREE.MeshStandardMaterial({ color: standColors[tier], roughness: 0.7 })
    );
    stand.position.set(0, 0.9 + tier * 0.95, -PITCH_HALF_D - 3.3 - tier * 1.7);
    scene.add(stand);
  }

  // Instanced Cheering Stadium Crowd (single GPU draw call!)
  const crowdTotal = 88;
  const crowdInst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.32, 8, 8),
    new THREE.MeshStandardMaterial({ roughness: 0.5 }),
    crowdTotal
  );
  const crowdCoords: Array<{ x: number; y: number; z: number; ph: number }> = [];
  const dummy = new THREE.Object3D();
  const colObj = new THREE.Color();
  const crowdPalette = [0x38bdf8, 0xfb7185, 0xfacc15, 0x4ade80, 0xffffff, 0xc084fc];
  for (let i = 0; i < crowdTotal; i++) {
    const r = i % 4;
    const c = Math.floor(i / 4);
    const x = -21 + c * 2.0 + (r % 2) * 0.5;
    const y = 1.62 + r * 0.95;
    const z = -PITCH_HALF_D - 3.3 - r * 1.7;
    crowdCoords.push({ x, y, z, ph: i * 0.65 });
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    crowdInst.setMatrixAt(i, dummy.matrix);
    colObj.setHex(crowdPalette[i % crowdPalette.length]);
    crowdInst.setColorAt(i, colObj);
  }
  crowdInst.instanceMatrix.needsUpdate = true;
  if (crowdInst.instanceColor) crowdInst.instanceColor.needsUpdate = true;
  scene.add(crowdInst);

  // 4. 3D Football + Shadow + Fiery Power Shot Trail
  const ballTex = buildMatchBallTexture();
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 20, 16),
    new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.32 })
  );
  ballMesh.castShadow = true;
  ballMesh.position.set(0, BALL_RADIUS, 0);
  scene.add(ballMesh);

  const ballShadow = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_RADIUS * 1.2, 16),
    new THREE.MeshBasicMaterial({ color: 0x052e16, transparent: true, opacity: 0.5 })
  );
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.position.y = 0.02;
  scene.add(ballShadow);

  const shotTrail = Array.from({ length: 6 }, (_, idx) => {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS * (0.85 - idx * 0.1), 8, 8),
      new THREE.MeshBasicMaterial({
        color: idx < 2 ? 0xef4444 : 0xfacc15,
        transparent: true,
        opacity: 0.5 - idx * 0.07,
      })
    );
    orb.visible = false;
    scene.add(orb);
    return orb;
  });
  const trailPts: THREE.Vector3[] = [];

  // 5. Build All 6 Street Footballer Visuals (`B1..B3` vs `R1..R3` — Zero GK!)
  const visualsById = new Map<FootballSlotId, PitchPlayerVisual>();
  void Promise.all(
    opts.entities.map((ent, idx) =>
      buildSlotVisual(ent, idx, opts.mySlotId, hudOverlay, opts.slotAvatars?.[ent.slotId])
    )
  ).then((allVis) => {
    if (disposed) {
      allVis.forEach((v) => {
        v.markDisposed();
        disposeObject3D(v.root);
      });
      return;
    }
    for (const v of allVis) {
      visualsById.set(v.id, v);
      scene.add(v.root);
    }
  });

  let latestSnap: RenderPitchSnapshot | null = null;
  let goalCelebrationBoost = 0;
  let goalNetRippleTeam: FootballTeam | null = null;

  const projVec = new THREE.Vector3();
  const clock = new THREE.Clock();
  let elapsed = 0;
  let rafId = 0;

  const animate = () => {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    elapsed += dt;

    const cAmp = goalCelebrationBoost > 0.05 ? 0.25 : 0.04;
    const cFreq = goalCelebrationBoost > 0.05 ? 14 : 4.2;
    for (let i = 0; i < crowdTotal; i++) {
      const b = crowdCoords[i];
      dummy.position.set(b.x, b.y + Math.abs(Math.sin(elapsed * cFreq + b.ph)) * cAmp, b.z);
      dummy.updateMatrix();
      crowdInst.setMatrixAt(i, dummy.matrix);
    }
    crowdInst.instanceMatrix.needsUpdate = true;

    if (goalCelebrationBoost > 0) {
      if (goalNetRippleTeam) {
        netGroups[goalNetRippleTeam].position.x =
          (goalNetRippleTeam === 'blue' ? -1 : 1) *
          Math.abs(Math.sin(elapsed * 26)) *
          0.35 *
          goalCelebrationBoost;
      }
      goalCelebrationBoost = Math.max(0, goalCelebrationBoost - dt * 0.55);
    } else {
      netGroups.blue.position.x = 0;
      netGroups.red.position.x = 0;
    }

    if (latestSnap) {
      ballMesh.position.set(latestSnap.ballX, latestSnap.ballY, latestSnap.ballZ);
      const bSpd = Math.hypot(latestSnap.ballVx, latestSnap.ballVz);
      if (bSpd > 0.3) {
        ballMesh.rotation.z -= latestSnap.ballVx * dt * 2.2;
        ballMesh.rotation.x += latestSnap.ballVz * dt * 2.2;
      }
      ballShadow.position.set(latestSnap.ballX, 0.02, latestSnap.ballZ);
      const sSc = Math.max(0.4, 1.15 - (latestSnap.ballY - BALL_RADIUS) * 0.16);
      ballShadow.scale.set(sSc, sSc, 1);

      if (latestSnap.isPowerShot) {
        trailPts.unshift(ballMesh.position.clone());
        if (trailPts.length > shotTrail.length) trailPts.pop();
        shotTrail.forEach((orb, idx) => {
          const p = trailPts[idx];
          if (p) {
            orb.visible = true;
            orb.position.copy(p);
          }
        });
      } else {
        trailPts.length = 0;
        shotTrail.forEach((o) => {
          o.visible = false;
        });
      }

      // Smooth Broadcast Camera Follow
      const desiredCamX = Math.max(
        -camMaxTrackX,
        Math.min(camMaxTrackX, latestSnap.ballX * 0.62)
      );
      const desiredCamZ = camOffsetZ + Math.max(-2.2, Math.min(2.6, latestSnap.ballZ * 0.22));
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, desiredCamX, 0.085);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, camHeightY, 0.08);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredCamZ, 0.085);

      camCurrentLook.x = THREE.MathUtils.lerp(camCurrentLook.x, desiredCamX * 0.92, 0.11);
      camCurrentLook.z = THREE.MathUtils.lerp(
        camCurrentLook.z,
        Math.max(-3.5, Math.min(3.5, latestSnap.ballZ * 0.28)),
        0.1
      );
      camera.lookAt(camCurrentLook);

      const cw = container.clientWidth || window.innerWidth;
      const ch = container.clientHeight || window.innerHeight;

      // Update all 6 Players + Glowing Rings + Projected HUD!
      for (const pf of latestSnap.players) {
        const vis = visualsById.get(pf.id);
        if (!vis) continue;
        if (vis.mixer) vis.mixer.update(dt);
        if (vis.charParts?.mixer) vis.charParts.mixer.update(dt);
        if (vis.charParts?.auraSpinGroup) {
          vis.charParts.auraSpinGroup.rotation.y = elapsed * 1.8;
        }
        if (vis.charParts && !vis.charParts.mixer) {
          const spd = Math.hypot(pf.vx, pf.vz);
          const cyc = spd > 0.45 ? Math.sin(elapsed * 14) * 0.45 : 0;
          vis.charParts.legL.rotation.z = cyc;
          vis.charParts.legR.rotation.z = -cyc;
          vis.charParts.armL.rotation.z = -cyc * 0.8;
          vis.charParts.armR.rotation.z = cyc * 0.8;
        }

        vis.root.position.set(pf.x, 0, pf.z);
        vis.bodyTiltGroup.rotation.set(0, -pf.yaw, 0);

        const moveSpd = Math.hypot(pf.vx, pf.vz);
        if (pf.slideTimer > 0.02) {
          vis.setAnimMode('slide');
          vis.bodyTiltGroup.rotation.z = -0.85;
          vis.bodyTiltGroup.position.y = 0.12;
        } else if (moveSpd > 0.45) {
          vis.setAnimMode('run');
          vis.bodyTiltGroup.position.y = Math.abs(Math.sin(elapsed * 13)) * 0.09;
        } else {
          vis.setAnimMode('idle');
          vis.bodyTiltGroup.position.y = 0;
        }

        const isMe = pf.id === opts.mySlotId;
        const isHuman = !pf.isBot;

        vis.activeRing.visible = isHuman;
        vis.aimArrow.visible = isMe;
        if (vis.activeRing.visible) {
          const pulse = 1 + Math.sin(elapsed * 7) * 0.08;
          vis.activeRing.scale.set(pulse, pulse, 1);
          (vis.activeRing.material as THREE.MeshBasicMaterial).opacity = isMe ? 0.96 : 0.62;
        }

        // Update badge if a slot transitioned to AI bot mid-match
        const expectedLabel = isMe
          ? `⭐ ${vis.baseDisplayName} (คุณ)`
          : pf.isBot
            ? `🤖 ${vis.baseDisplayName}`
            : `🎮 ${vis.baseDisplayName}`;
        if (vis.nameBadgeEl.textContent !== expectedLabel) {
          vis.nameBadgeEl.textContent = expectedLabel;
        }

        if (pf.callForPass) {
          vis.callBadgeEl.classList.remove('hidden');
        } else {
          vis.callBadgeEl.classList.add('hidden');
        }

        projVec.set(pf.x, 2.25, pf.z);
        projVec.project(camera);
        if (projVec.z < 1) {
          const sx = (projVec.x * 0.5 + 0.5) * cw;
          const sy = (-projVec.y * 0.5 + 0.5) * ch;
          vis.hudEl.style.left = `${sx.toFixed(1)}px`;
          vis.hudEl.style.top = `${sy.toFixed(1)}px`;
          vis.hudEl.style.opacity = isMe ? '1' : isHuman ? '0.88' : '0.68';
        } else {
          vis.hudEl.style.opacity = '0';
        }

        vis.staminaTrackEl.style.display = isMe ? 'block' : 'none';
        if (isMe) {
          vis.staminaFillEl.style.width = `${Math.round(pf.stamina)}%`;
          vis.staminaFillEl.className =
            pf.stamina < 25 ? 'h-full bg-orange-400' : 'h-full bg-cyan-400';
        }

        if ((isMe || isHuman) && pf.shootCharge > 2) {
          vis.chargeWrapEl.classList.remove('hidden');
          vis.chargeFillEl.style.width = `${Math.min(100, Math.round(pf.shootCharge))}%`;
        } else {
          vis.chargeWrapEl.classList.add('hidden');
        }
      }
    }

    renderer.render(scene, camera);
  };
  animate();

  const onResize = () => {
    if (disposed) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    updateCameraProfile(w, h);
    renderer.setSize(w, h);
    renderer.setPixelRatio(
      Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
    );
  };
  window.addEventListener('resize', onResize);

  return {
    pushRenderState(snap: RenderPitchSnapshot) {
      latestSnap = snap;
    },
    triggerGoalFx(scoringTeam: FootballTeam) {
      goalCelebrationBoost = 1.0;
      goalNetRippleTeam = scoringTeam === 'blue' ? 'red' : 'blue';
      playPenaltySfx('goal', muted);
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      visualsById.forEach((v) => v.markDisposed());
      disposeObject3D(scene);
      renderer.dispose();
      container.innerHTML = '';
      hudOverlay.innerHTML = '';
    },
  };
}
