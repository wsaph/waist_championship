'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  QUEST_MAX_STAKE,
  QUEST_MIN_STAKE,
  computeBetPayouts,
  computeBettingWindowMs,
  computeCoopMultiplier,
  computeDateRangeDays,
  computePerMemberQuestReward,
  formatBangkokDatePlusDays,
  formatCountdownTh,
  type BetSide,
  type QuestBoardItem,
  type QuestUserBrief,
} from '@/lib/quest_board';

interface QuestBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: (QuestUserBrief & { points: number }) | null;
  allPlayers: QuestUserBrief[];
  quests: QuestBoardItem[];
  initialQuestId?: number | null;
  onQuestsUpdated: (quests: QuestBoardItem[], nextUserPoints?: number) => void;
  onShowToast?: (icon: string, title: string, desc?: string) => void;
}

type BoardFilter = 'all' | 'open' | 'betting' | 'active' | 'finished';
type BoardScreen = 'board' | 'detail' | 'create';

export function QuestBoardModal({
  isOpen,
  onClose,
  currentUser,
  allPlayers,
  quests,
  initialQuestId = null,
  onQuestsUpdated,
  onShowToast,
}: QuestBoardModalProps) {
  const [screen, setScreen] = useState<BoardScreen>('board');
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [selectedQuestId, setSelectedQuestId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const carouselRef = useRef<HTMLDivElement | null>(null);

  // Create quest form state (simple 2-field form)
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');

  // Detail & quick-board action states
  const [quickSponsorQuestId, setQuickSponsorQuestId] = useState<number | null>(null);
  const [quickSponsorAmt, setQuickSponsorAmt] = useState('');
  const [acceptStartDate, setAcceptStartDate] = useState(() => formatBangkokDatePlusDays(0));
  const [acceptEndDate, setAcceptEndDate] = useState(() => formatBangkokDatePlusDays(7));
  const [selectedInviteIds, setSelectedInviteIds] = useState<number[]>([]);
  const [extraInviteId, setExtraInviteId] = useState<string>('');
  const [betSide, setBetSide] = useState<BetSide>('success');
  const [betAmt, setBetAmt] = useState('50');
  const [proofText, setProofText] = useState('');
  const [voteComment, setVoteComment] = useState('');
  const [resolveNote, setResolveNote] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setQuickSponsorQuestId(null);
    if (initialQuestId) {
      setSelectedQuestId(initialQuestId);
      setScreen('detail');
    } else {
      setScreen('board');
    }
  }, [isOpen, initialQuestId]);

  // Tick countdown every 30s while open
  useEffect(() => {
    if (!isOpen) return;
    const iv = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, [isOpen]);

  const selectedQuest = useMemo(
    () => quests.find((q) => q.id === selectedQuestId) ?? null,
    [quests, selectedQuestId]
  );

  // Sync accept dates when opening a quest detail
  useEffect(() => {
    if (!selectedQuest) return;
    setAcceptStartDate(formatBangkokDatePlusDays(0));
    setAcceptEndDate(formatBangkokDatePlusDays(7));
    setSelectedInviteIds([]);
    setExtraInviteId('');
    setProofText(
      selectedQuest.party.find((m) => m.userId === currentUser?.id)?.proofText || ''
    );
    setErrorMsg('');
  }, [selectedQuest?.id, currentUser?.id]);

  const filteredQuests = useMemo(() => {
    return quests.filter((q) => {
      if (filter === 'open') return q.status === 'open';
      if (filter === 'betting') return q.isBettingOpen;
      if (filter === 'active') return q.status === 'active' || q.status === 'voting';
      if (filter === 'finished') return q.status === 'completed' || q.status === 'failed';
      return true;
    });
  }, [quests, filter]);

  const counts = useMemo(() => {
    let open = 0;
    let betting = 0;
    let active = 0;
    let finished = 0;
    for (const q of quests) {
      if (q.status === 'open') open++;
      if (q.isBettingOpen) betting++;
      if (q.status === 'active' || q.status === 'voting') active++;
      if (q.status === 'completed' || q.status === 'failed') finished++;
    }
    return { open, betting, active, finished };
  }, [quests]);

  if (!isOpen) return null;

  const scrollCarousel = (dir: -1 | 1) => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({ left: dir * 290, behavior: 'smooth' });
  };

  const handleCreateQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setErrorMsg('กรุณาเข้าสู่ระบบก่อนสร้างเควส');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: currentUser.id,
          title: titleInput,
          description: descInput,
          questType: 'custom',
          templateKey: '',
          targetValue: 0,
          targetUnit: '',
          durationDays: 0,
          initialSponsorAmount: 0,
          aiSummary: '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'สร้างเควสไม่สำเร็จ');
        return;
      }
      onQuestsUpdated(data.quests || [], data.userPoints);
      onShowToast?.('📜', 'สร้างเควสบนกระดานแล้ว!', titleInput.trim());
      setTitleInput('');
      setDescInput('');
      setSelectedQuestId(data.questId ?? null);
      setScreen('board');
    } catch {
      setErrorMsg('สร้างเควสไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  };

  const runQuestAction = async (
    questId: number,
    payload: Record<string, unknown>,
    celebrate = false
  ) => {
    if (!currentUser) {
      setErrorMsg('กรุณาเข้าสู่ระบบก่อนทำรายการ');
      return false;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/quests/${questId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'ดำเนินการไม่สำเร็จ');
        return false;
      }
      onQuestsUpdated(data.quests || [], data.userPoints);
      if (celebrate) {
        confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });
      }
      if (data.message) {
        onShowToast?.('📜', 'กระดานเควส', data.message);
      }
      return true;
    } catch {
      setErrorMsg('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Helper to get ribbon badge for a quest card (RO Mobile "Reward x2" style)
  const getCardRibbon = (q: QuestBoardItem) => {
    if (q.status === 'completed') {
      return { text: 'สำเร็จ! ✅', bg: 'from-emerald-400 to-green-600', textCls: 'text-white' };
    }
    if (q.status === 'failed') {
      return { text: 'ไม่ผ่าน ❌', bg: 'from-rose-500 to-red-700', textCls: 'text-white' };
    }
    if (q.status === 'voting') {
      return { text: 'โหวตตัดสิน!', bg: 'from-teal-300 to-emerald-500', textCls: 'text-slate-950' };
    }
    if (q.isBettingOpen) {
      return { text: 'เดิมพันเปิด!', bg: 'from-yellow-300 via-amber-400 to-orange-500', textCls: 'text-amber-950' };
    }
    if (q.totalSponsorPool > 0) {
      return { text: 'Reward x2', bg: 'from-cyan-300 via-sky-300 to-cyan-400', textCls: 'text-amber-900' };
    }
    return { text: 'NEW QUEST', bg: 'from-amber-200 to-yellow-400', textCls: 'text-amber-950' };
  };

  const getCardButtonLabel = (q: QuestBoardItem) => {
    if (q.status === 'open') return 'รับเควส';
    if (q.isBettingOpen) return '🎲 เดิมพัน / ดูเควส';
    if (q.status === 'voting') return '🗳️ โหวต / ตัดสินผล';
    if (q.status === 'active') return '⚔️ ดูความคืบหน้า';
    return '🏆 ดูสรุปผลรางวัล';
  };

  const renderBoardCards = () => {
    if (filteredQuests.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#f3e1bd] border-4 border-[#9c6f3e] shadow-lg flex items-center justify-center text-4xl mb-3">
            📜
          </div>
          <p className="font-[family-name:var(--font-kanit)] font-extrabold text-lg text-[#ffe8b3] drop-shadow">
            ยังไม่มีเควสในหมวดนี้บนกระดาน!
          </p>
          <p className="text-xs text-[#f0d6a8]/80 mt-1 max-w-sm">
            กดปุ่ม &ldquo;+ สร้างเควสใหม่&rdquo; ด้านบน เพื่อสร้างเควสท้าทาย แล้วค่อยชวนเพื่อนสมทบรางวัลหรือเดิมพันกันเลย!
          </p>
        </div>
      );
    }

    return (
      <div className="relative flex items-center">
        {/* Left Navigation Arrow (<) */}
        <button
          type="button"
          onClick={() => scrollCarousel(-1)}
          aria-label="เลื่อนซ้าย"
          className="hidden sm:flex absolute left-1.5 z-20 w-10 h-10 rounded-full bg-black/55 hover:bg-black/80 border-2 border-white/55 text-white items-center justify-center text-2xl font-bold shadow-lg cursor-pointer transition active:scale-95"
        >
          ‹
        </button>

        {/* Horizontal Parchment Scroll Cards */}
        <div
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto px-3 sm:px-14 py-3 snap-x snap-mandatory scroll-smooth w-full"
          style={{ scrollbarWidth: 'thin' }}
        >
          {filteredQuests.map((q) => {
            const ribbon = getCardRibbon(q);
            const myInvitePending = q.party.some(
              (m) => m.userId === currentUser?.id && m.inviteStatus === 'invited'
            );
            const liveBetMs =
              q.isBettingOpen && q.bettingEndsAt
                ? Math.max(0, Date.parse(q.bettingEndsAt) - nowTick)
                : 0;
            const canQuickSponsor = q.status === 'open' && Boolean(currentUser);
            const isQuickSponsorOpen = quickSponsorQuestId === q.id && canQuickSponsor;
            const myCardSponsor = currentUser
              ? q.sponsors.find((s) => s.userId === currentUser.id)
              : undefined;

            return (
              <div
                key={q.id}
                onClick={() => {
                  setSelectedQuestId(q.id);
                  setScreen('detail');
                }}
                className="ro-parchment-card snap-center shrink-0 w-[262px] sm:w-[274px] flex flex-col justify-between p-4 pt-5 pb-4 cursor-pointer transition-transform duration-200 hover:-translate-y-1 relative select-none"
              >
                {/* Top-Left Scroll Curl Illusion */}
                <div className="ro-scroll-curl-tl" />
                {/* Bottom-Right Dog-Ear Curl */}
                <div className="ro-scroll-curl-br" />

                {/* Top-Right Angled Ribbon Badge (Reward x2 / เดิมพันเปิด!) */}
                <div
                  className={`absolute -top-1 -right-2 z-10 px-3 py-0.5 bg-gradient-to-r ${ribbon.bg} ${ribbon.textCls} text-[11px] font-black tracking-tight shadow-md border border-white/70 rotate-[12deg] rounded-sm`}
                  style={{ textShadow: ribbon.textCls === 'text-white' ? '0 1px 2px rgba(0,0,0,0.6)' : '0 1px 0 rgba(255,255,255,0.6)' }}
                >
                  {ribbon.text}
                </div>

                {/* Pending Co-op Invite Ping */}
                {myInvitePending && (
                  <div className="absolute top-2 left-3 z-10 bg-rose-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow animate-pulse">
                    💌 ชวนคุณร่วมตี้!
                  </div>
                )}

                <div>
                  {/* Quest Title */}
                  <h3 className="font-[family-name:var(--font-kanit)] font-extrabold text-[15px] leading-snug text-[#6a4420] text-center line-clamp-2 min-h-[38px] px-2 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
                    {q.title}
                  </h3>

                  {/* Portrait Box (RO Mobile NPC Frame) */}
                  <div className="flex justify-center my-2.5">
                    <div className="relative w-[84px] h-[84px] rounded-xl p-[3px] bg-gradient-to-b from-[#d8e7f4] via-[#a3bfd6] to-[#6c8aa3] shadow-[0_3px_6px_rgba(61,32,13,0.35)] border border-[#566f84]">
                      <div
                        className="w-full h-full rounded-[9px] flex items-center justify-center relative overflow-hidden"
                        style={{
                          background: `radial-gradient(circle at 50% 35%, #ffffff 0%, ${q.creatorColorHex || '#dbeafe'} 70%, #94a3b8 100%)`,
                        }}
                      >
                        <span className="text-[42px] -mt-2 drop-shadow">{q.creatorEmoji}</span>
                        <div className="absolute bottom-0 inset-x-0 bg-[#2b211a]/82 text-[#fff5e1] text-[10.5px] font-bold text-center py-0.5 px-1 truncate">
                          {q.creatorName}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tan Description Box */}
                  <div className="rounded-lg overflow-hidden bg-[#d8bc8f] border border-[#be9c68] shadow-inner mb-2.5">
                    <div className="bg-[#b78e57] text-[#fff6e5] text-[11px] font-extrabold text-center py-1 px-2 truncate">
                      {q.status === 'open'
                        ? '📌 เปิดรับเควส • รอผู้กล้า'
                        : q.isBettingOpen
                        ? `🎲 ช่วงเดิมพันเหลือ ${formatCountdownTh(liveBetMs)}`
                        : q.startDate && q.endDate
                        ? `📅 ${q.startDate} → ${q.endDate}`
                        : '⚔️ กำลังดำเนินเควส'}
                    </div>
                    <div className="p-2.5 min-h-[78px] max-h-[84px] overflow-hidden">
                      <p className="text-[11.5px] leading-relaxed text-[#4f3216] font-semibold line-clamp-3">
                        {q.aiSummary || q.description}
                      </p>
                    </div>
                  </div>

                  {/* RPG Stats Row (Base / Job style) */}
                  <div
                    className={`flex items-center ${
                      q.startDate && q.endDate ? 'justify-between' : 'justify-center'
                    } text-[11px] font-extrabold px-0.5 mb-2`}
                  >
                    {q.startDate && q.endDate && (
                      <span className="text-[#694827]">
                        ระยะ:{' '}
                        <span className="text-[#1f6fb2] font-black">
                          {computeDateRangeDays(q.startDate, q.endDate) ?? '—'} วัน
                        </span>
                      </span>
                    )}
                    <span className="text-[#694827]">
                      Co-op:{' '}
                      <span className="text-[#1f6fb2] font-black">
                        {q.activePartyCount > 0
                          ? `${q.activePartyCount} คน (+${q.coopBonusPct}%)`
                          : '+10%/คน'}
                      </span>
                    </span>
                  </div>

                  {/* Metallic Reward / Bet Pills: open = Sponsor only, accepted+ = Completion Reward + Bet */}
                  <div className={`grid ${q.status === 'open' ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5 mb-2.5`}>
                    {canQuickSponsor ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setErrorMsg('');
                          setQuickSponsorAmt('');
                          setQuickSponsorQuestId((prev) => (prev === q.id ? null : q.id));
                        }}
                        className={`flex items-center justify-between gap-1 bg-[#8f7153]/90 hover:bg-[#7b5d3f] text-white rounded-full pl-1 pr-1.5 py-0.5 shadow-inner border transition cursor-pointer active:scale-95 ${
                          isQuickSponsorOpen
                            ? 'border-amber-300 ring-2 ring-amber-300/70'
                            : 'border-[#6e5136]'
                        }`}
                        title="กดเพื่อสมทบรางวัลทันที! (สำเร็จได้คืน 2 เท่า)"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-b from-amber-200 to-amber-500 border border-amber-700 text-[11px] flex items-center justify-center shrink-0 shadow">
                            💰
                          </span>
                          <span className="text-[11px] font-extrabold truncate">
                            สมทบรางวัล {q.totalSponsorPool.toLocaleString()} GP
                          </span>
                        </span>
                        <span className="w-4 h-4 rounded-full bg-amber-300 text-[#4a2605] text-[11px] font-black flex items-center justify-center shrink-0 leading-none shadow-sm">
                          {isQuickSponsorOpen ? '×' : '+'}
                        </span>
                      </button>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 bg-[#8f7153]/85 text-white rounded-full pl-1 pr-2 py-0.5 shadow-inner border border-[#6e5136]"
                        title={
                          q.status === 'open'
                            ? 'สมทบรางวัล Gacha (ลงแล้วเควสสำเร็จได้คืน 2 เท่า!)'
                            : `รางวัลที่จะได้รับเมื่อทำเควสสำเร็จ (${q.perMemberReward.toLocaleString()} GP${q.activePartyCount > 1 ? '/คน รวมโบนัส Co-op' : ''})`
                        }
                      >
                        <span className="w-5 h-5 rounded-full bg-gradient-to-b from-amber-200 to-amber-500 border border-amber-700 text-[11px] flex items-center justify-center shrink-0 shadow">
                          {q.status === 'open' ? '💰' : '🏆'}
                        </span>
                        <span className="text-[11px] font-extrabold truncate">
                          {q.status === 'open'
                            ? `สมทบรางวัล ${q.totalSponsorPool.toLocaleString()} GP`
                            : `${q.perMemberReward.toLocaleString()}${q.activePartyCount > 1 ? '/คน' : ''}`}
                        </span>
                      </div>
                    )}
                    {q.status !== 'open' && (
                      <div
                        className="flex items-center gap-1.5 bg-[#8f7153]/85 text-white rounded-full pl-1 pr-2 py-0.5 shadow-inner border border-[#6e5136]"
                        title="ยอดเดิมพันทั้งหมด"
                      >
                        <span className="w-5 h-5 rounded-full bg-gradient-to-b from-sky-200 to-indigo-500 border border-indigo-800 text-[11px] flex items-center justify-center shrink-0 shadow">
                          🎲
                        </span>
                        <span className="text-[11px] font-extrabold truncate">
                          {q.totalBetPool.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Inline Quick Sponsor Drawer */}
                  {isQuickSponsorOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mb-2.5 rounded-xl bg-[#f9eed6] border-2 border-[#c69d63] p-2 space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-[10.5px] font-extrabold text-[#5b320e]">
                        <span>💰 สมทบรางวัล (สำเร็จคืน x2)</span>
                        {myCardSponsor && (
                          <span className="text-[#8a5624]">
                            ลงแล้ว {myCardSponsor.amount}/{QUEST_MAX_STAKE}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[10, 50, 100, 200].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setQuickSponsorAmt(String(v))}
                            className={`py-0.5 rounded-md text-[10.5px] font-extrabold cursor-pointer transition ${
                              Number(quickSponsorAmt) === v
                                ? 'bg-amber-400 text-[#3f1f04] border border-amber-700'
                                : 'bg-[#e6cb99] hover:bg-[#dbb574] text-[#4f2d10]'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={QUEST_MAX_STAKE}
                          placeholder="จำนวน"
                          value={quickSponsorAmt}
                          onChange={(e) => setQuickSponsorAmt(e.target.value)}
                          className="w-20 rounded-lg bg-white border border-[#b78f5c] px-2 py-1 text-[11.5px] font-extrabold text-[#3f230b] placeholder:font-semibold placeholder:text-[#a6855c]"
                        />
                        <button
                          type="button"
                          disabled={busy || !(Number(quickSponsorAmt) > 0)}
                          onClick={async () => {
                            const ok = await runQuestAction(q.id, {
                              action: 'sponsor',
                              amount: Number(quickSponsorAmt),
                            });
                            if (ok) {
                              setQuickSponsorAmt('');
                              setQuickSponsorQuestId(null);
                            }
                          }}
                          className="ro-gold-btn flex-1 py-1 px-2 rounded-lg text-[11px] font-extrabold cursor-pointer disabled:opacity-50"
                        >
                          {busy
                            ? '⏳...'
                            : Number(quickSponsorAmt) > 0
                            ? `สมทบ +${Number(quickSponsorAmt)} GP`
                            : 'สมทบรางวัล'}
                        </button>
                      </div>
                      {errorMsg && (
                        <p className="text-[10.5px] font-extrabold text-rose-700 leading-tight">
                          ⚠️ {errorMsg}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Glossy Golden Accept Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedQuestId(q.id);
                    setScreen('detail');
                  }}
                  className="ro-gold-btn w-full py-2 rounded-xl font-[family-name:var(--font-kanit)] font-extrabold text-[13.5px] tracking-wide cursor-pointer"
                >
                  {getCardButtonLabel(q)}
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Navigation Arrow (>) */}
        <button
          type="button"
          onClick={() => scrollCarousel(1)}
          aria-label="เลื่อนขวา"
          className="hidden sm:flex absolute right-1.5 z-20 w-10 h-10 rounded-full bg-black/55 hover:bg-black/80 border-2 border-white/55 text-white items-center justify-center text-2xl font-bold shadow-lg cursor-pointer transition active:scale-95"
        >
          ›
        </button>
      </div>
    );
  };

  const renderCreateForm = () => {
    return (
      <div className="p-3 sm:p-5 overflow-y-auto max-h-[68vh]">
        <div className="ro-parchment-sheet rounded-2xl p-4 sm:p-5 max-w-xl mx-auto text-[#472b12]">
          <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b-2 border-[#c9a675]">
            <div>
              <h3 className="font-[family-name:var(--font-kanit)] font-extrabold text-lg sm:text-xl text-[#5a3210]">
                📜 สร้างเควสใหม่
              </h3>
              <p className="text-xs font-semibold text-[#7b522c]">
                เขียนชื่อเควสและเงื่อนไขให้ชัด แล้วค่อยไปกดสมทบรางวัลบนกระดานพร้อมเพื่อนๆ ได้เลย!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScreen('board')}
              className="px-3 py-1.5 rounded-lg bg-[#7c4d25] hover:bg-[#5c3616] text-[#fff3dc] text-xs font-extrabold cursor-pointer shrink-0"
            >
              ← กลับกระดาน
            </button>
          </div>

          <form onSubmit={handleCreateQuest} className="space-y-3.5">
            <div>
              <label className="block text-xs font-extrabold mb-1 text-[#5a3210]">
                ชื่อเควส *
              </label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                maxLength={80}
                required
                placeholder="เช่น งดน้ำหวาน 2 สัปดาห์ หรือ วิ่งครบ 50 กม."
                className="w-full rounded-xl bg-[#fff8ea] border-2 border-[#b78f5c] px-3 py-2 text-sm font-bold text-[#3f230b] focus:outline-none focus:border-[#d97706]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold mb-1 text-[#5a3210]">
                รายละเอียด & เงื่อนไขเควส (รวมช่วงเวลาและวิธีส่งหลักฐาน) *
              </label>
              <textarea
                rows={4}
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                maxLength={600}
                required
                placeholder="อธิบายว่าต้องทำอะไร ระยะเวลากี่วัน และส่งหลักฐานยังไงตอนจบเควสเพื่อให้เพื่อนโหวตตรวจได้ง่าย..."
                className="w-full rounded-xl bg-[#fff8ea] border-2 border-[#b78f5c] px-3 py-2 text-sm font-semibold text-[#3f230b] focus:outline-none focus:border-[#d97706]"
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-rose-100 border-2 border-rose-500 px-3 py-2 text-xs font-extrabold text-rose-800">
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setScreen('board')}
                className="px-4 py-2.5 rounded-xl bg-[#d3b688] hover:bg-[#c5a36e] text-[#4a2b10] font-extrabold text-sm cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={busy}
                className="ro-gold-btn px-6 py-2.5 rounded-xl font-[family-name:var(--font-kanit)] font-extrabold text-sm cursor-pointer disabled:opacity-50"
              >
                {busy ? '⏳ กำลังสร้างเควส...' : '✨ สร้างเควสเลย!'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderQuestDetail = () => {
    if (!selectedQuest) {
      return (
        <div className="p-8 text-center text-[#ffe6b3]">
          <p className="font-bold mb-3">ไม่พบเควสนี้</p>
          <button
            type="button"
            onClick={() => setScreen('board')}
            className="ro-gold-btn px-4 py-2 rounded-xl font-extrabold text-sm cursor-pointer"
          >
            ← กลับกระดานเควส
          </button>
        </div>
      );
    }

    const q = selectedQuest;
    const acceptedParty = q.party.filter((m) => m.inviteStatus === 'accepted');
    const pendingInvites = q.party.filter((m) => m.inviteStatus === 'invited');
    const myPartyRow = q.party.find((m) => m.userId === currentUser?.id);
    const isMyInvitePending = myPartyRow?.inviteStatus === 'invited';
    const isMeAcceptedParty = myPartyRow?.inviteStatus === 'accepted';
    const isMeInPartyOrInvited = isMeAcceptedParty || isMyInvitePending;
    const isMeLeader = currentUser && q.acceptorId === currentUser.id;
    const isMeNonPartyCreator =
      currentUser && q.creatorId === currentUser.id && !isMeAcceptedParty;
    const myExistingBet = q.bets.find((b) => b.userId === currentUser?.id);
    const myVote = q.votes.find((v) => v.voterId === currentUser?.id);

    const liveBetMs =
      q.isBettingOpen && q.bettingEndsAt
        ? Math.max(0, Date.parse(q.bettingEndsAt) - nowTick)
        : 0;

    const rangeDays = computeDateRangeDays(acceptStartDate, acceptEndDate);

    // Players available to invite (exclude current user, active/invited party members, and fail bettors)
    const alreadyInPartyIds = new Set(
      q.party.filter((m) => m.inviteStatus !== 'declined').map((m) => m.userId)
    );
    const failBettorIds = new Set(
      q.bets.filter((b) => b.side === 'fail').map((b) => b.userId)
    );
    const inviteCandidates = allPlayers.filter(
      (p) => p.id !== currentUser?.id && !alreadyInPartyIds.has(p.id) && !failBettorIds.has(p.id)
    );

    // Bet payout preview for current form input
    const previewBetStake = Math.max(0, Math.floor(Number(betAmt) || 0));
    const effectiveBetSide: BetSide = isMeInPartyOrInvited
      ? 'success'
      : myExistingBet?.side ?? betSide;
    const simulatedBets = [
      ...q.bets.map((b) => ({ userId: b.userId, side: b.side, amount: b.amount })),
      ...(previewBetStake > 0
        ? [{ userId: -999, side: effectiveBetSide, amount: previewBetStake }]
        : []),
    ];
    const simResult = computeBetPayouts(simulatedBets, effectiveBetSide).find(
      (r) => r.userId === -999
    );

    const allPartySubmitted =
      acceptedParty.length > 0 && acceptedParty.every((m) => m.memberCompleted);

    const totalBetPoolSafe = Math.max(1, q.totalBetPool);
    const successPct = Math.round((q.successBetPool / totalBetPoolSafe) * 100);

    return (
      <div className="p-3 sm:p-5 overflow-y-auto max-h-[68vh]">
        <div className="ro-parchment-sheet rounded-2xl p-4 sm:p-5 max-w-4xl mx-auto text-[#472b12] space-y-4">
          {/* Header Row */}
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b-2 border-[#c9a675]">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-14 h-14 rounded-xl border-2 border-[#6e8ca5] flex items-center justify-center text-3xl shrink-0 shadow"
                style={{ backgroundColor: q.creatorColorHex || '#e2e8f0' }}
              >
                {q.creatorEmoji}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="px-2 py-0.5 rounded-full bg-[#6d3f18] text-[#ffe9be] text-[10px] font-extrabold">
                    สร้างโดย {q.creatorEmoji} {q.creatorName}
                  </span>
                  {q.isBettingOpen && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold animate-pulse">
                      🎲 ช่วงเดิมพัน! เหลือ {formatCountdownTh(liveBetMs)}
                    </span>
                  )}
                </div>
                <h3 className="font-[family-name:var(--font-kanit)] font-extrabold text-lg sm:text-xl text-[#4e2809]">
                  {q.title}
                </h3>
                {q.startDate && q.endDate && (
                  <p className="text-xs font-bold text-[#7c4d21]">
                    📅 ช่วงเวลาทำเควส: {q.startDate} → {q.endDate}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setScreen('board')}
              className="px-3.5 py-1.5 rounded-xl bg-[#7c4d25] hover:bg-[#5c3616] text-[#fff3dc] text-xs font-extrabold cursor-pointer shrink-0 shadow"
            >
              ← กลับกระดานเควส
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-rose-100 border-2 border-rose-500 px-3 py-2 text-xs font-extrabold text-rose-800">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Pending Co-op Invite Alert for Current User */}
          {isMyInvitePending && q.status === 'active' && (
            <div className="rounded-xl bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 border-2 border-amber-600 p-3.5 flex flex-wrap items-center justify-between gap-2 shadow">
              <div className="text-xs sm:text-sm font-extrabold text-amber-950">
                💌 คุณถูกชวนให้เข้าร่วมปาร์ตี้ Co-op ทำเควสนี้! (เข้าร่วมแล้วทุกคนได้รางวัล +10% เพิ่มขึ้นอีก!)
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runQuestAction(q.id, { action: 'respond_invite', accept: true }, true)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer"
                >
                  ✅ ตอบรับเข้าร่วมตี้!
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runQuestAction(q.id, { action: 'respond_invite', accept: false })}
                  className="px-3 py-1.5 rounded-lg bg-stone-500 hover:bg-stone-600 text-white text-xs font-extrabold cursor-pointer"
                >
                  ปฏิเสธ
                </button>
              </div>
            </div>
          )}

          {/* Description & AI Summary */}
          <div className="rounded-xl bg-[#e7cfa4] border border-[#bf9a65] p-3.5 space-y-2">
            <p className="text-sm font-semibold text-[#472a10] whitespace-pre-line leading-relaxed">
              {q.description}
            </p>
            {q.aiSummary && (
              <div className="rounded-lg bg-[#fff7e6]/85 border border-[#cca46b] px-3 py-2 text-xs font-bold text-[#613b15]">
                ✨ สรุปกติกา: {q.aiSummary}
              </div>
            )}
          </div>

          {/* 2-Column Interactive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT: Gacha Sponsor Pool + Co-op Party / Accept */}
            <div className="space-y-4">
              {/* Gacha Sponsor Pool Box */}
              <div className="rounded-xl bg-[#f9eed6] border-2 border-[#c69d63] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-[family-name:var(--font-kanit)] font-extrabold text-sm text-[#5b320e]">
                    💰 ยอดสมทบรางวัล Gacha (คืน x2)
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-xs border border-amber-700">
                    รวม {q.totalSponsorPool.toLocaleString()} 💰
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-[#774f28]">
                  ร่วมสมทบรางวัล ({QUEST_MIN_STAKE}–{QUEST_MAX_STAKE} 💰/คน): ถ้ามีคนทำสำเร็จ ผู้สมทบรับคืน{' '}
                  <strong className="text-emerald-700">2 เท่า (200%)</strong>! ถ้าทำไม่สำเร็จจะไม่ได้รับคืน
                </p>

                {q.sponsors.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {q.sponsors.map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#ebd4aa] border border-[#c19a62] text-[11px] font-bold"
                      >
                        {s.userEmoji} {s.userName}: {s.amount}💰
                        {s.payoutAmount !== null && (
                          <span className={s.payoutAmount > 0 ? 'text-emerald-700 font-black' : 'text-rose-700'}>
                            → {s.payoutAmount > 0 ? `+${s.payoutAmount}💰` : '0💰'}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] italic text-[#8a6642]">
                    ยังไม่มีผู้สมทบรางวัล (กดปุ่ม 💰+ บนการ์ดหน้ากระดานเพื่อสมทบรางวัลได้เลย)
                  </p>
                )}
              </div>

              {/* Accept Quest OR Co-op Party Box */}
              <div className="rounded-xl bg-[#f9eed6] border-2 border-[#c69d63] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-[family-name:var(--font-kanit)] font-extrabold text-sm text-[#5b320e]">
                    ⚔️ {q.status === 'open' ? 'รับเควส & ชวนเพื่อน Co-op' : 'ปาร์ตี้ผู้ทำเควส (Co-op)'}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-400 text-[10.5px] font-extrabold">
                    โบนัส +{q.coopBonusPct}% ({Math.round(q.coopMultiplier * 100)}%)
                  </span>
                </div>

                {q.status === 'open' ? (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-semibold text-[#774f28]">
                      กำหนดวันเริ่ม–วันจบเองได้เลย ชวนเพื่อนร่วมปาร์ตี้ได้ เพิ่มคนละ +10% (ต้องทำสำเร็จครบทุกคน!)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-extrabold mb-0.5">วันเริ่มต้น</label>
                        <input
                          type="date"
                          value={acceptStartDate}
                          onChange={(e) => setAcceptStartDate(e.target.value)}
                          className="w-full rounded-lg bg-white border-2 border-[#b78f5c] px-2 py-1.5 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold mb-0.5">วันสิ้นสุด</label>
                        <input
                          type="date"
                          value={acceptEndDate}
                          onChange={(e) => setAcceptEndDate(e.target.value)}
                          className="w-full rounded-lg bg-white border-2 border-[#b78f5c] px-2 py-1.5 text-xs font-bold"
                        />
                      </div>
                    </div>
                    <p
                      className={`text-[11px] font-extrabold ${
                        rangeDays !== null && rangeDays >= 1
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {rangeDays !== null && rangeDays >= 1
                        ? `ระยะเวลาที่เลือก: ${rangeDays} วัน`
                        : 'วันสิ้นสุดต้องอยู่หลังวันเริ่มต้นอย่างน้อย 1 วัน'}
                    </p>

                    {inviteCandidates.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-extrabold mb-1">
                          ชวนเพื่อนทำ Co-op ด้วยกัน (ไม่บังคับ):
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {inviteCandidates.map((p) => {
                            const checked = selectedInviteIds.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  setSelectedInviteIds((prev) =>
                                    prev.includes(p.id)
                                      ? prev.filter((id) => id !== p.id)
                                      : [...prev, p.id]
                                  )
                                }
                                className={`px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition ${
                                  checked
                                    ? 'bg-emerald-600 text-white border-emerald-800'
                                    : 'bg-[#efe0c0] text-[#553416] border-[#c29b64]'
                                }`}
                              >
                                {checked ? '✓ ' : '+ '}
                                {p.emoji} {p.name}
                              </button>
                            );
                          })}
                        </div>
                        {selectedInviteIds.length > 0 && (
                          <p className="text-[10.5px] font-bold text-emerald-800 mt-1">
                            ถ้าชวนครบ {1 + selectedInviteIds.length} คน → รางวัลคนละ{' '}
                            {Math.round(computeCoopMultiplier(1 + selectedInviteIds.length) * 100)}% ={' '}
                            {computePerMemberQuestReward(
                              q.totalSponsorPool,
                              1 + selectedInviteIds.length
                            ).toLocaleString()}{' '}
                            💰/คน!
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={busy || !currentUser || rangeDays === null || rangeDays < 1}
                      onClick={() =>
                        runQuestAction(
                          q.id,
                          {
                            action: 'accept',
                            startDate: acceptStartDate,
                            endDate: acceptEndDate,
                            inviteUserIds: selectedInviteIds,
                          },
                          true
                        )
                      }
                      className="ro-gold-btn w-full py-2.5 rounded-xl font-[family-name:var(--font-kanit)] font-extrabold text-sm cursor-pointer disabled:opacity-50"
                    >
                      ⚔️ รับเควสนี้เลย! (เปิดเดิมพัน 25% แรก • {formatCountdownTh(computeBettingWindowMs(Math.max(1, rangeDays || q.durationDays)))})
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-[#efe0c0] px-3 py-2 text-xs font-extrabold text-[#5b320e] flex items-center justify-between">
                      <span>รางวัลต่อคนถ้าทำสำเร็จครบทุกคน:</span>
                      <span className="text-emerald-700 text-sm">
                        {q.perMemberReward.toLocaleString()} 💰 / คน
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {acceptedParty.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-start justify-between gap-2 bg-[#fff9ec] border border-[#d0ae79] rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-extrabold">
                              {m.userEmoji} {m.userName}
                            </span>{' '}
                            {m.role === 'leader' && (
                              <span className="text-[10px] bg-amber-300 text-amber-950 px-1.5 py-0.2 rounded font-extrabold">
                                หัวหน้าตี้
                              </span>
                            )}
                            {m.proofText && (
                              <p className="text-[11px] text-[#6d4723] mt-0.5 break-words">
                                📎 หลักฐาน: {m.proofText}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full ${
                              m.memberCompleted
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-400'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {m.memberCompleted ? 'ส่งผลแล้ว ✅' : 'กำลังทำ'}
                          </span>
                        </div>
                      ))}

                      {pendingInvites.length > 0 && (
                        <div className="text-[11px] text-[#7c5329] font-semibold">
                          รอตอบรับคำเชิญ:{' '}
                          {pendingInvites.map((m) => `${m.userEmoji} ${m.userName}`).join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Leader invite more friends while active */}
                    {isMeLeader && q.status === 'active' && inviteCandidates.length > 0 && (
                      <div className="flex gap-1.5 pt-1">
                        <select
                          value={extraInviteId}
                          onChange={(e) => setExtraInviteId(e.target.value)}
                          className="flex-1 rounded-lg bg-white border-2 border-[#b78f5c] px-2 py-1.5 text-xs font-bold"
                        >
                          <option value="">+ เลือกเพื่อนชวนเข้าตี้ Co-op...</option>
                          {inviteCandidates.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.emoji} {p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy || !extraInviteId}
                          onClick={async () => {
                            const ok = await runQuestAction(q.id, {
                              action: 'invite',
                              targetUserId: Number(extraInviteId),
                            });
                            if (ok) setExtraInviteId('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#7c4d25] hover:bg-[#5c3616] text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                        >
                          เชิญ (+10%)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: 7-Day Betting Window + Proof Submission & Voting/Resolution */}
            <div className="space-y-4">
              {/* Betting Box */}
              <div className="rounded-xl bg-[#f9eed6] border-2 border-[#c69d63] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-[family-name:var(--font-kanit)] font-extrabold text-sm text-[#5b320e]">
                    🎲 เดิมพันทายผล (25% แรกของเวลาเควส)
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                      q.isBettingOpen
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-300 text-stone-700'
                    }`}
                  >
                    {q.isBettingOpen
                      ? `เปิดรับ! เหลือ ${formatCountdownTh(liveBetMs)}`
                      : q.status === 'open'
                      ? 'รอมีคนรับเควส'
                      : 'ปิดรับเดิมพันแล้ว'}
                  </span>
                </div>

                {/* Pool Ratio Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-extrabold">
                    <span className="text-emerald-700">
                      ✅ ทำสำเร็จ: {q.successBetPool.toLocaleString()} 💰
                    </span>
                    <span className="text-rose-700">
                      ❌ ไม่สำเร็จ: {q.failBetPool.toLocaleString()} 💰
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-rose-300 overflow-hidden border border-[#8e6739]">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: q.totalBetPool > 0 ? `${successPct}%` : '50%' }}
                    />
                  </div>
                </div>

                <p className="text-[11px] font-semibold text-[#774f28]">
                  ทายถูกได้รับ: <strong>เงินเดิมพัน + ส่วนแบ่งฝั่งแพ้ (Pro-rata)</strong> การันตีขั้นต่ำ{' '}
                  <strong className="text-emerald-700">2 เท่าของที่ลง!</strong>
                </p>

                {q.isBettingOpen && currentUser && (
                  <div className="space-y-2 pt-1">
                    {isMeInPartyOrInvited && (
                      <div className="text-[11px] font-extrabold text-amber-900 bg-amber-200/80 border border-amber-500 rounded-lg px-2.5 py-1">
                        ⚔️ คุณอยู่ในปาร์ตี้ทำเควสนี้ — เดิมพันได้เฉพาะฝั่ง &quot;ทำสำเร็จ ✅&quot; เท่านั้น!
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={Boolean(myExistingBet && myExistingBet.side !== 'success')}
                        onClick={() => setBetSide('success')}
                        className={`py-2 rounded-xl border-2 text-xs font-extrabold cursor-pointer transition disabled:opacity-40 ${
                          effectiveBetSide === 'success'
                            ? 'bg-emerald-600 text-white border-emerald-900 shadow'
                            : 'bg-[#efe0c0] text-emerald-900 border-[#c29b64]'
                        }`}
                      >
                        ✅ ทำสำเร็จแน่นอน!
                      </button>
                      <button
                        type="button"
                        disabled={
                          isMeInPartyOrInvited ||
                          Boolean(myExistingBet && myExistingBet.side !== 'fail')
                        }
                        onClick={() => setBetSide('fail')}
                        className={`py-2 rounded-xl border-2 text-xs font-extrabold cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed ${
                          effectiveBetSide === 'fail'
                            ? 'bg-rose-600 text-white border-rose-900 shadow'
                            : 'bg-[#efe0c0] text-rose-900 border-[#c29b64]'
                        }`}
                      >
                        ❌ น่าจะไม่รอด!
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={QUEST_MAX_STAKE}
                        value={betAmt}
                        onChange={(e) => setBetAmt(e.target.value)}
                        className="w-24 rounded-lg bg-white border-2 border-[#b78f5c] px-2.5 py-1.5 text-xs font-extrabold"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runQuestAction(
                            q.id,
                            { action: 'bet', side: effectiveBetSide, amount: Number(betAmt) },
                            true
                          )
                        }
                        className="ro-gold-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50"
                      >
                        🎲 วางเดิมพัน {Number(betAmt) || 0} 💰
                      </button>
                    </div>

                    {simResult && previewBetStake >= QUEST_MIN_STAKE && (
                      <p className="text-[11px] font-bold text-emerald-800">
                        💡 ถ้าทายถูก จะได้รับประมาณ{' '}
                        <strong>{simResult.payout.toLocaleString()} 💰</strong>{' '}
                        {simResult.usedMinGuarantee ? '(ใช้การันตีขั้นต่ำ 2 เท่า!)' : '(รวมส่วนแบ่งฝั่งแพ้)'}
                      </p>
                    )}
                  </div>
                )}

                {q.bets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {q.bets.map((b) => (
                      <span
                        key={b.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                          b.side === 'success'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                            : 'bg-rose-50 border-rose-400 text-rose-900'
                        }`}
                      >
                        {b.userEmoji} {b.userName} ({b.side === 'success' ? '✅' : '❌'} {b.amount}💰)
                        {b.payoutAmount !== null && (
                          <strong className={b.payoutAmount > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            → {b.payoutAmount}💰
                          </strong>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Proof Submission, Voting & Resolution Box */}
              {q.status !== 'open' && (
                <div className="rounded-xl bg-[#f9eed6] border-2 border-[#c69d63] p-3.5 space-y-3">
                  <h4 className="font-[family-name:var(--font-kanit)] font-extrabold text-sm text-[#5b320e]">
                    ⚖️ ส่งหลักฐาน & ตัดสินผลเควส
                  </h4>

                  {/* Party Member Proof Submission */}
                  {(q.status === 'active' || q.status === 'voting') && isMeAcceptedParty && (
                    <div className="space-y-2 bg-[#fff8ea] border border-[#d2b07d] rounded-xl p-3">
                      <label className="block text-xs font-extrabold text-[#5a3210]">
                        📎 ส่งสรุปผล / หลักฐานความสำเร็จของคุณ:
                      </label>
                      <textarea
                        rows={2}
                        value={proofText}
                        onChange={(e) => setProofText(e.target.value)}
                        placeholder="เช่น เดินครบ 260,000 ก้าวแล้ว แนบสถิติในแอปเรียบร้อย / ผ่านครบ 30 วัน!"
                        className="w-full rounded-lg bg-white border-2 border-[#b78f5c] px-2.5 py-1.5 text-xs font-semibold"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || !proofText.trim()}
                          onClick={() =>
                            runQuestAction(q.id, { action: 'submit_proof', proofText }, true)
                          }
                          className="ro-gold-btn px-4 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50"
                        >
                          ✅ ส่งหลักฐานของฉัน
                        </button>
                        {isMeLeader && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'ยืนยันประกาศ "ไม่ผ่าน / ยอมแพ้"? ระบบจะปิดเควสและจ่ายผลเดิมพันทันที'
                                )
                              ) {
                                runQuestAction(q.id, {
                                  action: 'resolve',
                                  outcome: 'failed',
                                  note: 'ปาร์ตี้ประกาศยอมแพ้',
                                });
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer"
                          >
                            🏳️ ยอมแพ้ (ไม่ผ่าน)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Creator Force-Fail Control for Abandoned Active Quests */}
                  {q.status === 'active' && isMeNonPartyCreator && (
                    <div className="rounded-xl bg-[#fff8ea] border border-[#d2b07d] p-2.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#6c441e]">
                        🛡️ ผู้สร้างเควส: หากเลยกำหนดแล้วปาร์ตี้ไม่ส่งผล สามารถปิดเควสเป็นไม่ผ่านได้
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              'ยืนยันปิดเควสนี้เป็น "ไม่ผ่าน"? ระบบจะจ่ายผลเดิมพันฝั่งไม่สำเร็จทันที'
                            )
                          ) {
                            runQuestAction(q.id, {
                              action: 'resolve',
                              outcome: 'failed',
                              note: 'ผู้สร้างเควสปิดผลเป็นไม่ผ่าน',
                            });
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold cursor-pointer shrink-0"
                      >
                        ❌ ปิดเควส (ไม่ผ่าน)
                      </button>
                    </div>
                  )}

                  {/* Voting Panel (for non-party members when status === 'voting') */}
                  {q.status === 'voting' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-extrabold bg-[#efe0c0] rounded-lg px-3 py-2">
                        <span>ผลโหวตเพื่อนในสนาม:</span>
                        <span className="space-x-2">
                          <span className="text-emerald-700">ผ่าน ✅ {q.passVoteCount}</span>
                          <span className="text-rose-700">ไม่ผ่าน ❌ {q.failVoteCount}</span>
                        </span>
                      </div>

                      {q.votes.length > 0 && (
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          {q.votes.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-start justify-between gap-2 bg-[#fff9ec] border border-[#d0ae79] rounded-lg px-2.5 py-1 text-[11px]"
                            >
                              <div className="min-w-0">
                                <span className="font-extrabold">
                                  {v.voterEmoji} {v.voterName}
                                </span>
                                {v.comment && (
                                  <span className="text-[#6d4723] font-semibold"> — {v.comment}</span>
                                )}
                              </div>
                              <span
                                className={`shrink-0 font-extrabold ${
                                  v.vote === 'pass' ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {v.vote === 'pass' ? 'ผ่าน ✅' : 'ไม่ผ่าน ❌'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {currentUser && !isMeAcceptedParty && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={voteComment}
                            onChange={(e) => setVoteComment(e.target.value)}
                            placeholder="คอมเมนต์ประกอบการโหวต (ไม่บังคับ)"
                            className="w-full rounded-lg bg-white border border-[#b78f5c] px-2.5 py-1.5 text-xs font-semibold"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runQuestAction(q.id, {
                                  action: 'vote',
                                  vote: 'pass',
                                  comment: voteComment,
                                })
                              }
                              className={`py-2 rounded-xl text-xs font-extrabold border-2 cursor-pointer ${
                                myVote?.vote === 'pass'
                                  ? 'bg-emerald-600 text-white border-emerald-900'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-500 hover:bg-emerald-200'
                              }`}
                            >
                              ✅ โหวตผ่าน!
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runQuestAction(q.id, {
                                  action: 'vote',
                                  vote: 'fail',
                                  comment: voteComment,
                                })
                              }
                              className={`py-2 rounded-xl text-xs font-extrabold border-2 cursor-pointer ${
                                myVote?.vote === 'fail'
                                  ? 'bg-rose-600 text-white border-rose-900'
                                  : 'bg-rose-100 text-rose-900 border-rose-500 hover:bg-rose-200'
                              }`}
                            >
                              ❌ โหวตไม่ผ่าน
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Finalize Resolution Controls */}
                      {currentUser &&
                        !isMeAcceptedParty &&
                        (isMeNonPartyCreator || q.passVoteCount + q.failVoteCount >= 1) && (
                          <div className="pt-2 border-t border-[#d1b07b] space-y-2">
                            <input
                              type="text"
                              value={resolveNote}
                              onChange={(e) => setResolveNote(e.target.value)}
                              placeholder="หมายเหตุปิดเควส (เช่น ตรวจครบทุกคนแล้วผ่านฉลุย!)"
                              className="w-full rounded-lg bg-white border border-[#b78f5c] px-2.5 py-1.5 text-xs font-semibold"
                            />
                            <div className="flex flex-wrap gap-2">
                              {(isMeNonPartyCreator || q.passVoteCount > q.failVoteCount) &&
                                allPartySubmitted && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      runQuestAction(
                                        q.id,
                                        { action: 'resolve', outcome: 'completed', note: resolveNote },
                                        true
                                      )
                                    }
                                    className="ro-gold-btn flex-1 py-2 px-3 rounded-xl text-xs font-extrabold cursor-pointer"
                                  >
                                    🏆 ยืนยันเควสสำเร็จ & จ่ายรางวัลทั้งหมด!
                                  </button>
                                )}
                              {(isMeNonPartyCreator || q.failVoteCount >= q.passVoteCount) && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    runQuestAction(q.id, {
                                      action: 'resolve',
                                      outcome: 'failed',
                                      note: resolveNote,
                                    })
                                  }
                                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer"
                                >
                                  ❌ ปิดเควส (ไม่ผ่าน)
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Finished Outcome Banner */}
                  {(q.status === 'completed' || q.status === 'failed') && (
                    <div
                      className={`rounded-xl p-3 border-2 text-xs font-extrabold space-y-1 ${
                        q.status === 'completed'
                          ? 'bg-emerald-100 border-emerald-500 text-emerald-950'
                          : 'bg-rose-100 border-rose-500 text-rose-950'
                      }`}
                    >
                      <div className="text-sm">
                        {q.status === 'completed'
                          ? '🎉 เควสสำเร็จสมบูรณ์! จ่ายรางวัล Co-op, คืนยอดสมทบ 200%, และจ่ายเดิมพันเรียบร้อย!'
                          : '❌ เควสไม่สำเร็จ — จ่ายผลเดิมพันฝั่ง "ไม่สำเร็จ" เรียบร้อยแล้ว'}
                      </div>
                      {q.resolutionNote && (
                        <p className="font-semibold opacity-85">หมายเหตุ: {q.resolutionNote}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
    >
      {/* Ragnarok Mobile Wooden Mission Board Frame */}
      <div
        className="ro-wood-board relative w-full max-w-[960px] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.85)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Center Golden Ribbon Banner ("Mission Board") */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none">
          <div className="ro-ribbon-tail-left" />
          <div className="ro-gold-ribbon px-7 sm:px-10 py-1.5 sm:py-2 rounded-md">
            <span className="font-[family-name:var(--font-kanit)] font-black text-base sm:text-xl tracking-wide text-[#fff7db] drop-shadow-[0_2px_2px_rgba(120,53,15,0.95)] whitespace-nowrap">
              Mission Board • กระดานเควส
            </span>
          </div>
          <div className="ro-ribbon-tail-right" />
        </div>

        {/* Top-Right Crimson Red Close Button (X) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดกระดานเควส"
          className="ro-close-btn absolute -top-4 -right-3 sm:-top-5 sm:-right-4 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white text-2xl font-black cursor-pointer transition-transform hover:scale-105 active:scale-95"
        >
          ✕
        </button>

        {/* Inner Wooden Plank Wall */}
        <div className="ro-wood-planks rounded-[12px] pt-8 pb-3 px-2 sm:px-4">
          {/* Upper Rail: Filter Tabs + Create Quest CTA */}
          {screen === 'board' && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 sm:px-4 pb-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: `ทั้งหมด (${quests.length})` },
                    { id: 'open', label: `📌 เปิดรับ (${counts.open})` },
                    { id: 'betting', label: `🎲 ช่วงเดิมพัน (${counts.betting})` },
                    { id: 'active', label: `⚔️ กำลังทำ (${counts.active})` },
                    { id: 'finished', label: `🏆 จบแล้ว (${counts.finished})` },
                  ] as Array<{ id: BoardFilter; label: string }>
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold border cursor-pointer transition ${
                      filter === tab.id
                        ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#3d1e05] border-[#fff1c1] shadow'
                        : 'bg-[#3d210e]/85 text-[#f2d6a7] border-[#784925] hover:bg-[#532e15]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setScreen('create');
                }}
                className="ro-gold-btn px-3.5 py-1.5 rounded-xl font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm cursor-pointer"
              >
                + สร้างเควสใหม่
              </button>
            </div>
          )}

          {/* Main Content Area */}
          {screen === 'board' && renderBoardCards()}
          {screen === 'create' && renderCreateForm()}
          {screen === 'detail' && renderQuestDetail()}

          {/* Bottom Dark Wooden Status Bar (RO Mobile style) */}
          <div className="mt-2 flex justify-center px-2">
            <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#2a160a]/90 border border-[#7c4d27] rounded-full px-4 py-1 text-[11px] font-extrabold text-[#f2dbb5] shadow-inner">
              <span>
                💰 เหรียญของคุณ:{' '}
                <span className="text-amber-300">
                  {currentUser ? `${currentUser.points.toLocaleString()} GP` : 'ยังไม่ล็อกอิน'}
                </span>
              </span>
              <span className="opacity-40">|</span>
              <span>
                🎲 ช่วงเดิมพันเปิด:{' '}
                <span className="text-rose-400">{counts.betting} เควส</span>
              </span>
              <span className="opacity-40 hidden sm:inline">|</span>
              <span className="hidden sm:inline">
                🤝 Co-op โบนัส: <span className="text-emerald-300">+10% ต่อเพื่อน 1 คน</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
