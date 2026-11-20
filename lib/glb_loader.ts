import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Mapping สายพันธุ์สัตว์ทั้งหมดในเกม -> โมเดล Cute Chibi / Animated Animal (.glb) ใน public/models/
 */
export const SPECIES_GLB_MAP: Record<string, string> = {
  // 5 ตัวหลัก Cute Chibi Animated Animals
  fox: '/models/fox.glb',
  bunny: '/models/bunny.glb',
  bear: '/models/bear.glb',
  cat: '/models/cat.glb',
  pig: '/models/pig.glb',

  // 🐶 หมวดสุนัข
  corgi: '/models/corgi_pet.glb',
  shiba: '/models/corgi_pet.glb',
  pug: '/models/dog_chibi.glb',
  husky: '/models/husky_hero.glb',
  golden: '/models/dog_chibi.glb',
  poodle: '/models/dog_chibi.glb',
  dachshund: '/models/dog_chibi.glb',
  frenchie: '/models/dog_chibi.glb',
  pomeranian: '/models/dog_chibi.glb',

  // 🐱 หมวดแมว
  orange_cat: '/models/cat.glb',
  scottish_fold: '/models/cat.glb',
  siamese: '/models/cat.glb',
  sphynx: '/models/cat.glb',
  maine_coon: '/models/lion_hero.glb',
  british_shorthair: '/models/cat.glb',
  calico: '/models/cat.glb',
  black_cat: '/models/cat.glb',
  bengal: '/models/tiger_hero.glb',

  // 🐷 หมวดหมู & สัตว์ฟาร์ม
  mini_pig: '/models/pig.glb',
  alpaca: '/models/alpaca_hero.glb',
  capybara: '/models/capybara_hero.glb',
  fat_duck: '/models/duck_hero.glb',
  cloud_sheep: '/models/alpaca_hero.glb',
  dairy_cow: '/models/cow_hero.glb',
  holland_lop: '/models/bunny.glb',
  hamster: '/models/hamster_hero.glb',

  // 🦊 หมวดสัตว์ป่า & แปลก
  red_panda: '/models/panda_hero.glb',
  raccoon: '/models/panda_hero.glb',
  polar_bear: '/models/bear.glb',
  panda: '/models/panda_hero.glb',
  frog: '/models/frog_hero.glb',
  monkey: '/models/monkey_hero.glb',
  seal: '/models/seal_hero.glb',

  // 🦖 หมวดสัตว์สูญพันธุ์ (Extinct) & 🐉 หมวดสัตว์ในเทพนิยาย (Mythical)
  trex: '/models/frog_hero.glb',
  triceratops: '/models/cow_hero.glb',
  mammoth: '/models/bear.glb',
  sabretooth: '/models/tiger_hero.glb',
  dodo: '/models/duck_hero.glb',
  pterodactyl: '/models/duck_hero.glb',
  dragon: '/models/lion_hero.glb',
  unicorn: '/models/alpaca_hero.glb',
  phoenix: '/models/duck_hero.glb',
  griffin: '/models/lion_hero.glb',
  kitsune: '/models/fox.glb',
  cerberus: '/models/husky_hero.glb',
};

/**
 * Mapping ชุดเสื้อผ้า & กางเกง (Casual / Sporty Shirts & Pants .glb จาก Kenney CC0)
 * ไม่มีชุดเกราะหรืออาวุธสงครามติดมือ
 */
export const OUTFIT_GLB_MAP: Record<string, string> = {
  armor_none: '/models/outfit_sport_a.glb',
  armor_snow_dress: '/models/outfit_cute_top_a.glb',
  armor_silver_knight: '/models/outfit_hoodie_b.glb',
  armor_gold_paladin: '/models/outfit_street_d.glb',
  armor_princess: '/models/outfit_pastel_b.glb',
  armor_ice_cape: '/models/outfit_casual_c.glb',
  armor_vest: '/models/outfit_active_d.glb',
};

/**
 * Mapping สัตว์เลี้ยงคู่ใจ -> โมเดล Cute Chibi Animated Animal (.glb)
 */
export const PET_GLB_MAP: Record<string, string> = {
  fox: '/models/fox.glb',
  pet_fox_scarf: '/models/fox.glb',
  rabbit: '/models/bunny.glb',
  bunny: '/models/bunny.glb',
  pet_bunny_wings: '/models/bunny.glb',
  bear: '/models/bear.glb',
  pet_bear_shield: '/models/bear.glb',
  cat: '/models/cat.glb',
  pig: '/models/pig.glb',
  pet_pig_chef: '/models/pig.glb',
  dog: '/models/corgi_pet.glb',
  pet_corgi_cape: '/models/corgi_pet.glb',
  pet_hamster: '/models/hamster_hero.glb',
  pet_shiba: '/models/dog_chibi.glb',
  pet_duckling: '/models/duck_hero.glb',
  pet_panda: '/models/panda_hero.glb',
  pet_frog: '/models/frog_hero.glb',
  pet_capybara: '/models/capybara_hero.glb',
  pet_seal: '/models/seal_hero.glb',
};

const gltfCache = new Map<string, Promise<GLTF>>();
const loader = new GLTFLoader();

export function loadCachedGLTF(url: string): Promise<GLTF> {
  const existing = gltfCache.get(url);
  if (existing) return existing;
  const promise = new Promise<GLTF>((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
  gltfCache.set(url, promise);
  return promise;
}

export interface NormalizedGLBResult {
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  animations: THREE.AnimationClip[];
  playClip: (patterns: RegExp[], timeOffset?: number) => void;
}

function createClipSwitcher(
  mixer: THREE.AnimationMixer | null,
  animations: THREE.AnimationClip[],
  resetPose?: () => void
): (patterns: RegExp[], timeOffset?: number) => void {
  let currentAction: THREE.AnimationAction | null = null;
  let currentClipName = '';

  return (patterns: RegExp[], timeOffset = 0) => {
    if (!mixer || animations.length === 0) return;
    let chosen: THREE.AnimationClip | undefined;
    for (const pat of patterns) {
      chosen = animations.find((a) => pat.test(a.name));
      if (chosen) break;
    }
    if (!chosen) {
      chosen =
        animations.find((a) => !/static|t-pose|pose|death|die|wheelchair/i.test(a.name)) ||
        animations[0];
    }
    if (!chosen || chosen.name === currentClipName) return;

    if (currentAction) {
      mixer.stopAllAction();
    }
    if (resetPose) {
      resetPose();
    }

    const nextAction = mixer.clipAction(chosen);
    nextAction.reset();
    if (timeOffset > 0 && chosen.duration > 0.05) {
      nextAction.time = timeOffset % chosen.duration;
    }
    nextAction.play();
    currentAction = nextAction;
    currentClipName = chosen.name;
  };
}

/**
 * โหลดโมเดล .glb สัตว์จิบิ/สัตว์เลี้ยง ปรับความสูงอัตโนมัติ วางเท้าที่ y = 0 และหันหน้าไปทาง +X
 */
export async function loadNormalizedGLB(
  url: string,
  targetHeight = 2.0,
  preferRunAnim = true,
  customPatterns?: RegExp[]
): Promise<NormalizedGLBResult> {
  const gltf = await loadCachedGLTF(url);
  const cloned = cloneSkinned(gltf.scene) as THREE.Group;

  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
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

  const wrapper = new THREE.Group();
  cloned.rotation.y = Math.PI / 2;
  wrapper.add(cloned);
  wrapper.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(wrapper);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scaleFactor = targetHeight / Math.max(0.01, size.y);
  wrapper.scale.setScalar(scaleFactor);
  wrapper.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(wrapper);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  wrapper.position.x -= center.x;
  wrapper.position.z -= center.z;
  wrapper.position.y -= scaledBox.min.y;

  const container = new THREE.Group();
  container.add(wrapper);

  const animations = gltf.animations ?? [];
  const mixer = animations.length > 0 ? new THREE.AnimationMixer(cloned) : null;
  const playClip = createClipSwitcher(mixer, animations);

  if (mixer && animations.length > 0) {
    const defaultPatterns =
      customPatterns ??
      (preferRunAnim
        ? [/^run$/i, /run|gallop|sprint/i, /walk/i, /^idle$/i, /idle/i, /jump|bounce/i]
        : [/^idle$/i, /idle/i, /dance|gesture-positive/i, /walk/i]);
    playClip(defaultPatterns);
  }

  return { group: container, mixer, animations, playClip };
}

export interface ChibiOutfitRigResult {
  group: THREE.Group;
  rigScale: number;
  mixer: THREE.AnimationMixer | null;
  animations: THREE.AnimationClip[];
  playClip: (patterns: RegExp[], timeOffset?: number) => void;
  headBone: THREE.Object3D | null;
  torsoBone: THREE.Object3D | null;
  armLeftBone: THREE.Object3D | null;
  armRightBone: THREE.Object3D | null;
  legLeftBone: THREE.Object3D | null;
  legRightBone: THREE.Object3D | null;
}

export interface LoadChibiOutfitOptions {
  equipArmor: string;
  animPatterns: RegExp[];
  animTimeOffset?: number;
}

const RIG_BONE_NAMES = new Set([
  'root',
  'leg-left',
  'leg-right',
  'torso',
  'arm-left',
  'arm-right',
  'head',
]);

/**
 * โหลดตัวละครชุดลำลอง/ชุดกีฬา เสื้อ & กางเกง Chibi (.glb จาก Kenney Mini-Characters)
 * ซ่อนหัวมนุษย์เดิมเพื่อสวมหัวสัตว์รูปทรงเฉพาะแต่ละสายพันธุ์ (มือเปล่าสะอาด ไม่มีอาวุธต่อสู้)
 */
export async function loadChibiOutfitRigGLB({
  equipArmor,
  animPatterns,
  animTimeOffset = 0,
}: LoadChibiOutfitOptions): Promise<ChibiOutfitRigResult> {
  const outfitUrl = OUTFIT_GLB_MAP[equipArmor] || '/models/outfit_sport_a.glb';
  const gltf = await loadCachedGLTF(outfitUrl);
  const cloned = cloneSkinned(gltf.scene) as THREE.Group;

  let headBone: THREE.Object3D | null = null;
  let torsoBone: THREE.Object3D | null = null;
  let armLeftBone: THREE.Object3D | null = null;
  let armRightBone: THREE.Object3D | null = null;
  let legLeftBone: THREE.Object3D | null = null;
  let legRightBone: THREE.Object3D | null = null;

  const restSnapshots: Array<{
    node: THREE.Object3D;
    pos: THREE.Vector3;
    quat: THREE.Quaternion;
  }> = [];

  const isGoldTracksuit = equipArmor === 'armor_gold_paladin';

  cloned.traverse((child) => {
    if (RIG_BONE_NAMES.has(child.name)) {
      restSnapshots.push({
        node: child,
        pos: child.position.clone(),
        quat: child.quaternion.clone(),
      });
    }
    if (child.name === 'head') headBone = child;
    else if (child.name === 'torso') torsoBone = child;
    else if (child.name === 'arm-left') armLeftBone = child;
    else if (child.name === 'arm-right') armRightBone = child;
    else if (child.name === 'leg-left') legLeftBone = child;
    else if (child.name === 'leg-right') legRightBone = child;

    // ซ่อนหัวมนุษย์ของ Kenney เพื่อให้หัวสัตว์แต่ละสายพันธุ์โดดเด่นเต็มที่
    if (child.name === 'head-mesh') {
      child.visible = false;
    }

    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.userData.isSharedGltfResource = true;
      if (m.geometry) m.geometry.userData.isSharedGltfResource = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        if (mat) mat.userData.isSharedGltfResource = true;
      });

      if (m.material && isGoldTracksuit && child.name === 'body-mesh') {
        const clonedMat = (m.material as THREE.MeshStandardMaterial).clone();
        clonedMat.userData.isSharedGltfResource = false;
        clonedMat.emissive = new THREE.Color(0xd97706);
        clonedMat.emissiveIntensity = 0.2;
        m.material = clonedMat;
      }
    }
  });

  const resetPose = () => {
    for (const snap of restSnapshots) {
      snap.node.position.copy(snap.pos);
      snap.node.quaternion.copy(snap.quat);
    }
  };

  const rigScale = 3.15;
  const wrapper = new THREE.Group();
  cloned.rotation.y = Math.PI / 2;
  cloned.scale.setScalar(rigScale);
  wrapper.add(cloned);

  const animations = gltf.animations ?? [];
  const mixer = animations.length > 0 ? new THREE.AnimationMixer(cloned) : null;
  const playClip = createClipSwitcher(mixer, animations, resetPose);
  playClip(animPatterns, animTimeOffset);

  return {
    group: wrapper,
    rigScale,
    mixer,
    animations,
    playClip,
    headBone,
    torsoBone,
    armLeftBone,
    armRightBone,
    legLeftBone,
    legRightBone,
  };
}
