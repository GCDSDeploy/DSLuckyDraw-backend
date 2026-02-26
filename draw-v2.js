/**
 * 抽签逻辑 v2：无限奖池 + 轮次（第 1 次 20% / 第 2 次 100%）+ tier 65/20/10/5
 * 不读 signs 表，不扣库存；仅读写 draw_records。
 */

import { getConnection } from './draw.js';

const TIERS = ['阳光普照', '上签', '上上签', '特签'];
/** 累计概率 [65, 85, 95, 100] 对应 阳光普照/上签/上上签/特签 */
const TIER_CUMULATIVE = [65, 85, 95, 100];

function pickTier() {
  const r = Math.random() * 100;
  for (let i = 0; i < TIER_CUMULATIVE.length; i++) {
    if (r < TIER_CUMULATIVE[i]) return TIERS[i];
  }
  return TIERS[TIERS.length - 1];
}

/**
 * 根据 guest_id 查询最近一条记录（按 created_at DESC）
 */
async function getLastRecord(conn, guestId) {
  const [rows] = await conn.query(
    'SELECT draw_round, won, round_index FROM draw_records WHERE guest_id = ? ORDER BY created_at DESC LIMIT 1',
    [guestId]
  );
  return rows.length ? rows[0] : null;
}

/**
 * 判定当前是第 1 次还是第 2 次
 * 上一条是「第 1 次且未中签」→ 本次第 2 次；否则本次第 1 次
 */
function getDrawRound(last) {
  if (!last) return 1;
  if (last.draw_round === 1 && !last.won) return 2;
  return 1;
}

/**
 * 计算本轮的 round_index（第 N 轮）
 * 第 1 次：若上一条是第 2 次则 round_index = 上一条+1，否则与上一条同或 1
 * 第 2 次：与上一条（本轮的 第 1 次）同
 */
function getRoundIndex(last, drawRound) {
  if (!last) return 1;
  if (drawRound === 2) return last.round_index ?? 1;
  if (last.draw_round === 2) return (last.round_index ?? 1) + 1;
  return last.round_index ?? 1;
}

/**
 * 执行一次抽签（v2）：写入 draw_records，返回 API 所需结构
 * @param {string} guestId - 前端传入的 UUID
 * @returns {Promise<{ success: boolean, won: boolean, tier: string|null, drawRound: number, message: string, guestId: string, prizeImageUrl?: string }>}
 */
export async function drawV2(guestId) {
  const conn = await getConnection();
  try {
    const last = await getLastRecord(conn, guestId);
    const drawRound = getDrawRound(last);
    const roundIndex = getRoundIndex(last, drawRound);

    let won = false;
    let tier = null;
    if (drawRound === 1) {
      won = Math.random() * 100 < 20;
      if (won) tier = pickTier();
    } else {
      won = true;
      tier = pickTier();
    }

    const prizeImageUrl = won ? '' : undefined; // 可选：后续按 tier 填 URL

    await conn.query(
      `INSERT INTO draw_records (guest_id, draw_round, won, tier, prizeImageUrl, round_index) VALUES (?, ?, ?, ?, ?, ?)`,
      [guestId, drawRound, won, tier, prizeImageUrl || null, roundIndex]
    );

    const message = won ? '恭喜中奖！' : '未中奖，再试一次吧';
    const payload = {
      success: true,
      won,
      tier,
      drawRound,
      message,
      guestId,
    };
    if (won) payload.prizeImageUrl = prizeImageUrl ?? null;
    return payload;
  } finally {
    await conn.end();
  }
}
