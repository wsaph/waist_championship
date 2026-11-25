export type CasinoGameType = 'pokdeng' | 'blackjack' | 'holdem' | 'oldmaid';
export type CardSuit = 'S' | 'H' | 'D' | 'C';
export type CardRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13; // 1=A, 11=J, 12=Q, 13=K

export interface PlayingCard {
  id: string;
  suit: CardSuit;
  rank: CardRank;
}

export const SUIT_SYMBOL: Record<CardSuit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

export const SUIT_IS_RED: Record<CardSuit, boolean> = {
  S: false,
  H: true,
  D: true,
  C: false,
};

export function rankLabel(rank: CardRank): string {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

export function createShuffledDeck(excludeCardId?: string): PlayingCard[] {
  const suits: CardSuit[] = ['S', 'H', 'D', 'C'];
  const deck: PlayingCard[] = [];
  for (const suit of suits) {
    for (let r = 1; r <= 13; r++) {
      const rank = r as CardRank;
      const id = `${rank}${suit}`;
      if (excludeCardId && id === excludeCardId) continue;
      deck.push({ id, suit, rank });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ============================================================
// GUARD DEALER SMUGNESS SYSTEM (ยิ่งกินเยอะ ยิ่งยิ้มน่าเตะ!)
// ============================================================
export type GuardMoodId = 'cry' | 'annoyed' | 'neutral' | 'smirk' | 'grin' | 'mega_troll';

export interface GuardMoodMeta {
  id: GuardMoodId;
  badge: string;
  speech: string;
  ringClass: string;
}

const MOOD_LINES: Record<GuardMoodId, string[]> = {
  cry: [
    'โอ๊ยยย หมดตูดแล้ว!! ใครแอบสับไพ่?! 😭',
    'พี่ยามร้องไห้แล้วนะ กินกันไม่เกรงใจเลย!!',
    'ขอเวลาทำใจแป๊บ โดนป๊อกเด้งยับเลย!!',
  ],
  annoyed: [
    'ฟลุ๊คเฉยๆ ตาหน้าพี่ยามเอาคืนแน่! 😒',
    'เชอะ! ดวงดีแค่ตานี้แหละ เดี๋ยวรู้เรื่อง!',
  ],
  neutral: [
    'วางชิปมาได้เลยจ้า พี่ยามพร้อมแจกไพ่แล้ว!',
    'เจ๊ากันไป ตาหน้าลงหนักๆ หน่อยสิ!',
  ],
  smirk: [
    'ขอบใจนะจ๊ะ ขอรับ GP ไปเก็บก่อนนะ~ 😏',
    'หึๆ นิดๆ หน่อยๆ พี่ยามก็เก็บหมดแหละ~',
  ],
  grin: [
    'ฮ่าๆๆ หวานเจี๊ยบ!! เติม GP มาให้พี่ยามอีก! 😁✨',
    'ยิ้มจนปวดแก้มแล้วเนี่ย ขอบคุณผู้ใจบุญทุกคน!!',
  ],
  mega_troll: [
    'รวยเละ!! กินเรียบรอบวง!! ขอบคุณผู้สนับสนุนหลักอย่างเป็นทางการ!! 😈👑💰',
    'ฮ่าๆๆๆ ยิ้มน่าเตะไหมล่ะ?! หมดหน้าตักกันยังพวกเรา!! 😈✨',
  ],
};

export function resolveGuardMood(dealerNetGp: number): GuardMoodMeta {
  let id: GuardMoodId = 'neutral';
  if (dealerNetGp <= -20) id = 'cry';
  else if (dealerNetGp < 0) id = 'annoyed';
  else if (dealerNetGp === 0) id = 'neutral';
  else if (dealerNetGp < 20) id = 'smirk';
  else if (dealerNetGp < 50) id = 'grin';
  else id = 'mega_troll';

  const pool = MOOD_LINES[id];
  const speech = pool[Math.floor(Math.random() * pool.length)];

  const badges: Record<GuardMoodId, { badge: string; ringClass: string }> = {
    cry: { badge: '😭 พี่ยามร้องไห้', ringClass: 'border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.6)]' },
    annoyed: { badge: '😒 พี่ยามคิ้วขมวด', ringClass: 'border-amber-500' },
    neutral: { badge: '👮 เจ้ามือพี่ยาม', ringClass: 'border-amber-400' },
    smirk: { badge: '😏 ยิ้มมุมปาก', ringClass: 'border-amber-300 shadow-[0_0_18px_rgba(250,204,21,0.55)]' },
    grin: { badge: '😁 ยิ้มกว้างฟันขาว!', ringClass: 'border-yellow-300 shadow-[0_0_26px_rgba(250,204,21,0.85)]' },
    mega_troll: { badge: '😈 ยิ้มน่าเตะ MAX!!', ringClass: 'border-yellow-200 shadow-[0_0_36px_rgba(253,224,71,1)]' },
  };

  return { id, speech, ...badges[id] };
}

// ============================================================
// CASINO AUDIO SFX (Web Audio API)
// ============================================================
let casinoAudioCtx: AudioContext | null = null;
function getCasinoAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!casinoAudioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) casinoAudioCtx = new Ctx();
  }
  if (casinoAudioCtx && casinoAudioCtx.state === 'suspended') {
    casinoAudioCtx.resume().catch(() => {});
  }
  return casinoAudioCtx;
}

export function playCasinoSound(kind: 'deal' | 'chip' | 'win' | 'lose' | 'pok', muted = false): void {
  if (muted) return;
  const ctx = getCasinoAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (kind === 'deal') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.055);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.065);
  } else if (kind === 'chip') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.05);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.065);
  } else if (kind === 'pok' || kind === 'win') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.09);
    osc.frequency.setValueAtTime(783.99, now + 0.18);
    osc.frequency.setValueAtTime(1046.5, now + 0.27);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    osc.start(now);
    osc.stop(now + 0.45);
  } else if (kind === 'lose') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.setValueAtTime(260, now + 0.1);
    osc.frequency.setValueAtTime(180, now + 0.2);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.start(now);
    osc.stop(now + 0.35);
  }
}
