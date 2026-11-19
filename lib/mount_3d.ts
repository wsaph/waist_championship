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
  } else if (mountId === 'mount_skateboard') {
    // 🛹 สเก็ตบอร์ดไฟนีออน
    saddleY = 0.42;
    kind = 'hover';
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 });
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const neonPink = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.09, 0.56), deckMat);
    deck.position.y = 0.3;
    deck.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.1, 0.18), neonCyan);
    stripe.position.y = 0.3;
    [-0.78, 0.78].forEach((tx) => {
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.09, 14), deckMat);
      tip.position.set(tx, 0.33, 0);
      tip.rotation.z = tx > 0 ? 0.24 : -0.24;
      bodyBounceGroup.add(tip);
    });
    const underGlow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.42), neonPink);
    underGlow.position.y = 0.24;
    bodyBounceGroup.add(deck, stripe, underGlow);
    [-0.5, 0.5].forEach((wx) => {
      [-0.28, 0.28].forEach((wz) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 12), neonPink);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, 0.14, wz);
        bodyBounceGroup.add(wheel);
      });
    });
  } else if (mountId === 'mount_duck_ring') {
    // 🦆 ห่วงยางเป็ดเหลืองยักษ์
    saddleY = 0.62;
    kind = 'jelly';
    const duckYellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.32 });
    const beakOrange = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.28, 14, 24), duckYellow);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.36;
    ring.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.35, 12), duckYellow);
    neck.position.set(0.66, 0.68, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), duckYellow);
    head.position.set(0.74, 0.98, 0);
    head.castShadow = true;
    const beak = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), beakOrange);
    beak.scale.set(1.4, 0.5, 1.1);
    beak.position.set(1.06, 0.94, 0);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 10), duckYellow);
    tail.rotation.z = 0.72;
    tail.position.set(-0.92, 0.62, 0);
    bodyBounceGroup.add(ring, neck, head, beak, tail);
    [-0.16, 0.16].forEach((ez) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), darkEyeMat);
      eye.position.set(0.96, 1.05, ez);
      bodyBounceGroup.add(eye);
    });
  } else if (mountId === 'mount_donut') {
    // 🍩 โดนัทสตรอว์เบอร์รีลอยฟ้า
    saddleY = 0.58;
    kind = 'hover';
    const doughMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
    const glazeMat = new THREE.MeshPhysicalMaterial({ color: 0xf472b6, roughness: 0.22, clearcoat: 0.65 });
    const base = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.3, 16, 28), doughMat);
    base.rotation.x = Math.PI / 2;
    base.position.y = 0.42;
    base.castShadow = true;
    const glaze = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.27, 14, 28), glazeMat);
    glaze.rotation.x = Math.PI / 2;
    glaze.position.y = 0.48;
    bodyBounceGroup.add(base, glaze);
    const sprinkleCols = [0xfef08a, 0x38bdf8, 0x4ade80, 0xffffff, 0xc084fc];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 0.56 + (i % 2) * 0.2;
      const sp = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.04, 0.045),
        new THREE.MeshBasicMaterial({ color: sprinkleCols[i % sprinkleCols.length] })
      );
      sp.position.set(Math.cos(a) * r, 0.74, Math.sin(a) * r);
      sp.rotation.y = a + i;
      bodyBounceGroup.add(sp);
    }
  } else if (mountId === 'mount_tricycle') {
    // 🚲 จักรยานสามล้อวินเทจ
    saddleY = 0.84;
    kind = 'gallop';
    const frameRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.35 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const basketMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
    const frameBar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 10), frameRed);
    frameBar.rotation.z = Math.PI / 2;
    frameBar.position.set(0.08, 0.58, 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 10), frameRed);
    stem.position.set(0.64, 0.82, 0);
    stem.rotation.z = 0.18;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.76, 10), goldMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.58, 1.18, 0);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.42), basketMat);
    basket.position.set(0.84, 1.04, 0);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.42), basketMat);
    seat.position.set(-0.22, 0.76, 0);
    const frontWheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.065, 10, 20), tireMat);
    frontWheel.position.set(0.72, 0.38, 0);
    bodyBounceGroup.add(frameBar, stem, handle, basket, seat, frontWheel);
    [-0.44, 0.44].forEach((wz) => {
      const rw = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 10, 18), tireMat);
      rw.position.set(-0.46, 0.32, wz);
      bodyBounceGroup.add(rw);
    });
  } else if (mountId === 'mount_sea_turtle') {
    // 🐢 เต่าทะเลจิบิโต้คลื่น
    saddleY = 0.86;
    kind = 'hover';
    const shellGreen = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 });
    const skinLime = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.76, 20, 16), shellGreen);
    shell.scale.set(1.18, 0.65, 1.02);
    shell.position.set(0, 0.52, 0);
    shell.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.09, 10, 24), creamMat);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1.18, 1.02, 1);
    rim.position.y = 0.44;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), skinLime);
    head.position.set(0.95, 0.62, 0);
    bodyBounceGroup.add(shell, rim, head);
    [-0.14, 0.14].forEach((ez) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), darkEyeMat);
      eye.position.set(1.18, 0.68, ez);
      bodyBounceGroup.add(eye);
    });
    const makeFlipper = (side: -1 | 1, fx: number, fz: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(fx, 0.42, side * fz);
      const fin = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skinLime);
      fin.scale.set(1.25, 0.25, 0.72);
      fin.position.set(0, 0, side * 0.24);
      pivot.add(fin);
      bodyBounceGroup.add(pivot);
      return pivot;
    };
    wingL = makeFlipper(-1, 0.35, 0.56);
    wingR = makeFlipper(1, 0.35, 0.56);
    makeFlipper(-1, -0.52, 0.45);
    makeFlipper(1, -0.52, 0.45);
  } else if (mountId === 'mount_scooter') {
    // 🛴 สกู๊ตเตอร์ไฟฟ้าเทอร์โบ
    saddleY = 0.46;
    kind = 'hover';
    const bodySlate = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.35 });
    const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.1, 0.42), bodySlate);
    deck.position.y = 0.32;
    deck.castShadow = true;
    const led = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.05, 0.46), cyanGlow);
    led.position.y = 0.3;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.08, 10), bodySlate);
    stem.position.set(0.62, 0.85, 0);
    stem.rotation.z = 0.15;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 10), cyanGlow);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0.55, 1.36, 0);
    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    headlight.position.set(0.7, 1.22, 0);
    bodyBounceGroup.add(deck, led, stem, bar, headlight);
    [-0.56, 0.62].forEach((wx) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 14), bodySlate);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.18, 0);
      bodyBounceGroup.add(wheel);
    });
  } else if (mountId === 'mount_moodeng') {
    // 🦛 หมูเด้งยักษ์พุงกระเพื่อม (Viral Pygmy Hippo!)
    saddleY = 0.96;
    kind = 'jelly';
    const hippoMat = new THREE.MeshPhysicalMaterial({ color: 0x64748b, roughness: 0.18, clearcoat: 0.85 });
    const hippoBelly = new THREE.MeshPhysicalMaterial({ color: 0xfbcfe8, roughness: 0.22, clearcoat: 0.7 });
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.62, 22, 18), hippoMat);
    torso.scale.set(1.34, 0.92, 1.06);
    torso.position.set(0, 0.66, 0);
    torso.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 14), hippoBelly);
    belly.scale.set(1.18, 0.65, 0.95);
    belly.position.set(0.05, 0.45, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 16), hippoMat);
    head.scale.set(1.12, 0.94, 1.02);
    head.position.set(0.76, 0.82, 0);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), hippoBelly);
    snout.scale.set(1.1, 0.78, 1.18);
    snout.position.set(1.1, 0.72, 0);
    bodyBounceGroup.add(torso, belly, head, snout);
    [-0.22, 0.22].forEach((ez) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), darkEyeMat);
      eye.position.set(1.04, 0.94, ez);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), pinkBlushMat);
      cheek.position.set(1.06, 0.78, ez * 1.4);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), hippoBelly);
      ear.position.set(0.68, 1.2, ez * 1.1);
      bodyBounceGroup.add(eye, cheek, ear);
    });
    makeQuadLegs(hippoMat, hippoBelly, 0.14, 0.34, 0.44, 0.36, 0.38);
  } else if (mountId === 'mount_corgi') {
    // 🐕 น้องหมาคอร์กี้ขาสั้นจัมโบ้
    saddleY = 0.92;
    kind = 'gallop';
    const corgiOrange = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.44, 0.76, 12, 18), corgiOrange);
    torso.rotation.z = Math.PI / 2;
    torso.position.set(0, 0.64, 0);
    torso.castShadow = true;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), whiteMat);
    chest.position.set(0.56, 0.62, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 16), corgiOrange);
    head.position.set(0.8, 0.92, 0);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), whiteMat);
    muzzle.position.set(1.14, 0.84, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), darkEyeMat);
    nose.position.set(1.32, 0.88, 0);
    const butt = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), whiteMat);
    butt.position.set(-0.68, 0.66, 0);
    bodyBounceGroup.add(torso, chest, head, muzzle, nose, butt);
    [-0.22, 0.22].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 8), corgiOrange);
      ear.position.set(0.76, 1.32, ez * 1.15);
      ear.rotation.x = ez < 0 ? -0.25 : 0.25;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), darkEyeMat);
      eye.position.set(1.12, 0.98, ez * 0.85);
      bodyBounceGroup.add(ear, eye);
    });
    makeQuadLegs(whiteMat, corgiOrange, 0.11, 0.3, 0.46, 0.28, 0.36);
  } else if (mountId === 'mount_witch_broom') {
    // 🧹 ไม้กวาดแม่มดเรืองแสง
    saddleY = 0.66;
    kind = 'hover';
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 });
    const purpleGlow = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 2.2, 10), woodMat);
    stick.rotation.z = Math.PI / 2;
    stick.position.set(0.15, 0.56, 0);
    stick.castShadow = true;
    const bristles = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.85, 14), strawMat);
    bristles.rotation.z = -Math.PI / 2;
    bristles.position.set(-1.12, 0.56, 0);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.14, 12), purpleGlow);
    band.rotation.z = Math.PI / 2;
    band.position.set(-0.74, 0.56, 0);
    const starLantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), purpleGlow);
    starLantern.position.set(1.24, 0.48, 0);
    bodyBounceGroup.add(stick, bristles, band, starLantern);
    spinPart = starLantern;
  } else if (mountId === 'mount_blue_whale') {
    // 🐳 วาฬสีน้ำเงินพ่นน้ำพุ
    saddleY = 1.02;
    kind = 'hover';
    const whaleBlue = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
    const waterCyan = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.85 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.68, 22, 18), whaleBlue);
    body.scale.set(1.52, 0.88, 1.02);
    body.position.set(0.08, 0.68, 0);
    body.castShadow = true;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.58, 18, 14), whiteMat);
    belly.scale.set(1.42, 0.55, 0.92);
    belly.position.set(0.14, 0.44, 0);
    const tailStem = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 10), whaleBlue);
    tailStem.rotation.z = Math.PI / 2 + 0.25;
    tailStem.position.set(-1.05, 0.72, 0);
    [-0.36, 0.36].forEach((fz) => {
      const fluke = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), whaleBlue);
      fluke.scale.set(0.8, 0.22, 1.45);
      fluke.position.set(-1.35, 0.82, fz);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), darkEyeMat);
      eye.position.set(0.95, 0.66, fz * 1.25);
      bodyBounceGroup.add(fluke, eye);
    });
    const spout = new THREE.Group();
    spout.position.set(0.55, 1.26, 0);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 0.42, 10), waterCyan);
    jet.position.y = 0.2;
    spout.add(jet);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), waterCyan);
      drop.position.set(Math.cos(a) * 0.24, 0.42, Math.sin(a) * 0.24);
      spout.add(drop);
    }
    bodyBounceGroup.add(body, belly, tailStem, spout);
    spinPart = spout;
  } else if (mountId === 'mount_gokart') {
    // 🏎️ รถโกคาร์ทแชมเปี้ยนสายซิ่ง
    saddleY = 0.68;
    kind = 'gallop';
    const kartRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.28, metalness: 0.35 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.32, 0.92), kartRed);
    chassis.position.set(0.05, 0.36, 0);
    chassis.castShadow = true;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.64), kartRed);
    nose.position.set(1.02, 0.32, 0);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, 0.22), goldMat);
    stripe.position.set(0.18, 0.37, 0);
    const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 1.06), goldMat);
    spoilerWing.position.set(-0.78, 0.84, 0);
    const steering = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16), tireMat);
    steering.rotation.y = Math.PI / 2;
    steering.position.set(0.56, 0.72, 0);
    bodyBounceGroup.add(chassis, nose, stripe, spoilerWing, steering);
    [-0.58, 0.68].forEach((wx) => {
      [-0.54, 0.54].forEach((wz) => {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 14), tireMat);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(wx, 0.22, wz);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 10), goldMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(wx, 0.22, wz);
        bodyBounceGroup.add(tire, rim);
      });
    });
  } else if (mountId === 'mount_trex') {
    // 🦖 ทีเร็กซ์จิบิขาสั้นวิ่งดุ๊กดิ๊ก
    saddleY = 1.04;
    kind = 'gallop';
    const dinoGreen = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.45 });
    const spikeOrange = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.56, 20, 16), dinoGreen);
    body.scale.set(1.32, 0.94, 0.98);
    body.position.set(0, 0.72, 0);
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.52, 0.54), dinoGreen);
    head.position.set(0.78, 1.18, 0);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.48), creamMat);
    jaw.position.set(0.84, 0.88, 0);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.95, 10), dinoGreen);
    tail.rotation.z = Math.PI / 2 + 0.18;
    tail.position.set(-0.92, 0.74, 0);
    bodyBounceGroup.add(body, head, jaw, tail);
    [-0.22, 0.22].forEach((ez) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), darkEyeMat);
      eye.position.set(1.06, 1.28, ez);
      const tinyArm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.1), dinoGreen);
      tinyArm.position.set(0.58, 0.68, ez * 1.6);
      bodyBounceGroup.add(eye, tinyArm);
    });
    for (let s = 0; s < 4; s++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), spikeOrange);
      sp.position.set(0.55 - s * 0.35, 1.46 - s * 0.12, 0);
      bodyBounceGroup.add(sp);
    }
    makeQuadLegs(dinoGreen, spikeOrange, 0.15, 0.44, 0.22, 0.34, 0.48);
  } else if (mountId === 'mount_rocket_shark') {
    // 🦈 ฉลามขาวติดไอพ่นจรวด
    saddleY = 0.94;
    kind = 'hover';
    const sharkGray = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.2 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 1.05, 12, 18), sharkGray);
    body.rotation.z = Math.PI / 2;
    body.position.set(0.08, 0.68, 0);
    body.castShadow = true;
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.92, 10, 14), whiteMat);
    belly.rotation.z = Math.PI / 2;
    belly.position.set(0.12, 0.5, 0);
    const dorsalFin = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.56, 6), sharkGray);
    dorsalFin.rotation.z = 0.35;
    dorsalFin.position.set(-0.08, 1.24, 0);
    const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.68, 6), sharkGray);
    tailFin.scale.set(0.85, 1, 0.22);
    tailFin.position.set(-1.08, 0.72, 0);
    bodyBounceGroup.add(body, belly, dorsalFin, tailFin);
    [-0.56, 0.56].forEach((tz) => {
      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.62, 12), goldMat);
      thruster.rotation.z = Math.PI / 2;
      thruster.position.set(-0.18, 0.64, tz);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.46, 8), flameMat);
      flame.rotation.z = Math.PI / 2;
      flame.position.set(-0.68, 0.64, tz);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), darkEyeMat);
      eye.position.set(0.88, 0.78, tz * 0.58);
      bodyBounceGroup.add(thruster, flame, eye);
    });
  } else if (mountId === 'mount_gold_pegasus') {
    // 🐎 เพกาซัสทองคำติดปีกนางฟ้า
    saddleY = 1.12;
    kind = 'fly';
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.64, 12, 18), goldMat);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.8, 0);
    body.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.6, 14), goldMat);
    neck.position.set(0.58, 1.15, 0);
    neck.rotation.z = -0.35;
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.26, 10, 14), goldMat);
    head.rotation.z = Math.PI / 2 + 0.22;
    head.position.set(0.82, 1.42, 0);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 20), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0.8, 1.78, 0);
    bodyBounceGroup.add(body, neck, head, halo);
    const wingWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef08a, emissiveIntensity: 0.25, roughness: 0.25 });
    const makeAngelWing = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.08, 1.08, side * 0.38);
      for (let w = 0; w < 3; w++) {
        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.15 - w * 0.18, 8), w % 2 === 0 ? wingWhite : goldMat);
        feather.rotation.x = side * (Math.PI / 2 - 0.15 - w * 0.12);
        feather.position.set(-0.12 * w, 0.15 + w * 0.08, side * (0.48 + w * 0.16));
        pivot.add(feather);
      }
      bodyBounceGroup.add(pivot);
      return pivot;
    };
    wingL = makeAngelWing(-1);
    wingR = makeAngelWing(1);
    makeQuadLegs(goldMat, whiteMat, 0.1, 0.52, 0.46, 0.26, 0.54);
  } else if (mountId === 'mount_gacha_banana_boat') {
    // 🍌 เรือกล้วยบานาน่าโบ๊ท (Rare Gachapon)
    saddleY = 0.62;
    kind = 'hover';
    const bananaMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.28 });
    const tipDark = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.7 });
    const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.38, 12, 18), bananaMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0, 0.42, 0);
    tube.castShadow = true;
    const tipF = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 10), tipDark);
    tipF.rotation.z = -Math.PI / 2 + 0.35;
    tipF.position.set(1.04, 0.56, 0);
    const tipB = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.38, 10), tipDark);
    tipB.rotation.z = Math.PI / 2 - 0.35;
    tipB.position.set(-1.02, 0.54, 0);
    bodyBounceGroup.add(tube, tipF, tipB);
    [-0.46, 0.46].forEach((pz) => {
      const pontoon = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.05, 8, 12), bananaMat);
      pontoon.rotation.z = Math.PI / 2;
      pontoon.position.set(0, 0.24, pz);
      bodyBounceGroup.add(pontoon);
    });
  } else if (mountId === 'mount_gacha_butter_toast') {
    // 🍞 ขนมปังปิ้งทาเนยลอยฟ้า (Rare Gachapon)
    saddleY = 0.56;
    kind = 'hover';
    const crustMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.72 });
    const crumbMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.78 });
    const butterMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.25 });
    const crust = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.22, 1.32), crustMat);
    crust.position.y = 0.38;
    crust.castShadow = true;
    const crumb = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.24, 1.14), crumbMat);
    crumb.position.y = 0.39;
    const butter = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), butterMat);
    butter.position.set(0.12, 0.54, 0);
    butter.rotation.y = 0.38;
    bodyBounceGroup.add(crust, crumb, butter);
  } else if (mountId === 'mount_gacha_pepe_frog') {
    // 🐸 กบอ้วนเปเป้กระโดดดึ๋ง (Rare Gachapon)
    saddleY = 0.92;
    kind = 'jelly';
    const frogGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.42 });
    const padGreen = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.55 });
    const lilyPad = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 22), padGreen);
    lilyPad.position.y = 0.12;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.64, 20, 16), frogGreen);
    body.scale.set(1.22, 0.82, 1.08);
    body.position.set(0, 0.56, 0);
    body.castShadow = true;
    const lips = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.56), new THREE.MeshStandardMaterial({ color: 0xfb7185 }));
    lips.position.set(0.76, 0.54, 0);
    bodyBounceGroup.add(lilyPad, body, lips);
    [-0.24, 0.24].forEach((ez) => {
      const eyeBump = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), whiteMat);
      eyeBump.position.set(0.48, 1.06, ez);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), darkEyeMat);
      pupil.position.set(0.62, 1.08, ez);
      bodyBounceGroup.add(eyeBump, pupil);
    });
  } else if (mountId === 'mount_gacha_cat_bus') {
    // 🐱 รถบัสน้องแมวเหมียว (Epic Gachapon)
    saddleY = 1.1;
    kind = 'gallop';
    const catOrange = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.48 });
    const stripeBrown = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.55 });
    const windowGlow = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const busBody = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.68, 0.92), catOrange);
    busBody.position.set(0, 0.72, 0);
    busBody.castShadow = true;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 14), catOrange);
    face.scale.set(0.85, 0.95, 1.12);
    face.position.set(0.88, 0.76, 0);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.78, 8, 12), stripeBrown);
    tail.rotation.z = 0.65;
    tail.position.set(-1.12, 0.92, 0);
    bodyBounceGroup.add(busBody, face, tail);
    [-0.42, 0, 0.42].forEach((wx) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.96), windowGlow);
      win.position.set(wx, 0.78, 0);
      bodyBounceGroup.add(win);
    });
    [-0.24, 0.24].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 8), stripeBrown);
      ear.position.set(0.84, 1.24, ez * 1.1);
      const headlightEye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), windowGlow);
      headlightEye.position.set(1.22, 0.84, ez * 0.95);
      bodyBounceGroup.add(ear, headlightEye);
    });
    makeQuadLegs(catOrange, stripeBrown, 0.11, 0.4, 0.56, 0.36, 0.44);
  } else if (mountId === 'mount_gacha_magic_carpet') {
    // 🧞 พรมวิเศษอะลาดินลอยลม (Epic Gachapon)
    saddleY = 0.56;
    kind = 'hover';
    const carpetPurple = new THREE.MeshStandardMaterial({ color: 0x7c3AED, roughness: 0.55 });
    const carpetRed = new THREE.MeshStandardMaterial({ color: 0xdb2777, roughness: 0.5 });
    const mainMat = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 1.16), carpetPurple);
    mainMat.position.y = 0.42;
    mainMat.castShadow = true;
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.095, 0.82), carpetRed);
    inner.position.y = 0.42;
    const goldBorder = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.09, 0.98), goldMat);
    goldBorder.position.y = 0.42;
    bodyBounceGroup.add(mainMat, goldBorder, inner);
    [-0.86, 0.86].forEach((tx) => {
      [-0.58, 0.58].forEach((tz) => {
        const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 8), goldMat);
        tassel.position.set(tx, 0.32, tz);
        bodyBounceGroup.add(tassel);
      });
    });
  } else if (mountId === 'mount_gacha_phoenix') {
    // 🔥 นกฟีนิกซ์เพลิงอมตะ (Legendary Gachapon)
    saddleY = 1.06;
    kind = 'fly';
    const fireRed = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.35, roughness: 0.3 });
    const fireOrange = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.45, roughness: 0.28 });
    const fireYellow = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 16), fireRed);
    body.scale.set(1.38, 0.86, 0.92);
    body.position.set(0, 0.78, 0);
    body.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.54, 12), fireOrange);
    neck.position.set(0.62, 1.1, 0);
    neck.rotation.z = -0.35;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), fireRed);
    head.position.set(0.84, 1.38, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), goldMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(1.16, 1.36, 0);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), fireYellow);
    crest.rotation.z = 0.45;
    crest.position.set(0.76, 1.66, 0);
    bodyBounceGroup.add(body, neck, head, beak, crest);
    for (let t = 0; t < 3; t++) {
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.15, 8), t % 2 === 0 ? fireOrange : fireYellow);
      plume.rotation.z = Math.PI / 2 + 0.15;
      plume.position.set(-1.12, 0.8 + (t - 1) * 0.12, (t - 1) * 0.24);
      bodyBounceGroup.add(plume);
    }
    const makeFireWing = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.06, 1.02, side * 0.38);
      for (let w = 0; w < 4; w++) {
        const feather = new THREE.Mesh(
          new THREE.ConeGeometry(0.22, 1.32 - w * 0.16, 8),
          w % 2 === 0 ? fireOrange : fireYellow
        );
        feather.rotation.x = side * (Math.PI / 2 - 0.15 - w * 0.1);
        feather.position.set(-0.14 * w, 0.16 + w * 0.06, side * (0.52 + w * 0.16));
        pivot.add(feather);
      }
      bodyBounceGroup.add(pivot);
      return pivot;
    };
    wingL = makeFireWing(-1);
    wingR = makeFireWing(1);
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
