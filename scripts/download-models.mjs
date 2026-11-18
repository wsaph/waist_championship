#!/usr/bin/env node
/**
 * ดาวน์โหลดโมเดล 3D (.glb) แบบ Open-Source (CC0 1.0 Public Domain)
 * จาก GitHub Repository สาธารณะของ Kenney, Quaternius และ KayKit
 * ลงในโฟลเดอร์ public/models/ พร้อมตรวจสอบความถูกต้องของไฟล์ GLB และ Animation
 *
 * วิธีรัน:
 *   node scripts/download-models.mjs
 *   หรือ npm run download-models
 *   (ใส่ --force หากต้องการดาวน์โหลดทับไฟล์เดิมทั้งหมด)
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODELS_DIR = path.resolve(__dirname, '..', 'public', 'models');
const FORCE_DOWNLOAD = process.argv.includes('--force');

const KENNEY_BASE = 'https://raw.githubusercontent.com/shorepine/kenney/main/3d';
const QUATERNIUS_BASE = 'https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb';
const KAYKIT_BASE =
  'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf';

/**
 * รายการโมเดล .glb ทั้งหมด (CC0 1.0 Public Domain)
 * ครอบคลุม:
 *  1) Cute Chibi Animated Animals หลัก 5 ตัว (จิ้งจอก, กระต่าย, หมี, แมว, หมู) + สัตว์สายพันธุ์อื่นๆ ในเกม
 *  2) Chibi RPG / Animal Knight สำเร็จรูป (Knight, Mage/Princess, Rogue/Ranger, Barbarian + อาวุธ/โล่/หมวกเกราะ)
 */
const MODEL_MANIFEST = [
  // ============================================================================
  // 1. Cute Chibi Animated Animals — 5 ตัวหลัก (จิ้งจอก, กระต่าย, หมี, แมว, หมู)
  // ============================================================================
  {
    file: 'fox.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'จิ้งจอกจิบิ (Animated: idle, walk, run, eat, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-fox.glb`,
  },
  {
    file: 'bunny.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'กระต่ายจิบิ (Animated: idle, walk, run, eat, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-bunny.glb`,
  },
  {
    file: 'bear.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'หมีจิบิ (Animated: idle, walk, run, eat, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-polar.glb`,
  },
  {
    file: 'cat.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'แมวจิบิ (Animated: idle, walk, run, eat, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-cat.glb`,
  },
  {
    file: 'pig.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'หมูจิบิ (Animated: idle, walk, run, eat, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-pig.glb`,
  },

  // ============================================================================
  // 1B. Cute Chibi Casual Shirts & Pants Outfits (Kenney CC0 Mini-Characters — ไม่ใช่ชุดเกราะต่อสู้)
  // ============================================================================
  {
    file: 'outfit_sport_a.glb',
    category: 'Chibi Casual Outfit',
    source: 'Kenney CC0 (Mini Characters)',
    desc: 'เสื้อยืดสปอร์ต & กางเกงวอร์ม (idle, walk, sprint, sit, emote-yes)',
    url: `${KENNEY_BASE}/mini-characters/character-male-a.glb`,
  },
  {
    file: 'outfit_hoodie_b.glb',
    category: 'Chibi Casual Outfit',
    source: 'Kenney CC0 (Mini Characters)',
    desc: 'เสื้อฮู้ดดี้แจ็คเก็ต & กางเกงยีนส์ (idle, walk, sprint, sit)',
    url: `${KENNEY_BASE}/mini-characters/character-male-b.glb`,
  },
  {
    file: 'outfit_casual_c.glb',
    category: 'Chibi Casual Outfit',
    source: 'Kenney CC0 (Mini Characters)',
    desc: 'เสื้อสเวตเตอร์ไหมพรม & กางเกงขายาว (idle, walk, sprint, sit)',
    url: `${KENNEY_BASE}/mini-characters/character-male-c.glb`,
  },
  {
    file: 'outfit_street_d.glb',
    category: 'Chibi Casual Outfit',
    source: 'Kenney CC0 (Mini Characters)',
    desc: 'ชุดวอร์มแทร็กสูทแชมเปี้ยน (idle, walk, sprint, sit)',
    url: `${KENNEY_BASE}/mini-characters/character-male-d.glb`,
  },
  {
    file: 'outfit_cute_top_a.glb',
    category: 'Chibi Casual Outfit',
    source: 'Kenney CC0 (Mini Characters)',
    desc: 'เสื้อครอปสดใส & กระโปรงเทนนิส (idle, walk, sprint, sit)',
    url: `${KENNEY_BASE}/mini-characters/character-female-a.glb`,
  },
  {
    file: 'outfit_pastel_b.glb',
    category: 'Chibi Casual Outfit',
    source: 'Kenney CC0 (Mini Characters)',
    desc: 'เสื้อคาดิแกนพาสเทล & กางเกงลำลอง (idle, walk, sprint, sit)',
    url: `${KENNEY_BASE}/mini-characters/character-female-b.glb`,
  },
  {
    file: 'outfit_dress_c.glb',
    category: 'Chibi Casual Outfit',
    source: 'Kenney CC0 (Mini Characters)',
    desc: 'ชุดเดรสเที่ยวคาเฟ่วันสบายๆ (idle, walk, sprint, sit)',
    url: `${KENNEY_BASE}/mini-characters/character-female-c.glb`,
  },
  {
    file: 'outfit_active_d.glb',
    category: 'Chibi Casual Outfit',
    source: 'Kenney CC0 (Mini Characters)',
    desc: 'เสื้อกั๊กแคมป์ปิ้ง & กางเกงขาสั้นแอคทีฟ (idle, walk, sprint, sit)',
    url: `${KENNEY_BASE}/mini-characters/character-female-d.glb`,
  },

  // ============================================================================
  // 2. Chibi RPG / Animal Knight Base Characters & Fantasy Equipment
  // ============================================================================
  {
    file: 'rpg_knight.glb',
    category: 'Chibi RPG Hero',
    source: 'KayKit CC0 (Adventurers)',
    desc: 'อัศวินจิบิ RPG พร้อมชุดเกราะ หมวกเกราะ ผ้าคลุม ดาบ & โล่ (76 Animations)',
    url: `${KAYKIT_BASE}/Knight.glb`,
  },
  {
    file: 'rpg_mage.glb',
    category: 'Chibi RPG Hero',
    source: 'KayKit CC0 (Adventurers)',
    desc: 'จอมเวทย์/เจ้าหญิงจิบิ RPG พร้อมชุดคลุม คทา & ตำราเวทย์ (76 Animations)',
    url: `${KAYKIT_BASE}/Mage.glb`,
  },
  {
    file: 'rpg_rogue.glb',
    category: 'Chibi RPG Hero',
    source: 'KayKit CC0 (Adventurers)',
    desc: 'เรนเจอร์/นักผจญภัยจิบิ RPG พร้อมเสื้อกั๊ก ฮู้ด & หน้าไม้ (76 Animations)',
    url: `${KAYKIT_BASE}/Rogue_Hooded.glb`,
  },
  {
    file: 'rpg_barbarian.glb',
    category: 'Chibi RPG Hero',
    source: 'KayKit CC0 (Adventurers)',
    desc: 'นักรบจอมพลังจิบิ RPG พร้อมขวาน โล่ & แก้วเครื่องดื่ม (76 Animations)',
    url: `${KAYKIT_BASE}/Barbarian.glb`,
  },
  {
    file: 'chibi_bunny_hero.glb',
    category: 'Chibi Animal Hero',
    source: 'Quaternius CC0 (Platformer)',
    desc: 'ตัวละครสัตว์จิบิยืน 2 ขา (Animated: Idle, Run, Walk, Jump, Wave)',
    url: `${QUATERNIUS_BASE}/platformer_game_pack/Character.glb`,
  },
  {
    file: 'quaternius_knight.glb',
    category: 'RPG Fantasy Hero',
    source: 'Quaternius CC0 (Knight Pack)',
    desc: 'อัศวินแฟนตาซี Quaternius (Animated: Idle, Run, Jump, Roll)',
    url: `${QUATERNIUS_BASE}/single_knight_pack/KnightCharacter.glb`,
  },
  {
    file: 'kenney_arena_knight.glb',
    category: 'RPG Arena Hero',
    source: 'Kenney CC0 (Mini Arena)',
    desc: 'ทหารอัศวินอารีน่าจิบิ Kenney (Animated: idle, walk, sprint, sit)',
    url: `${KENNEY_BASE}/mini-arena/character-soldier.glb`,
  },
  {
    file: 'rpg_sword_gold.glb',
    category: 'RPG Fantasy Gear',
    source: 'Quaternius CC0 (Medieval Weapons)',
    desc: 'ดาบทองคำมหาเทพ (Golden RPG Sword)',
    url: `${QUATERNIUS_BASE}/medieval_weapons_pack/Sword_Golden.glb`,
  },
  {
    file: 'rpg_shield_gold.glb',
    category: 'RPG Fantasy Gear',
    source: 'Quaternius CC0 (Medieval Weapons)',
    desc: 'โล่ทองคำอัศวิน (Golden Celtic Shield)',
    url: `${QUATERNIUS_BASE}/medieval_weapons_pack/Shield_Celtic_Golden.glb`,
  },
  {
    file: 'rpg_helmet_knight.glb',
    category: 'RPG Fantasy Gear',
    source: 'Quaternius CC0 (Knight Pack)',
    desc: 'หมวกเกราะอัศวิน (Knight Helmet)',
    url: `${QUATERNIUS_BASE}/single_knight_pack/Helmet1.glb`,
  },

  // ============================================================================
  // 3. Additional Animated Animals (Quaternius & Kenney) สำหรับสายพันธุ์และสัตว์เลี้ยงในเกม
  // ============================================================================
  {
    file: 'fox_hero.glb',
    category: 'Animated Animal',
    source: 'Quaternius CC0 (Animals Pack)',
    desc: 'จิ้งจอกป่า Quaternius (Gallop, Walk, Idle, Eating)',
    url: `${QUATERNIUS_BASE}/animals_pack/Fox.glb`,
  },
  {
    file: 'bunny_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'กระต่ายฮีโร่/สัตว์เลี้ยง (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-bunny.glb`,
  },
  {
    file: 'bear_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'หมีฮีโร่/สัตว์เลี้ยง (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-polar.glb`,
  },
  {
    file: 'cat_pet.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'แมวส้ม/เหมียวสัตว์เลี้ยง (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-cat.glb`,
  },
  {
    file: 'pig_pet.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'หมูจิ๋วสัตว์เลี้ยง (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-pig.glb`,
  },
  {
    file: 'corgi_pet.glb',
    category: 'Animated Animal',
    source: 'Quaternius CC0 (Animals Pack)',
    desc: 'ชิบะ/คอร์กี้สัตว์เลี้ยง (Gallop, Walk, Idle)',
    url: `${QUATERNIUS_BASE}/animals_pack/ShibaInu.glb`,
  },
  {
    file: 'dog_chibi.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'สุนัขจิบิ (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-dog.glb`,
  },
  {
    file: 'husky_hero.glb',
    category: 'Animated Animal',
    source: 'Quaternius CC0 (Animals Pack)',
    desc: 'ไซบีเรียนฮัสกี้ (Gallop, Walk, Idle)',
    url: `${QUATERNIUS_BASE}/animals_pack/Husky.glb`,
  },
  {
    file: 'alpaca_hero.glb',
    category: 'Animated Animal',
    source: 'Quaternius CC0 (Animals Pack)',
    desc: 'อัลปาก้าขนฟู (Gallop, Walk, Idle)',
    url: `${QUATERNIUS_BASE}/animals_pack/Alpaca.glb`,
  },
  {
    file: 'frog_hero.glb',
    category: 'Animated Animal',
    source: 'Quaternius CC0 (Easy Enemies)',
    desc: 'กบเด้งดึ๋ง (Frog_Jump, Frog_Idle)',
    url: `${QUATERNIUS_BASE}/easy_enemies_pack/Frog.glb`,
  },
  {
    file: 'panda_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'แพนด้ายักษ์จิบิ (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-panda.glb`,
  },
  {
    file: 'monkey_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'ลิงจ๋อจิบิ (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-monkey.glb`,
  },
  {
    file: 'capybara_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'คาปิบาร่าจิบิ (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-beaver.glb`,
  },
  {
    file: 'cow_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'วัวนมจิบิ (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-cow.glb`,
  },
  {
    file: 'duck_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'เป็ดอ้วนจิบิ (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-chick.glb`,
  },
  {
    file: 'seal_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'แมวน้ำ/เพนกวินจิบิ (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-penguin.glb`,
  },
  {
    file: 'hamster_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'แฮมสเตอร์/โคอาล่าจิบิ (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-koala.glb`,
  },
  {
    file: 'tiger_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'เสือน้อยเบงกอลจิบิ (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-tiger.glb`,
  },
  {
    file: 'lion_hero.glb',
    category: 'Cute Chibi Animal',
    source: 'Kenney CC0 (Cube Pets)',
    desc: 'สิงโต/เมนคูนจิบิ (idle, walk, run, dance)',
    url: `${KENNEY_BASE}/cube-pets/animal-lion.glb`,
  },
];

const textureCache = new Map();

async function fetchExternalTexture(texUrl) {
  if (textureCache.has(texUrl)) return textureCache.get(texUrl);
  const p = (async () => {
    const r = await fetch(texUrl, {
      headers: { 'User-Agent': 'waist-championship-model-downloader/1.0' },
    });
    if (!r.ok) {
      throw new Error(`โหลด Texture ไม่สำเร็จ (${r.status}): ${texUrl}`);
    }
    return Buffer.from(await r.arrayBuffer());
  })();
  textureCache.set(texUrl, p);
  return p;
}

function parseGlbInfo(buffer) {
  if (buffer.length < 20) {
    throw new Error(`ไฟล์ขนาดเล็กผิดปกติ (${buffer.length} bytes)`);
  }
  const magic = buffer.toString('ascii', 0, 4);
  if (magic !== 'glTF') {
    throw new Error(`Header ไม่ใช่ไฟล์ GLB มาตรฐาน (พบ: ${JSON.stringify(magic)})`);
  }
  const jsonLength = buffer.readUInt32LE(12);
  const jsonStr = buffer.subarray(20, 20 + jsonLength).toString('utf8');
  const gltf = JSON.parse(jsonStr);
  const hasExternalUri = (gltf.images ?? []).some(
    (im) => typeof im.uri === 'string' && !im.uri.startsWith('data:')
  );
  return {
    gltf,
    jsonLength,
    hasExternalUri,
    meshes: gltf.meshes?.length ?? 0,
    animations: gltf.animations?.map((a) => a.name) ?? [],
  };
}

/**
 * ฝังไฟล์ Texture ภายนอก (เช่น Kenney "Textures/colormap.png") เข้าไปใน JSON Chunk ของ .glb แบบ Base64 Data URI
 * เพื่อให้ไฟล์ .glb แต่ละตัวทำงานได้สมบูรณ์แบบ Self-Contained 100% โดยไม่เกิด Error 404 ตอนโหลดใน Three.js
 */
async function inlineExternalTexturesInGlb(buffer, modelSourceUrl) {
  const info = parseGlbInfo(buffer);
  if (!info.hasExternalUri) {
    return { buffer, inlined: false, info };
  }

  const { gltf, jsonLength } = info;
  for (const img of gltf.images ?? []) {
    if (typeof img.uri === 'string' && !img.uri.startsWith('data:')) {
      const resolvedTexUrl = new URL(img.uri, modelSourceUrl).href;
      const texBuf = await fetchExternalTexture(resolvedTexUrl);
      const mime = img.uri.toLowerCase().endsWith('.jpg') || img.uri.toLowerCase().endsWith('.jpeg')
        ? 'image/jpeg'
        : 'image/png';
      img.uri = `data:${mime};base64,${texBuf.toString('base64')}`;
      img.mimeType = mime;
    }
  }

  const rawJsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  const padBytes = (4 - (rawJsonBuf.length % 4)) % 4;
  const paddedJsonBuf =
    padBytes > 0
      ? Buffer.concat([rawJsonBuf, Buffer.alloc(padBytes, 0x20)]) // เติม space (0x20) ตามมาตรฐาน glTF 2.0
      : rawJsonBuf;

  const restChunks = buffer.subarray(20 + jsonLength);
  const totalLength = 12 + 8 + paddedJsonBuf.length + restChunks.length;

  const headerAndChunkHeader = Buffer.alloc(20);
  headerAndChunkHeader.write('glTF', 0, 4, 'ascii');
  headerAndChunkHeader.writeUInt32LE(2, 4); // glTF version 2
  headerAndChunkHeader.writeUInt32LE(totalLength, 8);
  headerAndChunkHeader.writeUInt32LE(paddedJsonBuf.length, 12);
  headerAndChunkHeader.writeUInt32LE(0x4e4f534a, 16); // 'JSON'

  const rebuilt = Buffer.concat([headerAndChunkHeader, paddedJsonBuf, restChunks]);
  return { buffer: rebuilt, inlined: true, info: parseGlbInfo(rebuilt) };
}

async function downloadModel(entry) {
  const destPath = path.join(MODELS_DIR, entry.file);

  if (!FORCE_DOWNLOAD && existsSync(destPath)) {
    try {
      const existingBuf = await fs.readFile(destPath);
      const check = parseGlbInfo(existingBuf);
      if (!check.hasExternalUri) {
        return {
          file: entry.file,
          status: 'SKIP (มีอยู่แล้ว)',
          kb: Math.round(existingBuf.length / 1024),
          anims: check.animations.length,
          source: entry.source,
        };
      }
      // หากไฟล์เดิมยังอ้างอิง Texture ภายนอก (เช่น Textures/colormap.png) ให้ฝังลงในไฟล์ .glb ทันที
      const upgraded = await inlineExternalTexturesInGlb(existingBuf, entry.url);
      await fs.writeFile(destPath, upgraded.buffer);
      return {
        file: entry.file,
        status: 'EMBEDDED TEX 🎨',
        kb: Math.round(upgraded.buffer.length / 1024),
        anims: upgraded.info.animations.length,
        source: entry.source,
      };
    } catch {
      // ไฟล์เดิมเสีย ดาวน์โหลดใหม่ทันที
    }
  }

  const res = await fetch(entry.url, {
    headers: { 'User-Agent': 'waist-championship-model-downloader/1.0' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} -> ${entry.url}`);
  }

  const arrayBuf = await res.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuf);
  const { buffer, info } = await inlineExternalTexturesInGlb(rawBuffer, entry.url);

  await fs.writeFile(destPath, buffer);
  return {
    file: entry.file,
    status: 'DOWNLOADED ✅',
    kb: Math.round(buffer.length / 1024),
    anims: info.animations.length,
    source: entry.source,
  };
}

async function main() {
  console.log('====================================================================');
  console.log('🏰 Waist Championship 3D — Open-Source GLB Model Downloader (CC0)');
  console.log(`📂 ปลายทาง: ${MODELS_DIR}`);
  console.log('====================================================================\n');

  const texturesDir = path.join(MODELS_DIR, 'Textures');
  await fs.mkdir(texturesDir, { recursive: true });

  // ดาวน์โหลดไฟล์สำรอง public/models/Textures/colormap.png กันเหนียวสำหรับโมเดล Kenney ภายนอกด้วย
  const fallbackColormapPath = path.join(texturesDir, 'colormap.png');
  if (FORCE_DOWNLOAD || !existsSync(fallbackColormapPath)) {
    const cmapBuf = await fetchExternalTexture(`${KENNEY_BASE}/cube-pets/Textures/colormap.png`);
    await fs.writeFile(fallbackColormapPath, cmapBuf);
    console.log(`[TEXTURE ✅] บันทึกไฟล์สำรอง Textures/colormap.png (${Math.round(cmapBuf.length / 1024)} KB)\n`);
  }

  const results = [];
  let failed = 0;

  // ดาวน์โหลดทีละชุดย่อย (concurrency = 4) เพื่อความรวดเร็วและเสถียร
  const CONCURRENCY = 4;
  for (let i = 0; i < MODEL_MANIFEST.length; i += CONCURRENCY) {
    const batch = MODEL_MANIFEST.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((item) => downloadModel(item)));

    settled.forEach((res, idx) => {
      const item = batch[idx];
      if (res.status === 'fulfilled') {
        const r = res.value;
        results.push(r);
        console.log(
          `[${r.status}] ${r.file.padEnd(24)} | ${String(r.kb).padStart(5)} KB | 🎬 ${String(r.anims).padStart(2)} anims | ${item.desc}`
        );
      } else {
        failed++;
        console.error(`[FAILED ❌] ${item.file}: ${res.reason?.message || res.reason}`);
      }
    });
  }

  console.log('\n====================================================================');
  console.log(`✨ สรุปผล: สำเร็จ ${results.length}/${MODEL_MANIFEST.length} ไฟล์ (ล้มเหลว ${failed} ไฟล์)`);
  console.log('====================================================================');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
