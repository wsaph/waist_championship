'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  getBeltCommandLoadout,
  TAEKWONDO_BELTS,
  type TaekwondoBelt,
  type TaekwondoKickPose,
  type TaekwondoMove,
} from '@/lib/taekwondo_catalog';
import { TekkenTaekwondoFighter } from '@/components/TekkenTaekwondoFighter';

interface TaekwondoPvpArenaProps {
  currentUserId: number | null;
  playerName: string;
  playerEmoji: string;
  realBelt: TaekwondoBelt;
  wornBelt: TaekwondoBelt;
  onBackToLobby: () => void;
  onMatchXpEarned?: (xpScore: number) => void;
}

interface PvpFighterSlot {
  clientId: string;
  userId: number;
  name: string;
  emoji: string;
  beltTier: number;
  wornTier: number;
  xPct: number;
  hp: number;
  pose: TaekwondoKickPose;
  blocking: boolean;
  moveName?: string;
  trailHex?: string;
  combo: number;
}

interface PvpSpark {
  id: number;
  xPct: number;
  yPct: number;
  text: string;
  colorHex: string;
}

const MAX_HP = 100;
const PVP_ROUND_SECONDS = 60;

const FALLBACK_PVP_ULT: TaekwondoMove = {
  id: 'pvp_jump_kick',
  minTier: 0,
  codeName: 'JUMP KICK',
  thName: 'กระโดดถีบ',
  emoji: '⚡',
  pose: 'flying_spin',
  trailHex: '#facc15',
  bonusDesc: 'ท่ากระโดดถีบ PvP',
  scoreBonusPct: 15,
  splashTargets: 1,
  cooldownSec: 4,
  slot: 'ultimate',
};

const FALLBACK_PVP_MID: TaekwondoMove = {
  id: 'pvp_side_kick',
  minTier: 0,
  codeName: 'SIDE KICK',
  thName: 'เตะข้าง',
  emoji: '💥',
  pose: 'side_kick',
  trailHex: '#f97316',
  bonusDesc: 'เตะข้างมาตรฐาน PvP',
  scoreBonusPct: 10,
  splashTargets: 1,
  cooldownSec: 1,
  slot: 'mid',
};

export function TaekwondoPvpArena({
  currentUserId,
  playerName,
  playerEmoji,
  realBelt,
  wornBelt,
  onBackToLobby,
  onMatchXpEarned,
}: TaekwondoPvpArenaProps) {
  const [roomCode, setRoomCode] = useState<string>('DOJO');
  const [roomInput, setRoomInput] = useState<string>('DOJO');
  const [connStatus, setConnStatus] = useState<'setup' | 'connecting' | 'waiting' | 'fighting' | 'finished'>('setup');
  const [connError, setConnError] = useState<string>('');
  const [mySide, setMySide] = useState<'p1' | 'p2'>('p1');
  const [timeLeft, setTimeLeft] = useState<number>(PVP_ROUND_SECONDS);
  const [banner, setBanner] = useState<string | null>(null);
  const [winnerSide, setWinnerSide] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [shake, setShake] = useState<boolean>(false);
  const [hitFlash, setHitFlash] = useState<boolean>(false);
  const [sparks, setSparks] = useState<PvpSpark[]>([]);
  const [cdBasicUntil, setCdBasicUntil] = useState<number>(0);
  const [cdMidUntil, setCdMidUntil] = useState<number>(0);
  const [cdUltUntil, setCdUltUntil] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const [p1, setP1] = useState<PvpFighterSlot | null>(null);
  const [p2, setP2] = useState<PvpFighterSlot | null>(null);

  const clientIdRef = useRef<string>(
    `tkd-${currentUserId || 'g'}-${Math.random().toString(36).slice(2, 8)}`
  );
  const sbRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mySideRef = useRef<'p1' | 'p2'>('p1');
  const connStatusRef = useRef(connStatus);
  connStatusRef.current = connStatus;
  const p1Ref = useRef<PvpFighterSlot | null>(null);
  p1Ref.current = p1;
  const p2Ref = useRef<PvpFighterSlot | null>(null);
  p2Ref.current = p2;
  const sparkIdRef = useRef<number>(1);
  const rewardClaimedRef = useRef<boolean>(false);
  const myMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oppMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadout = getBeltCommandLoadout(realBelt.tier);
  const moveBasic = loadout.basic;
  const moveMid = loadout.mid || FALLBACK_PVP_MID;
  const moveUlt = loadout.ultimate || FALLBACK_PVP_ULT;

  const playSfx = useCallback((kind: 'hit' | 'block' | 'whiff' | 'ult' | 'ko') => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const t = ctx.currentTime;
      const tone = (f1: number, f2: number, start: number, dur: number, type: OscillatorType, vol: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f1, t + start);
        osc.frequency.exponentialRampToValueAtTime(f2, t + start + dur);
        g.gain.setValueAtTime(vol, t + start);
        g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t + start);
        osc.stop(t + start + dur + 0.02);
      };
      if (kind === 'ult') {
        tone(140, 48, 0, 0.2, 'sawtooth', 0.26);
        tone(420, 1280, 0.04, 0.18, 'triangle', 0.22);
      } else if (kind === 'hit') {
        tone(180, 62, 0, 0.12, 'sawtooth', 0.22);
        tone(380, 740, 0.02, 0.1, 'triangle', 0.15);
      } else if (kind === 'block') {
        tone(520, 310, 0, 0.09, 'square', 0.14);
      } else if (kind === 'ko') {
        tone(300, 75, 0, 0.35, 'sawtooth', 0.24);
        tone(660, 880, 0.18, 0.25, 'triangle', 0.18);
      } else {
        tone(260, 160, 0, 0.08, 'triangle', 0.1);
      }
      setTimeout(() => ctx.close().catch(() => {}), 750);
    } catch {
      // ignore
    }
  }, []);

  const addSpark = useCallback((xPct: number, yPct: number, text: string, colorHex: string) => {
    const id = sparkIdRef.current++;
    setSparks((prev) => [...prev.slice(-6), { id, xPct, yPct, text, colorHex }]);
    setTimeout(() => setSparks((prev) => prev.filter((s) => s.id !== id)), 560);
  }, []);

  const leaveRoom = useCallback(() => {
    if (channelRef.current && sbRef.current) {
      try {
        sbRef.current.removeChannel(channelRef.current);
      } catch {
        // ignore
      }
    }
    channelRef.current = null;
    setP1(null);
    setP2(null);
    setWinnerSide(null);
    setBanner(null);
    setConnStatus('setup');
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current && sbRef.current) {
        try {
          sbRef.current.removeChannel(channelRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const finishPvpMatch = useCallback(
    (winner: 'p1' | 'p2' | 'draw', isKo: boolean) => {
      if (connStatusRef.current === 'finished') return;
      connStatusRef.current = 'finished';
      setConnStatus('finished');
      setWinnerSide(winner);
      setBanner(isKo ? 'K.O.!!' : 'TIME OVER!');
      playSfx('ko');

      const iWon = winner === mySideRef.current;
      if (iWon) {
        confetti({ particleCount: 110, spread: 85, origin: { y: 0.55 } });
      }
      if (!rewardClaimedRef.current) {
        rewardClaimedRef.current = true;
        // Winner gets +85 XP, Loser/Draw gets +40 XP (still respects 1-belt-per-round cap in API!)
        onMatchXpEarned?.(iWon ? 85 : 40);
      }
      setTimeout(() => setBanner(null), 1300);
    },
    [onMatchXpEarned, playSfx]
  );

  const joinRoom = useCallback(
    (rawCode: string) => {
      const cleanCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'DOJO';
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) {
        setConnError('ยังไม่ได้ตั้งค่า Supabase Realtime ในโปรเจกต์');
        return;
      }

      leaveRoom();
      setRoomCode(cleanCode);
      setConnError('');
      setConnStatus('connecting');

      const sb =
        sbRef.current ||
        createClient(url, key, {
          realtime: { params: { eventsPerSecond: 25 } },
        });
      sbRef.current = sb;

      const ch = sb.channel(`waist-tkd-pvp-${cleanCode}`, {
        config: {
          broadcast: { self: false },
          presence: { key: clientIdRef.current },
        },
      });
      channelRef.current = ch;

      const syncPresence = () => {
        const state = ch.presenceState<{
          clientId: string;
          userId: number;
          name: string;
          emoji: string;
          beltTier: number;
          wornTier: number;
          joinedAt: number;
        }>();
        const members = Object.values(state)
          .flat()
          .filter((m) => Boolean(m?.clientId))
          .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

        const slot1 = members[0] || null;
        const slot2 = members[1] || null;

        if (slot1) {
          setP1((prev) =>
            prev && prev.clientId === slot1.clientId
              ? { ...prev, name: slot1.name, emoji: slot1.emoji, beltTier: slot1.beltTier, wornTier: slot1.wornTier }
              : {
                  clientId: slot1.clientId,
                  userId: slot1.userId,
                  name: slot1.name,
                  emoji: slot1.emoji,
                  beltTier: slot1.beltTier,
                  wornTier: slot1.wornTier,
                  xPct: 26,
                  hp: MAX_HP,
                  pose: 'idle',
                  blocking: false,
                  combo: 0,
                }
          );
        } else {
          setP1(null);
        }

        if (slot2) {
          setP2((prev) =>
            prev && prev.clientId === slot2.clientId
              ? { ...prev, name: slot2.name, emoji: slot2.emoji, beltTier: slot2.beltTier, wornTier: slot2.wornTier }
              : {
                  clientId: slot2.clientId,
                  userId: slot2.userId,
                  name: slot2.name,
                  emoji: slot2.emoji,
                  beltTier: slot2.beltTier,
                  wornTier: slot2.wornTier,
                  xPct: 74,
                  hp: MAX_HP,
                  pose: 'idle',
                  blocking: false,
                  combo: 0,
                }
          );
        } else {
          setP2(null);
        }

        const side: 'p1' | 'p2' = slot2?.clientId === clientIdRef.current ? 'p2' : 'p1';
        mySideRef.current = side;
        setMySide(side);
      };

      ch.on('presence', { event: 'sync' }, syncPresence);
      ch.on('presence', { event: 'join' }, syncPresence);
      ch.on('presence', { event: 'leave' }, syncPresence);

      // Receive round start / rematch signal
      ch.on('broadcast', { event: 'start_fight' }, () => {
        rewardClaimedRef.current = false;
        setTimeLeft(PVP_ROUND_SECONDS);
        setWinnerSide(null);
        setP1((prev) => (prev ? { ...prev, xPct: 26, hp: MAX_HP, pose: 'idle', blocking: false, combo: 0 } : prev));
        setP2((prev) => (prev ? { ...prev, xPct: 74, hp: MAX_HP, pose: 'idle', blocking: false, combo: 0 } : prev));
        setConnStatus('fighting');
        setBanner('ROUND 1 • FIGHT!');
        setTimeout(() => setBanner(null), 900);
      });

      // Receive opponent position / block / pose updates
      ch.on('broadcast', { event: 'fighter_state' }, ({ payload }) => {
        if (!payload) return;
        const side: 'p1' | 'p2' = payload.side;
        const updater = (prev: PvpFighterSlot | null) =>
          prev
            ? {
                ...prev,
                xPct: typeof payload.xPct === 'number' ? payload.xPct : prev.xPct,
                blocking: Boolean(payload.blocking),
                pose: (payload.pose as TaekwondoKickPose) || prev.pose,
                moveName: payload.moveName,
                trailHex: payload.trailHex,
              }
            : prev;
        if (side === 'p1') setP1(updater);
        else setP2(updater);
      });

      // Receive incoming attack from opponent
      ch.on('broadcast', { event: 'fighter_attack' }, ({ payload }) => {
        if (!payload || connStatusRef.current !== 'fighting') return;
        const attackerSide: 'p1' | 'p2' = payload.side;
        const defenderSide: 'p1' | 'p2' = attackerSide === 'p1' ? 'p2' : 'p1';
        const pose: TaekwondoKickPose = payload.pose || 'front_kick';
        const dmg = Number(payload.dmg || 10);
        const range = Number(payload.range || 28);
        const moveName = String(payload.moveName || 'KICK!');
        const trailHex = String(payload.trailHex || '#38bdf8');
        const isUlt = Boolean(payload.isUlt);

        // Animate attacker
        const setAttacker = attackerSide === 'p1' ? setP1 : setP2;
        setAttacker((prev) => (prev ? { ...prev, pose, moveName, trailHex, blocking: false } : prev));
        if (oppMoveTimerRef.current) clearTimeout(oppMoveTimerRef.current);
        oppMoveTimerRef.current = setTimeout(() => {
          setAttacker((prev) => (prev ? { ...prev, pose: 'idle', moveName: undefined } : prev));
        }, isUlt ? 360 : 240);

        // If WE are the defender, resolve hit & broadcast updated HP!
        if (defenderSide === mySideRef.current) {
          const attacker = attackerSide === 'p1' ? p1Ref.current : p2Ref.current;
          const defender = defenderSide === 'p1' ? p1Ref.current : p2Ref.current;
          if (!attacker || !defender) return;
          const dist = Math.abs(attacker.xPct - defender.xPct);
          if (dist <= range) {
            const blocked = defender.blocking;
            const actualDmg = blocked ? Math.max(2, Math.round(dmg * 0.25)) : dmg;
            const nextHp = Math.max(0, defender.hp - actualDmg);
            const knockDir = defender.xPct >= attacker.xPct ? 1 : -1;
            const nextX = Math.max(12, Math.min(88, defender.xPct + knockDir * (blocked ? 3 : 8)));

            const setDef = defenderSide === 'p1' ? setP1 : setP2;
            setDef((prev) =>
              prev ? { ...prev, hp: nextHp, xPct: nextX, pose: blocked ? 'idle' : 'hurt' } : prev
            );
            if (!blocked) {
              setTimeout(() => {
                setDef((prev) => (prev && prev.pose === 'hurt' ? { ...prev, pose: 'idle' } : prev));
              }, 240);
            }

            playSfx(blocked ? 'block' : isUlt ? 'ult' : 'hit');
            addSpark(
              defender.xPct,
              58,
              blocked ? `🛡️ BLOCK -${actualDmg}` : `💥 -${actualDmg}`,
              blocked ? '#38bdf8' : trailHex
            );
            if (!blocked) {
              setShake(true);
              setHitFlash(true);
              setTimeout(() => setShake(false), 140);
              setTimeout(() => setHitFlash(false), 100);
            }

            ch.send({
              type: 'broadcast',
              event: 'hit_confirm',
              payload: {
                defenderSide,
                nextHp,
                nextX,
                actualDmg,
                blocked,
                trailHex,
              },
            });

            if (nextHp <= 0) {
              finishPvpMatch(attackerSide, true);
            }
          }
        }
      });

      // Receive hit confirmation from defender so attacker sees exact HP & hit sparks
      ch.on('broadcast', { event: 'hit_confirm' }, ({ payload }) => {
        if (!payload) return;
        const defenderSide: 'p1' | 'p2' = payload.defenderSide;
        const nextHp = Number(payload.nextHp ?? 0);
        const nextX = Number(payload.nextX ?? 50);
        const actualDmg = Number(payload.actualDmg ?? 0);
        const blocked = Boolean(payload.blocked);
        const trailHex = String(payload.trailHex || '#facc15');

        const setDef = defenderSide === 'p1' ? setP1 : setP2;
        setDef((prev) =>
          prev ? { ...prev, hp: nextHp, xPct: nextX, pose: blocked ? 'idle' : 'hurt' } : prev
        );
        if (!blocked) {
          setTimeout(() => {
            setDef((prev) => (prev && prev.pose === 'hurt' ? { ...prev, pose: 'idle' } : prev));
          }, 240);
        }

        playSfx(blocked ? 'block' : 'hit');
        addSpark(
          nextX,
          58,
          blocked ? `🛡️ BLOCK -${actualDmg}` : `⚡ HIT! -${actualDmg}`,
          blocked ? '#38bdf8' : trailHex
        );
        if (!blocked) {
          setShake(true);
          setHitFlash(true);
          setTimeout(() => setShake(false), 130);
          setTimeout(() => setHitFlash(false), 90);
        }

        if (nextHp <= 0) {
          finishPvpMatch(defenderSide === 'p1' ? 'p2' : 'p1', true);
        }
      });

      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({
            clientId: clientIdRef.current,
            userId: currentUserId || 0,
            name: playerName,
            emoji: playerEmoji,
            beltTier: realBelt.tier,
            wornTier: wornBelt.tier,
            joinedAt: Date.now(),
          });
          setConnStatus('waiting');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnError('เชื่อมต่อห้องเรียลไทม์ไม่สำเร็จ ลองกดเข้าใหม่อีกครั้ง');
          setConnStatus('setup');
        }
      });
    },
    [addSpark, currentUserId, finishPvpMatch, leaveRoom, playSfx, playerEmoji, playerName, realBelt.tier, wornBelt.tier]
  );

  // Round countdown timer + cooldown UI ticker
  useEffect(() => {
    if (connStatus !== 'fighting') return;
    const tickIv = setInterval(() => setNowTick(Date.now()), 120);
    const secIv = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const hp1 = p1Ref.current?.hp ?? 0;
          const hp2 = p2Ref.current?.hp ?? 0;
          const winner: 'p1' | 'p2' | 'draw' = hp1 > hp2 ? 'p1' : hp2 > hp1 ? 'p2' : 'draw';
          finishPvpMatch(winner, false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      clearInterval(tickIv);
      clearInterval(secIv);
    };
  }, [connStatus, finishPvpMatch]);

  const startFight = useCallback(() => {
    if (!channelRef.current || !p1Ref.current || !p2Ref.current) return;
    rewardClaimedRef.current = false;
    setTimeLeft(PVP_ROUND_SECONDS);
    setWinnerSide(null);
    setP1((prev) => (prev ? { ...prev, xPct: 26, hp: MAX_HP, pose: 'idle', blocking: false, combo: 0 } : prev));
    setP2((prev) => (prev ? { ...prev, xPct: 74, hp: MAX_HP, pose: 'idle', blocking: false, combo: 0 } : prev));
    setConnStatus('fighting');
    setBanner('ROUND 1 • FIGHT!');
    setTimeout(() => setBanner(null), 900);
    channelRef.current.send({ type: 'broadcast', event: 'start_fight', payload: { at: Date.now() } });
  }, []);

  const stepMove = useCallback((deltaX: number) => {
    if (connStatusRef.current !== 'fighting') return;
    const side = mySideRef.current;
    const cur = side === 'p1' ? p1Ref.current : p2Ref.current;
    const opp = side === 'p1' ? p2Ref.current : p1Ref.current;
    if (!cur) return;

    let nextX = Math.max(12, Math.min(88, cur.xPct + deltaX));
    // Keep a small minimum separation so fighters don't completely overlap
    if (opp && Math.abs(nextX - opp.xPct) < 12) {
      nextX = cur.xPct;
    }

    const setter = side === 'p1' ? setP1 : setP2;
    setter((prev) => (prev ? { ...prev, xPct: nextX, blocking: false } : prev));
    channelRef.current?.send({
      type: 'broadcast',
      event: 'fighter_state',
      payload: { side, xPct: nextX, blocking: false, pose: 'idle' },
    });
  }, []);

  const setGuard = useCallback((blocking: boolean) => {
    if (connStatusRef.current !== 'fighting') return;
    const side = mySideRef.current;
    const cur = side === 'p1' ? p1Ref.current : p2Ref.current;
    if (!cur) return;
    const setter = side === 'p1' ? setP1 : setP2;
    setter((prev) => (prev ? { ...prev, blocking } : prev));
    channelRef.current?.send({
      type: 'broadcast',
      event: 'fighter_state',
      payload: { side, xPct: cur.xPct, blocking, pose: 'idle' },
    });
  }, []);

  const performPvpKick = useCallback(
    (slot: 'basic' | 'mid' | 'ult') => {
      if (connStatusRef.current !== 'fighting') return;
      const now = Date.now();
      if (slot === 'basic' && now < cdBasicUntil) return;
      if (slot === 'mid' && now < cdMidUntil) return;
      if (slot === 'ult' && now < cdUltUntil) return;

      const move = slot === 'basic' ? moveBasic : slot === 'mid' ? moveMid : moveUlt;
      const dmg = slot === 'basic' ? 10 : slot === 'mid' ? 16 : 26;
      const range = slot === 'basic' ? 28 : slot === 'mid' ? 33 : 40;
      const cdMs = slot === 'basic' ? 420 : slot === 'mid' ? 1100 : 4200;

      if (slot === 'basic') setCdBasicUntil(now + cdMs);
      else if (slot === 'mid') setCdMidUntil(now + cdMs);
      else setCdUltUntil(now + cdMs);

      const side = mySideRef.current;
      const cur = side === 'p1' ? p1Ref.current : p2Ref.current;
      const opp = side === 'p1' ? p2Ref.current : p1Ref.current;
      if (!cur) return;

      // Small forward lunge when kicking
      let nextX = cur.xPct;
      if (opp) {
        const dir = opp.xPct >= cur.xPct ? 1 : -1;
        const candidate = Math.max(12, Math.min(88, cur.xPct + dir * 4));
        if (Math.abs(candidate - opp.xPct) >= 12) nextX = candidate;
      }

      const setter = side === 'p1' ? setP1 : setP2;
      setter((prev) =>
        prev
          ? {
              ...prev,
              xPct: nextX,
              pose: move.pose,
              blocking: false,
              moveName: `${move.emoji} ${move.codeName}!`,
              trailHex: move.trailHex,
            }
          : prev
      );
      playSfx(slot === 'ult' ? 'ult' : 'whiff');

      if (myMoveTimerRef.current) clearTimeout(myMoveTimerRef.current);
      myMoveTimerRef.current = setTimeout(() => {
        setter((prev) => (prev ? { ...prev, pose: 'idle', moveName: undefined } : prev));
      }, slot === 'ult' ? 360 : 240);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'fighter_attack',
        payload: {
          side,
          xPct: nextX,
          pose: move.pose,
          dmg,
          range,
          moveName: `${move.emoji} ${move.codeName}!`,
          trailHex: move.trailHex,
          isUlt: slot === 'ult',
        },
      });
    },
    [cdBasicUntil, cdMidUntil, cdUltUntil, moveBasic, moveMid, moveUlt, playSfx]
  );

  // Keyboard support for PC players (A/D move, S block, J/K/L kicks)
  useEffect(() => {
    if (connStatus !== 'fighting') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') stepMove(-9);
      else if (k === 'd' || k === 'arrowright') stepMove(9);
      else if (k === 's' || k === 'arrowdown') setGuard(true);
      else if (k === 'j') performPvpKick('basic');
      else if (k === 'k') performPvpKick('mid');
      else if (k === 'l') performPvpKick('ult');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 's' || k === 'arrowdown') setGuard(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [connStatus, performPvpKick, setGuard, stepMove]);

  const p1Belt = TAEKWONDO_BELTS[p1?.wornTier ?? 0] ?? TAEKWONDO_BELTS[0];
  const p2Belt = TAEKWONDO_BELTS[p2?.wornTier ?? 0] ?? TAEKWONDO_BELTS[0];
  const p1Facing: 'left' | 'right' = (p1?.xPct ?? 26) <= (p2?.xPct ?? 74) ? 'right' : 'left';
  const p2Facing: 'left' | 'right' = p1Facing === 'right' ? 'left' : 'right';

  const midCdSec = Math.max(0, Math.ceil((cdMidUntil - nowTick) / 1000));
  const ultCdSec = Math.max(0, Math.ceil((cdUltUntil - nowTick) / 1000));

  return (
    <div className="space-y-3">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            leaveRoom();
            onBackToLobby();
          }}
          className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-extrabold text-amber-200 cursor-pointer"
        >
          ← กลับหน้าสำนัก
        </button>
        {connStatus !== 'setup' && (
          <div className="flex items-center gap-2 text-xs font-black">
            <span className="px-2.5 py-0.5 rounded bg-red-950 border border-amber-400 text-yellow-300">
              ห้อง: {roomCode} ({mySide.toUpperCase()})
            </span>
          </div>
        )}
      </div>

      {/* Room Setup */}
      {connStatus === 'setup' && (
        <div className="rounded-xl bg-gradient-to-b from-red-950/60 via-zinc-900 to-black border-2 border-amber-400/70 p-4 space-y-4">
          <div className="text-center space-y-1">
            <div className="text-xs font-black tracking-widest uppercase text-red-400">
              ONLINE REALTIME VERSUS • 1 VS 1
            </div>
            <h3 className="font-[family-name:var(--font-kanit)] font-black italic text-xl text-yellow-300">
              🥊 ประลองเทควันโดกับเพื่อน สไตล์ Tekken!
            </h3>
            <p className="text-xs text-zinc-300">
              เข้าห้องรหัสเดียวกันกับเพื่อน แล้วสู้กันสด ๆ แบบเรียลไทม์! เดินบุก ตั้งการ์ด และปล่อยท่าเตะตามสายที่ปลดล็อกได้เลย
            </p>
          </div>

          {connError && (
            <div className="rounded-lg bg-rose-950/80 border border-rose-500 px-3 py-2 text-xs font-bold text-rose-200 text-center">
              ⚠️ {connError}
            </div>
          )}

          <button
            type="button"
            onClick={() => joinRoom('DOJO')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 hover:brightness-110 text-black border-2 border-white font-[family-name:var(--font-kanit)] font-black italic text-base shadow-[0_4px_0_#7f1d1d] cursor-pointer"
          >
            ⚡ เข้าห้องด่วนทันที (ห้อง DOJO) — กดพร้อมเพื่อนได้เลย!
          </button>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              placeholder="ใส่รหัสห้อง เช่น 1234"
              maxLength={8}
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border-2 border-zinc-700 text-white font-black uppercase tracking-widest text-sm focus:border-yellow-400 outline-none"
            />
            <button
              type="button"
              onClick={() => joinRoom(roomInput)}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm cursor-pointer"
            >
              เข้าห้องนี้
            </button>
            <button
              type="button"
              onClick={() => {
                const rand = String(Math.floor(1000 + Math.random() * 9000));
                setRoomInput(rand);
                joinRoom(rand);
              }}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-amber-400/60 text-amber-200 font-extrabold text-xs cursor-pointer whitespace-nowrap"
            >
              🎲 สุ่มห้อง
            </button>
          </div>
        </div>
      )}

      {/* Connecting / Waiting for P2 */}
      {(connStatus === 'connecting' || connStatus === 'waiting') && (
        <div className="rounded-xl bg-zinc-950/90 border-2 border-amber-400/70 p-4 space-y-4">
          <div className="text-center">
            <div className="text-xs font-black uppercase tracking-widest text-amber-300">
              VS LOBBY • ห้อง {roomCode}
            </div>
            <div className="text-xs text-zinc-300 mt-0.5">
              บอกเพื่อนให้กดเข้าห้อง <b className="text-yellow-300">{roomCode}</b> เพื่อมาดวลกัน!
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="rounded-xl bg-red-950/40 border-2 border-red-500/80 p-3 flex flex-col items-center">
              <span className="text-[10px] font-black text-red-400 mb-1">PLAYER 1</span>
              {p1 ? (
                <>
                  <TekkenTaekwondoFighter emoji={p1.emoji} belt={p1Belt} pose="idle" facing="right" size="sm" />
                  <div className="font-extrabold text-white text-xs mt-1 truncate">{p1.name}</div>
                  <div className="text-[10px] text-amber-300">{p1Belt.name}</div>
                </>
              ) : (
                <div className="h-32 flex items-center text-xs text-zinc-500 animate-pulse">กำลังเชื่อมต่อ...</div>
              )}
            </div>

            <div className="font-[family-name:var(--font-kanit)] font-black italic text-3xl text-yellow-400 drop-shadow">
              VS
            </div>

            <div className="rounded-xl bg-blue-950/40 border-2 border-blue-500/80 p-3 flex flex-col items-center">
              <span className="text-[10px] font-black text-sky-400 mb-1">PLAYER 2</span>
              {p2 ? (
                <>
                  <TekkenTaekwondoFighter emoji={p2.emoji} belt={p2Belt} pose="idle" facing="left" size="sm" />
                  <div className="font-extrabold text-white text-xs mt-1 truncate">{p2.name}</div>
                  <div className="text-[10px] text-amber-300">{p2Belt.name}</div>
                </>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-center text-xs text-zinc-400 animate-pulse">
                  <span>⏳ รอเพื่อนเข้าห้อง...</span>
                  <span className="text-[10px] text-zinc-500 mt-1">รหัส: {roomCode}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={!p1 || !p2}
            onClick={startFight}
            className={`w-full py-3 rounded-xl border-2 font-[family-name:var(--font-kanit)] font-black italic text-base uppercase ${
              p1 && p2
                ? 'bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-black border-white shadow-[0_4px_0_#7f1d1d] cursor-pointer hover:brightness-110'
                : 'bg-zinc-900 text-zinc-500 border-zinc-700 cursor-not-allowed'
            }`}
          >
            {p1 && p2 ? '🥊 FIGHT!! เริ่มประลองทันที!' : '⏳ รอผู้ท้าชิงคนที่ 2 เข้าห้อง...'}
          </button>
        </div>
      )}

      {/* Live Fighting & Result Stage */}
      {(connStatus === 'fighting' || connStatus === 'finished') && p1 && p2 && (
        <div className={`space-y-2.5 transition-transform duration-75 ${shake ? 'translate-x-1.5 -translate-y-1' : ''}`}>
          {/* Classic Tekken 1v1 Health Bars */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-black italic">
                <span className="text-yellow-300 truncate">
                  {p1.name} {mySide === 'p1' ? '(คุณ)' : ''}
                </span>
                <span className="text-white">{p1.hp} HP</span>
              </div>
              <div className="h-4 sm:h-5 w-full bg-zinc-900 border-2 border-zinc-200 -skew-x-12 overflow-hidden p-0.5">
                <div
                  className={`h-full transition-all duration-200 ${
                    p1.hp <= 25 ? 'bg-red-600 animate-pulse' : 'bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300'
                  }`}
                  style={{ width: `${p1.hp}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center px-2.5 py-1 rounded-lg bg-black border-2 border-yellow-400 min-w-[56px]">
              <span className="text-[8px] font-black text-amber-300">TIME</span>
              <span className="font-[family-name:var(--font-kanit)] font-black italic text-xl text-yellow-300 leading-none">
                {timeLeft}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-black italic">
                <span className="text-white">{p2.hp} HP</span>
                <span className="text-sky-300 truncate">
                  {p2.name} {mySide === 'p2' ? '(คุณ)' : ''}
                </span>
              </div>
              <div className="h-4 sm:h-5 w-full bg-zinc-900 border-2 border-zinc-200 skew-x-12 overflow-hidden p-0.5">
                <div
                  className={`h-full ml-auto transition-all duration-200 ${
                    p2.hp <= 25 ? 'bg-red-600 animate-pulse' : 'bg-gradient-to-l from-blue-500 via-sky-400 to-cyan-300'
                  }`}
                  style={{ width: `${p2.hp}%` }}
                />
              </div>
            </div>
          </div>

          {/* 1v1 Tekken Dojang Stage */}
          <div
            className="relative w-full h-[300px] sm:h-[340px] rounded-xl border-2 border-amber-500/80 overflow-hidden shadow-2xl"
            style={{
              background:
                'linear-gradient(180deg, #1a0b0e 0%, #3b1319 34%, #7c2d12 58%, #1e293b 59%, #0f172a 100%)',
            }}
          >
            <div className="pointer-events-none absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-amber-400/25 blur-md" />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] border-t-2 border-amber-400/50"
              style={{
                background:
                  'repeating-linear-gradient(90deg, rgba(29,78,216,0.22) 0px, rgba(29,78,216,0.22) 38px, rgba(220,38,38,0.22) 38px, rgba(220,38,38,0.22) 76px)',
                transform: 'perspective(260px) rotateX(36deg)',
                transformOrigin: 'bottom center',
              }}
            />

            {hitFlash && <div className="pointer-events-none absolute inset-0 bg-yellow-200/20 z-30" />}

            {banner && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/35">
                <div className="px-6 py-2 -skew-x-12 bg-gradient-to-r from-red-700 via-amber-500 to-red-700 border-y-4 border-yellow-200 shadow-2xl">
                  <span className="font-[family-name:var(--font-kanit)] font-black italic text-3xl text-white drop-shadow-[0_3px_0_#000]">
                    {banner}
                  </span>
                </div>
              </div>
            )}

            {/* Hit Sparks */}
            {sparks.map((s) => (
              <div
                key={s.id}
                style={{ left: `${s.xPct}%`, top: `${s.yPct}%` }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-30 text-center"
              >
                <div
                  className="font-[family-name:var(--font-kanit)] font-black italic text-base drop-shadow-[0_2px_2px_#000] animate-bounce whitespace-nowrap"
                  style={{ color: s.colorHex }}
                >
                  {s.text}
                </div>
              </div>
            ))}

            {/* P1 Fighter */}
            <div
              style={{ left: `${p1.xPct}%`, top: '70%' }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-15 transition-all duration-100 ease-out"
            >
              {p1.moveName && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 -skew-x-12 px-2 py-0.5 bg-yellow-400 text-black font-black italic text-[10px] whitespace-nowrap shadow">
                  {p1.moveName}
                </div>
              )}
              <TekkenTaekwondoFighter
                emoji={p1.emoji}
                belt={p1Belt}
                pose={p1.pose}
                facing={p1Facing}
                blocking={p1.blocking}
                rageActive={p1.hp <= 30}
                trailHex={p1.trailHex}
                size="lg"
              />
            </div>

            {/* P2 Fighter */}
            <div
              style={{ left: `${p2.xPct}%`, top: '70%' }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-15 transition-all duration-100 ease-out"
            >
              {p2.moveName && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 -skew-x-12 px-2 py-0.5 bg-sky-400 text-black font-black italic text-[10px] whitespace-nowrap shadow">
                  {p2.moveName}
                </div>
              )}
              <TekkenTaekwondoFighter
                emoji={p2.emoji}
                belt={p2Belt}
                pose={p2.pose}
                facing={p2Facing}
                blocking={p2.blocking}
                rageActive={p2.hp <= 30}
                trailHex={p2.trailHex}
                size="lg"
              />
            </div>
          </div>

          {/* Fighting Controls or Rematch Panel */}
          {connStatus === 'fighting' ? (
            <div className="space-y-2">
              {/* Row 1: Movement + Guard */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onPointerDown={() => stepMove(-9)}
                  className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:translate-y-0.5 text-white border-2 border-zinc-500 font-black text-xs cursor-pointer"
                >
                  ⬅️ เดินซ้าย (A)
                </button>
                <button
                  type="button"
                  onPointerDown={() => setGuard(true)}
                  onPointerUp={() => setGuard(false)}
                  onPointerLeave={() => setGuard(false)}
                  className="py-2 rounded-lg bg-sky-900 hover:bg-sky-800 active:bg-sky-600 text-sky-100 border-2 border-sky-400 font-black text-xs cursor-pointer"
                >
                  🛡️ ตั้งการ์ดค้าง (S)
                </button>
                <button
                  type="button"
                  onPointerDown={() => stepMove(9)}
                  className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:translate-y-0.5 text-white border-2 border-zinc-500 font-black text-xs cursor-pointer"
                >
                  เดินขวา (D) ➡️
                </button>
              </div>

              {/* Row 2: Belt Kick Commands */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onPointerDown={() => performPvpKick('basic')}
                  className="py-2.5 px-1.5 rounded-lg bg-gradient-to-b from-sky-500 to-blue-700 active:translate-y-0.5 text-white border-2 border-sky-200 font-[family-name:var(--font-kanit)] font-black italic text-xs shadow-[0_3px_0_#1e3a8a] cursor-pointer truncate"
                >
                  {moveBasic.emoji} {moveBasic.thName} (J)
                </button>
                <button
                  type="button"
                  disabled={midCdSec > 0}
                  onPointerDown={() => performPvpKick('mid')}
                  className={`py-2.5 px-1.5 rounded-lg border-2 font-[family-name:var(--font-kanit)] font-black italic text-xs truncate ${
                    midCdSec === 0
                      ? 'bg-gradient-to-b from-amber-400 to-orange-600 active:translate-y-0.5 text-black border-yellow-100 shadow-[0_3px_0_#7c2d12] cursor-pointer'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-700 cursor-not-allowed'
                  }`}
                >
                  {midCdSec > 0 ? `⏳ ${midCdSec} วิ` : `${moveMid.emoji} ${moveMid.thName} (K)`}
                </button>
                <button
                  type="button"
                  disabled={ultCdSec > 0}
                  onPointerDown={() => performPvpKick('ult')}
                  className={`py-2.5 px-1.5 rounded-lg border-2 font-[family-name:var(--font-kanit)] font-black italic text-xs truncate ${
                    ultCdSec === 0
                      ? 'bg-gradient-to-b from-red-500 via-rose-600 to-amber-500 active:translate-y-0.5 text-white border-yellow-300 shadow-[0_3px_0_#4c0519] cursor-pointer animate-pulse'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-700 cursor-not-allowed'
                  }`}
                >
                  {ultCdSec > 0 ? `⏳ ${ultCdSec} วิ` : `${moveUlt.emoji} ${moveUlt.thName} (L)`}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-zinc-950/90 border-2 border-yellow-400 p-3 text-center space-y-2.5">
              <div className="font-[family-name:var(--font-kanit)] font-black italic text-xl text-yellow-300">
                {winnerSide === 'draw'
                  ? '🤝 DRAW GAME!'
                  : winnerSide === mySide
                  ? '🏆 YOU WIN!! (+85 XP)'
                  : `💥 ${winnerSide === 'p1' ? p1.name : p2.name} WINS! (+40 XP ฝึกซ้อม)`}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startFight}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-black border-2 border-white font-[family-name:var(--font-kanit)] font-black italic text-sm cursor-pointer"
                >
                  🥊 REMATCH! สู้อีกรอบ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    leaveRoom();
                    onBackToLobby();
                  }}
                  className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-200 border border-amber-400/60 font-extrabold text-sm cursor-pointer"
                >
                  📋 กลับหน้าสำนัก
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
