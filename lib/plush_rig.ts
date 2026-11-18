import * as THREE from 'three';

export interface ChubbyPlushRigResult {
  group: THREE.Group;
  rigScale: number;
  mixer: THREE.AnimationMixer;
  animations: THREE.AnimationClip[];
  playClip: (patterns: RegExp[], timeOffset?: number) => void;
  headBone: THREE.Object3D;
  torsoBone: THREE.Object3D;
  torsoVisualGroup: THREE.Group;
  armLeftBone: THREE.Object3D;
  armRightBone: THREE.Object3D;
  legLeftBone: THREE.Object3D;
  legRightBone: THREE.Object3D;
}

export interface BuildChubbyPlushRigOptions {
  equipArmor: string;
  furColor: string | number;
  animPatterns: RegExp[];
  animTimeOffset?: number;
  customShirtHex?: string;
  customPantsHex?: string;
}

interface OutfitPalette {
  shirtHex: number;
  shirtSecondaryHex: number;
  collarHex: number;
  pantsHex: number;
  shoeHex: number;
  longSleeve: boolean;
  isShorts: boolean;
  isPleatedSkirt: boolean;
  hasHoodie: boolean;
  hasCardiganButtons: boolean;
  hasVestLayer: boolean;
  hasTrackStripe: boolean;
}

function resolveOutfitPalette(equipArmor: string): OutfitPalette {
  switch (equipArmor) {
    case 'armor_snow_dress':
      return {
        shirtHex: 0x2563eb,
        shirtSecondaryHex: 0xef4444,
        collarHex: 0xffffff,
        pantsHex: 0xfacc15,
        shoeHex: 0xf43f5e,
        longSleeve: false,
        isShorts: true,
        isPleatedSkirt: true,
        hasHoodie: false,
        hasCardiganButtons: false,
        hasVestLayer: false,
        hasTrackStripe: false,
      };
    case 'armor_silver_knight':
      return {
        shirtHex: 0x3b82f6,
        shirtSecondaryHex: 0x60a5fa,
        collarHex: 0xf8fafc,
        pantsHex: 0x1e3a8a,
        shoeHex: 0x1e293b,
        longSleeve: true,
        isShorts: false,
        isPleatedSkirt: false,
        hasHoodie: true,
        hasCardiganButtons: false,
        hasVestLayer: false,
        hasTrackStripe: false,
      };
    case 'armor_gold_paladin':
      return {
        shirtHex: 0xfacc15,
        shirtSecondaryHex: 0x18181b,
        collarHex: 0x18181b,
        pantsHex: 0x18181b,
        shoeHex: 0xeab308,
        longSleeve: true,
        isShorts: false,
        isPleatedSkirt: false,
        hasHoodie: false,
        hasCardiganButtons: false,
        hasVestLayer: false,
        hasTrackStripe: true,
      };
    case 'armor_princess':
      return {
        shirtHex: 0xf472b6,
        shirtSecondaryHex: 0xfffbeb,
        collarHex: 0xfffbeb,
        pantsHex: 0xfef3c7,
        shoeHex: 0xf472b6,
        longSleeve: true,
        isShorts: true,
        isPleatedSkirt: false,
        hasHoodie: false,
        hasCardiganButtons: true,
        hasVestLayer: false,
        hasTrackStripe: false,
      };
    case 'armor_ice_cape':
      return {
        shirtHex: 0x38bdf8,
        shirtSecondaryHex: 0xe0f2fe,
        collarHex: 0xffffff,
        pantsHex: 0xd6d3d1,
        shoeHex: 0x0284c7,
        longSleeve: true,
        isShorts: false,
        isPleatedSkirt: false,
        hasHoodie: false,
        hasCardiganButtons: false,
        hasVestLayer: false,
        hasTrackStripe: true,
      };
    case 'armor_vest':
      return {
        shirtHex: 0xf8fafc,
        shirtSecondaryHex: 0x16a34a,
        collarHex: 0x16a34a,
        pantsHex: 0xb45309,
        shoeHex: 0x15803d,
        longSleeve: false,
        isShorts: true,
        isPleatedSkirt: false,
        hasHoodie: false,
        hasCardiganButtons: false,
        hasVestLayer: true,
        hasTrackStripe: false,
      };
    case 'armor_gacha_shiba_pajama':
      return {
        shirtHex: 0xc084fc,
        shirtSecondaryHex: 0xfde047,
        collarHex: 0xfffbeb,
        pantsHex: 0xa855f7,
        shoeHex: 0xfde047,
        longSleeve: true,
        isShorts: false,
        isPleatedSkirt: false,
        hasHoodie: false,
        hasCardiganButtons: true,
        hasVestLayer: false,
        hasTrackStripe: false,
      };
    case 'armor_gacha_dino':
      return {
        shirtHex: 0x10b981,
        shirtSecondaryHex: 0xf97316,
        collarHex: 0xfef3c7,
        pantsHex: 0x10b981,
        shoeHex: 0xf97316,
        longSleeve: true,
        isShorts: false,
        isPleatedSkirt: false,
        hasHoodie: false,
        hasCardiganButtons: false,
        hasVestLayer: false,
        hasTrackStripe: false,
      };
    case 'armor_ms_denim_overall':
      return {
        shirtHex: 0xfacc15,
        shirtSecondaryHex: 0x2563eb,
        collarHex: 0xfffbeb,
        pantsHex: 0x2563eb,
        shoeHex: 0xef4444,
        longSleeve: false,
        isShorts: false,
        isPleatedSkirt: false,
        hasHoodie: false,
        hasCardiganButtons: false,
        hasVestLayer: false,
        hasTrackStripe: false,
      };
    case 'armor_ms_sailor_uniform':
      return {
        shirtHex: 0xffffff,
        shirtSecondaryHex: 0x1d4ed8,
        collarHex: 0x1d4ed8,
        pantsHex: 0x1e3a8a,
        shoeHex: 0x1e293b,
        longSleeve: false,
        isShorts: true,
        isPleatedSkirt: true,
        hasHoodie: false,
        hasCardiganButtons: false,
        hasVestLayer: false,
        hasTrackStripe: false,
      };
    case 'armor_ms_strawberry_milk':
      return {
        shirtHex: 0xf9a8d4,
        shirtSecondaryHex: 0xfffbeb,
        collarHex: 0xffffff,
        pantsHex: 0xffffff,
        shoeHex: 0xf472b6,
        longSleeve: true,
        isShorts: true,
        isPleatedSkirt: false,
        hasHoodie: true,
        hasCardiganButtons: false,
        hasVestLayer: false,
        hasTrackStripe: false,
      };
    case 'armor_gacha_pink_bean':
      return {
        shirtHex: 0xf472b6,
        shirtSecondaryHex: 0xfbcfe8,
        collarHex: 0xfce7f3,
        pantsHex: 0xf472b6,
        shoeHex: 0xec4899,
        longSleeve: true,
        isShorts: false,
        isPleatedSkirt: false,
        hasHoodie: false,
        hasCardiganButtons: false,
        hasVestLayer: false,
        hasTrackStripe: false,
      };
    case 'armor_none':
    default:
      return {
        shirtHex: 0x2563eb,
        shirtSecondaryHex: 0xfacc15,
        collarHex: 0xffffff,
        pantsHex: 0x1e293b,
        shoeHex: 0xef4444,
        longSleeve: false,
        isShorts: false,
        isPleatedSkirt: false,
        hasHoodie: false,
        hasCardiganButtons: false,
        hasVestLayer: false,
        hasTrackStripe: true,
      };
  }
}

function makeQuatTrack(name: string, times: number[], eulers: [number, number, number][]): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const [rx, ry, rz] of eulers) {
    e.set(rx, ry, rz, 'XYZ');
    q.setFromEuler(e);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(name, times, values);
}

function buildPlushAnimations(): THREE.AnimationClip[] {
  // 1. idle: หายใจดุ๊กดิ๊กตัวกลมนุ่มนิ่ม
  const idleClip = new THREE.AnimationClip('idle', 1.6, [
    new THREE.VectorKeyframeTrack(
      'root.position',
      [0, 0.4, 0.8, 1.2, 1.6],
      [0, 0, 0, 0, 0.03, 0, 0, 0, 0, 0, 0.03, 0, 0, 0, 0]
    ),
    makeQuatTrack(
      'torso.quaternion',
      [0, 0.4, 0.8, 1.2, 1.6],
      [
        [0, 0, -0.025],
        [0.02, 0.03, 0],
        [0, 0, 0.025],
        [0.02, -0.03, 0],
        [0, 0, -0.025],
      ]
    ),
    makeQuatTrack(
      'arm-left.quaternion',
      [0, 0.8, 1.6],
      [
        [0, -0.12, -0.82],
        [0, -0.24, -0.74],
        [0, -0.12, -0.82],
      ]
    ),
    makeQuatTrack(
      'arm-right.quaternion',
      [0, 0.8, 1.6],
      [
        [0, 0.12, 0.82],
        [0, 0.24, 0.74],
        [0, 0.12, 0.82],
      ]
    ),
    makeQuatTrack(
      'head.quaternion',
      [0, 0.8, 1.6],
      [
        [0, -0.04, 0.02],
        [0.03, 0.04, -0.02],
        [0, -0.04, 0.02],
      ]
    ),
  ]);

  // 2. sprint: ท่าวิ่งดุ๊กดิ๊กก้าวขาสลับแกว่งแขนเต็มสปีด
  const sprintClip = new THREE.AnimationClip('sprint', 0.52, [
    new THREE.VectorKeyframeTrack(
      'root.position',
      [0, 0.13, 0.26, 0.39, 0.52],
      [0, 0.02, 0, 0, 0.15, 0, 0, 0.02, 0, 0, 0.15, 0, 0, 0.02, 0]
    ),
    makeQuatTrack(
      'torso.quaternion',
      [0, 0.13, 0.26, 0.39, 0.52],
      [
        [0.14, 0.12, -0.04],
        [0.1, 0, 0],
        [0.14, -0.12, 0.04],
        [0.1, 0, 0],
        [0.14, 0.12, -0.04],
      ]
    ),
    makeQuatTrack(
      'leg-left.quaternion',
      [0, 0.13, 0.26, 0.39, 0.52],
      [
        [-0.85, 0, 0],
        [0, 0, 0],
        [0.85, 0, 0],
        [0, 0, 0],
        [-0.85, 0, 0],
      ]
    ),
    makeQuatTrack(
      'leg-right.quaternion',
      [0, 0.13, 0.26, 0.39, 0.52],
      [
        [0.85, 0, 0],
        [0, 0, 0],
        [-0.85, 0, 0],
        [0, 0, 0],
        [0.85, 0, 0],
      ]
    ),
    makeQuatTrack(
      'arm-left.quaternion',
      [0, 0.13, 0.26, 0.39, 0.52],
      [
        [0, 0.65, -0.58],
        [0, 0, -0.68],
        [0, -0.85, -0.52],
        [0, 0, -0.68],
        [0, 0.65, -0.58],
      ]
    ),
    makeQuatTrack(
      'arm-right.quaternion',
      [0, 0.13, 0.26, 0.39, 0.52],
      [
        [0, 0.85, 0.52],
        [0, 0, 0.68],
        [0, -0.65, 0.58],
        [0, 0, 0.68],
        [0, 0.85, 0.52],
      ]
    ),
    makeQuatTrack(
      'head.quaternion',
      [0, 0.26, 0.52],
      [
        [-0.08, -0.06, 0],
        [-0.08, 0.06, 0],
        [-0.08, -0.06, 0],
      ]
    ),
  ]);

  // 3. sit: นั่งยอง/นั่งเหยียดขาบนเสื่อปิกนิก
  const sitClip = new THREE.AnimationClip('sit', 1.2, [
    new THREE.VectorKeyframeTrack('root.position', [0, 1.2], [0, -0.3, 0, 0, -0.3, 0]),
    makeQuatTrack('leg-left.quaternion', [0, 1.2], [[-1.32, 0.12, 0], [-1.32, 0.12, 0]]),
    makeQuatTrack('leg-right.quaternion', [0, 1.2], [[-1.32, -0.12, 0], [-1.32, -0.12, 0]]),
    makeQuatTrack('arm-left.quaternion', [0, 1.2], [[0, -0.25, -0.72], [0, -0.25, -0.72]]),
    makeQuatTrack('arm-right.quaternion', [0, 1.2], [[0, 0.25, 0.72], [0, 0.25, 0.72]]),
  ]);

  // 4. emote-yes: กระโดดเชียร์ดีใจชูมือดุ๊กดิ๊ก
  const cheerClip = new THREE.AnimationClip('emote-yes', 0.72, [
    new THREE.VectorKeyframeTrack(
      'root.position',
      [0, 0.18, 0.36, 0.54, 0.72],
      [0, 0, 0, 0, 0.16, 0, 0, 0, 0, 0, 0.16, 0, 0, 0, 0]
    ),
    makeQuatTrack(
      'arm-left.quaternion',
      [0, 0.36, 0.72],
      [
        [0, -0.3, 0.65],
        [0, -0.3, 1.15],
        [0, -0.3, 0.65],
      ]
    ),
    makeQuatTrack(
      'arm-right.quaternion',
      [0, 0.36, 0.72],
      [
        [0, 0.3, -0.65],
        [0, 0.3, -1.15],
        [0, 0.3, -0.65],
      ]
    ),
    makeQuatTrack(
      'head.quaternion',
      [0, 0.36, 0.72],
      [
        [-0.08, 0, -0.06],
        [0.08, 0, 0.06],
        [-0.08, 0, -0.06],
      ]
    ),
  ]);

  // 5. jump
  const jumpClip = new THREE.AnimationClip('jump', 0.6, [
    new THREE.VectorKeyframeTrack('root.position', [0, 0.3, 0.6], [0, 0, 0, 0, 0.26, 0, 0, 0, 0]),
    makeQuatTrack('arm-left.quaternion', [0, 0.3, 0.6], [[0, 0, -0.5], [0, 0, 1.1], [0, 0, -0.5]]),
    makeQuatTrack('arm-right.quaternion', [0, 0.3, 0.6], [[0, 0, 0.5], [0, 0, -1.1], [0, 0, 0.5]]),
  ]);

  return [idleClip, sprintClip, sitClip, cheerClip, jumpClip];
}

/**
 * สร้างลำตัว Chibi ทรงกลมตุ้ยนุ้ยนุ่มนิ่ม (Plush Round Mochi Body)
 * รองรับการหดเป็นเอวเอสและการพองกลมเป็นพุงป่องได้อย่างเป็นธรรมชาติ พร้อมเสื้อและกางเกง/กระโปรงเข้าชุด
 */
export function buildChubbyPlushOutfitRig({
  equipArmor,
  furColor,
  animPatterns,
  animTimeOffset = 0,
  customShirtHex,
  customPantsHex,
}: BuildChubbyPlushRigOptions): ChubbyPlushRigResult {
  const isBareFur = equipArmor === 'armor_bare';
  const palette = { ...resolveOutfitPalette(equipArmor) };
  if (customShirtHex && /^#[0-9A-Fa-f]{6}$/.test(customShirtHex)) {
    palette.shirtHex = new THREE.Color(customShirtHex).getHex();
  }
  if (customPantsHex && /^#[0-9A-Fa-f]{6}$/.test(customPantsHex)) {
    palette.pantsHex = new THREE.Color(customPantsHex).getHex();
  }
  const furMat = new THREE.MeshPhysicalMaterial({
    color: furColor,
    roughness: 0.56,
    metalness: 0.02,
    sheen: 0.78,
    sheenRoughness: 0.62,
  });
  const creamBellyMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    roughness: 0.52,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: palette.shirtHex,
    roughness: 0.55,
    metalness: equipArmor === 'armor_gold_paladin' ? 0.18 : 0.03,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: palette.shirtSecondaryHex,
    roughness: 0.52,
  });
  const collarMat = new THREE.MeshStandardMaterial({
    color: palette.collarHex,
    roughness: 0.5,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: palette.pantsHex,
    roughness: 0.62,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: palette.shoeHex,
    roughness: 0.45,
  });
  const soleWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
  });

  // โครงกระดูกหลัก (หัน +Z ในพื้นที่ภายใน แล้วหมุน wrapper +90° ให้ตรงกับ +X ของสนาม)
  const wrapper = new THREE.Group();
  const rigRoot = new THREE.Group();
  rigRoot.rotation.y = Math.PI / 2;
  wrapper.add(rigRoot);

  const rootBone = new THREE.Group();
  rootBone.name = 'root';
  rigRoot.add(rootBone);

  // =========================================================================
  // 1. ขาและรองเท้าผ้าใบจิบิ (leg-left / leg-right)
  // =========================================================================
  const makeLeg = (name: string, xPos: number) => {
    const legBone = new THREE.Group();
    legBone.name = name;
    legBone.position.set(xPos, 0.46, 0);

    if (isBareFur) {
      // โหมดถอดชุดทั้งหมด: ขาสัตว์ป้อมกลมสีขนธรรมชาติ + อุ้งเท้านุ่มนิ่ม
      const furLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.125, 0.34, 16), furMat);
      furLeg.position.y = -0.17;
      furLeg.castShadow = true;
      const furFoot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 14), furMat);
      furFoot.scale.set(0.95, 0.68, 1.28);
      furFoot.position.set(0, -0.39, 0.04);
      furFoot.castShadow = true;
      legBone.add(furLeg, furFoot);
      return legBone;
    }

    if (palette.isShorts) {
      // ขาสั้น/กระโปรงเทนนิส: โชว์ขาสั้นๆ สีขนสัตว์ + ถุงเท้าขาว + รองเท้าผ้าใบ
      const shortCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.145, 0.14, 16), pantsMat);
      shortCuff.position.y = -0.06;
      shortCuff.castShadow = true;
      const furCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.115, 0.22, 16), furMat);
      furCalf.position.y = -0.2;
      furCalf.castShadow = true;
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14), soleWhiteMat);
      sock.position.y = -0.31;
      legBone.add(shortCuff, furCalf, sock);
    } else {
      // กางเกงขายาว/วอร์ม/ยีนส์ทรงป้อมน่ารัก
      const pantLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.135, 0.34, 18), pantsMat);
      pantLeg.position.y = -0.17;
      pantLeg.castShadow = true;
      legBone.add(pantLeg);

      if (equipArmor === 'armor_silver_knight') {
        const denimCuff = new THREE.Mesh(
          new THREE.TorusGeometry(0.138, 0.024, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.65 })
        );
        denimCuff.rotation.x = Math.PI / 2;
        denimCuff.position.y = -0.32;
        legBone.add(denimCuff);
      }
    }

    // รองเท้าผ้าใบจิบิหัวมน (Chibi Sneaker)
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.39, 0.04);
    const shoeUpper = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 14), shoeMat);
    shoeUpper.scale.set(0.95, 0.72, 1.32);
    shoeUpper.position.y = 0.02;
    shoeUpper.castShadow = true;
    const shoeToe = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), soleWhiteMat);
    shoeToe.scale.set(0.96, 0.62, 0.95);
    shoeToe.position.set(0, 0.0, 0.08);
    const shoeSole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.145, 0.055, 16), soleWhiteMat);
    shoeSole.scale.set(0.96, 1, 1.34);
    shoeSole.position.y = -0.042;
    shoeGroup.add(shoeUpper, shoeToe, shoeSole);
    legBone.add(shoeGroup);

    return legBone;
  };

  const legLeftBone = makeLeg('leg-left', 0.23);
  const legRightBone = makeLeg('leg-right', -0.23);
  rootBone.add(legLeftBone, legRightBone);

  // =========================================================================
  // 2. ลำตัวทรงกลมตุ้ยนุ้ย (torso + torsoVisualGroup ที่หด-ขยายตามพุงได้เนียนทั้งตัว!)
  // =========================================================================
  const torsoBone = new THREE.Group();
  torsoBone.name = 'torso';
  torsoBone.position.set(0, 0.44, 0);
  rootBone.add(torsoBone);

  const torsoVisualGroup = new THREE.Group();
  torsoBone.add(torsoVisualGroup);

  // ครึ่งล่างของลำตัวกลม: กางเกง/กระโปรงช่วงสะโพกและพุงล่าง (Lathe โค้งมนไร้เหลี่ยม)
  const lowerPoints = [
    new THREE.Vector2(0.0, -0.09),
    new THREE.Vector2(0.28, -0.07),
    new THREE.Vector2(0.45, 0.01),
    new THREE.Vector2(0.535, 0.12),
    new THREE.Vector2(0.555, 0.245),
    new THREE.Vector2(0.0, 0.245),
  ];
  const pantsHipMesh = new THREE.Mesh(
    new THREE.LatheGeometry(lowerPoints, 32),
    isBareFur ? furMat : pantsMat
  );
  pantsHipMesh.castShadow = true;
  pantsHipMesh.receiveShadow = true;
  torsoVisualGroup.add(pantsHipMesh);

  // ครึ่งบนของลำตัวกลม: เสื้อยืด/ฮู้ดดี้/สเวตเตอร์/แทร็กสูท โค้งรับพุงกลมตุ้ยนุ้ย (หรือขนสัตว์ล้วนเมื่อถอดชุด)
  const upperPoints = [
    new THREE.Vector2(0.0, 0.23),
    new THREE.Vector2(0.562, 0.235),
    new THREE.Vector2(0.555, 0.35),
    new THREE.Vector2(0.51, 0.48),
    new THREE.Vector2(0.43, 0.61),
    new THREE.Vector2(0.33, 0.71),
    new THREE.Vector2(0.22, 0.77),
    new THREE.Vector2(0.0, 0.775),
  ];
  const shirtBodyMesh = new THREE.Mesh(
    new THREE.LatheGeometry(upperPoints, 32),
    isBareFur ? furMat : shirtMat
  );
  shirtBodyMesh.castShadow = true;
  shirtBodyMesh.receiveShadow = true;
  torsoVisualGroup.add(shirtBodyMesh);

  if (isBareFur) {
    // แผ่นพุงกลมสีครีมนุ่มนิ่มธรรมชาติกลางหน้าท้องตุ๊กตาสัตว์
    const plushBellyPatch = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 18), creamBellyMat);
    plushBellyPatch.scale.set(0.92, 1.08, 0.46);
    plushBellyPatch.position.set(0, 0.34, 0.41);
    torsoVisualGroup.add(plushBellyPatch);
  } else {
    // ขอบเสื้อจั๊มพ์เอวกลม (Ribbed Waist Hem) ช่วยให้รอยต่อเสื้อกับกางเกงคมชัดน่ารัก
    const waistHem = new THREE.Mesh(
      new THREE.TorusGeometry(0.552, 0.026, 12, 32),
      palette.isPleatedSkirt ? secondaryMat : collarMat
    );
    waistHem.rotation.x = Math.PI / 2;
    waistHem.position.y = 0.24;
    torsoVisualGroup.add(waistHem);

    // คอเสื้อกลม (Crewneck / Peter-Pan Collar)
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.036, 12, 28), collarMat);
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = 0.755;
    torsoVisualGroup.add(collarRing);
  }

  // ดีเทลเฉพาะแต่ละชุดบนลำตัวกลม
  if (!isBareFur && palette.isPleatedSkirt) {
    // กระโปรงเทนนิสจีบรอบเอวกลมดุ๊กดิ๊ก
    const pleatCount = 18;
    for (let i = 0; i < pleatCount; i++) {
      const ang = (i / pleatCount) * Math.PI * 2;
      const pleat = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.28, 6), pantsMat);
      pleat.position.set(Math.cos(ang) * 0.5, 0.11, Math.sin(ang) * 0.5);
      pleat.rotation.z = Math.cos(ang) * 0.26;
      pleat.rotation.x = -Math.sin(ang) * 0.26;
      pleat.castShadow = true;
      torsoVisualGroup.add(pleat);
    }
  }

  if (!isBareFur && palette.hasTrackStripe) {
    // แถบคาดหน้าอกสไตล์สปอร์ต / สเวตเตอร์
    const chestBand = new THREE.Mesh(new THREE.TorusGeometry(0.505, 0.032, 10, 32), secondaryMat);
    chestBand.rotation.x = Math.PI / 2;
    chestBand.position.y = 0.49;
    torsoVisualGroup.add(chestBand);

    if (equipArmor === 'armor_gold_paladin') {
      // เส้นซิปหน้าเสื้อแจ็คเก็ตแชมเปี้ยน
      const zipLine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.05), secondaryMat);
      zipLine.position.set(0, 0.5, 0.52);
      zipLine.rotation.x = -0.18;
      torsoVisualGroup.add(zipLine);
    }
  }

  if (palette.hasHoodie) {
    // ฮู้ดด้านหลังคอ + กระเป๋าจิงโจ้ด้านหน้าพุง + เชือกฮู้ดสีขาว 2 เส้น
    const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), secondaryMat);
    hoodBack.scale.set(1.2, 0.72, 0.95);
    hoodBack.position.set(0, 0.69, -0.22);
    torsoVisualGroup.add(hoodBack);

    const pocket = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), secondaryMat);
    pocket.scale.set(1.25, 0.68, 0.45);
    pocket.position.set(0, 0.34, 0.48);
    torsoVisualGroup.add(pocket);

    [-0.07, 0.07].forEach((sx) => {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8), soleWhiteMat);
      cord.position.set(sx, 0.63, 0.43);
      cord.rotation.x = -0.32;
      torsoVisualGroup.add(cord);
    });
  }

  if (palette.hasCardiganButtons) {
    // สาบเสื้อด้านในสีครีม + กระดุมเม็ดกลม/ดาวเรียงตามพุง
    const btnMat = equipArmor === 'armor_gacha_shiba_pajama' ? secondaryMat : collarMat;
    [0.34, 0.47, 0.6].forEach((by, bi) => {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), btnMat);
      btn.position.set(0, by, 0.55 - bi * 0.045);
      torsoVisualGroup.add(btn);
    });
  }

  if (equipArmor === 'armor_gacha_dino') {
    // แผ่นพุงไดโนเสาร์สีครีมน่ารักด้านหน้า + หนามไดโนเสาร์สีส้มเรียงด้านหลัง!
    const dinoTummy = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 16), collarMat);
    dinoTummy.scale.set(0.95, 1.05, 0.45);
    dinoTummy.position.set(0, 0.36, 0.42);
    torsoVisualGroup.add(dinoTummy);

    [0.16, 0.33, 0.5, 0.65].forEach((sy, si) => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.085 - si * 0.008, 0.22, 6), secondaryMat);
      spike.rotation.x = -Math.PI / 2 - 0.15;
      spike.position.set(0, sy, -0.56 + si * 0.045);
      spike.castShadow = true;
      torsoVisualGroup.add(spike);
    });
  }

  if (equipArmor === 'armor_ms_denim_overall') {
    // 👖 ชุดเอี๊ยมยีนส์เฮเนซิส: แผ่นเอี๊ยมยีนส์ด้านหน้า + สายเอี๊ยมคู่พาดไหล่ + กระดุมทอง 2 เม็ด
    const bib = new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 14), pantsMat);
    bib.scale.set(1.05, 0.92, 0.45);
    bib.position.set(0, 0.38, 0.43);
    torsoVisualGroup.add(bib);

    const brassMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.65, roughness: 0.25 });
    [-0.16, 0.16].forEach((sx) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.36, 0.14), pantsMat);
      strap.position.set(sx, 0.6, 0.35);
      strap.rotation.x = -0.52;
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), brassMat);
      btn.position.set(sx, 0.48, 0.52);
      torsoVisualGroup.add(strap, btn);
    });
  }

  if (equipArmor === 'armor_ms_sailor_uniform') {
    // ⚓ ชุดกะลาสีเรือเมเปิ้ล: ปกกะลาสีสีน้ำเงินแถบขาว + โบว์แดงผูกอกสุดคิวท์
    const sailorFlap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.54), secondaryMat);
    sailorFlap.position.set(0, 0.71, -0.05);
    torsoVisualGroup.add(sailorFlap);

    const bowRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 8), bowRedMat);
      wing.rotation.z = side * (Math.PI / 2);
      wing.position.set(side * 0.1, 0.6, 0.49);
      torsoVisualGroup.add(wing);
    });
    const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), bowRedMat);
    bowCenter.position.set(0, 0.6, 0.51);
    torsoVisualGroup.add(bowCenter);
  }

  if (equipArmor === 'armor_gacha_pink_bean') {
    // 🩷 ชุดวันซี่พิงก์บีนพุงเด้ง: แผ่นพุงสีชมพูพาสเทลรูปไข่ + ครีบหลังน่ารัก
    const pbTummy = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 16), collarMat);
    pbTummy.scale.set(0.96, 1.06, 0.46);
    pbTummy.position.set(0, 0.35, 0.42);
    torsoVisualGroup.add(pbTummy);

    [0.25, 0.46].forEach((sy) => {
      const puffFin = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), secondaryMat);
      puffFin.position.set(0, sy, -0.53);
      torsoVisualGroup.add(puffFin);
    });
  }

  if (palette.hasVestLayer) {
    // เสื้อกั๊กแคมป์ปิ้งสวมทับเสื้อยืดขาว (เว้นช่องตัววีด้านหน้าโชว์เสื้อขาว)
    [-1, 1].forEach((side) => {
      const vestHalf = new THREE.Mesh(
        new THREE.SphereGeometry(0.54, 18, 16, side > 0 ? 0.22 : Math.PI - 1.38, 1.16),
        secondaryMat
      );
      vestHalf.scale.set(1.03, 0.56, 1.03);
      vestHalf.position.y = 0.48;
      torsoVisualGroup.add(vestHalf);
    });
    const vestBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.54, 18, 16, Math.PI + 0.15, Math.PI - 0.3),
      secondaryMat
    );
    vestBack.scale.set(1.03, 0.56, 1.03);
    vestBack.position.y = 0.48;
    torsoVisualGroup.add(vestBack);
  }

  // =========================================================================
  // 3. แขนสวมแขนเสื้อ + อุ้งมือสัตว์กลมนุ่มนิ่ม (arm-left / arm-right)
  // =========================================================================
  const makeArm = (name: string, dirSign: 1 | -1) => {
    const armBone = new THREE.Group();
    armBone.name = name;
    armBone.position.set(dirSign * 0.4, 0.56, 0.02);

    if (isBareFur) {
      const bareArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.22, 8, 12), furMat);
      bareArm.rotation.z = Math.PI / 2;
      bareArm.position.x = dirSign * 0.16;
      bareArm.castShadow = true;
      armBone.add(bareArm);
    } else if (palette.longSleeve) {
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.22, 8, 14), shirtMat);
      sleeve.rotation.z = Math.PI / 2;
      sleeve.position.x = dirSign * 0.15;
      sleeve.castShadow = true;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.02, 8, 14), collarMat);
      cuff.rotation.y = Math.PI / 2;
      cuff.position.x = dirSign * 0.27;
      armBone.add(sleeve, cuff);
    } else {
      // แขนเสื้อสั้นพองน่ารัก + ท่อนแขนขนสัตว์
      const puffSleeve = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), shirtMat);
      puffSleeve.scale.set(1.15, 0.95, 0.95);
      puffSleeve.position.x = dirSign * 0.09;
      puffSleeve.castShadow = true;
      const furForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.098, 0.15, 8, 12), furMat);
      furForearm.rotation.z = Math.PI / 2;
      furForearm.position.x = dirSign * 0.21;
      furForearm.castShadow = true;
      armBone.add(puffSleeve, furForearm);

      if (equipArmor === 'armor_snow_dress') {
        const puffAccent = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.018, 8, 12), secondaryMat);
        puffAccent.rotation.y = Math.PI / 2;
        puffAccent.position.x = dirSign * 0.17;
        armBone.add(puffAccent);
      }
    }

    // อุ้งมือสัตว์กลมตุ้ยนุ้ย (Cute Round Animal Paw)
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 14), furMat);
    paw.scale.set(1.08, 0.92, 1.02);
    paw.position.set(dirSign * 0.34, 0, 0.01);
    paw.castShadow = true;
    armBone.add(paw);

    return armBone;
  };

  const armLeftBone = makeArm('arm-left', 1);
  const armRightBone = makeArm('arm-right', -1);
  torsoBone.add(armLeftBone, armRightBone);

  // =========================================================================
  // 4. กระดูกคอ/หัว (head)
  // =========================================================================
  const headBone = new THREE.Group();
  headBone.name = 'head';
  headBone.position.set(0, 0.76, 0.01);
  torsoBone.add(headBone);

  // เก็บ Snapshot ท่าเริ่มต้นของทุกกระดูกไว้รีเซ็ตเวลาเปลี่ยนท่า
  const boneNodes = [rootBone, legLeftBone, legRightBone, torsoBone, armLeftBone, armRightBone, headBone];
  const restSnapshots = boneNodes.map((node) => ({
    node,
    pos: node.position.clone(),
    quat: node.quaternion.clone(),
  }));

  const animations = buildPlushAnimations();
  const mixer = new THREE.AnimationMixer(rigRoot);

  let currentAction: THREE.AnimationAction | null = null;
  let currentClipName = '';

  const playClip = (patterns: RegExp[], timeOffset = 0) => {
    let chosen: THREE.AnimationClip | undefined;
    for (const pat of patterns) {
      chosen = animations.find((a) => pat.test(a.name));
      if (chosen) break;
    }
    if (!chosen) chosen = animations[0];
    if (!chosen || chosen.name === currentClipName) return;

    if (currentAction) {
      mixer.stopAllAction();
    }
    for (const snap of restSnapshots) {
      snap.node.position.copy(snap.pos);
      snap.node.quaternion.copy(snap.quat);
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

  playClip(animPatterns, animTimeOffset);

  return {
    group: wrapper,
    rigScale: 1,
    mixer,
    animations,
    playClip,
    headBone,
    torsoBone,
    torsoVisualGroup,
    armLeftBone,
    armRightBone,
    legLeftBone,
    legRightBone,
  };
}
