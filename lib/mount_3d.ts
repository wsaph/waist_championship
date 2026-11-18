import * as THREE from 'three';

export interface MountMeshParts {
  mountId: string;
  mountGroup: THREE.Group;
  bodyBounceGroup: THREE.Group;
  saddleY: number;
  kind: 'gallop' | 'jelly' | 'hover' | 'fly';
  legFL?: THREE.Object3D | null;
  legFR?: THREE.Object3D | null;
  legBL?: THREE.Object3D | null;
  legBR?: THREE.Object3D | null;
  wingL?: THREE.Object3D | null;
  wingR?: THREE.Object3D | null;
  spinPart?: THREE.Object3D | null;
}

/**
 * สร้างโมเดล 3D สัตว์ขี่ & พาหนะแฟนตาซีสไตล์ MapleSim (หันหน้าไปทาง +X, พื้นอยู่ที่ y = 0)
 */
export function buildMountMesh(mountId?: string): MountMeshParts | null {
  if (!mountId || mountId === 'mount_none') return null;

  const mountGroup = new THREE.Group();
  const bodyBounceGroup = new THREE.Group();
  mountGroup.add(bodyBounceGroup);

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.48 });
  const darkEyeMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.65, roughness: 0.25 });
  const pinkBlushMat = new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.65 });

  let saddleY = 0.85;
  let kind: MountMeshParts['kind'] = 'hover';
  let legFL: THREE.Object3D | null = null;
  let legFR: THREE.Object3D | null = null;
  let legBL: THREE.Object3D | null = null;
  let legBR: THREE.Object3D | null = null;
  let wingL: THREE.Object3D | null = null;
  let wingR: THREE.Object3D | null = null;
  let spinPart: THREE.Object3D | null = null;

  const makeQuadLegs = (legMat: THREE.Material, hoofMat: THREE.Material, radius = 0.12, len = 0.42, spreadX = 0.45, spreadZ = 0.34, yTop = 0.44) => {
    const createOne = (lx: number, lz: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(lx, yTop, lz);
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, len, 12), legMat);
      limb.position.y = -len * 0.5;
      limb.castShadow = true;
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.95, radius * 1.02, 0.09, 12), hoofMat);
      hoof.position.y = -len + 0.03;
      pivot.add(limb, hoof);
      bodyBounceGroup.add(pivot);
      return pivot;
    };
    legFL = createOne(spreadX, -spreadZ);
    legFR = createOne(spreadX, spreadZ);
    legBL = createOne(-spreadX, -spreadZ);
    legBR = createOne(-spreadX, spreadZ);
  };

  if (mountId === 'mount_cloud') {
    // ☁️ เมฆวิเศษสีขาวนุ่มฟู (Flying Nimbus Cloud — ฟรี!)
    saddleY = 0.68;
    kind = 'hover';
    const cloudMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.22,
      roughness: 0.48,
      sheen: 0.8,
    });
    const puffSpecs: [number, number, number, number][] = [
      [0, 0.46, 0, 0.52],
      [0.48, 0.44, 0, 0.42],
      [-0.48, 0.42, 0, 0.4],
      [0.18, 0.42, -0.38, 0.38],
      [0.18, 0.42, 0.38, 0.38],
      [-0.24, 0.4, -0.34, 0.35],
      [-0.24, 0.4, 0.34, 0.35],
      [-0.78, 0.46, 0, 0.26],
    ];
    puffSpecs.forEach(([px, py, pz, pr]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(pr, 16, 14), cloudMat);
      puff.scale.set(1.12, 0.76, 1.05);
      puff.position.set(px, py, pz);
      puff.castShadow = true;
      bodyBounceGroup.add(puff);
    });
  } else if (mountId === 'mount_sunny_egg') {
    // 🍳 พรมไข่ดาวลอยฟ้า (Sunny-Side-Up Egg Mount)
    saddleY = 0.56;
    kind = 'hover';
    const eggWhiteMain = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.9, 0.14, 24), whiteMat);
    eggWhiteMain.scale.set(1.12, 1, 0.98);
    eggWhiteMain.position.y = 0.38;
    eggWhiteMain.castShadow = true;
    bodyBounceGroup.add(eggWhiteMain);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), whiteMat);
      lobe.scale.set(1.1, 0.32, 1.1);
      lobe.position.set(Math.cos(a) * 0.86, 0.38, Math.sin(a) * 0.78);
      bodyBounceGroup.add(lobe);
    }
    const yolkMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.12,
      roughness: 0.18,
      clearcoat: 0.65,
    });
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 14), yolkMat);
    yolk.scale.set(1.05, 0.52, 1.05);
    yolk.position.set(0.06, 0.48, 0);
    bodyBounceGroup.add(yolk);
  } else if (mountId === 'mount_red_pig') {
    // 🐷 หมูแดงผูกโบว์ซิ่งในตำนาน (Maple Ribbon Pig)
    saddleY = 0.94;
    kind = 'gallop';
    const pigRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
    const snoutMat = new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.45 });
    const ribbonBlueMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.38 });
    const hoofDarkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.65 });

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.56, 22, 18), pigRedMat);
    torso.scale.set(1.38, 0.92, 0.96);
    torso.position.set(0, 0.68, 0);
    torso.castShadow = true;
    bodyBounceGroup.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 16), pigRedMat);
    head.position.set(0.72, 0.82, 0);
    head.castShadow = true;
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.16, 16), snoutMat);
    snout.rotation.z = Math.PI / 2;
    snout.position.set(1.12, 0.78, 0);
    bodyBounceGroup.add(head, snout);

    [-0.06, 0.06].forEach((nz) => {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), darkEyeMat);
      nostril.position.set(1.2, 0.79, nz);
      bodyBounceGroup.add(nostril);
    });
    [-0.22, 0.22].forEach((ez) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), darkEyeMat);
      eye.position.set(1.02, 0.92, ez);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 8), pigRedMat);
      ear.position.set(0.68, 1.2, ez * 1.1);
      ear.rotation.z = -0.35;
      ear.rotation.x = ez < 0 ? -0.3 : 0.3;
      bodyBounceGroup.add(eye, ear);
    });

    // โบว์สีฟ้าผูกคอ + ผ้ารองอานขอบทอง
    const neckCollar = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 8, 20), ribbonBlueMat);
    neckCollar.rotation.y = Math.PI / 2;
    neckCollar.position.set(0.48, 0.8, 0);
    [-1, 1].forEach((side) => {
      const bowLoop = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 8), ribbonBlueMat);
      bowLoop.rotation.x = side * (Math.PI / 2);
      bowLoop.position.set(0.5, 1.12, side * 0.14);
      bodyBounceGroup.add(bowLoop);
    });
    const saddleBlanket = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.98), ribbonBlueMat);
    saddleBlanket.position.set(-0.05, 1.08, 0);
    const curlyTail = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.038, 8, 14, Math.PI * 1.5), snoutMat);
    curlyTail.position.set(-0.82, 0.78, 0);
    bodyBounceGroup.add(neckCollar, saddleBlanket, curlyTail);

    makeQuadLegs(pigRedMat, hoofDarkMat, 0.12, 0.38, 0.44, 0.32, 0.38);
  } else if (mountId === 'mount_green_slime') {
    // 💧 บิ๊กสไลม์เขียวเด้งดึ๋ง (Giant Bouncy Slime)
    saddleY = 0.92;
    kind = 'jelly';
    const slimeMat = new THREE.MeshPhysicalMaterial({
      color: 0x4ade80,
      emissive: 0x16a34a,
      emissiveIntensity: 0.14,
      roughness: 0.14,
      transmission: 0.22,
      transparent: true,
      opacity: 0.92,
    });
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.74, 24, 20), slimeMat);
    blob.scale.set(1.12, 0.84, 1.08);
    blob.position.y = 0.56;
    blob.castShadow = true;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.38, 8), slimeMat);
    stem.position.set(0.32, 1.22, 0);
    stem.rotation.z = -0.35;
    const tipDrop = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), slimeMat);
    tipDrop.position.set(0.45, 1.42, 0);
    bodyBounceGroup.add(blob, stem, tipDrop);
    [-0.24, 0.24].forEach((ez) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), darkEyeMat);
      eye.position.set(0.76, 0.64, ez);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), pinkBlushMat);
      cheek.position.set(0.74, 0.52, ez * 1.45);
      bodyBounceGroup.add(eye, cheek);
    });
  } else if (mountId === 'mount_pudding') {
    // 🍮 พุดดิ้งคาราเมลจานยักษ์ (Jiggly Caramel Pudding Plate)
    saddleY = 0.88;
    kind = 'jelly';
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 0.88, 0.12, 26), whiteMat);
    plate.position.y = 0.14;
    plate.castShadow = true;
    const plateRim = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.035, 8, 28), goldMat);
    plateRim.rotation.x = Math.PI / 2;
    plateRim.position.y = 0.2;
    const custardMat = new THREE.MeshPhysicalMaterial({
      color: 0xfde047,
      roughness: 0.2,
      clearcoat: 0.6,
    });
    const caramelMat = new THREE.MeshPhysicalMaterial({
      color: 0x92400e,
      roughness: 0.15,
      clearcoat: 0.8,
    });
    const flan = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.58, 24), custardMat);
    flan.position.y = 0.48;
    flan.castShadow = true;
    const glaze = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.65, 0.14, 24), caramelMat);
    glaze.position.y = 0.74;
    // คุกกี้ช็อกโกแลตสอดไส้ประดับข้างพุดดิ้ง (ตรงตามรูป MapleSim!)
    const cookieDark = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.7 });
    const cookie1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 14), cookieDark);
    cookie1.rotation.z = 0.95;
    cookie1.position.set(0.68, 0.34, 0.36);
    const cookieCream = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14), whiteMat);
    cookieCream.rotation.z = 0.95;
    cookieCream.position.set(0.71, 0.36, 0.36);
    bodyBounceGroup.add(plate, plateRim, flan, glaze, cookie1, cookieCream);
  } else if (mountId === 'mount_mochi_bunny') {
    // 🐰 กระต่ายโมจิซ้อนก้อนเมฆ (Stacked Mochi Bunny)
    saddleY = 0.9;
    kind = 'jelly';
    const mochiMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.38,
      sheen: 0.85,
    });
    const leafGreenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45 });
    const bottomMochi = new THREE.Mesh(new THREE.SphereGeometry(0.72, 22, 18), mochiMat);
    bottomMochi.scale.set(1.22, 0.68, 1.08);
    bottomMochi.position.y = 0.46;
    bottomMochi.castShadow = true;
    const frontHeadMochi = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 16), mochiMat);
    frontHeadMochi.scale.set(1.08, 0.78, 1.02);
    frontHeadMochi.position.set(0.55, 0.78, 0);
    bodyBounceGroup.add(bottomMochi, frontHeadMochi);
    [-0.18, 0.18].forEach((ez) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), darkEyeMat);
      eye.position.set(0.95, 0.82, ez);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), pinkBlushMat);
      cheek.position.set(0.92, 0.73, ez * 1.45);
      const leafEar = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), leafGreenMat);
      leafEar.scale.set(0.65, 0.35, 1.45);
      leafEar.position.set(0.52, 1.12, ez * 1.25);
      leafEar.rotation.x = ez < 0 ? -0.35 : 0.35;
      bodyBounceGroup.add(eye, cheek, leafEar);
    });
  } else if (mountId === 'mount_unicorn') {
    // 🦄 ยูนิคอร์นขาวพาสเทลศักดิ์สิทธิ์ (Pastel White Unicorn)
    saddleY = 1.08;
    kind = 'gallop';
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.62, 12, 18), whiteMat);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.78, 0);
    body.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.58, 14), whiteMat);
    neck.position.set(0.58, 1.12, 0);
    neck.rotation.z = -0.35;
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.26, 10, 14), whiteMat);
    head.rotation.z = Math.PI / 2 + 0.22;
    head.position.set(0.82, 1.38, 0);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.42, 10), goldMat);
    horn.position.set(0.98, 1.68, 0);
    horn.rotation.z = -0.65;
    bodyBounceGroup.add(body, neck, head, horn);

    [-0.16, 0.16].forEach((ez) => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x7c3aed })
      );
      eye.position.set(0.92, 1.44, ez);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 8), whiteMat);
      ear.position.set(0.68, 1.58, ez);
      bodyBounceGroup.add(eye, ear);
    });

    // แผงคอและหางสีรุ้งพาสเทล + อานขอบทอง
    const pastelColors = [0xf472b6, 0x38bdf8, 0xfde047, 0xc084fc];
    pastelColors.forEach((col, ci) => {
      const pMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 });
      const manePuff = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), pMat);
      manePuff.position.set(0.56 - ci * 0.08, 1.48 - ci * 0.13, 0);
      const tailStrand = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), pMat);
      tailStrand.position.set(-0.78 - ci * 0.1, 0.85 - ci * 0.1, 0);
      bodyBounceGroup.add(manePuff, tailStrand);
    });
    const saddle = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.12, 0.86),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 })
    );
    saddle.position.set(-0.04, 1.16, 0);
    bodyBounceGroup.add(saddle);

    makeQuadLegs(whiteMat, goldMat, 0.1, 0.52, 0.46, 0.26, 0.52);
  } else if (mountId === 'mount_gacha_pink_bear') {
    // 🐻 หมีชมพูคอปเตอร์ไม้ไผ่ลอยฟ้า (Epic Gachapon)
    saddleY = 0.94;
    kind = 'hover';
    const bearPinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.48 });
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.58, 20, 18), bearPinkMat);
    torso.scale.set(1.26, 0.88, 1.04);
    torso.position.set(0, 0.62, 0);
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 16), bearPinkMat);
    head.position.set(0.68, 0.82, 0);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), creamMat);
    muzzle.position.set(1.04, 0.76, 0);
    bodyBounceGroup.add(torso, head, muzzle);
    [-0.24, 0.24].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), bearPinkMat);
      ear.position.set(0.64, 1.18, ez * 1.15);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), darkEyeMat);
      eye.position.set(1.02, 0.9, ez * 0.85);
      const stubPaw = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), bearPinkMat);
      stubPaw.position.set(0.35, 0.34, ez * 1.8);
      bodyBounceGroup.add(ear, eye, stubPaw);
    });

    // คอปเตอร์ไม้ไผ่หมุนติ้วบนหัวหมีชมพู
    const propGroup = new THREE.Group();
    propGroup.position.set(0.68, 1.28, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8), goldMat);
    mast.position.y = 0.06;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.025, 0.1), goldMat);
    blade.position.y = 0.16;
    propGroup.add(mast, blade);
    bodyBounceGroup.add(propGroup);
    spinPart = propGroup;
  } else if (mountId === 'mount_gacha_red_dragon') {
    // 🐉 มังกรแดงจิบิติดปีก (Legendary Gachapon)
    saddleY = 1.04;
    kind = 'fly';
    const dragonRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42 });
    const wingMembraneMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.54, 20, 18), dragonRedMat);
    body.scale.set(1.36, 0.88, 0.98);
    body.position.set(0, 0.76, 0);
    body.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), creamMat);
    belly.scale.set(1.25, 0.55, 0.85);
    belly.position.set(0.08, 0.56, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.52), dragonRedMat);
    head.position.set(0.78, 1.02, 0);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 10), dragonRedMat);
    tail.rotation.z = Math.PI / 2 + 0.25;
    tail.position.set(-0.92, 0.78, 0);
    bodyBounceGroup.add(body, belly, head, tail);

    [-0.2, 0.2].forEach((ez) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.34, 8), goldMat);
      horn.position.set(0.68, 1.35, ez);
      horn.rotation.z = 0.35;
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      eye.position.set(1.06, 1.08, ez * 0.85);
      bodyBounceGroup.add(horn, eye);
    });

    // ปีกมังกรซ้าย-ขวากระพือบิน
    const makeDragonWing = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.05, 1.02, side * 0.42);
      const wingBlade = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.05, 4), wingMembraneMat);
      wingBlade.scale.set(0.85, 1, 0.16);
      wingBlade.rotation.x = side * (Math.PI / 2 - 0.25);
      wingBlade.position.set(-0.08, 0.18, side * 0.46);
      pivot.add(wingBlade);
      bodyBounceGroup.add(pivot);
      return pivot;
    };
    wingL = makeDragonWing(-1);
    wingR = makeDragonWing(1);
    makeQuadLegs(dragonRedMat, goldMat, 0.11, 0.32, 0.42, 0.32, 0.48);
  } else if (mountId === 'mount_gacha_ufo') {
    // 🛸 จานบิน UFO ลำแสงนีออน (Legendary Gachapon)
    saddleY = 0.84;
    kind = 'hover';
    const silverHull = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.78, roughness: 0.22 });
    const darkRim = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.15, 0.26, 28), silverHull);
    disc.position.y = 0.62;
    disc.castShadow = true;
    const lowerDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.55, 0.18, 28), darkRim);
    lowerDisc.position.y = 0.4;
    const glassCockpitRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.065, 12, 28),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    glassCockpitRim.rotation.x = Math.PI / 2;
    glassCockpitRim.position.y = 0.76;
    const tractorBeam = new THREE.Mesh(
      new THREE.ConeGeometry(0.78, 0.55, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
      })
    );
    tractorBeam.position.y = 0.26;
    bodyBounceGroup.add(disc, lowerDisc, glassCockpitRim, tractorBeam);

    const lightsRing = new THREE.Group();
    lightsRing.position.y = 0.52;
    const neonCols = [0x38bdf8, 0xf472b6, 0xfacc15, 0x4ade80];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 10, 10),
        new THREE.MeshBasicMaterial({ color: neonCols[i % neonCols.length] })
      );
      bulb.position.set(Math.cos(a) * 1.06, 0, Math.sin(a) * 1.06);
      lightsRing.add(bulb);
    }
    bodyBounceGroup.add(lightsRing);
    spinPart = lightsRing;
  } else {
    return null;
  }

  return {
    mountId,
    mountGroup,
    bodyBounceGroup,
    saddleY,
    kind,
    legFL,
    legFR,
    legBL,
    legBR,
    wingL,
    wingR,
    spinPart,
  };
}

/**
 * แอนิเมชันการขี่สัตว์แต่ละประเภท และคืนค่าความสูงที่ตัวละครต้องขยับขึ้นลงตามหลังสัตว์ขี่
 */
export function animateMountFrame(
  mount: MountMeshParts,
  elapsed: number,
  idx: number,
  isMoving: boolean
): number {
  const speed = isMoving ? 10.5 : 3.6;
  const t = elapsed * speed + idx * 0.8;

  if (mount.spinPart) {
    mount.spinPart.rotation.y = elapsed * 9.5;
  }

  if (mount.kind === 'gallop') {
    const hop = isMoving ? Math.abs(Math.sin(t)) * 0.16 : Math.sin(t) * 0.03;
    const pitch = isMoving ? Math.cos(t) * 0.08 : 0;
    mount.bodyBounceGroup.position.y = hop;
    mount.bodyBounceGroup.rotation.z = pitch;
    const legAmp = isMoving ? 0.65 : 0.08;
    if (mount.legFL) mount.legFL.rotation.z = Math.sin(t) * legAmp;
    if (mount.legFR) mount.legFR.rotation.z = Math.sin(t + 0.5) * legAmp;
    if (mount.legBL) mount.legBL.rotation.z = -Math.sin(t) * legAmp;
    if (mount.legBR) mount.legBR.rotation.z = -Math.sin(t + 0.5) * legAmp;
    return hop;
  }

  if (mount.kind === 'fly') {
    const hover = 0.18 + Math.sin(t * 0.85) * 0.14;
    mount.bodyBounceGroup.position.y = hover;
    mount.bodyBounceGroup.rotation.z = isMoving ? -0.06 + Math.cos(t * 0.85) * 0.05 : 0;
    const flap = Math.sin(elapsed * 9.5 + idx) * 0.55;
    if (mount.wingL) mount.wingL.rotation.x = -flap;
    if (mount.wingR) mount.wingR.rotation.x = flap;
    if (mount.legFL) mount.legFL.rotation.z = -0.35;
    if (mount.legFR) mount.legFR.rotation.z = -0.35;
    if (mount.legBL) mount.legBL.rotation.z = 0.35;
    if (mount.legBR) mount.legBR.rotation.z = 0.35;
    return hover;
  }

  if (mount.kind === 'jelly') {
    const rawSin = Math.sin(t * 0.9);
    const hop = isMoving ? Math.max(0, rawSin) * 0.24 : (rawSin + 1) * 0.03;
    const sq = isMoving ? -rawSin * 0.13 : -rawSin * 0.05;
    mount.bodyBounceGroup.position.y = hop;
    mount.bodyBounceGroup.scale.set(1 + sq, 1 - sq * 1.15, 1 + sq);
    return hop - sq * 0.22;
  }

  // hover (cloud / sunny egg / pink bear / UFO)
  const floatY = 0.1 + Math.sin(elapsed * 3.4 + idx) * 0.1;
  mount.bodyBounceGroup.position.y = floatY;
  mount.bodyBounceGroup.rotation.z = isMoving ? -0.05 + Math.sin(elapsed * 4 + idx) * 0.03 : 0;
  return floatY;
}
