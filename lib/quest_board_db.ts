import { turso } from '@/lib/turso_client';
import {
  computeBettingWindowState,
  computeCoopMultiplier,
  computePerMemberQuestReward,
  type BetSide,
  type PartyInviteStatus,
  type QuestBetView,
  type QuestBoardItem,
  type QuestPartyMemberView,
  type QuestSponsorView,
  type QuestStatus,
  type QuestType,
  type QuestVoteView,
  type VoteChoice,
} from '@/lib/quest_board';

export async function fetchAllQuests(nowMs: number = Date.now()): Promise<QuestBoardItem[]> {
  const [questsRes, sponsorsRes, partyRes, betsRes, votesRes] = await Promise.all([
    turso.execute(`
      SELECT q.*,
             u.name AS creator_name,
             u.avatar_emoji AS creator_emoji,
             u.color_hex AS creator_color_hex
      FROM quests q
      LEFT JOIN users u ON u.id = q.creator_id
      ORDER BY
        CASE q.status
          WHEN 'active' THEN 1
          WHEN 'voting' THEN 2
          WHEN 'open' THEN 3
          ELSE 4
        END ASC,
        q.id DESC
    `),
    turso.execute(`
      SELECT s.*,
             u.name AS user_name,
             u.avatar_emoji AS user_emoji
      FROM quest_sponsors s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.amount DESC, s.id ASC
    `),
    turso.execute(`
      SELECT p.*,
             u.name AS user_name,
             u.avatar_emoji AS user_emoji,
             u.color_hex AS user_color_hex
      FROM quest_party p
      LEFT JOIN users u ON u.id = p.user_id
      ORDER BY
        CASE p.role WHEN 'leader' THEN 0 ELSE 1 END ASC,
        p.id ASC
    `),
    turso.execute(`
      SELECT b.*,
             u.name AS user_name,
             u.avatar_emoji AS user_emoji
      FROM quest_bets b
      LEFT JOIN users u ON u.id = b.user_id
      ORDER BY b.amount DESC, b.id ASC
    `),
    turso.execute(`
      SELECT v.*,
             u.name AS voter_name,
             u.avatar_emoji AS voter_emoji
      FROM quest_votes v
      LEFT JOIN users u ON u.id = v.voter_id
      ORDER BY v.id ASC
    `),
  ]);

  const sponsorsByQuest = new Map<number, QuestSponsorView[]>();
  for (const r of sponsorsRes.rows) {
    const qId = Number(r.quest_id);
    const list = sponsorsByQuest.get(qId) ?? [];
    list.push({
      id: Number(r.id),
      userId: Number(r.user_id),
      userName: String(r.user_name ?? 'ผู้เล่น'),
      userEmoji: String(r.user_emoji ?? '🐰'),
      amount: Number(r.amount ?? 0),
      payoutAmount: r.payout_amount === null || r.payout_amount === undefined ? null : Number(r.payout_amount),
    });
    sponsorsByQuest.set(qId, list);
  }

  const partyByQuest = new Map<number, QuestPartyMemberView[]>();
  for (const r of partyRes.rows) {
    const qId = Number(r.quest_id);
    const list = partyByQuest.get(qId) ?? [];
    list.push({
      id: Number(r.id),
      userId: Number(r.user_id),
      userName: String(r.user_name ?? 'ผู้เล่น'),
      userEmoji: String(r.user_emoji ?? '🐰'),
      userColorHex: String(r.user_color_hex ?? '#F8FAFC'),
      role: String(r.role) === 'leader' ? 'leader' : 'member',
      inviteStatus: (String(r.invite_status || 'accepted') as PartyInviteStatus),
      proofText: String(r.proof_text ?? ''),
      memberCompleted: Number(r.member_completed ?? 0) === 1,
      payoutAmount: r.payout_amount === null || r.payout_amount === undefined ? null : Number(r.payout_amount),
    });
    partyByQuest.set(qId, list);
  }

  const betsByQuest = new Map<number, QuestBetView[]>();
  for (const r of betsRes.rows) {
    const qId = Number(r.quest_id);
    const list = betsByQuest.get(qId) ?? [];
    list.push({
      id: Number(r.id),
      userId: Number(r.user_id),
      userName: String(r.user_name ?? 'ผู้เล่น'),
      userEmoji: String(r.user_emoji ?? '🐰'),
      side: String(r.side) === 'fail' ? 'fail' : 'success',
      amount: Number(r.amount ?? 0),
      payoutAmount: r.payout_amount === null || r.payout_amount === undefined ? null : Number(r.payout_amount),
    });
    betsByQuest.set(qId, list);
  }

  const votesByQuest = new Map<number, QuestVoteView[]>();
  for (const r of votesRes.rows) {
    const qId = Number(r.quest_id);
    const list = votesByQuest.get(qId) ?? [];
    list.push({
      id: Number(r.id),
      voterId: Number(r.voter_id),
      voterName: String(r.voter_name ?? 'ผู้เล่น'),
      voterEmoji: String(r.voter_emoji ?? '🐰'),
      vote: (String(r.vote) === 'fail' ? 'fail' : 'pass') as VoteChoice,
      comment: String(r.comment ?? ''),
    });
    votesByQuest.set(qId, list);
  }

  return questsRes.rows.map((r) => {
    const id = Number(r.id);
    const status = String(r.status || 'open') as QuestStatus;
    const sponsors = sponsorsByQuest.get(id) ?? [];
    const party = partyByQuest.get(id) ?? [];
    const bets = betsByQuest.get(id) ?? [];
    const votes = votesByQuest.get(id) ?? [];

    const totalSponsorPool = sponsors.reduce((s, x) => s + x.amount, 0);
    const activePartyCount = party.filter((m) => m.inviteStatus === 'accepted').length;
    const coopMultiplier = computeCoopMultiplier(activePartyCount || 1);
    const coopBonusPct = Math.round((coopMultiplier - 1) * 100);
    const perMemberReward = computePerMemberQuestReward(totalSponsorPool, activePartyCount || 1);

    const successBetPool = bets.filter((b) => b.side === 'success').reduce((s, x) => s + x.amount, 0);
    const failBetPool = bets.filter((b) => b.side === 'fail').reduce((s, x) => s + x.amount, 0);
    const totalBetPool = successBetPool + failBetPool;

    const passVoteCount = votes.filter((v) => v.vote === 'pass').length;
    const failVoteCount = votes.filter((v) => v.vote === 'fail').length;

    const bettingEndsAt = r.betting_ends_at ? String(r.betting_ends_at) : null;
    const { isBettingOpen, bettingMsRemaining } = computeBettingWindowState(
      status,
      bettingEndsAt,
      nowMs
    );

    return {
      id,
      creatorId: Number(r.creator_id),
      creatorName: String(r.creator_name ?? 'ผู้เล่น'),
      creatorEmoji: String(r.creator_emoji ?? '🐰'),
      creatorColorHex: String(r.creator_color_hex ?? '#F8FAFC'),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      questType: (String(r.quest_type) === 'template' ? 'template' : 'custom') as QuestType,
      templateKey: String(r.template_key ?? ''),
      targetValue: Number(r.target_value ?? 0),
      targetUnit: String(r.target_unit ?? ''),
      aiSummary: String(r.ai_summary ?? ''),
      durationDays: Number(r.duration_days ?? 30),
      status,
      acceptorId: r.acceptor_id === null || r.acceptor_id === undefined ? null : Number(r.acceptor_id),
      startDate: String(r.start_date ?? ''),
      endDate: String(r.end_date ?? ''),
      acceptedAt: r.accepted_at ? String(r.accepted_at) : null,
      bettingEndsAt,
      submittedAt: r.submitted_at ? String(r.submitted_at) : null,
      resolvedAt: r.resolved_at ? String(r.resolved_at) : null,
      resolvedBy: r.resolved_by === null || r.resolved_by === undefined ? null : Number(r.resolved_by),
      resolutionNote: String(r.resolution_note ?? ''),
      createdAt: String(r.created_at ?? ''),
      sponsors,
      totalSponsorPool,
      party,
      activePartyCount,
      coopMultiplier,
      coopBonusPct,
      perMemberReward,
      bets,
      successBetPool,
      failBetPool,
      totalBetPool,
      votes,
      passVoteCount,
      failVoteCount,
      isBettingOpen,
      bettingMsRemaining,
    };
  });
}

export async function fetchQuestById(
  questId: number,
  nowMs: number = Date.now()
): Promise<QuestBoardItem | null> {
  const all = await fetchAllQuests(nowMs);
  return all.find((q) => q.id === questId) ?? null;
}
