import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { fetchAllQuests } from '@/lib/quest_board_db';
import { assertActiveUserSession } from '@/lib/session_guard';
import {
  QUEST_MIN_DURATION_DAYS,
  computeBetPayouts,
  computeBettingWindowMs,
  computeBettingWindowState,
  computePerMemberQuestReward,
  computeSponsorPayout,
  formatCountdownTh,
  validateQuestDateRange,
  validateStakeIncrement,
  type BetSide,
  type QuestStatus,
  type VoteChoice,
} from '@/lib/quest_board';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await context.params;
    const questId = Number(rawId);
    if (!Number.isFinite(questId) || questId <= 0) {
      return NextResponse.json({ error: 'รหัสเควสไม่ถูกต้อง' }, { status: 400 });
    }

    const body = await req.json();
    const action = String(body.action ?? '').trim();
    const userId = Number(body.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 400 });
    }

    const kickResp = await assertActiveUserSession(req, userId);
    if (kickResp) return kickResp;

    const [questRes, userRes] = await Promise.all([
      turso.execute({ sql: `SELECT * FROM quests WHERE id = ?`, args: [questId] }),
      turso.execute({ sql: `SELECT id, name, points FROM users WHERE id = ?`, args: [userId] }),
    ]);

    if (questRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบเควสนี้บนกระดาน' }, { status: 404 });
    }
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้เล่น' }, { status: 404 });
    }

    const q = questRes.rows[0];
    const qStatus = String(q.status || 'open') as QuestStatus;
    const creatorId = Number(q.creator_id);
    const nowIso = new Date().toISOString();

    // -----------------------------------------------------------------------
    // 1. SPONSOR: Add Gacha coins to quest reward pool (10–500 per user/quest)
    // -----------------------------------------------------------------------
    if (action === 'sponsor') {
      if (qStatus !== 'open') {
        return NextResponse.json(
          { error: 'ไม่สามารถลงรางวัลเพิ่มได้ เนื่องจากมีผู้รับเควสนี้ไปแล้ว' },
          { status: 400 }
        );
      }

      const addAmount = Math.floor(Number(body.amount ?? 0));
      const existingRes = await turso.execute({
        sql: `SELECT amount FROM quest_sponsors WHERE quest_id = ? AND user_id = ?`,
        args: [questId, userId],
      });
      const existingAmt = existingRes.rows.length > 0 ? Number(existingRes.rows[0].amount ?? 0) : 0;

      const check = validateStakeIncrement(existingAmt, addAmount);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }

      const deductRes = await turso.execute({
        sql: `UPDATE users SET points = points - ? WHERE id = ? AND points >= ?`,
        args: [addAmount, userId, addAmount],
      });
      if ((deductRes.rowsAffected ?? 0) === 0) {
        return NextResponse.json(
          { error: `เหรียญ Gacha ไม่พอ (ต้องการ ${addAmount} 💰)` },
          { status: 400 }
        );
      }

      if (existingRes.rows.length > 0) {
        await turso.execute({
          sql: `UPDATE quest_sponsors SET amount = amount + ?, updated_at = CURRENT_TIMESTAMP WHERE quest_id = ? AND user_id = ?`,
          args: [addAmount, questId, userId],
        });
      } else {
        await turso.execute({
          sql: `INSERT INTO quest_sponsors (quest_id, user_id, amount) VALUES (?, ?, ?)`,
          args: [questId, userId, addAmount],
        });
      }

      const updatedUser = await turso.execute({ sql: `SELECT points FROM users WHERE id = ?`, args: [userId] });
      const quests = await fetchAllQuests();
      return NextResponse.json({
        message: `สมทบรางวัล +${addAmount} 💰 เรียบร้อย! (ถ้าเควสสำเร็จรับคืน 2 เท่า!)`,
        userPoints: Number(updatedUser.rows[0]?.points ?? 0),
        quests,
      });
    }

    // -----------------------------------------------------------------------
    // 2. ACCEPT: Accept an open quest with user-chosen startDate/endDate & invites
    // -----------------------------------------------------------------------
    if (action === 'accept') {
      if (qStatus !== 'open') {
        return NextResponse.json({ error: 'เควสนี้มีผู้รับทำไปแล้ว' }, { status: 409 });
      }

      const startDate = String(body.startDate ?? '').trim();
      const endDate = String(body.endDate ?? '').trim();
      const rangeCheck = validateQuestDateRange(startDate, endDate, QUEST_MIN_DURATION_DAYS);
      if (!rangeCheck.ok) {
        return NextResponse.json({ error: rangeCheck.error }, { status: 400 });
      }

      const bettingWindowMs = computeBettingWindowMs(rangeCheck.days);
      const bettingEndsAt = new Date(Date.now() + bettingWindowMs).toISOString();

      const claimRes = await turso.execute({
        sql: `
          UPDATE quests
          SET status = 'active',
              acceptor_id = ?,
              start_date = ?,
              end_date = ?,
              accepted_at = ?,
              betting_ends_at = ?
          WHERE id = ? AND status = 'open'
        `,
        args: [userId, startDate, endDate, nowIso, bettingEndsAt, questId],
      });

      if ((claimRes.rowsAffected ?? 0) === 0) {
        return NextResponse.json({ error: 'มีคนรับเควสนี้ไปก่อนหน้าแล้ว' }, { status: 409 });
      }

      await turso.execute({
        sql: `
          INSERT OR REPLACE INTO quest_party (quest_id, user_id, role, invite_status, proof_text, member_completed)
          VALUES (?, ?, 'leader', 'accepted', '', 0)
        `,
        args: [questId, userId],
      });

      const inviteIds: number[] = Array.isArray(body.inviteUserIds)
        ? Array.from(
            new Set(
              body.inviteUserIds
                .map((x: unknown) => Number(x))
                .filter((n: number) => Number.isFinite(n) && n > 0 && n !== userId)
            )
          )
        : [];

      for (const friendId of inviteIds) {
        await turso.execute({
          sql: `
            INSERT OR IGNORE INTO quest_party (quest_id, user_id, role, invite_status, proof_text, member_completed)
            VALUES (?, ?, 'member', 'invited', '', 0)
          `,
          args: [questId, friendId],
        });
      }

      const quests = await fetchAllQuests();
      return NextResponse.json({
        message: `รับเควสสำเร็จ! เปิดช่วงวางเดิมพัน 25% แรก (${formatCountdownTh(bettingWindowMs)}) แล้ว 🎲`,
        quests,
      });
    }

    // -----------------------------------------------------------------------
    // 3. INVITE: Party leader invites a friend to co-op
    // -----------------------------------------------------------------------
    if (action === 'invite') {
      if (qStatus !== 'active') {
        return NextResponse.json({ error: 'เชิญเพื่อนได้เฉพาะตอนเควสกำลังดำเนินอยู่เท่านั้น' }, { status: 400 });
      }
      if (Number(q.acceptor_id) !== userId) {
        return NextResponse.json({ error: 'เฉพาะหัวหน้าปาร์ตี้ผู้รับเควสเท่านั้นที่เชิญเพื่อนได้' }, { status: 403 });
      }
      const targetUserId = Number(body.targetUserId);
      if (!Number.isFinite(targetUserId) || targetUserId <= 0 || targetUserId === userId) {
        return NextResponse.json({ error: 'กรุณาเลือกเพื่อนที่ต้องการเชิญ' }, { status: 400 });
      }

      const failBetCheck = await turso.execute({
        sql: `SELECT id FROM quest_bets WHERE quest_id = ? AND user_id = ? AND side = 'fail'`,
        args: [questId, targetUserId],
      });
      if (failBetCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'เพื่อนคนนี้วางเดิมพันฝั่ง "ไม่สำเร็จ" ไปแล้ว ไม่สามารถชวนเข้าปาร์ตี้ได้' },
          { status: 400 }
        );
      }

      await turso.execute({
        sql: `
          INSERT INTO quest_party (quest_id, user_id, role, invite_status, proof_text, member_completed)
          VALUES (?, ?, 'member', 'invited', '', 0)
          ON CONFLICT(quest_id, user_id) DO UPDATE SET invite_status = 'invited'
          WHERE invite_status = 'declined'
        `,
        args: [questId, targetUserId],
      });

      const quests = await fetchAllQuests();
      return NextResponse.json({ message: 'ส่งคำเชิญเข้าปาร์ตี้ Co-op แล้ว!', quests });
    }

    // -----------------------------------------------------------------------
    // 4. RESPOND_INVITE: Invited friend accepts or declines Co-op invite
    // -----------------------------------------------------------------------
    if (action === 'respond_invite') {
      if (qStatus !== 'active') {
        return NextResponse.json({ error: 'เควสนี้ไม่ได้อยู่ในสถานะกำลังทำแล้ว' }, { status: 400 });
      }
      const accept = Boolean(body.accept);

      const invRes = await turso.execute({
        sql: `SELECT id, role, invite_status FROM quest_party WHERE quest_id = ? AND user_id = ?`,
        args: [questId, userId],
      });
      if (invRes.rows.length === 0) {
        return NextResponse.json({ error: 'ไม่พบคำเชิญของคุณในเควสนี้' }, { status: 404 });
      }
      const invRole = String(invRes.rows[0].role ?? '');
      const invStatus = String(invRes.rows[0].invite_status ?? '');
      if (invRole !== 'member' || invStatus !== 'invited') {
        return NextResponse.json(
          { error: 'ไม่สามารถเปลี่ยนสถานะคำเชิญได้ (คุณเข้าร่วมปาร์ตี้หรือดำเนินการไปแล้ว)' },
          { status: 400 }
        );
      }

      if (accept) {
        const failBetCheck = await turso.execute({
          sql: `SELECT id FROM quest_bets WHERE quest_id = ? AND user_id = ? AND side = 'fail'`,
          args: [questId, userId],
        });
        if (failBetCheck.rows.length > 0) {
          return NextResponse.json(
            { error: 'คุณได้วางเดิมพันฝั่ง "ไม่สำเร็จ" ไปแล้ว จึงไม่สามารถเข้าร่วมปาร์ตี้ทำเควสนี้ได้' },
            { status: 400 }
          );
        }
      }

      const updInvRes = await turso.execute({
        sql: `UPDATE quest_party SET invite_status = ? WHERE quest_id = ? AND user_id = ? AND role = 'member' AND invite_status = 'invited'`,
        args: [accept ? 'accepted' : 'declined', questId, userId],
      });
      if ((updInvRes.rowsAffected ?? 0) === 0) {
        return NextResponse.json({ error: 'คำเชิญนี้ถูกดำเนินการไปแล้ว' }, { status: 409 });
      }

      const quests = await fetchAllQuests();
      return NextResponse.json({
        message: accept ? 'เข้าร่วมปาร์ตี้ Co-op แล้ว! รางวัลทุกคน +10%!' : 'ปฏิเสธคำเชิญแล้ว',
        quests,
      });
    }

    // -----------------------------------------------------------------------
    // 5. BET: Place Gacha bet during the 7-day betting window
    // -----------------------------------------------------------------------
    if (action === 'bet') {
      const bettingEndsAt = q.betting_ends_at ? String(q.betting_ends_at) : null;
      const winState = computeBettingWindowState(qStatus, bettingEndsAt);
      if (!winState.isBettingOpen) {
        return NextResponse.json(
          { error: 'หมดช่วงวางเดิมพัน 7 วันแรกของเควสนี้แล้ว' },
          { status: 400 }
        );
      }

      const side: BetSide = body.side === 'fail' ? 'fail' : 'success';
      const addAmount = Math.floor(Number(body.amount ?? 0));

      // Party members (leader, accepted, or invited) can ONLY bet on 'success'
      const partyCheck = await turso.execute({
        sql: `SELECT invite_status FROM quest_party WHERE quest_id = ? AND user_id = ? AND invite_status IN ('accepted', 'invited')`,
        args: [questId, userId],
      });
      if (partyCheck.rows.length > 0 && side === 'fail') {
        return NextResponse.json(
          { error: 'ผู้รับเควสและเพื่อนในปาร์ตี้สามารถวางเดิมพันได้เฉพาะฝั่ง "ทำสำเร็จ" เท่านั้น!' },
          { status: 400 }
        );
      }

      const existingBetRes = await turso.execute({
        sql: `SELECT side, amount FROM quest_bets WHERE quest_id = ? AND user_id = ?`,
        args: [questId, userId],
      });
      let existingAmt = 0;
      if (existingBetRes.rows.length > 0) {
        const existingSide = String(existingBetRes.rows[0].side);
        if (existingSide !== side) {
          return NextResponse.json(
            {
              error: `คุณวางเดิมพันฝั่ง "${existingSide === 'success' ? 'ทำสำเร็จ' : 'ไม่สำเร็จ'}" ไว้แล้ว ไม่สามารถแทงสวนทั้งสองฝั่งได้`,
            },
            { status: 400 }
          );
        }
        existingAmt = Number(existingBetRes.rows[0].amount ?? 0);
      }

      const check = validateStakeIncrement(existingAmt, addAmount);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }

      const deductRes = await turso.execute({
        sql: `UPDATE users SET points = points - ? WHERE id = ? AND points >= ?`,
        args: [addAmount, userId, addAmount],
      });
      if ((deductRes.rowsAffected ?? 0) === 0) {
        return NextResponse.json(
          { error: `เหรียญ Gacha ไม่พอสำหรับวางเดิมพัน (ต้องการ ${addAmount} 💰)` },
          { status: 400 }
        );
      }

      if (existingBetRes.rows.length > 0) {
        await turso.execute({
          sql: `UPDATE quest_bets SET amount = amount + ?, updated_at = CURRENT_TIMESTAMP WHERE quest_id = ? AND user_id = ?`,
          args: [addAmount, questId, userId],
        });
      } else {
        await turso.execute({
          sql: `INSERT INTO quest_bets (quest_id, user_id, side, amount) VALUES (?, ?, ?, ?)`,
          args: [questId, userId, side, addAmount],
        });
      }

      const updatedUser = await turso.execute({ sql: `SELECT points FROM users WHERE id = ?`, args: [userId] });
      const quests = await fetchAllQuests();
      return NextResponse.json({
        message: `วางเดิมพันฝั่ง "${side === 'success' ? 'ทำสำเร็จ ✅' : 'ไม่สำเร็จ ❌'}" จำนวน ${addAmount} 💰 สำเร็จ!`,
        userPoints: Number(updatedUser.rows[0]?.points ?? 0),
        quests,
      });
    }

    // -----------------------------------------------------------------------
    // 6. SUBMIT_PROOF: Party member submits completion evidence
    // -----------------------------------------------------------------------
    if (action === 'submit_proof') {
      if (qStatus !== 'active' && qStatus !== 'voting') {
        return NextResponse.json({ error: 'เควสนี้ไม่ได้เปิดรับส่งหลักฐานแล้ว' }, { status: 400 });
      }

      const proofText = String(body.proofText ?? '').trim();
      if (!proofText || proofText.length < 3) {
        return NextResponse.json({ error: 'กรุณากรอกสรุปหลักฐานหรือผลลัพธ์ที่ทำได้' }, { status: 400 });
      }

      const memberRes = await turso.execute({
        sql: `SELECT id FROM quest_party WHERE quest_id = ? AND user_id = ? AND invite_status = 'accepted'`,
        args: [questId, userId],
      });
      if (memberRes.rows.length === 0) {
        return NextResponse.json({ error: 'เฉพาะสมาชิกในปาร์ตี้ที่รับเควสเท่านั้นที่ส่งหลักฐานได้' }, { status: 403 });
      }

      await turso.execute({
        sql: `UPDATE quest_party SET proof_text = ?, member_completed = 1 WHERE quest_id = ? AND user_id = ?`,
        args: [proofText.slice(0, 400), questId, userId],
      });

      const allMembersRes = await turso.execute({
        sql: `SELECT member_completed FROM quest_party WHERE quest_id = ? AND invite_status = 'accepted'`,
        args: [questId],
      });
      const allDone =
        allMembersRes.rows.length > 0 &&
        allMembersRes.rows.every((r) => Number(r.member_completed ?? 0) === 1);

      if (allDone && qStatus === 'active') {
        await turso.execute({
          sql: `UPDATE quests SET status = 'voting', submitted_at = ? WHERE id = ? AND status = 'active'`,
          args: [nowIso, questId],
        });
      }

      const quests = await fetchAllQuests();
      return NextResponse.json({
        message: allDone
          ? 'ส่งหลักฐานครบทุกคนในปาร์ตี้แล้ว! เปิดให้เพื่อนโหวต/ผู้สร้างยืนยันผลได้เลย ✅'
          : 'บันทึกหลักฐานของคุณแล้ว! รอเพื่อนร่วมปาร์ตี้ส่งให้ครบทุกคน',
        quests,
      });
    }

    // -----------------------------------------------------------------------
    // 7. VOTE: Non-party arena friend votes pass / fail on a voting quest
    // -----------------------------------------------------------------------
    if (action === 'vote') {
      if (qStatus !== 'voting') {
        return NextResponse.json({ error: 'เควสนี้ยังไม่ได้อยู่ในช่วงโหวตตัดสินผล' }, { status: 400 });
      }

      const partyCheck = await turso.execute({
        sql: `SELECT id FROM quest_party WHERE quest_id = ? AND user_id = ? AND invite_status = 'accepted'`,
        args: [questId, userId],
      });
      if (partyCheck.rows.length > 0) {
        return NextResponse.json({ error: 'ผู้ทำเควสไม่สามารถโหวตตัดสินเควสตัวเองได้' }, { status: 403 });
      }

      const vote: VoteChoice = body.vote === 'fail' ? 'fail' : 'pass';
      const comment = String(body.comment ?? '').trim().slice(0, 200);

      await turso.execute({
        sql: `
          INSERT INTO quest_votes (quest_id, voter_id, vote, comment)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(quest_id, voter_id) DO UPDATE SET vote = excluded.vote, comment = excluded.comment
        `,
        args: [questId, userId, vote, comment],
      });

      const quests = await fetchAllQuests();
      return NextResponse.json({
        message: `บันทึกโหวต "${vote === 'pass' ? 'ผ่าน ✅' : 'ไม่ผ่าน ❌'}" เรียบร้อย!`,
        quests,
      });
    }

    // -----------------------------------------------------------------------
    // 8. RESOLVE: Finalize quest outcome and settle all Gacha payouts atomically
    // -----------------------------------------------------------------------
    if (action === 'resolve') {
      if (qStatus !== 'active' && qStatus !== 'voting') {
        return NextResponse.json({ error: 'เควสนี้ถูกตัดสินและจ่ายรางวัลไปแล้ว' }, { status: 409 });
      }

      const outcome: 'completed' | 'failed' = body.outcome === 'completed' ? 'completed' : 'failed';
      const note = String(body.note ?? '').trim().slice(0, 240);

      const partyRes = await turso.execute({
        sql: `SELECT user_id, role, member_completed FROM quest_party WHERE quest_id = ? AND invite_status = 'accepted'`,
        args: [questId],
      });
      const acceptedParty = partyRes.rows.map((r) => ({
        userId: Number(r.user_id),
        role: String(r.role),
        completed: Number(r.member_completed ?? 0) === 1,
      }));
      const isPartyMember = acceptedParty.some((m) => m.userId === userId);
      const isLeader = Number(q.acceptor_id) === userId;
      const isNonPartyCreator = creatorId === userId && !isPartyMember;

      const votesRes = await turso.execute({
        sql: `SELECT voter_id, vote FROM quest_votes WHERE quest_id = ?`,
        args: [questId],
      });
      const passVotes = votesRes.rows.filter((r) => String(r.vote) === 'pass').length;
      const failVotes = votesRes.rows.filter((r) => String(r.vote) === 'fail').length;
      const totalVotes = passVotes + failVotes;

      // Authorization rules:
      // 1) Party leader may voluntarily surrender (outcome === 'failed')
      // 2) Non-party creator may directly confirm outcome when in 'voting' (or mark 'failed' anytime)
      // 3) Any non-party player may finalize a 'voting' quest when >= 1 vote exists and majority supports the outcome
      let authorized = false;
      if (isLeader && outcome === 'failed') {
        authorized = true;
      } else if (isNonPartyCreator && (qStatus === 'voting' || outcome === 'failed')) {
        authorized = true;
      } else if (!isPartyMember && qStatus === 'voting' && totalVotes >= 1) {
        if (outcome === 'completed' && passVotes > failVotes) authorized = true;
        if (outcome === 'failed' && failVotes >= passVotes) authorized = true;
      }

      if (!authorized) {
        return NextResponse.json(
          {
            error: isPartyMember
              ? 'ผู้ทำเควสไม่สามารถกดยืนยันผ่านเองได้ ต้องให้เพื่อนโหวตผ่านหรือผู้สร้างเควสยืนยัน'
              : 'ต้องมีผลโหวตข้างมากจากเพื่อนในสนาม (หรือให้ผู้สร้างเควสกดยืนยันผล) ก่อนปิดเควส',
          },
          { status: 403 }
        );
      }

      // Enforce co-op rule: ALL party members must have completed to mark 'completed'
      if (outcome === 'completed') {
        const everyoneDone = acceptedParty.length > 0 && acceptedParty.every((m) => m.completed);
        if (!everyoneDone) {
          return NextResponse.json(
            { error: 'เควส Co-op จะสำเร็จได้ก็ต่อเมื่อสมาชิกในปาร์ตี้ทุกคนทำสำเร็จและส่งหลักฐานครบทุกคน!' },
            { status: 400 }
          );
        }
      }

      // Atomic transition guard to prevent double-payout
      const lockRes = await turso.execute({
        sql: `
          UPDATE quests
          SET status = ?,
              resolved_at = ?,
              resolved_by = ?,
              resolution_note = ?
          WHERE id = ? AND status IN ('active', 'voting')
        `,
        args: [outcome, nowIso, userId, note, questId],
      });
      if ((lockRes.rowsAffected ?? 0) === 0) {
        return NextResponse.json({ error: 'เควสนี้ถูกปิดผลไปแล้ว' }, { status: 409 });
      }

      const succeeded = outcome === 'completed';

      // Fetch sponsors & bets to compute payouts
      const [sponsorsRes, betsRes] = await Promise.all([
        turso.execute({ sql: `SELECT id, user_id, amount FROM quest_sponsors WHERE quest_id = ?`, args: [questId] }),
        turso.execute({ sql: `SELECT id, user_id, side, amount FROM quest_bets WHERE quest_id = ?`, args: [questId] }),
      ]);

      const totalSponsorPool = sponsorsRes.rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);

      // Accumulate total credits per userId & build atomic settlement batch
      const userCredits = new Map<number, number>();
      const addCredit = (uid: number, amt: number) => {
        if (amt <= 0) return;
        userCredits.set(uid, (userCredits.get(uid) ?? 0) + amt);
      };
      const settlementBatch: Array<{ sql: string; args: Array<number | string> }> = [];

      // A) Sponsor payouts: 200% on success, 0 on fail
      for (const s of sponsorsRes.rows) {
        const sId = Number(s.id);
        const sUid = Number(s.user_id);
        const sAmt = Number(s.amount ?? 0);
        const payout = computeSponsorPayout(sAmt, succeeded);
        settlementBatch.push({
          sql: `UPDATE quest_sponsors SET payout_amount = ? WHERE id = ?`,
          args: [payout, sId],
        });
        addCredit(sUid, payout);
      }

      // B) Co-op Party payouts: each member gets 100% + 10%*(N-1) of totalSponsorPool on success
      const perMemberReward = succeeded
        ? computePerMemberQuestReward(totalSponsorPool, acceptedParty.length)
        : 0;
      for (const m of acceptedParty) {
        settlementBatch.push({
          sql: `UPDATE quest_party SET payout_amount = ? WHERE quest_id = ? AND user_id = ?`,
          args: [perMemberReward, questId, m.userId],
        });
        addCredit(m.userId, perMemberReward);
      }

      // C) Betting payouts: stake + pro-rata losing pool, min 2x stake guarantee for winners
      const betInputs = betsRes.rows.map((b) => ({
        userId: Number(b.user_id),
        side: (String(b.side) === 'fail' ? 'fail' : 'success') as BetSide,
        amount: Number(b.amount ?? 0),
      }));
      const betResults = computeBetPayouts(betInputs, succeeded ? 'success' : 'fail');
      for (let i = 0; i < betsRes.rows.length; i++) {
        const bId = Number(betsRes.rows[i].id);
        const res = betResults[i];
        settlementBatch.push({
          sql: `UPDATE quest_bets SET payout_amount = ? WHERE id = ?`,
          args: [res.payout, bId],
        });
        addCredit(res.userId, res.payout);
      }

      // Credit all winning users inside the same write transaction
      for (const [uid, credit] of userCredits.entries()) {
        settlementBatch.push({
          sql: `UPDATE users SET points = points + ? WHERE id = ?`,
          args: [credit, uid],
        });
      }

      if (settlementBatch.length > 0) {
        await turso.batch(settlementBatch, 'write');
      }

      const updatedUser = await turso.execute({ sql: `SELECT points FROM users WHERE id = ?`, args: [userId] });
      const quests = await fetchAllQuests();
      return NextResponse.json({
        message: succeeded
          ? `เควสสำเร็จ! แจกรางวัลปาร์ตี้คนละ ${perMemberReward} 💰, คืนกองกลาง 2 เท่า, และจ่ายผลเดิมพันเรียบร้อย! 🎉`
          : 'สรุปผลเควส: ไม่ผ่าน — จ่ายผลเดิมพันฝั่ง "ไม่สำเร็จ" เรียบร้อยแล้ว',
        userPoints: Number(updatedUser.rows[0]?.points ?? 0),
        payoutSummary: {
          outcome,
          perMemberReward,
          totalUsersPaid: userCredits.size,
        },
        quests,
      });
    }

    return NextResponse.json({ error: `ไม่รู้จักคำสั่ง action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('POST /api/quests/[id]/action error:', err);
    return NextResponse.json({ error: 'ดำเนินการกับเควสไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
