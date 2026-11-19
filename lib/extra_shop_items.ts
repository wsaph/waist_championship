import type { ShopItem } from '@/lib/rpg_catalog';

/**
 * ไอเทมพรอพเพิ่มเติม 87 ชิ้น เพื่อให้ครบทุกหมวดไม่น้อยกว่า 22 ชิ้น!
 * (คละทั้ง 🆓 ฟรี, 🛒 ร้านค้า Gacha Pong และ 🎰 ตู้กาชาปอง Rare / Epic / Legendary)
 */
export const EXTRA_SHOP_ITEMS: ShopItem[] = [
  // =========================================================================
  // 🐾 PET (+2 → รวม 22 ชิ้น)
  // =========================================================================
  { id: 'pet_capybara_orange', category: 'pet', name: 'คาปิบาร่าทูนหัวส้ม', icon: '🍊', cost: 320, desc: 'น้องคาปิบาร่าหน้านิ่งวางส้มบนหัวเดินตามชิลๆ', colorHex: 0xB45309, accentHex: 0xF97316 },
  { id: 'pet_gacha_axolotl', category: 'pet', name: 'แอกโซลอตล์ชมพูยิ้มแฉ่ง', icon: '🦎', cost: 0, desc: 'น้องหมาน้ำชมพูพาสเทลลอยดุ๊กดิ๊กตามติด! (Epic กาชาปอง)', colorHex: 0xF472B6, accentHex: 0xFBCFE8, isGachaOnly: true, rarity: 'epic' },

  // =========================================================================
  // 🎩 HAT (+8 → รวม 22 ชิ้น)
  // =========================================================================
  { id: 'hat_bucket_beach', category: 'hat', name: 'หมวกบักเก็ตเดินหาด', icon: '👒', cost: 0, desc: 'หมวกบักเก็ตสีครีมกันแดดริมทะเลสุดชิล (ฟรี)', colorHex: 0xFEF3C7, accentHex: 0x38BDF8 },
  { id: 'hat_frog_beanie', category: 'hat', name: 'หมวกไหมพรมน้องกบ', icon: '🐸', cost: 120, desc: 'หมวกไหมพรมเขียวมีตากบคู่สุดน่ารัก', colorHex: 0x22C55E, accentHex: 0xFFFFFF },
  { id: 'hat_cowboy_gold', category: 'hat', name: 'หมวกคาวบอยดาวทอง', icon: '🤠', cost: 220, desc: 'หมวกคาวบอยปีกกว้างคาดดาวนายอำเภอสีทอง', colorHex: 0x92400E, accentHex: 0xFACC15 },
  { id: 'hat_viking_helm', category: 'hat', name: 'หมวกไวกิ้งเขาคู่', icon: '⚔️', cost: 240, desc: 'หมวกเหล็กไวกิ้งเขาสีงาช้างสายลุยสุดแกร่ง', colorHex: 0x64748B, accentHex: 0xFEF3C7 },
  { id: 'hat_witch_pointy', category: 'hat', name: 'หมวกแม่มดดาวทอง', icon: '🧙', cost: 280, desc: 'หมวกทรงแหลมสีม่วงเข้มคาดเข็มขัดทองคำ', colorHex: 0x6D28D9, accentHex: 0xFACC15 },
  { id: 'hat_samurai_crest', category: 'hat', name: 'หมวกซามูไรพระจันทร์เสี้ยว', icon: '🌙', cost: 380, desc: 'หมวกเกราะคาบูโตะประดับพระจันทร์เสี้ยวทองคำ', colorHex: 0x1E293B, accentHex: 0xFACC15 },
  { id: 'hat_gacha_cat_ears_neon', category: 'hat', name: 'หูแมวหูฟังไฟนีออน', icon: '🐱', cost: 0, desc: 'หูฟังเกมมิ่งติดหูแมวเรืองแสงชมพู-ฟ้า! (Rare กาชาปอง)', colorHex: 0xEC4899, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'rare' },
  { id: 'hat_gacha_galaxy_crown', category: 'hat', name: 'มงกุฎกาแล็กซี่เรืองแสง', icon: '🌌', cost: 0, desc: 'มงกุฎจักรวาลประดับดาวคริสตัลลอยหมุน! (Legendary กาชาปอง)', colorHex: 0x6366F1, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'legendary' },

  // =========================================================================
  // 👕 ARMOR (+9 → รวม 22 ชิ้น)
  // =========================================================================
  { id: 'armor_hawaii_shirt', category: 'armor', name: 'เสื้อฮาวายริมทะเล', icon: '🌺', cost: 0, desc: 'เสื้อเชิ้ตฮาวายสีฟ้าสดใสคู่กางเกงขาสั้น (ฟรี)', colorHex: 0x06B6D4, accentHex: 0xFACC15 },
  { id: 'armor_tracksuit_neon', category: 'armor', name: 'ชุดวอร์มนีออนนักวิ่ง', icon: '🏃', cost: 160, desc: 'ชุดวอร์มกีฬาแถบสีเขียวนีออนสายสปีด', colorHex: 0x1E293B, accentHex: 0x4ADE80 },
  { id: 'armor_chef_uniform', category: 'armor', name: 'ชุดเชฟมิชลินผ้ากันเปื้อน', icon: '👨‍🍳', cost: 240, desc: 'เสื้อเชฟขาวกระดุมสองแถวคู่ผ้ากันเปื้อนแดง', colorHex: 0xFFFFFF, accentHex: 0xEF4444 },
  { id: 'armor_kimono_sakura', category: 'armor', name: 'ชุดยูกาตะซากุระ', icon: '🌸', cost: 320, desc: 'ชุดยูกาตะสีชมพูซากุระคาดโอบิสีม่วงละมุน', colorHex: 0xF472B6, accentHex: 0x7C3AED },
  { id: 'armor_ninja_suit', category: 'armor', name: 'ชุดนินจาเงารัตติกาล', icon: '🥷', cost: 380, desc: 'ชุดนินจาดำคาดผ้าแดงคล่องตัวระดับสายฟ้า', colorHex: 0x0F172A, accentHex: 0xEF4444 },
  { id: 'armor_pirate_coat', category: 'armor', name: 'เสื้อโค้ตกัปตันโจรสลัด', icon: '🏴‍☠️', cost: 420, desc: 'โค้ตกัปตันสีแดงเข้มขลิบทองสุดเท่', colorHex: 0x991B1B, accentHex: 0xFACC15 },
  { id: 'armor_space_suit', category: 'armor', name: 'ชุดนักบินอวกาศขาวทอง', icon: '🧑‍🚀', cost: 550, desc: 'ชุดอวกาศสีขาวแถบส้มทองเหมือนลอยไร้น้ำหนัก', colorHex: 0xF8FAFC, accentHex: 0xF97316 },
  { id: 'armor_gacha_cyber_jacket', category: 'armor', name: 'แจ็คเก็ตไซเบอร์พังก์นีออน', icon: '🤖', cost: 0, desc: 'แจ็คเก็ตอนาคตเรืองแสงฟ้า-ชมพูสุดล้ำ! (Epic กาชาปอง)', colorHex: 0x0EA5E9, accentHex: 0xF472B6, isGachaOnly: true, rarity: 'epic' },
  { id: 'armor_gacha_royal_king', category: 'armor', name: 'ชุดราชาผ้าคลุมทองคำ', icon: '👑', cost: 0, desc: 'ฉลองพระองค์กำมะหยี่แดงขลิบทองระดับจักรพรรดิ! (Legendary กาชาปอง)', colorHex: 0xDC2626, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'legendary' },

  // =========================================================================
  // ⚔️ WEAPON (+12 → รวม 22 ชิ้น)
  // =========================================================================
  { id: 'weapon_water_bottle', category: 'weapon', name: 'ขวดน้ำสายฟิตคลีน', icon: '💧', cost: 0, desc: 'กระบอกน้ำกีฬาพกติดมือเติมความสดชื่น (ฟรี)', colorHex: 0x38BDF8, accentHex: 0xFFFFFF },
  { id: 'weapon_glowstick', category: 'weapon', name: 'แท่งไฟเชียร์คอนเสิร์ต', icon: '🌟', cost: 110, desc: 'แท่งไฟนีออนโบกเชียร์เพื่อนสุดมันส์', colorHex: 0xEC4899, accentHex: 0xFDE047 },
  { id: 'weapon_tennis_racket', category: 'weapon', name: 'ไม้เทนนิสโปรทัวร์', icon: '🎾', cost: 160, desc: 'ไม้เทนนิสสายสปอร์ตพร้อมหวดลูกเบิร์นแคล', colorHex: 0x84CC16, accentHex: 0x1E293B },
  { id: 'weapon_boxing_glove', category: 'weapon', name: 'นวมมวยแดงแชมเปี้ยน', icon: '🥊', cost: 190, desc: 'นวมชกมวยสีแดงสดต่อยพุงยุบ!', colorHex: 0xEF4444, accentHex: 0xFFFFFF },
  { id: 'weapon_shabu_pot', category: 'weapon', name: 'หม้อชาบูน้ำดำถือเดิน', icon: '🍲', cost: 240, desc: 'หม้อชาบูควันฉุยยั่วน้ำลายเพื่อนข้างลู่!', colorHex: 0x334155, accentHex: 0xF97316 },
  { id: 'weapon_guitar_rock', category: 'weapon', name: 'กีตาร์ไฟฟ้าร็อกสตาร์', icon: '🎸', cost: 320, desc: 'กีตาร์ไฟฟ้าสีแดงเพลิงโซโล่กลางลู่วิ่ง', colorHex: 0xDC2626, accentHex: 0xF8FAFC },
  { id: 'weapon_magic_wand', category: 'weapon', name: 'คทาเวทมนตร์ดาววิบวับ', icon: '🪄', cost: 360, desc: 'คทาปลายดาวทองเสกแคลอรี่หายวับ', colorHex: 0xA855F7, accentHex: 0xFACC15 },
  { id: 'weapon_katana_blade', category: 'weapon', name: 'ดาบคาตานะซามูไร', icon: '⚔️', cost: 480, desc: 'ดาบซามูไรคมกริบด้ามพันแดงสุดขลัง', colorHex: 0xE2E8F0, accentHex: 0xEF4444 },
  { id: 'weapon_trident_sea', category: 'weapon', name: 'ตรีศูลเจ้าสมุทรทองคำ', icon: '🔱', cost: 620, desc: 'สามง่ามทองคำแห่งราชาทะเลผู้พิชิตชายหาด', colorHex: 0xFACC15, accentHex: 0x38BDF8 },
  { id: 'weapon_gacha_pizza_slice', category: 'weapon', name: 'พิซซ่าชีสเยิ้มชิ้นยักษ์', icon: '🍕', cost: 0, desc: 'พิซซ่าเปปเปอโรนีชิ้นโตถือวิ่งล่อเพื่อน! (Rare กาชาปอง)', colorHex: 0xF59E0B, accentHex: 0xEF4444, isGachaOnly: true, rarity: 'rare' },
  { id: 'weapon_gacha_laser_saber', category: 'weapon', name: 'ดาบเลเซอร์พลาสม่า', icon: '⚡', cost: 0, desc: 'ดาบแสงไซไฟเรืองแสงสีฟ้าพลาสม่า! (Epic กาชาปอง)', colorHex: 0x38BDF8, accentHex: 0xE0F2FE, isGachaOnly: true, rarity: 'epic' },
  { id: 'weapon_gacha_excalibur', category: 'weapon', name: 'ดาบศักดิ์สิทธิ์เอ็กซ์คาลิเบอร์', icon: '👑', cost: 0, desc: 'ดาบทองคำเปล่งรัศมีแห่งผู้พิชิตในตำนาน! (Legendary กาชาปอง)', colorHex: 0xFACC15, accentHex: 0xFFFFFF, isGachaOnly: true, rarity: 'legendary' },

  // =========================================================================
  // 📍 MARKER (+12 → รวม 22 ชิ้น)
  // =========================================================================
  { id: 'marker_beach_cone', category: 'marker', name: 'กรวยจราจรจองลู่', icon: '🚧', cost: 0, desc: 'กรวยส้มคาดแถบขาวตั้งจองเลนชัดเจน (ฟรี)', colorHex: 0xF97316, accentHex: 0xFFFFFF },
  { id: 'marker_umbrella', category: 'marker', name: 'ร่มชายหาดปักจองที่', icon: '⛱️', cost: 120, desc: 'ร่มชายหาดลายสลับสีปักจองคิวสุดชิล', colorHex: 0x0EA5E9, accentHex: 0xFFFFFF },
  { id: 'marker_tiki_torch', category: 'marker', name: 'คบเพลิงทิกิริมหาด', icon: '🔥', cost: 220, desc: 'เสาไม้ไผ่คบเพลิงลุกโชติช่วงสไตล์เกาะฮาวาย', colorHex: 0xB45309, accentHex: 0xF97316 },
  { id: 'marker_lantern_jp', category: 'marker', name: 'โคมแดงญี่ปุ่นเรืองแสง', icon: '🏮', cost: 280, desc: 'เสาไม้แขวนโคมกระดาษแดงอุ่นๆ สไตล์เกียวโต', colorHex: 0xDC2626, accentHex: 0xFACC15 },
  { id: 'marker_cactus_pot', category: 'marker', name: 'กระบองเพชรยิ้มเฝ้าลู่', icon: '🌵', cost: 320, desc: 'น้องกระบองเพชรในกระถางชูแขนเฝ้าตำแหน่งแทน', colorHex: 0x22C55E, accentHex: 0xD97706 },
  { id: 'marker_snowman', category: 'marker', name: 'ตุ๊กตาหิมะเฝ้าตำแหน่ง', icon: '⛄', cost: 420, desc: 'ตุ๊กตาหิมะพันผ้าพันคอแดงยืนเฝ้าลู่ไม่กลัวแดด!', colorHex: 0xFFFFFF, accentHex: 0xEF4444 },
  { id: 'marker_sword_stone', category: 'marker', name: 'ดาบปักศิลาในตำนาน', icon: '⚔️', cost: 550, desc: 'ดาบอัศวินปักกลางก้อนหินเรืองแสงสุดเท่', colorHex: 0x64748B, accentHex: 0xFACC15 },
  { id: 'marker_cherry_tree', category: 'marker', name: 'ต้นซากุระจิ๋วโปรยกลีบ', icon: '🌸', cost: 750, desc: 'ต้นซากุระสีชมพูบานสะพรั่งปักจองลู่สุดโรแมนติก', colorHex: 0xF472B6, accentHex: 0x78350F },
  { id: 'marker_gold_statue', category: 'marker', name: 'รูปปั้นทองคำผู้กล้า', icon: '🗽', cost: 950, desc: 'แท่นหินอ่อนรูปปั้นทองคำอร่ามตั้งตระหง่านกลางลู่', colorHex: 0xFACC15, accentHex: 0x94A3B8 },
  { id: 'marker_gacha_cat_shrine', category: 'marker', name: 'ศาลเจ้าแมวกวักนำโชค', icon: '🐱', cost: 0, desc: 'โทริอิแดงพร้อมแมวกวักทองคำเรียกเหรียญ! (Rare กาชาปอง)', colorHex: 0xEF4444, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'rare' },
  { id: 'marker_gacha_portal_gate', category: 'marker', name: 'ประตูวาร์ปมิติเรืองแสง', icon: '🌀', cost: 0, desc: 'วงแหวนประตูมิติสีม่วงฟ้าหมุนวนกลางลู่! (Epic กาชาปอง)', colorHex: 0x7C3AED, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'epic' },
  { id: 'marker_gacha_dragon_pillar', category: 'marker', name: 'เสามังกรทองคำลอยฟ้า', icon: '🐉', cost: 0, desc: 'เสามังกรทองประดับลูกแก้วเพลิงลอยหมุน! (Legendary กาชาปอง)', colorHex: 0xFACC15, accentHex: 0xEF4444, isGachaOnly: true, rarity: 'legendary' },

  // =========================================================================
  // 🎒 WINGS / BACK (+14 → รวม 22 ชิ้น)
  // =========================================================================
  { id: 'wings_beach_towel', category: 'wings', name: 'ผ้าคลุมชายหาดสายชิล', icon: '🧣', cost: 0, desc: 'ผ้าคลุมไหล่ลายชายหาดสีฟ้าสดใส (ฟรี)', colorHex: 0x38BDF8, accentHex: 0xFEF08A },
  { id: 'wings_swim_float', category: 'wings', name: 'ห่วงยางชูชีพสะพายหลัง', icon: '🛟', cost: 130, desc: 'ห่วงยางแดงขาวพร้อมโดดลงทะเลได้ทุกเมื่อ', colorHex: 0xEF4444, accentHex: 0xFFFFFF },
  { id: 'wings_duck_pack', category: 'wings', name: 'เป้เป็ดเหลืองสุดคิวท์', icon: '🦆', cost: 190, desc: 'กระเป๋าเป้รูปน้องเป็ดเหลืองจงอยปากส้ม', colorHex: 0xFACC15, accentHex: 0xF97316 },
  { id: 'wings_shark_fin', category: 'wings', name: 'ครีบฉลามติดหลังสุดเท่', icon: '🦈', cost: 240, desc: 'ครีบฉลามสีเทาฟ้าว่ายแหวกลมเข้าเส้นชัย', colorHex: 0x64748B, accentHex: 0x38BDF8 },
  { id: 'wings_guitar_case', category: 'wings', name: 'กระเป๋ากีตาร์สะพายหลัง', icon: '🎸', cost: 280, desc: 'สะพายกีตาร์เท่ๆ เหมือนนักดนตรีพเนจร', colorHex: 0x92400E, accentHex: 0xFACC15 },
  { id: 'wings_cat_tail_bow', category: 'wings', name: 'โบว์หางแมวพาสเทล', icon: '🎀', cost: 320, desc: 'โบว์ชมพูคู่หางแมวดุ๊กดิ๊กด้านหลัง', colorHex: 0xF472B6, accentHex: 0xFFFFFF },
  { id: 'wings_bee_wings', category: 'wings', name: 'ปีกผึ้งน้อยโปร่งใส', icon: '🐝', cost: 360, desc: 'ปีกผึ้งจิ๋วสีเหลืองทองกระพือหึ่งๆ สุดคิวท์', colorHex: 0xFEF08A, accentHex: 0x18181B },
  { id: 'wings_bat_dark', category: 'wings', name: 'ปีกค้างคาวแวมไพร์', icon: '🦇', cost: 440, desc: 'ปีกค้างคาวสีดำม่วงสไตล์ท่านเคานต์รัตติกาล', colorHex: 0x312E81, accentHex: 0xA855F7 },
  { id: 'wings_hero_cape', category: 'wings', name: 'ผ้าคลุมซูเปอร์ฮีโร่แดง', icon: '🦸', cost: 480, desc: 'ผ้าคลุมสีแดงสดปลิวสะบัดเวลาสปรินต์!', colorHex: 0xDC2626, accentHex: 0xFACC15 },
  { id: 'wings_samurai_flags', category: 'wings', name: 'ธงซามูไรคู่สะพายหลัง', icon: '🚩', cost: 560, desc: 'ธงศึกซามูไรคู่สีแดงทองสง่างามกลางสนาม', colorHex: 0xB91C1C, accentHex: 0xFACC15 },
  { id: 'wings_dragon_fire', category: 'wings', name: 'ปีกมังกรเพลิงยักษ์', icon: '🐉', cost: 780, desc: 'ปีกมังกรแดงส้มแผ่สยายดุดันระดับบอส', colorHex: 0xEF4444, accentHex: 0xF97316 },
  { id: 'wings_gacha_cloud_pack', category: 'wings', name: 'เป้ก้อนเมฆสายรุ้ง', icon: '☁️', cost: 0, desc: 'ก้อนเมฆนุ่มฟูสะพายหลังพาดสายรุ้งจิ๋ว! (Rare กาชาปอง)', colorHex: 0xFFFFFF, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'rare' },
  { id: 'wings_gacha_cyber_wings', category: 'wings', name: 'ปีกโฮโลแกรมไซเบอร์', icon: '⚡', cost: 0, desc: 'ปีกพลังงานแสงนีออนไซไฟเรืองแสง! (Epic กาชาปอง)', colorHex: 0x38BDF8, accentHex: 0xF472B6, isGachaOnly: true, rarity: 'epic' },
  { id: 'wings_gacha_phoenix_wings', category: 'wings', name: 'ปีกฟีนิกซ์เพลิงอมตะ', icon: '🔥', cost: 0, desc: 'ปีกเพลิงทองคำลุกโชนอลังการที่สุดในเกม! (Legendary กาชาปอง)', colorHex: 0xF97316, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'legendary' },

  // =========================================================================
  // 🕶️ FACE (+15 → รวม 22 ชิ้น)
  // =========================================================================
  { id: 'face_smile_sticker', category: 'face', name: 'สติกเกอร์ดาวแปะแก้ม', icon: '😊', cost: 0, desc: 'ดาวทองจิ๋วแปะแก้มเพิ่มความสดใส (ฟรี)', colorHex: 0xFACC15, accentHex: 0xF472B6 },
  { id: 'face_heart_glasses', category: 'face', name: 'แว่นหัวใจสีชมพู', icon: '😍', cost: 120, desc: 'แว่นตากรอบรูปหัวใจชมพูพาสเทลสุดคิวท์', colorHex: 0xEC4899, accentHex: 0xFBCFE8 },
  { id: 'face_clown_nose', category: 'face', name: 'จมูกแดงตัวตลกโบโซ่', icon: '🤡', cost: 140, desc: 'ลูกบอลจมูกสีแดงกลมๆ สายฮาประจำสนาม', colorHex: 0xEF4444, accentHex: 0xFACC15 },
  { id: 'face_snorkel_mask', category: 'face', name: 'แว่นดำน้ำริมหาด', icon: '🤿', cost: 150, desc: 'หน้ากากดำน้ำกระจกฟ้าพร้อมลุยทะเล!', colorHex: 0x0EA5E9, accentHex: 0xFACC15 },
  { id: 'face_cat_whiskers', category: 'face', name: 'หนวดแมวเหมียวสุดคิวท์', icon: '🐱', cost: 160, desc: 'หนวดแมว 6 เส้นพร้อมจมูกชมพูจิ๋ว', colorHex: 0x18181B, accentHex: 0xF472B6 },
  { id: 'face_mustache_gent', category: 'face', name: 'หนวดเฟิ้มคุณลุงสายฮา', icon: '👨', cost: 170, desc: 'หนวดงอนงามสไตล์สุภาพบุรุษย้อนยุค', colorHex: 0x451A03, accentHex: 0x78350F },
  { id: 'face_pirate_patch', category: 'face', name: 'ผ้าปิดตาโจรสลัด', icon: '🏴‍☠️', cost: 180, desc: 'ผ้าปิดตาดำข้างเดียวสไตล์กัปตันเรือ', colorHex: 0x18181B, accentHex: 0xFACC15 },
  { id: 'face_pixel_shades', category: 'face', name: 'แว่นพิกเซล Deal With It', icon: '😎', cost: 190, desc: 'แว่นกันแดด 8-Bit สุดกวนใส่แล้วเท่คูณร้อย!', colorHex: 0x18181B, accentHex: 0xFFFFFF },
  { id: 'face_monocle_gold', category: 'face', name: 'แว่นตาข้างเดียวคุณชาย', icon: '🧐', cost: 240, desc: 'โมโนเคิลกรอบทองหรูหรามีระดับ', colorHex: 0xFACC15, accentHex: 0xBAE6FD },
  { id: 'face_ninja_mask', category: 'face', name: 'ผ้าปิดปากนินจาดำ', icon: '🥷', cost: 260, desc: 'ผ้าปิดหน้าครึ่งล่างสีดำเท่ลึกลับ', colorHex: 0x0F172A, accentHex: 0xEF4444 },
  { id: 'face_visor_sport', category: 'face', name: 'แว่นกันแดดนักวิ่งโปร', icon: '🏃', cost: 280, desc: 'แว่นสปอร์ตเลนส์ปรอทฟ้าส้มสไตล์นักวิ่งมาราธอน', colorHex: 0x38BDF8, accentHex: 0xF97316 },
  { id: 'face_oni_mask', category: 'face', name: 'หน้ากากโอนิญี่ปุ่น', icon: '👹', cost: 420, desc: 'หน้ากากยักษ์แดงเขาทองสุดดุดัน', colorHex: 0xDC2626, accentHex: 0xFACC15 },
  { id: 'face_gacha_cyber_visor', category: 'face', name: 'แว่นสแกนเนอร์ไซเบอร์', icon: '🤖', cost: 0, desc: 'แว่นสแกนพลังนีออนสีเขียวฟ้า! (Rare กาชาปอง)', colorHex: 0x22C55E, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'rare' },
  { id: 'face_gacha_masquerade', category: 'face', name: 'หน้ากากงานเลี้ยงทองคำ', icon: '🎭', cost: 0, desc: 'หน้ากากแฟนซีทองคำประดับอัญมณีหรูหรา! (Epic กาชาปอง)', colorHex: 0xFACC15, accentHex: 0xA855F7, isGachaOnly: true, rarity: 'epic' },
  { id: 'face_gacha_laser_eyes', category: 'face', name: 'แว่นตาเลเซอร์ไซย่า', icon: '⚡', cost: 0, desc: 'เลนส์เรืองแสงสีทองยิงประกายสายฟ้า! (Legendary กาชาปอง)', colorHex: 0xFACC15, accentHex: 0xEF4444, isGachaOnly: true, rarity: 'legendary' },

  // =========================================================================
  // ✨ AURA (+15 → รวม 22 ชิ้น)
  // =========================================================================
  { id: 'aura_soft_glow', category: 'aura', name: 'วงแสงนุ่มนวลใต้เท้า', icon: '💡', cost: 0, desc: 'วงแหวนแสงสีเหลืองอ่อนนุ่มนวลใต้เท้า (ฟรี)', colorHex: 0xFEF08A, accentHex: 0xFFFFFF },
  { id: 'aura_water_ripple', category: 'aura', name: 'วงคลื่นน้ำทะเลซัดเท้า', icon: '🌊', cost: 220, desc: 'วงคลื่นสีฟ้าใสกระเพื่อมรอบตัวสไตล์ชายหาด', colorHex: 0x38BDF8, accentHex: 0xBAE6FD },
  { id: 'aura_bubbles', category: 'aura', name: 'ฟองสบู่ลอยฟุ้งรอบตัว', icon: '💧', cost: 260, desc: 'ฟองสบู่สีรุ้งพาสเทลลอยรอบตัวสุดคิวท์', colorHex: 0x7DD3FC, accentHex: 0xFBCFE8 },
  { id: 'aura_hearts', category: 'aura', name: 'หัวใจสีชมพูลอยวน', icon: '💖', cost: 320, desc: 'ดวงใจสีชมพูลอยหมุนรอบกายเพิ่มความน่ารัก', colorHex: 0xEC4899, accentHex: 0xF9A8D4 },
  { id: 'aura_notes', category: 'aura', name: 'โน้ตดนตรีลอยรอบกาย', icon: '🎵', cost: 340, desc: 'เม็ดแสงตัวโน้ตหลากสีเต้นรำรอบตัว', colorHex: 0xA855F7, accentHex: 0x38BDF8 },
  { id: 'aura_leaves', category: 'aura', name: 'พายุใบไม้เขียวธรรมชาติ', icon: '🍃', cost: 360, desc: 'ใบไม้สีเขียวสดปลิวหมุนวนสายคลีน', colorHex: 0x22C55E, accentHex: 0x86EFAC },
  { id: 'aura_snow', category: 'aura', name: 'หิมะโปรยปรายเยือกเย็น', icon: '❄️', cost: 420, desc: 'เกล็ดหิมะคริสตัลหมุนรอบตัวเย็นฉ่ำทั้งหาด', colorHex: 0xE0F2FE, accentHex: 0x38BDF8 },
  { id: 'aura_lightning', category: 'aura', name: 'สายฟ้าฟาดเปรี๊ยะๆ รอบตัว', icon: '⚡', cost: 520, desc: 'ประกายสายฟ้าสีเหลืองฟ้าวิ่งรอบกายสุดเท่', colorHex: 0xFACC15, accentHex: 0x38BDF8 },
  { id: 'aura_butterflies', category: 'aura', name: 'ฝูงผีเสื้อบินวนรอบตัว', icon: '🦋', cost: 540, desc: 'ผีเสื้อพาสเทลหลากสีบินล้อมรอบตัวละคร', colorHex: 0x6EE7B7, accentHex: 0xF472B6 },
  { id: 'aura_gold_coins', category: 'aura', name: 'ฝนเหรียญทองคำโปรยปราย', icon: '💰', cost: 580, desc: 'เหรียญทอง Gacha Pong ลอยหมุนอวดความรวย!', colorHex: 0xFACC15, accentHex: 0xF59E0B },
  { id: 'aura_dark_shadow', category: 'aura', name: 'ควันทมิฬจอมมารลึกลับ', icon: '🌑', cost: 640, desc: 'พลังเงาสีดำม่วงลอยวนรอบตัวระดับบอส', colorHex: 0x4C1D95, accentHex: 0xA855F7 },
  { id: 'aura_cyber_grid', category: 'aura', name: 'วงแหวนดิจิทัลไซเบอร์', icon: '💠', cost: 680, desc: 'วงแหวนโฮโลแกรมไซไฟหมุนซ้อนสองชั้น', colorHex: 0x06B6D4, accentHex: 0xEC4899 },
  { id: 'aura_gacha_aurora', category: 'aura', name: 'แสงเหนือออโรร่าพริ้วไหว', icon: '🌌', cost: 0, desc: 'แถบแสงเหนือสีเขียวม่วงฟ้าพริ้วรอบตัว! (Rare กาชาปอง)', colorHex: 0x34D399, accentHex: 0xA855F7, isGachaOnly: true, rarity: 'rare' },
  { id: 'aura_gacha_dragon_ring', category: 'aura', name: 'วงเวทมังกรเพลิงคำราม', icon: '🐉', cost: 0, desc: 'วงแหวนเพลิงทองคำพร้อมลูกไฟมังกรโคจร! (Epic กาชาปอง)', colorHex: 0xEF4444, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'epic' },
  { id: 'aura_gacha_galaxy_orbit', category: 'aura', name: 'ระบบสุริยะดาวเคราะห์โคจร', icon: '🪐', cost: 0, desc: 'ดาวเสาร์และดาวเคราะห์สีรุ้งโคจรรอบตัว! (Legendary กาชาปอง)', colorHex: 0x6366F1, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'legendary' },
];

export const EXTRA_FREE_ITEM_IDS = EXTRA_SHOP_ITEMS.filter(
  (it) => !it.isGachaOnly && it.cost === 0
).map((it) => it.id);
