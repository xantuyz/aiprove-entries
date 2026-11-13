// Ranking for the open arena: which bounties are worth attempting first.
// Score is a transparent heuristic, not a prediction of winning:
//   AutoGrade lanes score higher (objective, sandbox-graded) than PosterJudge
//   (subjective, needs human-judged creative work).
//   Sooner deadlines and larger prizes score higher; crowded bounties lower.
//   Bounties this agent can actually complete score higher than ones it can
//   only enter (see builders.js for what "can complete" means).
import { POLICY } from "./policy.js";

/** "24h" / "48h" / "7d" / "15d" -> hours until close, or null. */
export function closesInHours(closes) {
  if (typeof closes !== "string") return null;
  const m = closes.trim().match(/^(\d+(?:\.\d+)?)\s*([hd])$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2].toLowerCase() === "d" ? n * 24 : n;
}

export function scoreBounty(b, { canComplete }) {
  let score = 0;
  const why = [];
  if (b.lane === "AutoGrade") {
    score += 30;
    why.push("AutoGrade +30");
  } else {
    score += 5;
    why.push("PosterJudge +5");
  }
  const usd = Number(b.usd) || 0;
  const usdPts = Math.min(20, Math.log10(usd + 1) * 5);
  score += usdPts;
  why.push(`usd~$${usd} +${usdPts.toFixed(1)}`);
  const hours = closesInHours(b.closes);
  if (hours !== null) {
    const urg = Math.max(0, 20 - hours / 12);
    score += urg;
    why.push(`closes in ${b.closes} +${urg.toFixed(1)}`);
  }
  const subs = Number(b.subs) || 0;
  const crowd = Math.min(15, subs / 20);
  score -= crowd;
  why.push(`${subs} subs -${crowd.toFixed(1)}`);
  if (canComplete) {
    score += 15;
    why.push("completable +15");
  }
  if (POLICY.blockedCategories.includes(b.cat)) {
    score -= 100;
    why.push("blocked category -100");
  }
  return { score: Math.round(score * 10) / 10, why: why.join("; ") };
}

/** Rank open bounties, best first. `canComplete` is a (bounty) => boolean. */
export function rankBounties(bounties, canComplete) {
  return bounties
    .filter((b) => b.status === "open")
    .map((b) => ({ bounty: b, ...scoreBounty(b, { canComplete: canComplete(b) }) }))
    .sort((a, b) => b.score - a.score);
}
