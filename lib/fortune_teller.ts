export type DivinationMethodId =
  | 'tarot'
  | 'esiimsi'
  | 'crystal_aura'
  | 'zodiac'
  | 'runes';

export type FortuneTopicId =
  | 'love'
  | 'wealth'
  | 'career'
  | 'health'
  | 'overall';

export interface DivinationMethodMeta {
  id: DivinationMethodId;
  name: string;
  subtitle: string;
  icon: string;
  accentFrom: string;
  accentTo: string;
  badgeText: string;
  ritualHint: string;
}

export interface FortuneTopicMeta {
  id: FortuneTopicId;
  label: string;
  icon: string;
  placeholder: string;
  sampleQuestions: string[];
}

export interface TarotCardDef {
  id: number;
  nameEn: string;
  nameTh: string;
  icon: string;
  uprightMeaning: string;
  reversedMeaning: string;
}

export interface DrawnTarotCard {
  card: TarotCardDef;
  isReversed: boolean;
  positionLabel: 'ที่ผ่านมา' | 'ตอนนี้' | 'แนวโน้มข้างหน้า';
}

export interface EsiimsiStickDef {
  number: number;
  grade: 'ดีมาก' | 'ดี' | 'กลางๆ' | 'ควรระวัง';
  poem: string[];
  coreMeaning: string;
}

export interface CrystalAuraDef {
  id: string;
  nameTh: string;
  elementTh: string;
  colorHex: string;
  glowClass: string;
  icon: string;
  energyMeaning: string;
}

export interface RuneStoneDef {
  id: string;
  symbol: string;
  name: string;
  nameTh: string;
  meaningTh: string;
}

export interface BirthDayOption {
  id: string;
  label: string;
  planetTh: string;
  luckyColorTh: string;
}

export interface ZodiacOption {
  id: string;
  label: string;
  icon: string;
  elementTh: string;
}

export interface FortuneReadingResponse {
  headline: string;
  reading: string;
  advice: string;
  luckyColor: string;
  luckyNumbers: string;
  starRating: number;
  source: 'gemini' | 'fallback';
}

export const DIVINATION_METHODS: DivinationMethodMeta[] = [
  {
    id: 'tarot',
    name: 'ไพ่ยิปซี 3 ใบ',
    subtitle: 'เปิดไพ่ 3 ใบ เช็กเรื่องที่ผ่านมา ตอนนี้ และแนวโน้มข้างหน้า',
    icon: '🃏',
    accentFrom: '#7e22ce',
    accentTo: '#ec4899',
    badgeText: 'ยอดฮิต',
    ritualHint: 'กดเลือกไพ่ที่ถูกใจ 3 ใบจากกองด้านล่าง',
  },
  {
    id: 'esiimsi',
    name: 'เซียมซีเสี่ยงทาย',
    subtitle: 'เขย่ากระบอกสุ่มเลข 1–28 ดูว่าเรื่องที่ถามจะรุ่งหรือต้องระวังอะไร',
    icon: '🎋',
    accentFrom: '#b91c1c',
    accentTo: '#f59e0b',
    badgeText: 'เข้าใจง่าย',
    ritualHint: 'นึกถึงคำถามในใจ แล้วกดปุ่มเขย่ากระบอกเซียมซี',
  },
  {
    id: 'crystal_aura',
    name: 'ลูกแก้วเช็กออร่า',
    subtitle: 'แตะลูกแก้วดูพลังออร่าและจังหวะดวงของคุณในตอนนี้',
    icon: '🔮',
    accentFrom: '#0284c7',
    accentTo: '#8b5cf6',
    badgeText: 'ไวทันใจ',
    ritualHint: 'กดแตะที่ลูกแก้ว 1 ครั้ง เพื่อดูสีออร่าของคุณ',
  },
  {
    id: 'zodiac',
    name: 'ดวงวันเกิด & 12 ราศี',
    subtitle: 'เลือกวันเกิดและราศี เพื่อดูคำทำนายตามพื้นดวงของคุณ',
    icon: '♈',
    accentFrom: '#4338ca',
    accentTo: '#eab308',
    badgeText: 'ตามวันเกิด',
    ritualHint: 'เลือกวันเกิดและราศีของคุณ แล้วกดยืนยันข้อมูล',
  },
  {
    id: 'runes',
    name: 'หินรูน & เลขนำโชค',
    subtitle: 'สุ่มหยิบหินโบราณ 3 ก้อน ดูคำใบ้สั้นๆ และเลขนำโชค',
    icon: '🪨',
    accentFrom: '#0f766e',
    accentTo: '#38bdf8',
    badgeText: 'สายเลขเด็ด',
    ritualHint: 'กดสุ่มหยิบหินรูน 3 ก้อนจากถุงผ้า',
  },
];

export const FORTUNE_TOPICS: FortuneTopicMeta[] = [
  {
    id: 'love',
    label: 'ความรัก',
    icon: '💘',
    placeholder: 'พิมพ์คำถาม เช่น คนที่คุยอยู่เขารู้สึกยังไงกับเรา?',
    sampleQuestions: [
      'คนที่คุยอยู่คิดจริงจังกับเราไหม?',
      'เร็วๆ นี้จะมีคนดีๆ เข้ามาไหม?',
      'ความรักช่วงนี้ควรปรับตรงไหนให้เข้าใจกันมากขึ้น?',
    ],
  },
  {
    id: 'wealth',
    label: 'การเงิน & โชคลาภ',
    icon: '💰',
    placeholder: 'พิมพ์คำถาม เช่น เดือนนี้การเงินจะคล่องตัวขึ้นไหม?',
    sampleQuestions: [
      'ช่วงนี้มีโอกาสได้โชคลาภหรือเงินพิเศษไหม?',
      'การเงินเดือนนี้ควรระวังรายจ่ายเรื่องอะไร?',
      'สิ่งที่ลงทุนลงแรงไปจะได้ผลตอบแทนคุ้มไหม?',
    ],
  },
  {
    id: 'career',
    label: 'การงาน & การเรียน',
    icon: '💼',
    placeholder: 'พิมพ์คำถาม เช่น งานที่ทำอยู่ตอนนี้จะผ่านไปได้ด้วยดีไหม?',
    sampleQuestions: [
      'งานหรือโปรเจกต์ที่ทำอยู่จะสำเร็จราบรื่นไหม?',
      'ถ้าอยากขยับขยายหรือเริ่มสิ่งใหม่ช่วงนี้ดีไหม?',
      'ปัญหาเรื่องงานที่ติดอยู่จะคลี่คลายเมื่อไหร่?',
    ],
  },
  {
    id: 'health',
    label: 'สุขภาพ & ลดเอว',
    icon: '🏃‍♀️',
    placeholder: 'พิมพ์คำถาม เช่น รอบนี้จะลดน้ำหนัก/ลดเอวได้ตามเป้าไหม?',
    sampleQuestions: [
      'รอบนี้จะลดเอวและฟิตหุ่นสำเร็จตามเป้าไหม?',
      'ช่วงนี้สุขภาพร่างกายควรดูแลเรื่องไหนเป็นพิเศษ?',
      'ทำยังไงให้มีไฟออกกำลังกายต่อเนื่องไม่หลุดแผน?',
    ],
  },
  {
    id: 'overall',
    label: 'ดวงทั่วไป',
    icon: '✨',
    placeholder: 'พิมพ์คำถาม เช่น ช่วงนี้จะมีเรื่องดีๆ อะไรเข้ามาบ้าง?',
    sampleQuestions: [
      'ช่วงนี้ดวงภาพรวมเป็นยังไง มีเรื่องดีอะไรกำลังจะเข้ามา?',
      'สิ่งที่ตั้งใจหวังไว้ตอนนี้มีโอกาสสมหวังไหม?',
      'อาทิตย์นี้ควรโฟกัสเรื่องอะไรแล้วชีวิตจะปังที่สุด?',
    ],
  },
];

export const TAROT_MAJOR_ARCANA: TarotCardDef[] = [
  {
    id: 0,
    nameEn: 'The Fool',
    nameTh: 'การเริ่มต้นใหม่',
    icon: '🎒',
    uprightMeaning: 'ได้เริ่มอะไรใหม่ๆ สนุกสดใส มีโอกาสดีแบบไม่คาดคิด',
    reversedMeaning: 'อย่าเพิ่งใจร้อนตัดสินใจ วางแผนให้รอบคอบอีกนิด',
  },
  {
    id: 1,
    nameEn: 'The Magician',
    nameTh: 'คนเก่งครบเครื่อง',
    icon: '🪄',
    uprightMeaning: 'ลุยได้เลย คุณมีความสามารถจัดการเรื่องนี้ได้สำเร็จแน่นอน',
    reversedMeaning: 'มีของดีในตัวแต่ยังลังเล ลองลงมือทำจริงจะเห็นผลไวกว่าคิดวนไปมา',
  },
  {
    id: 2,
    nameEn: 'The High Priestess',
    nameTh: 'เซนส์แรงอ่านขาด',
    icon: '🌙',
    uprightMeaning: 'เชื่อสัญชาตญาณตัวเองได้เลย ค่อยๆ ดูสถานการณ์อย่างใจเย็น',
    reversedMeaning: 'อย่าเพิ่งคิดมากไปเอง รอดูข้อมูลจริงให้ชัดก่อน',
  },
  {
    id: 3,
    nameEn: 'The Empress',
    nameTh: 'ความอุดมสมบูรณ์',
    icon: '👑',
    uprightMeaning: 'ดวงดี มีคนเอ็นดูช่วยเหลือ เรื่องเงินและความสุขสมบูรณ์พูนผล',
    reversedMeaning: 'ระวังตามใจปากหรือตามใจตัวเองมากไปนิด ดึงวินัยกลับมาหน่อยจะดีมาก',
  },
  {
    id: 4,
    nameEn: 'The Emperor',
    nameTh: 'ความมั่นคงชัดเจน',
    icon: '🦁',
    uprightMeaning: 'สำเร็จได้ด้วยความมีวินัย เด็ดขาด และทำตามแผนที่วางไว้',
    reversedMeaning: 'อย่ากดดันตัวเองจนเครียดเกินไป ผ่อนปรนบ้างจะสบายใจขึ้น',
  },
  {
    id: 5,
    nameEn: 'The Hierophant',
    nameTh: 'ผู้ใหญ่ช่วยเหลือ',
    icon: '🔑',
    uprightMeaning: 'มีผู้ใหญ่หรือคนมีประสบการณ์คอยให้คำแนะนำที่พึ่งพาได้',
    reversedMeaning: 'ลองปรับวิธีใหม่ๆ ไม่ต้องยึดติดกรอบเดิมแล้วจะเวิร์กกว่า',
  },
  {
    id: 6,
    nameEn: 'The Lovers',
    nameTh: 'ความรักและทางเลือก',
    icon: '💞',
    uprightMeaning: 'ความสัมพันธ์ดี เข้าขากันง่าย หรือได้เลือกสิ่งที่ตรงใจตัวเอง',
    reversedMeaning: 'กำลังลังเลเลือกไม่ถูก ค่อยๆ ถามใจตัวเองว่าต้องการอะไรจริงๆ',
  },
  {
    id: 7,
    nameEn: 'The Chariot',
    nameTh: 'ลุยพุ่งชนเป้าหมาย',
    icon: '🏇',
    uprightMeaning: 'ตั้งใจลุยเต็มที่แล้วชนะแน่นอน มีพลังใจฮึดสู้สุดๆ',
    reversedMeaning: 'เร่งตัวเองหนักไปจนเหนื่อย พักชาร์จพลังนิดแล้วค่อยไปต่อ',
  },
  {
    id: 8,
    nameEn: 'Strength',
    nameTh: 'ความอดทนชนะทุกอย่าง',
    icon: '🔥',
    uprightMeaning: 'ใจแข็งและสม่ำเสมอเข้าไว้ เรื่องยากแค่ไหนก็เอาอยู่',
    reversedMeaning: 'ช่วงนี้แอบเหนื่อยหรือท้อใจง่าย ให้กำลังใจตัวเองเยอะๆ ก่อนลุยต่อ',
  },
  {
    id: 9,
    nameEn: 'The Hermit',
    nameTh: 'ทบทวนตัวเองเงียบๆ',
    icon: '🏮',
    uprightMeaning: 'ลองใช้เวลาอยู่กับตัวเองเงียบๆ จะคิดคำตอบดีๆ ออกได้เอง',
    reversedMeaning: 'อย่าเก็บความเครียดไว้คนเดียว ลองปรึกษาเพื่อนสนิทจะช่วยได้เยอะ',
  },
  {
    id: 10,
    nameEn: 'Wheel of Fortune',
    nameTh: 'กงล้อโชคดีหมุนมาหา',
    icon: '🎡',
    uprightMeaning: 'ดวงกำลังขาขึ้น! จังหวะดี โอกาสทองและโชคลาภกำลังเข้ามา',
    reversedMeaning: 'ช่วงนี้อาจมีเรื่องเปลี่ยนแปลงปุบปับ ค่อยๆ ปรับตัวตามสถานการณ์ไปก่อน',
  },
  {
    id: 11,
    nameEn: 'Justice',
    nameTh: 'ทำอย่างไรได้อย่างนั้น',
    icon: '⚖️',
    uprightMeaning: 'ยุติธรรมและชัดเจน ขยันแค่ไหนก็ได้ผลลัพธ์คุ้มค่าแค่นั้นเลย',
    reversedMeaning: 'ระวังจัดเวลาชีวิตไม่สมดุล พักผ่อนน้อย หรือตัดสินใจตอนอารมณ์ร้อน',
  },
  {
    id: 12,
    nameEn: 'The Hanged Man',
    nameTh: 'หยุดพักเปลี่ยนมุมมอง',
    icon: '🙃',
    uprightMeaning: 'ไม่ต้องรีบ ลองมองเรื่องเดิมในมุมใหม่แล้วจะเห็นทางออกง่ายๆ',
    reversedMeaning: 'เรื่องไหนฝืนแล้วเหนื่อย ลองปล่อยวางดูจะโล่งขึ้นทันที',
  },
  {
    id: 13,
    nameEn: 'Death',
    nameTh: 'จบเรื่องเก่าเริ่มสิ่งใหม่',
    icon: '🦋',
    uprightMeaning: 'ได้เวลาทิ้งวิธีเดิมที่ไม่เวิร์ก แล้วเริ่มต้นใหม่ที่ดีกว่าเดิมมาก',
    reversedMeaning: 'อย่ามัวเสียดายเรื่องเก่า กล้าเปลี่ยนแปลงแล้วชีวิตจะเดินหน้าไว',
  },
  {
    id: 14,
    nameEn: 'Temperance',
    nameTh: 'ความพอดีลงตัว',
    icon: '🏺',
    uprightMeaning: 'ค่อยเป็นค่อยไปแบบสายกลาง ราบรื่น สบายใจ และทำได้นาน',
    reversedMeaning: 'ระวังทำอะไรสุดโต่งเกินไป เดี๋ยวฟิตจัดเดี๋ยวปล่อยจอย',
  },
  {
    id: 15,
    nameEn: 'The Devil',
    nameTh: 'ระวังใจอ่อนแพ้สิ่งล่อใจ',
    icon: '😈',
    uprightMeaning: 'เสน่ห์แรง แต่ต้องระวังใจอ่อนให้ของอร่อย การช้อป หรือความขี้เกียจ!',
    reversedMeaning: 'เก่งมาก! กำลังตัดใจจากนิสัยเดิมๆ ที่ฉุดรั้งคุณได้สำเร็จ',
  },
  {
    id: 16,
    nameEn: 'The Tower',
    nameTh: 'เปลี่ยนแปลงปุบปับ',
    icon: '⚡',
    uprightMeaning: 'อาจมีเรื่องเปลี่ยนแผนกะทันหัน แต่ช่วยให้เคลียร์ปัญหาเก่าจบไวขึ้น',
    reversedMeaning: 'ไหวตัวทัน แก้ปัญหาเล็กๆ ได้ก่อนจะกลายเป็นเรื่องใหญ่',
  },
  {
    id: 17,
    nameEn: 'The Star',
    nameTh: 'ความหวังและข่าวดี',
    icon: '🌟',
    uprightMeaning: 'สดใสสบายใจ มีข่าวดีเข้ามา สุขภาพและกำลังใจฟื้นตัวดีมาก',
    reversedMeaning: 'อย่าเพิ่งหมดหวังกับผลระยะสั้น ทำต่อไปเรื่อยๆ เดี๋ยวดีขึ้นแน่นอน',
  },
  {
    id: 18,
    nameEn: 'The Moon',
    nameTh: 'ยังไม่ชัดเจน รอดูก่อน',
    icon: '🌕',
    uprightMeaning: 'เรื่องยังคลุมเครือ อย่าเพิ่งรีบฟันธง รอดูความชัดเจนอีกนิด',
    reversedMeaning: 'ความสงสัยหรือเรื่องที่คาใจกำลังจะกระจ่างชัดขึ้นเร็วๆ นี้',
  },
  {
    id: 19,
    nameEn: 'The Sun',
    nameTh: 'ดวงปังรุ่งโรจน์สุดๆ',
    icon: '☀️',
    uprightMeaning: 'ดีที่สุด! สมหวัง สำเร็จสดใส มีทั้งข่าวดีและพลังบวกเต็มร้อย',
    reversedMeaning: 'สำเร็จแน่นอน แต่อาจช้ากว่าที่คิดนิดเดียว ใจเย็นๆ รอรับข่าวดีได้เลย',
  },
  {
    id: 20,
    nameEn: 'Judgement',
    nameTh: 'ได้รับผลตอบแทนที่รอคอย',
    icon: '📯',
    uprightMeaning: 'สิ่งที่ทุ่มเททำมากำลังเห็นผล ได้รับข่าวดีหรือโอกาสดีครั้งใหม่',
    reversedMeaning: 'อย่ามัวโทษตัวเองกับเรื่องที่ผ่านไปแล้ว โฟกัสทำวันนี้ให้ดีก็พอ',
  },
  {
    id: 21,
    nameEn: 'The World',
    nameTh: 'สำเร็จครบสมบูรณ์',
    icon: '🌍',
    uprightMeaning: 'ถึงเส้นชัยตามเป้าหมาย! แฮปปี้ลงตัวทุกด้านอย่างสวยงาม',
    reversedMeaning: 'ใกล้สำเร็จมากแล้ว เหลือเก็บรายละเอียดอีกนิดเดียวเท่านั้น!',
  },
];

export const ESIIMSI_STICKS: EsiimsiStickDef[] = [
  {
    number: 1,
    grade: 'ดีมาก',
    poem: [
      'ใบนี้ดีเหมือนแสงตะวันส่อง',
      'คิดสิ่งใดสมปองดังใจหมาย',
      'มีคนช่วยหนุนนำทำให้ง่าย',
      'ทั้งโชคลาภมากมายเข้ามาพลัน',
    ],
    coreMeaning: 'ดวงเปิดดีมาก คิดหรือเริ่มทำอะไรก็ราบรื่น มีคนคอยช่วยเหลือ',
  },
  {
    number: 4,
    grade: 'ดี',
    poem: [
      'เหนื่อยตอนต้นแต่อย่าเพิ่งท้อถอย',
      'ค่อยๆ ทำทีละน้อยตามจุดหมาย',
      'เหมือนมีลมช่วยพัดตอนช่วงท้าย',
      'ผลลัพธ์ได้สมใจหายเหนื่อยเอย',
    ],
    coreMeaning: 'ช่วงแรกอาจเหนื่อยหน่อย แต่ทำต่อไปแล้วตอนจบออกมาดีแน่นอน',
  },
  {
    number: 7,
    grade: 'กลางๆ',
    poem: [
      'ช่วงนี้เหมือนเมฆบังแสงจันทร์ไว้',
      'อดทนใจรอก่อนอย่าผลีผลาม',
      'ทำหน้าที่ให้ดีทุกโมงยาม',
      'ไม่ช้านานฟ้าใสได้ชื่นใจ',
    ],
    coreMeaning: 'ใจเย็นๆ อย่าเพิ่งรีบร้อน รักษาความสม่ำเสมอไว้แล้วเดี๋ยวดีขึ้นเอง',
  },
  {
    number: 9,
    grade: 'ดีมาก',
    poem: [
      'เลขเก้าก้าวหน้าพารุ่งเรือง',
      'เรื่องขุ่นเคืองหมดไปใจผ่องใส',
      'ทั้งการงานความรักสมดั่งใจ',
      'สุขภาพสดใสแข็งแรงดี',
    ],
    coreMeaning: 'จังหวะก้าวหน้าสุดๆ ทั้งงาน เงิน ความรัก และสุขภาพไปในทางที่ดีพร้อมกัน',
  },
  {
    number: 12,
    grade: 'ดี',
    poem: [
      'เหมือนปลูกต้นไม้ไว้ด้วยความเพียร',
      'หมั่นรดน้ำวนเวียนไม่ขาดสาย',
      'ถึงเวลาออกผลให้สบาย',
      'สิ่งที่หมายคุ้มค่าเวลาคอย',
    ],
    coreMeaning: 'สิ่งที่อดทนทำสะสมมาตลอด กำลังจะเห็นผลลัพธ์ที่คุ้มเหนื่อย',
  },
  {
    number: 15,
    grade: 'ดีมาก',
    poem: [
      'ดวงเมตตาใครเห็นก็เอ็นดู',
      'พูดจาดีน่าฟังคนเปิดทาง',
      'ขอความช่วยเหลือใดไม่เคว้งคว้าง',
      'รักสดใสเคียงข้างอบอุ่นใจ',
    ],
    coreMeaning: 'ช่วงนี้เสน่ห์ดี คนรอบข้างเมตตา คุยงานหรือคุยกับคนที่ชอบจะราบรื่น',
  },
  {
    number: 19,
    grade: 'ควรระวัง',
    poem: [
      'ใบนี้เตือนให้คิดอย่างรอบคอบ',
      'อย่าใจร้อนรีบตอบหรือหักโหม',
      'พักกายใจให้พร้อมก่อนจู่โจม',
      'ตั้งสติดีแล้วจึงค่อยเดินทาง',
    ],
    coreMeaning: 'ระวังความใจร้อนหรือพักผ่อนน้อย คิดทบทวนดีๆ ก่อนตัดสินใจเรื่องสำคัญ',
  },
  {
    number: 22,
    grade: 'ดี',
    poem: [
      'มีเพื่อนดีคู่คิดช่วยส่งเสริม',
      'ช่วยต่อเติมกำลังใจไม่หวั่นไหว',
      'ทำคนเดียวอาจช้ากว่าตั้งใจ',
      'ร่วมมือกันเมื่อไหร่สำเร็จไว',
    ],
    coreMeaning: 'ทำร่วมกับเพื่อน แฟน หรือทีมงานจะสำเร็จง่ายกว่าลุยเดี่ยว',
  },
  {
    number: 24,
    grade: 'กลางๆ',
    poem: [
      'โอกาสมาพร้อมงานที่ต้องลุย',
      'ค่อยๆ คุยค่อยๆ จัดให้เข้าที่',
      'แบ่งเวลาพักผ่อนให้พอดี',
      'ไม่นานนี้มีข่าวดีให้ยิ้มบาน',
    ],
    coreMeaning: 'มีโอกาสดีเข้ามาแต่อาจยุ่งหน่อย จัดเวลาพักผ่อนให้ดีแล้วจะผ่านฉลุย',
  },
  {
    number: 28,
    grade: 'ดีมาก',
    poem: [
      'อุปสรรคผ่านพ้นจนหมดสิ้น',
      'ได้ยลยินข่าวดีมีศักดิ์ศรี',
      'ความพยายามส่งผลในวันนี้',
      'รับรางวัลคนเก่งอย่างภาคภูมิ',
    ],
    coreMeaning: 'หมดเคราะห์หมดเรื่องกังวล เตรียมรับความสำเร็จและข่าวดีจากความตั้งใจได้เลย',
  },
];

export const CRYSTAL_AURAS: CrystalAuraDef[] = [
  {
    id: 'gold_solar',
    nameTh: 'ออร่าสีทอง (ดวงโชคลาภ & ความสำเร็จ)',
    elementTh: 'พลังความมั่นใจสูง',
    colorHex: '#facc15',
    glowClass: 'from-amber-300 via-yellow-400 to-orange-500',
    icon: '🌞',
    energyMeaning: 'ช่วงนี้ดวงโดดเด่นเรื่องความสำเร็จและโชคลาภ มั่นใจในตัวเองแล้วลุยได้เลย',
  },
  {
    id: 'rose_quartz',
    nameTh: 'ออร่าสีชมพู (ดวงเสน่ห์ & คนเมตตา)',
    elementTh: 'พลังความอบอุ่นเป็นมิตร',
    colorHex: '#f472b6',
    glowClass: 'from-pink-300 via-rose-400 to-fuchsia-500',
    icon: '🌸',
    energyMeaning: 'ความรักและมนุษยสัมพันธ์ดีมาก คนรอบข้างอยากเข้าหาและคอยช่วยเหลือ',
  },
  {
    id: 'emerald_vital',
    nameTh: 'ออร่าสีเขียว (ดวงสุขภาพ & การเติบโต)',
    elementTh: 'พลังฟื้นฟูร่างกายและจิตใจ',
    colorHex: '#34d399',
    glowClass: 'from-emerald-300 via-teal-400 to-green-500',
    icon: '🍀',
    energyMeaning: 'สุขภาพดีขึ้น การเงินและสิ่งที่กำลังปั้นอยู่ค่อยๆ เติบโตอย่างมั่นคง',
  },
  {
    id: 'violet_mystic',
    nameTh: 'ออร่าสีม่วง (ดวงเซนส์แม่น & ไอเดียปัง)',
    elementTh: 'พลังความคิดสร้างสรรค์',
    colorHex: '#c084fc',
    glowClass: 'from-purple-300 via-violet-500 to-indigo-600',
    icon: '🔮',
    energyMeaning: 'เซนส์แม่น คิดแก้ปัญหาเก่ง มีโอกาสเจอทางลัดหรือไอเดียใหม่ที่ดีมาก',
  },
  {
    id: 'cyan_aurora',
    nameTh: 'ออร่าสีฟ้า (ดวงสบายใจ & คุยราบรื่น)',
    elementTh: 'พลังความปลอดโปร่งใจเย็น',
    colorHex: '#38bdf8',
    glowClass: 'from-cyan-300 via-sky-400 to-blue-500',
    icon: '❄️',
    energyMeaning: 'เรื่องวุ่นๆ กำลังเบาลง คุยตกลงอะไรกับใครก็เข้าใจตรงกันง่ายขึ้น',
  },
  {
    id: 'crimson_passion',
    nameTh: 'ออร่าสีแดง (ดวงไฟแรง & พร้อมลุย)',
    elementTh: 'พลังความมุ่งมั่นเต็มร้อย',
    colorHex: '#fb7185',
    glowClass: 'from-rose-400 via-red-500 to-orange-600',
    icon: '🔥',
    energyMeaning: 'มีไฟในการลงมือทำสุดๆ เหมาะกับการฟิตหุ่น ลุยงานสำคัญ หรือเริ่มเป้าหมายใหม่',
  },
];

export const RUNE_STONES: RuneStoneDef[] = [
  { id: 'fehu', symbol: 'ᚠ', name: 'Fehu', nameTh: 'รูนโชคลาภ', meaningTh: 'การเงินดี มีโอกาสได้รางวัลหรือผลตอบแทนคุ้มเหนื่อย' },
  { id: 'uruz', symbol: 'ᚢ', name: 'Uruz', nameTh: 'รูนพลังกาย', meaningTh: 'ร่างกายแข็งแรง มีแรงฮึดก้าวข้ามเรื่องยากๆ ได้สำเร็จ' },
  { id: 'ansuz', symbol: 'ᚨ', name: 'Ansuz', nameTh: 'รูนข่าวดี', meaningTh: 'กำลังจะได้รับข่าวดี หรือคุยเจรจาแล้วได้ผลลัพธ์ที่ถูกใจ' },
  { id: 'raidho', symbol: 'ᚱ', name: 'Raidho', nameTh: 'รูนก้าวหน้า', meaningTh: 'มาถูกทางแล้ว เดินหน้าทำต่อได้เลยไม่ต้องลังเล' },
  { id: 'kenaz', symbol: 'ᚲ', name: 'Kenaz', nameTh: 'รูนทางสว่าง', meaningTh: 'คิดออกว่าจะแก้ปัญหายังไง เห็นทางไปต่อชัดเจน' },
  { id: 'gebo', symbol: 'ᚷ', name: 'Gebo', nameTh: 'รูนมิตรภาพ & ความรัก', meaningTh: 'ความสัมพันธ์ดี มีคนใจดีหยิบยื่นความช่วยเหลือให้' },
  { id: 'wunjo', symbol: 'ᚹ', name: 'Wunjo', nameTh: 'รูนสมหวัง', meaningTh: 'เรื่องที่กังวลจะคลี่คลาย มีเรื่องให้ยิ้มออกและสบายใจขึ้น' },
  { id: 'jera', symbol: 'ᛃ', name: 'Jera', nameTh: 'รูนเก็บเกี่ยวผล', meaningTh: 'ความสม่ำเสมอที่ผ่านมาเริ่มออกผลให้เห็นชัดเจนแล้ว' },
  { id: 'sowilo', symbol: 'ᛊ', name: 'Sowilo', nameTh: 'รูนชัยชนะ', meaningTh: 'ดวงชนะอุปสรรค ทำสำเร็จตามที่ตั้งเป้าไว้' },
  { id: 'algiz', symbol: 'ᛉ', name: 'Algiz', nameTh: 'รูนคุ้มครอง', meaningTh: 'ปลอดภัยแคล้วคลาด รอดพ้นจากเรื่องปวดหัวหวุดหวิด' },
  { id: 'berkano', symbol: 'ᛒ', name: 'Berkano', nameTh: 'รูนเริ่มต้นสดใส', meaningTh: 'เหมาะกับการเริ่มดูแลตัวเองหรือเริ่มต้นสิ่งดีๆ ครั้งใหม่' },
  { id: 'dagaz', symbol: 'ᛞ', name: 'Dagaz', nameTh: 'รูนพลิกดวงดี', meaningTh: 'สถานการณ์กำลังพลิกจากติดขัดเป็นราบรื่นขึ้นทันตา' },
];

export const BIRTH_DAYS: BirthDayOption[] = [
  { id: 'sunday', label: 'วันอาทิตย์', planetTh: 'คนมีความมุ่งมั่นใจนักเลง', luckyColorTh: 'สีเขียว & สีทอง' },
  { id: 'monday', label: 'วันจันทร์', planetTh: 'คนอ่อนโยนช่างสังเกต', luckyColorTh: 'สีม่วง & สีขาว' },
  { id: 'tuesday', label: 'วันอังคาร', planetTh: 'คนขยันลุยจริงจัง', luckyColorTh: 'สีส้ม & สีชมพู' },
  { id: 'wednesday', label: 'วันพุธ', planetTh: 'คนไหวพริบดีคุยเก่ง', luckyColorTh: 'สีเหลือง & สีเขียวมิ้นต์' },
  { id: 'thursday', label: 'วันพฤหัสบดี', planetTh: 'คนมีเหตุผลผู้ใหญ่เอ็นดู', luckyColorTh: 'สีฟ้า & สีแดง' },
  { id: 'friday', label: 'วันศุกร์', planetTh: 'คนอารมณ์ดีมีเสน่ห์', luckyColorTh: 'สีชมพู & สีเหลืองอ่อน' },
  { id: 'saturday', label: 'วันเสาร์', planetTh: 'คนอดทนหนักแน่น', luckyColorTh: 'สีฟ้าคราม & สีเงิน' },
];

export const ZODIAC_SIGNS: ZodiacOption[] = [
  { id: 'aries', label: 'ราศีเมษ', icon: '♈', elementTh: 'ธาตุไฟ' },
  { id: 'taurus', label: 'ราศีพฤษภ', icon: '♉', elementTh: 'ธาตุดิน' },
  { id: 'gemini', label: 'ราศีเมถุน', icon: '♊', elementTh: 'ธาตุลม' },
  { id: 'cancer', label: 'ราศีกรกฎ', icon: '♋', elementTh: 'ธาตุน้ำ' },
  { id: 'leo', label: 'ราศีสิงห์', icon: '♌', elementTh: 'ธาตุไฟ' },
  { id: 'virgo', label: 'ราศีกันย์', icon: '♍', elementTh: 'ธาตุดิน' },
  { id: 'libra', label: 'ราศีตุลย์', icon: '♎', elementTh: 'ธาตุลม' },
  { id: 'scorpio', label: 'ราศีพิจิก', icon: '♏', elementTh: 'ธาตุน้ำ' },
  { id: 'sagittarius', label: 'ราศีธนู', icon: '♐', elementTh: 'ธาตุไฟ' },
  { id: 'capricorn', label: 'ราศีมังกร', icon: '♑', elementTh: 'ธาตุดิน' },
  { id: 'aquarius', label: 'ราศีกุมภ์', icon: '♒', elementTh: 'ธาตุลม' },
  { id: 'pisces', label: 'ราศีมีน', icon: '♓', elementTh: 'ธาตุน้ำ' },
];

export function drawRandomTarotSpread(): DrawnTarotCard[] {
  const pool = [...TAROT_MAJOR_ARCANA];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const positions: DrawnTarotCard['positionLabel'][] = [
    'ที่ผ่านมา',
    'ตอนนี้',
    'แนวโน้มข้างหน้า',
  ];
  return positions.map((positionLabel, idx) => ({
    card: pool[idx],
    isReversed: Math.random() < 0.24,
    positionLabel,
  }));
}

export function drawRandomEsiimsiStick(): EsiimsiStickDef {
  const base = ESIIMSI_STICKS[Math.floor(Math.random() * ESIIMSI_STICKS.length)];
  const stickNo = Math.floor(Math.random() * 28) + 1;
  return {
    ...base,
    number: stickNo,
  };
}

export function drawRandomCrystalAura(): CrystalAuraDef {
  return CRYSTAL_AURAS[Math.floor(Math.random() * CRYSTAL_AURAS.length)];
}

export function drawRandomRuneCast(): { runes: RuneStoneDef[]; lifePathCode: number } {
  const pool = [...RUNE_STONES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const lifePathCode = Math.floor(Math.random() * 9) + 1;
  return {
    runes: pool.slice(0, 3),
    lifePathCode,
  };
}

export function buildFallbackFortuneReading(params: {
  methodId: DivinationMethodId;
  topicId: FortuneTopicId;
  question: string;
  artifactSummary: string;
  playerName?: string;
}): FortuneReadingResponse {
  const topic = FORTUNE_TOPICS.find((t) => t.id === params.topicId) || FORTUNE_TOPICS[4];
  const namePrefix = params.playerName ? `คุณ${params.playerName}` : 'คุณ';
  const cleanQ = params.question.trim().slice(0, 120);

  const topicAdviceMap: Record<FortuneTopicId, { answer: string; tip: string; stars: number }> = {
    love: {
      answer: 'แนวโน้มความรักไปในทางที่ดีขึ้น ยิ่งคุยกันตรงๆ แบบใจเย็น ไม่คิดไปเองก่อน จะยิ่งเข้าใจกันง่ายและมีเกณฑ์ได้ความชัดเจนที่ทำให้ยิ้มออก',
      tip: 'เป็นตัวของตัวเองและทักทายด้วยความสดใส ไม่ต้องเกร็งหรือรีบเร่งเกินไป',
      stars: 4,
    },
    wealth: {
      answer: 'การเงินและโชคลาภมีจังหวะขยับดีขึ้น สิ่งที่ลงแรงไว้มีโอกาสได้ผลตอบแทนคุ้มค่า แค่ระวังรายจ่ายจุกจิกตามอารมณ์ก็จะเก็บเงินอยู่สบายๆ',
      tip: 'แบ่งเงินเก็บไว้ก่อนใช้ และคิดสักนิดก่อนกดซื้อของชิ้นใหญ่',
      stars: 5,
    },
    career: {
      answer: 'เรื่องงานหรือสิ่งที่กำลังลุยอยู่มีโอกาสผ่านฉลุย จุดที่เคยติดขัดจะเริ่มเห็นทางแก้ และมีคนมองเห็นความตั้งใจของคุณ',
      tip: 'เลือกเคลียร์งานสำคัญที่สุดให้จบทีละชิ้น จะช่วยลดความเหนื่อยและเห็นผลไวมาก',
      stars: 4,
    },
    health: {
      answer: 'มีโอกาสทำตามเป้าหมายสุขภาพและลดเอวได้สำเร็จ! ขอแค่ทำต่อเนื่องวันละนิดไม่ต้องหักโหม ร่างกายกำลังปรับตัวไปในทางที่ฟิตขึ้นชัดเจน',
      tip: 'ดื่มน้ำเปล่าเยอะๆ นอนให้พอ และขยับร่างกายสม่ำเสมอทุกวัน',
      stars: 5,
    },
    overall: {
      answer: 'จังหวะชีวิตช่วงนี้กำลังค่อยๆ โปร่งโล่งขึ้น เรื่องที่กังวลใจจะคลี่คลาย และมีโอกาสดีๆ เข้ามาช่วยให้มีกำลังใจเดินหน้าต่อ',
      tip: 'ตั้งเป้าหมายเล็กๆ ที่ทำได้จริงในแต่ละวัน จะช่วยให้ทุกอย่างเข้าที่เร็วขึ้น',
      stars: 4,
    },
  };

  const picked = topicAdviceMap[params.topicId];
  const colors = ['สีม่วง', 'สีทอง', 'สีเขียวมิ้นต์', 'สีฟ้าสดใส', 'สีชมพู', 'สีขาว'];
  const hashSeed = (params.artifactSummary + cleanQ + params.topicId)
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const luckyColor = colors[hashSeed % colors.length];
  const n1 = ((hashSeed * 7) % 89) + 10;
  const n2 = ((hashSeed * 13 + 29) % 89) + 10;

  return {
    headline: `คำตอบเรื่อง${topic.label}ของคุณมีแนวโน้มสดใส!`,
    reading: `${namePrefix} สำหรับคำถามที่ถามว่า "${cleanQ}" — จากผลเสี่ยงทายที่ได้ (${params.artifactSummary}) แม่หมอสรุปให้เข้าใจง่ายๆ เลยว่า ${picked.answer}`,
    advice: picked.tip,
    luckyColor,
    luckyNumbers: `${n1}, ${n2}`,
    starRating: picked.stars,
    source: 'fallback',
  };
}
