// lib/penalty_scene.ts
// Three.js 3D Penalty Shootout Engine:
// - Emerald pitch, 3D goal frame & rippling net, penalty spot, classic soccer ball, colorful fantasy stadium
// - PES-style behind-shooter camera with dynamic run-up & curved flight tracking
// - GLTFLoader Auto-Normalize (.glb in public/models/) + Procedural Chibi 3D Fallback
// - Direct 3D Goal-Zone Raycast Tap/Click for Desktop, iPad, and Mobile + devicePixelRatio <= 2

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
  GOAL_DEPTH,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  GOAL_Z,
  GOAL_ZONES,
  PENALTY_SPOT_Z,
  getGoalZoneMeta,
  getPenaltyCharacter,
  type FootballAvatarProfile,
  type PenaltyCharacterDef,
  type PenaltyZone,
  type ResolvedTurnResult,
} from './rules';

// ============================================================================
// Web Audio Synthesized Crowd Cheer & Stadium SFX (zero external audio files needed)
// ============================================================================

let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) sharedAudioCtx = new AC();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playPenaltySfx(
  kind: 'whistle' | 'lock' | 'kick' | 'goal' | 'saved' | 'post' | 'miss',
  muted = false
): void {
  if (muted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  try {
    if (kind === 'whistle') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2680, now);
      osc.frequency.setValueAtTime(2820, now + 0.08);
      osc.frequency.setValueAtTime(2650, now + 0.16);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (kind === 'lock') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (kind === 'kick') {
      // Deep leather football thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(165, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (kind === 'goal') {
      // Stadium fanfare chord + crowd roar noise burst!
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.055);
        gain.gain.setValueAtTime(0.001, now + idx * 0.055);
        gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.055 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + idx * 0.055);
        osc.stop(now + 0.88);
      });

      const bufLen = Math.floor(ctx.sampleRate * 0.9);
      const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 950;
      filter.Q.value = 0.7;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.01, now);
      nGain.gain.linearRampToValueAtTime(0.18, now + 0.12);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      noise.connect(filter).connect(nGain).connect(ctx.destination);
      noise.start(now);
    } else if (kind === 'saved') {
      // Punchy glove block + rising keeper cheer!
      [392, 523.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.09, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + 0.38);
      });
    } else if (kind === 'post') {
      // Metallic crossbar/post clang!
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.32);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (kind === 'miss') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.linearRampToValueAtTime(190, now + 0.35);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch {
    // ignore WebAudio restrictions
  }
}

// ============================================================================
// Cached GLTFLoader with Auto-Normalize & Chibi 3D Procedural Fallback
// ============================================================================

const gltfPromiseCache = new Map<string, Promise<GLTF>>();
const sharedGltfLoader = new GLTFLoader();

function loadGltfOnce(url: string): Promise<GLTF> {
  const cached = gltfPromiseCache.get(url);
  if (cached) return cached;
  const p = new Promise<GLTF>((resolve, reject) => {
    sharedGltfLoader.load(url, resolve, undefined, reject);
  });
  gltfPromiseCache.set(url, p);
  return p;
}

interface PenaltyActorHandle {
  root: THREE.Group;
  visualGroup: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  charParts?: CharacterMeshParts;
  playState: (mode: 'idle' | 'run' | 'kick' | 'dive' | 'celebrate') => void;
  markDisposed: () => void;
  fallbackLimbs?: {
    armL: THREE.Object3D;
    armR: THREE.Object3D;
    legL: THREE.Object3D;
    legR: THREE.Object3D;
  };
}

/**
 * Builds the player's actual customized 3D RPG Character (`buildCharacterMesh`)
 * with all equipped hats, glasses/face, clothes, wings, aura, body color, and belly/muscle scales!
 */
function buildRpgAvatarPenaltyActor(
  avatar: FootballAvatarProfile,
  role: 'shooter' | 'keeper'
): PenaltyActorHandle {
  const root = new THREE.Group();
  const visualGroup = new THREE.Group();

  const charParts = buildCharacterMesh({
    colorHex: avatar.colorHex || (role === 'shooter' ? '#38BDF8' : '#FACC15'),
    accessory: 'headband',
    bandColor: role === 'shooter' ? '#38BDF8' : '#FACC15',
    bellyScale: avatar.bellyScale ?? 1,
    muscleScale: avatar.muscleScale ?? 1,
    showDumbbells: false,
    species: avatar.species || 'bunny',
    equipHat: avatar.equipHat || 'none',
    equipFace: avatar.equipFace || 'face_none',
    equipArmor: avatar.equipArmor || 'armor_none',
    equipWeapon: 'weapon_none',
    equipWings: avatar.equipWings || 'wings_none',
    equipAura: avatar.equipAura || 'aura_none',
    equipMount: 'mount_none',
    propColors: avatar.propColors as PropColorMap | undefined,
    animMode: 'idle',
    animSeed: role === 'shooter' ? 0.3 : 1.9,
  });

  // `buildCharacterMesh` faces +X when rotation.y = 0:
  // Shooter faces Goal (-Z) -> +Math.PI / 2; Goalkeeper faces Shooter (+Z) -> -Math.PI / 2
  charParts.rootGroup.scale.setScalar(0.88);
  charParts.rootGroup.rotation.y = role === 'shooter' ? Math.PI / 2 : -Math.PI / 2;
  visualGroup.add(charParts.rootGroup);
  root.add(visualGroup);

  const playState = (state: 'idle' | 'run' | 'kick' | 'dive' | 'celebrate') => {
    if (!charParts.playClip) return;
    if (state === 'run') {
      charParts.playClip(resolveRpgAnimPatterns('run'));
    } else if (state === 'kick' || state === 'dive') {
      charParts.playClip([/jump|attack|leap/i, ...resolveRpgAnimPatterns('run')]);
    } else if (state === 'celebrate') {
      charParts.playClip(resolveRpgAnimPatterns('cheer'));
    } else {
      charParts.playClip(resolveRpgAnimPatterns('idle'));
    }
  };

  return {
    root,
    visualGroup,
    mixer: null, // updated dynamically via charParts.mixer since GLB rig finishes loading async!
    charParts,
    playState,
    markDisposed: () => {
      charParts.rootGroup.userData.disposed = true;
    },
  };
}

/**
 * Builds a cute Chibi 3D Footballer fallback mesh whenever a .glb file in public/models/
 * does not exist yet or fails to load, ensuring 100% playability out of the box.
 */
function buildProceduralChibiFallback(
  charDef: PenaltyCharacterDef,
  role: 'shooter' | 'keeper',
  facingSignZ: 1 | -1
): PenaltyActorHandle {
  const root = new THREE.Group();
  const visualGroup = new THREE.Group();
  // Procedural model faces +Z by default; rotate to face -Z when shooting toward goal!
  visualGroup.rotation.y = facingSignZ === -1 ? Math.PI : 0;

  const furMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(charDef.accentColor),
    roughness: 0.55,
  });
  const kitColor = role === 'shooter' ? 0x2563eb : 0xfacc15;
  const kitMat = new THREE.MeshStandardMaterial({ color: kitColor, roughness: 0.5 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35 });

  // Torso (Jersey)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.36, 8, 14), kitMat);
  torso.position.y = 0.78;
  torso.castShadow = true;
  visualGroup.add(torso);

  // Shortsstripe
  const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.28, 0.22, 14), whiteMat);
  shorts.position.y = 0.5;
  visualGroup.add(shorts);

  // Big Cute Chibi Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 16), furMat);
  head.position.y = 1.42;
  head.castShadow = true;
  visualGroup.add(head);

  // Muzzle + Eyes
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), whiteMat);
  muzzle.scale.set(1.15, 0.8, 0.7);
  muzzle.position.set(0, 1.34, 0.35);
  visualGroup.add(muzzle);

  [-0.14, 0.14].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), darkMat);
    eye.position.set(ex, 1.46, 0.37);
    visualGroup.add(eye);
  });

  // Species Ears
  if (charDef.earStyle === 'bunny') {
    [-0.16, 0.16].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34, 6, 10), furMat);
      ear.position.set(ex, 1.95, 0);
      ear.rotation.z = ex < 0 ? 0.12 : -0.12;
      visualGroup.add(ear);
    });
  } else if (charDef.earStyle === 'bear' || charDef.earStyle === 'frog') {
    [-0.26, 0.26].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), furMat);
      ear.position.set(ex, 1.78, 0);
      visualGroup.add(ear);
    });
  } else {
    [-0.22, 0.22].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 8), furMat);
      ear.position.set(ex, 1.84, 0);
      ear.rotation.z = ex < 0 ? 0.22 : -0.22;
      visualGroup.add(ear);
    });
  }

  // Arms (Goalkeeper gets bright white/emerald keeper gloves!)
  const gloveMat = role === 'keeper' ? whiteMat : furMat;
  const armL = new THREE.Group();
  armL.position.set(-0.38, 0.95, 0);
  const armLMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.26, 6, 10), gloveMat);
  armLMesh.position.y = -0.16;
  armL.add(armLMesh);

  const armR = new THREE.Group();
  armR.position.set(0.38, 0.95, 0);
  const armRMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.26, 6, 10), gloveMat);
  armRMesh.position.y = -0.16;
  armR.add(armRMesh);
  visualGroup.add(armL, armR);

  // Legs + Football Boots
  const legL = new THREE.Group();
  legL.position.set(-0.15, 0.42, 0);
  const legLMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.22, 6, 10), darkMat);
  legLMesh.position.y = -0.18;
  legL.add(legLMesh);

  const legR = new THREE.Group();
  legR.position.set(0.15, 0.42, 0);
  const legRMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.22, 6, 10), darkMat);
  legRMesh.position.y = -0.18;
  legR.add(legRMesh);
  visualGroup.add(legL, legR);

  root.add(visualGroup);
  return {
    root,
    visualGroup,
    mixer: null,
    playState: () => {},
    markDisposed: () => {},
    fallbackLimbs: { armL, armR, legL, legR },
  };
}

/**
 * Loads a .glb character from public/models/ with GLTFLoader and Auto-Normalizes:
 * - Bounding-box height scaled to `targetHeight` (1.92m)
 * - Centered on X/Z and feet planted cleanly at y = 0
 * - Auto-rotated to face `-Z` (Shooter facing goal) or `+Z` (Goalkeeper facing shooter)
 * - Falls back automatically to secondary .glb or Procedural Chibi 3D if missing!
 */
async function loadAutoNormalizedPenaltyActor(
  modelId: string,
  role: 'shooter' | 'keeper',
  targetHeight = 1.92
): Promise<PenaltyActorHandle> {
  const charDef = getPenaltyCharacter(modelId);
  const facingSignZ: 1 | -1 = role === 'shooter' ? -1 : 1;

  const candidatePaths = [charDef.glbPath];
  if (charDef.fallbackGlbPath && charDef.fallbackGlbPath !== charDef.glbPath) {
    candidatePaths.push(charDef.fallbackGlbPath);
  }

  for (const url of candidatePaths) {
    try {
      const gltf = await loadGltfOnce(url);
      const cloned = cloneSkinned(gltf.scene) as THREE.Group;

      cloned.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
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

      // Native glTF models in public/models/ face +Z in local space:
      // rotate Y by Math.PI when facing -Z (Shooter looking at Goal), or 0 when facing +Z (Goalkeeper looking at Shooter)
      const normWrapper = new THREE.Group();
      cloned.rotation.y = facingSignZ === -1 ? Math.PI : 0;
      normWrapper.add(cloned);
      normWrapper.updateMatrixWorld(true);

      const rawBox = new THREE.Box3().setFromObject(normWrapper);
      const rawSize = new THREE.Vector3();
      rawBox.getSize(rawSize);
      const scale = targetHeight / Math.max(0.05, rawSize.y);
      normWrapper.scale.setScalar(scale);
      normWrapper.updateMatrixWorld(true);

      const fittedBox = new THREE.Box3().setFromObject(normWrapper);
      const fittedCenter = new THREE.Vector3();
      fittedBox.getCenter(fittedCenter);
      normWrapper.position.x -= fittedCenter.x;
      normWrapper.position.z -= fittedCenter.z;
      normWrapper.position.y -= fittedBox.min.y;

      const visualGroup = new THREE.Group();
      visualGroup.add(normWrapper);

      const root = new THREE.Group();
      root.add(visualGroup);

      const clips = gltf.animations || [];
      const mixer = clips.length > 0 ? new THREE.AnimationMixer(cloned) : null;
      let activeClipName = '';

      const playState = (state: 'idle' | 'run' | 'kick' | 'dive' | 'celebrate') => {
        if (!mixer || clips.length === 0) return;
        const patternsByState: Record<typeof state, RegExp[]> = {
          idle: [/^idle$/i, /idle/i, /walk/i],
          run: [/^run$/i, /run|sprint|gallop/i, /walk/i],
          kick: [/attack|kick|jump|leap/i, /run/i],
          dive: [/jump|leap|fall|roll/i, /run/i],
          celebrate: [/dance|victory|yes|wave|jump|bounce/i, /idle/i],
        };
        const patterns = patternsByState[state];
        let matched: THREE.AnimationClip | undefined;
        for (const p of patterns) {
          matched = clips.find((c) => p.test(c.name));
          if (matched) break;
        }
        if (!matched) {
          matched = clips.find((c) => !/death|die|static|t-pose/i.test(c.name)) || clips[0];
        }
        if (!matched || matched.name === activeClipName) return;
        mixer.stopAllAction();
        const act = mixer.clipAction(matched);
        act.reset();
        act.play();
        activeClipName = matched.name;
      };

      playState('idle');
      return { root, visualGroup, mixer, playState, markDisposed: () => {} };
    } catch {
      // Try next fallback path or procedural Chibi 3D fallback
    }
  }

  return buildProceduralChibiFallback(charDef, role, facingSignZ);
}

// ============================================================================
// Procedural Textures (Grass Stripes, 3D Goal Net, Classic Pentagon Football)
// ============================================================================

function createPitchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const stripes = 12;
    const h = canvas.height / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#16a34a' : '#22c55e';
      ctx.fillRect(0, i * h, canvas.width, h);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

function createNetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
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
  tex.repeat.set(8, 3);
  return tex;
}

function createSoccerBallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#0f172a';
    const spots = [
      [36, 32],
      [104, 28],
      [176, 34],
      [236, 30],
      [68, 88],
      [140, 92],
      [208, 86],
    ];
    for (const [cx, cy] of spots) {
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(ang) * 17;
        const py = cy + Math.sin(ang) * 15;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// Main 3D Penalty Stadium Scene Controller
// ============================================================================

export interface PenaltySceneOptions {
  container: HTMLElement;
  shooterModelId: string;
  keeperModelId: string;
  shooterAvatar?: FootballAvatarProfile | null;
  keeperAvatar?: FootballAvatarProfile | null;
  muted?: boolean;
  onZoneSelect?: (zone: PenaltyZone) => void;
}

export interface PenaltySceneController {
  setActors: (
    shooterModelId: string,
    keeperModelId: string,
    shooterAvatar?: FootballAvatarProfile | null,
    keeperAvatar?: FootballAvatarProfile | null
  ) => void;
  setHighlightedZone: (zone: PenaltyZone | null, role: 'shooter' | 'keeper' | 'hidden') => void;
  setZonePickingEnabled: (enabled: boolean) => void;
  setMuted: (muted: boolean) => void;
  resetPositionsForTurn: () => void;
  playTurnReveal: (
    result: ResolvedTurnResult,
    onImpact: (result: ResolvedTurnResult) => void,
    onFinished: () => void
  ) => void;
  dispose: () => void;
}

interface ActiveRevealAnim {
  result: ResolvedTurnResult;
  elapsed: number;
  kickTriggered: boolean;
  impactTriggered: boolean;
  finishedTriggered: boolean;
  onImpact: (res: ResolvedTurnResult) => void;
  onFinished: () => void;
}

export function createPenaltyStadiumScene(opts: PenaltySceneOptions): PenaltySceneController {
  const { container } = opts;
  container.innerHTML = '';

  let muted = Boolean(opts.muted);
  let zonePickingEnabled = true;
  let disposed = false;

  const initW = container.clientWidth || window.innerWidth;
  const initH = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x38bdf8);
  scene.fog = new THREE.FogExp2(0x7dd3fc, 0.009);

  // PES-style camera behind Shooter looking toward Goalkeeper & Goal!
  const camera = new THREE.PerspectiveCamera(44, initW / Math.max(1, initH), 0.1, 180);
  const baseCamPos = new THREE.Vector3(-0.55, 2.55, 6.6);
  const baseCamLook = new THREE.Vector3(0, 1.38, GOAL_Z + 1.2);

  const computePesCameraPose = (w: number, h: number) => {
    const aspect = w / Math.max(1, h);
    if (aspect < 0.78) {
      // Portrait smartphone: pull back & lift slightly so all 6 goal zones + shooter + ball fit cleanly!
      camera.fov = 52;
      baseCamPos.set(-0.35, 3.05, 8.35);
      baseCamLook.set(0, 1.22, GOAL_Z + 1.5);
    } else if (aspect < 1.15) {
      // iPad / Tablet portrait-ish
      camera.fov = 47;
      baseCamPos.set(-0.45, 2.75, 7.25);
      baseCamLook.set(0, 1.32, GOAL_Z + 1.3);
    } else {
      // Desktop / Landscape iPad classic PES angle
      camera.fov = 43;
      baseCamPos.set(-0.55, 2.5, 6.45);
      baseCamLook.set(0, 1.4, GOAL_Z + 1.1);
    }
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  };
  computePesCameraPose(initW, initH);
  camera.position.copy(baseCamPos);
  camera.lookAt(baseCamLook);

  // Strict devicePixelRatio cap <= 2 for smooth framerate & battery savings on iPad/Mobile!
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(initW, initH);
  renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.userSelect = 'none';
  container.appendChild(renderer.domElement);

  // Stadium Lighting
  const hemi = new THREE.HemisphereLight(0xffffff, 0x15803d, 0.95);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfffbeb, 1.45);
  sun.position.set(10, 22, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -16;
  scene.add(sun);

  // 1. Lush Striped Football Pitch + Crisp White Penalty Box Markings
  const pitchTex = createPitchTexture();
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(54, 52),
    new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.85 })
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0, -6);
  pitch.receiveShadow = true;
  scene.add(pitch);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const addPitchLine = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.015, z);
    scene.add(m);
  };
  // Goal line & 18-yard Penalty Box & 6-yard Box
  addPitchLine(36, 0.14, 0, GOAL_Z);
  addPitchLine(18.5, 0.12, 0, GOAL_Z + 16.5);
  addPitchLine(0.12, 16.5, -9.25, GOAL_Z + 8.25);
  addPitchLine(0.12, 16.5, 9.25, GOAL_Z + 8.25);
  addPitchLine(11.0, 0.11, 0, GOAL_Z + 5.5);
  addPitchLine(0.11, 5.5, -5.5, GOAL_Z + 2.75);
  addPitchLine(0.11, 5.5, 5.5, GOAL_Z + 2.75);

  // Penalty Spot Disc (z = 0)
  const penaltySpot = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), lineMat);
  penaltySpot.rotation.x = -Math.PI / 2;
  penaltySpot.position.set(0, 0.018, PENALTY_SPOT_Z);
  scene.add(penaltySpot);

  // 2. 3D Goal Frame + 3D Rippling Net
  const goalGroup = new THREE.Group();
  goalGroup.position.set(0, 0, GOAL_Z);

  const postMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.18,
  });
  const postRadius = 0.09;
  const halfGoalW = GOAL_WIDTH / 2;

  const leftPost = new THREE.Mesh(
    new THREE.CylinderGeometry(postRadius, postRadius, GOAL_HEIGHT, 16),
    postMat
  );
  leftPost.position.set(-halfGoalW, GOAL_HEIGHT / 2, 0);
  leftPost.castShadow = true;

  const rightPost = leftPost.clone();
  rightPost.position.set(halfGoalW, GOAL_HEIGHT / 2, 0);

  const crossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(postRadius, postRadius, GOAL_WIDTH + postRadius * 2, 16),
    postMat
  );
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, GOAL_HEIGHT, 0);
  crossbar.castShadow = true;

  // Back support stanchions
  const backBarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
  [-halfGoalW, halfGoalW].forEach(( sideX ) => {
    const basePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, GOAL_DEPTH, 10), backBarMat);
    basePipe.rotation.x = Math.PI / 2;
    basePipe.position.set(sideX, 0.05, -GOAL_DEPTH / 2);
    goalGroup.add(basePipe);

    const diagLen = Math.hypot(GOAL_HEIGHT, GOAL_DEPTH);
    const diagPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, diagLen, 10), backBarMat);
    diagPipe.position.set(sideX, GOAL_HEIGHT / 2, -GOAL_DEPTH / 2);
    diagPipe.rotation.x = Math.atan2(GOAL_DEPTH, GOAL_HEIGHT);
    goalGroup.add(diagPipe);
  });
  const backBottomCross = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, GOAL_WIDTH, 10),
    backBarMat
  );
  backBottomCross.rotation.z = Math.PI / 2;
  backBottomCross.position.set(0, 0.05, -GOAL_DEPTH);
  goalGroup.add(leftPost, rightPost, crossbar, backBottomCross);

  // 3D Net Panels (Back, Roof, Left, Right) wrapped in a ripple group
  const netTex = createNetTexture();
  const netMat = new THREE.MeshBasicMaterial({
    map: netTex,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });
  const netGroup = new THREE.Group();
  const backNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_WIDTH, GOAL_HEIGHT, 10, 6), netMat);
  backNet.position.set(0, GOAL_HEIGHT / 2, -GOAL_DEPTH * 0.88);
  backNet.rotation.x = 0.14;

  const topNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_WIDTH, GOAL_DEPTH * 0.9, 8, 4), netMat);
  topNet.rotation.x = Math.PI / 2;
  topNet.position.set(0, GOAL_HEIGHT, -GOAL_DEPTH * 0.45);

  const sideNetGeo = new THREE.PlaneGeometry(GOAL_DEPTH, GOAL_HEIGHT);
  const leftNet = new THREE.Mesh(sideNetGeo, netMat);
  leftNet.rotation.y = Math.PI / 2;
  leftNet.position.set(-halfGoalW, GOAL_HEIGHT / 2, -GOAL_DEPTH / 2);

  const rightNet = new THREE.Mesh(sideNetGeo, netMat);
  rightNet.rotation.y = Math.PI / 2;
  rightNet.position.set(halfGoalW, GOAL_HEIGHT / 2, -GOAL_DEPTH / 2);

  netGroup.add(backNet, topNet, leftNet, rightNet);
  goalGroup.add(netGroup);
  scene.add(goalGroup);

  // 3. Interactive 3D Goal Zone Planes (6 Zones for Direct Touch & Mouse Raycast!)
  const zoneMeshes: Array<{ zone: PenaltyZone; mesh: THREE.Mesh; ring: THREE.Mesh }> = [];
  const zoneW = GOAL_WIDTH / 3 - 0.14;
  const zoneH = GOAL_HEIGHT / 2 - 0.14;

  for (const zm of GOAL_ZONES) {
    const colIdx = zm.col === 'left' ? -1 : zm.col === 'center' ? 0 : 1;
    const rowIdx = zm.row === 'top' ? 1 : 0;
    const zx = colIdx * (GOAL_WIDTH / 3);
    const zy = rowIdx === 1 ? GOAL_HEIGHT * 0.74 : GOAL_HEIGHT * 0.27;

    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(zoneW, zoneH), planeMat);
    plane.position.set(zx, zy, GOAL_Z + 0.08);
    plane.userData.penaltyZone = zm.id;
    scene.add(plane);

    const bullseyeMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const bullseye = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.36, 24), bullseyeMat);
    bullseye.position.set(zm.targetX, zm.targetY, GOAL_Z + 0.1);
    scene.add(bullseye);

    zoneMeshes.push({ zone: zm.id, mesh: plane, ring: bullseye });
  }

  // 4. Colorful Fantasy Stadium Stands, Cheering Crowd, Floodlights & Floating Balloons!
  const stadiumGroup = new THREE.Group();
  const advertisingBoard = new THREE.Mesh(
    new THREE.BoxGeometry(34, 1.05, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.45 })
  );
  advertisingBoard.position.set(0, 0.52, GOAL_Z - 4.4);
  stadiumGroup.add(advertisingBoard);

  // Neon trim on ad board
  const neonTrim = new THREE.Mesh(
    new THREE.BoxGeometry(34.1, 0.16, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  neonTrim.position.set(0, 1.05, GOAL_Z - 4.4);
  stadiumGroup.add(neonTrim);

  // Multi-tier colorful bleachers behind and flanking the goal
  const tierColors = [0xef4444, 0xf59e0b, 0x3b82f6, 0x8b5cf6, 0xec4899];
  for (let t = 0; t < 5; t++) {
    const tier = new THREE.Mesh(
      new THREE.BoxGeometry(36 + t * 2.2, 1.05, 1.8),
      new THREE.MeshStandardMaterial({ color: tierColors[t % tierColors.length], roughness: 0.7 })
    );
    tier.position.set(0, 0.9 + t * 0.95, GOAL_Z - 6.2 - t * 1.75);
    tier.receiveShadow = true;
    stadiumGroup.add(tier);
  }

  // Instanced cheering chibi spectators in the stands (1 GPU draw call!)
  const crowdCount = 96;
  const crowdGeo = new THREE.SphereGeometry(0.32, 10, 8);
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
  const crowdInst = new THREE.InstancedMesh(crowdGeo, crowdMat, crowdCount);
  const crowdBaseMatrices: Array<{ x: number; y: number; z: number; phase: number }> = [];
  const palette = [0xfef08a, 0x38bdf8, 0xfb7185, 0x4ade80, 0xc084fc, 0xffffff, 0xfb923c];
  const dummy = new THREE.Object3D();
  const cCol = new THREE.Color();

  for (let i = 0; i < crowdCount; i++) {
    const row = i % 5;
    const col = Math.floor(i / 5);
    const x = -16.5 + col * 1.75 + (row % 2) * 0.45;
    const y = 1.65 + row * 0.95;
    const z = GOAL_Z - 6.2 - row * 1.75;
    crowdBaseMatrices.push({ x, y, z, phase: i * 0.7 });
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    crowdInst.setMatrixAt(i, dummy.matrix);
    cCol.setHex(palette[i % palette.length]);
    crowdInst.setColorAt(i, cCol);
  }
  crowdInst.instanceMatrix.needsUpdate = true;
  if (crowdInst.instanceColor) crowdInst.instanceColor.needsUpdate = true;
  stadiumGroup.add(crowdInst);

  // Stadium Floodlight Towers
  [-17.5, 17.5].forEach((tx) => {
    const tower = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.5 })
    );
    pole.position.y = 7;
    const lampPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.3, 0.45),
      new THREE.MeshBasicMaterial({ color: 0xfef9c3 })
    );
    lampPanel.position.set(0, 14.2, 0.2);
    lampPanel.rotation.x = 0.35;
    tower.add(pole, lampPanel);
    tower.position.set(tx, 0, GOAL_Z - 8.5);
    tower.rotation.y = tx < 0 ? -0.35 : 0.35;
    stadiumGroup.add(tower);
  });

  // Floating Fantasy Balloons in the stadium sky
  const balloons: THREE.Group[] = [];
  [
    { x: -13, y: 11.5, z: GOAL_Z - 15, col: 0xf43f5e },
    { x: 13.5, y: 12.2, z: GOAL_Z - 16, col: 0xfacc15 },
    { x: 0, y: 13.8, z: GOAL_Z - 20, col: 0xa855f7 },
  ].forEach((b) => {
    const bg = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 16, 14),
      new THREE.MeshStandardMaterial({ color: b.col, roughness: 0.4 })
    );
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.45, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x92400e })
    );
    basket.position.y = -1.75;
    bg.add(orb, basket);
    bg.position.set(b.x, b.y, b.z);
    stadiumGroup.add(bg);
    balloons.push(bg);
  });

  scene.add(stadiumGroup);

  // 5. 3D Soccer Ball + Ground Shadow + Curved Swerve Trail
  const ballRadius = 0.23;
  const ballTex = createSoccerBallTexture();
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 22, 18),
    new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35, metalness: 0.05 })
  );
  ballMesh.castShadow = true;
  ballMesh.position.set(0, ballRadius, PENALTY_SPOT_Z);
  scene.add(ballMesh);

  const ballShadow = new THREE.Mesh(
    new THREE.CircleGeometry(ballRadius * 1.15, 18),
    new THREE.MeshBasicMaterial({ color: 0x052e16, transparent: true, opacity: 0.5 })
  );
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.position.set(0, 0.02, PENALTY_SPOT_Z);
  scene.add(ballShadow);

  const trailOrbs: THREE.Mesh[] = Array.from({ length: 8 }, (_, idx) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(ballRadius * (0.86 - idx * 0.08), 10, 8),
      new THREE.MeshBasicMaterial({
        color: idx < 3 ? 0xfacc15 : 0x38bdf8,
        transparent: true,
        opacity: 0.52 - idx * 0.055,
      })
    );
    m.visible = false;
    scene.add(m);
    return m;
  });
  const trailHistory: THREE.Vector3[] = [];

  // 6. Auto-Normalized Shooter & Goalkeeper Actors
  const SHOOTER_START_POS = new THREE.Vector3(-1.05, 0, PENALTY_SPOT_Z + 2.65);
  const KEEPER_START_POS = new THREE.Vector3(0, 0, GOAL_Z + 0.42);

  let shooterActor: PenaltyActorHandle | null = null;
  let keeperActor: PenaltyActorHandle | null = null;
  let actorLoadSeq = 0;

  const mountActors = (
    nextShooterId: string,
    nextKeeperId: string,
    nextShooterAvatar?: FootballAvatarProfile | null,
    nextKeeperAvatar?: FootballAvatarProfile | null
  ) => {
    actorLoadSeq += 1;
    const seq = actorLoadSeq;

    const loadShooter = nextShooterAvatar
      ? Promise.resolve(buildRpgAvatarPenaltyActor(nextShooterAvatar, 'shooter'))
      : loadAutoNormalizedPenaltyActor(nextShooterId, 'shooter', 1.92);
    const loadKeeper = nextKeeperAvatar
      ? Promise.resolve(buildRpgAvatarPenaltyActor(nextKeeperAvatar, 'keeper'))
      : loadAutoNormalizedPenaltyActor(nextKeeperId, 'keeper', 1.96);

    void Promise.all([loadShooter, loadKeeper]).then(([sAct, kAct]) => {
      if (disposed || seq !== actorLoadSeq) {
        sAct.markDisposed();
        kAct.markDisposed();
        disposeObject3D(sAct.root);
        disposeObject3D(kAct.root);
        return;
      }
      if (shooterActor) {
        shooterActor.markDisposed();
        scene.remove(shooterActor.root);
        disposeObject3D(shooterActor.root);
      }
      if (keeperActor) {
        keeperActor.markDisposed();
        scene.remove(keeperActor.root);
        disposeObject3D(keeperActor.root);
      }
      shooterActor = sAct;
      keeperActor = kAct;
      shooterActor.root.position.copy(SHOOTER_START_POS);
      keeperActor.root.position.copy(KEEPER_START_POS);
      scene.add(shooterActor.root, keeperActor.root);
    });
  };
  mountActors(opts.shooterModelId, opts.keeperModelId, opts.shooterAvatar, opts.keeperAvatar);

  // Highlight state for secret shooter target or keeper dive zone
  let highlightedZone: PenaltyZone | null = null;
  let highlightRole: 'shooter' | 'keeper' | 'hidden' = 'hidden';

  const applyZoneVisuals = (elapsed: number) => {
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 6.5);
    for (const zm of zoneMeshes) {
      const pMat = zm.mesh.material as THREE.MeshBasicMaterial;
      const rMat = zm.ring.material as THREE.MeshBasicMaterial;
      if (highlightRole === 'hidden') {
        pMat.opacity = 0;
        rMat.opacity = 0;
        continue;
      }
      const isSelected = zm.zone === highlightedZone;
      if (isSelected) {
        const col = highlightRole === 'shooter' ? 0x22c55e : 0x38bdf8;
        pMat.color.setHex(col);
        pMat.opacity = 0.28 + pulse * 0.14;
        rMat.color.setHex(0xfacc15);
        rMat.opacity = 0.92;
        const sc = 0.95 + pulse * 0.16;
        zm.ring.scale.set(sc, sc, 1);
      } else if (zonePickingEnabled) {
        pMat.color.setHex(0xffffff);
        pMat.opacity = 0.06;
        rMat.opacity = 0.18;
        zm.ring.scale.set(0.8, 0.8, 1);
      } else {
        pMat.opacity = 0;
        rMat.opacity = 0;
      }
    }
  };

  // Direct 3D Goal Zone Pointer Tap / Click Raycasting
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  const onPointerDown = (ev: PointerEvent) => {
    if (!zonePickingEnabled || !opts.onZoneSelect) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(
      zoneMeshes.map((z) => z.mesh),
      false
    );
    if (hits.length > 0) {
      const zId = hits[0].object.userData.penaltyZone as PenaltyZone | undefined;
      if (zId) {
        playPenaltySfx('lock', muted);
        opts.onZoneSelect(zId);
      }
    }
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  // Reveal Animation State
  let revealAnim: ActiveRevealAnim | null = null;
  let crowdExcitement = 0;
  let cameraShake = 0;
  let netRipple = 0;

  const resetPositionsForTurn = () => {
    revealAnim = null;
    crowdExcitement = 0;
    cameraShake = 0;
    netRipple = 0;
    netGroup.position.z = 0;
    ballMesh.position.set(0, ballRadius, PENALTY_SPOT_Z);
    ballMesh.rotation.set(0, 0, 0);
    ballShadow.position.set(0, 0.02, PENALTY_SPOT_Z);
    ballShadow.scale.set(1, 1, 1);
    trailHistory.length = 0;
    trailOrbs.forEach((o) => {
      o.visible = false;
    });

    if (shooterActor) {
      shooterActor.root.position.copy(SHOOTER_START_POS);
      shooterActor.visualGroup.rotation.set(0, shooterActor.visualGroup.rotation.y, 0);
      shooterActor.playState('idle');
    }
    if (keeperActor) {
      keeperActor.root.position.copy(KEEPER_START_POS);
      keeperActor.visualGroup.position.set(0, 0, 0);
      keeperActor.visualGroup.rotation.set(0, keeperActor.visualGroup.rotation.y, 0);
      keeperActor.playState('idle');
    }
    camera.position.copy(baseCamPos);
    camera.lookAt(baseCamLook);
  };

  // Animation Loop
  const clock = new THREE.Clock();
  let totalElapsed = 0;
  let rafId = 0;
  const runUpSec = 0.52;

  const animate = () => {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    totalElapsed += dt;

    if (shooterActor?.mixer) shooterActor.mixer.update(dt);
    if (shooterActor?.charParts?.mixer) shooterActor.charParts.mixer.update(dt);
    if (shooterActor?.charParts?.auraSpinGroup) {
      shooterActor.charParts.auraSpinGroup.rotation.y = totalElapsed * 1.8;
    }
    if (keeperActor?.mixer) keeperActor.mixer.update(dt);
    if (keeperActor?.charParts?.mixer) keeperActor.charParts.mixer.update(dt);
    if (keeperActor?.charParts?.auraSpinGroup) {
      keeperActor.charParts.auraSpinGroup.rotation.y = totalElapsed * 1.8;
    }

    // Animate stadium balloons & cheering crowd
    balloons.forEach((b, idx) => {
      b.position.y += Math.sin(totalElapsed * 1.5 + idx * 1.4) * 0.006;
    });

    const bounceAmp = crowdExcitement > 0.02 ? 0.24 : 0.05;
    const bounceFreq = crowdExcitement > 0.02 ? 14 : 4.2;
    for (let i = 0; i < crowdCount; i++) {
      const base = crowdBaseMatrices[i];
      dummy.position.set(
        base.x,
        base.y + Math.abs(Math.sin(totalElapsed * bounceFreq + base.phase)) * bounceAmp,
        base.z
      );
      dummy.updateMatrix();
      crowdInst.setMatrixAt(i, dummy.matrix);
    }
    crowdInst.instanceMatrix.needsUpdate = true;
    crowdExcitement = Math.max(0, crowdExcitement - dt * 0.55);

    if (netRipple > 0.001) {
      netGroup.position.z = -Math.sin(totalElapsed * 28) * netRipple * 0.35;
      netRipple = Math.max(0, netRipple - dt * 1.4);
    } else {
      netGroup.position.z = 0;
    }

    applyZoneVisuals(totalElapsed);

    if (!revealAnim) {
      // Pre-kick PES idle sway: Goalkeeper shifts left-right on their toes on the goal line!
      if (keeperActor) {
        keeperActor.root.position.x = Math.sin(totalElapsed * 3.1) * 0.42;
        keeperActor.root.position.y = Math.abs(Math.sin(totalElapsed * 6.2)) * 0.08;
        if (keeperActor.fallbackLimbs) {
          keeperActor.fallbackLimbs.armL.rotation.z = 0.65 + Math.sin(totalElapsed * 5) * 0.12;
          keeperActor.fallbackLimbs.armR.rotation.z = -0.65 - Math.sin(totalElapsed * 5) * 0.12;
        }
      }
      if (shooterActor) {
        shooterActor.root.position.y = Math.abs(Math.sin(totalElapsed * 3.2)) * 0.03;
      }
      camera.position.lerp(baseCamPos, 0.08);
      camera.lookAt(baseCamLook);
    } else {
      revealAnim.elapsed += dt;
      const t = revealAnim.elapsed;
      const res = revealAnim.result;
      const flightSec = res.flightDurationSec;
      const impactTime = runUpSec + flightSec;
      const keeperMeta = getGoalZoneMeta(res.keeperZone);

      if (t < runUpSec) {
        // Phase 1: Shooter sprints up to the ball!
        const u = Math.min(1, t / runUpSec);
        if (shooterActor) {
          shooterActor.playState('run');
          shooterActor.root.position.x = THREE.MathUtils.lerp(SHOOTER_START_POS.x, -0.24, u);
          shooterActor.root.position.z = THREE.MathUtils.lerp(
            SHOOTER_START_POS.z,
            PENALTY_SPOT_Z + 0.32,
            u
          );
          shooterActor.root.position.y = Math.abs(Math.sin(u * Math.PI * 4)) * 0.12;
          if (shooterActor.fallbackLimbs) {
            const swing = Math.sin(u * Math.PI * 6) * 0.8;
            shooterActor.fallbackLimbs.legL.rotation.x = swing;
            shooterActor.fallbackLimbs.legR.rotation.x = -swing;
          }
        }
        // Subtle PES run-up camera push-in
        camera.position.set(
          baseCamPos.x * (1 - u * 0.18),
          baseCamPos.y - u * 0.15,
          baseCamPos.z - u * 0.65
        );
        camera.lookAt(baseCamLook);
      } else if (t <= impactTime) {
        // Phase 2: Strike + Curved Ball Flight + Simultaneous Goalkeeper Dive!
        if (!revealAnim.kickTriggered) {
          revealAnim.kickTriggered = true;
          playPenaltySfx('kick', muted);
          if (shooterActor) {
            shooterActor.playState('kick');
            if (shooterActor.fallbackLimbs) {
              shooterActor.fallbackLimbs.legR.rotation.x = -1.15;
            }
          }
          if (keeperActor) {
            keeperActor.playState('dive');
          }
        }

        const u = Math.min(1, (t - runUpSec) / Math.max(0.15, flightSec));
        // Magnus lateral swerve + parabolic arc
        const swerveOffset = Math.sin(u * Math.PI) * res.curveX;
        const arcBoost =
          Math.sin(u * Math.PI) * (res.powerZone === 'red' ? 1.15 : res.powerZone === 'green' ? 0.65 : 0.85);
        const bx = THREE.MathUtils.lerp(0, res.ballEndX, u) + swerveOffset;
        const by = THREE.MathUtils.lerp(ballRadius, res.ballEndY, u) + arcBoost * (1 - u * 0.35);
        const bz = THREE.MathUtils.lerp(PENALTY_SPOT_Z, GOAL_Z + 0.12, u);

        ballMesh.position.set(bx, Math.max(ballRadius, by), bz);
        ballMesh.rotation.x -= dt * 22;
        ballMesh.rotation.y += dt * (res.curveX >= 0 ? 14 : -14);

        trailHistory.unshift(ballMesh.position.clone());
        if (trailHistory.length > trailOrbs.length) trailHistory.pop();
        for (let ti = 0; ti < trailOrbs.length; ti++) {
          const tp = trailHistory[ti];
          if (tp) {
            trailOrbs[ti].visible = true;
            trailOrbs[ti].position.copy(tp);
            (trailOrbs[ti].material as THREE.MeshBasicMaterial).color.setHex(
              res.powerZone === 'green'
                ? 0x4ade80
                : res.powerZone === 'red'
                  ? 0xef4444
                  : 0xfacc15
            );
          }
        }

        // Simultaneous Goalkeeper acrobatic dive toward keeperZone!
        if (keeperActor) {
          const diveU = Math.min(1, u * 1.12);
          const diveX = keeperMeta.targetX * 0.92 * diveU;
          const diveLift =
            keeperMeta.row === 'top'
              ? Math.sin(diveU * Math.PI * 0.85) * 1.08
              : Math.sin(diveU * Math.PI * 0.85) * 0.28;
          keeperActor.root.position.set(diveX, Math.max(0, diveLift), KEEPER_START_POS.z);
          const tiltTarget =
            keeperMeta.col === 'left' ? 1.05 : keeperMeta.col === 'right' ? -1.05 : 0;
          keeperActor.visualGroup.rotation.z = tiltTarget * diveU;
          if (keeperActor.fallbackLimbs) {
            keeperActor.fallbackLimbs.armL.rotation.z = 2.4;
            keeperActor.fallbackLimbs.armR.rotation.z = -2.4;
          }
        }

        // Dynamic camera follows shot slightly toward goal
        camera.position.set(
          THREE.MathUtils.lerp(baseCamPos.x, bx * 0.18, u * 0.5),
          baseCamPos.y - 0.15,
          baseCamPos.z - 0.65 - u * 0.85
        );
        camera.lookAt(bx * 0.35, 1.35, GOAL_Z + 0.5);
      } else {
        // Phase 3: Impact (GOAL! / SAVED! / POST! / OVER!) & Post-Impact Physics + Celebration!
        if (!revealAnim.impactTriggered) {
          revealAnim.impactTriggered = true;
          if (res.outcome === 'goal') {
            playPenaltySfx('goal', muted);
            crowdExcitement = 1.0;
            netRipple = 1.0;
            cameraShake = 0.22;
            shooterActor?.playState('celebrate');
          } else if (res.outcome === 'saved') {
            playPenaltySfx('saved', muted);
            crowdExcitement = 0.7;
            cameraShake = 0.14;
            keeperActor?.playState('celebrate');
          } else if (res.outcome === 'post') {
            playPenaltySfx('post', muted);
            cameraShake = 0.25;
          } else {
            playPenaltySfx('miss', muted);
          }
          revealAnim.onImpact(res);
        }

        const postT = t - impactTime;
        trailOrbs.forEach((o) => {
          o.visible = false;
        });

        if (res.outcome === 'goal') {
          // Ball settles inside the back of the net & drops to the turf
          const settleU = Math.min(1, postT / 0.55);
          ballMesh.position.x = THREE.MathUtils.lerp(res.ballEndX, res.ballEndX * 0.82, settleU);
          ballMesh.position.z = THREE.MathUtils.lerp(
            GOAL_Z - 0.1,
            GOAL_Z - GOAL_DEPTH * 0.68,
            settleU
          );
          const dropY = Math.max(ballRadius, res.ballEndY * (1 - settleU) + Math.abs(Math.sin(postT * 9)) * 0.25 * (1 - settleU));
          ballMesh.position.y = dropY;

          // Shooter jumps in celebration!
          if (shooterActor) {
            shooterActor.root.position.y = Math.abs(Math.sin(postT * 9.5)) * 0.42;
            shooterActor.visualGroup.rotation.y += dt * 4.5;
          }
        } else if (res.outcome === 'saved') {
          // Goalkeeper parries ball wide away from goal!
          const parrySign = res.ballEndX >= 0 ? 1 : -1;
          ballMesh.position.x = res.ballEndX + parrySign * postT * 5.2;
          ballMesh.position.z = GOAL_Z + 0.35 + postT * 3.1;
          ballMesh.position.y = Math.max(
            ballRadius,
            res.ballEndY - postT * 2.4 + Math.abs(Math.sin(postT * 8)) * 0.35
          );
          if (keeperActor) {
            keeperActor.visualGroup.rotation.z *= Math.max(0, 1 - dt * 5);
            keeperActor.root.position.y = Math.abs(Math.sin(postT * 9)) * 0.32;
          }
        } else if (res.outcome === 'post') {
          // Ball ricochets sharply back into the box off the post/crossbar!
          const bounceSign = res.ballEndX >= 0 ? 1 : -1;
          ballMesh.position.x = res.ballEndX + bounceSign * postT * 3.8;
          ballMesh.position.z = GOAL_Z + postT * 6.5;
          ballMesh.position.y = Math.max(ballRadius, res.ballEndY - postT * 3.1);
        } else {
          // Blazed high over the crossbar into the stands!
          ballMesh.position.x = res.ballEndX * (1 + postT * 0.25);
          ballMesh.position.y = res.ballEndY + postT * 3.4 - postT * postT * 2.8;
          ballMesh.position.z = GOAL_Z - postT * 11.0;
        }

        if (cameraShake > 0.002) {
          camera.position.x += (Math.random() - 0.5) * cameraShake;
          camera.position.y += (Math.random() - 0.5) * cameraShake;
          cameraShake = Math.max(0, cameraShake - dt * 0.9);
        }

        if (postT >= 1.5 && !revealAnim.finishedTriggered) {
          revealAnim.finishedTriggered = true;
          const cb = revealAnim.onFinished;
          revealAnim = null;
          cb();
        }
      }
    }

    // Keep ball ground shadow synced underneath the ball
    ballShadow.position.set(ballMesh.position.x, 0.02, ballMesh.position.z);
    const shadowScale = Math.max(0.35, 1.15 - (ballMesh.position.y - ballRadius) * 0.22);
    ballShadow.scale.set(shadowScale, shadowScale, 1);

    renderer.render(scene, camera);
  };
  animate();

  const onResize = () => {
    if (disposed) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    computePesCameraPose(w, h);
    renderer.setSize(w, h);
    renderer.setPixelRatio(
      Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
    );
  };
  window.addEventListener('resize', onResize);

  return {
    setActors(
      nextShooterModelId: string,
      nextKeeperModelId: string,
      nextShooterAvatar?: FootballAvatarProfile | null,
      nextKeeperAvatar?: FootballAvatarProfile | null
    ) {
      mountActors(nextShooterModelId, nextKeeperModelId, nextShooterAvatar, nextKeeperAvatar);
    },
    setHighlightedZone(zone: PenaltyZone | null, role: 'shooter' | 'keeper' | 'hidden') {
      highlightedZone = zone;
      highlightRole = role;
    },
    setZonePickingEnabled(enabled: boolean) {
      zonePickingEnabled = enabled;
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
    },
    resetPositionsForTurn,
    playTurnReveal(result, onImpact, onFinished) {
      resetPositionsForTurn();
      highlightedZone = null;
      highlightRole = 'hidden';
      revealAnim = {
        result,
        elapsed: 0,
        kickTriggered: false,
        impactTriggered: false,
        finishedTriggered: false,
        onImpact,
        onFinished,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      shooterActor?.markDisposed();
      keeperActor?.markDisposed();
      disposeObject3D(scene);
      renderer.dispose();
      container.innerHTML = '';
    },
  };
}
