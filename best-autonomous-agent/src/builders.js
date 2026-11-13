// Entry builders — what this agent can actually complete on its own, and how.
// A builder never spends money and never invents data. When it cannot build a
// real entry it says so, with the reason, instead of submitting junk.
//
// Supported today:
//   1. Brier-score binary forecasts (e.g. btc-tomorrow): a neutral baseline
//      prediction — answer "yes" at confidence 0.5. That scores Brier 0.25
//      whatever the outcome. It is a legitimate entry, it claims no edge,
//      and it uses no market data. A researched forecaster can replace it.
//   2. Agent bounties whose deliverable is an agent like this one
//      (sample-agent-skillmd, best-autonomous-agent): the entry is this repo
//      itself — repoUrl + commit + the build transcript.
//
// Explicitly NOT built (skipped with a reason):
//   - numeric forecasts (SPY/GLD/NVDA close): need a market-data source;
//     none is configured. Extension point: buildNumericPrediction().
//   - trading bounties: need capital at risk — forbidden by policy.
//   - PosterJudge creative work (article / art / meme / video / mascot):
//     human-judged, not auto-built.
//   - other repo bounties (code-golf / primes / bug-hunt): need
//     task-specific code; no generic builder can do them honestly.
import { POLICY } from "./policy.js";

/** Cheap pre-check from the list row + detail: is there a builder at all? */
export function canComplete(bounty) {
  const kind = bounty.submitKind || bounty.submit_kind || null;
  if (kind === "prediction" && /brier/i.test(bounty.metric || "")) return true;
  if (kind === "repo" && POLICY.selfEntrySlugs.includes(bounty.slug)) return true;
  return false;
}

/** Why a bounty cannot be completed (for the log / state file). */
export function cannotReason(bounty) {
  const kind = bounty.submitKind || bounty.submit_kind || null;
  if (POLICY.blockedCategories.includes(bounty.cat)) return "policy: trading bounties need capital at risk";
  if (bounty.lane === "PosterJudge") return "PosterJudge creative work is not auto-built";
  if (kind === "prediction") return "numeric forecast needs a market-data source; none configured";
  if (kind === "repo") return "no specialised builder for this repo bounty";
  return `unsupported submitKind: ${kind ?? "(unknown)"}`;
}

/**
 * Build a submission payload for a bounty detail object.
 * ctx: { repoUrl, commit, transcript, handle }
 * Returns { supported, kind?, payload?, note?, reason? }.
 */
export function buildEntry(bounty, ctx = {}) {
  const kind = bounty.submitKind || bounty.submit_kind || null;

  if (kind === "prediction" && /brier/i.test(bounty.metric || "")) {
    return {
      supported: true,
      kind: "prediction",
      payload: {
        prediction: { answer: "yes", confidence: 0.5 },
        ...(ctx.handle ? { handle: ctx.handle } : {}),
      },
      note: "baseline: neutral 0.5 probability (Brier 0.25 either way). No edge claimed, no market data used — a researched forecaster can replace this builder.",
    };
  }

  if (kind === "repo" && POLICY.selfEntrySlugs.includes(bounty.slug)) {
    if (!ctx.repoUrl || !ctx.commit) {
      return {
        supported: false,
        // Entering is still correct: the block is temporary (the public repo
        // does not exist yet), not a lack of a builder. The loop enters and
        // records the submission as pending instead of skipping.
        enterAnyway: true,
        reason: "repo entry needs a PUBLIC repoUrl + commit — pass --repo-url and --commit (create the public repo first; never submit a placeholder URL)",
      };
    }
    return {
      supported: true,
      kind: "repo",
      payload: {
        repoUrl: ctx.repoUrl,
        commit: ctx.commit,
        transcript: ctx.transcript || "",
        ...(ctx.handle ? { handle: ctx.handle } : {}),
      },
      note: "self entry: this repo is the deliverable; transcript is this run's redacted session log.",
    };
  }

  return { supported: false, reason: cannotReason(bounty) };
}
