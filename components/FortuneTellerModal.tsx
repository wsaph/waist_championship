'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  BIRTH_DAYS,
  DIVINATION_METHODS,
  FORTUNE_TOPICS,
  ZODIAC_SIGNS,
  drawRandomCrystalAura,
  drawRandomEsiimsiStick,
  drawRandomRuneCast,
  drawRandomTarotSpread,
  type CrystalAuraDef,
  type DivinationMethodId,
  type DrawnTarotCard,
  type EsiimsiStickDef,
  type FortuneReadingResponse,
  type FortuneTopicId,
  type RuneStoneDef,
} from '@/lib/fortune_teller';

interface FortuneTellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName?: string;
}

type ModalStep = 'setup' | 'ritual' | 'result';

const POSITION_LABELS: Array<'ที่ผ่านมา' | 'ตอนนี้' | 'แนวโน้มข้างหน้า'> = [
  'ที่ผ่านมา',
  'ตอนนี้',
  'แนวโน้มข้างหน้า',
];

export function FortuneTellerModal({
  isOpen,
  onClose,
  playerName = 'ผู้กล้า',
}: FortuneTellerModalProps) {
  const [step, setStep] = useState<ModalStep>('setup');
  const [methodId, setMethodId] = useState<DivinationMethodId>('tarot');
  const [topicId, setTopicId] = useState<FortuneTopicId>('overall');
  const [question, setQuestion] = useState('');
  const [setupError, setSetupError] = useState('');
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Ritual states for each of the 5 divination arts
  const [deckOrder, setDeckOrder] = useState<DrawnTarotCard[]>(() => drawRandomTarotSpread());
  const [pickedSlots, setPickedSlots] = useState<number[]>([]);
  const [shuffleAnim, setShuffleAnim] = useState(false);

  const [shakingStick, setShakingStick] = useState(false);
  const [esiimsiResult, setEsiimsiResult] = useState<EsiimsiStickDef | null>(null);

  const [channelingOrb, setChannelingOrb] = useState(false);
  const [auraResult, setAuraResult] = useState<CrystalAuraDef | null>(null);

  const [birthDayId, setBirthDayId] = useState<string>('monday');
  const [zodiacId, setZodiacId] = useState<string>('aries');
  const [zodiacLocked, setZodiacLocked] = useState(false);

  const [castingRunes, setCastingRunes] = useState(false);
  const [runeResult, setRuneResult] = useState<{ runes: RuneStoneDef[]; lifePathCode: number } | null>(null);

  // AI reading state
  const [loadingReading, setLoadingReading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [readingResult, setReadingResult] = useState<FortuneReadingResponse | null>(null);

  const selectedMethod = useMemo(
    () => DIVINATION_METHODS.find((m) => m.id === methodId) || DIVINATION_METHODS[0],
    [methodId]
  );

  const selectedTopic = useMemo(
    () => FORTUNE_TOPICS.find((t) => t.id === topicId) || FORTUNE_TOPICS[4],
    [topicId]
  );

  const resetRitualState = (targetMethod: DivinationMethodId = methodId) => {
    setErrorMsg('');
    setReadingResult(null);
    if (targetMethod === 'tarot') {
      setDeckOrder(drawRandomTarotSpread());
      setPickedSlots([]);
    } else if (targetMethod === 'esiimsi') {
      setShakingStick(false);
      setEsiimsiResult(null);
    } else if (targetMethod === 'crystal_aura') {
      setChannelingOrb(false);
      setAuraResult(null);
    } else if (targetMethod === 'zodiac') {
      setZodiacLocked(false);
    } else if (targetMethod === 'runes') {
      setCastingRunes(false);
      setRuneResult(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setStep('setup');
    setSetupError('');
    setErrorMsg('');
    setReadingResult(null);
    resetRitualState(methodId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const hasQuestion = question.trim().length > 0;

  const handleStartRitual = () => {
    if (!question.trim()) {
      setSetupError('กรุณาพิมพ์คำถามที่อยากถามแม่หมอก่อนเริ่มดูดวงนะครับ');
      questionInputRef.current?.focus();
      return;
    }
    setSetupError('');
    resetRitualState(methodId);
    setStep('ritual');
  };

  const handleShuffleTarot = () => {
    if (shuffleAnim) return;
    setShuffleAnim(true);
    setPickedSlots([]);
    setDeckOrder(drawRandomTarotSpread());
    setTimeout(() => setShuffleAnim(false), 450);
  };

  const handlePickTarotSlot = (slotIdx: number) => {
    if (shuffleAnim || pickedSlots.includes(slotIdx) || pickedSlots.length >= 3) return;
    setPickedSlots((prev) => [...prev, slotIdx]);
  };

  const handleShakeEsiimsi = () => {
    if (shakingStick) return;
    setShakingStick(true);
    setEsiimsiResult(null);
    setTimeout(() => {
      setEsiimsiResult(drawRandomEsiimsiStick());
      setShakingStick(false);
    }, 850);
  };

  const handleChannelCrystal = () => {
    if (channelingOrb) return;
    setChannelingOrb(true);
    setAuraResult(null);
    setTimeout(() => {
      setAuraResult(drawRandomCrystalAura());
      setChannelingOrb(false);
    }, 850);
  };

  const handleCastRunes = () => {
    if (castingRunes) return;
    setCastingRunes(true);
    setRuneResult(null);
    setTimeout(() => {
      setRuneResult(drawRandomRuneCast());
      setCastingRunes(false);
    }, 750);
  };

  // Build simple, readable summary string for both the UI strip and AI prompt
  const buildArtifactSummary = (): string | null => {
    if (methodId === 'tarot') {
      if (pickedSlots.length < 3) return null;
      return deckOrder
        .map(
          (item, i) =>
            `${POSITION_LABELS[i]}: ไพ่${item.card.nameTh} (${item.card.nameEn} - ${
              item.isReversed
                ? 'กลับหัว: ' + item.card.reversedMeaning
                : item.card.uprightMeaning
            })`
        )
        .join(' | ');
    }
    if (methodId === 'esiimsi') {
      if (!esiimsiResult) return null;
      return `เซียมซีใบที่ ${esiimsiResult.number} (ดวง${esiimsiResult.grade}) — ${esiimsiResult.coreMeaning}`;
    }
    if (methodId === 'crystal_aura') {
      if (!auraResult) return null;
      return `${auraResult.nameTh} — ${auraResult.energyMeaning}`;
    }
    if (methodId === 'zodiac') {
      if (!zodiacLocked) return null;
      const bDay = BIRTH_DAYS.find((b) => b.id === birthDayId) || BIRTH_DAYS[0];
      const zSign = ZODIAC_SIGNS.find((z) => z.id === zodiacId) || ZODIAC_SIGNS[0];
      return `เกิด${bDay.label} (${bDay.planetTh}) ราศี${zSign.label.replace('ราศี', '')} (${zSign.elementTh}) สีนำโชคพื้นดวงคือ ${bDay.luckyColorTh}`;
    }
    if (methodId === 'runes') {
      if (!runeResult) return null;
      const runesText = runeResult.runes
        .map((r) => `${r.symbol} ${r.nameTh} (${r.meaningTh})`)
        .join(', ');
      return `หินรูน 3 ก้อน: ${runesText} | เลขนำโชคประจำตัวเลข ${runeResult.lifePathCode}`;
    }
    return null;
  };

  const artifactSummary = buildArtifactSummary();
  const isRitualComplete = Boolean(artifactSummary);

  const handleRequestProphecy = async () => {
    if (!artifactSummary || !question.trim() || loadingReading) return;
    setLoadingReading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methodId,
          topicId,
          question: question.trim(),
          artifactSummary,
          playerName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'ดูดวงไม่สำเร็จ กรุณาลองอีกครั้ง');
        return;
      }
      setReadingResult(data as FortuneReadingResponse);
      setStep('result');
      if ((data.starRating ?? 4) >= 4) {
        confetti({
          particleCount: 45,
          spread: 65,
          origin: { y: 0.62 },
          colors: ['#facc15', '#c084fc', '#f472b6', '#38bdf8'],
        });
      }
    } catch {
      setErrorMsg('เชื่อมต่อแม่หมอไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoadingReading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border-2 border-amber-300/80 bg-gradient-to-b from-[#1e0b36] via-[#150826] to-[#0c0517] text-amber-50 shadow-[0_12px_48px_rgba(147,51,234,0.45)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient starlight glow accents */}
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-40 rounded-full bg-fuchsia-600/25 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-purple-400/25 bg-gradient-to-r from-[#2e1065]/90 via-[#4c1d95]/80 to-[#3b0764]/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 via-fuchsia-400 to-purple-700 p-0.5 shadow-lg shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#1a0933] flex items-center justify-center text-2xl">
                🔮
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-wide text-amber-200 truncate">
                  โต๊ะดูดวงแม่หมอจันทรา
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400/20 text-emerald-200 border border-emerald-300/40">
                  ดูฟรีไม่อั้น!
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-purple-200/85 truncate">
                เลือกวิธีดูดวง พิมพ์คำถามที่อยากรู้ แล้วกดสุ่มดูคำตอบเข้าใจง่ายๆ ได้เลย
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-rose-500/80 border border-white/20 text-white font-black text-sm flex items-center justify-center cursor-pointer transition shrink-0"
            aria-label="ปิดหน้าต่างดูดวง"
          >
            ✕
          </button>
        </div>

        {/* Step Progress Strip */}
        <div className="grid grid-cols-3 text-center text-[11px] font-extrabold border-b border-purple-500/20 bg-black/30">
          <button
            type="button"
            onClick={() => !loadingReading && setStep('setup')}
            className={`py-2 px-1 transition cursor-pointer ${
              step === 'setup'
                ? 'bg-purple-600/35 text-amber-200 border-b-2 border-amber-300'
                : 'text-purple-300/65 hover:text-purple-100'
            }`}
          >
            1. เลือกวิธี & ถามคำถาม
          </button>
          <div
            className={`py-2 px-1 ${
              step === 'ritual'
                ? 'bg-purple-600/35 text-amber-200 border-b-2 border-amber-300'
                : 'text-purple-300/65'
            }`}
          >
            2. สุ่มเสี่ยงทาย
          </div>
          <div
            className={`py-2 px-1 ${
              step === 'result'
                ? 'bg-purple-600/35 text-amber-200 border-b-2 border-amber-300'
                : 'text-purple-300/65'
            }`}
          >
            3. อ่านคำตอบแม่หมอ
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {/* ==================== STEP 1: SETUP ==================== */}
          {step === 'setup' && (
            <>
              {/* 1. Choose Divination Method */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs sm:text-sm font-extrabold text-amber-200">
                    1️⃣ เลือกวิธีดูดวง (มี 5 แบบ)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DIVINATION_METHODS.map((m) => {
                    const active = m.id === methodId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethodId(m.id)}
                        className={`group relative text-left rounded-2xl p-3 border-2 transition cursor-pointer ${
                          active
                            ? 'border-amber-300 bg-gradient-to-br from-purple-800/65 via-fuchsia-900/45 to-indigo-950/80 shadow-[0_0_20px_rgba(250,204,21,0.25)]'
                            : 'border-purple-500/25 bg-white/[0.04] hover:bg-white/[0.08] hover:border-purple-400/50'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border border-white/20 shadow-inner"
                            style={{
                              background: `linear-gradient(135deg, ${m.accentFrom}, ${m.accentTo})`,
                            }}
                          >
                            {m.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-extrabold text-xs sm:text-sm text-amber-100 truncate">
                                {m.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-black/40 text-amber-200 border border-amber-300/30 shrink-0">
                                {m.badgeText}
                              </span>
                            </div>
                            <p className="text-[11px] text-purple-200/85 leading-snug mt-0.5">
                              {m.subtitle}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Choose Fortune Topic */}
              <div>
                <label className="block text-xs sm:text-sm font-extrabold text-amber-200 mb-2">
                  2️⃣ เลือกเรื่องที่อยากดู
                </label>
                <div className="flex flex-wrap gap-2">
                  {FORTUNE_TOPICS.map((t) => {
                    const active = t.id === topicId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTopicId(t.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-extrabold border-2 transition cursor-pointer flex items-center gap-1.5 ${
                          active
                            ? 'bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-purple-950 border-white shadow-[0_2px_0_#78350f]'
                            : 'bg-purple-950/60 text-purple-100 border-purple-500/35 hover:border-purple-300/60'
                        }`}
                      >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Required Specific Question + Quick Sample Chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs sm:text-sm font-extrabold text-amber-200">
                    3️⃣ พิมพ์คำถามที่อยากถามแม่หมอ{' '}
                    <span className="text-rose-300 font-black">* (ต้องระบุคำถามก่อนดูดวง)</span>
                  </label>
                  <span className="text-[10px] text-purple-300/70">{question.length}/240</span>
                </div>
                <textarea
                  ref={questionInputRef}
                  rows={2}
                  maxLength={240}
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    if (setupError && e.target.value.trim()) {
                      setSetupError('');
                    }
                  }}
                  placeholder={selectedTopic.placeholder}
                  className={`w-full rounded-2xl bg-[#10061f] border-2 px-3.5 py-2.5 text-xs sm:text-sm text-amber-50 placeholder:text-purple-300/45 outline-none transition resize-none ${
                    setupError
                      ? 'border-rose-400 focus:border-rose-300'
                      : 'border-purple-500/40 focus:border-amber-300'
                  }`}
                />

                {/* Sample Questions for 1-click convenience */}
                <div className="mt-2">
                  <div className="text-[11px] font-bold text-purple-200/80 mb-1.5">
                    💡 นึกคำถามไม่ออก? กดเลือกตัวอย่างคำถามด้านล่างได้เลย:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTopic.sampleQuestions.map((sq) => (
                      <button
                        key={sq}
                        type="button"
                        onClick={() => {
                          setQuestion(sq);
                          setSetupError('');
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer text-left ${
                          question.trim() === sq
                            ? 'bg-amber-300/25 border-amber-300 text-amber-100'
                            : 'bg-white/[0.05] border-purple-400/30 text-purple-200 hover:bg-white/[0.1] hover:border-purple-300'
                        }`}
                      >
                        “{sq}”
                      </button>
                    ))}
                  </div>
                </div>

                {setupError && (
                  <p className="mt-2 text-xs font-extrabold text-rose-300">⚠️ {setupError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleStartRitual}
                className={`w-full py-3 rounded-2xl font-black text-sm sm:text-base border-2 transition cursor-pointer ${
                  hasQuestion
                    ? 'bg-gradient-to-r from-amber-300 via-fuchsia-400 to-amber-300 text-slate-950 border-white shadow-[0_4px_0_#4c1d95] hover:brightness-105 active:translate-y-0.5'
                    : 'bg-purple-900/50 text-purple-200/60 border-purple-500/30 hover:border-rose-300/60'
                }`}
              >
                {hasQuestion
                  ? `${selectedMethod.icon} ไปหน้าเสี่ยงทาย (${selectedMethod.name}) →`
                  : '✍️ กรุณาพิมพ์หรือเลือกคำถามด้านบนก่อนนะครับ'}
              </button>
            </>
          )}

          {/* ==================== STEP 2: INTERACTIVE RITUAL ==================== */}
          {step === 'ritual' && (
            <div className="space-y-4">
              {/* Context Pill */}
              <div className="flex flex-wrap items-start justify-between gap-2 rounded-2xl bg-purple-950/55 border border-purple-400/30 px-3.5 py-2.5">
                <div className="text-xs min-w-0 flex-1">
                  <div>
                    <span className="font-extrabold text-amber-200">
                      {selectedMethod.icon} {selectedMethod.name}
                    </span>
                    <span className="mx-1.5 text-purple-400">•</span>
                    <span className="text-purple-100">
                      {selectedTopic.icon} {selectedTopic.label}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-amber-100 mt-1 break-words">
                    คำถามของคุณ: “{question.trim()}”
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('setup')}
                  className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer shrink-0"
                >
                  ← แก้คำถาม/เปลี่ยนวิธี
                </button>
              </div>

              <div className="rounded-3xl border-2 border-amber-300/35 bg-gradient-to-b from-[#2a104f]/75 to-[#140726]/90 p-4 sm:p-5 text-center space-y-4">
                <p className="text-xs sm:text-sm font-bold text-amber-100">
                  👉 {selectedMethod.ritualHint}
                </p>

                {/* --- RITUAL A: TAROT 3-CARD PICK --- */}
                {methodId === 'tarot' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-xs font-extrabold text-purple-200">
                        เปิดไพ่แล้ว {pickedSlots.length} / 3 ใบ
                      </span>
                      <button
                        type="button"
                        onClick={handleShuffleTarot}
                        className="px-2.5 py-1 rounded-lg bg-purple-800/70 hover:bg-purple-700 border border-purple-300/40 text-[11px] font-bold text-amber-200 cursor-pointer transition"
                      >
                        🔀 สับไพ่ใหม่
                      </button>
                    </div>

                    {/* 7 Face-down Tarot Fan */}
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 py-1">
                      {[0, 1, 2, 3, 4, 5, 6].map((slotIdx) => {
                        const orderIndex = pickedSlots.indexOf(slotIdx);
                        const isPicked = orderIndex !== -1;
                        return (
                          <button
                            key={slotIdx}
                            type="button"
                            disabled={isPicked || pickedSlots.length >= 3}
                            onClick={() => handlePickTarotSlot(slotIdx)}
                            className={`w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 flex flex-col items-center justify-center transition transform cursor-pointer ${
                              shuffleAnim ? 'scale-90 rotate-6 opacity-60' : ''
                            } ${
                              isPicked
                                ? 'border-amber-300 bg-amber-400/20 scale-95 opacity-55 cursor-default'
                                : pickedSlots.length >= 3
                                  ? 'border-purple-500/25 bg-purple-950/40 opacity-40 cursor-not-allowed'
                                  : 'border-amber-300/75 bg-gradient-to-b from-purple-700 via-indigo-900 to-purple-950 hover:-translate-y-2 hover:shadow-[0_6px_16px_rgba(250,204,21,0.35)]'
                            }`}
                          >
                            <span className="text-xl">{isPicked ? '✨' : '🃏'}</span>
                            <span className="text-[9.5px] font-extrabold text-amber-200 mt-1">
                              {isPicked ? `ใบที่ ${orderIndex + 1}` : 'กดเลือก'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Revealed 3-Card Slots */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
                      {POSITION_LABELS.map((posLabel, idx) => {
                        const revealed = idx < pickedSlots.length ? deckOrder[idx] : null;
                        return (
                          <div
                            key={posLabel}
                            className={`rounded-2xl p-3 border transition ${
                              revealed
                                ? 'border-amber-300/70 bg-black/45'
                                : 'border-dashed border-purple-400/30 bg-black/20'
                            }`}
                          >
                            <div className="text-[10px] font-extrabold text-purple-300">
                              ใบที่ {idx + 1}: {posLabel}
                            </div>
                            {revealed ? (
                              <div className="mt-1.5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-2xl inline-block ${
                                      revealed.isReversed ? 'rotate-180' : ''
                                    }`}
                                  >
                                    {revealed.card.icon}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-xs font-black text-amber-200 leading-tight">
                                      {revealed.card.nameTh}
                                    </div>
                                    <span
                                      className={`inline-block text-[9.5px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                                        revealed.isReversed
                                          ? 'bg-rose-500/25 text-rose-200'
                                          : 'bg-emerald-500/25 text-emerald-200'
                                      }`}
                                    >
                                      {revealed.isReversed ? 'กลับหัว (ระวังนิด)' : 'ตั้งตรง (ดวงหนุน)'}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-purple-100/90 mt-1.5 leading-snug">
                                  {revealed.isReversed
                                    ? revealed.card.reversedMeaning
                                    : revealed.card.uprightMeaning}
                                </p>
                              </div>
                            ) : (
                              <div className="h-16 flex items-center justify-center text-[11px] text-purple-300/45">
                                รอกดเลือกไพ่ใบที่ {idx + 1}...
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* --- RITUAL B: ESIIMSI SHAKER --- */}
                {methodId === 'esiimsi' && (
                  <div className="space-y-4 py-2">
                    <button
                      type="button"
                      onClick={handleShakeEsiimsi}
                      disabled={shakingStick}
                      className={`mx-auto w-32 h-28 rounded-3xl border-2 border-amber-300 bg-gradient-to-b from-red-700 via-rose-800 to-amber-900 flex flex-col items-center justify-center shadow-xl cursor-pointer transition ${
                        shakingStick ? 'animate-bounce scale-105' : 'hover:scale-105'
                      }`}
                    >
                      <span className="text-4xl">🎋</span>
                      <span className="text-[11px] font-black text-amber-200 mt-1">
                        {shakingStick
                          ? 'กำลังเขย่า...'
                          : esiimsiResult
                            ? 'เขย่าใหม่'
                            : 'กดเขย่าเซียมซี'}
                      </span>
                    </button>

                    {esiimsiResult && (
                      <div className="rounded-2xl border-2 border-amber-300/70 bg-gradient-to-b from-amber-950/60 to-red-950/50 p-4 max-w-md mx-auto space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-300 text-red-950 font-black text-xs">
                            ได้ใบที่ {esiimsiResult.number}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-amber-200 font-bold text-[11px]">
                            เกณฑ์ดวง: {esiimsiResult.grade}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-amber-100">
                          สรุปสั้นๆ: {esiimsiResult.coreMeaning}
                        </p>
                        <div className="text-[11px] text-purple-200/80 leading-relaxed pt-1 border-t border-white/10">
                          {esiimsiResult.poem.map((line, idx) => (
                            <div key={idx}>{line}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* --- RITUAL C: CRYSTAL BALL AURA --- */}
                {methodId === 'crystal_aura' && (
                  <div className="space-y-4 py-2">
                    <button
                      type="button"
                      onClick={handleChannelCrystal}
                      disabled={channelingOrb}
                      className={`mx-auto w-32 h-32 rounded-full border-4 border-amber-200/80 bg-gradient-to-br ${
                        auraResult
                          ? auraResult.glowClass
                          : 'from-purple-400 via-fuchsia-600 to-indigo-900'
                      } flex flex-col items-center justify-center shadow-[0_0_36px_rgba(192,132,252,0.75)] cursor-pointer transition ${
                        channelingOrb ? 'animate-pulse scale-110' : 'hover:scale-105'
                      }`}
                    >
                      <span className="text-4xl">{auraResult ? auraResult.icon : '🔮'}</span>
                      <span className="text-[10.5px] font-black text-slate-950 bg-white/90 px-2 py-0.5 rounded-full mt-1.5">
                        {channelingOrb
                          ? 'กำลังเช็กออร่า...'
                          : auraResult
                            ? 'แตะเช็กใหม่'
                            : 'แตะลูกแก้ว'}
                      </span>
                    </button>

                    {auraResult && (
                      <div className="rounded-2xl border border-amber-300/60 bg-black/45 p-3.5 max-w-md mx-auto">
                        <div className="text-sm font-black text-amber-200">{auraResult.nameTh}</div>
                        <div className="text-[11px] font-bold text-purple-300 mt-0.5">
                          {auraResult.elementTh}
                        </div>
                        <p className="text-xs text-purple-100 mt-1.5">{auraResult.energyMeaning}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* --- RITUAL D: BIRTH DAY & 12 ZODIAC --- */}
                {methodId === 'zodiac' && (
                  <div className="space-y-3 text-left">
                    <div>
                      <label className="block text-xs font-extrabold text-amber-200 mb-1.5">
                        ☀️ เลือกวันเกิดของคุณ
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {BIRTH_DAYS.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setBirthDayId(b.id);
                              setZodiacLocked(false);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition ${
                              birthDayId === b.id
                                ? 'bg-amber-300 text-purple-950 border-white font-black'
                                : 'bg-black/35 text-purple-100 border-purple-400/30 hover:border-purple-300'
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-amber-200 mb-1.5">
                        ♈ เลือกราศีของคุณ
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {ZODIAC_SIGNS.map((z) => (
                          <button
                            key={z.id}
                            type="button"
                            onClick={() => {
                              setZodiacId(z.id);
                              setZodiacLocked(false);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition flex items-center gap-1.5 ${
                              zodiacId === z.id
                                ? 'bg-fuchsia-400 text-slate-950 border-white font-black'
                                : 'bg-black/35 text-purple-100 border-purple-400/30 hover:border-purple-300'
                            }`}
                          >
                            <span>{z.icon}</span>
                            <span className="truncate">{z.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setZodiacLocked(true)}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 text-slate-950 font-black text-xs border-2 border-white cursor-pointer hover:brightness-110 transition"
                      >
                        {zodiacLocked ? '✅ ยืนยันวันเกิดและราศีแล้ว!' : '✅ กดยืนยันวันเกิดและราศีนี้'}
                      </button>
                    </div>
                  </div>
                )}

                {/* --- RITUAL E: NORSE RUNES & NUMEROLOGY --- */}
                {methodId === 'runes' && (
                  <div className="space-y-4 py-2">
                    <button
                      type="button"
                      onClick={handleCastRunes}
                      disabled={castingRunes}
                      className={`mx-auto px-6 py-3.5 rounded-2xl border-2 border-cyan-300 bg-gradient-to-r from-teal-900 via-emerald-900 to-sky-900 text-cyan-100 font-black text-xs sm:text-sm shadow-lg cursor-pointer transition ${
                        castingRunes ? 'animate-pulse scale-105' : 'hover:scale-105'
                      }`}
                    >
                      🪨{' '}
                      {castingRunes
                        ? 'กำลังสุ่มหยิบหินรูน...'
                        : runeResult
                          ? 'สุ่มหยิบใหม่'
                          : 'กดสุ่มหยิบหินรูน 3 ก้อน'}
                    </button>

                    {runeResult && (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left">
                          {runeResult.runes.map((r) => (
                            <div
                              key={r.id}
                              className="rounded-2xl border border-cyan-300/50 bg-black/45 p-3"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-300/50 flex items-center justify-center text-xl font-black text-cyan-200">
                                  {r.symbol}
                                </span>
                                <span className="text-xs font-black text-amber-200">{r.nameTh}</span>
                              </div>
                              <p className="text-[11px] text-purple-100/90 mt-1.5">{r.meaningTh}</p>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs font-extrabold text-cyan-200">
                          🔢 เลขเด่นที่ได้คู่กับหินรูน: เลข {runeResult.lifePathCode}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-rose-500/20 border border-rose-400/50 px-3.5 py-2 text-xs font-bold text-rose-200 text-center">
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                disabled={!isRitualComplete || loadingReading}
                onClick={handleRequestProphecy}
                className={`w-full py-3.5 rounded-2xl font-black text-sm sm:text-base border-2 transition ${
                  !isRitualComplete
                    ? 'bg-purple-950/50 text-purple-300/45 border-purple-700/30 cursor-not-allowed'
                    : loadingReading
                      ? 'bg-purple-700 text-amber-100 border-amber-300 animate-pulse cursor-wait'
                      : 'bg-gradient-to-r from-amber-300 via-yellow-300 to-fuchsia-300 text-slate-950 border-white shadow-[0_4px_0_#4c1d95] hover:brightness-105 cursor-pointer'
                }`}
              >
                {loadingReading
                  ? '🔮 แม่หมอกำลังแปลคำตอบให้เข้าใจง่ายๆ รอแป๊บนะ...'
                  : isRitualComplete
                    ? '✨ ดูคำตอบจากแม่หมอ!'
                    : 'กดสุ่มเสี่ยงทายด้านบนให้ครบก่อนนะครับ'}
              </button>
            </div>
          )}

          {/* ==================== STEP 3: PROPHECY RESULT ==================== */}
          {step === 'result' && readingResult && (
            <div className="space-y-4">
              <div className="rounded-3xl border-2 border-amber-300 bg-gradient-to-b from-[#2e1065]/90 via-[#1b0938]/95 to-[#110524] p-4 sm:p-5 shadow-[0_0_30px_rgba(250,204,21,0.2)] space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-amber-300/20 border border-amber-300/50 text-amber-200 text-[11px] font-extrabold">
                    {selectedMethod.icon} {selectedMethod.name} • {selectedTopic.icon}{' '}
                    {selectedTopic.label}
                  </span>
                  <span className="text-[10.5px] font-bold text-purple-300">
                    {readingResult.source === 'gemini'
                      ? '✨ ตอบโดย AI แม่หมอจันทรา'
                      : '📜 ตำราแม่หมอจันทรา'}
                  </span>
                </div>

                {/* Question Asked */}
                <div className="rounded-2xl bg-purple-950/60 border border-purple-400/30 px-3.5 py-2.5 text-xs text-purple-100">
                  <span className="font-extrabold text-amber-300">คำถามของคุณ: </span>“
                  {question.trim()}”
                </div>

                {/* Star Rating & Direct Headline */}
                <div>
                  <div className="text-amber-300 text-sm tracking-widest mb-1">
                    {'⭐'.repeat(Math.max(1, Math.min(5, readingResult.starRating)))}
                    <span className="ml-1.5 text-[11px] font-bold text-amber-200/85">
                      (ความปัง {readingResult.starRating}/5 ดาว)
                    </span>
                  </div>
                  <h3 className="text-base sm:text-xl font-black text-amber-200 leading-snug">
                    {readingResult.headline}
                  </h3>
                </div>

                {/* Drawn Artifact Reference */}
                {artifactSummary && (
                  <div className="rounded-2xl bg-black/40 border border-purple-400/25 px-3 py-2 text-[11px] text-purple-200/90 leading-relaxed">
                    <span className="font-extrabold text-amber-300">สิ่งที่สุ่มได้: </span>
                    {artifactSummary}
                  </div>
                )}

                {/* Main Plain-Thai Reading */}
                <div className="rounded-2xl bg-white/[0.06] border border-white/15 p-3.5 sm:p-4 text-xs sm:text-sm text-amber-50 leading-relaxed whitespace-pre-line">
                  <div className="font-black text-amber-300 mb-1">🔮 แม่หมอสรุปให้ฟังง่ายๆ</div>
                  {readingResult.reading}
                </div>

                {/* Actionable Advice Box */}
                <div className="rounded-2xl bg-gradient-to-r from-emerald-950/65 to-teal-950/55 border border-emerald-400/40 p-3.5 text-xs sm:text-sm text-emerald-100">
                  <div className="font-black text-emerald-300 mb-0.5">✅ แนะนำให้ทำแบบนี้</div>
                  <p className="leading-relaxed">{readingResult.advice}</p>
                </div>

                {/* Lucky Color & Numbers */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-black/40 border border-amber-300/30 p-3 text-center">
                    <div className="text-[10.5px] font-bold text-purple-300">🎨 สีนำโชค</div>
                    <div className="text-xs sm:text-sm font-black text-amber-200 mt-0.5">
                      {readingResult.luckyColor}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-black/40 border border-amber-300/30 p-3 text-center">
                    <div className="text-[10.5px] font-bold text-purple-300">🔢 เลขนำโชค</div>
                    <div className="text-xs sm:text-sm font-black text-amber-200 mt-0.5">
                      {readingResult.luckyNumbers}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    resetRitualState(methodId);
                    setStep('ritual');
                  }}
                  className="py-3 rounded-2xl bg-purple-800/80 hover:bg-purple-700 border-2 border-purple-300/60 text-amber-100 font-extrabold text-xs sm:text-sm cursor-pointer transition"
                >
                  🔄 สุ่มคำตอบใหม่ด้วยคำถามเดิม
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuestion('');
                    resetRitualState(methodId);
                    setStep('setup');
                  }}
                  className="py-3 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-slate-950 border-2 border-white font-black text-xs sm:text-sm shadow-[0_3px_0_#4c1d95] hover:brightness-105 cursor-pointer transition"
                >
                  💬 ถามคำถามใหม่ / เปลี่ยนวิธีดูดวง
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
