import * as THREE from 'three';
import {
  PET_GLB_MAP,
  SPECIES_GLB_MAP,
  loadNormalizedGLB,
} from '@/lib/glb_loader';
import { buildChubbyPlushOutfitRig } from '@/lib/plush_rig';
import { buildMountMesh, animateMountFrame, type MountMeshParts } from '@/lib/mount_3d';
import {
  buildExtraHat3D,
  buildExtraFace3D,
  buildExtraWeapon3D,
  buildExtraWings3D,
  buildExtraAura3D,
  buildExtraMarker3D,
} from '@/lib/extra_props_3d';
import { resolveBreedOption, SHOP_ITEMS, type PropColorMap, type SpeciesOption } from '@/lib/rpg_catalog';
import { resolvePowerBoostMeta, type PowerFormType } from '@/lib/power_boost';

export type CharacterAnimMode = 'idle' | 'run' | 'cheer' | 'spectator';

export interface PowerFxRefs {
  form: PowerFormType;
  auraGroup: THREE.Group;
  flames: THREE.Mesh[];
  jetFlames: THREE.Mesh[];
  lightningBolts: THREE.Group[];
  floatingRocks: THREE.Mesh[];
  groundRings: THREE.Mesh[];
  buuAntennaTip: THREE.Group | null;
  steamPuffs: THREE.Mesh[];
  zzzSprites: THREE.Sprite[];
  snackOrbitGroup: THREE.Group | null;
}

export interface CharacterOutfitBones {
  torsoBone: THREE.Object3D | null;
  torsoVisualGroup?: THREE.Group | null;
  headBone: THREE.Object3D | null;
  armLeftBone: THREE.Object3D | null;
  armRightBone: THREE.Object3D | null;
  legLeftBone: THREE.Object3D | null;
  legRightBone: THREE.Object3D | null;
  backSlotObj?: THREE.Object3D | null;
  tailSlotObj?: THREE.Object3D | null;
  bellyBulge: THREE.Mesh | null;
}

export interface CharacterMeshParts {
  rootGroup: THREE.Group;
  bounceGroup: THREE.Group;
  riderGroup?: THREE.Group;
  mountParts?: MountMeshParts | null;
  bodyMesh: THREE.Mesh;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  normalEyes: THREE.Group;
  happyFace: THREE.Group;
  angryFace: THREE.Group;
  glbGroup: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
  rpgBones?: CharacterOutfitBones | null;
  playClip?: ((patterns: RegExp[], timeOffset?: number) => void) | null;
  isChibiAnimalGlb?: boolean;
  groundPropGroup?: THREE.Group | null;
  auraSpinGroup?: THREE.Group | null;
  powerFx?: PowerFxRefs | null;
  lockPowerFace?: boolean;
  animSpeedMult?: number;
  formHeightScale?: number;
  extraBellyAdd?: number;
  extraMuscleAdd?: number;
}

export interface BuildCharacterOptions {
  colorHex: string | number;
  accessory: string;
  bandColor: string | number;
  bellyScale?: number;
  muscleScale?: number;
  showDumbbells?: boolean;
  spectatorProp?: string;
  species?: string;
  equipHat?: string;
  equipFace?: string;
  equipArmor?: string;
  equipWeapon?: string;
  equipWings?: string;
  equipAura?: string;
  equipMount?: string;
  propColors?: PropColorMap;
  animMode?: CharacterAnimMode;
  animSeed?: number;
  useProceduralOnly?: boolean;
  /** Net daily power score (cheerCount - temptCount) for Fire Boost / Super Saiyan / Kabigon / Majin Buu */
  netPower?: number;
}

export function resolveRpgAnimPatterns(
  animMode: CharacterAnimMode,
  spectatorProp = ''
): RegExp[] {
  if (animMode === 'run') {
    return [/^sprint$/i, /^run$/i, /gallop|frog_jump/i, /^walk$/i, /walk/i, /^idle$/i];
  }
  if (animMode === 'cheer') {
    return [/^emote-yes$/i, /dance|gesture-positive|jump/i, /^idle$/i];
  }
  if (animMode === 'spectator') {
    if (
      spectatorProp === 'picnic_shabu' ||
      spectatorProp === 'play_cards' ||
      spectatorProp === 'phone_scroll'
    ) {
      return [/^sit$/i, /^eat$|^eating$|animalarmature\|eating/i, /^idle$/i];
    }
    if (spectatorProp === 'eat_pizza' || spectatorProp === 'boba_tea') {
      return [/^eat$|^eating$|animalarmature\|eating/i, /^idle$/i];
    }
    if (spectatorProp === 'jumping_jacks') {
      return [/^jump$/i, /dance|gesture-positive|frog_jump/i, /^idle$/i];
    }
    if (spectatorProp === 'jog') {
      return [/^sprint$/i, /^run$/i, /gallop|frog_jump/i, /^walk$/i];
    }
    if (
      spectatorProp === 'dumbbell' ||
      spectatorProp === 'squat' ||
      spectatorProp === 'pullup' ||
      spectatorProp === 'pushup' ||
      spectatorProp === 'situp' ||
      spectatorProp === 'food_roll' ||
      spectatorProp === 'boxing' ||
      spectatorProp === 'badminton'
    ) {
      // โมเดลสัตว์ 4 ขาใช้ท่า dance/jump ส่วนโมเดลเสื้อกางเกงใช้ idle เป็นฐานแล้วขยับข้อต่อแขน-ขา-ลำตัวเต็มรูปแบบ
      return [/dance|gesture-positive|frog_jump/i, /^idle$/i];
    }
    return [/^emote-yes$/i, /dance|gesture-positive/i, /^idle$/i];
  }
  return [/^idle$/i];
}

export function applyCharacterBellyScale(
  parts: CharacterMeshParts,
  bellyScale: number,
  muscleScale = 1
) {
  const extraB =
    parts.extraBellyAdd ?? (parts as { charParts?: CharacterMeshParts }).charParts?.extraBellyAdd ?? 0;
  const extraM =
    parts.extraMuscleAdd ??
    (parts as { charParts?: CharacterMeshParts }).charParts?.extraMuscleAdd ??
    0;
  const b = Math.max(0.74, Math.min(1.65, bellyScale + extraB));
  parts.bodyMesh.scale.set(b, 1.0, b);

  const bones = parts.rpgBones ?? (parts as { charParts?: CharacterMeshParts }).charParts?.rpgBones;
  const glb = parts.glbGroup ?? (parts as { charParts?: CharacterMeshParts }).charParts?.glbGroup;

  if (bones) {
    const {
      torsoBone,
      torsoVisualGroup,
      headBone,
      armLeftBone,
      armRightBone,
      legLeftBone,
      legRightBone,
      backSlotObj,
      tailSlotObj,
      bellyBulge,
    } = bones;
    const m = Math.max(0.85, Math.min(1.45, muscleScale + extraM));

    if (torsoVisualGroup) {
      // ลำตัวทรงกลมตุ้ยนุ้ย (Plush Round Mochi Body): หดเป็นเอวเอสหรือพองกลมเป็นลูกบอลได้อย่างเนียนไร้รอยต่อ
      torsoVisualGroup.scale.set(b, 1 + (b - 1) * 0.06, b);
      if (armLeftBone) {
        armLeftBone.position.x = 0.36 * b + 0.04;
        armLeftBone.scale.setScalar(m);
      }
      if (armRightBone) {
        armRightBone.position.x = -(0.36 * b + 0.04);
        armRightBone.scale.setScalar(m);
      }
      if (legLeftBone) legLeftBone.position.x = 0.21 + (b - 1) * 0.09;
      if (legRightBone) legRightBone.position.x = -(0.21 + (b - 1) * 0.09);
      if (backSlotObj) backSlotObj.position.z = -0.44 * b;
      if (tailSlotObj) tailSlotObj.position.z = -0.5 * b;
    } else {
      if (torsoBone) {
        torsoBone.scale.set(b, 1.0, b);
      }
      if (headBone) {
        const invB = 1 / b;
        headBone.scale.set(invB, 1.0, invB);
      }
      const armComp = m / b;
      if (armLeftBone) armLeftBone.scale.set(armComp, 1.0, armComp);
      if (armRightBone) armRightBone.scale.set(armComp, 1.0, armComp);

      if (bellyBulge) {
        if (b > 1.06) {
          bellyBulge.visible = true;
          const bulgeR = 0.085 + (b - 1.0) * 0.11;
          bellyBulge.scale.set((bulgeR * 1.15) / b, bulgeR * 0.9, (bulgeR * 1.18) / b);
        } else {
          bellyBulge.visible = false;
        }
      }
    }
  } else if (glb) {
    glb.scale.set(b, 1.0, b);
  }
}

function makeZzzSprite(text: string, scale = 0.55): THREE.Sprite {
  let tex: THREE.CanvasTexture | undefined;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);
      ctx.font = '900 78px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#0f172a';
      ctx.strokeText(text, 64, 66);
      ctx.fillStyle = '#bae6fd';
      ctx.fillText(text, 64, 66);
    }
    tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(scale, scale, 1);
  return sp;
}

let cachedMajinBuckleTex: THREE.CanvasTexture | null = null;
function getMajinBuckleTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedMajinBuckleTex) return cachedMajinBuckleTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, 112, 112);
    ctx.fillStyle = '#18181b';
    ctx.font = '900 80px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', 64, 68);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedMajinBuckleTex = tex;
  return tex;
}

function buildPowerTransformationParts(
  form: PowerFormType,
  faceXOffset: number,
  powerLevel = 1
) {
  const lvl = Math.max(1, Math.min(10, Math.abs(Math.floor(powerLevel))));
  const powerHeadGroup = new THREE.Group();
  const powerFaceGroup = new THREE.Group();
  const auraGroup = new THREE.Group();

  const powerFx: PowerFxRefs = {
    form,
    auraGroup,
    flames: [],
    jetFlames: [],
    lightningBolts: [],
    floatingRocks: [],
    groundRings: [],
    buuAntennaTip: null,
    steamPuffs: [],
    zzzSprites: [],
    snackOrbitGroup: null,
  };

  let lockPowerFace = false;

  if (form === 'warm_up') {
    const ringRadius = 0.68 + lvl * 0.07;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ringRadius, ringRadius + 0.14 + lvl * 0.02, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.38 + lvl * 0.1,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    auraGroup.add(ring);
    powerFx.groundRings.push(ring);

    const emberMat = new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.88 });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const emberCount = 2 + lvl * 2; // +1 -> 4, +2 -> 6, +3 -> 8, +4 -> 10
    for (let i = 0; i < emberCount; i++) {
      const ang = (i / emberCount) * Math.PI * 2;
      const fl = new THREE.Mesh(
        new THREE.ConeGeometry(0.09 + lvl * 0.015, 0.3 + lvl * 0.09, 7),
        i % 2 === 0 ? emberMat : coreMat
      );
      fl.position.set(Math.cos(ang) * (0.76 + lvl * 0.04), 0.22 + (i % 3) * 0.16, Math.sin(ang) * (0.76 + lvl * 0.04));
      auraGroup.add(fl);
      powerFx.flames.push(fl);
    }
  } else if (form === 'fire_boost') {
    // 🔥 โหมดไฟบูสต์ลุกโชน + ไอพ่นไฟเทอร์โบด้านหลัง (ยิ่งใกล้ +10 เปลวไฟยิ่งสูงและเริ่มมีประกายสายฟ้า!)
    const boostStep = Math.max(0, lvl - 5); // 0..4 for +5..+9
    const browFlameMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf97316,
      emissiveIntensity: 0.75 + boostStep * 0.1,
      roughness: 0.2,
    });
    [-0.18, 0, 0.18].forEach((fz, fi) => {
      const crest = new THREE.Mesh(
        new THREE.ConeGeometry(0.09 + boostStep * 0.01, (fi === 1 ? 0.42 : 0.32) + boostStep * 0.07, 8),
        browFlameMat
      );
      crest.position.set(0.32 + faceXOffset, fi === 1 ? 0.62 : 0.54, fz);
      crest.rotation.z = 0.25;
      crest.rotation.x = fz * 0.8;
      powerHeadGroup.add(crest);
    });

    [
      { inner: 0.8, outer: 1.05 + boostStep * 0.04, col: 0xfde047, op: 0.85 },
      { inner: 1.1 + boostStep * 0.05, outer: 1.34 + boostStep * 0.07, col: 0xef4444, op: 0.65 },
    ].forEach((spec, idx) => {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(spec.inner, spec.outer, 32),
        new THREE.MeshBasicMaterial({
          color: spec.col,
          transparent: true,
          opacity: spec.op,
          side: THREE.DoubleSide,
        })
      );
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.04 + idx * 0.01;
      auraGroup.add(r);
      powerFx.groundRings.push(r);
    });

    const outerFireMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.86 });
    const redFireMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.8 });
    const hotCoreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.92 });

    const flameCount = 8 + boostStep * 2; // +5 -> 8, +6 -> 10, +7 -> 12, +8 -> 14, +9 -> 16
    for (let i = 0; i < flameCount; i++) {
      const ang = (i / flameCount) * Math.PI * 2;
      const h = 0.85 + boostStep * 0.22 + (i % 3) * 0.36;
      const mat = i % 3 === 0 ? hotCoreMat : i % 2 === 0 ? outerFireMat : redFireMat;
      const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.19 + boostStep * 0.015, h, 8), mat);
      tongue.scale.set(0.75, 1, 1.25);
      tongue.position.set(Math.cos(ang) * (0.95 + boostStep * 0.04), h * 0.45, Math.sin(ang) * (0.95 + boostStep * 0.04));
      tongue.rotation.y = -ang;
      auraGroup.add(tongue);
      powerFx.flames.push(tongue);
    }

    // Twin Turbo Fire Jets blasting backward (-X)
    [-0.28, 0.28].forEach((jz) => {
      const outerJet = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.25 + boostStep * 0.18, 10), outerFireMat);
      outerJet.rotation.z = Math.PI / 2;
      outerJet.position.set(-1.12, 0.55, jz);
      const innerJet = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.88 + boostStep * 0.14, 8), hotCoreMat);
      innerJet.rotation.z = Math.PI / 2;
      innerJet.position.set(-0.92, 0.55, jz);
      auraGroup.add(outerJet, innerJet);
      powerFx.jetFlames.push(outerJet, innerJet);
    });
  } else if (form === 'super_saiyan') {
    // ⚡💛 ร่าง SUPER SAIYAN!! ผมทองตั้งชี้ฟ้า + ตาเขียวมรกตไซย่า + ออร่าทองยักษ์ + สายฟ้าสปาร์ค!
    const ssjHairMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65,
      roughness: 0.22,
      metalness: 0.28,
    });
    const ssjCoreGoldMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.88,
    });
    const ssjOuterGoldMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
    });

    const hairDome = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 14), ssjHairMat);
    hairDome.scale.set(1.02, 0.72, 1.05);
    hairDome.position.set(-0.04, 0.36, 0);
    powerHeadGroup.add(hairDome);

    // 9 Sculpted Golden Super Saiyan Hair Spikes fanning dramatically upward & swept back
    const spikeSpecs: [number, number, number, number, number, number, number][] = [
      // [x, y, z, radius, height, rotZ, rotX]
      [0.02, 0.96, 0.0, 0.22, 0.98, 0.18, 0.0],
      [0.0, 0.88, -0.26, 0.2, 0.88, 0.22, -0.36],
      [0.0, 0.88, 0.26, 0.2, 0.88, 0.22, 0.36],
      [-0.08, 0.74, -0.46, 0.18, 0.78, 0.28, -0.68],
      [-0.08, 0.74, 0.46, 0.18, 0.78, 0.28, 0.68],
      [-0.26, 0.84, -0.18, 0.19, 0.84, 0.58, -0.24],
      [-0.26, 0.84, 0.18, 0.19, 0.84, 0.58, 0.24],
      [-0.36, 0.64, 0.0, 0.18, 0.74, 0.88, 0.0],
      [0.18, 0.84, 0.0, 0.17, 0.76, -0.12, 0.0],
    ];
    spikeSpecs.forEach(([sx, sy, sz, rad, h, rz, rx]) => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 8), ssjHairMat);
      spike.scale.set(1.12, 1.0, 0.78);
      spike.position.set(sx, sy, sz);
      spike.rotation.set(rx, 0, rz);
      spike.castShadow = true;
      powerHeadGroup.add(spike);
    });

    // Golden Forehead Bangs
    [-0.16, 0, 0.16].forEach((bz, bi) => {
      const bang = new THREE.Mesh(new THREE.ConeGeometry(0.085, bi === 1 ? 0.34 : 0.28, 7), ssjHairMat);
      bang.position.set(0.45 + faceXOffset, 0.36, bz);
      bang.rotation.z = Math.PI - 0.38;
      bang.rotation.x = bz * 0.5;
      powerHeadGroup.add(bang);
    });

    // Fierce Golden Eyebrows + Glowing Turquoise-Teal Super Saiyan Eyes
    const ssjEyeMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf });
    [-0.2, 0.2].forEach((ez) => {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.052, 0.22), ssjHairMat);
      brow.position.set(0.56 + faceXOffset, 0.19, ez);
      brow.rotation.x = ez < 0 ? 0.36 : -0.36;
      const tealIris = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 10), ssjEyeMat);
      tealIris.position.set(0.59 + faceXOffset, 0.06, ez);
      powerFaceGroup.add(brow, tealIris);
    });

    // Expanding Golden Shockwave Ground Rings (3 epic layers!)
    [
      { inner: 0.82, outer: 1.15, col: 0xffffff, op: 0.92 },
      { inner: 1.22, outer: 1.58, col: 0xfef08a, op: 0.78 },
      { inner: 1.66, outer: 2.02, col: 0x38bdf8, op: 0.52 },
    ].forEach((spec, idx) => {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(spec.inner, spec.outer, 36),
        new THREE.MeshBasicMaterial({
          color: spec.col,
          transparent: true,
          opacity: spec.op,
          side: THREE.DoubleSide,
        })
      );
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.04 + idx * 0.01;
      auraGroup.add(r);
      powerFx.groundRings.push(r);
    });

    // Towering Golden Ki Beam Pillar shooting skyward
    const kiBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.38, 5.2, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    kiBeam.position.y = 2.6;
    auraGroup.add(kiBeam);

    // Towering Golden Ki Aura Shell (20 surging flame blades)
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2;
      const isInner = i % 2 === 0;
      const h = isInner ? 2.35 + (i % 3) * 0.4 : 3.05 + (i % 4) * 0.32;
      const radius = isInner ? 0.9 : 1.24;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(isInner ? 0.28 : 0.38, h, 7),
        isInner ? ssjCoreGoldMat : ssjOuterGoldMat
      );
      blade.scale.set(0.55, 1.0, 1.35);
      blade.position.set(Math.cos(ang) * radius, h * 0.46, Math.sin(ang) * radius);
      blade.rotation.y = -ang;
      auraGroup.add(blade);
      powerFx.flames.push(blade);
    }

    // 10 Crackling Bio-Electric Lightning Bolts (Cyan-Blue & Bright Gold)
    const sparkCyanMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
    const sparkYellowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    for (let b = 0; b < 10; b++) {
      const bolt = new THREE.Group();
      const bMat = b % 2 === 0 ? sparkCyanMat : sparkYellowMat;
      for (let seg = 0; seg < 4; seg++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.36, 0.048), bMat);
        bar.position.set((seg % 2 === 0 ? 1 : -1) * 0.075, seg * 0.26, 0);
        bar.rotation.z = (seg % 2 === 0 ? 1 : -1) * 0.52;
        bolt.add(bar);
      }
      const ang = (b / 10) * Math.PI * 2;
      bolt.position.set(Math.cos(ang) * 1.18, 0.65 + (b % 3) * 0.65, Math.sin(ang) * 1.18);
      auraGroup.add(bolt);
      powerFx.lightningBolts.push(bolt);
    }

    // 10 Levitating Arena Stones rising from Ki pressure
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.85 });
    for (let rk = 0; rk < 10; rk++) {
      const ang = (rk / 10) * Math.PI * 2 + 0.3;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), rockMat);
      stone.position.set(Math.cos(ang) * 1.48, 0.35 + (rk % 3) * 0.55, Math.sin(ang) * 1.48);
      auraGroup.add(stone);
      powerFx.floatingRocks.push(stone);
    }
  } else if (form === 'stuffed' || form === 'food_coma') {
    const isComa = form === 'food_coma';
    const snackGroup = new THREE.Group();
    const crumbMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 });
    const count = 1 + lvl; // -1 -> 2, -2 -> 3, ..., -9 -> 10 snacks!
    const orbitRad = 0.88 + lvl * 0.045;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const miniDonut = new THREE.Mesh(
        new THREE.TorusGeometry(0.08 + lvl * 0.006, 0.036 + lvl * 0.002, 8, 14),
        i % 2 === 0 ? pinkMat : crumbMat
      );
      miniDonut.position.set(Math.cos(ang) * orbitRad, 0.72 + (i % 2) * 0.25, Math.sin(ang) * orbitRad);
      miniDonut.rotation.x = 0.8;
      snackGroup.add(miniDonut);
    }
    auraGroup.add(snackGroup);
    powerFx.snackOrbitGroup = snackGroup;
    if (isComa) {
      const comaStep = Math.max(0, lvl - 5);
      const comaRing = new THREE.Mesh(
        new THREE.RingGeometry(0.82 + comaStep * 0.06, 1.04 + comaStep * 0.08, 32),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 + comaStep * 0.08, side: THREE.DoubleSide })
      );
      comaRing.rotation.x = -Math.PI / 2;
      comaRing.position.y = 0.03;
      auraGroup.add(comaRing);
      powerFx.groundRings.push(comaRing);
      const zCount = Math.min(4, 1 + Math.floor((comaStep + 1) / 2));
      for (let zi = 0; zi < zCount; zi++) {
        const sp = makeZzzSprite(zi === 0 ? 'Z' : 'z', 0.42 + comaStep * 0.04 - zi * 0.06);
        sp.position.set(0.22, 2.2 + zi * 0.34, 0.3 + zi * 0.12);
        auraGroup.add(sp);
        powerFx.zzzSprites.push(sp);
      }
    }
  } else if (form === 'kabigon') {
    // 💤🐻 ร่างคาบิก้อนยักษ์หลับปุ๋ย (Ultimate Kabigon / Snorlax Boss Mode)!
    lockPowerFace = true;
    const kabigonTealMat = new THREE.MeshStandardMaterial({ color: 0x164e63, roughness: 0.55 });
    const kabigonCreamMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
    const darkLineMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
    const fangMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    // Pointed Kabigon Ears
    [-0.36, 0.36].forEach((ez) => {
      const kEar = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.48, 10), kabigonTealMat);
      kEar.position.set(-0.02, 0.6, ez);
      kEar.rotation.x = ez < 0 ? -0.24 : 0.24;
      powerHeadGroup.add(kEar);
    });

    // Cream Kabigon Face Patch + Sleepy Closed Slit Eyes (—  —) + Little Fangs
    const faceMask = new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 18), kabigonCreamMat);
    faceMask.scale.set(0.45, 0.88, 1.08);
    faceMask.position.set(0.38 + faceXOffset, -0.02, 0);
    powerFaceGroup.add(faceMask);

    [-0.2, 0.2].forEach((ez) => {
      const sleepSlit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.038, 0.2), darkLineMat);
      sleepSlit.position.set(0.59 + faceXOffset, 0.08, ez);
      sleepSlit.rotation.x = ez < 0 ? -0.08 : 0.08;
      powerFaceGroup.add(sleepSlit);
    });

    const sleepMouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.026, 0.26), darkLineMat);
    sleepMouth.position.set(0.59 + faceXOffset, -0.13, 0);
    powerFaceGroup.add(sleepMouth);

    [-0.1, 0.1].forEach((fz) => {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.065, 6), fangMat);
      fang.position.set(0.6 + faceXOffset, -0.1, fz);
      powerFaceGroup.add(fang);
    });

    // Glossy Sleep/Snot Bubble puffing from nose!
    const snotBubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.3,
        roughness: 0.1,
        transparent: true,
        opacity: 0.72,
      })
    );
    snotBubble.position.set(0.72 + faceXOffset, -0.02, 0.08);
    powerFaceGroup.add(snotBubble);

    // 3 Dreamy Expanding Sleep Shockwave Ground Rings
    [
      { inner: 0.92, outer: 1.24, col: 0x38bdf8, op: 0.72 },
      { inner: 1.38, outer: 1.7, col: 0x818cf8, op: 0.52 },
      { inner: 1.85, outer: 2.15, col: 0xfef08a, op: 0.36 },
    ].forEach((spec, idx) => {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(spec.inner, spec.outer, 36),
        new THREE.MeshBasicMaterial({
          color: spec.col,
          transparent: true,
          opacity: spec.op,
          side: THREE.DoubleSide,
        })
      );
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.03 + idx * 0.01;
      auraGroup.add(r);
      powerFx.groundRings.push(r);
    });

    // Dreamy Cyan Aura Pillar + Orbiting Giant Snacks & Sleepy Stars
    const sleepBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.55, 4.4, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    sleepBeam.position.y = 2.2;
    auraGroup.add(sleepBeam);

    const snackOrbit = new THREE.Group();
    const donutMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 });
    const starMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.55 });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const orbObj =
        i % 2 === 0
          ? new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.055, 8, 14), donutMat)
          : new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), starMat);
      orbObj.position.set(Math.cos(ang) * 1.48, 1.35 + (i % 2) * 0.55, Math.sin(ang) * 1.48);
      snackOrbit.add(orbObj);
    }
    auraGroup.add(snackOrbit);
    powerFx.snackOrbitGroup = snackOrbit;

    // 5 Rising Glowing Zzz Sleep Sprites!
    ['Z', 'Z', 'z', 'z', 'z'].forEach((ch, zi) => {
      const sp = makeZzzSprite(ch, 0.72 - zi * 0.09);
      sp.position.set(0.25, 2.35 + zi * 0.42, 0.35 + zi * 0.16);
      auraGroup.add(sp);
      powerFx.zzzSprites.push(sp);
    });
  } else if (form === 'majin_buu') {
    // 🩷😈 ร่างจอมมารบู (Fat Majin Buu Boss Mode)!
    lockPowerFace = true;
    const buuPinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.38 });
    const darkLineMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.25 });

    // Iconic Long Curved Bubblegum-Pink Majin Buu Head Tentacle / Antenna!
    const stem1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.44, 12), buuPinkMat);
    stem1.position.set(-0.02, 0.68, 0);
    stem1.rotation.z = 0.35;
    const stem2 = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.42, 12), buuPinkMat);
    stem2.position.set(-0.22, 0.94, 0);
    stem2.rotation.z = 0.98;

    const tipGroup = new THREE.Group();
    tipGroup.position.set(-0.42, 1.04, 0);
    const stem3 = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.36, 8, 12), buuPinkMat);
    stem3.position.set(-0.18, -0.14, 0);
    stem3.rotation.z = 2.35;
    const tipBulb = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 12), buuPinkMat);
    tipBulb.position.set(-0.32, -0.3, 0);
    tipGroup.add(stem3, tipBulb);

    powerHeadGroup.add(stem1, stem2, tipGroup);
    powerFx.buuAntennaTip = tipGroup;

    // Jolly Squinty Majin Buu Arc Eyes + Cheeky Smile + Steam Vent Holes
    [-0.21, 0.21].forEach((ez) => {
      const squint = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.024, 8, 14, Math.PI), darkLineMat);
      squint.position.set(0.57 + faceXOffset, 0.08, ez);
      squint.rotation.y = Math.PI / 2;
      powerFaceGroup.add(squint);
    });
    const grin = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.026, 8, 16, Math.PI), darkLineMat);
    grin.position.set(0.58 + faceXOffset, -0.06, 0);
    grin.rotation.y = Math.PI / 2;
    grin.rotation.z = Math.PI;
    powerFaceGroup.add(grin);

    // Majin Pink Ground Ring + White Steam Puffs + Orbiting Sweets (Chocolate / Donuts)
    const buuRing = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.22, 36),
      new THREE.MeshBasicMaterial({
        color: 0xf472b6,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      })
    );
    buuRing.rotation.x = -Math.PI / 2;
    buuRing.position.y = 0.04;
    auraGroup.add(buuRing);
    powerFx.groundRings.push(buuRing);

    const steamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
    });
    for (let s = 0; s < 6; s++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), steamMat);
      const side = s % 2 === 0 ? -1 : 1;
      puff.position.set(0, 1.95 + Math.floor(s / 2) * 0.22, side * 0.65);
      auraGroup.add(puff);
      powerFx.steamPuffs.push(puff);
    }

    const sweetsGroup = new THREE.Group();
    const chocoMat = new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.45 });
    const wrapperGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.5, roughness: 0.3 });
    const icingPinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.3 });
    const doughMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.55 });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const item = new THREE.Group();
      if (i % 2 === 0) {
        // 🍫 Chocolate Bar turned from victims!
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.06), chocoMat);
        const foil = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.07), wrapperGoldMat);
        foil.position.y = -0.09;
        item.add(bar, foil);
        item.rotation.z = 0.35;
      } else {
        // 🍩 Majin Pink Frosted Donut
        const d = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.058, 10, 16), doughMat);
        const ic = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.06, 10, 16), icingPinkMat);
        ic.position.z = 0.015;
        item.add(d, ic);
        item.rotation.x = 0.65;
      }
      item.position.set(Math.cos(ang) * 1.18, 0.72 + (i % 2) * 0.25, Math.sin(ang) * 1.18);
      sweetsGroup.add(item);
    }
    auraGroup.add(sweetsGroup);
    powerFx.snackOrbitGroup = sweetsGroup;
  }

  const decoratePlushTorso = (torsoVisualGroup: THREE.Group, torsoBone: THREE.Object3D) => {
    if (form === 'kabigon') {
      const creamBelly = new THREE.Mesh(
        new THREE.SphereGeometry(0.49, 22, 20),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.48 })
      );
      creamBelly.scale.set(1.06, 1.02, 0.65);
      creamBelly.position.set(0, 0.38, 0.36);
      torsoVisualGroup.add(creamBelly);
    } else if (form === 'majin_buu') {
      // Bare plump pink Buu belly + White puffy Majin pants + Black & Gold 'M' Belt + Purple Majin Cape!
      const pinkBelly = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 22, 20),
        new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.42 })
      );
      pinkBelly.scale.set(1.05, 0.72, 1.05);
      pinkBelly.position.set(0, 0.48, 0.02);
      const whitePants = new THREE.Mesh(
        new THREE.SphereGeometry(0.56, 20, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 })
      );
      whitePants.scale.set(1.06, 0.48, 1.06);
      whitePants.position.set(0, 0.16, 0);
      const blackBelt = new THREE.Mesh(
        new THREE.TorusGeometry(0.555, 0.048, 12, 32),
        new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 })
      );
      blackBelt.rotation.x = Math.PI / 2;
      blackBelt.position.y = 0.28;

      const buckleTex = getMajinBuckleTexture();
      const buckleMat = buckleTex
        ? new THREE.MeshStandardMaterial({ map: buckleTex, roughness: 0.25, metalness: 0.45 })
        : new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.25 });
      const mBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.06), buckleMat);
      mBuckle.position.set(0, 0.28, 0.59);

      const neckScarf = new THREE.Mesh(
        new THREE.TorusGeometry(0.29, 0.065, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.55 })
      );
      neckScarf.rotation.x = Math.PI / 2;
      neckScarf.position.y = 0.74;

      torsoVisualGroup.add(pinkBelly, whitePants, blackBelt, mBuckle, neckScarf);

      const purpleCape = new THREE.Mesh(
        new THREE.ConeGeometry(0.68, 0.92, 16, 1, true, -Math.PI * 0.45, Math.PI * 0.9),
        new THREE.MeshStandardMaterial({
          color: 0x7e22ce,
          roughness: 0.55,
          side: THREE.DoubleSide,
        })
      );
      purpleCape.position.set(0, 0.34, -0.24);
      purpleCape.rotation.x = -0.24;
      purpleCape.rotation.y = Math.PI;
      torsoBone.add(purpleCape);
    }
  };

  const decorateFallbackTorso = (bodyMesh: THREE.Mesh) => {
    if (form === 'kabigon') {
      const creamBelly = new THREE.Mesh(
        new THREE.SphereGeometry(0.66, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 })
      );
      creamBelly.position.set(0.28, -0.02, 0);
      bodyMesh.add(creamBelly);
    } else if (form === 'majin_buu') {
      const blackBelt = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.06, 12, 28),
        new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 })
      );
      blackBelt.rotation.x = Math.PI / 2;
      blackBelt.position.y = -0.18;
      const buckleTex = getMajinBuckleTexture();
      const mBuckle = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.22, 0.28),
        buckleTex
          ? new THREE.MeshStandardMaterial({ map: buckleTex, roughness: 0.25 })
          : new THREE.MeshStandardMaterial({ color: 0xfacc15 })
      );
      mBuckle.position.set(0.78, -0.18, 0);
      bodyMesh.add(blackBelt, mBuckle);
    }
  };

  return {
    powerHeadGroup,
    powerFaceGroup,
    powerFx,
    lockPowerFace,
    decoratePlushTorso,
    decorateFallbackTorso,
  };
}

/**
 * สร้างหัวมนุษย์จิบิ & เครื่องหัวฮีโร่ 3D เฉพาะตัว (Chibi Human Hero Head, Hair, Masks & Helmets)
 * พิกัดภายใน headGroup: +X = ด้านหน้าใบหน้า, -X = ท้ายทอย, +Y = ด้านบนศีรษะ, ±Z = ซ้าย/ขวา
 */
function buildHeroHead3D(
  headGroup: THREE.Group,
  headMesh: THREE.Mesh,
  skinMat: THREE.Material,
  breedMeta: SpeciesOption,
  primaryHex: THREE.ColorRepresentation,
  accentHex: THREE.ColorRepresentation
): { hideStandardEyes: boolean; hideStandardMouth: boolean } {
  const style = breedMeta.heroStyle || 'snow_bob_bow';
  headMesh.scale.set(0.95, 0.96, 0.98);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    roughness: 0.44,
    metalness: 0.06,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.34,
    metalness: 0.25,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.68, roughness: 0.24 });

  const hideHumanEars = [
    'mickey_ears',
    'minnie_bow_ears',
    'donald_sailor_beak',
    'stitch_alien_ears',
    'buzz_space_dome',
    'three_eye_alien',
    'baymax_eyes',
    'mike_cyclops',
    'sulley_horns',
    'olaf_snowman',
    'maleficent_horns',
    'queen_crown_veil',
    'anime_boar_mask',
    'anime_doraemon_bell',
    'anime_pikachu_ears',
    'anime_chopper_hat',
    'anime_chainsaw_head',
    'anime_korosensei_smile',
    'anime_elf_twintails',
    'monster_sheet_ghost',
    'monster_mummy',
    'monster_pumpkin',
    'monster_kaiju_spikes',
    'monster_alien_eyes',
  ].includes(style);

  let hideStandardEyes = [
    'three_eye_alien',
    'baymax_eyes',
    'mike_cyclops',
    'anime_boar_mask',
    'anime_blindfold_spiky',
    'anime_chainsaw_head',
  ].includes(style);

  let hideStandardMouth = [
    'donald_sailor_beak',
    'baymax_eyes',
    'anime_boar_mask',
    'anime_bamboo_muzzle',
    'anime_ninja_mask_silver',
    'anime_chainsaw_head',
  ].includes(style);

  const hideHumanNose = [
    'donald_sailor_beak',
    'stitch_alien_ears',
    'pinocchio_hat_nose',
    'baymax_eyes',
    'mike_cyclops',
    'olaf_snowman',
    'mickey_ears',
    'minnie_bow_ears',
    'anime_boar_mask',
    'anime_doraemon_bell',
    'anime_pikachu_ears',
    'anime_chopper_hat',
    'anime_ninja_mask_silver',
    'anime_chainsaw_head',
    'anime_korosensei_smile',
  ].includes(style);

  // 1. หูมนุษย์จิบิ (หรือหูแหลมเอเลี่ยนสามตา)
  if (!hideHumanEars) {
    [-0.56, 0.56].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), skinMat);
      ear.scale.set(0.55, 1.05, 0.75);
      ear.position.set(0.0, 0.02, ez);
      headGroup.add(ear);
    });
  }

  // 2. จมูกมนุษย์จิบิปุ่มเล็กๆ น่ารัก
  if (!hideHumanNose) {
    const noseColor = new THREE.Color(breedMeta.skinHex || '#FAD6B8').multiplyScalar(0.88);
    const chibiNose = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 10, 10),
      new THREE.MeshStandardMaterial({ color: noseColor, roughness: 0.5 })
    );
    chibiNose.scale.set(0.95, 0.85, 1.05);
    chibiNose.position.set(0.56, -0.02, 0);
    headGroup.add(chibiNose);
  }

  // Helper: ฐานทรงผมครึ่งหัวด้านหลัง & จอนข้างแก้ม
  const addBaseHairCap = (mat: THREE.Material = primaryMat, withSidebangs = true) => {
    const backCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.595, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
      mat
    );
    backCap.rotation.z = 0.34;
    backCap.position.set(-0.03, 0.04, 0);
    headGroup.add(backCap);

    if (withSidebangs) {
      [-0.36, 0.36].forEach((sz) => {
        const lock = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 8), mat);
        lock.rotation.x = Math.PI;
        lock.position.set(0.32, 0.04, sz);
        headGroup.add(lock);
      });
      [-0.16, 0.02, 0.18].forEach((bz, bi) => {
        const bang = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 8), mat);
        bang.rotation.x = Math.PI;
        bang.rotation.z = -0.35;
        bang.position.set(0.49, 0.28 + (bi === 1 ? 0.03 : 0), bz);
        headGroup.add(bang);
      });
    }
  };

  // Helper: สร้างโบว์ริบบิ้น 3D สุดคิวท์
  const makeRibbonBow = (mat: THREE.Material, scale = 1) => {
    const bow = new THREE.Group();
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.15 * scale, 0.32 * scale, 10), mat);
      wing.rotation.x = side * (Math.PI / 2);
      wing.position.z = side * 0.14 * scale;
      bow.add(wing);
    });
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.08 * scale, 10, 10), mat);
    bow.add(knot);
    return bow;
  };

  // 3. ปั้นทรงผม มงกุฎ และคาแรกเตอร์ดิสนีย์ & พิกซาร์ทั้ง 35 สไตล์!
  switch (style) {
    case 'snow_bob_bow': {
      // 🍎 สโนว์ไวท์ / อลิซ: ผมบ๊อบพองลอนกลมข้างแก้ม + ที่คาดผมโบว์ผูกด้านบน
      addBaseHairCap(primaryMat, true);
      [-0.48, 0.48].forEach((bz) => {
        const bobRoll = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), primaryMat);
        bobRoll.scale.set(0.95, 1.15, 0.85);
        bobRoll.position.set(-0.02, -0.14, bz);
        headGroup.add(bobRoll);
      });
      const headband = new THREE.Mesh(
        new THREE.TorusGeometry(0.585, 0.038, 8, 22, Math.PI * 1.1),
        accentMat
      );
      headband.rotation.y = Math.PI / 2;
      headband.position.set(0.04, 0.04, 0);
      const bow = makeRibbonBow(accentMat, 1.05);
      bow.position.set(0.14, 0.62, 0);
      headGroup.add(headband, bow);
      break;
    }

    case 'elsa_side_braid': {
      // ❄️ ราชินีเอลซ่า: ผมบลอนด์เงินแสกข้างพองสวย + เปียยาวพาดไหล่ซ้ายมาด้านหน้า + มงกุฎน้ำแข็ง
      addBaseHairCap(primaryMat, true);
      const topSweep = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), primaryMat);
      topSweep.scale.set(1.15, 0.68, 1.05);
      topSweep.position.set(0.14, 0.48, -0.06);
      headGroup.add(topSweep);
      for (let b = 0; b < 5; b++) {
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.14 - b * 0.012, 12, 10), primaryMat);
        bead.position.set(0.1 + b * 0.08, -0.06 - b * 0.14, -0.48 + b * 0.02);
        headGroup.add(bead);
      }
      // มงกุฎคริสตัลน้ำแข็ง
      [-0.14, 0, 0.14].forEach((cz, ci) => {
        const shard = new THREE.Mesh(
          new THREE.OctahedronGeometry(ci === 1 ? 0.12 : 0.085, 0),
          accentMat
        );
        shard.scale.set(0.45, ci === 1 ? 1.55 : 1.15, 0.8);
        shard.position.set(0.4, 0.56 + (ci === 1 ? 0.06 : 0), cz);
        headGroup.add(shard);
      });
      break;
    }

    case 'anna_twin_braids': {
      // 🌷 เจ้าหญิงอันนา: ผมถักเปียคู่ยาวสองข้างผูกริบบิ้นบานเย็น
      addBaseHairCap(primaryMat, true);
      [-0.48, 0.48].forEach((sideZ) => {
        for (let b = 0; b < 4; b++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.115 - b * 0.01, 10, 10), primaryMat);
          seg.position.set(0.12, -0.1 - b * 0.14, sideZ);
          headGroup.add(seg);
        }
        const tie = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), accentMat);
        tie.rotation.x = Math.PI / 2;
        tie.position.set(0.12, -0.56, sideZ);
        headGroup.add(tie);
      });
      break;
    }

    case 'cinderella_updo': {
      // 👠 ซินเดอเรลล่า / เบลล์ / เทียน่า: มวยผมเกล้ากลมสูงสง่างาม + ที่คาดผมรัดเกล้า
      addBaseHairCap(primaryMat, true);
      const highBun = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 16), primaryMat);
      highBun.scale.set(0.95, 0.92, 1.05);
      highBun.position.set(-0.1, 0.68, 0);
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.585, 0.042, 8, 22, Math.PI * 1.15),
        accentMat
      );
      band.rotation.y = Math.PI / 2;
      band.position.set(0.06, 0.08, 0);
      const bunRibbon = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 8, 18), accentMat);
      bunRibbon.rotation.x = Math.PI / 2;
      bunRibbon.position.set(-0.1, 0.5, 0);
      headGroup.add(highBun, band, bunRibbon);
      break;
    }

    case 'ariel_wave_flower': {
      // 🐚 แอเรียล / โมอาน่า / ลีโล่: ผมลอนยาวหนาแสกปัดหน้าผากฟูสวย + ดอกไม้/ปลาดาวทัดหู
      addBaseHairCap(primaryMat, false);
      const swoopBang = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 14), primaryMat);
      swoopBang.scale.set(0.92, 0.68, 1.18);
      swoopBang.position.set(0.34, 0.42, 0.12);
      swoopBang.rotation.x = 0.25;
      const backWaves = new THREE.Mesh(new THREE.SphereGeometry(0.56, 18, 16), primaryMat);
      backWaves.scale.set(0.95, 1.22, 1.15);
      backWaves.position.set(-0.26, -0.18, 0);
      // ดอกไม้/ปลาดาวทัดหูขวา
      const flower = new THREE.Group();
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), accentMat);
        petal.position.set(Math.cos(pa) * 0.09, Math.sin(pa) * 0.09, 0);
        flower.add(petal);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), goldMat);
      flower.add(center);
      flower.rotation.y = Math.PI / 2;
      flower.position.set(0.18, 0.24, 0.58);
      headGroup.add(swoopBang, backWaves, flower);
      break;
    }

    case 'rapunzel_floral_long': {
      // 🌸 ราพันเซล: ผมทองถักเปียใหญ่มหึมาด้านหลัง + ดอกไม้พาสเทลประดับเต็มผม
      addBaseHairCap(primaryMat, true);
      const flowerCols: number[] = [0xf472b6, 0xc084fc, 0x38bdf8, 0xfef08a, 0x4ade80];
      for (let b = 0; b < 6; b++) {
        const plait = new THREE.Mesh(new THREE.SphereGeometry(0.28 - b * 0.022, 14, 12), primaryMat);
        plait.position.set(-0.42 - b * 0.04, 0.14 - b * 0.18, Math.sin(b * 0.8) * 0.06);
        headGroup.add(plait);
        const fl = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 8, 8),
          new THREE.MeshStandardMaterial({ color: flowerCols[b % flowerCols.length], roughness: 0.4 })
        );
        fl.position.set(-0.38, 0.22 - b * 0.16, (b % 2 === 0 ? 1 : -1) * 0.22);
        headGroup.add(fl);
      }
      [-0.36, 0, 0.36].forEach((fz, fi) => {
        const crownBloom = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 10, 10),
          fi === 1 ? accentMat : new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.4 })
        );
        crownBloom.position.set(0.36, 0.48, fz);
        headGroup.add(crownBloom);
      });
      break;
    }

    case 'jasmine_ponytail_gem': {
      // 🪔 เจ้าหญิงจัสมิน: ผมดำมัดปล้องพองยาว + รัดเกล้าทองพลอยฟ้า + ต่างหูห่วงทองใหญ่
      addBaseHairCap(primaryMat, true);
      for (let s = 0; s < 4; s++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24 - s * 0.025, 14, 12), primaryMat);
        puff.position.set(-0.46 - s * 0.06, 0.16 - s * 0.22, 0);
        const bandTie = new THREE.Mesh(new THREE.TorusGeometry(0.16 - s * 0.018, 0.028, 8, 14), accentMat);
        bandTie.rotation.x = Math.PI / 2;
        bandTie.position.set(-0.46 - s * 0.06, 0.04 - s * 0.22, 0);
        headGroup.add(puff, bandTie);
      }
      const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.595, 0.595, 0.1, 22), accentMat);
      headband.position.y = 0.28;
      const gemRim = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), goldMat);
      gemRim.scale.set(0.5, 1.25, 0.9);
      gemRim.position.set(0.59, 0.31, 0);
      const sapphire = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), accentMat);
      sapphire.scale.set(0.55, 1.15, 0.8);
      sapphire.position.set(0.61, 0.31, 0);
      [-0.58, 0.58].forEach((ez) => {
        const earring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 14), goldMat);
        earring.position.set(0.02, -0.14, ez);
        headGroup.add(earring);
      });
      headGroup.add(headband, gemRim, sapphire);
      break;
    }

    case 'mulan_jade_bun': {
      // 🗡️ มู่หลาน: ผมดำเกล้ามวยปักปิ่นหยกและดอกเหมยชมพู
      addBaseHairCap(primaryMat, true);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 14), primaryMat);
      bun.position.set(-0.14, 0.64, 0);
      const jadePin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 8), accentMat);
      jadePin.rotation.x = Math.PI / 2 + 0.18;
      jadePin.position.set(-0.14, 0.65, 0);
      const blossom = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 })
      );
      blossom.position.set(0.18, 0.48, 0.38);
      headGroup.add(bun, jadePin, blossom);
      break;
    }

    case 'royal_tiara_curls': {
      // 👑 เจ้าหญิงออโรร่า: ผมทองดัดลอนยาวสลวย + มงกุฎทองคำสามยอดทรงแหลม
      addBaseHairCap(primaryMat, true);
      const longCurls = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 0.58, 18), primaryMat);
      longCurls.position.set(-0.22, -0.18, 0);
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.12, 18), goldMat);
      crownBase.position.set(0.08, 0.58, 0);
      [-0.16, 0, 0.16].forEach((cz, ci) => {
        const spire = new THREE.Mesh(
          new THREE.ConeGeometry(0.065, ci === 1 ? 0.28 : 0.2, 8),
          goldMat
        );
        spire.position.set(0.26, 0.7 + (ci === 1 ? 0.04 : 0), cz);
        headGroup.add(spire);
      });
      headGroup.add(longCurls, crownBase);
      break;
    }

    case 'merida_wild_curls': {
      // 🏹 เมอริด้า / ทาร์ซาน / มาวอิ: ผมหยิกฟูก้อนลอนใหญ่รอบหัวสุดมีพลัง!
      addBaseHairCap(primaryMat, false);
      const curlOffsets: [number, number, number, number][] = [
        [0.12, 0.58, -0.28, 0.24],
        [0.12, 0.58, 0.28, 0.24],
        [-0.12, 0.64, 0, 0.28],
        [-0.1, 0.36, -0.52, 0.26],
        [-0.1, 0.36, 0.52, 0.26],
        [-0.22, 0.06, -0.54, 0.26],
        [-0.22, 0.06, 0.54, 0.26],
        [-0.38, 0.28, -0.32, 0.28],
        [-0.38, 0.28, 0.32, 0.28],
        [-0.44, -0.08, 0, 0.34],
      ];
      curlOffsets.forEach(([cx, cy, cz, cr]) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(cr, 12, 12), primaryMat);
        puff.position.set(cx, cy, cz);
        headGroup.add(puff);
      });
      break;
    }

    case 'tinker_pom_bun': {
      // ✨ ทิงเกอร์เบลล์ / ลั้ลลา (Joy): ผมซอยสั้นหน้าม้าเฉียง + จุกกลมสูงผูกริบบิ้น
      addBaseHairCap(primaryMat, true);
      const pomBun = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 14), primaryMat);
      pomBun.position.set(-0.08, 0.72, 0);
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.038, 8, 16), accentMat);
      ribbon.rotation.x = Math.PI / 2;
      ribbon.position.set(-0.08, 0.54, 0);
      headGroup.add(pomBun, ribbon);
      break;
    }

    case 'aladdin_fez': {
      // 🧞‍♂️ อะลาดิน: ผมดำแสกพองเท่ + หมวกเฟซสีแดงจิ๋ววางเอียงบนหัว
      addBaseHairCap(primaryMat, true);
      const fez = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.24, 16), accentMat);
      fez.position.set(-0.04, 0.68, 0.08);
      fez.rotation.x = 0.18;
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.18, 6), goldMat);
      tassel.position.set(-0.08, 0.72, 0.24);
      tassel.rotation.x = 0.65;
      headGroup.add(fez, tassel);
      break;
    }

    case 'genie_topknot_beard': {
      // 💨 ยักษ์จินนี่: มัดจุกหางม้าโค้งบนหัว + เคราแพะม้วนงอนที่คาง + ต่างหูทอง
      const goldBand = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.028, 8, 14), goldMat);
      goldBand.rotation.x = Math.PI / 2;
      goldBand.position.set(-0.04, 0.58, 0);
      const topknot = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.48, 12), primaryMat);
      topknot.position.set(-0.14, 0.8, 0);
      topknot.rotation.z = 0.45;
      const goatee = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.24, 10), primaryMat);
      goatee.rotation.x = Math.PI;
      goatee.rotation.z = -0.35;
      goatee.position.set(0.52, -0.34, 0);
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 14), goldMat);
      hoop.position.set(0, -0.1, 0.58);
      headGroup.add(goldBand, topknot, goatee, hoop);
      break;
    }

    case 'peter_robin_cap':
    case 'pinocchio_hat_nose': {
      // 🪶 ปีเตอร์แพน / 🤥 พินอคคิโอ: หมวกทรงแหลมปักขนนกแดงสด (+ จมูกไม้ยื่นยาวสำหรับพินอคคิโอ!)
      const hairColor = style === 'pinocchio_hat_nose' ? 0x18181b : 0xc2410c;
      addBaseHairCap(new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.5 }), true);
      const capBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.64, 0.12, 20), primaryMat);
      capBrim.position.set(0, 0.42, 0);
      capBrim.rotation.z = -0.1;
      const capCone = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.52, 16), primaryMat);
      capCone.position.set(-0.06, 0.68, 0);
      capCone.rotation.z = 0.28;
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.48, 8), accentMat);
      feather.position.set(-0.12, 0.76, -0.42);
      feather.rotation.x = -0.45;
      feather.rotation.z = 0.35;
      headGroup.add(capBrim, capCone, feather);

      if (style === 'pinocchio_hat_nose') {
        const longWoodenNose = new THREE.Mesh(
          new THREE.CylinderGeometry(0.032, 0.052, 0.46, 12),
          skinMat
        );
        longWoodenNose.rotation.z = -Math.PI / 2;
        longWoodenNose.position.set(0.74, -0.01, 0);
        headGroup.add(longWoodenNose);
      }
      break;
    }

    case 'mickey_ears':
    case 'minnie_bow_ears': {
      // 🐭 มิกกี้ / 🎀 มินนี่ / 🍓 หมีล็อตโซ่: หูกลมใหญ่คู่เอกลักษณ์ระดับโลก!
      const isLotso = breedMeta.id === 'disney_lotso';
      if (!isLotso) {
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.59, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
          primaryMat
        );
        cap.rotation.z = 0.42;
        headGroup.add(cap);
      }
      const snoutMuzzle = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 14, 12),
        isLotso ? whiteMat : skinMat
      );
      snoutMuzzle.scale.set(0.85, 0.72, 1.15);
      snoutMuzzle.position.set(0.48, -0.12, 0);
      const buttonNose = new THREE.Mesh(
        new THREE.SphereGeometry(isLotso ? 0.11 : 0.075, 12, 10),
        isLotso ? accentMat : darkMat
      );
      buttonNose.scale.set(0.85, 0.75, 1.2);
      buttonNose.position.set(0.64, -0.06, 0);
      headGroup.add(snoutMuzzle, buttonNose);

      [-0.48, 0.48].forEach((ez) => {
        const mouseEar = new THREE.Mesh(
          new THREE.CylinderGeometry(isLotso ? 0.22 : 0.34, isLotso ? 0.22 : 0.34, 0.1, 22),
          primaryMat
        );
        mouseEar.rotation.z = Math.PI / 2;
        mouseEar.position.set(-0.04, isLotso ? 0.56 : 0.66, ez);
        headGroup.add(mouseEar);
      });

      if (style === 'minnie_bow_ears') {
        const bigBow = makeRibbonBow(accentMat, 1.55);
        bigBow.position.set(0.08, 0.68, 0);
        // จุดขาว Polka-dots บนโบว์มินนี่!
        [-0.22, -0.1, 0.1, 0.22].forEach((dz, di) => {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), whiteMat);
          dot.position.set(0.16, 0.68 + (di % 2 === 0 ? 0.05 : -0.05), dz);
          headGroup.add(dot);
        });
        headGroup.add(bigBow);
      }
      break;
    }

    case 'donald_sailor_beak': {
      // ⚓ โดนัลด์ดั๊ก: ปากเป็ดสีส้มยื่นก๊าบๆ + หมวกกะลาสีเรือสีน้ำเงินแถบดำริบบิ้นพริ้ว
      const beakMat = accentMat;
      const upperBill = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.1, 18), beakMat);
      upperBill.scale.set(1.28, 1, 1.15);
      upperBill.position.set(0.56, -0.06, 0);
      const lowerBill = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 16), beakMat);
      lowerBill.scale.set(1.15, 1, 1.05);
      lowerBill.position.set(0.53, -0.14, 0);
      const sailorBand = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.12, 18), darkMat);
      sailorBand.position.set(0.02, 0.56, 0.08);
      sailorBand.rotation.x = 0.22;
      const sailorTop = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 12), primaryMat);
      sailorTop.scale.set(1.1, 0.42, 1.15);
      sailorTop.position.set(-0.02, 0.68, 0.1);
      sailorTop.rotation.x = 0.22;
      const tailRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.08), darkMat);
      tailRibbon.position.set(-0.34, 0.5, 0.08);
      tailRibbon.rotation.z = 0.45;
      headGroup.add(upperBill, lowerBill, sailorBand, sailorTop, tailRibbon);
      break;
    }

    case 'stitch_alien_ears': {
      // 🛸 สติทช์ (Experiment 626): หูเอเลี่ยนใบยาวใหญ่กางออกสองข้างด้านในสีชมพู + จมูกน้ำเงินเข้มก้อนโต
      const bigNose = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), primaryMat);
      bigNose.scale.set(0.85, 0.82, 1.18);
      bigNose.position.set(0.56, 0.0, 0);
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), skinMat);
      tuft.position.set(0.08, 0.64, 0);
      headGroup.add(bigNose, tuft);
      [-1, 1].forEach((side) => {
        const earGrp = new THREE.Group();
        const outerEar = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.92, 12), skinMat);
        outerEar.scale.set(0.45, 1, 1);
        const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.76, 10), accentMat);
        innerEar.scale.set(0.48, 1, 0.92);
        innerEar.position.x = 0.04;
        earGrp.add(outerEar, innerEar);
        earGrp.position.set(-0.04, 0.42, side * 0.72);
        earGrp.rotation.x = side * 1.05;
        earGrp.rotation.z = 0.18;
        headGroup.add(earGrp);
      });
      break;
    }

    case 'cowboy_hat': {
      // 🤠 นายอำเภอวู้ดดี้ / คาวเกิร์ลเจสซี่ / รัสเซล: หมวกคาวบอยปีกโค้งเท่!
      const underHairMat = new THREE.MeshStandardMaterial({
        color: breedMeta.id === 'disney_jessie' ? 0xc2410c : 0x78350f,
        roughness: 0.5,
      });
      addBaseHairCap(underHairMat, true);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.92, 0.06, 24), primaryMat);
      brim.scale.set(1.05, 1, 0.92);
      brim.position.set(0, 0.44, 0);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.36, 20), primaryMat);
      crown.position.set(0, 0.62, 0);
      const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.485, 0.49, 0.075, 20), accentMat);
      hatBand.position.set(0, 0.49, 0);
      headGroup.add(brim, crown, hatBand);
      break;
    }

    case 'buzz_space_dome': {
      // 👨‍🚀 บัซ ไลท์เยียร์: ฮู้ดอวกาศสีม่วงคลุมศีรษะโชว์ใบหน้า + โดมแก้วอวกาศใสครอบรอบหัว!
      const purpleCowl = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 22, 18, -Math.PI * 0.25, Math.PI * 1.5, 0, Math.PI * 0.78),
        primaryMat
      );
      purpleCowl.rotation.y = Math.PI / 2;
      const chinStrap = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.055, 8, 20, Math.PI * 0.9),
        primaryMat
      );
      chinStrap.rotation.z = -Math.PI * 0.95;
      chinStrap.rotation.y = Math.PI / 2;
      const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.08, 10, 24), accentMat);
      collarRing.rotation.x = Math.PI / 2;
      collarRing.position.y = -0.44;
      const spaceDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.74, 24, 20),
        new THREE.MeshPhysicalMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.3,
          roughness: 0.06,
          metalness: 0.1,
        })
      );
      headGroup.add(purpleCowl, chinStrap, collarRing, spaceDome);
      break;
    }

    case 'three_eye_alien': {
      // 👽 เอเลี่ยนสามตา (Toy Story LGM): ตากลมโต 3 ดวงเรียงกัน + หูแหลม + เสาอากาศบนหัว!
      headMesh.scale.set(0.92, 0.86, 1.12);
      [-0.24, 0, 0.24].forEach((ez, ei) => {
        const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), whiteMat);
        const ex = ei === 1 ? 0.54 : 0.49;
        sclera.position.set(ex, 0.1, ez);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), darkMat);
        pupil.position.set(ex + 0.085, 0.1, ez);
        headGroup.add(sclera, pupil);
      });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.32, 8), skinMat);
      stem.position.set(0.04, 0.64, 0);
      const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), skinMat);
      antBall.position.set(0.04, 0.82, 0);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.065, 8, 22), accentMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = -0.42;
      [-0.64, 0.64].forEach((ez) => {
        const alienEar = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.36, 10), skinMat);
        alienEar.position.set(0, 0.08, ez);
        alienEar.rotation.x = ez < 0 ? -1.15 : 1.15;
        headGroup.add(alienEar);
      });
      headGroup.add(stem, antBall, collar);
      break;
    }

    case 'baymax_eyes': {
      // 🤍 เบย์แมกซ์ (Big Hero 6): หัวมาร์ชเมลโลว์ขาวกลมมน ตาจุดดำคู่เชื่อมด้วยเส้นตรงกลางเป๊ะ!
      headMesh.scale.set(0.92, 0.84, 1.06);
      [-0.19, 0.19].forEach((ez) => {
        const bEye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 12), darkMat);
        bEye.scale.set(0.45, 1, 1);
        bEye.position.set(0.53, 0.06, ez);
        headGroup.add(bEye);
      });
      const connectorLine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.026, 0.38), darkMat);
      connectorLine.position.set(0.54, 0.06, 0);
      headGroup.add(connectorLine);
      break;
    }

    case 'mike_cyclops': {
      // 👁️ ไมค์ วาซาวสกี้: ตายักษ์ดวงเดียวกลางหน้าผากพร้อมม่านตาสีเขียวมรกต + เขาจิ๋วคู่!
      const bigSclera = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 18), whiteMat);
      bigSclera.scale.set(0.55, 1, 1);
      bigSclera.position.set(0.46, 0.12, 0);
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 16, 14),
        new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.25 })
      );
      iris.scale.set(0.45, 1, 1);
      iris.position.set(0.55, 0.12, 0);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), darkMat);
      pupil.scale.set(0.45, 1, 1);
      pupil.position.set(0.59, 0.12, 0);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), whiteMat);
      shine.position.set(0.62, 0.18, -0.05);
      [-0.32, 0.32].forEach((hz) => {
        const miniHorn = new THREE.Mesh(
          new THREE.ConeGeometry(0.065, 0.22, 8),
          new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.45 })
        );
        miniHorn.position.set(0.04, 0.58, hz);
        miniHorn.rotation.x = hz < 0 ? -0.35 : 0.35;
        headGroup.add(miniHorn);
      });
      headGroup.add(bigSclera, iris, pupil, shine);
      break;
    }

    case 'sulley_horns': {
      // 💙 ซัลลี่ มอนสเตอร์ขนฟู: เขาโค้งคู่สีเทาฟ้า + จุดม่วงพาสเทล + คิ้วหนาใจดี
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.38 });
      [-0.38, 0.38].forEach((hz) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.46, 10), hornMat);
        horn.position.set(0.04, 0.6, hz);
        horn.rotation.x = hz < 0 ? -0.48 : 0.48;
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.065, 0.18), primaryMat);
        brow.position.set(0.52, 0.22, hz * 0.55);
        headGroup.add(horn, brow);
      });
      [-0.32, 0.28].forEach((sz, si) => {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), accentMat);
        spot.scale.set(0.4, 0.9, 1.1);
        spot.position.set(-0.22, 0.28 - si * 0.22, sz);
        headGroup.add(spot);
      });
      break;
    }

    case 'olaf_snowman': {
      // ⛄ โอลาฟ ตุ๊กตาหิมะ: จมูกแครอทสีส้มยื่นยาว + ฟันกระต่ายซี่โต + กิ่งไม้ 3 แฉกบนหัว!
      const carrotNose = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.46, 12), accentMat);
      carrotNose.rotation.z = -Math.PI / 2;
      carrotNose.position.set(0.74, -0.02, 0);
      const buckTooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.095, 0.12), whiteMat);
      buckTooth.position.set(0.55, -0.19, 0);
      [-0.22, 0, 0.22].forEach((tz, ti) => {
        const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.38, 6), primaryMat);
        twig.position.set(0.02, 0.72, tz * 0.5);
        twig.rotation.x = tz * 1.3;
        twig.rotation.z = ti === 1 ? -0.12 : 0.18;
        headGroup.add(twig);
      });
      headGroup.add(carrotNose, buckTooth);
      break;
    }

    case 'maleficent_horns': {
      // 🖤 มาเลฟิเซนต์: หมวกคลุมดำกรอบหน้ารูปตัว V พร้อมเขาปีศาจโค้งสูงคู่ใหญ่สง่างาม!
      const cowl = new THREE.Mesh(
        new THREE.SphereGeometry(0.605, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
        primaryMat
      );
      const vPeak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 6), primaryMat);
      vPeak.rotation.x = Math.PI;
      vPeak.position.set(0.55, 0.28, 0);
      [-1, 1].forEach((side) => {
        const hornLower = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.48, 12), primaryMat);
        hornLower.position.set(-0.02, 0.66, side * 0.36);
        hornLower.rotation.x = side * 0.42;
        const hornUpper = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.54, 12), primaryMat);
        hornUpper.position.set(-0.08, 1.04, side * 0.44);
        hornUpper.rotation.x = -side * 0.24;
        hornUpper.rotation.z = 0.22;
        headGroup.add(hornLower, hornUpper);
      });
      headGroup.add(cowl, vPeak);
      break;
    }

    case 'cruella_half_hair': {
      // 🐾 ครูเอลล่า เดอ วิล: ผมบ๊อบฟูแบ่งครึ่งสองสีชัดเจน ขาวซีกซ้าย - ดำซีกขวา!
      const leftWhiteMat = whiteMat;
      const rightBlackMat = darkMat;
      [-1, 1].forEach((side) => {
        const halfMat = side < 0 ? leftWhiteMat : rightBlackMat;
        const halfDome = new THREE.Mesh(
          new THREE.SphereGeometry(
            0.62,
            16,
            14,
            side < 0 ? Math.PI : 0,
            Math.PI,
            0,
            Math.PI * 0.62
          ),
          halfMat
        );
        halfDome.rotation.z = 0.28;
        const sidePuff = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), halfMat);
        sidePuff.position.set(-0.06, 0.04, side * 0.48);
        const topPuff = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), halfMat);
        topPuff.position.set(0.04, 0.48, side * 0.24);
        headGroup.add(halfDome, sidePuff, topPuff);
      });
      break;
    }

    case 'hades_flame_hair': {
      // 🔥 ฮาเดส (ไฟฟ้า) / ฉุนเฉียว Anger (ไฟส้มแดง): เปลวไฟเรืองแสงลุกโชนพริ้วบนหัว!
      const outerFireMat = new THREE.MeshBasicMaterial({ color: primaryHex });
      const innerFireMat = new THREE.MeshBasicMaterial({ color: accentHex });
      const flameSpecs: [number, number, number, number, number][] = [
        [0.02, 0.82, 0, 0.26, 0.68],
        [0.06, 0.72, -0.24, 0.2, 0.54],
        [0.06, 0.72, 0.24, 0.2, 0.54],
        [-0.16, 0.74, -0.14, 0.2, 0.56],
        [-0.16, 0.74, 0.14, 0.2, 0.56],
        [0.22, 0.64, 0, 0.16, 0.42],
      ];
      flameSpecs.forEach(([fx, fy, fz, fr, fh], fi) => {
        const tongue = new THREE.Mesh(
          new THREE.ConeGeometry(fr, fh, 9),
          fi % 2 === 0 ? outerFireMat : innerFireMat
        );
        tongue.position.set(fx, fy, fz);
        tongue.rotation.z = (fi % 2 === 0 ? 1 : -1) * 0.12;
        tongue.rotation.x = fz * 0.55;
        headGroup.add(tongue);
      });
      break;
    }

    case 'queen_crown_veil': {
      // 🪞 ราชินีใจร้าย / 🐙 เออร์ซูล่า / ♥️ ราชินีโพแดง: ผมพองหรือผ้าคลุมพร้อมมงกุฎทองยอดแหลม!
      addBaseHairCap(primaryMat, false);
      if (breedMeta.id === 'disney_ursula') {
        // ผมขาวเซ็ตตั้งพริ้วของเออร์ซูล่า
        [-0.2, 0, 0.2].forEach((uz, ui) => {
          const wave = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.54, 10), primaryMat);
          wave.position.set(0.04, 0.68 + (ui === 1 ? 0.08 : 0), uz);
          wave.rotation.z = -0.22;
          headGroup.add(wave);
        });
      } else if (breedMeta.id === 'disney_queen_hearts') {
        [-0.26, 0.26].forEach((hz) => {
          const heartLobe = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), primaryMat);
          heartLobe.position.set(0.02, 0.48, hz);
          headGroup.add(heartLobe);
        });
      }
      const crownRing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.16, 18), goldMat);
      crownRing.position.set(0.08, 0.64, 0);
      for (let s = 0; s < 5; s++) {
        const sa = (s / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), goldMat);
        spike.position.set(0.08 + Math.cos(sa) * 0.26, 0.82, Math.sin(sa) * 0.26);
        headGroup.add(spike);
      }
      headGroup.add(crownRing);
      break;
    }

    case 'villain_tophat_plume': {
      // 🪝 กัปตันฮุก / 🐍 จาฟาร์ / 🧪 อิซม่า / 🎩 ดร.ฟาซิเลียร์: หมวกทรงสูงประดับแถบและขนนกอลังการ!
      addBaseHairCap(darkMat, true);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.78, 0.06, 22), primaryMat);
      brim.position.set(0, 0.44, 0);
      const tallCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.38, 0.54, 20), primaryMat);
      tallCylinder.position.set(0, 0.72, 0);
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.405, 0.395, 0.1, 20), accentMat);
      ribbon.position.set(0, 0.52, 0);
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.62, 10), accentMat);
      plume.position.set(-0.18, 0.96, -0.28);
      plume.rotation.z = 0.55;
      plume.rotation.x = -0.35;
      headGroup.add(brim, tallCylinder, ribbon, plume);
      break;
    }

    case 'mirabel_glasses_curls': {
      // 🦋 มิราเบล / 💧 ซึมเศร้า (Sadness): ผมบ๊อบสั้นน่ารัก + แว่นตากลมโตสุดไอคอนิก!
      addBaseHairCap(primaryMat, true);
      [-0.46, 0.46].forEach((cz) => {
        const bobSide = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), primaryMat);
        bobSide.position.set(-0.04, -0.06, cz);
        headGroup.add(bobSide);
      });
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.14), accentMat);
      bridge.position.set(0.58, 0.06, 0);
      [-0.2, 0.2].forEach((gz) => {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.022, 8, 20), accentMat);
        rim.rotation.y = Math.PI / 2;
        rim.position.set(0.58, 0.05, gz);
        headGroup.add(rim);
      });
      headGroup.add(bridge);
      break;
    }

    case 'boo_twintails': {
      // 👧 น้องบู / 🍬 วาเนลโลปี้: มัดแกละสองข้างสูงผูกยางสีสดใส (+ ลูกกวาดติดผมสำหรับวาเนลโลปี้!)
      addBaseHairCap(primaryMat, true);
      [-0.52, 0.52].forEach((tz) => {
        const scrunchie = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.035, 8, 14), accentMat);
        scrunchie.rotation.x = Math.PI / 2;
        scrunchie.position.set(-0.04, 0.44, tz * 0.92);
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.44, 10), primaryMat);
        tuft.position.set(-0.06, 0.56, tz * 1.15);
        tuft.rotation.x = tz < 0 ? -0.75 : 0.75;
        headGroup.add(scrunchie, tuft);
      });
      if (breedMeta.id === 'disney_vanellope') {
        const candyColors = [0xf43f5e, 0x38bdf8, 0xfacc15, 0x4ade80];
        candyColors.forEach((cc, ci) => {
          const candy = new THREE.Mesh(
            new THREE.SphereGeometry(0.052, 8, 8),
            new THREE.MeshStandardMaterial({ color: cc, roughness: 0.3 })
          );
          candy.position.set(0.38, 0.38 - (ci % 2) * 0.12, (ci < 2 ? -1 : 1) * (0.24 + (ci % 2) * 0.14));
          headGroup.add(candy);
        });
      }
      break;
    }

    case 'incredible_mask': {
      // 🦸‍♂️ มิสเตอร์อินเครดิเบิ้ล / ⚡ เฮอร์คิวลิส / 💪 แกสตัน
      addBaseHairCap(primaryMat, false);
      const quiff = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 10), primaryMat);
      quiff.position.set(0.22, 0.62, 0.06);
      quiff.rotation.z = -0.45;
      headGroup.add(quiff);
      if (breedMeta.id === 'disney_mr_incredible') {
        const dominoMask = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.16, 0.62),
          darkMat
        );
        dominoMask.position.set(0.53, 0.08, 0);
        headGroup.add(dominoMask);
      } else if (breedMeta.id === 'disney_hercules') {
        const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.11, 22), accentMat);
        headband.position.y = 0.28;
        headGroup.add(headband);
      }
      break;
    }

    case 'pirate_dreads_tricorne': {
      // 🏴‍☠️ กัปตันแจ็ค สแปร์โรว์: ผ้าโพกหัวสีแดง + หมวกโจรสลัดสามมุม + ผมเดรดล็อกร้อยลูกปัด!
      const bandana = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
        accentMat
      );
      bandana.position.y = 0.12;
      const triHat = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.46, 0.28, 3), primaryMat);
      triHat.rotation.y = Math.PI / 6;
      triHat.position.set(0.02, 0.54, 0);
      [-0.46, -0.32, 0.32, 0.46].forEach((dz, di) => {
        const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.56, 8), primaryMat);
        dread.position.set(-0.08, -0.14, dz);
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), di % 2 === 0 ? goldMat : whiteMat);
        bead.position.set(-0.06, -0.24, dz);
        headGroup.add(dread, bead);
      });
      headGroup.add(bandana, triHat);
      break;
    }

    // =========================================================================
    // 🎌 ANIME HEAD & HAIR SCULPTS (21 Iconic Anime Styles)
    // =========================================================================
    case 'anime_spiky_shonen': {
      // 🐉 โงกุน / เบจิต้า / อิจิโกะ / คิรัวร์ / กอร์น / เร็นโกคุ / เซ็นอิตสึ / อิตาโดริ
      addBaseHairCap(primaryMat, false);
      const hasTwoToneTips = ['anime_rengoku', 'anime_zenitsu', 'anime_gon'].includes(breedMeta.id);
      const spikes: [number, number, number, number, number, number, number][] = [
        [0.04, 0.88, 0.0, 0.21, 0.8, 0.1, 0],
        [0.0, 0.78, -0.3, 0.18, 0.72, 0.16, -0.45],
        [0.0, 0.78, 0.3, 0.18, 0.72, 0.16, 0.45],
        [-0.08, 0.62, -0.5, 0.16, 0.66, 0.26, -0.82],
        [-0.08, 0.62, 0.5, 0.16, 0.66, 0.26, 0.82],
        [-0.28, 0.74, 0.0, 0.18, 0.68, 0.6, 0],
        [0.26, 0.7, -0.14, 0.14, 0.5, -0.24, -0.18],
      ];
      spikes.forEach(([sx, sy, sz, rad, h, rz, rx]) => {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 8), primaryMat);
        sp.position.set(sx, sy, sz);
        sp.rotation.set(rx, 0, rz);
        if (hasTwoToneTips) {
          const tip = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.52, h * 0.45, 8), accentMat);
          tip.position.y = h * 0.28;
          sp.add(tip);
        }
        headGroup.add(sp);
      });
      break;
    }

    case 'anime_straw_hat': {
      // 👒 ลูฟี่ หมวกฟาง: ผมดำยุ่ง + หมวกฟางปีกกว้างคาดริบบิ้นแดง + รอยแผลใต้ตาซ้าย!
      addBaseHairCap(darkMat, true);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.92, 0.055, 24), primaryMat);
      brim.position.y = 0.44;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.52, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
        primaryMat
      );
      dome.position.y = 0.44;
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.525, 0.525, 0.11, 20), accentMat);
      ribbon.position.y = 0.5;
      const scar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.12), darkMat);
      scar.position.set(0.55, -0.06, -0.2);
      headGroup.add(brim, dome, ribbon, scar);
      break;
    }

    case 'anime_headband_spiky': {
      // 🍥 นารูโตะ / ⚔️ โซโล: ผมตั้งแหลมคาดผ้าหน้าผาก (+ รอยหนวดแมว 3 ขีดข้างแก้มสำหรับนารูโตะ!)
      addBaseHairCap(primaryMat, false);
      [-0.28, 0, 0.28].forEach((sz, si) => {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.58, 8), primaryMat);
        sp.position.set(0.02, 0.72 + (si === 1 ? 0.08 : 0), sz);
        sp.rotation.x = sz * 0.65;
        headGroup.add(sp);
      });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 22), accentMat);
      band.position.y = 0.26;
      headGroup.add(band);

      if (breedMeta.id === 'anime_naruto') {
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.1, 0.34),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.78, roughness: 0.2 })
        );
        plate.position.set(0.58, 0.26, 0);
        headGroup.add(plate);
        [-1, 1].forEach((side) => {
          [-0.04, 0.01, 0.06].forEach((wy) => {
            const whisker = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.014, 0.12), darkMat);
            whisker.position.set(0.51, -0.08 + wy, side * 0.3);
            whisker.rotation.y = side * 0.35;
            headGroup.add(whisker);
          });
        });
      } else if (breedMeta.id === 'anime_zoro') {
        // ต่างหูทอง 3 ตุ้มข้างซ้ายของโซโล
        [-0.08, -0.14, -0.2].forEach((ey) => {
          const drop = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), goldMat);
          drop.position.set(0.02, ey, -0.6);
          headGroup.add(drop);
        });
      }
      break;
    }

    case 'anime_slayer_earrings': {
      // 🎴 ทันจิโร่ / ⚡ ซาสึเกะ / 👹 สุคุนะ / 🌙 เส็ตโชมารู
      addBaseHairCap(primaryMat, true);
      [-0.24, 0, 0.24].forEach((sz) => {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.48, 8), primaryMat);
        tuft.position.set(-0.06, 0.66, sz);
        tuft.rotation.z = 0.32;
        headGroup.add(tuft);
      });
      const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), accentMat);
      mark.scale.set(0.4, 1.1, 1.15);
      mark.position.set(0.54, 0.28, breedMeta.id === 'anime_tanjiro' ? -0.2 : 0);
      headGroup.add(mark);

      if (breedMeta.id === 'anime_tanjiro') {
        [-0.56, 0.56].forEach((ez) => {
          const card = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.11), whiteMat);
          card.position.set(0.02, -0.18, ez);
          const sunDot = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), accentMat);
          sunDot.position.set(0.03, -0.16, ez);
          headGroup.add(card, sunDot);
        });
      }
      break;
    }

    case 'anime_boar_mask': {
      // 🐗 อิโนะสุเกะ: หน้ากากหัวหมูป่าสีเทา จมูกชมพู เขี้ยวหมูป่าสีขาวโค้งคู่ ตาสีฟ้า!
      const boarHead = new THREE.Mesh(new THREE.SphereGeometry(0.62, 22, 20), primaryMat);
      const snout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.24, 0.24, 16),
        new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.5 })
      );
      snout.rotation.z = Math.PI / 2;
      snout.position.set(0.58, -0.06, 0);
      headGroup.add(boarHead, snout);
      [-0.24, 0.24].forEach((sideZ) => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 10), primaryMat);
        ear.position.set(0, 0.64, sideZ * 1.35);
        ear.rotation.x = sideZ < 0 ? -0.35 : 0.35;
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 8), whiteMat);
        tusk.position.set(0.56, -0.02, sideZ * 1.15);
        tusk.rotation.z = -0.35;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), accentMat);
        eye.scale.set(0.45, 0.85, 1.15);
        eye.position.set(0.54, 0.14, sideZ);
        headGroup.add(ear, tusk, eye);
      });
      break;
    }

    case 'anime_blindfold_spiky': {
      // 🤞 โกโจ ซาโตรุ: ผมขาวเงินชี้ตั้งฟู 7 แฉก + ผ้าปิดตาสีดำเท่สุดขีด!
      addBaseHairCap(primaryMat, false);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const upSpike = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.58, 8), primaryMat);
        upSpike.position.set(Math.cos(a) * 0.22, 0.72, Math.sin(a) * 0.24);
        upSpike.rotation.x = Math.sin(a) * 0.25;
        upSpike.rotation.z = -Math.cos(a) * 0.22;
        headGroup.add(upSpike);
      }
      const blindfold = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.22, 22), accentMat);
      blindfold.position.y = 0.08;
      headGroup.add(blindfold);
      break;
    }

    case 'anime_bald_shine':
    case 'bald_hero': {
      // 🥊 ไซตามะ / 💡 อิกคิวซัง: ศีรษะเกลี้ยงเงาวับสะท้อนแสงวิบวับ!
      const shineSpot = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.58 })
      );
      shineSpot.scale.set(0.5, 0.4, 1.0);
      shineSpot.position.set(0.32, 0.44, -0.2);
      headGroup.add(shineSpot);
      if (breedMeta.id === 'anime_ikkyu') {
        [-0.19, 0.19].forEach((bz) => {
          const brow = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.16), darkMat);
          brow.position.set(0.54, 0.2, bz);
          headGroup.add(brow);
        });
      }
      break;
    }

    case 'anime_sailor_odango': {
      // 🌙 เซเลอร์มูน: ผมบลอนด์มัดซาลาเปาคู่ Odango ประดับทับทิมแดง + ทวินเทลยาว + รัดเกล้าทอง!
      addBaseHairCap(primaryMat, true);
      [-0.44, 0.44].forEach((oz) => {
        const odango = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), primaryMat);
        odango.position.set(-0.02, 0.58, oz);
        const ruby = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), accentMat);
        ruby.position.set(0.14, 0.58, oz);
        const longTail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.92, 12), primaryMat);
        longTail.rotation.x = Math.PI + (oz < 0 ? 0.28 : -0.28);
        longTail.position.set(-0.08, 0.04, oz * 1.32);
        headGroup.add(odango, ruby, longTail);
      });
      const tiaraV = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.028, 8, 20, Math.PI * 0.7), goldMat);
      tiaraV.rotation.y = Math.PI / 2;
      tiaraV.position.set(0.06, 0.26, 0);
      const redGem = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), accentMat);
      redGem.position.set(0.59, 0.24, 0);
      headGroup.add(tiaraV, redGem);
      break;
    }

    case 'anime_bamboo_muzzle': {
      // 🎋 เนซึโกะ: ผมดำยาวปลายส้มผูกโบว์ชมพู + คาบกระบอกไม้ไผ่สีเขียวผูกเชือกแดง!
      addBaseHairCap(primaryMat, true);
      const backHair = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.52, 16), primaryMat);
      backHair.position.set(-0.22, -0.16, 0);
      const orangeTips = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.2, 16), accentMat);
      orangeTips.position.set(-0.22, -0.44, 0);
      const pinkRibbon = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.12, 0.22),
        new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 })
      );
      pinkRibbon.position.set(0.28, 0.48, -0.36);
      // กระบอกไม้ไผ่สีเขียวคาบที่ปาก!
      const bambooMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.38 });
      const bamboo = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.48, 14), bambooMat);
      bamboo.rotation.x = Math.PI / 2;
      bamboo.position.set(0.55, -0.16, 0);
      const redCord = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.02, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      redCord.rotation.x = Math.PI / 2;
      redCord.position.y = -0.16;
      headGroup.add(backHair, orangeTips, pinkRibbon, bamboo, redCord);
      break;
    }

    case 'anime_anya_cones': {
      // 🥜 อาเนีย ฟอร์เจอร์ (กรวยแหลมดำทองคู่) / 🩸 พาวเวอร์ (เขาสีแดงสดคู่)
      addBaseHairCap(primaryMat, true);
      [-0.46, 0.46].forEach((bz) => {
        const bobFluff = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), primaryMat);
        bobFluff.position.set(-0.04, -0.08, bz);
        headGroup.add(bobFluff);
      });
      if (breedMeta.id === 'anime_power_horns') {
        [-0.22, 0.22].forEach((hz) => {
          const redHorn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.38, 8), accentMat);
          redHorn.position.set(0.12, 0.68, hz);
          headGroup.add(redHorn);
        });
      } else {
        [-0.36, 0.36].forEach((cz) => {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 10), accentMat);
          cone.position.set(0.04, 0.62, cz);
          cone.rotation.x = cz < 0 ? -0.32 : 0.32;
          const goldTrim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 14), goldMat);
          goldTrim.rotation.x = Math.PI / 2 + (cz < 0 ? -0.32 : 0.32);
          goldTrim.position.set(0.04, 0.49, cz * 0.92);
          headGroup.add(cone, goldTrim);
        });
      }
      break;
    }

    case 'anime_elf_twintails': {
      // 🪄 ฟรีเรน (หูเอลฟ์ยาวแหลม + ทวินเทลขาว) / 🎤 มิกุ (หูฟังไฮเทค + ทวินเทลฟ้าเทอร์ควอยซ์ยาว)
      addBaseHairCap(primaryMat, true);
      [-0.58, 0.58].forEach((tz) => {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), accentMat);
        tie.position.set(-0.06, 0.38, tz);
        const longTail = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.95, 12), primaryMat);
        longTail.rotation.x = Math.PI + (tz < 0 ? 0.35 : -0.35);
        longTail.position.set(-0.1, -0.08, tz * 1.22);
        headGroup.add(tie, longTail);
      });
      if (breedMeta.id === 'anime_frieren') {
        [-1, 1].forEach((side) => {
          const elfEar = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.52, 10), skinMat);
          elfEar.position.set(-0.04, 0.08, side * 0.68);
          elfEar.rotation.x = side * 1.18;
          elfEar.rotation.z = 0.22;
          const redDrop = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xef4444 })
          );
          redDrop.position.set(-0.04, -0.14, side * 0.68);
          headGroup.add(elfEar, redDrop);
        });
      } else {
        [-0.6, 0.6].forEach((hz) => {
          const headset = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 14), darkMat);
          headset.rotation.x = Math.PI / 2;
          headset.position.set(0.02, 0.04, hz);
          headGroup.add(headset);
        });
      }
      break;
    }

    case 'anime_maid_bob': {
      // 💙 เรม / 🧣 มิคาสะ / 💜 ฮินาตะ / 🦋 เฟิร์น & ชิโนบุ
      addBaseHairCap(primaryMat, true);
      [-0.46, 0.46].forEach((bz) => {
        const sideLock = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), primaryMat);
        sideLock.scale.set(0.9, 1.2, 0.85);
        sideLock.position.set(-0.04, -0.1, bz);
        headGroup.add(sideLock);
      });
      if (breedMeta.id === 'anime_rem') {
        const maidFrill = new THREE.Mesh(
          new THREE.TorusGeometry(0.59, 0.055, 8, 22, Math.PI * 1.1),
          whiteMat
        );
        maidFrill.rotation.y = Math.PI / 2;
        maidFrill.position.set(0.04, 0.08, 0);
        headGroup.add(maidFrill);
      } else if (breedMeta.id === 'anime_mikasa') {
        const redScarf = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.14, 10, 22), accentMat);
        redScarf.rotation.x = Math.PI / 2;
        redScarf.position.y = -0.48;
        headGroup.add(redScarf);
      } else if (breedMeta.id === 'anime_shinobu' || breedMeta.id === 'anime_fern') {
        const butterfly = makeRibbonBow(accentMat, 1.15);
        butterfly.position.set(-0.28, 0.56, 0.28);
        headGroup.add(butterfly);
      }
      break;
    }

    case 'anime_doraemon_bell': {
      // 🔔 โดราเอมอน: หัวกลมสีฟ้า หน้าขาว จมูกกลมสีแดงสด หนวด 6 เส้น ปลอกคอแดงกระดิ่งทอง!
      const blueDome = new THREE.Mesh(new THREE.SphereGeometry(0.595, 24, 20), primaryMat);
      const whiteFace = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 18), whiteMat);
      whiteFace.position.set(0.14, -0.06, 0);
      const redNose = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 })
      );
      redNose.position.set(0.64, 0.12, 0);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.065, 10, 24), accentMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = -0.48;
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), goldMat);
      bell.position.set(0.52, -0.5, 0);
      headGroup.add(blueDome, whiteFace, redNose, collar, bell);
      [-1, 1].forEach((side) => {
        [-0.08, 0, 0.08].forEach((wy) => {
          const whisker = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.24), darkMat);
          whisker.position.set(0.56, -0.04 + wy, side * 0.34);
          whisker.rotation.x = wy * side * 1.4;
          headGroup.add(whisker);
        });
      });
      break;
    }

    case 'anime_shinchan_brows': {
      // 🖍️ ชินจัง จอมแก่น: ผมดำตัดเกรียน + คิ้วดำหนาสองเส้นโค้งกวนโอ๊ยเหนือตา!
      const buzzCut = new THREE.Mesh(
        new THREE.SphereGeometry(0.59, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
        primaryMat
      );
      buzzCut.rotation.z = 0.25;
      headGroup.add(buzzCut);
      [-0.2, 0.2].forEach((bz) => {
        const thickBrow = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.16, 8, 10), darkMat);
        thickBrow.rotation.x = Math.PI / 2;
        thickBrow.rotation.z = bz < 0 ? 0.18 : -0.18;
        thickBrow.position.set(0.54, 0.25, bz);
        headGroup.add(thickBrow);
      });
      break;
    }

    case 'anime_glasses_detective': {
      // 🕵️ โคนัน (หูกระต่ายแดง) / 👓 โนบิตะ / 🪽 อาราเล่ (หมวกแก๊ปชมพูติดปีกขาว!)
      addBaseHairCap(primaryMat, true);
      const frameMat = breedMeta.id === 'anime_arale' ? darkMat : darkMat;
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.14), frameMat);
      bridge.position.set(0.58, 0.06, 0);
      [-0.2, 0.2].forEach((gz) => {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.024, 8, 20), frameMat);
        rim.rotation.y = Math.PI / 2;
        rim.position.set(0.58, 0.05, gz);
        headGroup.add(rim);
      });
      headGroup.add(bridge);

      if (breedMeta.id === 'anime_conan') {
        const cowlick = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 8), primaryMat);
        cowlick.position.set(-0.22, 0.68, 0);
        cowlick.rotation.z = 0.55;
        const bowTie = makeRibbonBow(accentMat, 0.85);
        bowTie.position.set(0.46, -0.5, 0);
        headGroup.add(cowlick, bowTie);
      } else if (breedMeta.id === 'anime_arale') {
        const capDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.61, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
          accentMat
        );
        capDome.position.y = 0.14;
        const visor = new THREE.Mesh(
          new THREE.CylinderGeometry(0.46, 0.46, 0.05, 16, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
          accentMat
        );
        visor.rotation.y = Math.PI / 2;
        visor.position.set(0.32, 0.22, 0);
        [-1, 1].forEach((side) => {
          const wing = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 8), whiteMat);
          wing.scale.set(1.1, 1, 0.35);
          wing.position.set(0, 0.44, side * 0.62);
          wing.rotation.z = 0.55;
          wing.rotation.x = side * 0.35;
          headGroup.add(wing);
        });
        headGroup.add(capDome, visor);
      }
      break;
    }

    case 'anime_pikachu_ears': {
      // ⚡ ปิกาจู (หูยาวปลายดำ + แก้มแดง) / 🐾 อินุยาฉะ (ผมเงินยาว + หูสุนัขขาว)
      if (breedMeta.id === 'anime_inuyasha') {
        addBaseHairCap(primaryMat, true);
        const longSilver = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 0.58, 16), primaryMat);
        longSilver.position.set(-0.22, -0.18, 0);
        [-0.32, 0.32].forEach((ez) => {
          const dogEar = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.46, 10), whiteMat);
          dogEar.position.set(0.04, 0.64, ez);
          dogEar.rotation.x = ez < 0 ? -0.28 : 0.28;
          headGroup.add(dogEar);
        });
        headGroup.add(longSilver);
      } else {
        const noseDot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), darkMat);
        noseDot.position.set(0.58, 0.0, 0);
        headGroup.add(noseDot);
        [-0.34, 0.34].forEach((ez) => {
          const earGrp = new THREE.Group();
          const earBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 8, 12), primaryMat);
          const blackTip = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.26, 10), darkMat);
          blackTip.position.y = 0.32;
          earGrp.add(earBase, blackTip);
          earGrp.position.set(-0.02, 0.72, ez);
          earGrp.rotation.x = ez < 0 ? -0.35 : 0.35;
          const redCheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), accentMat);
          redCheek.scale.set(0.45, 0.95, 1.05);
          redCheek.position.set(0.49, -0.1, ez * 1.05);
          headGroup.add(earGrp, redCheek);
        });
      }
      break;
    }

    case 'anime_chopper_hat': {
      // 🌸 โทนี่ โทนี่ ช็อปเปอร์: จมูกสีฟ้า + หมวกทรงสูงสีชมพูลายกากบาทขาว X + เขากวางคู่!
      const blueNose = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), accentMat);
      blueNose.position.set(0.59, -0.02, 0);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.78, 0.08, 24), primaryMat);
      brim.position.y = 0.42;
      const topCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.5, 0.54, 22), primaryMat);
      topCyl.position.y = 0.7;
      // ลายกากบาทขาว X ด้านหน้าหมวกช็อปเปอร์!
      [-0.78, 0.78].forEach((rotX) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.08), whiteMat);
        bar.position.set(0.51, 0.7, 0);
        bar.rotation.x = rotX;
        headGroup.add(bar);
      });
      const antlerMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });
      [-0.68, 0.68].forEach((az) => {
        const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.42, 8), antlerMat);
        antler.position.set(0, 0.64, az);
        antler.rotation.x = az < 0 ? -1.05 : 1.05;
        const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.22, 8), antlerMat);
        prong.position.set(0.08, 0.76, az * 1.1);
        headGroup.add(antler, prong);
      });
      headGroup.add(blueNose, brim, topCyl);
      break;
    }

    case 'anime_ninja_mask_silver': {
      // 📖 คาคาชิ (ผมเงินปัดเฉียง + หน้ากากกรมท่า) / ⚔️ รีไวล์ (ผมดำแสกกลางอันเดอร์คัท + ผ้าพันคอขาว)
      addBaseHairCap(primaryMat, true);
      if (breedMeta.id === 'anime_kakashi') {
        [-0.15, 0.05, 0.22].forEach((sz, si) => {
          const sweep = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.58, 8), primaryMat);
          sweep.position.set(-0.08, 0.72 + si * 0.04, sz - 0.14);
          sweep.rotation.x = -0.42;
          sweep.rotation.z = 0.22;
          headGroup.add(sweep);
        });
        const lowerMask = new THREE.Mesh(
          new THREE.SphereGeometry(0.595, 20, 14, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52),
          accentMat
        );
        const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.605, 0.605, 0.12, 20), accentMat);
        headband.position.y = 0.24;
        headband.rotation.x = -0.18;
        headGroup.add(lowerMask, headband);
      } else {
        const cravat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.28), whiteMat);
        cravat.position.set(0.38, -0.5, 0);
        headGroup.add(cravat);
      }
      break;
    }

    case 'anime_chainsaw_head': {
      // 🪚 เดนจิ มนุษย์เลื่อยยนต์: หัวเกราะสีส้มดุดัน + ใบเลื่อยเหล็กยาวฟันใบเลื่อยกลางหน้าผาก!
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 18), primaryMat);
      const metalMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.78, roughness: 0.22 });
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.07), metalMat);
      blade.position.set(0.68, 0.26, 0);
      blade.rotation.z = -0.14;
      for (let t = 0; t < 6; t++) {
        const toothTop = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 4), whiteMat);
        toothTop.position.set(-0.34 + t * 0.14, 0.15, 0);
        const toothBot = toothTop.clone();
        toothBot.rotation.x = Math.PI;
        toothBot.position.y = -0.15;
        blade.add(toothTop, toothBot);
      }
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 14, Math.PI), darkMat);
      handle.position.set(-0.18, 0.62, 0);
      [-0.2, 0.2].forEach((ez) => {
        const visorEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.18), accentMat);
        visorEye.position.set(0.56, 0.08, ez);
        headGroup.add(visorEye);
      });
      headGroup.add(helm, blade, handle);
      break;
    }

    case 'anime_korosensei_smile': {
      // 🟡 อาจารย์โคโระ / 🟣 ฟรีเซอร์ / ⭐ สิบโทเคโรโระ / 🍬 จอมมารบู
      if (breedMeta.id === 'anime_korosensei') {
        const mortarBoard = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.92), primaryMat);
        mortarBoard.position.y = 0.62;
        const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.18, 16), primaryMat);
        capBase.position.y = 0.52;
        const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.34, 6), goldMat);
        tassel.position.set(0.28, 0.46, 0.42);
        const wideSmile = new THREE.Mesh(
          new THREE.CylinderGeometry(0.59, 0.59, 0.18, 20, 1, false, -Math.PI * 0.36, Math.PI * 0.72),
          whiteMat
        );
        wideSmile.rotation.y = Math.PI / 2;
        wideSmile.position.y = -0.14;
        headGroup.add(mortarBoard, capBase, tassel, wideSmile);
      } else if (breedMeta.id === 'anime_frieza') {
        const purpleGemDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 18, 14),
          new THREE.MeshStandardMaterial({ color: primaryHex, metalness: 0.45, roughness: 0.18 })
        );
        purpleGemDome.scale.set(1.05, 0.68, 1.0);
        purpleGemDome.position.set(0.04, 0.44, 0);
        [-0.56, 0.56].forEach((ez) => {
          const earCup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 14), whiteMat);
          earCup.rotation.x = Math.PI / 2;
          earCup.position.set(0, 0.04, ez);
          headGroup.add(earCup);
        });
        headGroup.add(purpleGemDome);
      } else if (breedMeta.id === 'anime_keroro') {
        const pilotCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.61, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.54),
          primaryMat
        );
        [-0.54, 0.54].forEach((fz) => {
          const flap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.1), primaryMat);
          flap.position.set(0.12, -0.12, fz);
          headGroup.add(flap);
        });
        const redStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), accentMat);
        redStar.position.set(0.6, 0.32, 0);
        headGroup.add(pilotCap, redStar);
      } else {
        // จอมมารบูอ้วน: หงอนเสาอากาศชมพูโค้งพับด้านบนหัว!
        const antStem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 0.44, 10), primaryMat);
        antStem.position.set(-0.04, 0.72, 0);
        antStem.rotation.z = 0.32;
        const antTip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.36, 10), primaryMat);
        antTip.position.set(-0.24, 0.88, 0);
        antTip.rotation.z = 1.45;
        headGroup.add(antStem, antTip);
      }
      break;
    }

    case 'anime_jotaro_cap': {
      // ⭐ โจทาโร่ / 🔴 ซาโตชิ: หมวกแก๊ปทรงเท่พร้อมปีกหมวกและตราสัญลักษณ์ด้านหน้า!
      addBaseHairCap(darkMat, true);
      const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.59, 0.32, 22), primaryMat);
      capCrown.position.y = 0.38;
      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.48, 0.055, 18, 1, false, -Math.PI * 0.4, Math.PI * 0.8),
        breedMeta.id === 'anime_jotaro' ? primaryMat : primaryMat
      );
      visor.rotation.y = Math.PI / 2;
      visor.position.set(0.34, 0.24, 0);
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.18), accentMat);
      badge.position.set(0.58, 0.38, 0);
      headGroup.add(capCrown, visor, badge);
      break;
    }

    case 'monster_thai_ghost': {
      // 🕯️ ผีไทย: กระสือ / นางตานี / แม่นาค / ยักษ์วัดแจ้ง / กุมารทอง / เปรต
      if (breedMeta.id === 'monster_yak_wat_jaeng') {
        // ชฎาทองคำ + เขี้ยวยักษ์คู่
        const chadaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 0.28, 16), goldMat);
        chadaBase.position.y = 0.45;
        const chadaSpire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.82, 12), goldMat);
        chadaSpire.position.y = 0.96;
        const ruby = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), accentMat);
        ruby.position.set(0.5, 0.48, 0);
        headGroup.add(chadaBase, chadaSpire, ruby);
        [-0.18, 0.18].forEach((fz) => {
          const fang = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.19, 8), whiteMat);
          fang.position.set(0.54, -0.14, fz);
          headGroup.add(fang);
        });
      } else if (breedMeta.id === 'monster_kumanthong') {
        // ผมจุกพวงมาลัยทอง
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), darkMat);
        bun.position.y = 0.68;
        const garland = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 8, 18), goldMat);
        garland.rotation.x = Math.PI / 2;
        garland.position.y = 0.58;
        headGroup.add(bun, garland);
      } else {
        // ผมยาวสลวย + ดวงไฟวิญญาณลอยรอบหัว (กระสือ/นางตานี/แม่นาค/เปรต)
        if (breedMeta.id !== 'monster_pret_chibi') {
          addBaseHairCap(primaryMat, true);
          [-0.46, 0.46].forEach((sz) => {
            const sideHair = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.78, 10), primaryMat);
            sideHair.position.set(-0.08, -0.06, sz);
            headGroup.add(sideHair);
          });
        }
        const glowMat = new THREE.MeshBasicMaterial({
          color: accentMat.color,
          transparent: true,
          opacity: 0.85,
        });
        [
          [0.12, 0.72, -0.58],
          [-0.18, 0.58, 0.62],
          [-0.55, 0.78, 0.05],
        ].forEach(([ox, oy, oz]) => {
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), glowMat);
          orb.position.set(ox, oy, oz);
          headGroup.add(orb);
        });
      }
      break;
    }

    case 'monster_sheet_ghost': {
      // 👻 ผีผ้าห่ม / 💀 โครงกระดูก
      hideStandardEyes = true;
      hideStandardMouth = true;
      if (breedMeta.id === 'monster_skeleton') {
        [-0.22, 0.22].forEach((ez) => {
          const socket = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), darkMat);
          socket.scale.set(0.4, 1.05, 1.0);
          socket.position.set(0.55, 0.06, ez);
          headGroup.add(socket);
        });
        const noseHole = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.1, 6), darkMat);
        noseHole.rotation.z = -Math.PI / 2;
        noseHole.position.set(0.58, -0.08, 0);
        const teethBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.36), darkMat);
        teethBar.position.set(0.55, -0.22, 0);
        headGroup.add(noseHole, teethBar);
      } else {
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.66, 20, 16), whiteMat);
        hood.scale.set(1.02, 1.12, 1.02);
        hood.position.y = 0.06;
        headGroup.add(hood);
        [-0.2, 0.2].forEach((ez) => {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), darkMat);
          eye.scale.set(0.45, 1.35, 0.95);
          eye.position.set(0.64, 0.1, ez);
          headGroup.add(eye);
        });
        const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), darkMat);
        mouth.scale.set(0.4, 1.2, 0.85);
        mouth.position.set(0.64, -0.14, 0);
        headGroup.add(mouth);
      }
      break;
    }

    case 'monster_jiangshi': {
      // 📜 เจียงซือผีดิบจีน: หมวกขุนนางราชวงศ์ชิง + แผ่นยันต์สีเหลืองแปะหน้าผาก!
      const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.76, 0.07, 22), primaryMat);
      hatBrim.position.y = 0.42;
      const hatDome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), primaryMat);
      hatDome.position.y = 0.44;
      const redBead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
      redBead.position.y = 0.96;
      const talisman = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.54, 0.24),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.65 })
      );
      talisman.position.set(0.64, 0.12, 0);
      talisman.rotation.z = -0.14;
      const runeInk = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.36, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      runeInk.position.set(0.65, 0.12, 0);
      runeInk.rotation.z = -0.14;
      headGroup.add(hatBrim, hatDome, redBead, talisman, runeInk);
      break;
    }

    case 'monster_mummy': {
      // 🧻 มัมมี่พันผ้าก๊อซ + ตาสีอำพันเรืองแสง
      hideStandardEyes = true;
      const bandageMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.78 });
      [-0.22, -0.02, 0.2, 0.4].forEach((by, bi) => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.58 - Math.abs(by) * 0.35, 0.075, 8, 22), bandageMat);
        band.rotation.x = Math.PI / 2 + (bi % 2 === 0 ? 0.14 : -0.14);
        band.position.y = by;
        headGroup.add(band);
      });
      const eyeGlow = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      [-0.2, 0.2].forEach((ez) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), eyeGlow);
        eye.position.set(0.57, 0.08, ez);
        headGroup.add(eye);
      });
      break;
    }

    case 'monster_pumpkin': {
      // 🎃 แจ็คหัวฟักทองฮาโลวีน + ตาไฟเรืองแสง + ขั้วเขียว
      hideStandardEyes = true;
      hideStandardMouth = true;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.14, 0.34, 8),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 })
      );
      stem.position.set(0, 0.68, 0);
      stem.rotation.z = -0.22;
      const fireGlow = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      [-0.22, 0.22].forEach((ez) => {
        const triEye = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 3), fireGlow);
        triEye.rotation.y = Math.PI / 2;
        triEye.position.set(0.56, 0.12, ez);
        headGroup.add(triEye);
      });
      const grin = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 8, 14, Math.PI), fireGlow);
      grin.rotation.y = Math.PI / 2;
      grin.rotation.z = Math.PI;
      grin.position.set(0.54, -0.1, 0);
      headGroup.add(stem, grin);
      break;
    }

    case 'monster_vampire': {
      // 🧛 แวมไพร์ / 📓 ชินิกามิ: ผมแสกแหลม + เขี้ยวขาวคู่ + ปกคอตั้ง
      addBaseHairCap(primaryMat, false);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.24, 4), primaryMat);
      peak.rotation.z = Math.PI;
      peak.position.set(0.54, 0.26, 0);
      headGroup.add(peak);
      [-0.14, 0.14].forEach((fz) => {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 6), whiteMat);
        fang.rotation.z = Math.PI;
        fang.position.set(0.58, -0.18, fz);
        headGroup.add(fang);
      });
      const highCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.52, 0.45, 14, 1, true, Math.PI * 0.45, Math.PI * 1.1),
        accentMat
      );
      highCollar.position.set(-0.08, -0.28, 0);
      headGroup.add(highCollar);
      break;
    }

    case 'monster_frankenstein': {
      // 🔩 แฟรงเกนสไตน์ / 🧟 ซอมบี้: ผมเรียบบนหัว + น็อตเหล็กคู่ข้างขมับ
      const flatHair = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.24, 1.08), primaryMat);
      flatHair.position.y = 0.52;
      headGroup.add(flatHair);
      const boltMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.78, roughness: 0.25 });
      [-0.64, 0.64].forEach((bz) => {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.26, 10), boltMat);
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(0, -0.05, bz);
        headGroup.add(bolt);
      });
      break;
    }

    case 'monster_kaiju_spikes': {
      // 🦖 ก็อตซิลล่า / 🐙 คราเคน / 💧 สไลม์ปีศาจ / 🦍 คิงคอง
      if (breedMeta.id === 'monster_demon_slime') {
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.22, 8), goldMat);
        crown.position.y = 0.62;
        headGroup.add(crown);
      } else if (breedMeta.id === 'monster_kraken') {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          const tent = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 8), accentMat);
          tent.position.set(Math.cos(a) * 0.42, 0.55, Math.sin(a) * 0.42);
          tent.rotation.z = -Math.cos(a) * 0.45;
          tent.rotation.x = Math.sin(a) * 0.45;
          headGroup.add(tent);
        }
      } else {
        for (let s = 0; s < 4; s++) {
          const fin = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 0.34, 5),
            breedMeta.id === 'monster_godzilla'
              ? new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
              : accentMat
          );
          fin.position.set(0.25 - s * 0.24, 0.62 - s * 0.14, 0);
          fin.rotation.z = 0.35 + s * 0.22;
          headGroup.add(fin);
        }
      }
      break;
    }

    case 'monster_alien_eyes': {
      // 👽 เอเลี่ยน 3 ตา / 👁️ ไซคลอปส์ตาเดียว
      hideStandardEyes = true;
      if (breedMeta.id === 'monster_cyclops') {
        const bigWhite = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), whiteMat);
        bigWhite.scale.set(0.55, 1, 1);
        bigWhite.position.set(0.55, 0.08, 0);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), darkMat);
        pupil.position.set(0.67, 0.08, 0);
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 8), goldMat);
        horn.position.set(0.1, 0.68, 0);
        headGroup.add(bigWhite, pupil, horn);
      } else {
        [-0.24, 0, 0.24].forEach((ez, ei) => {
          const ew = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), whiteMat);
          ew.position.set(0.56, ei === 1 ? 0.2 : 0.04, ez);
          const ep = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), darkMat);
          ep.position.set(0.65, ei === 1 ? 0.2 : 0.04, ez);
          headGroup.add(ew, ep);
        });
        [-0.24, 0.24].forEach((az) => {
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.42, 8), primaryMat);
          stalk.position.set(0, 0.66, az);
          stalk.rotation.x = az < 0 ? -0.3 : 0.3;
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), accentMat);
          bulb.position.set(0, 0.88, az * 1.45);
          headGroup.add(stalk, bulb);
        });
      }
      break;
    }

    case 'monster_yokai': {
      // 👹 โอนิ / 🥒 คัปปะ / 👺 เท็งงุ / ☂️ ผีร่ม / 🦊 จิ้งจอกเก้าหาง / 🎭 ผีไร้หน้า / 👺 กอบลิน
      if (breedMeta.id === 'monster_kappa') {
        const dishRim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 20), primaryMat);
        dishRim.rotation.x = Math.PI / 2;
        dishRim.position.y = 0.56;
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.34, 0.05, 18),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        water.position.y = 0.55;
        headGroup.add(dishRim, water);
      } else if (breedMeta.id === 'monster_no_face') {
        hideStandardEyes = true;
        hideStandardMouth = true;
        const mask = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 14), whiteMat);
        mask.scale.set(0.35, 1.15, 0.88);
        mask.position.set(0.48, 0.04, 0);
        headGroup.add(mask);
        [-0.16, 0.16].forEach((ez) => {
          const slit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.14), darkMat);
          slit.position.set(0.64, 0.14, ez);
          const mark = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.05), accentMat);
          mark.position.set(0.64, -0.02, ez);
          headGroup.add(slit, mark);
        });
      } else if (breedMeta.id === 'monster_tengu') {
        const longNose = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.52, 10), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
        longNose.rotation.z = Math.PI / 2;
        longNose.position.set(0.82, 0.02, 0);
        const tokin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.22, 8), darkMat);
        tokin.position.set(0.12, 0.64, 0);
        headGroup.add(longNose, tokin);
      } else if (breedMeta.id === 'monster_kasa_obake') {
        hideStandardEyes = true;
        const umbrella = new THREE.Mesh(new THREE.ConeGeometry(0.86, 0.42, 14), primaryMat);
        umbrella.position.y = 0.62;
        const bigEye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), whiteMat);
        bigEye.position.set(0.56, 0.1, 0);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), darkMat);
        pupil.position.set(0.69, 0.1, 0);
        headGroup.add(umbrella, bigEye, pupil);
      } else if (breedMeta.id === 'monster_kitsune_9' || breedMeta.id === 'monster_goblin') {
        [-0.36, 0.36].forEach((ez) => {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.44, 8), primaryMat);
          ear.position.set(0.05, breedMeta.id === 'monster_goblin' ? 0.18 : 0.62, ez * (breedMeta.id === 'monster_goblin' ? 1.65 : 1.0));
          ear.rotation.x = ez < 0 ? (breedMeta.id === 'monster_goblin' ? -1.15 : -0.22) : (breedMeta.id === 'monster_goblin' ? 1.15 : 0.22);
          headGroup.add(ear);
        });
      } else {
        // 👹 โอนิยักษ์แดงเขาทองคู่
        [-0.24, 0.24].forEach((hz) => {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 8), goldMat);
          horn.position.set(0.12, 0.68, hz);
          horn.rotation.x = hz < 0 ? -0.25 : 0.25;
          headGroup.add(horn);
        });
      }
      break;
    }

    case 'job_knight_helm': {
      // 🛡️ พาลาดิน / 🪓 เบอร์เซิร์กเกอร์ / 🐉 อัศวินมังกร: หมวกเกราะอัศวินพร้อมพู่หรือเขา!
      const helmDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
        primaryMat
      );
      helmDome.position.y = 0.08;
      const visorBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.88), accentMat);
      visorBar.position.set(0.56, 0.26, 0);
      headGroup.add(helmDome, visorBar);
      if (breedMeta.id === 'job_paladin') {
        // พู่ขนนกบนยอดหมวก
        const plume = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), accentMat);
        plume.scale.set(1.6, 0.85, 0.45);
        plume.position.set(-0.08, 0.78, 0);
        headGroup.add(plume);
      } else {
        // เขาคู่สุดแกร่ง (เบอร์เซิร์กเกอร์/อัศวินมังกร)
        [-0.42, 0.42].forEach((hz) => {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.46, 8), accentMat);
          horn.position.set(0.05, 0.66, hz);
          horn.rotation.x = hz < 0 ? -0.45 : 0.45;
          headGroup.add(horn);
        });
      }
      break;
    }

    case 'job_samurai_kabuto': {
      // ⚔️ ซามูไร: หมวกเกราะคาบูโตะสีดำ + พระจันทร์เสี้ยวทองคำ Maedate!
      const kabuto = new THREE.Mesh(
        new THREE.SphereGeometry(0.66, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
        darkMat
      );
      kabuto.position.y = 0.1;
      const neckGuard = new THREE.Mesh(
        new THREE.CylinderGeometry(0.64, 0.74, 0.26, 16, 1, true, Math.PI * 0.35, Math.PI * 1.3),
        darkMat
      );
      neckGuard.position.y = 0.02;
      const crescent = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.055, 8, 18, Math.PI * 1.25),
        goldMat
      );
      crescent.rotation.y = Math.PI / 2;
      crescent.rotation.z = -Math.PI * 0.12;
      crescent.position.set(0.56, 0.66, 0);
      headGroup.add(kabuto, neckGuard, crescent);
      break;
    }

    case 'job_wizard_hat': {
      // 🧙 จอมเวท / 💀 เนโครแมนเซอร์ / 🌿 ดรูอิด: หมวกจอมเวททรงแหลมปีกกว้าง + แถบดาว/คริสตัล!
      addBaseHairCap(darkMat, true);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.98, 0.07, 24), primaryMat);
      brim.position.y = 0.42;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.15, 18), primaryMat);
      cone.position.set(-0.08, 0.98, 0);
      cone.rotation.z = 0.2;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.55, 0.12, 18), accentMat);
      band.position.y = 0.5;
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), accentMat);
      star.position.set(0.52, 0.54, 0);
      headGroup.add(brim, cone, band, star);
      break;
    }

    case 'job_priest_mitre': {
      // ✨ นักบวช / 🥊 มองค์ / ⭐ ไอดอลซุปตาร์
      if (breedMeta.id === 'job_monk') {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.065, 8, 22), accentMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.3;
        headGroup.add(band);
      } else if (breedMeta.id === 'job_superstar') {
        addBaseHairCap(primaryMat, true);
        const starCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), goldMat);
        starCrown.position.set(0.18, 0.72, 0);
        headGroup.add(starCrown);
      } else {
        // หมวกบิชอปขาวทอง + วงแหวนแสง
        const mitre = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.72, 6), whiteMat);
        mitre.position.y = 0.76;
        const trim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 8, 20), goldMat);
        trim.rotation.x = Math.PI / 2;
        trim.position.y = 0.44;
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.36, 0.04, 8, 22),
          new THREE.MeshBasicMaterial({ color: 0xfef08a })
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 1.2;
        headGroup.add(mitre, trim, halo);
      }
      break;
    }

    case 'job_assassin_hood': {
      // 🥷 นินจาแอสซาซิน / 🦇 นักล่าอสูร / 🎭 จอมโจรแฟนทอม
      const hood = new THREE.Mesh(
        new THREE.SphereGeometry(0.67, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.68),
        primaryMat
      );
      hood.position.y = 0.08;
      headGroup.add(hood);
      if (breedMeta.id === 'job_phantom') {
        const halfMask = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.72), whiteMat);
        halfMask.position.set(0.56, 0.1, 0);
        headGroup.add(halfMask);
      } else {
        hideStandardMouth = true;
        const faceMask = new THREE.Mesh(
          new THREE.CylinderGeometry(0.58, 0.56, 0.34, 18, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
          primaryMat
        );
        faceMask.rotation.y = Math.PI / 2;
        faceMask.position.set(0.06, -0.18, 0);
        const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.18), accentMat);
        scarfTail.position.set(-0.62, -0.12, 0);
        scarfTail.rotation.z = 0.28;
        headGroup.add(faceMask, scarfTail);
      }
      break;
    }

    case 'job_cowboy_ranger': {
      // 🤠 คาวบอย / 🏹 เรนเจอร์ / 🎵 กวี / 🏴‍☠️ กัปตันโจรสลัด
      addBaseHairCap(darkMat, true);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.94, 0.065, 22), primaryMat);
      brim.scale.set(1.06, 1, 0.88);
      brim.position.y = 0.42;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.38, 18), primaryMat);
      crown.position.y = 0.62;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.55, 0.09, 18), accentMat);
      band.position.y = 0.48;
      headGroup.add(brim, crown, band);
      if (breedMeta.id === 'job_gunslinger') {
        const sheriffStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), goldMat);
        sheriffStar.position.set(0.54, 0.62, 0);
        headGroup.add(sheriffStar);
      } else {
        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.56, 6), accentMat);
        feather.position.set(0.05, 0.86, 0.48);
        feather.rotation.x = 0.48;
        headGroup.add(feather);
      }
      break;
    }

    case 'job_mechanic_goggles': {
      // 🔧 วิศวกร / 🔨 ช่างตีเหล็ก / 🧪 แปรธาตุ / 🕶️ ไซเบอร์พังก์ / 💰 พ่อค้า
      addBaseHairCap(primaryMat, true);
      if (breedMeta.id === 'job_cyberpunk') {
        hideStandardEyes = true;
        const cyberVisor = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.22, 0.88),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        cyberVisor.position.set(0.56, 0.1, 0);
        headGroup.add(cyberVisor);
      } else {
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.045, 8, 22), darkMat);
        strap.rotation.x = Math.PI / 2;
        strap.position.y = 0.34;
        headGroup.add(strap);
        [-0.22, 0.22].forEach((gz) => {
          const lensRim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14), goldMat);
          lensRim.rotation.z = Math.PI / 2;
          lensRim.position.set(0.56, 0.36, gz);
          const glass = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
          );
          glass.rotation.z = Math.PI / 2;
          glass.position.set(0.57, 0.36, gz);
          headGroup.add(lensRim, glass);
        });
      }
      break;
    }

    case 'job_astronaut_chef': {
      // 🧑‍🚀 นักบินอวกาศ (โดมกระจกใส + บังแดดทอง) / 👨‍🍳 เชฟกิลด์ (หมวกเชฟทรงสูง)
      if (breedMeta.id === 'job_astronaut') {
        const helmet = new THREE.Mesh(
          new THREE.SphereGeometry(0.76, 22, 18),
          new THREE.MeshPhysicalMaterial({
            color: 0xe0f2fe,
            transparent: true,
            opacity: 0.35,
            roughness: 0.08,
            clearcoat: 1.0,
          })
        );
        helmet.position.y = 0.06;
        const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.075, 10, 22), whiteMat);
        collarRing.rotation.x = Math.PI / 2;
        collarRing.position.y = -0.42;
        const goldVisor = new THREE.Mesh(
          new THREE.SphereGeometry(0.68, 18, 12, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.28, Math.PI * 0.32),
          goldMat
        );
        goldVisor.position.y = 0.08;
        headGroup.add(helmet, collarRing, goldVisor);
      } else {
        const chefBand = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.55, 0.28, 18), whiteMat);
        chefBand.position.y = 0.52;
        const chefPuff = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 14), whiteMat);
        chefPuff.scale.set(1.02, 0.72, 1.02);
        chefPuff.position.y = 0.88;
        headGroup.add(chefBand, chefPuff);
      }
      break;
    }
  }

  return { hideStandardEyes, hideStandardMouth };
}

/**
 * ย้อมสีพรอพ 3D (หมวก แว่น ของถือ กระเป๋า ออร่า สัตว์เลี้ยง สัตว์ขี่) ด้วยเฉดสีที่ผู้เล่นเลือก
 * โดยโคลน Material แยกเฉพาะของพรอพชิ้นนั้น ไม่ให้สีรั่วไปที่ดวงตาสีดำหรือผิวกายตัวละคร
 */
export function applyCustomDyeToGroup(
  root: THREE.Object3D,
  customHex?: string,
  itemBaseHex?: number
) {
  if (!customHex || !/^#[0-9A-Fa-f]{6}$/.test(customHex)) return;

  const targetColor = new THREE.Color(customHex);
  const targetHSL = { h: 0, s: 0, l: 0 };
  targetColor.getHSL(targetHSL);

  const baseColor =
    itemBaseHex !== undefined && itemBaseHex > 0 ? new THREE.Color(itemBaseHex) : null;
  const baseHSL = { h: 0, s: 0, l: 0 };
  if (baseColor) baseColor.getHSL(baseHSL);

  const baseIsWhite = baseColor ? baseHSL.l > 0.86 && baseHSL.s < 0.24 : false;
  const baseIsDark = baseColor ? baseHSL.l < 0.18 : false;

  const clonedMap = new Map<THREE.Material, THREE.Material>();

  const dyeOneMaterial = (mat: THREE.Material): THREE.Material => {
    const cached = clonedMap.get(mat);
    if (cached) return cached;

    const anyMat = mat as THREE.MeshStandardMaterial & {
      color?: THREE.Color;
      emissive?: THREE.Color;
    };
    if (!anyMat.color) return mat;

    const orig = anyMat.color;
    const origHSL = { h: 0, s: 0, l: 0 };
    orig.getHSL(origHSL);

    // 1. รักษาสีดวงตา รูม่านตา ด้ามจับสีดำสนิท (ยกเว้นตัวไอเทมมีสีพื้นเป็นสีดำ เช่น แว่นกันแดดดำ)
    if (origHSL.l < 0.14 && !baseIsDark) {
      return mat;
    }

    // 2. รักษาแก้มชมพูโปร่งแสงน่ารักบนสัตว์ขี่
    if (mat.transparent && mat.opacity < 0.72 && orig.getHex() === 0xf472b6) {
      return mat;
    }

    // 3. รักษาไฮไลท์สีขาว/จานรองสีขาว (ยกเว้นไอเทมที่มีสีหลักเป็นสีขาว เช่น เมฆขาว ยูนิคอร์นขาว หมวกเชฟ)
    if (origHSL.l > 0.91 && origHSL.s < 0.15 && !baseIsWhite) {
      return mat;
    }

    const cloned = mat.clone() as THREE.MeshStandardMaterial & {
      color: THREE.Color;
      emissive?: THREE.Color;
    };

    const rgbDist = baseColor
      ? Math.hypot(orig.r - baseColor.r, orig.g - baseColor.g, orig.b - baseColor.b)
      : 0;

    const isPrimarySurface =
      !baseColor ||
      rgbDist < 0.56 ||
      (baseIsWhite && origHSL.l > 0.84) ||
      (baseIsDark && origHSL.l < 0.22);

    if (isPrimarySurface) {
      const shadeOffset = baseColor ? (origHSL.l - baseHSL.l) * 0.32 : 0;
      cloned.color.setHSL(
        targetHSL.h,
        targetHSL.s,
        Math.max(0.08, Math.min(0.95, targetHSL.l + shadeOffset))
      );
    } else if (!baseIsWhite && origHSL.s > 0.22) {
      // ชิ้นส่วนสีรอง (เช่น วงแหวนหลายสีของออร่า/ลูกโป่ง): เลื่อน Hue ให้เข้าคู่กับโทนสีที่เลือก
      const hueShift = targetHSL.h - (baseColor ? baseHSL.h : origHSL.h);
      const nextHue = (((origHSL.h + hueShift) % 1) + 1) % 1;
      cloned.color.setHSL(nextHue, Math.max(0.35, targetHSL.s * 0.9), origHSL.l);
    } else {
      return mat;
    }

    if (
      cloned.emissive &&
      cloned.emissive.r + cloned.emissive.g + cloned.emissive.b > 0.02
    ) {
      cloned.emissive.copy(cloned.color).multiplyScalar(0.55);
    }

    clonedMap.set(mat, cloned);
    return cloned;
  };

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material || mesh.userData?.noDye) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => dyeOneMaterial(m));
    } else {
      mesh.material = dyeOneMaterial(mesh.material);
    }
  });
}

export function buildCharacterMesh({
  colorHex,
  accessory,
  bandColor,
  bellyScale = 1,
  muscleScale = 1,
  showDumbbells = false,
  spectatorProp = '',
  species = 'bunny',
  equipHat = 'none',
  equipFace = 'face_none',
  equipArmor = 'armor_none',
  equipWeapon = 'weapon_none',
  equipWings = 'wings_none',
  equipAura = 'aura_none',
  equipMount = 'mount_none',
  propColors,
  animMode,
  animSeed = 0,
  useProceduralOnly = false,
  netPower = 0,
}: BuildCharacterOptions): CharacterMeshParts {
  const breedMeta = resolveBreedOption(species);
  const isHeroChar = Boolean(breedMeta.isHero);
  const effectiveEquipArmor =
    isHeroChar && (equipArmor === 'armor_chibi_animal' || equipArmor === 'armor_bare')
      ? breedMeta.defaultArmor || 'armor_none'
      : equipArmor;
  const heroSkinNum = new THREE.Color(breedMeta.skinHex || '#FAD6B8').getHex();

  const powerMeta = resolvePowerBoostMeta(
    netPower > 0 ? netPower : 0,
    netPower < 0 ? -netPower : 0
  );
  const effectiveBellyScale = Math.max(0.74, Math.min(1.65, bellyScale + powerMeta.extraBellyAdd));
  const effectiveMuscleScale = Math.max(0.85, Math.min(1.45, muscleScale + powerMeta.extraMuscleAdd));
  const effectiveColorHex =
    powerMeta.form === 'kabigon'
      ? 0x1d5c73
      : powerMeta.form === 'majin_buu'
      ? 0xf9a8d4
      : isHeroChar
      ? heroSkinNum
      : colorHex;

  const rootGroup = new THREE.Group();
  const bounceGroup = new THREE.Group();
  bounceGroup.scale.set(powerMeta.widthScale, powerMeta.heightScale, powerMeta.widthScale);
  const riderGroup = new THREE.Group();
  const fallbackGroup = new THREE.Group();
  rootGroup.add(bounceGroup);
  bounceGroup.add(riderGroup);
  riderGroup.add(fallbackGroup);

  const mountParts = buildMountMesh(equipMount);
  const isInitFloorProp = [
    'pushup',
    'situp',
    'food_roll',
    'phone_scroll',
    'picnic_shabu',
    'play_cards',
    'pullup',
  ].includes(spectatorProp);
  if (mountParts) {
    mountParts.mountGroup.scale.set(powerMeta.widthScale, powerMeta.heightScale, powerMeta.widthScale);
    if (isInitFloorProp) {
      mountParts.mountGroup.position.set(-1.45, 0, -1.25);
    } else {
      mountParts.mountGroup.position.set(0, 0, 0);
      riderGroup.position.set(0, Math.max(0.18, mountParts.saddleY - 0.34), 0);
    }
    if (propColors?.mount) {
      const mountShopItem = SHOP_ITEMS.find((it) => it.id === equipMount);
      applyCustomDyeToGroup(mountParts.mountGroup, propColors.mount, mountShopItem?.colorHex);
    }
    rootGroup.add(mountParts.mountGroup);
  }

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: effectiveColorHex,
    roughness: isHeroChar && breedMeta.heroStyle === 'baymax_eyes' ? 0.32 : 0.56,
    metalness: 0.02,
    sheen: isHeroChar ? 0.28 : 0.78,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(0xffffff),
  });

  const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 24), bodyMat);
  bodyMesh.position.y = 1.05;
  bodyMesh.scale.set(effectiveBellyScale, 1.0, effectiveBellyScale);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.isBelly = true;
  fallbackGroup.add(bodyMesh);

  const bellyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.5 })
  );
  bellyMesh.position.set(0.32, 0.0, 0);
  bellyMesh.userData.isBelly = true;
  bodyMesh.add(bellyMesh);

  // Casual Shirt & Pants Layer on Fallback Body (เสื้อ & กางเกง ไม่ใช่ชุดเกราะต่อสู้)
  {
    const outfitGroup = new THREE.Group();
    const customShirtNum =
      propColors?.shirt && /^#[0-9A-Fa-f]{6}$/.test(propColors.shirt)
        ? new THREE.Color(propColors.shirt).getHex()
        : null;
    const customPantsNum =
      propColors?.pants && /^#[0-9A-Fa-f]{6}$/.test(propColors.pants)
        ? new THREE.Color(propColors.pants).getHex()
        : null;
    if (equipArmor === 'armor_snow_dress' || equipArmor === 'armor_princess') {
      const topColor = customShirtNum ?? (equipArmor === 'armor_snow_dress' ? 0x2563eb : 0x60a5fa);
      const skirtColor = customPantsNum ?? (equipArmor === 'armor_snow_dress' ? 0xfacc15 : 0xf8fafc);
      const topMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.64, 0.72, 0.56, 20),
        new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.48 })
      );
      topMesh.position.y = 0.2;
      const tennisSkirt = new THREE.Mesh(
        new THREE.ConeGeometry(0.92, 0.52, 22),
        new THREE.MeshStandardMaterial({ color: skirtColor, roughness: 0.5 })
      );
      tennisSkirt.position.y = -0.22;
      outfitGroup.add(topMesh, tennisSkirt);
    } else if (equipArmor !== 'armor_chibi_animal' && equipArmor !== 'armor_bare') {
      const shirtColor =
        customShirtNum ??
        (equipArmor === 'armor_gold_paladin'
          ? 0xfacc15
          : equipArmor === 'armor_silver_knight'
          ? 0x64748b
          : equipArmor === 'armor_ice_cape'
          ? 0x38bdf8
          : equipArmor === 'armor_vest'
          ? 0x16a34a
          : 0x3b82f6);
      const pantsColor =
        customPantsNum ??
        (equipArmor === 'armor_gold_paladin'
          ? 0x18181b
          : equipArmor === 'armor_silver_knight'
          ? 0x1e3a8a
          : equipArmor === 'armor_vest'
          ? 0xb45309
          : 0x334155);
      const shirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.75, 0.62, 20),
        new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.55 })
      );
      shirt.position.y = 0.16;
      const shorts = new THREE.Mesh(
        new THREE.CylinderGeometry(0.74, 0.68, 0.42, 20),
        new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.65 })
      );
      shorts.position.y = -0.28;
      outfitGroup.add(shirt, shorts);
    }
    bodyMesh.add(outfitGroup);
  }

  // Back Attachment (กระเป๋าเป้ / เสื่อโยคะ / โบว์หลัง / ปีกปาร์ตี้)
  let wingsBackGroup: THREE.Group | null = null;
  if (equipWings && equipWings !== 'wings_none') {
    const backGroup = new THREE.Group();
    backGroup.position.set(-0.55, 1.25, 0);
    wingsBackGroup = backGroup;

    if (equipWings === 'wings_gold_archangel') {
      const goldWingMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
        metalness: 0.45,
        roughness: 0.25,
      });
      [-1, 1].forEach((side) => {
        const wingSide = new THREE.Group();
        for (let f = 0; f < 5; f++) {
          const feather = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 1.25 - f * 0.14, 8),
            goldWingMat
          );
          feather.position.set(-0.08, 0.22 + f * 0.1, side * (0.34 + f * 0.22));
          feather.rotation.x = side * (0.55 + f * 0.14);
          feather.rotation.z = 0.25;
          wingSide.add(feather);
        }
        backGroup.add(wingSide);
      });
    } else if (equipWings === 'wings_fairy') {
      const wingMat = new THREE.MeshStandardMaterial({
        color: 0x6ee7b7,
        emissive: 0x10b981,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.85,
        roughness: 0.15,
      });
      [-1, 1].forEach((side) => {
        const upper = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 14), wingMat);
        upper.scale.set(0.18, 1.25, 0.8);
        upper.position.set(-0.08, 0.24, side * 0.5);
        upper.rotation.x = side * 0.45;
        const lower = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), wingMat);
        lower.scale.set(0.16, 1.0, 0.7);
        lower.position.set(-0.1, -0.2, side * 0.38);
        lower.rotation.x = side * 0.3;
        backGroup.add(upper, lower);
      });
    } else if (equipWings === 'wings_crystal') {
      // โบว์ริบบิ้นสีฟ้าพาสเทลยักษ์ติดหลัง
      const bowMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35 });
      [-1, 1].forEach((side) => {
        const loop = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 12), bowMat);
        loop.rotation.x = side * (Math.PI / 2);
        loop.position.set(-0.08, 0.12, side * 0.28);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.16), bowMat);
        tail.position.set(-0.1, -0.26, side * 0.18);
        tail.rotation.x = side * 0.22;
        backGroup.add(loop, tail);
      });
      const centerKnot = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.3 })
      );
      centerKnot.position.set(-0.08, 0.12, 0);
      backGroup.add(centerKnot);
    } else if (equipWings === 'wings_apple_sword') {
      // กระเป๋าเป้แคมป์ปิ้ง 3D สุดคิวท์ (แทนดาบ)
      const packGroup = new THREE.Group();
      const bagMain = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.58, 0.52),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })
      );
      const bagFlap = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.18, 0.54),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
      );
      bagFlap.position.y = 0.22;
      const pocket = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.26, 0.38),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.55 })
      );
      pocket.position.set(-0.18, -0.1, 0);
      bagMain.castShadow = true;
      packGroup.add(bagMain, bagFlap, pocket);
      packGroup.position.set(-0.08, 0.05, 0);
      backGroup.add(packGroup);
    } else if (equipWings === 'wings_magic_carpet') {
      // เสื่อโยคะฟิตเนสม้วนสะพายหลัง
      const matRoll = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.92, 14),
        new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.55 })
      );
      matRoll.rotation.x = Math.PI / 2;
      matRoll.rotation.z = 0.35;
      const strap1 = new THREE.Mesh(
        new THREE.TorusGeometry(0.145, 0.022, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
      );
      strap1.position.z = -0.24;
      const strap2 = strap1.clone();
      strap2.position.z = 0.24;
      const yogaHolder = new THREE.Group();
      yogaHolder.add(matRoll, strap1, strap2);
      yogaHolder.position.set(-0.1, 0.08, 0);
      backGroup.add(yogaHolder);
    } else if (equipWings === 'wings_gacha_jetpack') {
      // 🚀 เจ็ทแพ็คเทอร์โบพ่นไฟ (Legendary Gachapon)
      const jetMetal = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.78, roughness: 0.22 });
      const goldBand = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.72, roughness: 0.25 });
      const flameCore = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const flameOuter = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 });
      const centerBridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.48), goldBand);
      centerBridge.position.set(-0.08, 0.1, 0);
      backGroup.add(centerBridge);
      [-0.22, 0.22].forEach((pz) => {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.62, 14), jetMetal);
        tank.position.set(-0.14, 0.12, pz);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 14), goldBand);
        nose.position.set(-0.14, 0.54, pz);
        const nozzle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.13, 0.12, 12),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 })
        );
        nozzle.position.set(-0.14, -0.24, pz);
        const fOuter = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 10), flameOuter);
        fOuter.rotation.x = Math.PI;
        fOuter.position.set(-0.14, -0.48, pz);
        const fInner = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 8), flameCore);
        fInner.rotation.x = Math.PI;
        fInner.position.set(-0.14, -0.42, pz);
        backGroup.add(tank, nose, nozzle, fOuter, fInner);
      });
    } else if (equipWings === 'wings_gacha_ufo_cape') {
      // 🎈 พวงลูกโป่งพาสเทลลอยฟ้า (Epic Gachapon)
      const balloonSpecs: [number, number, number, number][] = [
        [-0.12, 1.35, -0.28, 0xf472b6],
        [-0.22, 1.55, 0.0, 0x38bdf8],
        [-0.12, 1.38, 0.28, 0xfacc15],
      ];
      const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      balloonSpecs.forEach(([bx, by, bz, bCol]) => {
        const bMat = new THREE.MeshStandardMaterial({ color: bCol, roughness: 0.22, metalness: 0.08 });
        const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), bMat);
        balloon.scale.set(1, 1.18, 1);
        balloon.position.set(bx, by, bz);
        balloon.castShadow = true;
        const cordLen = Math.hypot(bx, by - 0.1, bz);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, cordLen, 6), stringMat);
        cord.position.set(bx * 0.5, 0.1 + (by - 0.1) * 0.5, bz * 0.5);
        cord.rotation.x = Math.atan2(bz, by - 0.1);
        backGroup.add(balloon, cord);
      });
    } else if (equipWings === 'wings_ms_teddy_pack') {
      // 🧸 เป้ตุ๊กตาหมีคาราเมลเกาะหลัง (MapleSim Clingy Teddy)
      const bearFur = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.68 });
      const bearCream = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.55 });
      const bearEye = new THREE.MeshBasicMaterial({ color: 0x18181b });
      const teddy = new THREE.Group();
      const tBody = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), bearFur);
      tBody.scale.set(0.85, 1.05, 0.95);
      tBody.position.set(-0.14, 0.02, 0);
      const tHead = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), bearFur);
      tHead.position.set(-0.14, 0.36, 0);
      const tSnout = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), bearCream);
      tSnout.position.set(-0.31, 0.33, 0);
      teddy.add(tBody, tHead, tSnout);
      [-0.14, 0.14].forEach((ez) => {
        const tEar = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), bearFur);
        tEar.position.set(-0.14, 0.53, ez);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), bearEye);
        eye.position.set(-0.32, 0.4, ez * 0.55);
        const hugArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.18, 6, 8), bearFur);
        hugArm.rotation.z = Math.PI / 2;
        hugArm.position.set(0.02, 0.14, ez * 1.45);
        teddy.add(tEar, eye, hugArm);
      });
      backGroup.add(teddy);
    } else if (equipWings && equipWings !== 'wings_none') {
      buildExtraWings3D(equipWings, backGroup);
    }

    if (propColors?.wings) {
      const wingsShopItem = SHOP_ITEMS.find((it) => it.id === equipWings);
      applyCustomDyeToGroup(backGroup, propColors.wings, wingsShopItem?.colorHex);
    }

    bounceGroup.add(backGroup);
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0.04, 1.98, 0);
  fallbackGroup.add(headGroup);

  const innerPinkMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.5 });
  const coralSnoutMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.45 });
  const creamWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.45 });
  const pureWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42 });
  const darkTipMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.48 });

  const earStyle = breedMeta.earStyle;

  // ============================================================================
  // รูปทรงโครงหัวและจมูกเฉพาะแต่ละสายพันธุ์ & มนุษย์ฮีโร่จิบิ (Species & Chibi Hero Silhouettes!)
  // ============================================================================
  let faceXOffset = 0; // ชดเชยตำแหน่งตา/แว่นด้านหน้าตามความแบน-ยาวของกะโหลกแต่ละพันธุ์

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 28, 28), bodyMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  let heroFaceFlags = { hideStandardEyes: false, hideStandardMouth: false };
  if (isHeroChar) {
    heroFaceFlags = buildHeroHead3D(headGroup, headMesh, bodyMat, breedMeta, colorHex, bandColor);
  }

  if (earStyle === 'fox' || breedMeta.facePattern === 'red_panda' || breedMeta.facePattern === 'raccoon_mask') {
    // 🦊 จิ้งจอก / แพนด้าแดง / แรคคูน: หัวทรงเพชรมีขนฟูแหลมออกสองข้างแก้ม + ปากแหลมยาวสองสี
    headMesh.scale.set(0.94, 0.86, 1.04);
    [-1, 1].forEach((side) => {
      const cheekTuft = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.44, 10), creamWhiteMat);
      cheekTuft.position.set(0.06, -0.14, side * 0.56);
      cheekTuft.rotation.x = side * (Math.PI / 2 + 0.18);
      headGroup.add(cheekTuft);
    });
    const upperBridge = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.44, 14), bodyMat);
    upperBridge.rotation.z = -Math.PI / 2;
    upperBridge.position.set(0.6, -0.05, 0);
    const lowerJaw = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 14), creamWhiteMat);
    lowerJaw.rotation.z = -Math.PI / 2;
    lowerJaw.position.set(0.58, -0.12, 0);
    headGroup.add(upperBridge, lowerJaw);
  } else if (earStyle === 'bunny' || earStyle === 'lop') {
    // 🐰 กระต่าย: หัวทรงลูกแพร์/โมจิ (หน้าผากแคบ แก้มล่างป่องกว้างออกด้านข้าง) + ก้อนแก้มหนวดขาว + ฟันกระต่าย 2 ซี่
    headMesh.scale.set(0.92, 0.88, 0.92);
    headMesh.position.y = 0.06;
    const lowerPear = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 20), bodyMat);
    lowerPear.scale.set(0.94, 0.64, 1.24);
    lowerPear.position.set(0.06, -0.16, 0);
    lowerPear.castShadow = true;
    headGroup.add(lowerPear);
    [-0.1, 0.1].forEach((mz) => {
      const whiskerPad = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), pureWhiteMat);
      whiskerPad.scale.set(0.85, 0.78, 1.05);
      whiskerPad.position.set(0.52, -0.11, mz);
      headGroup.add(whiskerPad);
    });
    [-0.028, 0.028].forEach((tz) => {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.075, 0.044), pureWhiteMat);
      tooth.position.set(0.59, -0.2, tz);
      headGroup.add(tooth);
    });
  } else if (earStyle === 'capybara') {
    // 🍊 คาปิบาร่า: หัวทรงสี่เหลี่ยมขนมปังก้อนยาว (Rectangular Loaf Head) ยื่นไปข้างหน้าชัดเจน!
    faceXOffset = 0.14;
    headMesh.scale.set(1.26, 0.84, 0.82);
    const snoutBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.44, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.65 })
    );
    snoutBlock.position.set(0.56, -0.04, 0);
    headGroup.add(snoutBlock);
    [-0.11, 0.11].forEach((nz) => {
      const capyNostril = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), darkTipMat);
      capyNostril.position.set(0.77, 0.09, nz);
      headGroup.add(capyNostril);
    });
  } else if (earStyle === 'pig') {
    if (breedMeta.id === 'dairy_cow') {
      // 🐮 วัวนม: หน้ากว้าง + ปากวัวสีชมพูอ่อนพาดเต็มครึ่งล่างของหน้า + เขาวัวคู่บนหัว
      headMesh.scale.set(0.95, 0.94, 1.1);
      const cowMuzzle = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 10, 16), innerPinkMat);
      cowMuzzle.rotation.x = Math.PI / 2;
      cowMuzzle.scale.set(0.82, 1.0, 0.9);
      cowMuzzle.position.set(0.5, -0.16, 0);
      headGroup.add(cowMuzzle);
      [-0.28, 0.28].forEach((hz) => {
        const horn = new THREE.Mesh(
          new THREE.ConeGeometry(0.075, 0.28, 10),
          new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 })
        );
        horn.position.set(0, 0.62, hz);
        horn.rotation.x = hz < 0 ? -0.25 : 0.25;
        headGroup.add(horn);
      });
    } else {
      // 🐷 หมูจิ๋ว: หัวแป้นกว้างแนวนอน + จมูกหมูทรงกระบอกแบนยื่นใหญ่สีชมพูเข้มเห็นรูจมูกชัด!
      headMesh.scale.set(0.94, 0.82, 1.24);
      const pigSnout = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.22, 18), coralSnoutMat);
      pigSnout.rotation.z = Math.PI / 2;
      pigSnout.scale.set(0.82, 1.0, 1.18);
      pigSnout.position.set(0.56, -0.07, 0);
      headGroup.add(pigSnout);
    }
  } else if (earStyle === 'cat' || earStyle === 'folded_cat') {
    // 🐱 แมว: หัวทรงซาลาเปาแมว (แบนนิดๆ กว้างออกข้าง) + ขนแก้มแมวชี้ข้าง + ก้อนหนวด ω + ลายหน้าผาก 3 ขีด
    headMesh.scale.set(0.88, 0.82, 1.18);
    [-1, 1].forEach((side) => {
      const catFluff = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 8), bodyMat);
      catFluff.position.set(0.05, -0.1, side * 0.62);
      catFluff.rotation.x = side * (Math.PI / 2 + 0.15);
      headGroup.add(catFluff);
    });
    [-0.085, 0.085].forEach((mz) => {
      const catPad = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), creamWhiteMat);
      catPad.position.set(0.49, -0.11, mz);
      headGroup.add(catPad);
    });
    if (breedMeta.id !== 'sphynx' && breedMeta.id !== 'black_cat') {
      [-0.11, 0, 0.11].forEach((sz, sIdx) => {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, sIdx === 1 ? 0.18 : 0.13, 0.038),
          new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.65 })
        );
        stripe.position.set(0.45, 0.28, sz);
        stripe.rotation.z = 0.45;
        headGroup.add(stripe);
      });
    }
    faceXOffset = -0.04;
  } else if (earStyle === 'pug' || breedMeta.id === 'frenchie') {
    // 🐶 ปั๊ก / เฟรนช์บูลด็อก: หน้าสั้นแบนทรงสี่เหลี่ยม (Flat Brachycephalic Face) + ปากสีเข้มหน้าย่น
    faceXOffset = -0.1;
    headMesh.scale.set(0.76, 0.92, 1.16);
    const flatJowlL = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.7 })
    );
    flatJowlL.position.set(0.39, -0.14, -0.11);
    const flatJowlR = flatJowlL.clone();
    flatJowlR.position.z = 0.11;
    headGroup.add(flatJowlL, flatJowlR);
  } else if (earStyle === 'corgi' || earStyle === 'shiba' || earStyle === 'dog_floppy') {
    // 🐕 สุนัขจมูกยาว (คอร์กี้ / ชิบะ / ฮัสกี้ / โกลเด้น / ดัชชุน): กระบอกปากสุนัขยื่นชัด + ลิ้นสีชมพูห้อยน่ารัก
    headMesh.scale.set(0.96, 0.9, 1.04);
    const dogMuzzle = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.24, 10, 14), creamWhiteMat);
    dogMuzzle.rotation.z = Math.PI / 2;
    dogMuzzle.scale.set(0.88, 1.0, 1.12);
    dogMuzzle.position.set(0.54, -0.1, 0);
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.11), coralSnoutMat);
    tongue.position.set(0.6, -0.22, 0);
    tongue.rotation.z = 0.35;
    headGroup.add(dogMuzzle, tongue);
  } else if (breedMeta.id === 'hamster') {
    // 🐹 แฮมสเตอร์: หัวบนเล็ก แต่กระพุ้งแก้มสองข้างป่องตุ่ยอมอาหารขนาดยักษ์!
    headMesh.scale.set(0.9, 0.86, 0.92);
    [-0.36, 0.36].forEach((pz) => {
      const megaPouch = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), creamWhiteMat);
      megaPouch.scale.set(0.95, 0.85, 1.12);
      megaPouch.position.set(0.2, -0.18, pz);
      headGroup.add(megaPouch);
    });
    faceXOffset = -0.03;
  } else if (earStyle === 'bear' || earStyle === 'panda') {
    // 🐻 หมี / 🐼 แพนด้า: หัวทรงโดมกว้างแข็งแรง + ก้อนจมูกหมีสีครีมยื่นกลมด้านหน้าชัดเจน
    headMesh.scale.set(0.98, 0.94, 1.14);
    const bearSnout = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 16),
      earStyle === 'panda' ? pureWhiteMat : creamWhiteMat
    );
    bearSnout.scale.set(1.05, 0.82, 1.08);
    bearSnout.position.set(0.5, -0.1, 0);
    headGroup.add(bearSnout);
  } else if (earStyle === 'frog') {
    // 🐸 กบ: หัวแบนกว้างเหมือนกบจริง (เตี้ยแต่กว้างมาก!) ตาโปนอยู่ด้านบนสุดของหัว
    headMesh.scale.set(0.94, 0.64, 1.32);
    faceXOffset = -0.02;
  } else if (earStyle === 'duck') {
    // 🦆 เป็ด: หัวเรียวกลม + ปากเป็ดสีส้มแบนกว้างทั้งปากบนและปากล่างยื่นยาว
    headMesh.scale.set(0.92, 0.94, 0.94);
    faceXOffset = -0.03;
  } else if (earStyle === 'monkey') {
    // 🐵 ลิงจ๋อ: กะโหลกกลม + ก้อนปากลิงสีครีมยื่นโค้งด้านล่าง + หูใหญ่กางออกข้าง
    headMesh.scale.set(0.92, 0.92, 0.96);
    const monkeyMouth = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), creamWhiteMat);
    monkeyMouth.scale.set(0.95, 0.72, 1.12);
    monkeyMouth.position.set(0.44, -0.16, 0);
    headGroup.add(monkeyMouth);
    faceXOffset = -0.03;
  } else if (earStyle === 'alpaca') {
    // 🦙 อัลปาก้า / แกะ: หน้าเรียวหวานล้อมด้วยปุยเมฆรอบหัว
    headMesh.scale.set(0.92, 0.98, 0.9);
    const alpacaMuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), creamWhiteMat);
    alpacaMuzzle.position.set(0.48, -0.09, 0);
    headGroup.add(alpacaMuzzle);
    faceXOffset = -0.03;
  } else if (earStyle === 'seal') {
    // 🦭 แมวน้ำอุ๋งๆ: หัวมนลู่ลมแนวนอน + ก้อนหนวดอุ๋งๆ อวบอิ่มสองก้อนด้านหน้า
    headMesh.scale.set(1.06, 0.84, 1.04);
    [-0.11, 0.11].forEach((sz) => {
      const sealPad = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), pureWhiteMat);
      sealPad.position.set(0.54, -0.1, sz);
      headGroup.add(sealPad);
    });
    faceXOffset = 0.04;
  } else if (earStyle === 'trex') {
    // 🦖 ทีเร็กซ์: กรามไดโนเสาร์ทรงกล่องยาวด้านหน้า + ซี่ฟันเขี้ยวขาวเรียงราย + หนามสันหลังหัวสีเหลืองทอง!
    faceXOffset = 0.08;
    headMesh.scale.set(1.08, 0.92, 0.92);
    const upperDinoJaw = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.56), bodyMat);
    upperDinoJaw.position.set(0.52, -0.02, 0);
    const lowerDinoJaw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.48), creamWhiteMat);
    lowerDinoJaw.position.set(0.49, -0.22, 0);
    headGroup.add(upperDinoJaw, lowerDinoJaw);
    [-0.2, -0.07, 0.07, 0.2].forEach((tz) => {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.11, 6), pureWhiteMat);
      tooth.rotation.x = Math.PI;
      tooth.position.set(0.71, -0.16, tz);
      headGroup.add(tooth);
    });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    [0.12, -0.12, -0.34].forEach((sx, si) => {
      const crestSpike = new THREE.Mesh(new THREE.ConeGeometry(0.11 - si * 0.015, 0.28, 6), spikeMat);
      crestSpike.position.set(sx, 0.58 - si * 0.08, 0);
      crestSpike.rotation.z = 0.25 + si * 0.22;
      headGroup.add(crestSpike);
    });
  } else if (earStyle === 'triceratops') {
    // 🦕 ไทรเซอราทอปส์: แผงเกราะคอทรงพัดขนาดใหญ่ด้านหลังหัว + เขาคู่เหนือตา + นอปลายจมูก!
    headMesh.scale.set(1.02, 0.9, 0.98);
    const frillMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 });
    const hornIvoryMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.35 });
    const frillShield = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.68, 0.12, 16), frillMat);
    frillShield.rotation.z = Math.PI / 2 - 0.35;
    frillShield.position.set(-0.22, 0.26, 0);
    headGroup.add(frillShield);
    for (let fi = 0; fi < 7; fi++) {
      const fa = ((fi / 6) - 0.5) * Math.PI * 0.95;
      const stud = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), hornIvoryMat);
      stud.position.set(-0.26, 0.26 + Math.cos(fa) * 0.74, Math.sin(fa) * 0.74);
      stud.rotation.x = fa;
      headGroup.add(stud);
    }
    [-0.24, 0.24].forEach((hz) => {
      const browHorn = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.52, 10), hornIvoryMat);
      browHorn.position.set(0.46, 0.32, hz);
      browHorn.rotation.z = -1.05;
      browHorn.rotation.y = hz < 0 ? 0.15 : -0.15;
      headGroup.add(browHorn);
    });
    const noseHorn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 10), hornIvoryMat);
    noseHorn.position.set(0.64, 0.04, 0);
    noseHorn.rotation.z = -0.85;
    headGroup.add(noseHorn);
  } else if (earStyle === 'mammoth') {
    // 🦣 แมมมอธขนฟู: ขนปุยบนหัว + งวงช้างโค้งงอนด้านหน้า + งาโค้งยาวสีงาช้างคู่ใหญ่ + หูช้าง!
    headMesh.scale.set(1.0, 0.96, 1.08);
    const tuskMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.3 });
    const fluffDome = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), bodyMat);
    fluffDome.position.set(0.06, 0.46, 0);
    headGroup.add(fluffDome);
    // Curved Trunk (งวงช้าง)
    const trunkUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.42, 12), bodyMat);
    trunkUpper.position.set(0.56, -0.16, 0);
    trunkUpper.rotation.z = 0.42;
    const trunkTip = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.085, 10, 14, Math.PI * 1.1), bodyMat);
    trunkTip.position.set(0.7, -0.34, 0);
    headGroup.add(trunkUpper, trunkTip);
    // Giant Curved Tusks (งาแมมมอธคู่ใหญ่)
    [-0.3, 0.3].forEach((tz) => {
      const tusk = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.068, 10, 18, Math.PI * 0.95), tuskMat);
      tusk.position.set(0.52, -0.06, tz);
      tusk.rotation.z = -Math.PI * 0.62;
      tusk.rotation.y = tz < 0 ? 0.22 : -0.22;
      headGroup.add(tusk);
    });
    [-0.58, 0.58].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), bodyMat);
      ear.scale.set(0.35, 1.15, 0.95);
      ear.position.set(-0.04, 0.08, ez);
      headGroup.add(ear);
    });
  } else if (earStyle === 'sabretooth') {
    // 🐯 เสือเขี้ยวดาบ: หัวพยัคฆ์โบราณ + แผงแก้มฟู + เขี้ยวดาบยาวโค้งคู่หน้ายื่นพ้นคาง!
    headMesh.scale.set(0.95, 0.9, 1.14);
    [-1, 1].forEach((side) => {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 8), creamWhiteMat);
      tuft.position.set(0.05, -0.14, side * 0.62);
      tuft.rotation.x = side * (Math.PI / 2 + 0.15);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 12), bodyMat);
      ear.position.set(-0.02, 0.48, side * 0.42);
      headGroup.add(tuft, ear);
    });
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.42), creamWhiteMat);
    muzzle.position.set(0.49, -0.11, 0);
    headGroup.add(muzzle);
    [-0.14, 0.14].forEach((fz) => {
      const sabreFang = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.42, 8), pureWhiteMat);
      sabreFang.rotation.x = Math.PI;
      sabreFang.rotation.z = 0.15;
      sabreFang.position.set(0.58, -0.34, fz);
      headGroup.add(sabreFang);
    });
  } else if (earStyle === 'dodo') {
    // 🦤 นกโดโด้: จะงอยปากโดโด้อ้วนใหญ่ปลายงุ้มสีเหลืองปลายดำ + จุกขน 3 เส้นบนหัว!
    headMesh.scale.set(0.94, 0.96, 0.94);
    const dodoBeakMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const beakBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.26, 8, 12), dodoBeakMat);
    beakBase.rotation.z = Math.PI / 2 + 0.15;
    beakBase.position.set(0.56, -0.06, 0);
    const beakHook = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.26, 10), darkTipMat);
    beakHook.rotation.z = Math.PI - 0.35;
    beakHook.position.set(0.74, -0.15, 0);
    headGroup.add(beakBase, beakHook);
    [-0.1, 0, 0.1].forEach((cz, ci) => {
      const plume = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), pureWhiteMat);
      plume.scale.set(0.8, 1.8, 0.8);
      plume.position.set(-0.05 - ci * 0.04, 0.64, cz);
      plume.rotation.z = 0.35;
      headGroup.add(plume);
    });
  } else if (earStyle === 'pterodactyl') {
    // 🦅 เทอโรแดคทิล: หงอนกระดูกแหลมยาวชี้ไปด้านหลังกะโหลก + จะงอยปากแหลมยาว!
    faceXOffset = 0.04;
    headMesh.scale.set(1.04, 0.88, 0.9);
    const crestHorn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.95, 8), bodyMat);
    crestHorn.rotation.z = Math.PI / 2 + 0.32;
    crestHorn.position.set(-0.48, 0.38, 0);
    const pteroBeak = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.68, 8),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
    );
    pteroBeak.rotation.z = -Math.PI / 2;
    pteroBeak.position.set(0.72, -0.05, 0);
    headGroup.add(crestHorn, pteroBeak);
  } else if (earStyle === 'dragon') {
    // 🐉 มังกรเพลิงทอง: เขามังกรสีทองคู่โค้งไปด้านหลัง + ครีบหูข้างแก้ม + จมูกมังกรพ่นไฟ!
    faceXOffset = 0.05;
    headMesh.scale.set(1.05, 0.9, 0.98);
    const goldDragonMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.65,
      roughness: 0.25,
    });
    const dragonSnout = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.46), bodyMat);
    dragonSnout.position.set(0.5, -0.06, 0);
    headGroup.add(dragonSnout);
    [-0.12, 0.12].forEach((nz) => {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), goldDragonMat);
      nostril.position.set(0.68, 0.05, nz);
      headGroup.add(nostril);
    });
    [-0.28, 0.28].forEach((hz) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.68, 10), goldDragonMat);
      horn.position.set(-0.12, 0.62, hz);
      horn.rotation.z = 0.58;
      horn.rotation.x = hz < 0 ? -0.25 : 0.25;
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 4), goldDragonMat);
      fin.position.set(-0.04, 0.04, hz * 2.1);
      fin.rotation.x = hz < 0 ? -1.15 : 1.15;
      headGroup.add(horn, fin);
    });
  } else if (earStyle === 'unicorn') {
    // 🦄 ยูนิคอร์นสายรุ้ง: เขาเกลียวทองคำเรืองแสงกลางหน้าผาก + แผงคอสายรุ้งพาสเทล + หูม้าตั้ง!
    headMesh.scale.set(0.98, 0.96, 0.94);
    const uniMuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), innerPinkMat);
    uniMuzzle.scale.set(1.0, 0.82, 0.95);
    uniMuzzle.position.set(0.48, -0.1, 0);
    const magicHornMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.45,
      metalness: 0.7,
      roughness: 0.18,
    });
    const uniHorn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.68, 12), magicHornMat);
    uniHorn.position.set(0.36, 0.68, 0);
    uniHorn.rotation.z = -0.52;
    headGroup.add(uniMuzzle, uniHorn);
    [-0.26, 0.26].forEach((ez) => {
      const horseEar = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.36, 10), bodyMat);
      horseEar.position.set(0.02, 0.58, ez);
      horseEar.rotation.x = ez < 0 ? -0.22 : 0.22;
      headGroup.add(horseEar);
    });
    const rainbowCols = [0xf472b6, 0x38bdf8, 0xfacc15, 0xc084fc];
    rainbowCols.forEach((rc, ri) => {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.18 - ri * 0.015, 10, 10),
        new THREE.MeshStandardMaterial({ color: rc, roughness: 0.45 })
      );
      puff.position.set(0.1 - ri * 0.16, 0.54 - ri * 0.14, 0);
      headGroup.add(puff);
    });
  } else if (earStyle === 'phoenix') {
    // 🔥 นกฟีนิกซ์อมตะ: หงอนเปลวเพลิงเรืองแสง 3 แฉกบนหัว + ปีกแก้มเพลิง + จะงอยปากทองคำ!
    headMesh.scale.set(0.95, 0.95, 0.95);
    const flameGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf97316,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 8), flameGoldMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.62, -0.05, 0);
    headGroup.add(beak);
    [-0.22, 0, 0.22].forEach((cz, ci) => {
      const plume = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, ci === 1 ? 0.68 : 0.52, 8),
        flameGoldMat
      );
      plume.position.set(-0.04, ci === 1 ? 0.74 : 0.64, cz);
      plume.rotation.z = 0.32;
      plume.rotation.x = cz * 0.9;
      headGroup.add(plume);
    });
    [-0.52, 0.52].forEach((wz) => {
      const cheekWing = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.44, 6), flameGoldMat);
      cheekWing.position.set(-0.05, 0.08, wz);
      cheekWing.rotation.x = wz < 0 ? -1.15 : 1.15;
      headGroup.add(cheekWing);
    });
  } else if (earStyle === 'griffin') {
    // 🦅 กริฟฟินราชสีห์: จะงอยปากเหยี่ยวโค้งสีทอง + คิ้วพญาอินทรีเฉียงขาว + หูราชสีห์!
    headMesh.scale.set(0.96, 0.94, 1.0);
    const eagleGoldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 });
    const hookBeak = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.38, 8), eagleGoldMat);
    hookBeak.rotation.z = -Math.PI / 2 - 0.22;
    hookBeak.position.set(0.62, -0.08, 0);
    headGroup.add(hookBeak);
    [-0.22, 0.22].forEach((bz) => {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.22), pureWhiteMat);
      brow.position.set(0.46, 0.22, bz);
      brow.rotation.x = bz < 0 ? 0.28 : -0.28;
      const tuftEar = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 8), bodyMat);
      tuftEar.position.set(-0.06, 0.56, bz * 1.45);
      tuftEar.rotation.x = bz < 0 ? -0.35 : 0.35;
      headGroup.add(brow, tuftEar);
    });
  } else if (earStyle === 'kitsune') {
    // 🦊 จิ้งจอกเก้าหาง: หูจิ้งจอกเทพสีขาวปลายแดงชาด + แต้มชาดแดงข้างตา + ลูกแก้วเวทมนตร์ลอยเหนือหน้าผาก!
    headMesh.scale.set(0.94, 0.88, 1.04);
    const crimsonMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xb91c1c,
      emissiveIntensity: 0.35,
      roughness: 0.35,
    });
    const upperBridge = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 14), pureWhiteMat);
    upperBridge.rotation.z = -Math.PI / 2;
    upperBridge.position.set(0.58, -0.06, 0);
    headGroup.add(upperBridge);
    [-0.32, 0.32].forEach((ez) => {
      const earBase = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.54, 12), pureWhiteMat);
      earBase.position.set(-0.02, 0.62, ez);
      earBase.rotation.x = ez < 0 ? -0.28 : 0.28;
      const redTip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 10), crimsonMat);
      redTip.position.y = 0.16;
      earBase.add(redTip);
      const eyeMark = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.18), crimsonMat);
      eyeMark.position.set(0.48, 0.14, ez * 0.72);
      eyeMark.rotation.x = ez < 0 ? 0.35 : -0.35;
      headGroup.add(earBase, eyeMark);
    });
    const spiritOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.85,
        roughness: 0.15,
      })
    );
    spiritOrb.position.set(0.28, 0.68, 0);
    headGroup.add(spiritOrb);
  } else if (earStyle === 'cerberus') {
    // 🐺 เซอร์เบอรัส 3 หัว: หัวหลักตรงกลาง + หัวลูกหมาอสูรจิ๋วซ้าย-ขวาขนาบข้างไหล่ ตาแดงเพลิงสุดเท่!
    headMesh.scale.set(0.96, 0.92, 1.04);
    const redGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const collarSpikeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.7,
      roughness: 0.25,
    });
    const mainMuzzle = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.22, 8, 12), darkTipMat);
    mainMuzzle.rotation.z = Math.PI / 2;
    mainMuzzle.position.set(0.52, -0.1, 0);
    headGroup.add(mainMuzzle);
    [-0.28, 0.28].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.46, 10), bodyMat);
      ear.position.set(0, 0.58, ez);
      ear.rotation.x = ez < 0 ? -0.25 : 0.25;
      headGroup.add(ear);
    });
    // Twin Side Mini-Heads flanking left & right!
    [-0.68, 0.68].forEach((sz) => {
      const subHead = new THREE.Group();
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 14), bodyMat);
      const snout = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 10), darkTipMat);
      snout.rotation.z = -Math.PI / 2;
      snout.position.set(0.3, -0.05, 0);
      [-0.14, 0.14].forEach((sez) => {
        const sEar = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 8), bodyMat);
        sEar.position.set(-0.02, 0.32, sez);
        const sEye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), redGlowMat);
        sEye.position.set(0.26, 0.08, sez * 0.8);
        subHead.add(sEar, sEye);
      });
      const spikedCollar = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.045, 8, 14),
        collarSpikeMat
      );
      spikedCollar.rotation.x = Math.PI / 2;
      spikedCollar.position.y = -0.22;
      subHead.add(skull, snout, spikedCollar);
      subHead.position.set(0.06, -0.18, sz);
      subHead.rotation.y = sz < 0 ? 0.32 : -0.32;
      headGroup.add(subHead);
    });
  } else if (earStyle === 'lion') {
    // 🦁 สิงโต / สฟิงซ์ / ไคเมร่า: แผงคอราชสีห์ฟูกลมรอบหัว 12 กลีบสุดอลังการ + จมูกสิงโต!
    headMesh.scale.set(0.96, 0.94, 1.02);
    const maneMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.72 });
    for (let m = 0; m < 12; m++) {
      const ma = (m / 12) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), maneMat);
      puff.position.set(-0.08, Math.cos(ma) * 0.56, Math.sin(ma) * 0.58);
      headGroup.add(puff);
    }
    const lionMuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), creamWhiteMat);
    lionMuzzle.position.set(0.49, -0.1, 0);
    headGroup.add(lionMuzzle);
    [-0.36, 0.36].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), bodyMat);
      ear.position.set(0.02, 0.5, ez);
      headGroup.add(ear);
    });
  } else if (earStyle === 'deer') {
    // 🦌 กวางเรนเดียร์ / ยีราฟ / กิเลน: เขากวางแตกกิ่งคู่สง่างามบนหัว + หูกางข้าง!
    headMesh.scale.set(0.95, 0.96, 0.94);
    const antlerMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.4 });
    [-0.24, 0.24].forEach((az) => {
      const mainStem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.58, 8), antlerMat);
      mainStem.position.set(-0.02, 0.72, az * 1.2);
      mainStem.rotation.x = az < 0 ? -0.32 : 0.32;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.28, 8), antlerMat);
      branch.position.set(0.08, 0.78, az * 0.95);
      branch.rotation.z = -0.65;
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 6, 10), bodyMat);
      ear.position.set(0.02, 0.38, az * 2.1);
      ear.rotation.x = az < 0 ? -1.1 : 1.1;
      headGroup.add(mainStem, branch, ear);
    });
  } else if (earStyle === 'bull') {
    // 🐂 กระทิง / มิโนทอร์ / คาร์โนทอรัส / เยติ: เขากระทิงโค้งงอนคู่ใหญ่ + ห่วงทองคล้องจมูก!
    headMesh.scale.set(0.98, 0.94, 1.12);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.35 });
    const ringGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.75,
      roughness: 0.2,
    });
    const bullSnout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.44), darkTipMat);
    bullSnout.position.set(0.5, -0.12, 0);
    const noseRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 16), ringGoldMat);
    noseRing.rotation.y = Math.PI / 2;
    noseRing.position.set(0.65, -0.22, 0);
    headGroup.add(bullSnout, noseRing);
    [-0.46, 0.46].forEach((hz) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.56, 10), hornMat);
      horn.position.set(0.06, 0.56, hz);
      horn.rotation.x = hz < 0 ? -0.58 : 0.58;
      horn.rotation.z = -0.25;
      headGroup.add(horn);
    });
  } else if (earStyle === 'shark') {
    // 🦈 ฉลามขาว / เม็กกาโลดอน: ครีบฉลามตั้งเด่นกลางหัว + ซี่ฟันใบเลื่อยขาว!
    faceXOffset = 0.05;
    headMesh.scale.set(1.08, 0.9, 1.02);
    const dorsalFin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 4), bodyMat);
    dorsalFin.scale.set(1.2, 1, 0.28);
    dorsalFin.position.set(-0.08, 0.68, 0);
    dorsalFin.rotation.z = 0.28;
    const sharkBelly = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 14), pureWhiteMat);
    sharkBelly.scale.set(1.05, 0.62, 0.96);
    sharkBelly.position.set(0.16, -0.18, 0);
    headGroup.add(dorsalFin, sharkBelly);
    [-0.18, -0.06, 0.06, 0.18].forEach((tz) => {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.1, 6), pureWhiteMat);
      tooth.rotation.x = Math.PI;
      tooth.position.set(0.62, -0.14, tz);
      headGroup.add(tooth);
    });
  } else if (earStyle === 'axolotl') {
    // 🦎 แอกโซลอเติล / ปลาคาร์ป / คราเคน: เหงือกครีบชมพู 3 แฉกบานแฉ่งสองข้างแก้มสุดคิวท์!
    headMesh.scale.set(0.94, 0.84, 1.18);
    const gillMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.45 });
    [-1, 1].forEach((side) => {
      [-0.25, 0.05, 0.35].forEach((ga, gi) => {
        const gill = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.28, 6, 8), gillMat);
        gill.position.set(-0.02, 0.06 + gi * 0.16, side * 0.66);
        gill.rotation.x = side * (1.15 - gi * 0.22);
        gill.rotation.z = ga * 0.3;
        headGroup.add(gill);
      });
    });
  } else if (earStyle === 'elephant') {
    // 🐘 ช้างป่าไอยรา: หูช้างใบพัดใหญ่สองข้าง + งวงช้างน้อยชูขึ้นพ่นน้ำ!
    headMesh.scale.set(0.98, 0.96, 1.06);
    const trunk = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.09, 10, 16, Math.PI * 1.15), bodyMat);
    trunk.position.set(0.58, -0.04, 0);
    trunk.rotation.z = -Math.PI * 0.35;
    headGroup.add(trunk);
    [-0.64, 0.64].forEach((ez) => {
      const bigEar = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 14), bodyMat);
      bigEar.scale.set(0.28, 1.15, 0.98);
      bigEar.position.set(-0.06, 0.08, ez);
      headGroup.add(bigEar);
    });
  } else if (earStyle === 'jackalope') {
    // 🐰 แจ็กคาโลป: หูกระต่ายยาวตั้ง + เขากวางทองแตกกิ่งคู่กันบนหัว!
    headMesh.scale.set(0.92, 0.9, 0.96);
    const antlerGoldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 });
    [-0.22, 0.22].forEach((zPos) => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.52, 8, 12), bodyMat);
      ear.position.set(-0.04, 0.76, zPos);
      ear.rotation.x = zPos < 0 ? -0.18 : 0.18;
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.36, 6, 8), innerPinkMat);
      inner.position.set(0.06, -0.02, 0);
      ear.add(inner);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.42, 8), antlerGoldMat);
      horn.position.set(0.22, 0.64, zPos * 0.72);
      horn.rotation.z = -0.35;
      horn.rotation.x = zPos < 0 ? -0.25 : 0.25;
      headGroup.add(ear, horn);
    });
  }

  if (earStyle === 'bunny') {
    const earGeo = new THREE.CapsuleGeometry(0.11, 0.56, 8, 14);
    const innerGeo = new THREE.CapsuleGeometry(0.058, 0.4, 6, 10);
    [-0.2, 0.2].forEach((zPos) => {
      const ear = new THREE.Mesh(earGeo, bodyMat);
      ear.position.set(-0.02, 0.78, zPos);
      ear.rotation.x = zPos < 0 ? -0.15 : 0.15;
      ear.rotation.z = 0.08;
      const inner = new THREE.Mesh(innerGeo, innerPinkMat);
      inner.position.set(0.068, -0.02, 0);
      ear.add(inner);
      headGroup.add(ear);
    });
  } else if (earStyle === 'lop') {
    const earGeo = new THREE.CapsuleGeometry(0.12, 0.48, 8, 12);
    [-0.5, 0.5].forEach((zPos) => {
      const ear = new THREE.Mesh(earGeo, bodyMat);
      ear.position.set(0.02, 0.04, zPos);
      ear.rotation.x = zPos < 0 ? 0.2 : -0.2;
      ear.rotation.z = -0.15;
      headGroup.add(ear);
    });
  } else if (earStyle === 'fox') {
    // หูจิ้งจอกขนาดใหญ่ปลายหูสีดำชัดเจน
    [-0.32, 0.32].forEach((zPos) => {
      const earGroup = new THREE.Group();
      const earBase = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.52, 12), bodyMat);
      const earTip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 10), darkTipMat);
      earTip.position.y = 0.16;
      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 10), creamWhiteMat);
      innerEar.position.set(0.07, -0.04, 0);
      earGroup.add(earBase, earTip, innerEar);
      earGroup.position.set(-0.02, 0.62, zPos);
      earGroup.rotation.x = zPos < 0 ? -0.28 : 0.28;
      headGroup.add(earGroup);
    });
  } else if (earStyle === 'corgi' || earStyle === 'shiba' || earStyle === 'cat') {
    const isSiamese = breedMeta.facePattern === 'siamese_points';
    const earMat = isSiamese ? darkTipMat : bodyMat;
    const isCorgi = earStyle === 'corgi';
    const earGeo = new THREE.ConeGeometry(isCorgi ? 0.23 : 0.2, isCorgi ? 0.52 : 0.44, 12);
    const innerEarGeo = new THREE.ConeGeometry(0.11, 0.3, 10);
    const zSpan = earStyle === 'cat' ? 0.34 : isCorgi ? 0.32 : 0.27;
    [-zSpan, zSpan].forEach((zPos) => {
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(0, earStyle === 'cat' ? 0.54 : 0.6, zPos);
      ear.rotation.x = zPos < 0 ? -0.26 : 0.26;
      const innerEar = new THREE.Mesh(innerEarGeo, innerPinkMat);
      innerEar.position.set(0.06, -0.02, 0);
      ear.add(innerEar);
      headGroup.add(ear);
    });
  } else if (earStyle === 'folded_cat') {
    const earGeo = new THREE.ConeGeometry(0.18, 0.3, 10);
    [-0.4, 0.4].forEach((zPos) => {
      const ear = new THREE.Mesh(earGeo, bodyMat);
      ear.position.set(0.08, 0.38, zPos);
      ear.rotation.x = zPos < 0 ? -1.18 : 1.18;
      ear.rotation.z = -0.25;
      headGroup.add(ear);
    });
  } else if (earStyle === 'pug' || earStyle === 'dog_floppy') {
    const earMat = earStyle === 'pug' ? darkTipMat : bodyMat;
    const earGeo = new THREE.CapsuleGeometry(0.12, 0.34, 6, 10);
    [-0.48, 0.48].forEach((zPos) => {
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(0.04, 0.14, zPos);
      ear.rotation.x = zPos < 0 ? 0.22 : -0.22;
      ear.rotation.z = -0.15;
      headGroup.add(ear);
    });
  } else if (earStyle === 'alpaca') {
    const earGeo = new THREE.CapsuleGeometry(0.075, 0.34, 6, 10);
    [-0.24, 0.24].forEach((zPos) => {
      const ear = new THREE.Mesh(earGeo, bodyMat);
      ear.position.set(-0.02, 0.66, zPos);
      ear.rotation.x = zPos < 0 ? -0.18 : 0.18;
      headGroup.add(ear);
    });
  } else if (earStyle === 'duck') {
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.32 });
    const upperBill = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.1, 16), beakMat);
    upperBill.scale.set(1.25, 1.0, 1.15);
    upperBill.position.set(0.58, -0.06, 0);
    const lowerBill = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 16), beakMat);
    lowerBill.scale.set(1.15, 1.0, 1.05);
    lowerBill.position.set(0.55, -0.13, 0);
    headGroup.add(upperBill, lowerBill);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 8), bodyMat);
    tuft.position.set(-0.04, 0.64, 0);
    tuft.rotation.z = 0.35;
    headGroup.add(tuft);
  } else if (earStyle === 'panda') {
    [-0.44, 0.44].forEach((zPos) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 12), darkTipMat);
      ear.position.set(-0.02, 0.48, zPos);
      const eyePatch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), darkTipMat);
      eyePatch.scale.set(0.42, 1.22, 1.35);
      eyePatch.rotation.x = zPos < 0 ? 0.3 : -0.3;
      eyePatch.position.set(0.46, 0.06, zPos * 0.5);
      headGroup.add(ear, eyePatch);
    });
  } else if (earStyle === 'frog') {
    [-0.3, 0.3].forEach((zPos) => {
      const eyeBump = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), bodyMat);
      eyeBump.position.set(0.18, 0.44, zPos);
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), pureWhiteMat);
      sclera.position.set(0.32, 0.48, zPos);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), darkTipMat);
      pupil.position.set(0.44, 0.49, zPos);
      headGroup.add(eyeBump, sclera, pupil);
    });
  } else if (earStyle === 'seal') {
    const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.72, 10), bodyMat);
    tailFin.position.set(-0.75, 0.48, 0);
    tailFin.rotation.z = 1.25;
    fallbackGroup.add(tailFin);
  } else if (earStyle === 'monkey') {
    // หูลิงกลมใหญ่กางออกด้านข้างซ้าย-ขวาชัดเจน
    [-0.6, 0.6].forEach((zPos) => {
      const earOuter = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 14), bodyMat);
      earOuter.scale.set(0.45, 1.05, 1.0);
      earOuter.position.set(0.02, 0.06, zPos);
      const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), creamWhiteMat);
      earInner.scale.set(0.5, 0.95, 0.9);
      earInner.position.set(0.06, 0.06, zPos * 0.98);
      headGroup.add(earOuter, earInner);
    });
  } else if (earStyle === 'capybara') {
    // หูคาปิบาร่าเล็กมนอยู่ค่อนไปด้านหลังกะโหลกสี่เหลี่ยม
    [-0.32, 0.32].forEach((zPos) => {
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.65 })
      );
      ear.scale.set(0.65, 1.1, 0.9);
      ear.position.set(-0.22, 0.46, zPos);
      headGroup.add(ear);
    });
  } else if (earStyle === 'bear') {
    const earGeo = new THREE.SphereGeometry(0.2, 14, 14);
    const innerGeo = new THREE.SphereGeometry(0.11, 10, 10);
    [-0.44, 0.44].forEach((zPos) => {
      const ear = new THREE.Mesh(earGeo, bodyMat);
      ear.scale.set(0.55, 1.0, 1.0);
      ear.position.set(-0.02, 0.48, zPos);
      const inner = new THREE.Mesh(innerGeo, innerPinkMat);
      inner.scale.set(0.5, 0.9, 0.9);
      inner.position.set(0.05, 0.48, zPos);
      headGroup.add(ear, inner);
    });
  } else if (earStyle === 'pig') {
    // หูหมูพับปรกไปด้านหน้าสุดน่ารัก (และหูวัวกางออกด้านข้างสำหรับ dairy_cow)
    if (breedMeta.id === 'dairy_cow') {
      [-0.54, 0.54].forEach((zPos) => {
        const cowEar = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 6, 10), bodyMat);
        cowEar.position.set(0.02, 0.32, zPos);
        cowEar.rotation.x = zPos < 0 ? -1.15 : 1.15;
        headGroup.add(cowEar);
      });
    } else {
      const earGeo = new THREE.ConeGeometry(0.18, 0.34, 10);
      [-0.34, 0.34].forEach((zPos) => {
        const ear = new THREE.Mesh(earGeo, coralSnoutMat);
        ear.position.set(0.16, 0.46, zPos);
        ear.rotation.z = -0.55;
        ear.rotation.x = zPos < 0 ? -0.35 : 0.35;
        headGroup.add(ear);
      });
    }
  }

  // Face Patterns (masks, points, wrinkles, spots)
  if (breedMeta.facePattern === 'mask_white' || breedMeta.facePattern === 'husky_mask') {
    const blaze = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.24, 6, 10), creamWhiteMat);
    blaze.position.set(0.48 + faceXOffset, 0.08, 0);
    blaze.rotation.z = 0.22;
    headGroup.add(blaze);
    if (breedMeta.facePattern === 'husky_mask') {
      [-0.16, 0.16].forEach((zPos) => {
        const brow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), pureWhiteMat);
        brow.scale.set(0.45, 0.85, 0.85);
        brow.position.set(0.49 + faceXOffset, 0.15, zPos);
        headGroup.add(brow);
      });
    }
  } else if (breedMeta.facePattern === 'pug_wrinkle' || breedMeta.facePattern === 'siamese_points') {
    const maskMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.7 });
    const muzzleMask = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), maskMat);
    muzzleMask.scale.set(0.55, 0.72, 1.15);
    muzzleMask.position.set(0.42 + faceXOffset, -0.08, 0);
    headGroup.add(muzzleMask);
  } else if (breedMeta.facePattern === 'raccoon_mask') {
    [-0.2, 0.2].forEach((zPos) => {
      const band = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), darkTipMat);
      band.scale.set(0.42, 0.88, 1.45);
      band.position.set(0.47 + faceXOffset, 0.04, zPos);
      headGroup.add(band);
    });
  } else if (breedMeta.facePattern === 'red_panda') {
    [-0.17, 0.17].forEach((zPos) => {
      const browDot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), pureWhiteMat);
      browDot.position.set(0.51 + faceXOffset, 0.16, zPos);
      headGroup.add(browDot);
    });
  } else if (breedMeta.facePattern === 'calico' || breedMeta.facePattern === 'cow_spots') {
    const spotMat = new THREE.MeshStandardMaterial({
      color: breedMeta.facePattern === 'calico' ? 0xf97316 : 0x18181b,
      roughness: 0.6,
    });
    const headSpot = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), spotMat);
    headSpot.scale.set(0.6, 0.7, 0.85);
    headSpot.position.set(0.22, 0.3, 0.3);
    headGroup.add(headSpot);
    if (breedMeta.facePattern === 'cow_spots') {
      const spot2 = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), spotMat);
      spot2.position.set(0.15, 0.18, -0.38);
      headGroup.add(spot2);
    }
  }

  // Head Toppers (Capybara Orange / Alpaca Fluff)
  if (breedMeta.headTopper === 'capybara_orange') {
    const yuzu = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 })
    );
    yuzu.position.set(0.05, 0.62, 0);
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.13, 6),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 })
    );
    leaf.position.set(0.05, 0.79, 0);
    leaf.rotation.z = -0.4;
    headGroup.add(yuzu, leaf);
  } else if (breedMeta.headTopper === 'alpaca_fluff') {
    [
      [0.12, 0.58, 0, 0.24],
      [-0.06, 0.56, -0.18, 0.2],
      [-0.06, 0.56, 0.18, 0.2],
      [0.02, 0.48, -0.34, 0.16],
      [0.02, 0.48, 0.34, 0.16],
    ].forEach(([fx, fy, fz, fr]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(fr, 12, 12), pureWhiteMat);
      puff.position.set(fx, fy, fz);
      headGroup.add(puff);
    });
  }

  // Cat & Seal Whiskers
  if (breedMeta.whiskers || earStyle === 'seal') {
    const whiskerGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.28, 5);
    [-1, 1].forEach((side) => {
      [-0.05, 0.0, 0.05].forEach((wy, wi) => {
        const wMesh = new THREE.Mesh(whiskerGeo, darkTipMat);
        wMesh.position.set(0.45 + faceXOffset, -0.1 + wy, side * 0.42);
        wMesh.rotation.x = Math.PI / 2 + side * ((wi - 1) * 0.16);
        headGroup.add(wMesh);
      });
    });
  }

  // Tail Styles (มนุษย์ฮีโร่ไม่มีหางสัตว์!)
  let tailAttachObj: THREE.Object3D | null = null;
  if (!isHeroChar && earStyle !== 'seal') {
    if (breedMeta.tailStyle === 'fluffy') {
      const tailGroup = new THREE.Group();
      const tailBase = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.85, 12), bodyMat);
      const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 12), creamWhiteMat);
      tailTip.position.y = 0.4;
      tailGroup.add(tailBase, tailTip);
      tailGroup.position.set(-0.8, 0.72, 0);
      tailGroup.rotation.z = 1.05;
      fallbackGroup.add(tailGroup);
      tailAttachObj = tailGroup;
    } else if (breedMeta.tailStyle === 'curly') {
      const curlyTail = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 14, Math.PI * 1.45), coralSnoutMat);
      curlyTail.position.set(-0.74, 0.92, 0);
      curlyTail.rotation.y = Math.PI / 2;
      fallbackGroup.add(curlyTail);
      tailAttachObj = curlyTail;
    } else if (breedMeta.tailStyle === 'long') {
      const tailMat = breedMeta.facePattern === 'siamese_points' ? darkTipMat : bodyMat;
      const longTail = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.78, 10), tailMat);
      longTail.position.set(-0.78, 0.85, 0);
      longTail.rotation.z = 0.85;
      fallbackGroup.add(longTail);
      tailAttachObj = longTail;
    } else if (breedMeta.tailStyle === 'dino_spikes') {
      const dinoTail = new THREE.Group();
      const base = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.92, 10), bodyMat);
      const spikeYellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
      [-0.15, 0.12].forEach((sy) => {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), spikeYellow);
        sp.position.set(0.14, sy, 0);
        sp.rotation.z = -Math.PI / 2;
        dinoTail.add(sp);
      });
      dinoTail.add(base);
      dinoTail.position.set(-0.82, 0.72, 0);
      dinoTail.rotation.z = 1.15;
      fallbackGroup.add(dinoTail);
      tailAttachObj = dinoTail;
    } else if (breedMeta.tailStyle === 'dragon_spade') {
      const dragTail = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.82, 8), bodyMat);
      const spade = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.3 })
      );
      spade.scale.set(0.8, 1.35, 0.35);
      spade.position.y = 0.48;
      dragTail.add(shaft, spade);
      dragTail.position.set(-0.82, 0.78, 0);
      dragTail.rotation.z = 0.95;
      fallbackGroup.add(dragTail);
      tailAttachObj = dragTail;
    } else if (breedMeta.tailStyle === 'rainbow') {
      const rbTail = new THREE.Group();
      [0xf472b6, 0x38bdf8, 0xfacc15].forEach((col, ri) => {
        const strand = new THREE.Mesh(
          new THREE.ConeGeometry(0.14, 0.72, 8),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 })
        );
        strand.position.set(0, ri * 0.08, (ri - 1) * 0.12);
        rbTail.add(strand);
      });
      rbTail.position.set(-0.8, 0.76, 0);
      rbTail.rotation.z = 1.05;
      fallbackGroup.add(rbTail);
      tailAttachObj = rbTail;
    } else if (breedMeta.tailStyle === 'kitsune_multi') {
      const multiTail = new THREE.Group();
      const tipRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
      [-0.38, 0, 0.38].forEach((ang) => {
        const tUnit = new THREE.Group();
        const b = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.76, 10), pureWhiteMat);
        const tp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 8), tipRed);
        tp.position.y = 0.35;
        tUnit.add(b, tp);
        tUnit.rotation.x = ang;
        multiTail.add(tUnit);
      });
      multiTail.position.set(-0.82, 0.76, 0);
      multiTail.rotation.z = 1.02;
      fallbackGroup.add(multiTail);
      tailAttachObj = multiTail;
    } else {
      const stubTail = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), pureWhiteMat);
      stubTail.position.set(-0.73, 0.84, 0);
      fallbackGroup.add(stubTail);
      tailAttachObj = stubTail;
    }
  }

  // Breed-specific facial expressions, noses & eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.12, metalness: 0.08 });
  const specMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const normalEyes = new THREE.Group();

  if (earStyle === 'monkey') {
    // หน้ากากรูปหัวใจบนใบหน้าลิง
    [-0.14, 0.14].forEach((mz) => {
      const maskLobe = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), creamWhiteMat);
      maskLobe.scale.set(0.42, 0.92, 0.9);
      maskLobe.position.set(0.42, 0.06, mz);
      headGroup.add(maskLobe);
    });
  } else if (earStyle === 'pug' || breedMeta.id === 'frenchie') {
    const wrinkle = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.02, 6, 12, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x574332, roughness: 0.75 })
    );
    wrinkle.position.set(0.56 + faceXOffset, 0.06, 0);
    wrinkle.rotation.y = Math.PI / 2;
    headGroup.add(wrinkle);
  }

  // Nose positioned cleanly on each species's snout tip (มนุษย์ฮีโร่มีจมูกจิบิแล้วใน buildHeroHead3D)
  if (earStyle === 'pig') {
    const isCow = breedMeta.id === 'dairy_cow';
    const nostrilZ = isCow ? 0.15 : 0.075;
    const nostrilX = isCow ? 0.67 : 0.68;
    const nostrilY = isCow ? -0.14 : -0.07;
    [-nostrilZ, nostrilZ].forEach((nz) => {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), darkTipMat);
      nostril.scale.set(0.6, 1.25, 0.85);
      nostril.position.set(nostrilX, nostrilY, nz);
      headGroup.add(nostril);
    });
  } else if (!isHeroChar && earStyle !== 'duck' && earStyle !== 'frog' && earStyle !== 'capybara') {
    const isFoxLike = earStyle === 'fox' || breedMeta.facePattern === 'red_panda' || breedMeta.facePattern === 'raccoon_mask';
    const isDogLong = earStyle === 'corgi' || earStyle === 'shiba' || earStyle === 'dog_floppy';
    const isBearLike = earStyle === 'bear' || earStyle === 'panda';
    const noseRadius = isFoxLike || isDogLong || isBearLike ? 0.062 : 0.042;
    const noseX = isFoxLike
      ? 0.81
      : isDogLong
      ? 0.72
      : isBearLike
      ? 0.74
      : earStyle === 'seal'
      ? 0.68
      : 0.59 + faceXOffset;
    const noseY = isFoxLike ? -0.04 : isDogLong || isBearLike ? -0.05 : -0.05;
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(noseRadius, 12, 12),
      earStyle === 'bunny' || earStyle === 'lop' || earStyle === 'cat' || earStyle === 'folded_cat'
        ? coralSnoutMat
        : darkTipMat
    );
    nose.scale.set(0.95, 0.78, 1.22);
    nose.position.set(noseX, noseY, 0);
    headGroup.add(nose);
  }

  // Eyes & Mouth customized by breed / Chibi Human Hero silhouette
  if (isHeroChar) {
    if (!heroFaceFlags.hideStandardEyes) {
      const isDeadpan = breedMeta.heroStyle === 'bald_hero';
      const eyeR = isDeadpan ? 0.048 : 0.078;
      [-0.19, 0.19].forEach((zPos) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 16, 16), eyeMat);
        eye.scale.set(0.68, isDeadpan ? 0.95 : 1.18, 0.96);
        eye.position.set(0.53, 0.06, zPos);
        normalEyes.add(eye);

        if (!isDeadpan) {
          const spec1 = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), specMat);
          spec1.position.set(0.575, 0.095, zPos - 0.02);
          normalEyes.add(spec1);
        }

        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.13), eyeMat);
        brow.position.set(0.53, 0.19, zPos);
        brow.rotation.x = zPos < 0 ? 0.16 : -0.16;
        normalEyes.add(brow);
      });
    }

    if (!heroFaceFlags.hideStandardMouth) {
      if (breedMeta.heroStyle === 'bald_hero') {
        const flatMouth = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.022, 0.12), eyeMat);
        flatMouth.position.set(0.55, -0.14, 0);
        normalEyes.add(flatMouth);
      } else {
        const heroSmile = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.015, 8, 14, Math.PI), eyeMat);
        heroSmile.position.set(0.54, -0.11, 0);
        heroSmile.rotation.y = Math.PI / 2;
        heroSmile.rotation.z = Math.PI;
        normalEyes.add(heroSmile);
      }
    }
  } else if (earStyle === 'capybara') {
    // ตาตี่ชิลล์ๆ ด้านข้างหัวทรงขนมปัง (-_-)
    [-0.46, 0.46].forEach((zPos) => {
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.036, 0.04), eyeMat);
      slit.position.set(0.26, 0.14, zPos);
      headGroup.add(slit);
    });
  } else if (earStyle === 'frog') {
    // ปากกบยิ้มกว้างพาดเต็มใบหน้าแบน
    const frogSmile = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.024, 8, 20, Math.PI), eyeMat);
    frogSmile.position.set(0.52, -0.04, 0);
    frogSmile.rotation.y = Math.PI / 2;
    frogSmile.rotation.z = Math.PI;
    normalEyes.add(frogSmile);
  } else {
    const isPuppyBig = earStyle === 'pug' || breedMeta.id === 'frenchie' || earStyle === 'lop';
    const isFoxSlant = earStyle === 'fox';
    const eyeRadius = isPuppyBig ? 0.095 : 0.074;
    const eyeZ = earStyle === 'pig' ? 0.23 : earStyle === 'duck' ? 0.21 : isPuppyBig ? 0.22 : 0.19;
    const eyeX = 0.54 + faceXOffset;
    const eyeY = earStyle === 'pig' || earStyle === 'bear' || earStyle === 'panda' ? 0.08 : 0.05;

    [-eyeZ, eyeZ].forEach((zPos) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeMat);
      eye.scale.set(
        0.72,
        isFoxSlant ? 0.92 : earStyle === 'cat' || earStyle === 'folded_cat' ? 1.28 : 1.12,
        isFoxSlant ? 1.18 : 0.98
      );
      if (isFoxSlant) {
        eye.rotation.x = zPos < 0 ? 0.22 : -0.22;
      }
      eye.position.set(eyeX, eyeY, zPos);
      const spec1 = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), specMat);
      spec1.position.set(eyeX + 0.052, eyeY + 0.035, zPos - 0.02);
      normalEyes.add(eye, spec1);

      if (breedMeta.facePattern === 'husky_mask') {
        const coolBrow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.028, 0.12), darkTipMat);
        coolBrow.position.set(eyeX + 0.02, eyeY + 0.11, zPos);
        coolBrow.rotation.x = zPos < 0 ? 0.25 : -0.25;
        normalEyes.add(coolBrow);
      }
    });

    if (earStyle !== 'duck' && earStyle !== 'pig') {
      const smileX =
        earStyle === 'fox'
          ? 0.66
          : earStyle === 'corgi' || earStyle === 'shiba' || earStyle === 'dog_floppy' || earStyle === 'bear' || earStyle === 'panda'
          ? 0.68
          : 0.58 + faceXOffset;
      [-0.034, 0.034].forEach((mz) => {
        const smileArc = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 12, Math.PI), eyeMat);
        smileArc.position.set(smileX, -0.12, mz);
        smileArc.rotation.y = Math.PI / 2;
        smileArc.rotation.z = Math.PI;
        normalEyes.add(smileArc);
      });
    }
  }
  headGroup.add(normalEyes);

  const happyFace = new THREE.Group();
  happyFace.visible = false;
  const arcGeo = new THREE.TorusGeometry(0.09, 0.028, 8, 14, Math.PI);
  const happyEyeL = new THREE.Mesh(arcGeo, eyeMat);
  happyEyeL.position.set(0.5 + faceXOffset, 0.06, -0.22);
  happyEyeL.rotation.y = Math.PI / 2;
  const happyEyeR = new THREE.Mesh(arcGeo, eyeMat);
  happyEyeR.position.set(0.5 + faceXOffset, 0.06, 0.22);
  happyEyeR.rotation.y = Math.PI / 2;
  const smileMesh = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 14, Math.PI), eyeMat);
  smileMesh.position.set(0.53 + faceXOffset, -0.05, 0);
  smileMesh.rotation.y = Math.PI / 2;
  smileMesh.rotation.z = Math.PI;
  happyFace.add(happyEyeL, happyEyeR, smileMesh);
  headGroup.add(happyFace);

  const angryFace = new THREE.Group();
  angryFace.visible = false;
  const browGeo = new THREE.BoxGeometry(0.05, 0.045, 0.2);
  const browL = new THREE.Mesh(browGeo, eyeMat);
  browL.position.set(0.53 + faceXOffset, 0.2, -0.2);
  browL.rotation.x = 0.45;
  const browR = new THREE.Mesh(browGeo, eyeMat);
  browR.position.set(0.53 + faceXOffset, 0.2, 0.2);
  browR.rotation.x = -0.45;
  const frownMesh = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 12, Math.PI), eyeMat);
  frownMesh.position.set(0.53 + faceXOffset, -0.14, 0);
  frownMesh.rotation.y = Math.PI / 2;
  angryFace.add(browL, browR, frownMesh);
  headGroup.add(angryFace);

  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xfda4af, transparent: true, opacity: 0.82 });
  const cheekZ = earStyle === 'pig' || earStyle === 'frog' ? 0.4 : 0.33;
  const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), cheekMat);
  cheekL.scale.set(0.32, 0.56, 1.05);
  cheekL.position.set(0.46 + faceXOffset, -0.08, -cheekZ);
  const cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), cheekMat);
  cheekR.scale.set(0.32, 0.56, 1.05);
  cheekR.position.set(0.46 + faceXOffset, -0.08, cheekZ);
  headGroup.add(cheekL, cheekR);

  // Equipped Fashion / Sporty Hat
  const hatSlotGroup = new THREE.Group();
  headGroup.add(hatSlotGroup);

  const accMat = new THREE.MeshStandardMaterial({ color: bandColor, roughness: 0.35 });
  if (equipHat && equipHat !== 'none') {
    if (equipHat === 'hat_red_bow') {
      const bowMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
      const loopL = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 12), bowMat);
      loopL.rotation.x = Math.PI / 2;
      loopL.position.set(0.12, 0.56, -0.2);
      const loopR = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 12), bowMat);
      loopR.rotation.x = -Math.PI / 2;
      loopR.position.set(0.12, 0.56, 0.2);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), bowMat);
      knot.position.set(0.14, 0.56, 0);
      hatSlotGroup.add(loopL, loopR, knot);
    } else if (equipHat === 'hat_knight_helm') {
      // หมวกแก๊ปสปอร์ตนักวิ่ง (Baseball Cap — แทนหมวกเหล็กอัศวิน)
      const capMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
      const visorMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45 });
      const capCrown = new THREE.Mesh(
        new THREE.SphereGeometry(0.56, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
        capMat
      );
      capCrown.position.y = 0.14;
      const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16, 1, false, -Math.PI * 0.38, Math.PI * 0.76), visorMat);
      visor.rotation.y = Math.PI / 2;
      visor.position.set(0.28, 0.2, 0);
      const topBtn = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), pureWhiteMat);
      topBtn.position.set(0, 0.7, 0);
      hatSlotGroup.add(capCrown, visor, topBtn);
    } else if (equipHat === 'hat_tiara' || equipHat === 'hat_ice_crown') {
      const isIce = equipHat === 'hat_ice_crown';
      const crownMat = new THREE.MeshStandardMaterial({
        color: isIce ? 0x38bdf8 : 0xfacc15,
        metalness: 0.5,
        roughness: 0.25,
        emissive: isIce ? 0x0284c7 : 0xca8a04,
        emissiveIntensity: 0.2,
      });
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.16, 16), crownMat);
      ring.position.y = 0.55;
      hatSlotGroup.add(ring);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 8), crownMat);
        sp.position.set(Math.cos(a) * 0.24, 0.68, Math.sin(a) * 0.24);
        hatSlotGroup.add(sp);
      }
    } else if (equipHat === 'hat_robin') {
      // หมวกบักเก็ตแคมป์ปิ้ง (Bucket Hat)
      const bucketMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.65 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.28, 18), bucketMat);
      crown.position.y = 0.52;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 20), bucketMat);
      brim.position.y = 0.38;
      const bandRibbon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.445, 0.445, 0.06, 18),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 })
      );
      bandRibbon.position.y = 0.42;
      hatSlotGroup.add(crown, brim, bandRibbon);
    } else if (equipHat === 'hat_fez') {
      // หมวกไหมพรมบีนนี่มีปอมปอมกลมบนหัว (Knit Beanie)
      const knitMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.75 });
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.54, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        knitMat
      );
      dome.position.y = 0.18;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.08, 10, 22), knitMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = 0.24;
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), pureWhiteMat);
      pom.position.y = 0.74;
      hatSlotGroup.add(dome, cuff, pom);
    } else if (equipHat === 'hat_gacha_sprout') {
      // 🌱 ต้นอ่อนนำโชคงอกบนหัว (Rare Gachapon)
      const greenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45 });
      const lightLeafMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.4 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.34, 8), greenMat);
      stem.position.set(0.04, 0.68, 0);
      stem.rotation.z = -0.14;
      const leafL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), lightLeafMat);
      leafL.scale.set(0.65, 0.25, 1.35);
      leafL.position.set(0.07, 0.85, -0.14);
      leafL.rotation.x = -0.38;
      const leafR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), lightLeafMat);
      leafR.scale.set(0.65, 0.25, 1.35);
      leafR.position.set(0.07, 0.85, 0.14);
      leafR.rotation.x = 0.38;
      hatSlotGroup.add(stem, leafL, leafR);
    } else if (equipHat === 'hat_gacha_chef') {
      // 👨‍🍳 หมวกเชฟมิชลินจอมโซ้ย (Rare Gachapon)
      const chefBand = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.22, 18), pureWhiteMat);
      chefBand.position.y = 0.56;
      hatSlotGroup.add(chefBand);
      for (let i = 0; i < 6; i++) {
        const ca = (i / 6) * Math.PI * 2;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), pureWhiteMat);
        puff.position.set(Math.cos(ca) * 0.2, 0.78, Math.sin(ca) * 0.2);
        hatSlotGroup.add(puff);
      }
      const centerPuff = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), pureWhiteMat);
      centerPuff.position.y = 0.84;
      hatSlotGroup.add(centerPuff);
    } else if (equipHat === 'hat_gacha_angel_halo') {
      // 😇 วงแหวนเทวดาเรืองแสงลอยเหนือหัว (Epic Gachapon)
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
      const haloGlowMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.45,
      });
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.048, 12, 28), haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.92;
      const haloOuter = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.085, 10, 24), haloGlowMat);
      haloOuter.rotation.x = Math.PI / 2;
      haloOuter.position.y = 0.92;
      hatSlotGroup.add(halo, haloOuter);
    } else if (equipHat === 'hat_ms_orange_shroom') {
      // 🍄 หมวกเห็ดส้มเมเปิ้ลในตำนาน (Orange Mushroom Cap)
      const shroomOrange = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.48 });
      const shroomSpot = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.45 });
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.56, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
        shroomOrange
      );
      cap.scale.set(1.06, 0.86, 1.06);
      cap.position.y = 0.36;
      const underStem = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.14, 18), creamWhiteMat);
      underStem.position.y = 0.36;
      hatSlotGroup.add(cap, underStem);
      for (let s = 0; s < 6; s++) {
        const sa = (s / 6) * Math.PI * 2;
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), shroomSpot);
        spot.scale.set(1, 0.45, 1);
        spot.position.set(Math.cos(sa) * 0.38, 0.66, Math.sin(sa) * 0.38);
        hatSlotGroup.add(spot);
      }
    } else if (equipHat === 'hat_ms_pink_beret') {
      // 🎨 หมวกเบเร่ต์ศิลปินสีชมพูซากุระเอียงข้าง (MapleSim Pastel Beret)
      const beretGroup = new THREE.Group();
      const beretMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.62 });
      const beretDisc = new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 14), beretMat);
      beretDisc.scale.set(1.05, 0.38, 1.08);
      const beretStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), pureWhiteMat);
      beretStem.position.y = 0.2;
      beretGroup.add(beretDisc, beretStem);
      beretGroup.position.set(0.04, 0.56, 0.12);
      beretGroup.rotation.x = 0.24;
      beretGroup.rotation.z = -0.1;
      hatSlotGroup.add(beretGroup);
    } else if (equipHat === 'hat_ms_floral_wreath') {
      // 🌼 มงกุฎดอกไม้ป่าเอลิน่า (MapleSim Floral Crown)
      const vine = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.038, 10, 24),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 })
      );
      vine.rotation.x = Math.PI / 2;
      vine.position.y = 0.38;
      vine.rotation.y = 0.15;
      hatSlotGroup.add(vine);
      const flowerColors = [0xf472b6, 0xfde047, 0x60a5fa, 0xffffff, 0xc084fc, 0xfb7185, 0xfef08a, 0x38bdf8];
      flowerColors.forEach((fCol, fi) => {
        const fa = (fi / flowerColors.length) * Math.PI * 2;
        const bloom = new THREE.Mesh(
          new THREE.SphereGeometry(0.095, 10, 10),
          new THREE.MeshStandardMaterial({ color: fCol, roughness: 0.4 })
        );
        bloom.position.set(Math.cos(fa) * 0.51, 0.4, Math.sin(fa) * 0.51);
        hatSlotGroup.add(bloom);
      });
    } else if (equipHat === 'hat_gacha_slime_crown') {
      // 💧 สไลม์เขียวนุ่มนิ่มเกาะหัว (MapleSim Green Slime Hat)
      const slimeMat = new THREE.MeshPhysicalMaterial({
        color: 0x4ade80,
        roughness: 0.16,
        transmission: 0.25,
        transparent: true,
        opacity: 0.92,
      });
      const slimeBody = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 16), slimeMat);
      slimeBody.scale.set(1.08, 0.86, 1.08);
      slimeBody.position.set(0.06, 0.72, 0);
      const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.22, 8), slimeMat);
      antennaStem.position.set(0.02, 1.02, 0);
      antennaStem.rotation.z = 0.25;
      const antennaBall = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), slimeMat);
      antennaBall.position.set(-0.04, 1.14, 0);
      hatSlotGroup.add(slimeBody, antennaStem, antennaBall);
      [-0.11, 0.11].forEach((sz) => {
        const sEye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), darkTipMat);
        sEye.position.set(0.36, 0.72, sz);
        hatSlotGroup.add(sEye);
      });
    } else if (equipHat === 'hat_gacha_pepe_hood') {
      // 🐧 หมวกเพนกวินราชาเปเป้ (King Pepe Hood)
      const pepeBlue = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.48 });
      const pepeBeak = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.38 });
      const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 16), pepeBlue);
      pHead.scale.set(1.02, 0.88, 1.06);
      pHead.position.set(0.06, 0.72, 0);
      const pFace = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), pureWhiteMat);
      pFace.position.set(0.18, 0.69, 0);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 10), pepeBeak);
      beak.rotation.z = -Math.PI / 2;
      beak.scale.set(1, 1, 1.35);
      beak.position.set(0.47, 0.66, 0);
      const miniCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.11, 10), pepeBeak);
      miniCrown.position.set(0.04, 1.06, 0);
      hatSlotGroup.add(pHead, pFace, beak, miniCrown);
      [-0.12, 0.12].forEach((pz) => {
        const pEye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), darkTipMat);
        pEye.position.set(0.43, 0.75, pz);
        hatSlotGroup.add(pEye);
      });
    } else if (equipHat && equipHat !== 'none') {
      const extraHatGroup = new THREE.Group();
      if (buildExtraHat3D(equipHat, extraHatGroup)) {
        extraHatGroup.position.y = 0.42;
        hatSlotGroup.add(extraHatGroup);
      }
    }
  } else if (accessory === 'headband' || accessory === 'chubby') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.065, 10, 24), accMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.22;
    hatSlotGroup.add(band);
  } else if (accessory === 'shades') {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.65), accMat);
    glass.position.set(0.52 + faceXOffset, 0.08, 0);
    hatSlotGroup.add(glass);
  } else if (accessory === 'cap') {
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
      accMat
    );
    capDome.position.y = 0.12;
    hatSlotGroup.add(capDome);
  }
  if (propColors?.hat && hatSlotGroup.children.length > 0) {
    const hatShopItem = SHOP_ITEMS.find((it) => it.id === equipHat);
    applyCustomDyeToGroup(hatSlotGroup, propColors.hat, hatShopItem?.colorHex);
  }

  // Face / Glasses Slot (แว่นตา & แอคเซสเซอรี่หน้า)
  const faceSlotGroup = new THREE.Group();
  headGroup.add(faceSlotGroup);
  if (equipFace === 'face_sunglasses') {
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.15, metalness: 0.5 });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.18), shadeMat);
    bridge.position.set(0.58 + faceXOffset, 0.06, 0);
    [-0.18, 0.18].forEach((zPos) => {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.19), shadeMat);
      lens.position.set(0.58 + faceXOffset, 0.05, zPos);
      faceSlotGroup.add(lens);
    });
    faceSlotGroup.add(bridge);
  } else if (equipFace === 'face_nerd_glasses') {
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.25 });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.12), rimMat);
    bridge.position.set(0.58 + faceXOffset, 0.05, 0);
    [-0.18, 0.18].forEach((zPos) => {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 8, 18), rimMat);
      rim.rotation.y = Math.PI / 2;
      rim.position.set(0.58 + faceXOffset, 0.04, zPos);
      faceSlotGroup.add(rim);
    });
    faceSlotGroup.add(bridge);
  } else if (equipFace === 'face_fox_mask') {
    const maskGroup = new THREE.Group();
    const maskBase = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.28, 6),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    maskBase.rotation.z = -Math.PI / 2;
    const stripeL = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    stripeL.position.set(0.05, 0.04, -0.08);
    const stripeR = stripeL.clone();
    stripeR.position.z = 0.08;
    maskGroup.add(maskBase, stripeL, stripeR);
    maskGroup.position.set(0.32, 0.44, 0.36);
    maskGroup.rotation.y = -0.55;
    maskGroup.rotation.z = 0.25;
    faceSlotGroup.add(maskGroup);
  } else if (equipFace === 'face_toast') {
    const toastGroup = new THREE.Group();
    const crust = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.22, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 })
    );
    const crumb = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.18, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 })
    );
    toastGroup.add(crust, crumb);
    toastGroup.position.set(0.64 + faceXOffset, -0.14, 0.06);
    toastGroup.rotation.y = Math.PI / 2;
    toastGroup.rotation.z = -0.22;
    faceSlotGroup.add(toastGroup);
  } else if (equipFace === 'face_gacha_star_shades') {
    // 🤩 แว่นตาดาวซุปตาร์กรอบทองเลนส์ชมพู (Rare Gachapon)
    const starGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.75, roughness: 0.2 });
    const starLensMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xdb2777,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.16), starGoldMat);
    bridge.position.set(0.59 + faceXOffset, 0.06, 0);
    faceSlotGroup.add(bridge);
    [-0.2, 0.2].forEach((zPos) => {
      const starFrame = new THREE.Group();
      const centerDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.04, 12), starLensMat);
      centerDisc.rotation.z = Math.PI / 2;
      starFrame.add(centerDisc);
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2 - Math.PI / 2;
        const pt = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.12, 5), starGoldMat);
        pt.position.set(0, Math.sin(pa) * 0.11, Math.cos(pa) * 0.11);
        pt.rotation.x = Math.atan2(Math.cos(pa), Math.sin(pa));
        starFrame.add(pt);
      }
      starFrame.position.set(0.59 + faceXOffset, 0.06, zPos);
      faceSlotGroup.add(starFrame);
    });
  } else if (equipFace === 'face_ms_bandaid') {
    // 🩹 พลาสเตอร์แปะจมูกจอมซน (MapleSim Nose Band-Aid)
    const bandGroup = new THREE.Group();
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.085, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.65 })
    );
    const gauze = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.075, 0.09),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.7 })
    );
    bandGroup.add(strip, gauze);
    bandGroup.position.set(0.59 + faceXOffset, 0.02, 0);
    bandGroup.rotation.x = 0.16;
    faceSlotGroup.add(bandGroup);
  } else if (equipFace === 'face_ms_blush_hearts') {
    // 💕 สติกเกอร์แก้มหัวใจชมพูวิ้ง (MapleSim Rosy Heart Cheeks)
    const heartMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const blushGlowMat = new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.65 });
    [-0.29, 0.29].forEach((cz) => {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), blushGlowMat);
      glow.scale.set(0.35, 0.72, 1.15);
      glow.position.set(0.53 + faceXOffset, -0.08, cz);
      const hL = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), heartMat);
      hL.position.set(0.56 + faceXOffset, -0.06, cz - 0.022);
      const hR = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), heartMat);
      hR.position.set(0.56 + faceXOffset, -0.06, cz + 0.022);
      const hTip = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.065, 8), heartMat);
      hTip.rotation.x = Math.PI;
      hTip.position.set(0.56 + faceXOffset, -0.1, cz);
      faceSlotGroup.add(glow, hL, hR, hTip);
    });
  } else if (equipFace && equipFace !== 'face_none') {
    buildExtraFace3D(equipFace, faceSlotGroup);
  }
  if (propColors?.face && faceSlotGroup.children.length > 0) {
    const faceShopItem = SHOP_ITEMS.find((it) => it.id === equipFace);
    applyCustomDyeToGroup(faceSlotGroup, propColors.face, faceShopItem?.colorHex);
  }

  const legGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.45, 12);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(0, 0.25, -0.25);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0, 0.25, 0.25);

  const armRadius = 0.15 * Math.max(0.85, Math.min(1.65, muscleScale));
  const armGeo = new THREE.CapsuleGeometry(armRadius, 0.26, 8, 12);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(0.02, 1.12, -0.78);
  armL.rotation.x = 0.42;
  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(0.02, 1.12, 0.78);
  armR.rotation.x = -0.42;

  const activityUsesHands = [
    'dumbbell',
    'eat_pizza',
    'boba_tea',
    'picnic_shabu',
    'play_cards',
    'phone_scroll',
    'badminton',
    'boxing',
    'pullup',
    'pushup',
  ].includes(spectatorProp);

  // ของถือเล่นแนวไลฟ์สไตล์ & ฟิตเนส (ไม่มีอาวุธสงคราม และไม่ซ้อนทับอุปกรณ์ของกิจกรรมกองเชียร์)
  if (!activityUsesHands && equipWeapon === 'weapon_light_sword') {
    // ขวดเวย์โปรตีนเชคเกอร์ (Protein Shaker Bottle)
    const shakerGroup = new THREE.Group();
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.1, 0.36, 14),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25 })
    );
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.06, 14),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 })
    );
    lid.position.y = 0.21;
    const spout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0x18181b })
    );
    spout.position.set(0.04, 0.26, 0);
    shakerGroup.add(bottle, lid, spout);
    shakerGroup.position.set(0.22, 0.06, 0.04);
    armR.add(shakerGroup);
  } else if (!activityUsesHands && equipWeapon === 'weapon_magic_staff') {
    // แก้วชานมไข่มุกจัมโบ้ (Jumbo Boba Tea)
    const bobaGroup = new THREE.Group();
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.1, 0.36, 14),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.3 })
    );
    const pearls = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.1, 0.09, 12),
      new THREE.MeshStandardMaterial({ color: 0x18181b })
    );
    pearls.position.y = -0.13;
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0xf472b6 })
    );
    straw.position.set(0.03, 0.26, 0);
    straw.rotation.z = -0.18;
    bobaGroup.add(cup, pearls, straw);
    bobaGroup.position.set(0.22, 0.08, 0.04);
    armR.add(bobaGroup);
  } else if (!activityUsesHands && equipWeapon === 'weapon_gold_dumbbell') {
    const dbMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.65, roughness: 0.25 });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.52, 8), dbMat);
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 14), dbMat);
    p1.position.y = 0.2;
    const p2 = p1.clone();
    p2.position.y = -0.2;
    const dbGroup = new THREE.Group();
    dbGroup.add(bar, p1, p2);
    dbGroup.position.set(0.2, 0.02, 0.04);
    dbGroup.rotation.x = Math.PI / 2;
    armR.add(dbGroup);
  } else if (!activityUsesHands && equipWeapon === 'weapon_giant_fork') {
    // ไอศกรีมซอฟต์เสิร์ฟสตรอว์เบอร์รี (Soft-serve Ice Cream Cone)
    const iceGroup = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.32, 12),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
    );
    cone.rotation.x = Math.PI;
    cone.position.y = -0.06;
    const scoop1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.35 })
    );
    scoop1.position.y = 0.14;
    const scoop2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.35 })
    );
    scoop2.position.y = 0.28;
    iceGroup.add(cone, scoop1, scoop2);
    iceGroup.position.set(0.22, 0.1, 0.04);
    armR.add(iceGroup);
  } else if (!activityUsesHands && equipWeapon === 'weapon_broom') {
    // ไม้แบดมินตันสปอร์ต (Badminton Racket)
    const rkGroup = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x18181b })
    );
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.022, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    hoop.position.y = 0.38;
    hoop.scale.set(0.85, 1.15, 1);
    rkGroup.add(handle, hoop);
    rkGroup.position.set(0.22, 0.12, 0.04);
    rkGroup.rotation.z = -0.25;
    armR.add(rkGroup);
  } else if (!activityUsesHands && equipWeapon === 'weapon_gacha_golden_pan') {
    // 🍳 กระทะทองคำทอดไข่ดาว (Epic Gachapon)
    const panGroup = new THREE.Group();
    const goldPanMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.78, roughness: 0.22 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8), goldPanMat);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.06, 18), goldPanMat);
    bowl.rotation.z = Math.PI / 2;
    bowl.position.y = 0.28;
    const eggWhite = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.025, 14), pureWhiteMat);
    eggWhite.rotation.z = Math.PI / 2;
    eggWhite.position.set(0.03, 0.28, 0);
    const yolk = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.25 })
    );
    yolk.position.set(0.05, 0.28, 0);
    panGroup.add(handle, bowl, eggWhite, yolk);
    panGroup.position.set(0.22, 0.12, 0.04);
    panGroup.rotation.z = -0.25;
    armR.add(panGroup);
  } else if (!activityUsesHands && equipWeapon === 'weapon_gacha_jumbo_drumstick') {
    // 🍗 น่องไก่ทอดกรอบจัมโบ้ (Rare Gachapon)
    const chickenGroup = new THREE.Group();
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.5 });
    const crispyMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.72 });
    const boneShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 8), boneMat);
    const boneTip1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), boneMat);
    boneTip1.position.set(0, -0.14, -0.03);
    const boneTip2 = boneTip1.clone();
    boneTip2.position.set(0, -0.14, 0.03);
    const meat = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 14), crispyMat);
    meat.scale.set(0.95, 1.38, 0.95);
    meat.position.y = 0.16;
    chickenGroup.add(boneShaft, boneTip1, boneTip2, meat);
    chickenGroup.position.set(0.22, 0.1, 0.04);
    chickenGroup.rotation.z = -0.2;
    armR.add(chickenGroup);
  } else if (!activityUsesHands && equipWeapon === 'weapon_ms_lollipop') {
    // 🍭 อมยิ้มสายรุ้งยักษ์ลูดิเบรียม (MapleSim Swirl Lollipop)
    const lolliGroup = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 8), pureWhiteMat);
    const candyDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.055, 20),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.25 })
    );
    candyDisc.rotation.z = Math.PI / 2;
    candyDisc.position.y = 0.34;
    const swirlRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.032, 8, 18),
      pureWhiteMat
    );
    swirlRing1.rotation.y = Math.PI / 2;
    swirlRing1.position.y = 0.34;
    const swirlCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25 })
    );
    swirlCore.position.y = 0.34;
    lolliGroup.add(stick, candyDisc, swirlRing1, swirlCore);
    lolliGroup.position.set(0.22, 0.12, 0.04);
    lolliGroup.rotation.z = -0.22;
    armR.add(lolliGroup);
  } else if (!activityUsesHands && equipWeapon === 'weapon_gacha_bunny_plush') {
    // 🐰 ตุ๊กตากระต่ายชมพูกอดอุ่น (MapleSim Orchid's Bunny Plushie)
    const plushGroup = new THREE.Group();
    const plushPink = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.65 });
    const pBody = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), plushPink);
    pBody.scale.set(0.9, 1.15, 0.9);
    const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), plushPink);
    pHead.position.y = 0.22;
    plushGroup.add(pBody, pHead);
    [-0.06, 0.06].forEach((ez) => {
      const pEar = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.16, 6, 8), plushPink);
      pEar.position.set(0, 0.4, ez);
      pEar.rotation.x = ez * 1.8;
      const pEye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), darkTipMat);
      pEye.position.set(0.12, 0.24, ez * 0.85);
      plushGroup.add(pEar, pEye);
    });
    plushGroup.position.set(0.22, 0.08, 0.04);
    armR.add(plushGroup);
  } else if (!activityUsesHands && equipWeapon === 'weapon_gacha_cloud_umbrella') {
    // ☂️ ร่มก้อนเมฆพาสเทลลอยฟ้า (MapleSim Pastel Cloud Umbrella)
    const umbGroup = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 8), pureWhiteMat);
    shaft.position.y = 0.22;
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, transparent: true, opacity: 0.88 })
    );
    canopy.position.y = 0.42;
    const topCloud = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), pureWhiteMat);
    topCloud.position.y = 0.74;
    umbGroup.add(shaft, canopy, topCloud);
    for (let c = 0; c < 6; c++) {
      const ca = (c / 6) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), pureWhiteMat);
      puff.position.set(Math.cos(ca) * 0.3, 0.41, Math.sin(ca) * 0.3);
      umbGroup.add(puff);
    }
    umbGroup.position.set(0.2, 0.12, 0.04);
    umbGroup.rotation.z = -0.15;
    armR.add(umbGroup);
  } else if (!activityUsesHands && equipWeapon && equipWeapon !== 'weapon_none') {
    buildExtraWeapon3D(equipWeapon, armR);
  }
  if (!activityUsesHands && propColors?.weapon && armR.children.length > 0) {
    const weaponShopItem = SHOP_ITEMS.find((it) => it.id === equipWeapon);
    armR.children.forEach((wpChild) =>
      applyCustomDyeToGroup(wpChild, propColors.weapon, weaponShopItem?.colorHex)
    );
  }

  // Aura / Effect Slot (ออร่าเรืองแสงใต้เท้าและรอบตัว — หมุนวนแบบ Real-time!)
  const auraSpinGroup = new THREE.Group();
  bounceGroup.add(auraSpinGroup);
  if (equipAura === 'aura_magic_circle') {
    const ring1 = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.05, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = 0.05;
    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.26, 6),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.06;
    auraSpinGroup.add(ring1, ring2);
  } else if (equipAura === 'aura_flame') {
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 7), flameMat);
      fl.position.set(Math.cos(ang) * 0.95, 0.35 + (i % 2) * 0.2, Math.sin(ang) * 0.95);
      auraSpinGroup.add(fl);
    }
  } else if (equipAura === 'aura_stars') {
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), starMat);
      st.position.set(Math.cos(ang) * 1.05, 0.65 + (i % 3) * 0.45, Math.sin(ang) * 1.05);
      auraSpinGroup.add(st);
    }
  } else if (equipAura === 'aura_sakura') {
    const petalMat = new THREE.MeshBasicMaterial({ color: 0xf472b6, side: THREE.DoubleSide });
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const pt = new THREE.Mesh(new THREE.CircleGeometry(0.1, 5), petalMat);
      pt.position.set(Math.cos(ang) * 1.1, 0.4 + (i % 4) * 0.4, Math.sin(ang) * 1.1);
      pt.rotation.set(i * 0.6, i * 0.9, 0);
      auraSpinGroup.add(pt);
    }
  } else if (equipAura === 'aura_gacha_rainbow') {
    // 🌈 ออร่าสายรุ้งปริซึมเจ็ดสี & คริสตัลหลากสีลอยรอบตัว (Legendary Gachapon)
    const rainbowColors = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0xa855f7];
    rainbowColors.forEach((rCol, idx) => {
      const rInner = 0.72 + idx * 0.13;
      const rRing = new THREE.Mesh(
        new THREE.RingGeometry(rInner, rInner + 0.1, 36),
        new THREE.MeshBasicMaterial({ color: rCol, transparent: true, opacity: 0.78, side: THREE.DoubleSide })
      );
      rRing.rotation.x = -Math.PI / 2;
      rRing.position.y = 0.04 + idx * 0.005;
      auraSpinGroup.add(rRing);
    });
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12, 0),
        new THREE.MeshBasicMaterial({ color: rainbowColors[i % rainbowColors.length] })
      );
      gem.position.set(Math.cos(ang) * 1.18, 0.45 + (i % 4) * 0.38, Math.sin(ang) * 1.18);
      auraSpinGroup.add(gem);
    }
  } else if (equipAura === 'aura_gacha_snack_orbit') {
    // 🍩 ออร่าโดนัทเคลือบชมพู & ชานมโคจรรอบพุง (Legendary Gachapon)
    const donutDoughMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 });
    const pinkIcingMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.3 });
    const chocoIcingMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.35 });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const snack = new THREE.Group();
      if (i % 2 === 0) {
        const dough = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.065, 10, 18), donutDoughMat);
        const icing = new THREE.Mesh(
          new THREE.TorusGeometry(0.14, 0.068, 10, 18),
          i % 4 === 0 ? pinkIcingMat : chocoIcingMat
        );
        icing.position.z = 0.015;
        snack.add(dough, icing);
        snack.rotation.x = 0.65;
        snack.rotation.y = ang;
      } else {
        const miniCup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.075, 0.24, 12),
          new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.3 })
        );
        const miniStraw = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 0.18, 6),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        miniStraw.position.set(0.02, 0.16, 0);
        snack.add(miniCup, miniStraw);
      }
      snack.position.set(Math.cos(ang) * 1.22, 0.72 + (i % 2) * 0.28, Math.sin(ang) * 1.22);
      auraSpinGroup.add(snack);
    }
  } else if (equipAura === 'aura_gacha_maple_leaves') {
    // 🍁 ออร่าพายุใบเมเปิ้ลสีส้มแดง-ทองหมุนวนรอบตัว (MapleSim Legendary Effect)
    const leafColors = [0xef4444, 0xf97316, 0xfacc15];
    const goldRing = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.02, 32),
      new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    goldRing.rotation.x = -Math.PI / 2;
    goldRing.position.y = 0.05;
    auraSpinGroup.add(goldRing);
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const leafMat = new THREE.MeshBasicMaterial({
        color: leafColors[i % leafColors.length],
        side: THREE.DoubleSide,
      });
      const leafGroup = new THREE.Group();
      [-0.45, 0, 0.45].forEach((la, li) => {
        const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.065, li === 1 ? 0.22 : 0.17, 4), leafMat);
        lobe.rotation.z = la;
        lobe.scale.set(1, 1, 0.25);
        leafGroup.add(lobe);
      });
      leafGroup.position.set(Math.cos(ang) * 1.15, 0.35 + (i % 4) * 0.42, Math.sin(ang) * 1.15);
      leafGroup.rotation.set(0.35, -ang, 0.25);
      auraSpinGroup.add(leafGroup);
    }
  } else if (equipAura && equipAura !== 'aura_none') {
    buildExtraAura3D(equipAura, auraSpinGroup);
  }
  if (propColors?.aura && auraSpinGroup.children.length > 0) {
    const auraShopItem = SHOP_ITEMS.find((it) => it.id === equipAura);
    applyCustomDyeToGroup(auraSpinGroup, propColors.aura, auraShopItem?.colorHex);
  }

  const isGoldPaladin = equipArmor === 'armor_gold_paladin';
  if (showDumbbells || spectatorProp === 'dumbbell') {
    const dbBarMat = new THREE.MeshStandardMaterial({
      color: isGoldPaladin ? 0xfacc15 : 0x3f3f46,
      metalness: 0.75,
      roughness: 0.25,
    });
    const dbPlateMat = new THREE.MeshStandardMaterial({
      color: isGoldPaladin ? 0xd97706 : 0x18181b,
      metalness: isGoldPaladin ? 0.7 : 0.3,
      roughness: 0.3,
    });
    [armL, armR].forEach((arm) => {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 8), dbBarMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0.18, 0, 0);
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), dbPlateMat);
      p1.rotation.z = Math.PI / 2;
      p1.position.set(0.37, 0, 0);
      const p2 = p1.clone();
      p2.position.set(0.0, 0, 0);
      arm.add(bar, p1, p2);
    });
  } else if (equipArmor === 'armor_snow_dress' && !spectatorProp && equipWeapon === 'weapon_none') {
    // Red apple in right hand when no handheld prop is equipped
    const apple = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 })
    );
    apple.position.set(0.24, 0.08, -0.05);
    armR.add(apple);
  } else if (spectatorProp === 'eat_pizza') {
    const pizzaGroup = new THREE.Group();
    const cheese = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.04, 3),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
    );
    const crust = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.05, 0.46),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
    );
    crust.position.set(-0.14, 0.01, 0);
    const pep = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    pep.position.set(0.03, 0.01, 0);
    pizzaGroup.add(cheese, crust, pep);
    pizzaGroup.position.set(0.26, 0.12, -0.05);
    pizzaGroup.rotation.z = -0.3;
    armR.add(pizzaGroup);
  } else if (spectatorProp === 'boba_tea') {
    const cupGroup = new THREE.Group();
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.1, 0.36, 14),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.3 })
    );
    const bobaBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.1, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x18181b })
    );
    bobaBase.position.y = -0.13;
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.04, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    lid.position.y = 0.19;
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0xff4d8d })
    );
    straw.position.set(0.03, 0.28, 0);
    straw.rotation.z = -0.2;
    cupGroup.add(cup, bobaBase, lid, straw);
    cupGroup.position.set(0.24, 0.12, -0.06);
    armR.add(cupGroup);
  }

  const groundPropGroup = new THREE.Group();
  rootGroup.add(groundPropGroup);

  if (spectatorProp === 'picnic_shabu') {
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.04, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.8 })
    );
    mat.position.set(0.45, -0.12, 0);
    mat.receiveShadow = true;
    const matStripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.045, 1.55),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.8 })
    );
    matStripe.position.set(0.45, -0.12, 0);
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.3, 0.24, 16),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.5, roughness: 0.3 })
    );
    pot.position.set(0.95, 0.02, 0);
    pot.castShadow = true;
    const soup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2 })
    );
    soup.position.set(0.95, 0.13, 0);
    const chopstick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.01, 0.45, 6),
      new THREE.MeshStandardMaterial({ color: 0xd97706 })
    );
    chopstick.rotation.z = -0.9;
    chopstick.position.set(0.24, 0.08, -0.05);
    armR.add(chopstick);
    groundPropGroup.add(mat, matStripe, pot, soup);
  } else if (spectatorProp === 'play_cards') {
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.04, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.75 })
    );
    mat.position.set(0.45, -0.12, 0);
    mat.receiveShadow = true;
    groundPropGroup.add(mat);

    const cardWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const cardRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
    [-0.18, 0, 0.18].forEach((cz, idx) => {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), idx === 1 ? cardRed : cardWhite);
      card.position.set(0.9 + (idx % 2) * 0.08, -0.08 + idx * 0.005, cz);
      card.rotation.y = (idx - 1) * 0.35;
      groundPropGroup.add(card);
    });

    const handCard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.15), cardWhite);
    handCard.position.set(0.22, 0.12, -0.04);
    handCard.rotation.z = -0.35;
    armR.add(handCard);
  } else if (spectatorProp === 'pullup') {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.6, roughness: 0.3 });
    const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.55, 10), poleMat);
    poleL.position.set(0, 1.22, -1.05);
    poleL.castShadow = true;
    const poleR = poleL.clone();
    poleR.position.set(0, 1.22, 1.05);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.25, 10), poleMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, 2.45, 0);
    bar.castShadow = true;
    groundPropGroup.add(poleL, poleR, bar);
  } else if (
    spectatorProp === 'pushup' ||
    spectatorProp === 'situp' ||
    spectatorProp === 'food_roll' ||
    spectatorProp === 'phone_scroll'
  ) {
    const matColor =
      spectatorProp === 'pushup'
        ? 0x38bdf8
        : spectatorProp === 'situp'
        ? 0xa3e635
        : spectatorProp === 'phone_scroll'
        ? 0xc084fc
        : 0xfef08a;
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.04, 1.5),
      new THREE.MeshStandardMaterial({ color: matColor, roughness: 0.7 })
    );
    mat.position.set(0.15, -0.1, 0);
    mat.receiveShadow = true;
    groundPropGroup.add(mat);
    if (spectatorProp === 'phone_scroll') {
      const phone = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.26, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x18181b, emissive: 0x38bdf8, emissiveIntensity: 0.45 })
      );
      phone.position.set(0.22, 0.14, -0.05);
      phone.rotation.z = 0.4;
      armR.add(phone);
    }
  } else if (spectatorProp === 'badminton') {
    const racket = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x18181b })
    );
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.022, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    hoop.position.y = 0.36;
    hoop.scale.set(0.85, 1.15, 1);
    racket.add(handle, hoop);
    racket.position.set(0.22, 0.22, 0);
    racket.rotation.z = -0.35;
    armR.add(racket);
  } else if (spectatorProp === 'boxing') {
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
    [armL, armR].forEach((arm) => {
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), gloveMat);
      glove.position.set(0.12, 0, 0);
      arm.add(glove);
    });
  }

  fallbackGroup.add(legL, legR, armL, armR);

  const powerTransform = buildPowerTransformationParts(
    powerMeta.form,
    faceXOffset,
    Math.abs(powerMeta.netPower)
  );
  headGroup.add(powerTransform.powerHeadGroup, powerTransform.powerFaceGroup);
  bounceGroup.add(powerTransform.powerFx.auraGroup);
  powerTransform.decorateFallbackTorso(bodyMesh);
  if (powerTransform.lockPowerFace) {
    normalEyes.visible = false;
  }

  const parts: CharacterMeshParts = {
    rootGroup,
    bounceGroup,
    riderGroup,
    mountParts,
    bodyMesh,
    legL,
    legR,
    armL,
    armR,
    normalEyes,
    happyFace,
    angryFace,
    glbGroup: null,
    mixer: null,
    rpgBones: null,
    playClip: null,
    isChibiAnimalGlb: false,
    groundPropGroup,
    auraSpinGroup,
    powerFx: powerTransform.powerFx,
    lockPowerFace: powerTransform.lockPowerFace,
    animSpeedMult: powerMeta.animSpeedMult,
    formHeightScale: powerMeta.heightScale,
    extraBellyAdd: powerMeta.extraBellyAdd,
    extraMuscleAdd: powerMeta.extraMuscleAdd,
  };

  if (useProceduralOnly) {
    return parts;
  }

  const resolvedAnimMode: CharacterAnimMode =
    animMode ?? (spectatorProp ? 'spectator' : 'idle');
  const animPatterns = resolveRpgAnimPatterns(resolvedAnimMode, spectatorProp);

  // โหมด A: ร่างสัตว์จิบิ 4 ขาแท้ (.glb จาก Kenney / Quaternius) เฉพาะสายสัตว์เท่านั้น!
  if (!isHeroChar && effectiveEquipArmor === 'armor_chibi_animal') {
    const earFallbackGlb: Record<string, string> = {
      corgi: '/models/corgi_pet.glb',
      shiba: '/models/corgi_pet.glb',
      pug: '/models/dog_chibi.glb',
      dog_floppy: '/models/dog_chibi.glb',
      cat: '/models/cat.glb',
      folded_cat: '/models/cat.glb',
      lion: '/models/lion_hero.glb',
      sabretooth: '/models/tiger_hero.glb',
      fox: '/models/fox.glb',
      kitsune: '/models/fox.glb',
      cerberus: '/models/husky_hero.glb',
      bear: '/models/bear.glb',
      panda: '/models/panda_hero.glb',
      pig: '/models/pig.glb',
      bull: '/models/cow_hero.glb',
      triceratops: '/models/cow_hero.glb',
      mammoth: '/models/bear.glb',
      elephant: '/models/bear.glb',
      alpaca: '/models/alpaca_hero.glb',
      unicorn: '/models/alpaca_hero.glb',
      deer: '/models/alpaca_hero.glb',
      capybara: '/models/capybara_hero.glb',
      duck: '/models/duck_hero.glb',
      dodo: '/models/duck_hero.glb',
      pterodactyl: '/models/duck_hero.glb',
      phoenix: '/models/duck_hero.glb',
      griffin: '/models/lion_hero.glb',
      dragon: '/models/lion_hero.glb',
      trex: '/models/frog_hero.glb',
      frog: '/models/frog_hero.glb',
      axolotl: '/models/frog_hero.glb',
      shark: '/models/seal_hero.glb',
      seal: '/models/seal_hero.glb',
      monkey: '/models/monkey_hero.glb',
    };
    const animalGlbUrl =
      SPECIES_GLB_MAP[species] || earFallbackGlb[earStyle] || '/models/bunny.glb';
    loadNormalizedGLB(animalGlbUrl, 1.85, resolvedAnimMode === 'run', animPatterns)
      .then((res) => {
        if (rootGroup.userData.disposed) return;
        fallbackGroup.visible = false;
        riderGroup.add(res.group);
        if (mountParts && !isInitFloorProp) {
          riderGroup.position.set(0, Math.max(0.18, mountParts.saddleY - 0.05), 0);
        }

        if (wingsBackGroup) {
          wingsBackGroup.position.set(-0.26, 1.12, 0);
          wingsBackGroup.scale.setScalar(0.78);
          res.group.add(wingsBackGroup);
        }
        if (hatSlotGroup.children.length > 0) {
          hatSlotGroup.position.set(0.18, 1.56, 0);
          hatSlotGroup.scale.setScalar(0.82);
          res.group.add(hatSlotGroup);
        }
        if (faceSlotGroup.children.length > 0) {
          faceSlotGroup.position.set(0.15, 1.18, 0);
          faceSlotGroup.scale.setScalar(0.92);
          res.group.add(faceSlotGroup);
        }
        if (powerTransform.powerHeadGroup.children.length > 0) {
          powerTransform.powerHeadGroup.position.set(0.18, 1.52, 0);
          powerTransform.powerHeadGroup.scale.setScalar(0.85);
          res.group.add(powerTransform.powerHeadGroup);
        }
        if (powerTransform.powerFaceGroup.children.length > 0) {
          powerTransform.powerFaceGroup.position.set(0.16, 1.18, 0);
          powerTransform.powerFaceGroup.scale.setScalar(0.9);
          res.group.add(powerTransform.powerFaceGroup);
        }

        parts.glbGroup = res.group;
        parts.mixer = res.mixer;
        parts.playClip = res.playClip;
        parts.isChibiAnimalGlb = true;
        applyCharacterBellyScale(parts, bellyScale, muscleScale);
      })
      .catch(() => {
        // หากโหลดไฟล์ไม่สำเร็จ ใช้ร่าง Procedural สำรองอัตโนมัติ
      });
  } else {
    // โหมด B: ตัวละครลำตัวทรงกลมตุ้ยนุ้ย (Plush Round Mochi Body) สวมเสื้อ & กางเกง/กระโปรง + หัวสัตว์หรือหัวดิสนีย์จิบิ
    const useHeroDefaultOutfitColors =
      isHeroChar && effectiveEquipArmor === (breedMeta.defaultArmor || 'armor_none');
    const rig = buildChubbyPlushOutfitRig({
      equipArmor: effectiveEquipArmor,
      furColor: effectiveColorHex,
      animPatterns,
      animTimeOffset: animSeed * 0.37,
      customShirtHex:
        propColors?.shirt || (useHeroDefaultOutfitColors ? breedMeta.defaultShirtHex : undefined),
      customPantsHex:
        propColors?.pants || (useHeroDefaultOutfitColors ? breedMeta.defaultPantsHex : undefined),
    });

    fallbackGroup.visible = false;
    riderGroup.add(rig.group);
    powerTransform.decoratePlushTorso(rig.torsoVisualGroup, rig.torsoBone);
    if (mountParts && !isInitFloorProp) {
      rig.legLeftBone.rotation.set(-0.92, 0.2, 0.36);
      rig.legRightBone.rotation.set(-0.92, -0.2, -0.36);
    }

    // 1. สวมหัวสัตว์รูปทรงเฉพาะแต่ละสายพันธุ์ + หมวกแฟชั่น + แว่น ลงบนกระดูก head
    headGroup.position.set(0, 0.43, 0.02);
    headGroup.rotation.set(0, -Math.PI / 2, 0);
    headGroup.scale.setScalar(0.9);
    rig.headBone.add(headGroup);

    // 2. ติดกระเป๋าเป้ / เสื่อโยคะ / โบว์พาสเทล / ปีก ด้านหลังลำตัวกลม (ขยับเข้า-ออกตามพุงอัตโนมัติ)
    let backSlotObj: THREE.Object3D | null = null;
    if (wingsBackGroup) {
      wingsBackGroup.position.set(0, 0.45, -0.44);
      wingsBackGroup.rotation.set(0, -Math.PI / 2, 0);
      wingsBackGroup.scale.setScalar(0.86);
      rig.torsoBone.add(wingsBackGroup);
      backSlotObj = wingsBackGroup;
    }

    // 3. ติดหางประจำสายพันธุ์ลงด้านหลังกางเกง/กระโปรงช่วงก้นกลมๆ
    let tailSlotObj: THREE.Object3D | null = null;
    if (tailAttachObj) {
      const tailRigWrapper = new THREE.Group();
      tailRigWrapper.position.set(0, 0.08, -0.5);
      tailRigWrapper.rotation.set(0, -Math.PI / 2, 0);
      tailRigWrapper.scale.setScalar(0.84);
      tailAttachObj.position.set(0, 0, 0);
      tailRigWrapper.add(tailAttachObj);
      rig.torsoBone.add(tailRigWrapper);
      tailSlotObj = tailRigWrapper;
    }

    // 4. ย้ายของถือเล่นไลฟ์สไตล์ & กองเชียร์ เข้าสู่อุ้งมือสัตว์กลมของแขนขวา (-0.36) และแขนซ้าย (+0.36)
    if (armR.children.length > 0) {
      const toMoveR = [...armR.children];
      const propHolderR = new THREE.Group();
      propHolderR.position.set(-0.36, 0.0, 0.04);
      propHolderR.rotation.set(0, -Math.PI / 2, 0);
      propHolderR.scale.setScalar(0.9);
      toMoveR.forEach((ch) => {
        ch.position.multiplyScalar(0.18);
        propHolderR.add(ch);
      });
      rig.armRightBone.add(propHolderR);
    }

    if (armL.children.length > 0) {
      const toMoveL = [...armL.children];
      const propHolderL = new THREE.Group();
      propHolderL.position.set(0.36, 0.0, 0.04);
      propHolderL.rotation.set(0, -Math.PI / 2, 0);
      propHolderL.scale.setScalar(0.9);
      toMoveL.forEach((ch) => {
        ch.position.multiplyScalar(0.18);
        propHolderL.add(ch);
      });
      rig.armLeftBone.add(propHolderL);
    }

    parts.glbGroup = rig.group;
    parts.mixer = rig.mixer;
    parts.playClip = rig.playClip;
    parts.rpgBones = {
      torsoBone: rig.torsoBone,
      torsoVisualGroup: rig.torsoVisualGroup,
      headBone: rig.headBone,
      armLeftBone: rig.armLeftBone,
      armRightBone: rig.armRightBone,
      legLeftBone: rig.legLeftBone,
      legRightBone: rig.legRightBone,
      backSlotObj,
      tailSlotObj,
      bellyBulge: null,
    };
    applyCharacterBellyScale(parts, bellyScale, muscleScale);
  }

  return parts;
}

export function setCharacterExpression(
  parts: Pick<CharacterMeshParts, 'normalEyes' | 'happyFace' | 'angryFace'> & {
    lockPowerFace?: boolean;
    charParts?: CharacterMeshParts;
  },
  mood: 'normal' | 'happy' | 'angry'
) {
  const locked = Boolean(parts.lockPowerFace ?? parts.charParts?.lockPowerFace);
  if (locked && mood === 'normal') {
    parts.normalEyes.visible = false;
    parts.happyFace.visible = false;
    parts.angryFace.visible = false;
    return;
  }
  parts.normalEyes.visible = mood !== 'happy' && !locked;
  parts.happyFace.visible = mood === 'happy';
  parts.angryFace.visible = mood === 'angry';
}

function animatePowerTransformFx(pfx: PowerFxRefs, elapsed: number, idx: number) {
  if (pfx.form === 'warm_up') {
    pfx.auraGroup.rotation.y = elapsed * 2.1;
    pfx.flames.forEach((fl, i) => {
      const pulse = 0.8 + Math.sin(elapsed * 9 + i * 1.4) * 0.25;
      fl.scale.set(pulse, pulse * 1.15, pulse);
      fl.position.y = 0.22 + ((elapsed * 1.6 + i * 0.25) % 0.65);
    });
  } else if (pfx.form === 'fire_boost') {
    pfx.flames.forEach((fl, i) => {
      const ang = (i / pfx.flames.length) * Math.PI * 2 + elapsed * 3.2;
      const rad = 0.94 + Math.sin(elapsed * 11 + i) * 0.08;
      fl.position.x = Math.cos(ang) * rad;
      fl.position.z = Math.sin(ang) * rad;
      fl.rotation.y = -ang;
      const sy = 0.85 + Math.abs(Math.sin(elapsed * 14 + i * 1.3)) * 0.55;
      fl.scale.set(0.78, sy, 1.25);
    });
    pfx.jetFlames.forEach((jf, ji) => {
      const blast = 0.82 + Math.abs(Math.sin(elapsed * 24 + ji * 1.9)) * 0.48;
      jf.scale.set(1, blast, 1);
    });
    pfx.groundRings.forEach((r, ri) => {
      const sc = 1 + Math.sin(elapsed * 7 + ri * 1.5) * 0.08;
      r.scale.set(sc, sc, 1);
    });
  } else if (pfx.form === 'super_saiyan') {
    // Surging Golden Super Saiyan Ki Blades + Crackling Lightning + Levitating Stones!
    pfx.flames.forEach((blade, i) => {
      const isInner = i % 2 === 0;
      const ang =
        (i / pfx.flames.length) * Math.PI * 2 + elapsed * (isInner ? 2.4 : -1.8);
      const rad = (isInner ? 0.86 : 1.14) + Math.sin(elapsed * 16 + i) * 0.06;
      blade.position.x = Math.cos(ang) * rad;
      blade.position.z = Math.sin(ang) * rad;
      blade.rotation.y = -ang;
      const surge = 0.82 + Math.abs(Math.sin(elapsed * 18 + i * 1.15)) * 0.48;
      blade.scale.set(0.55, surge, 1.35);
    });

    pfx.groundRings.forEach((r, ri) => {
      const wave = ((elapsed * 1.8 + ri * 0.5) % 1);
      const sc = 0.85 + wave * 0.65;
      r.scale.set(sc, sc, 1);
      const rMat = r.material as THREE.MeshBasicMaterial;
      rMat.opacity = (1 - wave) * 0.85;
    });

    pfx.lightningBolts.forEach((bolt, bi) => {
      const flash = Math.sin(elapsed * 29 + bi * 2.7 + idx) > 0.15;
      bolt.visible = flash;
      if (flash) {
        const snapAng = elapsed * 6.5 + bi * ((Math.PI * 2) / pfx.lightningBolts.length);
        bolt.position.x = Math.cos(snapAng) * 1.05;
        bolt.position.z = Math.sin(snapAng) * 1.05;
        bolt.position.y = 0.55 + ((bi * 0.43 + elapsed * 2.2) % 1.65);
        bolt.rotation.y = snapAng * 2;
        bolt.rotation.z = Math.sin(elapsed * 35 + bi) * 0.55;
      }
    });

    pfx.floatingRocks.forEach((stone, rk) => {
      const orbit = elapsed * 1.35 + (rk / pfx.floatingRocks.length) * Math.PI * 2;
      const lift = ((elapsed * 0.65 + rk * 0.22) % 1);
      stone.position.set(
        Math.cos(orbit) * (1.28 + lift * 0.25),
        0.2 + lift * 2.1,
        Math.sin(orbit) * (1.28 + lift * 0.25)
      );
      stone.rotation.x = elapsed * 3 + rk;
      stone.rotation.y = elapsed * 2.4 + rk;
      const sc = Math.sin(lift * Math.PI);
      stone.scale.setScalar(Math.max(0.2, sc * 1.15));
    });
  } else if (pfx.form === 'stuffed' || pfx.form === 'food_coma') {
    if (pfx.snackOrbitGroup) {
      pfx.snackOrbitGroup.rotation.y = elapsed * 1.4;
    }
    pfx.zzzSprites.forEach((sp, zi) => {
      const cycle = (elapsed * 0.5 + zi * 0.5) % 1;
      sp.position.y = 2.0 + cycle * 1.0;
      sp.material.opacity = Math.sin(cycle * Math.PI) * 0.85;
    });
    pfx.groundRings.forEach((r) => {
      const sc = 1 + Math.sin(elapsed * 2.2) * 0.07;
      r.scale.set(sc, sc, 1);
    });
  } else if (pfx.form === 'kabigon') {
    if (pfx.snackOrbitGroup) {
      pfx.snackOrbitGroup.rotation.y = elapsed * 1.15;
    }
    pfx.zzzSprites.forEach((sp, zi) => {
      const cycle = (elapsed * 0.55 + zi * 0.22) % 1;
      sp.position.y = 2.15 + cycle * 1.45;
      sp.position.x = 0.25 + Math.sin(elapsed * 2.2 + zi) * 0.24;
      sp.position.z = 0.28 + cycle * 0.38;
      const s = (0.38 + cycle * 0.52) * (1 - cycle * 0.2);
      sp.scale.set(s, s, 1);
      sp.material.opacity = Math.sin(cycle * Math.PI) * 0.95;
    });
    pfx.groundRings.forEach((r, ri) => {
      const sc = 1 + Math.sin(elapsed * 2.4 + ri * 0.8) * 0.1;
      r.scale.set(sc, sc, 1);
    });
  } else if (pfx.form === 'majin_buu') {
    if (pfx.buuAntennaTip) {
      pfx.buuAntennaTip.rotation.z = Math.sin(elapsed * 6.5 + idx) * 0.28;
      pfx.buuAntennaTip.rotation.x = Math.cos(elapsed * 5.2 + idx) * 0.18;
    }
    if (pfx.snackOrbitGroup) {
      pfx.snackOrbitGroup.rotation.y = -elapsed * 1.85;
    }
    pfx.steamPuffs.forEach((puff, si) => {
      const side = si % 2 === 0 ? -1 : 1;
      const burst = (elapsed * 1.6 + si * 0.28) % 1;
      puff.position.set(
        -0.05 - burst * 0.2,
        1.85 + burst * 0.95,
        side * (0.55 + burst * 0.65)
      );
      const sc = Math.sin(burst * Math.PI) * 1.35;
      puff.scale.setScalar(Math.max(0.05, sc));
    });
    pfx.groundRings.forEach((r) => {
      const sc = 1 + Math.sin(elapsed * 4.5) * 0.1;
      r.scale.set(sc, sc, 1);
    });
  }
}

export function syncCharacterMountPose(
  c: CharacterMeshParts & { charParts?: CharacterMeshParts },
  elapsed: number,
  idx: number,
  isMoving: boolean,
  isFloorActivity = false
) {
  const mp = c.mountParts ?? c.charParts?.mountParts ?? null;
  const rg = c.riderGroup ?? c.charParts?.riderGroup ?? null;
  if (!mp || !rg) {
    if (rg) rg.position.set(0, 0, 0);
    return;
  }

  if (isFloorActivity) {
    mp.mountGroup.position.set(-1.45, 0, -1.25);
    animateMountFrame(mp, elapsed, idx, false);
    rg.position.set(0, 0, 0);
    return;
  }

  mp.mountGroup.position.set(0, 0, 0);
  const hopY = animateMountFrame(mp, elapsed, idx, isMoving);
  const isAnimal4Leg = Boolean(c.isChibiAnimalGlb ?? c.charParts?.isChibiAnimalGlb);
  const baseSeatOffset = isAnimal4Leg ? 0.05 : 0.34;
  c.bounceGroup.position.y *= 0.22;
  c.bounceGroup.rotation.set(0, 0, 0);
  rg.position.set(0, Math.max(0.16, mp.saddleY - baseSeatOffset) + hopY, 0);

  const bones = c.rpgBones ?? c.charParts?.rpgBones ?? null;
  if (bones && !isAnimal4Leg) {
    const { legLeftBone, legRightBone } = bones;
    const kick = Math.sin(elapsed * (isMoving ? 7.5 : 3.2) + idx) * 0.08;
    if (legLeftBone) legLeftBone.rotation.set(-0.92 + kick, 0.2, 0.36);
    if (legRightBone) legRightBone.rotation.set(-0.92 - kick, -0.2, -0.36);
  } else if (!c.mixer) {
    c.legL.rotation.set(0.32, 0, -0.85);
    c.legR.rotation.set(-0.32, 0, -0.85);
  }
}

export function animateCharacterMotion(
  c: CharacterMeshParts & {
    isSpectator: boolean;
    isInFoodStall?: boolean;
    workoutType: string;
    muscleScale?: number;
    charParts?: CharacterMeshParts;
  },
  elapsed: number,
  idx: number,
  bellyScale: number
) {
  const auraGrp = c.auraSpinGroup ?? c.charParts?.auraSpinGroup;
  if (auraGrp) {
    auraGrp.rotation.y = elapsed * 1.45;
  }
  const pfx = c.powerFx ?? c.charParts?.powerFx;
  if (pfx && pfx.form !== 'neutral') {
    animatePowerTransformFx(pfx, elapsed, idx);
  }

  const useActivityAnim = c.isSpectator || Boolean(c.isInFoodStall);
  const isFloorActivity =
    useActivityAnim &&
    [
      'pushup',
      'situp',
      'food_roll',
      'phone_scroll',
      'picnic_shabu',
      'play_cards',
      'pullup',
    ].includes(c.workoutType);
  // เมื่อโมเดล .glb โหลดเสร็จแล้ว ใช้ Skeletal Animation ผสานกับท่าออกกำลังกาย/กินของแต่ละกิจกรรมแบบเต็มตัว
  if (c.mixer) {
    const t = elapsed * 5 + idx * 0.9;
    c.bounceGroup.rotation.set(0, 0, 0);
    c.bounceGroup.position.set(0, 0, 0);

    const bones = c.rpgBones ?? c.charParts?.rpgBones ?? null;
    const isAnimal4Leg = Boolean(c.isChibiAnimalGlb ?? c.charParts?.isChibiAnimalGlb);

    if (useActivityAnim) {
      if (bones && !isAnimal4Leg) {
        const { torsoBone, headBone, armLeftBone, armRightBone, legLeftBone, legRightBone } = bones;
        // รีเซ็ตขาในกิจกรรมที่ใช้ฐาน idle (เพราะคลิป idle ไม่มีแทร็กหมุนขา)
        const usesIdleBase =
          c.workoutType === 'dumbbell' ||
          c.workoutType === 'squat' ||
          c.workoutType === 'pullup' ||
          c.workoutType === 'pushup' ||
          c.workoutType === 'situp' ||
          c.workoutType === 'food_roll' ||
          c.workoutType === 'boxing' ||
          c.workoutType === 'badminton' ||
          c.workoutType === 'eat_pizza' ||
          c.workoutType === 'boba_tea';
        if (usesIdleBase) {
          if (legLeftBone) legLeftBone.rotation.set(0, 0, 0);
          if (legRightBone) legRightBone.rotation.set(0, 0, 0);
        }

        if (c.workoutType === 'dumbbell') {
          // 🏋️ ยกดัมเบลปั๊มกล้าม: พับศอกยกดัมเบลสองข้างขึ้น-ลงพร้อมยืดอก
          const curl = (Math.sin(t * 0.95) + 1) * 0.5;
          c.bounceGroup.position.y = curl * 0.06;
          if (torsoBone) torsoBone.rotation.set(-curl * 0.1, 0, 0);
          if (headBone) headBone.rotation.set(-curl * 0.1, 0, 0);
          if (armLeftBone) armLeftBone.rotation.set(0, -0.85 - curl * 0.35, -0.45 + curl * 1.15);
          if (armRightBone) armRightBone.rotation.set(0, 0.85 + curl * 0.35, 0.45 - curl * 1.15);
        } else if (c.workoutType === 'squat') {
          // 🦵 สควอทปั้นก้น: ย่อเข่าทิ้งสะโพกลง โน้มตัวหน้า ยื่นแขนสองข้างทรงตัว
          const squat = (Math.sin(t * 0.8) + 1) * 0.5;
          c.bounceGroup.position.y = -squat * 0.24;
          if (torsoBone) torsoBone.rotation.set(squat * 0.34, 0, 0);
          if (headBone) headBone.rotation.set(-squat * 0.28, 0, 0);
          if (legLeftBone) legLeftBone.rotation.set(-squat * 0.65, 0, squat * 0.12);
          if (legRightBone) legRightBone.rotation.set(-squat * 0.65, 0, -squat * 0.12);
          if (armLeftBone) armLeftBone.rotation.set(0, -squat * 1.12, -0.65 + squat * 0.65);
          if (armRightBone) armRightBone.rotation.set(0, squat * 1.12, 0.65 - squat * 0.65);
        } else if (c.workoutType === 'pullup') {
          // 🤸‍♂️ ดึงข้อบาร์เดี่ยว: ชูสองแขนจับบาร์ด้านบน ดึงตัวลอยขึ้นจนคางแตะบาร์
          const pull = (Math.sin(t * 0.78) + 1) * 0.5;
          c.bounceGroup.position.y = 0.26 + pull * 0.44;
          if (torsoBone) torsoBone.rotation.set(-0.08 * pull, 0, 0);
          if (headBone) headBone.rotation.set(-0.2 + pull * 0.15, 0, 0);
          if (armLeftBone) armLeftBone.rotation.set(0, -0.15, 1.32 - pull * 0.42);
          if (armRightBone) armRightBone.rotation.set(0, 0.15, -1.32 + pull * 0.42);
          if (legLeftBone) legLeftBone.rotation.set(0.28 + Math.sin(t * 1.5) * 0.08, 0, 0);
          if (legRightBone) legRightBone.rotation.set(0.28 - Math.sin(t * 1.5) * 0.08, 0, 0);
        } else if (c.workoutType === 'pushup') {
          // 💪 วิดพื้น: นอนคว่ำแพลงก์ขนานเสื่อ ดันตัวขึ้น-ลง เงยหน้ามองตรง
          const push = (Math.sin(t * 0.95) + 1) * 0.5;
          c.bounceGroup.rotation.z = -Math.PI / 2 + push * 0.16;
          c.bounceGroup.position.set(-0.55, 0.36 + push * 0.22, 0);
          if (torsoBone) torsoBone.rotation.set(0, 0, 0);
          if (headBone) headBone.rotation.set(-0.48, 0, 0);
          if (armLeftBone) armLeftBone.rotation.set(0, -1.12, -0.22 + (1 - push) * 0.52);
          if (armRightBone) armRightBone.rotation.set(0, 1.12, 0.22 - (1 - push) * 0.52);
        } else if (c.workoutType === 'situp') {
          // 🧘‍♂️ ซิทอัพปั้นซิกแพค: นอนหงายชันเข่าบนเสื่อแล้วซิทอัพพับตัวขึ้นมาแตะเข่า
          const sit = (Math.sin(t * 0.85) + 1) * 0.5;
          c.bounceGroup.rotation.z = 1.36 - sit * 1.05;
          c.bounceGroup.position.set(0.45 - sit * 0.22, 0.38 - sit * 0.14, 0);
          if (torsoBone) torsoBone.rotation.set(sit * 0.25, 0, 0);
          if (headBone) headBone.rotation.set(0.26, 0, 0);
          if (legLeftBone) legLeftBone.rotation.set(-0.85 + sit * 0.25, 0, 0);
          if (legRightBone) legRightBone.rotation.set(-0.85 + sit * 0.25, 0, 0);
          if (armLeftBone) armLeftBone.rotation.set(0, -1.05, 0.15);
          if (armRightBone) armRightBone.rotation.set(0, 1.05, -0.15);
        } else if (c.workoutType === 'food_roll') {
          // 😴 นอนกลิ้งพุงป่อง: นอนหงายแผ่หลาบนเสื่อแล้วกลิ้งซ้าย-ขวาลูบพุงชิลๆ
          const roll = Math.sin(t * 0.65);
          c.bounceGroup.position.set(0.65, 0.44, roll * 0.38);
          c.bounceGroup.rotation.set(roll * 0.95, 0, Math.PI / 2);
          if (torsoBone) torsoBone.rotation.set(0, 0, 0);
          if (headBone) headBone.rotation.set(0.12, roll * 0.25, 0);
          if (armLeftBone) armLeftBone.rotation.set(0, -0.4, 0.35 + roll * 0.25);
          if (armRightBone) armRightBone.rotation.set(0, 0.4, -0.35 + roll * 0.25);
          if (legLeftBone) legLeftBone.rotation.set(-0.2, 0, 0.18);
          if (legRightBone) legRightBone.rotation.set(-0.2, 0, -0.18);
        } else if (c.workoutType === 'phone_scroll') {
          // 📱 นอน/นั่งไถมือถือสั่งของกิน: นั่งเอนหลังบนเสื่อ ยกมือถือส่องหน้า กระดิกเท้าชิลๆ
          const swipe = Math.sin(t * 1.6);
          c.bounceGroup.position.set(-0.08, 0.04, 0);
          if (torsoBone) torsoBone.rotation.set(-0.14, 0, 0);
          if (headBone) headBone.rotation.set(0.18 + Math.sin(t * 0.8) * 0.05, swipe * 0.08, 0);
          if (armRightBone) armRightBone.rotation.set(0, 1.08, -0.15 + swipe * 0.12);
          if (armLeftBone) armLeftBone.rotation.set(0, -0.35, -0.65);
          if (legLeftBone) legLeftBone.rotation.set(-1.25 + Math.sin(t * 1.2) * 0.12, 0, 0);
          if (legRightBone) legRightBone.rotation.set(-1.25 - Math.sin(t * 1.2) * 0.12, 0, 0);
        } else if (c.workoutType === 'picnic_shabu') {
          // 🍲 นั่งปิกนิกกินชาบู: นั่งบนเสื่อ คีบตะเกียบจุ่มหม้อไฟด้านหน้าแล้วคีบเข้าปากเคี้ยวตุ้ยๆ
          const dip = (Math.sin(t * 0.85) + 1) * 0.5;
          c.bounceGroup.position.set(-0.05, 0.04, 0);
          if (torsoBone) torsoBone.rotation.set((1 - dip) * 0.22 - dip * 0.04, 0, 0);
          if (armRightBone) armRightBone.rotation.set(0, 1.05 + dip * 0.22, 0.25 - dip * 0.72);
          if (armLeftBone) armLeftBone.rotation.set(0, -0.55, -0.55);
          if (headBone) {
            const chew = dip > 0.6 ? Math.sin(t * 3.8) * 0.08 : 0;
            headBone.rotation.set((1 - dip) * 0.18 + chew, 0, 0);
          }
        } else if (c.workoutType === 'play_cards') {
          // 🃏 ตั้งวงเล่นไพ่: นั่งล้อมวงเหล่ไพ่ซ้าย-ขวา แล้วจั่วตบไพ่ลงเสื่อ
          const slap = Math.max(0, Math.sin(t * 0.9));
          c.bounceGroup.position.set(-0.05, 0.04, 0);
          if (torsoBone) torsoBone.rotation.set(slap * 0.24, Math.sin(t * 0.55) * 0.15, 0);
          if (headBone) headBone.rotation.set(0.16, Math.sin(t * 0.75) * 0.28, 0);
          if (armRightBone) armRightBone.rotation.set(0, 0.95 + slap * 0.25, -0.35 + slap * 0.65);
          if (armLeftBone) armLeftBone.rotation.set(0, -0.85, -0.25);
        } else if (c.workoutType === 'eat_pizza' || c.workoutType === 'boba_tea') {
          // 🍕 กินพิซซ่า / 🧋 ดูดชานมไข่มุก: ยกพิซซ่า/แก้วชานมขึ้นงับ/ดูดเป็นจังหวะพร้อมโยกตัวฟินๆ
          const bite = (Math.sin(t * 0.85) + 1) * 0.5;
          c.bounceGroup.position.y = Math.abs(Math.sin(t * 0.85)) * 0.05;
          if (torsoBone) torsoBone.rotation.set(0, 0, Math.sin(t * 0.45) * 0.06);
          if (armRightBone) armRightBone.rotation.set(0, 0.95 + bite * 0.35, 0.35 - bite * 0.78);
          if (headBone) {
            const chew = bite > 0.65 ? Math.sin(t * 4.2) * 0.07 : 0;
            headBone.rotation.set(bite * 0.14 + chew, 0, 0);
          }
        } else if (c.workoutType === 'boxing') {
          // 🥊 ชกลมคาร์ดิโอ: แย็บหมัดซ้าย-ขวาสลับกันเร็วๆ พร้อมบิดหัวไหล่และฟุตเวิร์ค
          const jabL = Math.max(0, Math.sin(t * 1.7));
          const jabR = Math.max(0, -Math.sin(t * 1.7));
          c.bounceGroup.position.y = Math.abs(Math.sin(t * 1.7)) * 0.12;
          if (torsoBone) torsoBone.rotation.set(0.08, (jabR - jabL) * 0.38, 0);
          if (armLeftBone) armLeftBone.rotation.set(0, -0.85 - jabL * 0.55, -0.15 + jabL * 0.28);
          if (armRightBone) armRightBone.rotation.set(0, 0.85 + jabR * 0.55, 0.15 - jabR * 0.28);
          if (legLeftBone) legLeftBone.rotation.set(-0.22 + jabL * 0.18, 0, 0);
          if (legRightBone) legRightBone.rotation.set(0.22 - jabR * 0.18, 0, 0);
        } else if (c.workoutType === 'badminton') {
          // 🏸 ซ้อมตีแบด: กระโดดสปลิตสเต็ป เงื้อไม้แบดขึ้นเหนือหัวแล้วตบลูกหน้าเน็ต
          const swing = Math.sin(t * 1.15);
          c.bounceGroup.position.y = Math.abs(swing) * 0.18;
          if (torsoBone) torsoBone.rotation.set(swing * 0.15, -swing * 0.32, 0);
          if (armRightBone) {
            armRightBone.rotation.set(0, 0.55 + Math.max(0, swing) * 0.65, -0.85 + swing * 0.85);
          }
          if (armLeftBone) armLeftBone.rotation.set(0, -0.55, 0.25 - swing * 0.2);
          if (legLeftBone) legLeftBone.rotation.set(-swing * 0.28, 0, 0);
          if (legRightBone) legRightBone.rotation.set(swing * 0.28, 0, 0);
        } else if (c.workoutType === 'jumping_jacks') {
          const jump = Math.max(0, Math.sin(t));
          c.bounceGroup.position.y = jump * 0.28;
          if (armLeftBone) armLeftBone.rotation.set(0, 0, -0.55 + jump * 1.75);
          if (armRightBone) armRightBone.rotation.set(0, 0, 0.55 - jump * 1.75);
        } else {
          // 📣 เชียร์สุดใจข้างสนาม: ชูสองแขนโบกเชียร์กระโดดดุ๊กดิ๊ก
          const wave = Math.sin(t * 1.3);
          c.bounceGroup.position.y = Math.abs(wave) * 0.14;
          if (armLeftBone) armLeftBone.rotation.set(0, -0.35, 0.85 + wave * 0.38);
          if (armRightBone) armRightBone.rotation.set(0, 0.35, -0.85 - wave * 0.38);
        }
      } else {
        // โหมดร่างสัตว์จิบิ 4 ขาธรรมชาติ (armor_chibi_animal)
        if (c.workoutType === 'pullup') {
          const pull = (Math.sin(t * 0.78) + 1) * 0.5;
          c.bounceGroup.position.y = 0.42 + pull * 0.45;
        } else if (c.workoutType === 'pushup') {
          const push = (Math.sin(t * 0.95) + 1) * 0.5;
          c.bounceGroup.position.y = push * 0.18;
          c.bounceGroup.rotation.z = (push - 0.5) * 0.22;
        } else if (c.workoutType === 'situp') {
          const sit = (Math.sin(t * 0.85) + 1) * 0.5;
          c.bounceGroup.rotation.z = 0.75 - sit * 0.75;
          c.bounceGroup.position.y = 0.15;
        } else if (c.workoutType === 'food_roll') {
          const roll = Math.sin(t * 0.65);
          c.bounceGroup.position.set(0.25, 0.32, roll * 0.36);
          c.bounceGroup.rotation.x = roll * 0.95;
        } else if (c.workoutType === 'squat') {
          const squat = (Math.sin(t * 0.8) + 1) * 0.5;
          c.bounceGroup.position.y = -squat * 0.16;
        } else if (
          c.workoutType === 'cheer' ||
          c.workoutType === 'boxing' ||
          c.workoutType === 'badminton' ||
          c.workoutType === 'jumping_jacks'
        ) {
          c.bounceGroup.position.y = Math.abs(Math.sin(t * 1.2)) * 0.18;
        }
      }
    }
    applyCharacterBellyScale(c, bellyScale, c.muscleScale ?? 1);
    syncCharacterMountPose(c, elapsed, idx, !useActivityAnim || c.workoutType === 'jog', isFloorActivity);
    return;
  }

  if (useActivityAnim) {
    const t = elapsed * 5 + idx * 0.9;
    if (c.workoutType === 'jumping_jacks') {
      const jump = Math.max(0, Math.sin(t));
      c.bounceGroup.position.y = jump * 0.45;
      c.armL.position.y = 1.15 + jump * 0.65;
      c.armR.position.y = 1.15 + jump * 0.65;
      c.legL.rotation.x = jump * 0.4;
      c.legR.rotation.x = -jump * 0.4;
    } else if (c.workoutType === 'squat') {
      const squat = (Math.sin(t * 0.75) + 1) * 0.5;
      c.bounceGroup.position.y = -squat * 0.16;
      c.bodyMesh.scale.set(bellyScale * (1 + squat * 0.1), 1 - squat * 0.15, bellyScale * (1 + squat * 0.1));
      c.armL.position.x = squat * 0.35;
      c.armR.position.x = squat * 0.35;
    } else if (c.workoutType === 'dumbbell') {
      const curl = (Math.sin(t * 0.9) + 1) * 0.5;
      c.bounceGroup.position.y = Math.abs(Math.sin(t * 0.45)) * 0.08;
      c.armL.position.y = 1.05 + curl * 0.55;
      c.armR.position.y = 1.05 + curl * 0.55;
      c.armL.position.x = 0.25;
      c.armR.position.x = 0.25;
    } else if (c.workoutType === 'jog') {
      const speed = 9.0 + idx * 0.3;
      c.bounceGroup.position.y = Math.abs(Math.sin(elapsed * speed)) * 0.2;
      c.legL.rotation.z = Math.sin(elapsed * speed) * 0.6;
      c.legR.rotation.z = -Math.sin(elapsed * speed) * 0.6;
      c.armL.position.x = Math.sin(elapsed * speed) * 0.22;
      c.armR.position.x = -Math.sin(elapsed * speed) * 0.22;
    } else if (c.workoutType === 'pullup') {
      const pull = (Math.sin(t * 0.75) + 1) * 0.5;
      c.bounceGroup.position.y = 0.28 + pull * 0.55;
      c.armL.position.set(0, 2.15 - pull * 0.45, -0.68);
      c.armR.position.set(0, 2.15 - pull * 0.45, 0.68);
      c.legL.rotation.z = -0.25;
      c.legR.rotation.z = -0.25;
    } else if (c.workoutType === 'pushup') {
      const push = (Math.sin(t * 0.9) + 1) * 0.5;
      c.bounceGroup.rotation.z = -Math.PI / 2;
      c.bounceGroup.position.set(0.85, 0.66 + push * 0.16, 0);
      c.armL.position.set(-0.45 - push * 0.15, 1.35, -0.58);
      c.armR.position.set(-0.45 - push * 0.15, 1.35, 0.58);
    } else if (c.workoutType === 'badminton') {
      const swing = Math.sin(t * 1.1);
      c.bounceGroup.position.y = Math.abs(Math.sin(t * 0.9)) * 0.22;
      c.armR.position.set(0.2 + swing * 0.25, 1.35 + Math.abs(swing) * 0.35, 0.72);
      c.armR.rotation.z = swing * 0.7;
      c.armL.position.set(0, 1.15, -0.78);
    } else if (c.workoutType === 'boxing') {
      const jabL = Math.max(0, Math.sin(t * 1.6));
      const jabR = Math.max(0, -Math.sin(t * 1.6));
      c.bounceGroup.position.y = Math.abs(Math.sin(t * 1.2)) * 0.14;
      c.armL.position.set(0.25 + jabL * 0.55, 1.25, -0.62);
      c.armR.position.set(0.25 + jabR * 0.55, 1.25, 0.62);
    } else if (c.workoutType === 'phone_scroll') {
      c.bounceGroup.rotation.z = 1.48;
      c.bounceGroup.position.set(0.55, 0.54, 0);
      c.legL.position.set(0.2, 0.2, -0.25);
      c.legR.position.set(0.2, 0.2, 0.25);
      c.legL.rotation.z = -0.9;
      c.legR.rotation.z = -0.9;
      c.armR.position.set(0.55, 1.55 + Math.sin(t * 1.5) * 0.04, 0.38);
      c.armL.position.set(0.1, 1.1, -0.68);
    } else if (c.workoutType === 'situp') {
      const sit = (Math.sin(t * 0.85) + 1) * 0.5;
      c.bounceGroup.rotation.z = 1.48 - sit * 1.15;
      c.bounceGroup.position.set(0.45 - sit * 0.25, 0.52 - sit * 0.35, 0);
      c.legL.position.set(0.25, 0.2, -0.25);
      c.legR.position.set(0.25, 0.2, 0.25);
      c.legL.rotation.z = -1.1;
      c.legR.rotation.z = -1.1;
      c.armL.position.set(0.25, 1.45, -0.58);
      c.armR.position.set(0.25, 1.45, 0.58);
    } else if (c.workoutType === 'food_roll') {
      const roll = Math.sin(t * 0.65);
      c.bounceGroup.rotation.z = Math.PI / 2;
      c.bounceGroup.rotation.x = roll * 1.25;
      c.bounceGroup.position.set(0.75, 0.65, roll * 0.38);
      c.bodyMesh.scale.set(bellyScale * 1.15, 1.0, bellyScale * 1.15);
    } else if (c.workoutType === 'picnic_shabu' || c.workoutType === 'play_cards') {
      const eat = (Math.sin(t * 0.8) + 1) * 0.5;
      c.bounceGroup.position.y = -0.3 + Math.sin(t * 0.8) * 0.03;
      c.legL.position.set(0.35, 0.25, -0.25);
      c.legR.position.set(0.35, 0.25, 0.25);
      c.legL.rotation.z = Math.PI / 2;
      c.legR.rotation.z = Math.PI / 2;
      c.armR.position.set(0.35, 1.15 + eat * 0.35, 0.45);
      c.armL.position.set(0.1, 1.05, -0.65);
    } else if (c.workoutType === 'eat_pizza' || c.workoutType === 'boba_tea') {
      const munch = (Math.sin(t * 0.85) + 1) * 0.5;
      c.bounceGroup.position.y = Math.abs(Math.sin(t * 0.6)) * 0.08;
      c.bounceGroup.rotation.z = Math.sin(t * 0.4) * 0.04;
      c.armR.position.set(0.28 + munch * 0.12, 1.18 + munch * 0.38, 0.48);
      c.armL.position.set(0, 1.12, -0.75);
    } else {
      const hop = Math.abs(Math.sin(t * 1.1));
      c.bounceGroup.position.y = hop * 0.35;
      c.bounceGroup.rotation.z = Math.sin(t * 1.1) * 0.08;
      c.armL.position.y = 1.2 + hop * 0.5;
      c.armR.position.y = 1.2 + hop * 0.5;
    }
  } else {
    applyCharacterBellyScale(c, bellyScale, c.muscleScale ?? 1);
    const speed = 7.5 + idx * 0.4;
    const bounce = Math.abs(Math.sin(elapsed * speed));
    c.bounceGroup.position.y = bounce * 0.22;
    c.bounceGroup.rotation.z = Math.sin(elapsed * speed) * 0.06;

    c.legL.rotation.z = Math.sin(elapsed * speed) * 0.65;
    c.legR.rotation.z = -Math.sin(elapsed * speed) * 0.65;
    c.armL.position.x = Math.sin(elapsed * speed) * 0.25;
    c.armR.position.x = -Math.sin(elapsed * speed) * 0.25;
  }
  syncCharacterMountPose(c, elapsed, idx, !useActivityAnim || c.workoutType === 'jog', isFloorActivity);
}

export interface PetMeshParts {
  petGroup: THREE.Group;
  tailMesh: THREE.Mesh;
  leashMesh?: THREE.Mesh;
  mixer?: THREE.AnimationMixer | null;
}

const PET_COLORS: Record<string, { body: number; accent: number; baseSpecies: string }> = {
  fox: { body: 0xea580c, accent: 0xfffbeb, baseSpecies: 'fox' },
  pet_fox_scarf: { body: 0xea580c, accent: 0x2563eb, baseSpecies: 'fox' },
  bear: { body: 0xf1f5f9, accent: 0xfacc15, baseSpecies: 'bear' },
  pet_bear_shield: { body: 0xf1f5f9, accent: 0xfacc15, baseSpecies: 'bear' },
  dog: { body: 0xf59e0b, accent: 0x92400e, baseSpecies: 'dog' },
  cat: { body: 0xfb923c, accent: 0xfffbeb, baseSpecies: 'cat' },
  rabbit: { body: 0xf8fafc, accent: 0xf472b6, baseSpecies: 'rabbit' },
  bunny: { body: 0xf8fafc, accent: 0xf472b6, baseSpecies: 'rabbit' },
  pig: { body: 0xf472b6, accent: 0xfb7185, baseSpecies: 'pig' },
  pet_corgi_cape: { body: 0xf59e0b, accent: 0xef4444, baseSpecies: 'dog' },
  pet_cat_crown: { body: 0xfb923c, accent: 0xfacc15, baseSpecies: 'cat' },
  pet_bunny_wings: { body: 0xf8fafc, accent: 0xf472b6, baseSpecies: 'rabbit' },
  pet_pig_chef: { body: 0xf472b6, accent: 0xfacc15, baseSpecies: 'pig' },
  pet_orange_tabby: { body: 0xfb923c, accent: 0xfacc15, baseSpecies: 'cat' },
  pet_hamster: { body: 0xfbbf24, accent: 0xfef3c7, baseSpecies: 'bear' },
  pet_shiba: { body: 0xd97706, accent: 0xef4444, baseSpecies: 'dog' },
  pet_duckling: { body: 0xfacc15, accent: 0xf97316, baseSpecies: 'bird' },
  pet_panda: { body: 0xf8fafc, accent: 0x18181b, baseSpecies: 'bear' },
  pet_frog: { body: 0x22c55e, accent: 0xdcfce7, baseSpecies: 'frog' },
  pet_capybara: { body: 0xa16207, accent: 0xf97316, baseSpecies: 'bear' },
  pet_penguin: { body: 0x1e293b, accent: 0xef4444, baseSpecies: 'bird' },
  pet_seal: { body: 0xe2e8f0, accent: 0x38bdf8, baseSpecies: 'seal' },
  pet_black_cat: { body: 0x1e293b, accent: 0xa855f7, baseSpecies: 'cat' },
  pet_gacha_slime: { body: 0x4ade80, accent: 0xdcfce7, baseSpecies: 'slime' },
  pet_gacha_ghost: { body: 0xf8fafc, accent: 0xc084fc, baseSpecies: 'ghost' },
  pet_gacha_unicorn: { body: 0xfdf4ff, accent: 0xf472b6, baseSpecies: 'dog' },
  pet_gacha_dragon: { body: 0xf59e0b, accent: 0xef4444, baseSpecies: 'dragon' },
  pet_capybara_orange: { body: 0xb45309, accent: 0xf97316, baseSpecies: 'bear' },
  pet_gacha_axolotl: { body: 0xfbcfe8, accent: 0xec4899, baseSpecies: 'frog' },
};

function recolorGlbGroup(root: THREE.Object3D, hex: string) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex) || typeof document === 'undefined') return;
  const tr = parseInt(hex.slice(1, 3), 16);
  const tg = parseInt(hex.slice(3, 5), 16);
  const tb = parseInt(hex.slice(5, 7), 16);
  const clonedMap = new Map<THREE.Material, THREE.Material>();

  const processMat = (mat: THREE.Material): THREE.Material => {
    const cached = clonedMap.get(mat);
    if (cached) return cached;
    const stdMat = mat as THREE.MeshStandardMaterial;
    const cloned = stdMat.clone();
    if (stdMat.map && stdMat.map.image) {
      try {
        const img = stdMat.map.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
        const w = (img as any).width || 256;
        const h = (img as any).height || 256;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i] / 255;
            const g = d[i + 1] / 255;
            const b = d[i + 2] / 255;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            // คงตาดำสนิทและไฮไลท์ตาขาวไว้ แล้วเปลี่ยนสีขนส่วนหลักให้สว่างสดใสตามสีที่เลือก (sRGB)
            if (lum < 0.06 || lum > 0.94) continue;
            const shade = Math.min(1.06, 0.55 + lum * 0.65);
            d[i] = Math.min(255, Math.round(tr * shade));
            d[i + 1] = Math.min(255, Math.round(tg * shade));
            d[i + 2] = Math.min(255, Math.round(tb * shade));
          }
          ctx.putImageData(imgData, 0, 0);
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.flipY = stdMat.map.flipY;
          tex.wrapS = stdMat.map.wrapS;
          tex.wrapT = stdMat.map.wrapT;
          tex.needsUpdate = true;
          cloned.map = tex;
          cloned.color.setHex(0xffffff);
        }
      } catch {
        cloned.color.set(hex);
      }
    } else if (cloned.color) {
      cloned.color.set(hex);
    }
    clonedMap.set(mat, cloned);
    return cloned;
  };

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(processMat);
    } else {
      mesh.material = processMat(mesh.material);
    }
  });
}

export function buildPetMesh(petType: string, customHex?: string): PetMeshParts | null {
  if (!petType || petType === 'none' || petType === 'pet_none' || !PET_COLORS[petType]) return null;

  // 🐈 Handcrafted Studio Ghibli Cats (แมวส้มอ้วน / แมวส้มมงกุฎ / แมวดำจิจิหมวกแม่มด)
  if (
    petType === 'pet_orange_tabby' ||
    petType === 'pet_cat_crown' ||
    petType === 'pet_black_cat'
  ) {
    const isBlackCat = petType === 'pet_black_cat';
    const isCrownCat = petType === 'pet_cat_crown';
    const petGroup = new THREE.Group();
    const defaultHex = isBlackCat ? 0x1e293b : 0xf59e0b;
    const furColor =
      customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)
        ? new THREE.Color(customHex)
        : new THREE.Color(defaultHex);
    const stripeColor = furColor.clone().multiplyScalar(isBlackCat ? 0.55 : 0.68);
    const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.62 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.65 });
    const creamMat = new THREE.MeshStandardMaterial({
      color: isBlackCat ? 0x334155 : 0xfff7ed,
      roughness: 0.6,
    });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5 });
    const scleraMat = new THREE.MeshBasicMaterial({ color: isBlackCat ? 0xfef08a : 0xffffff });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const whiskerMat = new THREE.MeshBasicMaterial({ color: isBlackCat ? 0x94a3b8 : 0x451a03 });
    const collarMat = new THREE.MeshStandardMaterial({
      color: isBlackCat ? 0xa855f7 : 0xef4444,
      roughness: 0.4,
    });
    const bellMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });

    // ตัวกลมตุ้ยนุ้ยสไตล์มูตะ/จิจิ + พุงครีม
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 18), furMat);
    torso.scale.set(1.22, 0.94, 0.96);
    torso.position.set(0, 0.38, 0);
    torso.castShadow = true;
    petGroup.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), creamMat);
    belly.scale.set(1.05, 0.82, 0.85);
    belly.position.set(0.08, 0.31, 0);
    petGroup.add(belly);

    if (!isBlackCat) {
      [-0.14, 0, 0.14].forEach((sx) => {
        const st = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 6, 16, Math.PI * 0.72), stripeMat);
        st.rotation.y = Math.PI / 2;
        st.rotation.z = Math.PI * 0.14;
        st.position.set(sx, 0.42, 0);
        petGroup.add(st);
      });
    }

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 18), furMat);
    head.scale.set(1.02, 0.94, 1.06);
    head.position.set(0.32, 0.62, 0);
    head.castShadow = true;
    petGroup.add(head);

    if (!isBlackCat) {
      [-0.06, 0, 0.06].forEach((fz) => {
        const fStripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.024), stripeMat);
        fStripe.position.set(0.51, 0.79, fz);
        fStripe.rotation.z = -0.35;
        petGroup.add(fStripe);
      });
    }

    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.25, 4), furMat);
      ear.position.set(0.28, 0.88, side * 0.17);
      ear.rotation.x = side * 0.22;
      ear.rotation.y = Math.PI / 4;
      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 4), pinkMat);
      innerEar.position.set(0.32, 0.87, side * 0.17);
      innerEar.rotation.x = side * 0.22;
      innerEar.rotation.y = Math.PI / 4;
      petGroup.add(ear, innerEar);
    });

    [-1, 1].forEach((side) => {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.074, 14, 14), scleraMat);
      sclera.scale.set(0.6, 1.08, 1.0);
      sclera.position.set(0.56, 0.66, side * 0.11);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 12), pupilMat);
      pupil.scale.set(0.55, 1.12, 0.95);
      pupil.position.set(0.585, 0.66, side * 0.11);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), whiteMat);
      shine.position.set(0.605, 0.69, side * 0.095);
      petGroup.add(sclera, pupil, shine);

      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), pinkMat);
      blush.scale.set(0.45, 0.65, 1.0);
      blush.position.set(0.56, 0.56, side * 0.18);
      petGroup.add(blush);

      [-0.025, 0, 0.025].forEach((wy) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 4), whiskerMat);
        w.rotation.x = Math.PI / 2 + side * (wy * 5);
        w.position.set(0.56, 0.56 + wy, side * 0.21);
        petGroup.add(w);
      });
    });

    [-0.045, 0.045].forEach((mz) => {
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), creamMat);
      muzzle.position.set(0.57, 0.55, mz);
      petGroup.add(muzzle);
    });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), pinkMat);
    nose.scale.set(0.8, 0.7, 1.2);
    nose.position.set(0.615, 0.59, 0);
    petGroup.add(nose);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 8, 18), collarMat);
    collar.rotation.y = Math.PI / 2;
    collar.rotation.x = 0.25;
    collar.position.set(0.22, 0.48, 0);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), bellMat);
    bell.position.set(0.41, 0.39, 0);
    petGroup.add(collar, bell);

    if (isCrownCat) {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.12, 6), bellMat);
      crown.position.set(0.32, 0.94, 0);
      const gem = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.4 })
      );
      gem.position.set(0.42, 0.94, 0);
      petGroup.add(crown, gem);
    } else if (isBlackCat) {
      const witchMat = new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.45 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.028, 16), witchMat);
      brim.position.set(0.32, 0.9, 0);
      const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.15, 0.04, 14), bellMat);
      hatBand.position.set(0.31, 0.93, 0);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 14), witchMat);
      cone.position.set(0.28, 1.08, 0);
      cone.rotation.z = 0.22;
      petGroup.add(brim, hatBand, cone);
    }

    const pawGeo = new THREE.SphereGeometry(0.085, 10, 10);
    [
      [0.2, 0.09, -0.16],
      [0.2, 0.09, 0.16],
      [-0.22, 0.09, -0.16],
      [-0.22, 0.09, 0.16],
    ].forEach(([px, py, pz]) => {
      const paw = new THREE.Mesh(pawGeo, creamMat);
      paw.scale.set(1.15, 0.85, 1.0);
      paw.position.set(px, py, pz);
      petGroup.add(paw);
    });

    const tailMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.34, 6, 10), furMat);
    tailMesh.position.set(-0.42, 0.52, 0);
    tailMesh.rotation.z = 0.65;
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), creamMat);
    tailTip.position.set(0, 0.18, 0);
    tailMesh.add(tailTip);
    petGroup.add(tailMesh);

    return { petGroup, tailMesh, mixer: null };
  }

  // 🦊 Handcrafted Studio Ghibli Fox (จิ้งจอกจิบิอัศวิน — สไตล์สมจริงน่ารักเหมือนแมวส้ม)
  if (petType === 'pet_fox_scarf') {
    const petGroup = new THREE.Group();
    const furColor =
      customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)
        ? new THREE.Color(customHex)
        : new THREE.Color(0xea580c);
    const darkFurColor = furColor.clone().multiplyScalar(0.45);
    const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.62 });
    const darkFurMat = new THREE.MeshStandardMaterial({ color: darkFurColor, roughness: 0.68 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.6 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 });
    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });

    // ลำตัวเพรียวนุ่ม + ขนอกสีครีมฟู
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 18), furMat);
    torso.scale.set(1.26, 0.88, 0.9);
    torso.position.set(0, 0.37, 0);
    torso.castShadow = true;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), creamMat);
    chest.scale.set(1.0, 0.92, 0.88);
    chest.position.set(0.16, 0.36, 0);
    petGroup.add(torso, chest);

    // หัวจิ้งจอก + แก้มครีม + ปากแหลมน่ารัก
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 18), furMat);
    head.scale.set(1.06, 0.92, 1.08);
    head.position.set(0.32, 0.62, 0);
    head.castShadow = true;
    const cheekCream = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), creamMat);
    cheekCream.scale.set(1.02, 0.65, 1.12);
    cheekCream.position.set(0.36, 0.54, 0);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.24, 14), creamMat);
    snout.rotation.z = -Math.PI / 2;
    snout.position.set(0.58, 0.57, 0);
    const snoutTop = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.2, 12), furMat);
    snoutTop.rotation.z = -Math.PI / 2 - 0.12;
    snoutTop.position.set(0.56, 0.61, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), noseMat);
    nose.position.set(0.69, 0.58, 0);
    petGroup.add(head, cheekCream, snout, snoutTop, nose);

    // หูจิ้งจอกทรงสามเหลี่ยมใหญ่ปลายเข้ม + ตาโตมีแวว + แก้มชมพู
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 4), furMat);
      ear.position.set(0.27, 0.9, side * 0.17);
      ear.rotation.x = side * 0.2;
      ear.rotation.y = Math.PI / 4;
      const earTip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 4), darkFurMat);
      earTip.position.set(0.27, 1.0, side * 0.19);
      earTip.rotation.x = side * 0.2;
      earTip.rotation.y = Math.PI / 4;
      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.19, 4), creamMat);
      innerEar.position.set(0.31, 0.89, side * 0.17);
      innerEar.rotation.x = side * 0.2;
      innerEar.rotation.y = Math.PI / 4;

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 14), scleraMat);
      sclera.scale.set(0.6, 1.08, 1.0);
      sclera.position.set(0.54, 0.67, side * 0.115);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), pupilMat);
      pupil.scale.set(0.55, 1.1, 0.95);
      pupil.position.set(0.565, 0.67, side * 0.115);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), scleraMat);
      shine.position.set(0.585, 0.695, side * 0.1);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), pinkMat);
      blush.scale.set(0.45, 0.65, 1.0);
      blush.position.set(0.53, 0.58, side * 0.185);
      petGroup.add(ear, earTip, innerEar, sclera, pupil, shine, blush);
    });

    // ผ้าพันคออัศวินสีน้ำเงิน + เข็มกลัดทอง + ชายผ้าปลิว
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.052, 10, 18), scarfMat);
    scarf.rotation.y = Math.PI / 2;
    scarf.rotation.x = 0.28;
    scarf.position.set(0.22, 0.49, 0);
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.13), scarfMat);
    scarfTail.position.set(0.02, 0.54, 0.16);
    scarfTail.rotation.z = 0.25;
    scarfTail.rotation.y = -0.3;
    const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 10), goldMat);
    clasp.position.set(0.41, 0.43, 0);
    petGroup.add(scarf, scarfTail, clasp);

    // ขาและถุงเท้าสีน้ำตาลเข้มแบบจิ้งจอกแท้
    [
      [0.21, 0.11, -0.15],
      [0.21, 0.11, 0.15],
      [-0.22, 0.11, -0.15],
      [-0.22, 0.11, 0.15],
    ].forEach(([px, py, pz]) => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.12, 6, 10), darkFurMat);
      leg.position.set(px, py, pz);
      petGroup.add(leg);
    });

    // หางพวงฟูขนาดใหญ่ปลายสีขาว
    const tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 14), furMat);
    tailMesh.scale.set(1.75, 0.92, 0.95);
    tailMesh.position.set(-0.48, 0.48, 0);
    tailMesh.rotation.z = -0.45;
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 12), creamMat);
    tailTip.scale.set(1.3, 0.9, 0.9);
    tailTip.position.set(-0.18, 0.04, 0);
    tailMesh.add(tailTip);
    petGroup.add(tailMesh);

    return { petGroup, tailMesh, mixer: null };
  }

  // 🐻‍❄️ Handcrafted Studio Ghibli Polar Bear Cub (หมีจิบิผู้พิทักษ์)
  if (petType === 'pet_bear_shield') {
    const petGroup = new THREE.Group();
    const furColor =
      customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)
        ? new THREE.Color(customHex)
        : new THREE.Color(0xf1f5f9);
    const bellyColor = furColor.clone().lerp(new THREE.Color(0xffffff), 0.5);
    const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.66 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: bellyColor, roughness: 0.62 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.35 });
    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.78, roughness: 0.22 });
    const royalMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });

    // ตัวหมีตุ้ยนุ้ยขนนุ่ม
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 18), furMat);
    torso.scale.set(1.18, 0.96, 1.02);
    torso.position.set(0, 0.4, 0);
    torso.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), bellyMat);
    belly.scale.set(1.02, 0.86, 0.9);
    belly.position.set(0.08, 0.33, 0);
    petGroup.add(torso, belly);

    // หัวกลมนุ่ม + ปากหมีกลม + จมูกสีน้ำตาลเข้ม
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 18), furMat);
    head.scale.set(1.04, 0.96, 1.06);
    head.position.set(0.32, 0.64, 0);
    head.castShadow = true;
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 14), bellyMat);
    muzzle.scale.set(1.1, 0.85, 1.05);
    muzzle.position.set(0.58, 0.59, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), noseMat);
    nose.scale.set(0.85, 0.72, 1.25);
    nose.position.set(0.68, 0.625, 0);
    petGroup.add(head, muzzle, nose);

    // หูกลมสองข้าง + ตาโตมีแวว + แก้มชมพู
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 14), furMat);
      ear.scale.set(0.75, 1.0, 1.0);
      ear.position.set(0.26, 0.9, side * 0.21);
      const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), pinkMat);
      innerEar.scale.set(0.6, 0.9, 0.9);
      innerEar.position.set(0.3, 0.895, side * 0.21);

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.066, 14, 14), scleraMat);
      sclera.scale.set(0.6, 1.06, 1.0);
      sclera.position.set(0.56, 0.69, side * 0.125);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 12), pupilMat);
      pupil.scale.set(0.55, 1.08, 0.95);
      pupil.position.set(0.585, 0.69, side * 0.125);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), scleraMat);
      shine.position.set(0.605, 0.715, side * 0.11);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 10), pinkMat);
      blush.scale.set(0.45, 0.65, 1.0);
      blush.position.set(0.55, 0.59, side * 0.2);
      petGroup.add(ear, innerEar, sclera, pupil, shine, blush);
    });

    // สายรัดหนัง + โล่ทองคำอัศวินผู้พิทักษ์ติดข้างลำตัว
    const harness = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.028, 8, 20), strapMat);
    harness.rotation.y = Math.PI / 2;
    harness.position.set(0.04, 0.42, 0);
    const shieldRim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.045, 6), goldMat);
    shieldRim.rotation.x = Math.PI / 2;
    shieldRim.position.set(0.04, 0.45, 0.39);
    const shieldCore = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.125, 0.052, 6), royalMat);
    shieldCore.rotation.x = Math.PI / 2;
    shieldCore.position.set(0.04, 0.45, 0.395);
    const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), goldMat);
    shieldBoss.position.set(0.04, 0.45, 0.425);
    petGroup.add(harness, shieldRim, shieldCore, shieldBoss);

    // อุ้งเท้าหมีอ้วน 4 ข้าง
    [
      [0.21, 0.11, -0.19],
      [0.21, 0.11, 0.19],
      [-0.22, 0.11, -0.19],
      [-0.22, 0.11, 0.19],
    ].forEach(([px, py, pz]) => {
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 12), furMat);
      paw.scale.set(1.15, 0.9, 1.0);
      paw.position.set(px, py, pz);
      petGroup.add(paw);
    });

    const tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), furMat);
    tailMesh.position.set(-0.44, 0.42, 0);
    petGroup.add(tailMesh);

    return { petGroup, tailMesh, mixer: null };
  }

  // 🐕 Handcrafted Studio Ghibli Corgi (คอร์กี้ผ้าคลุมฮีโร่ — ตัวป้อมขาสั้นหูตั้ง)
  if (petType === 'pet_corgi_cape') {
    const petGroup = new THREE.Group();
    const furColor =
      customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)
        ? new THREE.Color(customHex)
        : new THREE.Color(0xf59e0b);
    const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.62 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.6 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5 });
    const tongueMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.35 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 });
    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const capeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.42 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });

    // ตัวคอร์กี้ทรงขนมปังยาวป้อม + แผงอกขาวฟู + ก้นขาวกลม
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 18), furMat);
    torso.scale.set(1.42, 0.86, 0.96);
    torso.position.set(0, 0.34, 0);
    torso.castShadow = true;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 16), whiteMat);
    chest.scale.set(1.0, 0.9, 0.92);
    chest.position.set(0.22, 0.33, 0);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), whiteMat);
    belly.scale.set(1.3, 0.65, 0.86);
    belly.position.set(0.0, 0.25, 0);
    petGroup.add(torso, chest, belly);

    // หัวคอร์กี้ + แถบขาวกลางหน้าผาก + ปากยิ้มแลบลิ้น
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.275, 20, 18), furMat);
    head.scale.set(1.04, 0.94, 1.06);
    head.position.set(0.36, 0.6, 0);
    head.castShadow = true;
    const blaze = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.075), whiteMat);
    blaze.position.set(0.56, 0.68, 0);
    blaze.rotation.z = -0.25;
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), whiteMat);
    muzzle.scale.set(1.18, 0.82, 1.05);
    muzzle.position.set(0.62, 0.55, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), noseMat);
    nose.scale.set(0.85, 0.72, 1.2);
    nose.position.set(0.73, 0.585, 0);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), tongueMat);
    tongue.scale.set(0.65, 1.25, 0.85);
    tongue.position.set(0.69, 0.495, 0);
    petGroup.add(head, blaze, muzzle, nose, tongue);

    // หูคอร์กี้ตั้งใหญ่สองข้าง + ตาโตมีแวว + แก้มชมพู
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.31, 6), furMat);
      ear.scale.set(0.75, 1.0, 1.05);
      ear.position.set(0.31, 0.9, side * 0.18);
      ear.rotation.x = side * 0.26;
      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.21, 6), pinkMat);
      innerEar.scale.set(0.65, 1.0, 1.0);
      innerEar.position.set(0.35, 0.89, side * 0.18);
      innerEar.rotation.x = side * 0.26;

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 14), scleraMat);
      sclera.scale.set(0.6, 1.08, 1.0);
      sclera.position.set(0.585, 0.645, side * 0.12);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 12), pupilMat);
      pupil.scale.set(0.55, 1.1, 0.95);
      pupil.position.set(0.61, 0.645, side * 0.12);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), scleraMat);
      shine.position.set(0.63, 0.67, side * 0.105);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), pinkMat);
      blush.scale.set(0.45, 0.65, 1.0);
      blush.position.set(0.58, 0.555, side * 0.19);
      petGroup.add(ear, innerEar, sclera, pupil, shine, blush);
    });

    // ผ้าคลุมฮีโร่สีแดงพริ้วกลางหลัง + ปลอกคอทอง
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 8, 18), capeMat);
    collar.rotation.y = Math.PI / 2;
    collar.rotation.x = 0.25;
    collar.position.set(0.26, 0.46, 0);
    const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), goldMat);
    clasp.position.set(0.45, 0.39, 0);
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.042, 0.42), capeMat);
    cape.position.set(-0.08, 0.61, 0);
    cape.rotation.z = 0.16;
    const capeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.046, 0.43), goldMat);
    capeTrim.position.set(-0.31, 0.57, 0);
    capeTrim.rotation.z = 0.16;
    petGroup.add(collar, clasp, cape, capeTrim);

    // ขาสั้นป้อมสีขาว 4 ข้าง
    [
      [0.24, 0.085, -0.17],
      [0.24, 0.085, 0.17],
      [-0.25, 0.085, -0.17],
      [-0.25, 0.085, 0.17],
    ].forEach(([px, py, pz]) => {
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 12), whiteMat);
      paw.scale.set(1.2, 0.82, 1.0);
      paw.position.set(px, py, pz);
      petGroup.add(paw);
    });

    // หางจุกคอร์กี้ฟูสีขาว
    const tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 12), whiteMat);
    tailMesh.scale.set(1.15, 0.95, 1.0);
    tailMesh.position.set(-0.48, 0.42, 0);
    petGroup.add(tailMesh);

    const leashMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    leashMesh.rotation.z = Math.PI / 2;

    return { petGroup, tailMesh, leashMesh, mixer: null };
  }

  // 🐖 Handcrafted Studio Ghibli Piglet Chef (หมูจิ๋วหมวกเชฟทอง)
  if (petType === 'pet_pig_chef') {
    const petGroup = new THREE.Group();
    const skinColor =
      customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)
        ? new THREE.Color(customHex)
        : new THREE.Color(0xf9a8d4);
    const snoutColor = skinColor.clone().multiplyScalar(0.86);
    const bellyColor = skinColor.clone().lerp(new THREE.Color(0xfff1f2), 0.55);
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.58 });
    const snoutMat = new THREE.MeshStandardMaterial({ color: snoutColor, roughness: 0.5 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: bellyColor, roughness: 0.58 });
    const hoofMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.5 });
    const blushMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.5 });
    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const chefWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.78, roughness: 0.22 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.42 });

    // ตัวหมูจิ๋วกลมปุ๊ก + พุงอ่อน
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 18), skinMat);
    torso.scale.set(1.24, 0.95, 1.0);
    torso.position.set(0, 0.37, 0);
    torso.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), bellyMat);
    belly.scale.set(1.06, 0.82, 0.88);
    belly.position.set(0.06, 0.3, 0);
    petGroup.add(torso, belly);

    // หัวกลม + จมูกหมูทรงกระบอกพร้อมรูจมูก 2 ข้าง
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.285, 20, 18), skinMat);
    head.scale.set(1.02, 0.95, 1.06);
    head.position.set(0.32, 0.6, 0);
    head.castShadow = true;
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.11, 16), snoutMat);
    snout.rotation.z = Math.PI / 2;
    snout.scale.set(0.85, 1.0, 1.25);
    snout.position.set(0.61, 0.565, 0);
    petGroup.add(head, snout);

    [-0.042, 0.042].forEach((nz) => {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), hoofMat);
      nostril.scale.set(0.5, 1.25, 0.85);
      nostril.position.set(0.665, 0.57, nz);
      petGroup.add(nostril);
    });

    // หูหมูพับน่ารัก + ตาโตมีแวว + แก้มชมพู
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.21, 5), snoutMat);
      ear.position.set(0.29, 0.83, side * 0.2);
      ear.rotation.x = side * 0.68;
      ear.rotation.z = -0.35;

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.066, 14, 14), scleraMat);
      sclera.scale.set(0.6, 1.06, 1.0);
      sclera.position.set(0.555, 0.655, side * 0.125);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 12), pupilMat);
      pupil.scale.set(0.55, 1.08, 0.95);
      pupil.position.set(0.58, 0.655, side * 0.125);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), scleraMat);
      shine.position.set(0.6, 0.68, side * 0.11);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 10), blushMat);
      blush.scale.set(0.45, 0.65, 1.0);
      blush.position.set(0.545, 0.56, side * 0.195);
      petGroup.add(ear, sclera, pupil, shine, blush);
    });

    // หมวกเชฟมิชลินคาดแถบทอง + ผ้าผูกคอเชฟสีแดง
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.14, 0.065, 16), goldMat);
    hatBand.position.set(0.32, 0.88, 0);
    const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.12, 16), chefWhiteMat);
    hatCrown.position.set(0.32, 0.96, 0);
    [
      [0.32, 1.06, 0],
      [0.4, 1.03, 0.07],
      [0.4, 1.03, -0.07],
      [0.24, 1.03, 0.07],
      [0.24, 1.03, -0.07],
    ].forEach(([px, py, pz]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 12), chefWhiteMat);
      puff.position.set(px, py, pz);
      petGroup.add(puff);
    });
    const kerchief = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 8, 18), redMat);
    kerchief.rotation.y = Math.PI / 2;
    kerchief.rotation.x = 0.25;
    kerchief.position.set(0.22, 0.46, 0);
    petGroup.add(hatBand, hatCrown, kerchief);

    // ขาหมูจิ๋วพร้อมกีบสีเข้ม 4 ข้าง
    [
      [0.21, 0.11, -0.16],
      [0.21, 0.11, 0.16],
      [-0.22, 0.11, -0.16],
      [-0.22, 0.11, 0.16],
    ].forEach(([px, py, pz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.16, 10), skinMat);
      leg.position.set(px, py, pz);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.06, 0.05, 10), hoofMat);
      hoof.position.set(px, 0.025, pz);
      petGroup.add(leg, hoof);
    });

    // หางหมูม้วนขดน่ารัก
    const tailMesh = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.02, 8, 14, Math.PI * 1.6), snoutMat);
    tailMesh.position.set(-0.46, 0.44, 0);
    tailMesh.rotation.y = Math.PI / 2;
    petGroup.add(tailMesh);

    return { petGroup, tailMesh, mixer: null };
  }

  // 🐇 Handcrafted Studio Ghibli Angel Bunny (กระต่ายน้อยติดปีกนางฟ้า)
  if (petType === 'pet_bunny_wings') {
    const petGroup = new THREE.Group();
    const furColor =
      customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)
        ? new THREE.Color(customHex)
        : new THREE.Color(0xf8fafc);
    const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.62 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.6 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5 });
    const wingPinkMat = new THREE.MeshStandardMaterial({
      color: 0xfbcfe8,
      emissive: 0xf472b6,
      emissiveIntensity: 0.22,
      roughness: 0.35,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfde047,
      emissiveIntensity: 0.35,
      metalness: 0.75,
      roughness: 0.2,
    });
    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const whiskerMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });

    // ตัวกระต่ายกลมนุ่มฟู
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 18), furMat);
    torso.scale.set(1.18, 0.96, 0.96);
    torso.position.set(0, 0.37, 0);
    torso.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), creamMat);
    belly.scale.set(1.0, 0.85, 0.86);
    belly.position.set(0.08, 0.31, 0);
    petGroup.add(torso, belly);

    // หัวกระต่ายกลม + ปากพองคู่ + จมูกชมพู
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 18), furMat);
    head.scale.set(1.02, 0.95, 1.05);
    head.position.set(0.3, 0.63, 0);
    head.castShadow = true;
    petGroup.add(head);

    [-0.04, 0.04].forEach((mz) => {
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 10), creamMat);
      muzzle.position.set(0.55, 0.56, mz);
      petGroup.add(muzzle);
    });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), pinkMat);
    nose.scale.set(0.8, 0.7, 1.25);
    nose.position.set(0.595, 0.595, 0);
    petGroup.add(nose);

    // หูกระต่ายยาวตั้งเรียว + ตาโตมีแวว + หนวด + ปีกนางฟ้าขนนกหลายชั้น
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.34, 8, 12), furMat);
      ear.scale.set(0.75, 1.0, 1.0);
      ear.position.set(0.26, 1.04, side * 0.12);
      ear.rotation.x = side * 0.16;
      ear.rotation.z = 0.1;
      const innerEar = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.25, 6, 10), pinkMat);
      innerEar.scale.set(0.6, 1.0, 1.0);
      innerEar.position.set(0.295, 1.03, side * 0.12);
      innerEar.rotation.x = side * 0.16;
      innerEar.rotation.z = 0.1;

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 14), scleraMat);
      sclera.scale.set(0.6, 1.1, 1.0);
      sclera.position.set(0.54, 0.67, side * 0.115);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.047, 12, 12), pupilMat);
      pupil.scale.set(0.55, 1.12, 0.95);
      pupil.position.set(0.565, 0.67, side * 0.115);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), scleraMat);
      shine.position.set(0.585, 0.695, side * 0.1);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), pinkMat);
      blush.scale.set(0.45, 0.65, 1.0);
      blush.position.set(0.54, 0.57, side * 0.185);
      petGroup.add(ear, innerEar, sclera, pupil, shine, blush);

      [-0.02, 0.02].forEach((wy) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.14, 4), whiskerMat);
        w.rotation.x = Math.PI / 2 + side * (wy * 5);
        w.position.set(0.54, 0.57 + wy, side * 0.2);
        petGroup.add(w);
      });

      // ปีกนางฟ้าแบบขนนกซ้อน 2 ชั้น
      const upperWing = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), wingPinkMat);
      upperWing.scale.set(1.15, 0.32, 1.45);
      upperWing.position.set(-0.04, 0.6, side * 0.34);
      upperWing.rotation.x = side * 0.55;
      upperWing.rotation.y = side * -0.25;
      const lowerWing = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), furMat);
      lowerWing.scale.set(1.0, 0.28, 1.2);
      lowerWing.position.set(-0.14, 0.52, side * 0.28);
      lowerWing.rotation.x = side * 0.42;
      lowerWing.rotation.y = side * -0.2;
      petGroup.add(upperWing, lowerWing);
    });

    // วงแหวนนางฟ้าสีทองลอยเหนือหัว
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 20), goldMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0.3, 1.32, 0);
    petGroup.add(halo);

    // อุ้งเท้ากระต่าย 4 ข้าง
    [
      [0.2, 0.09, -0.15],
      [0.2, 0.09, 0.15],
      [-0.2, 0.09, -0.15],
      [-0.2, 0.09, 0.15],
    ].forEach(([px, py, pz]) => {
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), creamMat);
      paw.scale.set(1.25, 0.82, 1.0);
      paw.position.set(px, py, pz);
      petGroup.add(paw);
    });

    // หางปอมปอมฟูกลม
    const tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 12), creamMat);
    tailMesh.position.set(-0.42, 0.38, 0);
    petGroup.add(tailMesh);

    return { petGroup, tailMesh, mixer: null };
  }

  // 🐧 Handcrafted Chubby Cute Penguin (เพนกวินจิ๋วหูกระต่าย)
  if (petType === 'pet_penguin') {
    const petGroup = new THREE.Group();
    const bodyColor = customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex) ? new THREE.Color(customHex) : new THREE.Color(0x1e293b);
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 18), bodyMat);
    body.scale.set(0.95, 1.25, 0.98);
    body.position.set(0, 0.48, 0);
    body.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 16), whiteMat);
    belly.scale.set(0.82, 1.05, 0.85);
    belly.position.set(0.14, 0.44, 0);
    petGroup.add(body, belly);

    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), pupilMat);
      eye.position.set(0.31, 0.68, side * 0.13);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), shineMat);
      shine.position.set(0.355, 0.705, side * 0.115);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), pinkMat);
      blush.scale.set(0.45, 0.65, 1);
      blush.position.set(0.31, 0.59, side * 0.19);
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), bodyMat);
      wing.scale.set(0.55, 1.45, 0.35);
      wing.position.set(0, 0.46, side * 0.36);
      wing.rotation.x = side * 0.28;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.12), orangeMat);
      foot.position.set(0.08, 0.04, side * 0.14);
      petGroup.add(eye, shine, blush, wing, foot);
    });

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 10), orangeMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.39, 0.62, 0);
    const bowL = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.11, 6), redMat);
    bowL.rotation.x = Math.PI / 2;
    bowL.position.set(0.36, 0.46, -0.06);
    const bowR = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.11, 6), redMat);
    bowR.rotation.x = -Math.PI / 2;
    bowR.position.set(0.36, 0.46, 0.06);
    const bowMid = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), redMat);
    bowMid.position.set(0.37, 0.46, 0);
    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), bodyMat);
    tailMesh.position.set(-0.34, 0.22, 0);
    tailMesh.rotation.z = 0.8;
    petGroup.add(beak, bowL, bowR, bowMid, tailMesh);
    return { petGroup, tailMesh, mixer: null };
  }

  // 🟢 Handcrafted Glossy Crystal Slime (สไลม์คริสตัลเด้งดึ๋ง)
  if (petType === 'pet_gacha_slime') {
    const petGroup = new THREE.Group();
    const slimeColor = customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex) ? new THREE.Color(customHex) : new THREE.Color(0x4ade80);
    const slimeMat = new THREE.MeshPhysicalMaterial({
      color: slimeColor,
      emissive: slimeColor,
      emissiveIntensity: 0.22,
      roughness: 0.12,
      transmission: 0.35,
      transparent: true,
      opacity: 0.9,
    });
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: slimeColor, emissiveIntensity: 0.6 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xf9a8d4 });

    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.38, 22, 18), slimeMat);
    blob.scale.set(1.15, 0.92, 1.15);
    blob.position.set(0, 0.34, 0);
    blob.castShadow = true;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), coreMat);
    core.position.set(0, 0.32, 0);
    const tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), slimeMat);
    tailMesh.scale.set(0.8, 1.35, 0.8);
    tailMesh.position.set(0, 0.72, 0);
    petGroup.add(blob, core, tailMesh);

    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), pupilMat);
      eye.scale.set(0.6, 1.25, 0.9);
      eye.position.set(0.39, 0.38, side * 0.13);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), shineMat);
      shine.position.set(0.415, 0.41, side * 0.12);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), blushMat);
      blush.scale.set(0.4, 0.65, 1);
      blush.position.set(0.38, 0.29, side * 0.22);
      petGroup.add(eye, shine, blush);
    });
    return { petGroup, tailMesh, mixer: null };
  }

  // 👻 Handcrafted Cute Floating Ghibli Ghost (ผีน้อยน่ารักลอยตาม)
  if (petType === 'pet_gacha_ghost') {
    const petGroup = new THREE.Group();
    const ghostColor = customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex) ? new THREE.Color(customHex) : new THREE.Color(0xf8fafc);
    const ghostMat = new THREE.MeshStandardMaterial({
      color: ghostColor,
      emissive: 0xc084fc,
      emissiveIntensity: 0.25,
      roughness: 0.35,
      transparent: true,
      opacity: 0.94,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 16), ghostMat);
    head.position.set(0, 0.68, 0);
    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.45, 18), ghostMat);
    cloak.position.set(0, 0.44, 0);
    petGroup.add(head, cloak);

    // ชายผ้าพริ้วด้านล่าง 6 หยัก
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const frill = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), ghostMat);
      frill.position.set(Math.cos(a) * 0.26, 0.22, Math.sin(a) * 0.26);
      petGroup.add(frill);
    }

    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), pupilMat);
      eye.scale.set(0.6, 1.2, 0.95);
      eye.position.set(0.27, 0.72, side * 0.11);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), shineMat);
      shine.position.set(0.295, 0.745, side * 0.1);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), blushMat);
      blush.scale.set(0.45, 0.65, 1);
      blush.position.set(0.26, 0.63, side * 0.18);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.12, 6, 8), ghostMat);
      arm.position.set(0.12, 0.52, side * 0.31);
      arm.rotation.x = side * 0.6;
      petGroup.add(eye, shine, blush, arm);
    });

    const tailMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.025, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0xd946ef, emissiveIntensity: 0.8 })
    );
    tailMesh.rotation.x = Math.PI / 2;
    tailMesh.position.set(0, 1.06, 0);
    petGroup.add(tailMesh);
    return { petGroup, tailMesh, mixer: null };
  }

  // 🦄 Handcrafted Pastel Baby Unicorn (ลูกยูนิคอร์นพาสเทล)
  if (petType === 'pet_gacha_unicorn') {
    const petGroup = new THREE.Group();
    const bodyColor = customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex) ? new THREE.Color(customHex) : new THREE.Color(0xfdf4ff);
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45 });
    const maneMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 0.2 });
    const lavMat = new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.4 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5 });

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 16), bodyMat);
    torso.scale.set(1.25, 0.88, 0.88);
    torso.position.set(0, 0.38, 0);
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 16), bodyMat);
    head.scale.set(1.12, 0.95, 0.95);
    head.position.set(0.34, 0.64, 0);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.28, 10), goldMat);
    horn.position.set(0.42, 0.9, 0);
    horn.rotation.z = -0.35;
    petGroup.add(torso, head, horn);

    // แผงคอพาสเทลฟูๆ
    [
      [0.24, 0.84, maneMat],
      [0.14, 0.74, lavMat],
      [0.08, 0.62, maneMat],
    ].forEach(([mx, my, mMat]) => {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), mMat as THREE.Material);
      tuft.position.set(mx as number, my as number, 0);
      petGroup.add(tuft);
    });

    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 6), bodyMat);
      ear.position.set(0.28, 0.86, side * 0.12);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), pupilMat);
      eye.position.set(0.52, 0.67, side * 0.11);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), whiteMat);
      shine.position.set(0.56, 0.695, side * 0.1);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), pinkMat);
      blush.position.set(0.51, 0.59, side * 0.16);
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), whiteMat);
      wing.scale.set(0.95, 0.3, 1.3);
      wing.position.set(-0.02, 0.56, side * 0.28);
      wing.rotation.x = side * 0.45;
      petGroup.add(ear, eye, shine, blush, wing);
    });

    [
      [0.2, 0.12, -0.14],
      [0.2, 0.12, 0.14],
      [-0.2, 0.12, -0.14],
      [-0.2, 0.12, 0.14],
    ].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.24, 8), bodyMat);
      leg.position.set(lx, ly, lz);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.06, 8), goldMat);
      hoof.position.set(lx, 0.03, lz);
      petGroup.add(leg, hoof);
    });

    const tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), maneMat);
    tailMesh.scale.set(1.4, 0.85, 0.85);
    tailMesh.position.set(-0.42, 0.46, 0);
    petGroup.add(tailMesh);
    return { petGroup, tailMesh, mixer: null };
  }

  // 🐉 Handcrafted Chubby Baby Golden Dragon (ลูกมังกรทองพ่นไฟ)
  if (petType === 'pet_gacha_dragon') {
    const petGroup = new THREE.Group();
    const bodyColor = customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex) ? new THREE.Color(customHex) : new THREE.Color(0xf59e0b);
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xf97316, emissiveIntensity: 0.35 });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.35 });
    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x18181b });

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 16), bodyMat);
    torso.scale.set(1.2, 0.92, 0.92);
    torso.position.set(0, 0.38, 0);
    torso.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), bellyMat);
    belly.position.set(0.08, 0.32, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 16), bodyMat);
    head.scale.set(1.12, 0.96, 1.0);
    head.position.set(0.34, 0.64, 0);
    petGroup.add(torso, belly, head);

    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 8), hornMat);
      horn.position.set(0.26, 0.88, side * 0.12);
      horn.rotation.z = 0.35;
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), scleraMat);
      sclera.scale.set(0.6, 1.05, 1);
      sclera.position.set(0.55, 0.67, side * 0.12);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 10), pupilMat);
      pupil.position.set(0.575, 0.67, side * 0.12);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), scleraMat);
      shine.position.set(0.595, 0.695, side * 0.105);
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 5), wingMat);
      wing.position.set(-0.04, 0.64, side * 0.3);
      wing.rotation.x = side * 0.72;
      petGroup.add(horn, sclera, pupil, shine, wing);
    });

    [
      [0.2, 0.1, -0.15],
      [0.2, 0.1, 0.15],
      [-0.2, 0.1, -0.15],
      [-0.2, 0.1, 0.15],
    ].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), bodyMat);
      leg.position.set(lx, ly, lz);
      petGroup.add(leg);
    });

    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.44, 10), bodyMat);
    tailMesh.position.set(-0.44, 0.44, 0);
    tailMesh.rotation.z = 1.05;
    const flameTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xfacc15, emissiveIntensity: 0.9 })
    );
    flameTip.position.set(0, 0.22, 0);
    tailMesh.add(flameTip);
    petGroup.add(tailMesh);
    return { petGroup, tailMesh, mixer: null };
  }
  const palette = PET_COLORS[petType];
  const baseType = palette.baseSpecies;
  const petGroup = new THREE.Group();
  const fallbackPetBody = new THREE.Group();
  const petGearOverlay = new THREE.Group();
  petGroup.add(fallbackPetBody, petGearOverlay);

  const bodyMat = new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.45 });
  const accentMat = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.45 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18181b });

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), bodyMat);
  torso.scale.set(1.25, 0.85, 0.85);
  torso.position.y = 0.36;
  torso.castShadow = true;
  fallbackPetBody.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), bodyMat);
  head.position.set(0.32, 0.54, 0);
  head.castShadow = true;
  fallbackPetBody.add(head);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), eyeMat);
  eyeL.position.set(0.51, 0.59, -0.09);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), eyeMat);
  eyeR.position.set(0.51, 0.59, 0.09);
  fallbackPetBody.add(eyeL, eyeR);

  if (baseType === 'dog' || baseType === 'fox') {
    const earGeo = new THREE.ConeGeometry(0.075, 0.2, 8);
    const earL = new THREE.Mesh(earGeo, bodyMat);
    earL.position.set(0.3, 0.76, -0.14);
    const earR = new THREE.Mesh(earGeo, bodyMat);
    earR.position.set(0.3, 0.76, 0.14);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), accentMat);
    snout.position.set(0.52, 0.5, 0);
    fallbackPetBody.add(earL, earR, snout);
  } else if (baseType === 'bear') {
    const earGeo = new THREE.SphereGeometry(0.08, 10, 10);
    const earL = new THREE.Mesh(earGeo, bodyMat);
    earL.position.set(0.3, 0.76, -0.15);
    const earR = new THREE.Mesh(earGeo, bodyMat);
    earR.position.set(0.3, 0.76, 0.15);
    fallbackPetBody.add(earL, earR);
  } else if (baseType === 'cat') {
    const earGeo = new THREE.ConeGeometry(0.07, 0.18, 8);
    const earL = new THREE.Mesh(earGeo, bodyMat);
    earL.position.set(0.3, 0.78, -0.12);
    const earR = new THREE.Mesh(earGeo, bodyMat);
    earR.position.set(0.3, 0.78, 0.12);
    fallbackPetBody.add(earL, earR);
  } else if (baseType === 'rabbit') {
    const earGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.34, 10);
    const earL = new THREE.Mesh(earGeo, bodyMat);
    earL.position.set(0.28, 0.85, -0.09);
    const earR = new THREE.Mesh(earGeo, bodyMat);
    earR.position.set(0.28, 0.85, 0.09);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), accentMat);
    nose.position.set(0.55, 0.52, 0);
    fallbackPetBody.add(earL, earR, nose);
  } else if (baseType === 'pig') {
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), accentMat);
    snout.rotation.z = Math.PI / 2;
    snout.position.set(0.55, 0.5, 0);
    const earGeo = new THREE.ConeGeometry(0.06, 0.12, 8);
    const earL = new THREE.Mesh(earGeo, accentMat);
    earL.position.set(0.3, 0.76, -0.13);
    const earR = new THREE.Mesh(earGeo, accentMat);
    earR.position.set(0.3, 0.76, 0.13);
    fallbackPetBody.add(snout, earL, earR);
  }

  // Pet Gear Props (สวมทับบนโมเดล .glb สัตว์เลี้ยงด้วย)
  if (petType === 'pet_corgi_cape' || petType === 'pet_fox_scarf') {
    const capeColor = petType === 'pet_fox_scarf' ? 0x2563eb : 0xef4444;
    const cape = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.045, 0.34),
      new THREE.MeshStandardMaterial({ color: capeColor, roughness: 0.4 })
    );
    cape.position.set(-0.08, 0.54, 0);
    cape.rotation.z = 0.22;
    petGearOverlay.add(cape);
  } else if (petType === 'pet_bear_shield') {
    const miniShield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.14, 0.05, 6),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.75, roughness: 0.25 })
    );
    miniShield.rotation.x = Math.PI / 2;
    miniShield.position.set(0.05, 0.48, 0.28);
    petGearOverlay.add(miniShield);
  } else if (petType === 'pet_cat_crown' || petType === 'pet_pig_chef') {
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.09, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.2 })
    );
    crown.position.set(0.12, 0.92, 0);
    petGearOverlay.add(crown);
  } else if (petType === 'pet_bunny_wings') {
    const wMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xf472b6,
      emissiveIntensity: 0.35,
    });
    [-0.24, 0.24].forEach((wz) => {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), wMat);
      w.scale.set(0.4, 1.3, 0.8);
      w.position.set(-0.04, 0.55, wz);
      petGearOverlay.add(w);
    });
  } else if (petType === 'pet_orange_tabby') {
    // ปลอกคอแดงกระดิ่งทอง (เข้ากับโมเดล cat_pet.glb)
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.03, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
    );
    collar.rotation.y = Math.PI / 2;
    collar.position.set(0.14, 0.42, 0);
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
    );
    bell.position.set(0.28, 0.34, 0);
    petGearOverlay.add(collar, bell);
  } else if (petType === 'pet_shiba') {
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.045, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })
    );
    scarf.rotation.y = Math.PI / 2;
    scarf.position.set(0.22, 0.46, 0);
    petGearOverlay.add(scarf);
  } else if (petType === 'pet_panda') {
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    [-0.14, 0.14].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), blackMat);
      ear.position.set(0.3, 0.78, ez);
      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), blackMat);
      patch.position.set(0.49, 0.58, ez * 0.65);
      fallbackPetBody.add(ear, patch);
    });
    const bamboo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4 })
    );
    bamboo.rotation.x = Math.PI / 2;
    bamboo.rotation.z = 0.2;
    bamboo.position.set(0.22, 0.48, 0.12);
    petGearOverlay.add(bamboo);
  } else if (petType === 'pet_capybara' || petType === 'pet_capybara_orange') {
    const orange = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 })
    );
    orange.position.set(0.06, 0.94, 0);
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.03, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x22c55e })
    );
    leaf.position.set(0.06, 1.05, 0.03);
    petGearOverlay.add(orange, leaf);
    if (petType === 'pet_capybara_orange') {
      const topOrange = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.35 })
      );
      topOrange.position.set(0.06, 1.11, 0);
      leaf.position.set(0.06, 1.2, 0.02);
      const scarf = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.05, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
      );
      scarf.rotation.x = Math.PI / 2;
      scarf.position.set(0.12, 0.44, 0);
      petGearOverlay.add(topOrange, scarf);
    }
  } else if (petType === 'pet_gacha_axolotl') {
    // เหงือกฟูสีชมพูเข้ม 3 คู่ซ้าย-ขวา + หางปลาสีชมพูพาสเทล
    const gillMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xbe185d,
      emissiveIntensity: 0.25,
      roughness: 0.35,
    });
    for (const side of [-1, 1]) {
      for (let g = 0; g < 3; g++) {
        const gill = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.14, 4, 8), gillMat);
        gill.position.set(0.18, 0.62 + (g - 1) * 0.09, side * 0.32);
        gill.rotation.x = side * (1.2 + (g - 1) * 0.22);
        petGearOverlay.add(gill);
      }
    }
    const tailFin = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.42, 8),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 })
    );
    tailFin.rotation.z = Math.PI / 2;
    tailFin.position.set(-0.48, 0.34, 0);
    petGearOverlay.add(tailFin);
  } else if (petType === 'pet_penguin' || petType === 'pet_duckling') {
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.16, 8),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
    );
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.58, 0.51, 0);
    fallbackPetBody.add(beak);
    if (petType === 'pet_penguin') {
      const belly = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
      );
      belly.position.set(0.08, 0.34, 0);
      const bow = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.07, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xef4444 })
      );
      bow.position.set(0.36, 0.42, 0);
      petGearOverlay.add(belly, bow);
    }
  } else if (petType === 'pet_frog') {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    [-0.1, 0.1].forEach((fz) => {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), bodyMat);
      bump.position.set(0.36, 0.74, fz);
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), whiteMat);
      sclera.position.set(0.43, 0.75, fz);
      fallbackPetBody.add(bump, sclera);
    });
  } else if (petType === 'pet_black_cat') {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.4 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 14), hatMat);
    brim.position.set(0.08, 0.88, 0);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 12), hatMat);
    cone.position.set(0.06, 1.04, 0);
    cone.rotation.z = 0.18;
    petGearOverlay.add(brim, cone);
  } else if (petType === 'pet_hamster') {
    const cheekMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5 });
    [-0.16, 0.16].forEach((cz) => {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), cheekMat);
      cheek.position.set(0.44, 0.49, cz);
      fallbackPetBody.add(cheek);
    });
  } else if (petType === 'pet_seal') {
    const flipperGeo = new THREE.BoxGeometry(0.18, 0.04, 0.26);
    [-0.28, 0.28].forEach((sz) => {
      const fl = new THREE.Mesh(flipperGeo, bodyMat);
      fl.position.set(0.06, 0.24, sz);
      fallbackPetBody.add(fl);
    });
  } else if (petType === 'pet_gacha_slime') {
    torso.scale.set(1.2, 1.05, 1.2);
    head.visible = false;
    const crownDrop = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x86efac, emissive: 0x4ade80, emissiveIntensity: 0.45 })
    );
    crownDrop.position.set(0, 0.72, 0);
    petGearOverlay.add(crownDrop);
  } else if (petType === 'pet_gacha_ghost') {
    const sheet = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.72, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0xc084fc,
        emissiveIntensity: 0.32,
        transparent: true,
        opacity: 0.9,
      })
    );
    sheet.position.set(0.1, 0.55, 0);
    petGearOverlay.add(sheet);
  } else if (petType === 'pet_gacha_unicorn') {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.26, 10),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
    );
    horn.position.set(0.42, 0.82, 0);
    horn.rotation.z = -0.35;
    const mane = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.14, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 0.25 })
    );
    mane.position.set(0.18, 0.72, 0);
    petGearOverlay.add(horn, mane);
  } else if (petType === 'pet_gacha_dragon') {
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xf97316,
      emissiveIntensity: 0.4,
    });
    [-0.26, 0.26].forEach((dz) => {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 6), wingMat);
      wing.position.set(-0.04, 0.62, dz);
      wing.rotation.x = dz > 0 ? 0.7 : -0.7;
      petGearOverlay.add(wing);
    });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.75 });
    [-0.09, 0.09].forEach((hz) => {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 8), hornMat);
      h.position.set(0.28, 0.8, hz);
      petGearOverlay.add(h);
    });
  }

  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.24, 8);
  [
    [0.2, 0.12, -0.14],
    [0.2, 0.12, 0.14],
    [-0.2, 0.12, -0.14],
    [-0.2, 0.12, 0.14],
  ].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(lx, ly, lz);
    fallbackPetBody.add(leg);
  });

  const tailMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, baseType === 'rabbit' ? 0.12 : 0.26, 8),
    baseType === 'rabbit' ? accentMat : bodyMat
  );
  tailMesh.position.set(-0.38, 0.45, 0);
  tailMesh.rotation.z = 0.7;
  fallbackPetBody.add(tailMesh);

  let leashMesh: THREE.Mesh | undefined;
  if (baseType === 'dog') {
    leashMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    leashMesh.rotation.z = Math.PI / 2;
  }

  const petParts: PetMeshParts = { petGroup, tailMesh, leashMesh, mixer: null };

  if (customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)) {
    applyCustomDyeToGroup(petGearOverlay, customHex, palette.accent);
    applyCustomDyeToGroup(fallbackPetBody, customHex, palette.body);
  }

  const petGlbUrl = PET_GLB_MAP[petType];
  if (petGlbUrl) {
    loadNormalizedGLB(petGlbUrl, 0.92, true)
      .then((res) => {
        if (petGroup.userData.disposed) return;
        fallbackPetBody.visible = false;
        const effectiveTint =
          customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)
            ? customHex
            : petType === 'pet_orange_tabby' || petType === 'pet_cat_crown'
            ? '#FB923C'
            : undefined;
        if (effectiveTint) {
          recolorGlbGroup(res.group, effectiveTint);
        }
        petGroup.add(res.group);
        petParts.mixer = res.mixer;
      })
      .catch(() => {
        // Fallback to procedural pet mesh silently
      });
  }

  return petParts;
}

export function animatePetMotion(
  petParts: PetMeshParts,
  ownerParts: CharacterMeshParts,
  petType: string,
  isCloseToFinish: boolean,
  elapsed: number,
  idx: number
) {
  const baseType = PET_COLORS[petType]?.baseSpecies || petType;
  const t = elapsed * 8 + idx;
  let targetX = 0.9;
  let targetZ = 0.65;
  let hop = petParts.mixer ? 0.02 : Math.abs(Math.sin(t)) * 0.15;

  if (baseType === 'dog') {
    if (!isCloseToFinish) {
      targetX = 1.35;
      targetZ = 0.35;
      hop = petParts.mixer ? 0.02 : Math.abs(Math.sin(t * 1.3)) * 0.2;
      if (!ownerParts.mixer) {
        ownerParts.bounceGroup.rotation.z = 0.14 + Math.sin(t) * 0.04;
      }
    } else {
      targetX = -1.25;
      targetZ = 0.45;
      hop = petParts.mixer ? 0.02 : Math.abs(Math.sin(t)) * 0.14;
    }
  } else if (baseType === 'fox') {
    targetX = isCloseToFinish ? 1.15 : 0.95;
    targetZ = 0.62;
    hop = petParts.mixer ? 0.03 : Math.abs(Math.sin(t * 1.25)) * 0.2;
  } else if (baseType === 'bear') {
    targetX = -0.85;
    targetZ = -0.68;
    hop = petParts.mixer ? 0.02 : Math.abs(Math.sin(t * 0.8)) * 0.1;
  } else if (baseType === 'cat') {
    if (!isCloseToFinish) {
      targetX = -1.15;
      targetZ = 0.55;
      hop = petParts.mixer ? 0.01 : Math.abs(Math.sin(t * 0.4)) * 0.04;
    } else {
      targetX = 0.75;
      targetZ = 0.65;
      hop = petParts.mixer ? 0.02 : Math.abs(Math.sin(t * 1.1)) * 0.18;
    }
  } else if (baseType === 'rabbit') {
    targetX = isCloseToFinish ? 0.85 : 1.25;
    targetZ = -0.58;
    hop = petParts.mixer ? 0.05 * Math.abs(Math.sin(t * 1.4)) : Math.abs(Math.sin(t * 1.4)) * 0.34;
  } else if (baseType === 'pig') {
    targetX = isCloseToFinish ? 1.2 : -1.05;
    targetZ = 0.58;
    hop = petParts.mixer ? 0.02 : Math.abs(Math.sin(t * (isCloseToFinish ? 1.2 : 0.6))) * 0.12;
  }

  petParts.petGroup.position.set(targetX, hop, targetZ);
  petParts.tailMesh.rotation.y = Math.sin(elapsed * 14) * 0.5;

  if (petParts.leashMesh) {
    const start = new THREE.Vector3(0.1, 1.05, 0.72);
    const end = new THREE.Vector3(targetX + 0.25, hop + 0.48, targetZ);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const dist = start.distanceTo(end);
    petParts.leashMesh.position.copy(mid);
    petParts.leashMesh.scale.set(1, dist, 1);
    petParts.leashMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize()
    );
  }
}

const FLOWER_COLORS = [0xff4d8d, 0xfacc15, 0xc084fc, 0x38bdf8, 0xfb7185];

export function buildFlowerMesh(idx: number): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6),
    new THREE.MeshStandardMaterial({ color: 0x22c55e })
  );
  stem.position.y = 0.14;
  const petal = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({ color: FLOWER_COLORS[idx % FLOWER_COLORS.length], roughness: 0.4 })
  );
  petal.position.y = 0.28;
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe600 })
  );
  center.position.y = 0.33;
  g.add(stem, petal, center);
  return g;
}

/**
 * 3D Blazing Fireball / Spirit Flame Orb thrown when cheering ("เติมไฟ")!
 */
export function buildFireOrbProjectileMesh(): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  const midGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.78 })
  );
  const outerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.44, 0.95, 10),
    new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.65 })
  );
  outerFlame.position.y = 0.26;
  g.add(core, midGlow, outerFlame);
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const spark = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.38, 6),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xfacc15 : 0xfb923c })
    );
    spark.position.set(Math.cos(ang) * 0.36, 0.12, Math.sin(ang) * 0.36);
    g.add(spark);
  }
  return g;
}

/**
 * Small 3D Blazing Campfire / Flame Torch placed beside fueled competitors!
 */
export function buildFireEmberPileMesh(idx: number): THREE.Group {
  const g = new THREE.Group();
  const isSuperGold = idx >= 5;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.16, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.8 })
  );
  base.position.y = 0.04;
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.34, 8),
    new THREE.MeshBasicMaterial({
      color: isSuperGold ? 0xfacc15 : 0xf97316,
      transparent: true,
      opacity: 0.88,
    })
  );
  outer.position.y = 0.22;
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.22, 7),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  inner.position.y = 0.19;
  g.add(base, outer, inner);
  return g;
}

export function buildFoodPileMesh(idx: number): THREE.Group {
  const g = new THREE.Group();
  const variant = idx % 3;
  if (variant === 0) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.07, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 })
    );
    box.position.y = 0.035;
    const label = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.08, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    label.position.y = 0.035;
    g.add(box, label);
  } else if (variant === 1) {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.07, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.4 })
    );
    cup.position.y = 0.11;
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6),
      new THREE.MeshStandardMaterial({ color: 0xff4d8d })
    );
    straw.position.y = 0.25;
    g.add(cup, straw);
  } else {
    const cake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 })
    );
    cake.position.y = 0.07;
    const cherry = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    cherry.position.y = 0.16;
    g.add(cake, cherry);
  }
  return g;
}

export function buildDeliveryRider(): THREE.Group {
  const rider = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.24, 0.44),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4 })
  );
  body.position.y = 0.28;
  body.castShadow = true;

  const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b });
  const wFront = new THREE.Mesh(wheelGeo, wheelMat);
  wFront.rotation.x = Math.PI / 2;
  wFront.position.set(0.36, 0.18, 0);
  const wBack = wFront.clone();
  wBack.position.set(-0.36, 0.18, 0);

  const foodBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.38, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xff4d8d, roughness: 0.35 })
  );
  foodBox.position.set(-0.28, 0.58, 0);
  foodBox.castShadow = true;

  const driver = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 })
  );
  driver.position.set(0.18, 0.62, 0);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 })
  );
  helmet.position.set(0.2, 0.94, 0);

  rider.add(body, wFront, wBack, foodBox, driver, helmet);
  return rider;
}

function makeArenaSignTexture(title: string, subtitle: string, bg: string, border: string, textColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = border;
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 492, 172);
    ctx.fillStyle = textColor;
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 256, 74);
    ctx.font = 'bold 30px sans-serif';
    ctx.globalAlpha = 0.88;
    ctx.fillText(subtitle, 256, 132);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds the Full-Body 3D Real-Person Arena Guard ("พี่ยามคุมลู่สายกิน"):
 * - Seamless 3D sculpted human head with custom front-hemisphere UV projection & dynamic skin-tone matching
 * - Organic 3D crew-cut spiky black hair, 3D ears & stocky neck
 * - Full-body outfit from reference photo: crisp white crew-neck t-shirt, silver chain necklace,
 *   red lanyard + chrome security whistle, SECURITY armband, shorts, slides,
 *   holding his plate of roast pork (left hand) & gleaming 4-prong silver fork (right hand)!
 */
export function buildCustomGuardCharacter(faceImageUrl = '/images/guard_face_tex.jpg'): {
  rootGroup: THREE.Group;
  bounceGroup: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  normalEyes: THREE.Group;
  happyFace: THREE.Group;
  angryFace: THREE.Group;
} {
  const rootGroup = new THREE.Group();
  const bounceGroup = new THREE.Group();
  rootGroup.add(bounceGroup);

  // Base warm skin material (dynamically synced to exact border skin tone of face texture once loaded)
  const skinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('rgb(199, 142, 110)'),
    roughness: 0.64,
    metalness: 0.02,
  });

  // Offscreen canvas for guaranteed 100% seamless edge blending on the 3D head sphere
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 512;
  faceCanvas.height = 512;
  const fCtx = faceCanvas.getContext('2d');
  if (fCtx) {
    fCtx.fillStyle = 'rgb(199, 142, 110)';
    fCtx.fillRect(0, 0, 512, 512);
  }
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;

  const headFaceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    roughness: 0.62,
    metalness: 0.02,
  });

  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!fCtx) return;
      fCtx.drawImage(img, 0, 0, 512, 512);
      // Sample border pixels around the padded skin margin to match 3D neck/ears/arms seamlessly
      const sampleCoords: [number, number][] = [
        [14, 256],
        [498, 256],
        [256, 14],
        [14, 140],
        [498, 140],
        [14, 380],
        [498, 380],
      ];
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      sampleCoords.forEach(([sx, sy]) => {
        const d = fCtx.getImageData(sx, sy, 1, 1).data;
        rSum += d[0];
        gSum += d[1];
        bSum += d[2];
      });
      const avgR = Math.round(rSum / sampleCoords.length);
      const avgG = Math.round(gSum / sampleCoords.length);
      const avgB = Math.round(bSum / sampleCoords.length);
      const skinCss = `rgb(${avgR}, ${avgG}, ${avgB})`;

      // Feather outer rim of canvas into pure uniform skinCss so side/back UVs have zero seam
      const radGrad = fCtx.createRadialGradient(256, 256, 198, 256, 256, 254);
      radGrad.addColorStop(0, `rgba(${avgR}, ${avgG}, ${avgB}, 0)`);
      radGrad.addColorStop(0.75, `rgba(${avgR}, ${avgG}, ${avgB}, 0.55)`);
      radGrad.addColorStop(1, `rgba(${avgR}, ${avgG}, ${avgB}, 1)`);
      fCtx.fillStyle = radGrad;
      fCtx.fillRect(0, 0, 512, 512);

      // Guarantee outer 8px frame is 100% solid skinCss
      fCtx.strokeStyle = skinCss;
      fCtx.lineWidth = 16;
      fCtx.strokeRect(0, 0, 512, 512);

      skinMat.color.set(skinCss);
      skinMat.needsUpdate = true;
      faceTex.needsUpdate = true;
    };
    img.src = faceImageUrl;
  }

  // 1. Sculpted 3D Human Head with Custom Front-Hemisphere UV Projection
  const headGeo = new THREE.SphereGeometry(1, 44, 38);
  const hPos = headGeo.getAttribute('position') as THREE.BufferAttribute;
  const hUv = headGeo.getAttribute('uv') as THREE.BufferAttribute;

  for (let i = 0; i < hPos.count; i++) {
    const nx = hPos.getX(i);
    const ny = hPos.getY(i);
    const nz = hPos.getZ(i);

    // Subtle 3D anatomical relief: plump cheeks, 3D nose bridge/tip & full chin
    let rx = nx * 0.54;
    let ry = ny * 0.6;
    let rz = nz * 0.55;

    if (nx > 0.25) {
      // Plump lower cheeks
      const cheekFactor =
        Math.exp(-Math.pow((ny + 0.22) / 0.34, 2)) *
        Math.exp(-Math.pow((Math.abs(nz) - 0.38) / 0.32, 2)) *
        Math.max(0, nx);
      rx += cheekFactor * 0.045;
      rz += Math.sign(nz) * cheekFactor * 0.052;

      // 3D Nose tip & bridge
      const noseFactor =
        Math.exp(-Math.pow((ny + 0.01) / 0.17, 2)) *
        Math.exp(-Math.pow(nz / 0.15, 2)) *
        Math.pow(Math.max(0, nx), 2);
      rx += noseFactor * 0.068;

      // Rounded chin fullness
      const chinFactor =
        Math.exp(-Math.pow((ny + 0.58) / 0.24, 2)) *
        Math.exp(-Math.pow(nz / 0.32, 2)) *
        Math.max(0, nx);
      rx += chinFactor * 0.032;
      ry -= chinFactor * 0.02;
    }

    hPos.setXYZ(i, rx, ry, rz);

    // Seamless front-face UV projection fading into solid skin border at temples/back
    if (nx > 0.05) {
      const uFace = Math.max(0.02, Math.min(0.98, 0.5 - (nz / 0.83) * 0.45));
      const vFace = Math.max(0.02, Math.min(0.98, 0.51 + (ny / 0.72) * 0.46));
      let t = Math.max(0, Math.min(1, (nx - 0.05) / 0.28));
      t = t * t * (3 - 2 * t);
      const u = 0.012 * (1 - t) + uFace * t;
      const v = 0.5 * (1 - t) + vFace * t;
      hUv.setXY(i, u, v);
    } else {
      hUv.setXY(i, 0.012, 0.5);
    }
  }
  headGeo.computeVertexNormals();

  const headGroup = new THREE.Group();
  headGroup.position.set(0.04, 2.12, 0);
  const headMesh = new THREE.Mesh(headGeo, headFaceMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  // 2. Organic 3D Short Spiky Black Crew-Cut Hair (ทรงผมสั้นเกรียนธรรมชาติเหมือนในรูป)
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.92 });
  const hairGeo = new THREE.SphereGeometry(1, 40, 32);
  const hrPos = hairGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < hrPos.count; i++) {
    const nx = hrPos.getX(i);
    const ny = hrPos.getY(i);
    const nz = hrPos.getZ(i);

    // Hairline contour: high above forehead (+X), curving down at temples, around ears, and low at nape (-X)
    let hairlineY = 0.57;
    if (nx > 0.2) {
      hairlineY = 0.57 - Math.pow(Math.abs(nz), 1.8) * 0.34;
    } else if (nx > -0.18) {
      // Sideburns & ear arch
      const earArch = Math.exp(-Math.pow((nx + 0.02) / 0.16, 2)) * 0.16;
      hairlineY = 0.08 + earArch;
    } else {
      hairlineY = -0.56;
    }

    if (ny > hairlineY) {
      const distAbove = Math.min(1, (ny - hairlineY) / 0.25);
      const spikeNoise =
        (Math.sin(nx * 29 + nz * 23) * 0.5 + Math.cos(ny * 31 - nz * 19) * 0.5) * 0.022;
      const swell = 1.0 + distAbove * 0.068 + spikeNoise;
      hrPos.setXYZ(i, nx * 0.54 * swell, ny * 0.6 * (swell + 0.018), nz * 0.55 * swell);
    } else {
      // Tuck cleanly inside the head sphere
      hrPos.setXYZ(i, nx * 0.42, ny * 0.46, nz * 0.42);
    }
  }
  hairGeo.computeVertexNormals();
  const hairCap = new THREE.Mesh(hairGeo, hairMat);
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  // Subtle fuzzy crew-cut micro-tufts along top crown
  for (let t = 0; t < 18; t++) {
    const a = (t / 18) * Math.PI * 2;
    const r = 0.14 + (t % 3) * 0.11;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 5), hairMat);
    const tx = Math.cos(a) * r - 0.04;
    const tz = Math.sin(a) * r;
    tuft.position.set(tx, 0.61 - r * 0.18, tz);
    tuft.rotation.z = -tx * 0.45;
    tuft.rotation.x = tz * 0.45;
    headGroup.add(tuft);
  }

  // 3. 3D Human Ears & Stocky Neck
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), skinMat);
    ear.scale.set(0.55, 1.15, 0.72);
    ear.position.set(-0.02, -0.03, side * 0.54);
    ear.castShadow = true;
    headGroup.add(ear);
  });
  bounceGroup.add(headGroup);

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.36, 16), skinMat);
  neckMesh.position.set(0.02, 1.54, 0);
  bounceGroup.add(neckMesh);

  // 4. Stocky Torso in Crisp White Crew-Neck T-Shirt + Silver Chain Necklace + Security Whistle
  const whiteShirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.68 });
  const collarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72 });
  const silverMetalMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.88,
    roughness: 0.18,
  });

  // Upper chest & shoulders
  const chestMesh = new THREE.Mesh(new THREE.SphereGeometry(0.66, 24, 20), whiteShirtMat);
  chestMesh.scale.set(0.95, 0.92, 1.06);
  chestMesh.position.set(0.02, 1.12, 0);
  chestMesh.castShadow = true;
  chestMesh.receiveShadow = true;

  // Plump white t-shirt belly & hem
  const bellyShirt = new THREE.Mesh(new THREE.SphereGeometry(0.68, 24, 20), whiteShirtMat);
  bellyShirt.scale.set(1.06, 0.88, 1.04);
  bellyShirt.position.set(0.08, 0.88, 0);
  bellyShirt.castShadow = true;

  const shirtHem = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.68, 0.28, 22), whiteShirtMat);
  shirtHem.position.set(0.04, 0.66, 0);
  shirtHem.castShadow = true;

  // Crew-neck ribbed collar ring
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.048, 10, 24), collarMat);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.rotation.y = 0.16;
  collarRing.position.set(0.05, 1.44, 0);

  // Silver chain necklace peeking at the collar (matching uploaded photo!)
  const silverChain = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.02, 8, 24), silverMetalMat);
  silverChain.rotation.x = Math.PI / 2;
  silverChain.rotation.y = 0.22;
  silverChain.position.set(0.06, 1.47, 0);

  // Red Security Lanyard + Chrome Whistle + Gold SECURITY Star Badge on chest
  const lanyardMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55 });
  const lanyardLoop = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.024, 8, 24), lanyardMat);
  lanyardLoop.rotation.y = Math.PI / 2;
  lanyardLoop.rotation.z = -0.58;
  lanyardLoop.position.set(0.36, 1.24, 0);

  const whistleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.14, 12), silverMetalMat);
  whistleBody.rotation.x = Math.PI / 2;
  whistleBody.position.set(0.68, 1.02, 0);

  const goldBadgeMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.72,
    roughness: 0.24,
  });
  const secBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 6), goldBadgeMat);
  secBadge.rotation.z = Math.PI / 2;
  secBadge.position.set(0.61, 1.24, -0.26);

  bounceGroup.add(
    chestMesh,
    bellyShirt,
    shirtHem,
    collarRing,
    silverChain,
    lanyardLoop,
    whistleBody,
    secBadge
  );

  // 5. Left & Right Arms (Short White T-Shirt Sleeves + Plump Forearms + Plate of Pork & Giant Silver Fork!)
  const buildGuardArm = (isRight: boolean) => {
    const armPivot = new THREE.Group();
    const zSign = isRight ? -1 : 1; // Facing +X: character's right arm is at -Z, left arm is at +Z
    armPivot.position.set(0.02, 1.28, zSign * 0.68);

    // White T-shirt short sleeve
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.36, 14), whiteShirtMat);
    sleeve.position.set(0.04, -0.1, zSign * 0.05);
    sleeve.rotation.x = zSign * 0.18;
    sleeve.rotation.z = 0.22;
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    // Red & Gold SECURITY armband on left sleeve
    if (!isRight) {
      const armband = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.12, 14), lanyardMat);
      armband.position.copy(sleeve.position);
      armband.rotation.copy(sleeve.rotation);
      const goldStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.035, 14), goldBadgeMat);
      goldStripe.position.copy(sleeve.position);
      goldStripe.rotation.copy(sleeve.rotation);
      armPivot.add(armband, goldStripe);
    }

    // Bare skin forearm & chubby hand reaching forward
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.32, 8, 12), skinMat);
    forearm.position.set(0.24, -0.34, zSign * 0.08);
    forearm.rotation.z = 0.88;
    forearm.castShadow = true;

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
    hand.position.set(0.44, -0.44, zSign * 0.06);
    armPivot.add(forearm, hand);

    if (isRight) {
      // Gleaming 4-Prong Silver Fork (ส้อมเงินคู่ใจจากในรูปจริง!) held upright/angled ready for action
      const forkGroup = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.075), silverMetalMat);
      handle.position.y = 0.2;
      const headPlate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.24), silverMetalMat);
      headPlate.position.y = 0.62;
      forkGroup.add(handle, headPlate);
      [-0.09, -0.03, 0.03, 0.09].forEach((pz) => {
        const prong = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.28, 6), silverMetalMat);
        prong.position.set(0, 0.82, pz);
        forkGroup.add(prong);
      });
      forkGroup.position.set(0.48, -0.38, zSign * 0.05);
      forkGroup.rotation.z = -0.42;
      forkGroup.rotation.x = 0.15;
      armPivot.add(forkGroup);
    } else {
      // Purple-Blue Stoneware Plate with Golden Roast Pork Cubes (จานหมูกรอบจากในรูปจริง!)
      const plateGroup = new THREE.Group();
      const plateRim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.32, 0.07, 18),
        new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.35 })
      );
      const plateInner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.3, 0.075, 18),
        new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.32 })
      );
      plateGroup.add(plateRim, plateInner);
      const porkMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });
      const porkFatMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
      [
        [0.08, 0.06, -0.06, 0.2],
        [-0.1, 0.06, 0.09, -0.4],
        [0.05, 0.06, 0.14, 0.7],
      ].forEach(([px, py, pz, pr]) => {
        const piece = new THREE.Group();
        const meat = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.12), porkMat);
        const fat = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.12), porkFatMat);
        fat.position.y = 0.045;
        piece.add(meat, fat);
        piece.position.set(px, py, pz);
        piece.rotation.y = pr;
        plateGroup.add(piece);
      });
      plateGroup.position.set(0.58, -0.44, zSign * 0.02);
      armPivot.add(plateGroup);
    }

    return armPivot;
  };

  const armL = buildGuardArm(false);
  const armR = buildGuardArm(true);
  bounceGroup.add(armL, armR);

  // 6. Stocky Legs in Navy Cargo Shorts & Comfy Beach Slides
  const shortsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78 });
  const slideMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });

  const hipsShorts = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.58, 0.26, 20), shortsMat);
  hipsShorts.position.set(0.02, 0.52, 0);
  bounceGroup.add(hipsShorts);

  const buildGuardLeg = (zSign: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(0.02, 0.48, zSign * 0.26);

    const shortLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.21, 0.26, 14), shortsMat);
    shortLeg.position.y = -0.1;
    shortLeg.castShadow = true;

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.26, 12), skinMat);
    calf.position.y = -0.28;
    calf.castShadow = true;

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.24), soleMat);
    foot.position.set(0.07, -0.43, 0);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.25), slideMat);
    strap.position.set(0.08, -0.4, 0);
    const toes = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), skinMat);
    toes.scale.set(1.0, 0.55, 1.05);
    toes.position.set(0.18, -0.4, 0);

    legPivot.add(shortLeg, calf, foot, strap, toes);
    return legPivot;
  };

  const legL = buildGuardLeg(1);
  const legR = buildGuardLeg(-1);
  rootGroup.add(legL, legR);

  // 7. Expression Overlays (Angry Mode = Glowing Red Comic Anger Mark 💢 + Red Siren Glow!)
  const normalEyes = new THREE.Group();
  const happyFace = new THREE.Group();
  happyFace.visible = false;
  const angryFace = new THREE.Group();
  angryFace.visible = false;

  const angerRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const angerMark = new THREE.Group();
  for (let a = 0; a < 4; a++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), angerRedMat);
    const ang = (a / 4) * Math.PI * 2 + Math.PI / 4;
    bar.position.set(0, Math.sin(ang) * 0.12, Math.cos(ang) * 0.12);
    bar.rotation.x = ang;
    angerMark.add(bar);
  }
  angerMark.position.set(0.45, 2.52, -0.38);
  angryFace.add(angerMark);

  const angryAuraRing = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 0.95, 24),
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
  );
  angryAuraRing.rotation.x = -Math.PI / 2;
  angryAuraRing.position.y = 0.06;
  angryFace.add(angryAuraRing);

  bounceGroup.add(normalEyes, happyFace, angryFace);

  // Scale slightly taller & stockier so the Guard stands out heroically by the crosswalk!
  rootGroup.scale.setScalar(1.16);

  return {
    rootGroup,
    bounceGroup,
    legL,
    legR,
    armL,
    armR,
    normalEyes,
    happyFace,
    angryFace,
  };
}

/**
 * Builds the Tropical Beach Island Arena & Start-Line Food Stall Pavilion:
 * - Sparkling turquoise ocean waves, shallow coral lagoon shelf & white seafoam shoreline
 * - Distant tropical coconut islets, coastal lighthouse & bobbing sailboats
 * - Swaying coconut palm trees, striped beach umbrellas, sun loungers, surfboards & lifebuoys
 * - Left Start Food Zone (ซุ้มอาหารสายตบะแตก): wooden boardwalk deck, striped buffet stall, BBQ grill, shabu/pizza/boba spread & cozy lounging mats
 * - Right Godlike Arena Finish: winged golden crystal arch, portal glow, twin winged trophies
 */
export function buildFantasyArenaDecor(
  halfLen: number,
  trackWidth: number,
  finishPt: THREE.Vector3,
  finishTan: THREE.Vector3,
  arenaBounds?: {
    islandCenterX: number;
    islandW: number;
    islandD: number;
    specRows?: number;
  }
): {
  decorGroup: THREE.Group;
  balloons: THREE.Group[];
  floatingIslands: THREE.Group[];
  oceanMesh: THREE.Mesh;
  foamRings: THREE.Mesh[];
  palmCrowns: THREE.Group[];
} {
  const decorGroup = new THREE.Group();
  const balloons: THREE.Group[] = [];
  const floatingIslands: THREE.Group[] = [];
  const foamRings: THREE.Mesh[] = [];
  const palmCrowns: THREE.Group[] = [];

  const islandCenterX = arenaBounds?.islandCenterX ?? -4.0;
  const islandW = arenaBounds?.islandW ?? halfLen * 2 + 36;
  const islandD = arenaBounds?.islandD ?? Math.max(54, trackWidth + 32);
  const specRows = arenaBounds?.specRows ?? 1;

  // 1. Shallow Lagoon Sandbank, White Seafoam Shoreline & Vast Sparkling Ocean
  const wetSandMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.82 });
  const wetSandShelf = new THREE.Mesh(
    new THREE.BoxGeometry(islandW + 3.2, 0.75, islandD + 3.2),
    wetSandMat
  );
  wetSandShelf.position.set(islandCenterX, -0.52, 0);
  wetSandShelf.receiveShadow = true;
  decorGroup.add(wetSandShelf);

  const shallowReefMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.18,
    roughness: 0.25,
  });
  const shallowLagoon = new THREE.Mesh(
    new THREE.BoxGeometry(islandW + 11.5, 0.35, islandD + 11.5),
    shallowReefMat
  );
  shallowLagoon.position.set(islandCenterX, -0.78, 0);
  decorGroup.add(shallowLagoon);

  // Concentric white seafoam rings lapping against the sandy shore
  [2.2, 5.0].forEach((expand, fi) => {
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xf0f9ff,
      transparent: true,
      opacity: fi === 0 ? 0.72 : 0.42,
    });
    const foamPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(islandW + expand * 2, islandD + expand * 2),
      foamMat
    );
    foamPlane.rotation.x = -Math.PI / 2;
    foamPlane.position.set(islandCenterX, -0.34 - fi * 0.03, 0);
    decorGroup.add(foamPlane);
    foamRings.push(foamPlane);
  });

  // Vast animated ocean surface surrounding the grand beach island
  const oceanGeo = new THREE.PlaneGeometry(540, 540, 58, 58);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0369a1,
    emissiveIntensity: 0.22,
    roughness: 0.18,
    metalness: 0.12,
    transparent: true,
    opacity: 0.9,
  });
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(0, -0.42, 0);
  oceanMesh.receiveShadow = true;
  decorGroup.add(oceanMesh);

  // Helper: Build a swaying Tropical Coconut Palm Tree
  const buildPalmTree = (leanX: number, leanZ: number, sc = 1) => {
    const palm = new THREE.Group();
    const trunkDarkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
    const trunkLightMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55, side: THREE.DoubleSide });
    const leafDarkMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.58, side: THREE.DoubleSide });
    const coconutMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.75 });

    let curX = 0;
    let curY = 0;
    let curZ = 0;
    const segs = 6;
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      const rBot = (0.34 - t * 0.13) * sc;
      const rTop = (0.31 - t * 0.13) * sc;
      const segH = 0.78 * sc;
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(rTop, rBot, segH, 8),
        s % 2 === 0 ? trunkLightMat : trunkDarkMat
      );
      curX += leanX * (t + 0.25) * 0.28 * sc;
      curZ += leanZ * (t + 0.25) * 0.28 * sc;
      seg.position.set(curX, curY + segH / 2, curZ);
      seg.rotation.z = -leanX * (0.08 + t * 0.14);
      seg.rotation.x = leanZ * (0.08 + t * 0.14);
      seg.castShadow = true;
      palm.add(seg);
      curY += segH * 0.94;
    }

    const crown = new THREE.Group();
    crown.position.set(curX, curY + 0.08 * sc, curZ);

    // Coconuts cluster under fronds
    for (let c = 0; c < 3; c++) {
      const ca = (c / 3) * Math.PI * 2;
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.18 * sc, 8, 8), coconutMat);
      nut.position.set(Math.cos(ca) * 0.22 * sc, -0.1 * sc, Math.sin(ca) * 0.22 * sc);
      crown.add(nut);
    }

    // 7 arched palm fronds fanning out
    const frondCount = 7;
    for (let f = 0; f < frondCount; f++) {
      const fa = (f / frondCount) * Math.PI * 2;
      const frondPivot = new THREE.Group();
      frondPivot.rotation.y = fa;
      const mat = f % 2 === 0 ? leafMat : leafDarkMat;
      const blade1 = new THREE.Mesh(new THREE.BoxGeometry(1.35 * sc, 0.06 * sc, 0.46 * sc), mat);
      blade1.position.set(0.68 * sc, 0.12 * sc, 0);
      blade1.rotation.z = 0.22;
      const blade2 = new THREE.Mesh(new THREE.BoxGeometry(1.15 * sc, 0.05 * sc, 0.34 * sc), mat);
      blade2.position.set(1.78 * sc, -0.12 * sc, 0);
      blade2.rotation.z = -0.38;
      blade1.castShadow = true;
      blade2.castShadow = true;
      frondPivot.add(blade1, blade2);
      crown.add(frondPivot);
    }

    palm.add(crown);
    palmCrowns.push(crown);
    return palm;
  };

  // 2A. Distant Tropical Lighthouse Atoll & Coconut Islet on the Ocean Horizon
  {
    const lhIsland = new THREE.Group();
    const sandMound = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 7.2, 1.4, 14),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 })
    );
    sandMound.position.y = 0.35;
    lhIsland.add(sandMound);

    const lhWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
    const lhRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
    for (let b = 0; b < 4; b++) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05 - b * 0.12, 1.18 - b * 0.12, 1.45, 12),
        b % 2 === 0 ? lhWhiteMat : lhRedMat
      );
      band.position.set(-1.2, 1.4 + b * 1.42, 0);
      lhIsland.add(band);
    }
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.9, 10),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    lantern.position.set(-1.2, 7.2, 0);
    const lhRoof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.1, 10), lhRedMat);
    lhRoof.position.set(-1.2, 8.15, 0);
    lhIsland.add(lantern, lhRoof);

    const miniPalm = buildPalmTree(0.45, 0.2, 0.95);
    miniPalm.position.set(2.2, 0.85, 1.1);
    lhIsland.add(miniPalm);

    const seaBackZ = -(islandD / 2 + 19);
    lhIsland.position.set(islandCenterX - islandW / 2 - 12, -0.4, seaBackZ);
    decorGroup.add(lhIsland);
  }

  {
    const coralAtoll = new THREE.Group();
    const atollSand = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 6.4, 1.2, 14),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 })
    );
    atollSand.position.y = 0.25;
    coralAtoll.add(atollSand);
    const p1 = buildPalmTree(-0.4, 0.25, 0.92);
    p1.position.set(-1.4, 0.75, 0.4);
    const p2 = buildPalmTree(0.5, -0.2, 0.82);
    p2.position.set(1.6, 0.75, -0.6);
    coralAtoll.add(p1, p2);
    coralAtoll.position.set(islandCenterX + islandW / 2 + 12, -0.4, -(islandD / 2 + 17));
    decorGroup.add(coralAtoll);
  }

  // 2B. Cute Bobbing Sailboats on the Sea (animated via floatingIslands)
  const seaSideZ = islandD / 2 + 14;
  const sailboatSpecs: [number, number, number, number, number][] = [
    [islandCenterX - islandW / 2 - 14, -0.35, islandD * 0.28, 0xf97316, 0.4],
    [islandCenterX + islandW / 2 + 14, -0.35, islandD * 0.3, 0xf43f5e, -0.55],
    [6, -0.35, -seaSideZ - 4, 0xfacc15, 0.15],
  ];
  sailboatSpecs.forEach(([sx, sy, sz, sailAccent, rotY]) => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 0.95, 0.85, 8),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.75 })
    );
    hull.scale.set(1.9, 1, 0.85);
    hull.position.y = 0.35;
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.45, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 })
    );
    deck.scale.set(1.85, 1, 0.8);
    deck.position.y = 0.78;
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 4.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
    );
    mast.position.set(0.15, 2.9, 0);
    const mainSail = new THREE.Mesh(
      new THREE.ConeGeometry(1.45, 3.4, 3),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
    );
    mainSail.scale.set(1.1, 1, 0.18);
    mainSail.position.set(-0.45, 3.0, 0);
    const jibSail = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 2.6, 3),
      new THREE.MeshStandardMaterial({ color: sailAccent, roughness: 0.45 })
    );
    jibSail.scale.set(1.0, 1, 0.18);
    jibSail.position.set(0.95, 2.65, 0);
    boat.add(hull, deck, mast, mainSail, jibSail);
    boat.position.set(sx, sy, sz);
    boat.rotation.y = rotY;
    decorGroup.add(boat);
    floatingIslands.push(boat);
  });

  // 3. Sunny Beach Hot Air Balloons
  const balloonZ = islandD / 2 + 8;
  const balloonSpecs: [number, number, number, number][] = [
    [-halfLen * 0.85, 21, -balloonZ, 0xf97316],
    [halfLen * 0.65, 23, -balloonZ - 4, 0x38bdf8],
    [-halfLen * 0.35, 25, balloonZ, 0xf43f5e],
  ];
  balloonSpecs.forEach(([bx, by, bz, col]) => {
    const bGroup = new THREE.Group();
    const balloon = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 16, 16),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })
    );
    balloon.scale.set(1, 1.22, 1);
    const stripe = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.2, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
    );
    stripe.rotation.x = Math.PI / 2;
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.7, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 })
    );
    basket.position.y = -3.1;
    bGroup.add(balloon, stripe, basket);
    bGroup.position.set(bx, by, bz);
    decorGroup.add(bGroup);
    balloons.push(bGroup);
  });

  // 4. Palm Trees framing the Golden Beach Perimeter
  const edgeZ = islandD / 2 - 3.0;
  const leftEdgeX = islandCenterX - islandW / 2 + 3.2;
  const rightEdgeX = islandCenterX + islandW / 2 - 3.2;
  const palmPlacements: [number, number, number, number, number][] = [
    [leftEdgeX, -edgeZ + 0.8, 0.55, 0.35, 1.12],
    [leftEdgeX, edgeZ - 0.8, 0.55, -0.35, 1.08],
    [-halfLen * 0.55, -edgeZ, 0.2, 0.5, 1.15],
    [0, -edgeZ, 0.05, 0.48, 1.08],
    [halfLen * 0.52, -edgeZ, -0.25, 0.48, 1.1],
    [rightEdgeX, -edgeZ + 0.8, -0.45, 0.35, 1.12],
    [rightEdgeX, edgeZ - 0.8, -0.45, -0.35, 1.06],
    [-halfLen * 0.58, edgeZ, 0.25, -0.45, 1.0],
    [0, edgeZ, -0.05, -0.46, 1.04],
    [halfLen * 0.5, edgeZ, -0.25, -0.45, 1.0],
  ];
  palmPlacements.forEach(([px, pz, lx, lz, sc]) => {
    const palm = buildPalmTree(lx, lz, sc);
    palm.position.set(px, 0, pz);
    decorGroup.add(palm);
  });

  // 5. Left Side: ซุ้มอาหารจุดเริ่มต้น (Grand Beach Food Stall & Food-Coma Lounge Zone)
  const foodZoneGroup = new THREE.Group();
  const oldWoodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const warmDeckMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.78 });
  const deckTrimMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.82 });

  // Extra-spacious wooden boardwalk patio behind the starting line (supports many players!)
  const foodDeckW = 14.8;
  const foodDeckD = trackWidth + 11.5;
  const foodDeckX = -halfLen - 8.5;
  const foodDeck = new THREE.Mesh(new THREE.BoxGeometry(foodDeckW, 0.1, foodDeckD), warmDeckMat);
  foodDeck.position.set(foodDeckX, 0.04, 0);
  foodDeck.receiveShadow = true;
  foodZoneGroup.add(foodDeck);

  // Decorative wooden boardwalk planks
  for (let p = -6; p <= 6; p++) {
    const groove = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.11, foodDeckD - 0.3),
      deckTrimMat
    );
    groove.position.set(foodDeckX + p * 1.12, 0.045, 0);
    foodZoneGroup.add(groove);
  }

  // Cozy lounging beach mats & cushions on the Food Zone deck (for regressed competitors!)
  const matColors = [0xf43f5e, 0x38bdf8, 0xfacc15, 0xa855f7, 0x10b981, 0xf97316];
  const matPositions: [number, number, number][] = [
    [-halfLen - 4.2, -trackWidth * 0.32, 0.08],
    [-halfLen - 4.2, 0, -0.04],
    [-halfLen - 4.2, trackWidth * 0.32, -0.1],
    [-halfLen - 7.4, -trackWidth * 0.24, -0.06],
    [-halfLen - 7.4, trackWidth * 0.24, 0.12],
    [-halfLen - 10.4, 0, 0.05],
  ];
  matPositions.forEach(([mx, mz, mrot], mi) => {
    const loungeMat = new THREE.Group();
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.04, 1.65),
      new THREE.MeshStandardMaterial({ color: matColors[mi % matColors.length], roughness: 0.82 })
    );
    const innerRug = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.045, 1.25),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.85 })
    );
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18, 0.85),
      new THREE.MeshStandardMaterial({ color: matColors[(mi + 1) % matColors.length], roughness: 0.65 })
    );
    pillow.position.set(-0.68, 0.11, 0);
    loungeMat.add(rug, innerRug, pillow);
    loungeMat.position.set(mx, 0.09, mz);
    loungeMat.rotation.y = mrot;
    foodZoneGroup.add(loungeMat);
  });

  // Main Festive Beach Buffet Stall (ซุ้มอาหารหลัก) at the back of the Food Deck
  const mainStall = new THREE.Group();
  const counterMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 });
  const redAwningMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55 });

  const counterBase = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.15, 6.2), counterMat);
  counterBase.position.y = 0.58;
  counterBase.castShadow = true;
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.14, 6.5), creamMat);
  counterTop.position.y = 1.2;
  mainStall.add(counterBase, counterTop);

  // 4 Bamboo/Wood Support Posts
  [-0.65, 0.65].forEach((px) => {
    [-2.85, 2.85].forEach((pz) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.3, 8), oldWoodMat);
      post.position.set(px, 1.65, pz);
      post.castShadow = true;
      mainStall.add(post);
    });
  });

  // Red & Cream Striped Market Awning Roof
  const stripeSegments = 8;
  const segDepth = 6.8 / stripeSegments;
  for (let s = 0; s < stripeSegments; s++) {
    const zOff = -3.4 + (s + 0.5) * segDepth;
    const sMat = s % 2 === 0 ? redAwningMat : creamMat;
    const slopeFront = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, segDepth + 0.02), sMat);
    slopeFront.position.set(0.62, 3.25, zOff);
    slopeFront.rotation.z = -0.34;
    const slopeBack = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, segDepth + 0.02), sMat);
    slopeBack.position.set(-0.55, 3.28, zOff);
    slopeBack.rotation.z = 0.32;
    const valance = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, segDepth + 0.01), sMat);
    valance.position.set(1.32, 2.92, zOff);
    mainStall.add(slopeFront, slopeBack, valance);
  }

  // Delicious 3D Buffet Spread on the Countertop: Shabu Pot, Pizza Boxes, Boba Cups & Burger Platter
  // 1) Steaming Shabu Hotpot
  const shabuPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.34, 0.28, 14),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.3 })
  );
  shabuPot.position.set(0.1, 1.41, -1.85);
  const shabuSoup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.05, 14),
    new THREE.MeshBasicMaterial({ color: 0xf97316 })
  );
  shabuSoup.position.set(0.1, 1.54, -1.85);
  mainStall.add(shabuPot, shabuSoup);

  // 2) Cheesy Pizza Platter & Stacked Boxes
  const pizzaBox1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.1, 0.85),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.7 })
  );
  pizzaBox1.position.set(0.05, 1.32, -0.35);
  const pizzaPie = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.07, 14),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 })
  );
  pizzaPie.position.set(0.15, 1.31, 0.65);
  mainStall.add(pizzaBox1, pizzaPie);

  // 3) Row of Boba Milk Tea & Fruit Smoothie Cups
  [1.65, 2.05, 2.45].forEach((cz, ci) => {
    const cupColors = [0xfde68a, 0xf472b6, 0x4ade80];
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.1, 0.36, 10),
      new THREE.MeshStandardMaterial({ color: cupColors[ci], roughness: 0.3 })
    );
    cup.position.set(0.18, 1.45, cz);
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.24, 6),
      new THREE.MeshStandardMaterial({ color: 0x18181b })
    );
    straw.position.set(0.18, 1.68, cz);
    straw.rotation.z = -0.2;
    mainStall.add(cup, straw);
  });

  // Big Overhead Signboard angled slightly toward overview camera: "ซุ้มอาหารสายตบะแตก"
  const foodSignTex = makeArenaSignTexture(
    '🍖 ซุ้มอาหารสายตบะแตก',
    'Food Coma Zone',
    '#b91c1c',
    '#facc15',
    '#fef08a'
  );
  const foodSignBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 1.2, 4.8),
    new THREE.MeshStandardMaterial({ map: foodSignTex, roughness: 0.45 })
  );
  foodSignBoard.position.set(0.25, 4.2, 0);
  foodSignBoard.rotation.y = -0.38;
  mainStall.add(foodSignBoard);

  mainStall.position.set(-halfLen - 14.2, 0.08, 0);
  foodZoneGroup.add(mainStall);

  // Side Sizzling Beach BBQ Grill right next to the Food Stall
  const bbqGroup = new THREE.Group();
  const grillMetalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.25 });
  const grillBox = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.8, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.5, roughness: 0.4 })
  );
  grillBox.position.y = 1.2;
  const coals = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.15, 1.15),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.65 })
  );
  coals.position.y = 1.62;
  [-0.6, 0, 0.6].forEach((mx) => {
    const steak = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 })
    );
    steak.position.set(mx, 1.72, 0);
    bbqGroup.add(steak);
  });
  [
    [-1.0, -0.55],
    [1.0, -0.55],
    [-1.0, 0.55],
    [1.0, 0.55],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), grillMetalMat);
    leg.position.set(lx, 0.6, lz);
    bbqGroup.add(leg);
  });
  bbqGroup.add(grillBox, coals);
  bbqGroup.position.set(-halfLen - 8.5, 0.08, -trackWidth / 2 - 3.6);
  bbqGroup.rotation.y = 0.28;
  foodZoneGroup.add(bbqGroup);

  // Festive Warm Fairy String Lights framing the Food Zone
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  [-1, 1].forEach((zSide) => {
    const zPos = zSide * (trackWidth / 2 + 5.0);
    const poleFront = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 7), oldWoodMat);
    poleFront.position.set(-halfLen - 2.0, 1.7, zPos);
    const poleBack = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 7), oldWoodMat);
    poleBack.position.set(-halfLen - 13.6, 1.7, zPos);
    foodZoneGroup.add(poleFront, poleBack);

    for (let b = 0; b <= 8; b++) {
      const bt = b / 8;
      const bx = -halfLen - 2.0 - bt * 11.6;
      const sag = Math.sin(bt * Math.PI) * 0.45;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), bulbMat);
      bulb.position.set(bx, 3.25 - sag, zPos);
      foodZoneGroup.add(bulb);
    }
  });

  // Beach Start Line Signpost: "จุดสตาร์ท (Start Line)"
  const signPost = new THREE.Group();
  const sPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), oldWoodMat);
  sPost.position.y = 1.1;
  const signTex = makeArenaSignTexture('จุดสตาร์ท', 'Start Line', '#0284c7', '#facc15', '#ffffff');
  const sBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.95, 2.3),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.55 })
  );
  sBoard.position.y = 1.95;
  signPost.add(sPost, sBoard);
  signPost.position.set(-halfLen - 1.4, 0.05, trackWidth / 2 + 2.2);
  signPost.rotation.y = -0.45;
  foodZoneGroup.add(signPost);

  decorGroup.add(foodZoneGroup);

  // 6. Beachside Cheer & Lounge Props: Striped Beach Umbrellas, Sun Loungers, Surfboards, Lifebuoys & Starfish
  const umbrellaPalettes: [number, number][] = [
    [0x0ea5e9, 0xffffff],
    [0xf43f5e, 0xfffbeb],
    [0xf97316, 0xfef08a],
    [0x10b981, 0xf0fdf4],
  ];
  const beachOuterZ = trackWidth / 2 + 8.5 + Math.max(0, specRows - 1) * 3.4;

  [-1, 1].forEach((zSign, sideIdx) => {
    [-halfLen * 0.65, -halfLen * 0.2, halfLen * 0.25, halfLen * 0.68].forEach((ux, uIdx) => {
      const umbSet = new THREE.Group();
      const [colA, colB] = umbrellaPalettes[(uIdx + sideIdx) % umbrellaPalettes.length];

      // Tilted Striped Beach Umbrella
      const umbGroup = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.07, 3.1, 8),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
      );
      pole.position.y = 1.55;
      umbGroup.add(pole);

      const wedges = 8;
      for (let w = 0; w < wedges; w++) {
        const wa = (w / wedges) * Math.PI * 2;
        const wedge = new THREE.Mesh(
          new THREE.ConeGeometry(1.85, 0.82, 3, 1, false, wa, (Math.PI * 2) / wedges + 0.04),
          new THREE.MeshStandardMaterial({
            color: w % 2 === 0 ? colA : colB,
            roughness: 0.5,
            side: THREE.DoubleSide,
          })
        );
        wedge.position.y = 2.95;
        wedge.castShadow = true;
        umbGroup.add(wedge);
      }
      umbGroup.rotation.z = 0.12 * (uIdx % 2 === 0 ? 1 : -1);
      umbGroup.rotation.x = -zSign * 0.1;
      umbSet.add(umbGroup);

      // Pair of Sun Loungers (เตียงผ้าใบชายหาด) flanking the umbrella
      [-1.35, 1.35].forEach((cx) => {
        const chair = new THREE.Group();
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.22, 1.85),
          new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 })
        );
        frame.position.y = 0.22;
        frame.castShadow = true;
        const towel = new THREE.Mesh(
          new THREE.BoxGeometry(0.82, 0.06, 1.65),
          new THREE.MeshStandardMaterial({ color: colA, roughness: 0.7 })
        );
        towel.position.y = 0.35;
        const backrest = new THREE.Mesh(
          new THREE.BoxGeometry(0.86, 0.08, 0.68),
          new THREE.MeshStandardMaterial({ color: colB, roughness: 0.65 })
        );
        backrest.position.set(0, 0.55, -zSign * 0.68);
        backrest.rotation.x = zSign * 0.52;
        chair.add(frame, towel, backrest);
        chair.position.set(cx, 0, 0);
        umbSet.add(chair);
      });

      umbSet.position.set(ux, 0, zSign * beachOuterZ);
      decorGroup.add(umbSet);
    });

    // Surfboards planted in the sand & Red-White Lifebuoy Rings
    const surfColors = [0x06b6d4, 0xf43f5e];
    const surfboard = new THREE.Group();
    const boardMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.36, 1.85, 8, 14),
      new THREE.MeshStandardMaterial({ color: surfColors[sideIdx % 2], roughness: 0.25 })
    );
    boardMesh.scale.set(1, 1, 0.22);
    boardMesh.position.y = 1.15;
    boardMesh.castShadow = true;
    const boardStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.35, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 })
    );
    boardStripe.position.y = 1.15;
    surfboard.add(boardMesh, boardStripe);
    surfboard.position.set(sideIdx === 0 ? halfLen * 0.22 : -halfLen * 0.22, 0, zSign * (beachOuterZ + 2.4));
    surfboard.rotation.z = sideIdx === 0 ? -0.18 : 0.18;
    surfboard.rotation.y = sideIdx === 0 ? 0.35 : -0.35;
    decorGroup.add(surfboard);

    const lifebuoy = new THREE.Group();
    const torusWhite = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.18, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
    );
    torusWhite.rotation.x = Math.PI / 2;
    for (let rb = 0; rb < 4; rb++) {
      const ra = (rb / 4) * Math.PI * 2;
      const redBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, 0.28, 10),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })
      );
      redBand.position.set(Math.cos(ra) * 0.55, 0, Math.sin(ra) * 0.55);
      redBand.rotation.y = -ra;
      redBand.rotation.x = Math.PI / 2;
      lifebuoy.add(redBand);
    }
    lifebuoy.add(torusWhite);
    lifebuoy.position.set(sideIdx === 0 ? -halfLen * 0.25 : halfLen * 0.25, 0.18, zSign * (beachOuterZ - 2.1));
    decorGroup.add(lifebuoy);

    // Cute Coral Starfish on the sand
    const starGroup = new THREE.Group();
    const starMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.65 });
    for (let arm = 0; arm < 5; arm++) {
      const sa = (arm / 5) * Math.PI * 2;
      const ray = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.48, 6), starMat);
      ray.rotation.z = -Math.PI / 2;
      ray.rotation.y = sa;
      ray.position.set(Math.cos(sa) * 0.18, 0.06, -Math.sin(sa) * 0.18);
      starGroup.add(ray);
    }
    starGroup.position.set(sideIdx === 0 ? halfLen * 0.72 : -halfLen * 0.72, 0.02, zSign * (beachOuterZ + 1.5));
    decorGroup.add(starGroup);
  });

  // 7. Right Side: Winged Golden Crystal Finish Arch + Portal Glow + Twin Winged Trophies (เส้นชัยมหาเทพริมหาด)
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.72 });
  const archGroup = new THREE.Group();
  const goldArchMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.78,
    roughness: 0.2,
    emissive: 0xb45309,
    emissiveIntensity: 0.25,
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.9,
    roughness: 0.1,
  });
  const wingWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef08a,
    emissiveIntensity: 0.2,
    roughness: 0.25,
  });

  const pillarSpan = trackWidth / 2 + 0.9;
  [-pillarSpan, pillarSpan].forEach((pz) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.3), stoneMat);
    base.position.set(0, 0.45, pz);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 5.5, 14), goldArchMat);
    col.position.set(0, 3.2, pz);
    col.castShadow = true;
    const pillarCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), crystalMat);
    pillarCrystal.scale.set(0.65, 1.5, 0.65);
    pillarCrystal.position.set(0, 3.3, pz);
    archGroup.add(base, col, pillarCrystal);
  });

  const topBeam = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 1.0, pillarSpan * 2 + 1.6),
    goldArchMat
  );
  topBeam.position.set(0, 6.0, 0);
  archGroup.add(topBeam);

  // Center glowing cyan crystal crest
  const archCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), crystalMat);
  archCrest.scale.set(0.7, 1.25, 0.85);
  archCrest.position.set(0, 6.65, 0);
  archGroup.add(archCrest);

  // Layered white & gold angel wings fanning out from the finish arch
  [-1, 1].forEach((side) => {
    for (let w = 0; w < 5; w++) {
      const feather = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 3.0 - w * 0.32, 10),
        w % 2 === 0 ? wingWhiteMat : goldArchMat
      );
      feather.position.set(0, 5.6 + w * 0.35, side * (pillarSpan * 0.68 + w * 0.62));
      feather.rotation.x = side * (0.55 + w * 0.14);
      archGroup.add(feather);
    }
  });

  // Overhead signboard: "เส้นชัย (Finish Line)"
  const finishSignTex = makeArenaSignTexture('เส้นชัย', 'Finish Line', '#334155', '#facc15', '#fef08a');
  const finishSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 1.3, 4.6),
    new THREE.MeshStandardMaterial({ map: finishSignTex, roughness: 0.45 })
  );
  finishSign.position.set(0, 7.85, 0);
  archGroup.add(finishSign);

  // Golden Portal Floor Glow under the arch
  const portalGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.8, trackWidth * 0.42, 32),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  portalGlow.rotation.x = -Math.PI / 2;
  portalGlow.position.set(0, 0.22, 0);
  archGroup.add(portalGlow);

  // Twin Giant Winged Golden Trophies flanking the finish arch
  [-1, 1].forEach((side) => {
    const tGroup = new THREE.Group();
    const tPedestal = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), stoneMat);
    tPedestal.position.y = 0.55;
    const cupStem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 0.7, 12), goldArchMat);
    cupStem.position.y = 1.45;
    const cupBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 1.1, 16), goldArchMat);
    cupBowl.position.y = 2.25;
    [-1, 1].forEach((ws) => {
      const tw = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.5, 8), wingWhiteMat);
      tw.position.set(0, 2.35, ws * 0.85);
      tw.rotation.x = ws * 0.65;
      tGroup.add(tw);
    });
    tGroup.add(tPedestal, cupStem, cupBowl);
    tGroup.position.set(-0.6, 0, side * (pillarSpan + 1.85));
    archGroup.add(tGroup);
  });

  archGroup.position.set(finishPt.x, 0, finishPt.z);
  archGroup.rotation.y = Math.atan2(-finishTan.z, finishTan.x);
  decorGroup.add(archGroup);

  // 8. Muscle-Beach Giant Golden Dumbbell Prop near Finish Side
  const propDumbbellGroup = new THREE.Group();
  const barMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 3.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.25 })
  );
  barMesh.rotation.z = Math.PI / 2;
  [-1.35, -1.05, 1.05, 1.35].forEach((px) => {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 0.24, 18),
      goldArchMat
    );
    plate.rotation.z = Math.PI / 2;
    plate.position.x = px;
    plate.castShadow = true;
    propDumbbellGroup.add(plate);
  });
  propDumbbellGroup.add(barMesh);
  propDumbbellGroup.position.set(halfLen - 2.2, 0.95, trackWidth / 2 + 5.2);
  propDumbbellGroup.rotation.y = -0.42;
  decorGroup.add(propDumbbellGroup);

  return { decorGroup, balloons, floatingIslands, oceanMesh, foamRings, palmCrowns };
}

export interface TrackMarkerParts {
  group: THREE.Group;
  markerId: string;
  spinner?: THREE.Object3D;
  waver?: THREE.Object3D;
  runeRing?: THREE.Object3D;
}

/**
 * Builds an upgradable 3D Place-Marker Signpost planted on a competitor's lane
 * when they step out of the track to roam around the beach!
 */
export function buildTrackMarkerMesh(
  markerId = 'marker_wood',
  playerColorHex = '#FACC15'
): TrackMarkerParts {
  const group = new THREE.Group();
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const woodLight = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.72,
    roughness: 0.22,
    emissive: 0xb45309,
    emissiveIntensity: 0.2,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(playerColorHex || '#FACC15'),
    roughness: 0.45,
  });

  if (markerId === 'marker_flag') {
    // 🚩 Lv.1 Knight Banner Flag
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 })
    );
    base.position.y = 0.11;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.55, 8), goldMat);
    pole.position.y = 1.35;
    pole.castShadow = true;
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), goldMat);
    finial.position.y = 2.72;

    const flagPivot = new THREE.Group();
    flagPivot.position.set(0, 2.15, 0);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 1.25), accentMat);
    cloth.position.set(0, 0, 0.65);
    cloth.castShadow = true;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 1.28), goldMat);
    trim.position.set(0, 0.42, 0.65);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.09, 6), goldMat);
    crest.rotation.z = Math.PI / 2;
    crest.position.set(0, 0, 0.62);
    flagPivot.add(cloth, trim, crest);

    group.add(base, pole, finial, flagPivot);
    return { group, markerId, waver: flagPivot };
  }

  if (markerId === 'marker_scarecrow') {
    // 🎃 Lv.2 Cute Dummy Scarecrow with Headband
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.9, 8), woodDark);
    post.position.y = 0.95;
    const armsBar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.45, 8), woodDark);
    armsBar.rotation.x = Math.PI / 2;
    armsBar.position.y = 1.28;

    const bodyGroup = new THREE.Group();
    bodyGroup.position.y = 1.25;
    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.78, 10), accentMat);
    shirt.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.75 })
    );
    head.position.y = 0.72;
    head.castShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.065, 8, 20), goldMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.88;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
    [-0.14, 0.14].forEach((ez) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
      eye.position.set(0.37, 0.74, ez);
      bodyGroup.add(eye);
    });
    bodyGroup.add(shirt, head, band);
    group.add(post, armsBar, bodyGroup);
    return { group, markerId, waver: bodyGroup };
  }

  if (markerId === 'marker_crystal') {
    // 💎 Lv.3 Floating Magic Crystal Pedestal + Glowing Rune Circle
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.68, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45 })
    );
    ped.position.y = 0.28;
    const pedGold = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.05, 8, 20), goldMat);
    pedGold.rotation.x = Math.PI / 2;
    pedGold.position.y = 0.56;

    const runeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.08, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
      })
    );
    runeRing.rotation.x = -Math.PI / 2;
    runeRing.position.y = 0.04;

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.56, 0),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.85,
        roughness: 0.12,
      })
    );
    crystal.scale.set(0.72, 1.55, 0.72);
    crystal.position.y = 1.65;
    crystal.castShadow = true;

    group.add(ped, pedGold, runeRing, crystal);
    return { group, markerId, spinner: crystal, runeRing };
  }

  if (markerId === 'marker_monument') {
    // 🏆 Lv.4 Winged Golden Trophy Monument + Star Halo
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28 });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 0.25,
      roughness: 0.22,
    });
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.88, 0.35, 12), marbleMat);
    base1.position.y = 0.18;
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.62, 0.55, 12), marbleMat);
    base2.position.y = 0.62;
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 24), goldMat);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.36;

    const runeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.25, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      })
    );
    runeRing.rotation.x = -Math.PI / 2;
    runeRing.position.y = 0.04;

    const trophyGroup = new THREE.Group();
    trophyGroup.position.y = 1.65;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 0.48, 12), goldMat);
    stem.position.y = -0.35;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.24, 0.78, 16), goldMat);
    cup.position.y = 0.18;
    cup.castShadow = true;
    [-1, 1].forEach((side) => {
      for (let w = 0; w < 3; w++) {
        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.95 - w * 0.16, 8), wingMat);
        feather.position.set(0, 0.22 + w * 0.12, side * (0.55 + w * 0.22));
        feather.rotation.x = side * (0.65 + w * 0.15);
        trophyGroup.add(feather);
      }
    });
    trophyGroup.add(stem, cup);

    group.add(base1, base2, trim, runeRing, trophyGroup);
    return { group, markerId, spinner: trophyGroup, runeRing };
  }

  if (markerId === 'marker_cone') {
    // 🚧 Traffic Cone Marker
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.14, 0.95),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 })
    );
    base.position.y = 0.07;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 1.45, 14),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 })
    );
    cone.position.y = 0.85;
    cone.castShadow = true;
    const stripe1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.26, 0.22, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25 })
    );
    stripe1.position.y = 0.95;
    const stripe2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.29, 0.34, 0.18, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25 })
    );
    stripe2.position.y = 0.55;
    group.add(base, cone, stripe1, stripe2);
    return { group, markerId };
  }

  if (markerId === 'marker_shrine') {
    // ⛩️ Red Torii Shrine Gate
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    [-0.58, 0.58].forEach((pz) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.0, 10), redMat);
      col.position.set(0, 1.0, pz);
      col.castShadow = true;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.26, 10), darkMat);
      foot.position.set(0, 0.13, pz);
      group.add(col, foot);
    });
    const beamLow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 1.55), redMat);
    beamLow.position.y = 1.62;
    const beamTop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 1.95), redMat);
    beamTop.position.y = 2.02;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 2.08), darkMat);
    roof.position.y = 2.16;
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.24), goldMat);
    plaque.position.y = 1.82;
    group.add(beamLow, beamTop, roof, plaque);
    return { group, markerId };
  }

  if (markerId === 'marker_cat_statue') {
    // 🐱 Golden Lucky Beckoning Cat (Maneki-neko)
    const cushion = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.2, 1.05),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
    );
    cushion.position.y = 0.1;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), goldMat);
    body.scale.set(1, 1.15, 0.95);
    body.position.y = 0.72;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), goldMat);
    head.position.y = 1.42;
    [-0.22, 0.22].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 8), goldMat);
      ear.position.set(0, 1.76, ez);
      group.add(ear);
    });
    const pawPivot = new THREE.Group();
    pawPivot.position.set(0.18, 1.1, 0.34);
    const paw = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.24, 6, 8), goldMat);
    paw.position.y = 0.18;
    pawPivot.add(paw);
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.85, roughness: 0.15 })
    );
    coin.rotation.z = Math.PI / 2;
    coin.position.set(0.45, 0.78, 0);
    group.add(cushion, body, head, pawPivot, coin);
    return { group, markerId, waver: pawPivot };
  }

  if (markerId === 'marker_bubble_tea') {
    // 🧋 Giant Bubble Tea Cup
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.36, 1.45, 16),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.35 })
    );
    cup.position.y = 0.74;
    cup.castShadow = true;
    const tea = new THREE.Mesh(
      new THREE.CylinderGeometry(0.47, 0.34, 1.12, 16),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 })
    );
    tea.position.y = 0.65;
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 })
    );
    lid.position.y = 1.45;
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 1.1, 10),
      new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.3 })
    );
    straw.position.set(0.08, 1.92, 0);
    straw.rotation.z = -0.15;
    const pearlMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), pearlMat);
      p.position.set(Math.cos(a) * 0.25, 0.2, Math.sin(a) * 0.25);
      group.add(p);
    }
    group.add(cup, tea, lid, straw);
    return { group, markerId };
  }

  if (markerId === 'marker_rocket') {
    // 🚀 Space Rocket Launchpad
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.82, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 })
    );
    pad.position.y = 0.09;
    const rocketGroup = new THREE.Group();
    rocketGroup.position.y = 1.35;
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 1.35, 14),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.35, roughness: 0.3 })
    );
    hull.castShadow = true;
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.55, 14),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 })
    );
    nose.position.y = 0.95;
    const windowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.5 })
    );
    windowMesh.position.set(0.28, 0.2, 0);
    const finMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
    [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach((a) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.34), finMat);
      fin.position.set(Math.cos(a) * 0.38, -0.45, Math.sin(a) * 0.38);
      fin.rotation.y = -a;
      rocketGroup.add(fin);
    });
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.55, 10),
      new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xfacc15, emissiveIntensity: 0.85 })
    );
    flame.rotation.x = Math.PI;
    flame.position.y = -0.92;
    rocketGroup.add(hull, nose, windowMesh, flame);
    group.add(pad, rocketGroup);
    return { group, markerId, spinner: rocketGroup };
  }

  if (markerId && markerId !== 'marker_wood') {
    const extraRes = buildExtraMarker3D(markerId, group);
    if (extraRes) {
      return { group, markerId, ...extraRes };
    }
  }

  // 🪵 Lv.0 Default Rustic Wooden Signpost
  const dirtMound = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 })
  );
  dirtMound.scale.set(1, 0.35, 1);
  dirtMound.position.y = 0.06;

  const signPivot = new THREE.Group();
  signPivot.rotation.z = 0.09;
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.65, 7), woodDark);
  stake.position.y = 0.82;
  stake.castShadow = true;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.68, 1.22), woodLight);
  board.position.set(0.06, 1.32, 0);
  board.rotation.x = -0.06;
  board.castShadow = true;
  [-0.38, 0.38].forEach((nz) => {
    const nail = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 })
    );
    nail.position.set(0.14, 1.32, nz);
    signPivot.add(nail);
  });
  signPivot.add(stake, board);
  group.add(dirtMound, signPivot);
  return { group, markerId, waver: signPivot };
}

export function animateTrackMarkerMesh(
  parts: TrackMarkerParts,
  elapsed: number,
  seed = 0
): void {
  if (parts.spinner) {
    parts.spinner.rotation.y = elapsed * 1.6 + seed;
    parts.spinner.position.y = 1.65 + Math.sin(elapsed * 2.8 + seed) * 0.14;
  }
  if (parts.waver) {
    if (parts.markerId === 'marker_flag') {
      parts.waver.rotation.y = Math.sin(elapsed * 4.5 + seed) * 0.22;
    } else if (parts.markerId === 'marker_cat_statue') {
      parts.waver.rotation.z = Math.sin(elapsed * 5.0 + seed) * 0.35;
    } else if (parts.markerId === 'marker_scarecrow') {
      parts.waver.rotation.z = Math.sin(elapsed * 2.6 + seed) * 0.08;
    } else {
      parts.waver.rotation.z = 0.09 + Math.sin(elapsed * 2.0 + seed) * 0.03;
    }
  }
  if (parts.runeRing) {
    parts.runeRing.rotation.z = elapsed * 0.8;
  }
}
