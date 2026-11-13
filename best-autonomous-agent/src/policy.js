// Safety policy — the rules this agent will not break, in any mode.
// Live mode still never spends money: entering is free, submitting a repo or
// a prediction is free, and nothing here stakes, buys, or posts a bounty.
export const POLICY = {
  // Dry-run is the default. --live is required for ANY write (enter/submit).
  dryRunDefault: true,
  // Never spend / stake / buy PROVE or any token, never post a bounty.
  neverSpend: true,
  // Max bounties attempted per run (enters + submit attempts).
  maxBountiesPerRun: 5,
  // Only these submission kinds are attempted. Everything else is skipped
  // with a reason in state.json.
  supportedSubmitKinds: ["repo", "prediction"],
  // Bounties whose deliverable IS an agent like this one: the entry is this
  // repo itself (repoUrl + commit + transcript). Any other repo bounty needs
  // a specialised builder (see builders.js) and is skipped until one exists.
  selfEntrySlugs: ["sample-agent-skillmd", "best-autonomous-agent"],
  // Trading bounties need capital at risk — never attempted.
  blockedCategories: ["trading"],
  // PosterJudge bounties need human-judged creative work (article / art /
  // meme / video / mascot) — entered only if explicitly allowed, never
  // auto-submitted.
  posterJudgeAutoSubmit: false,
  // Loop mode: pause between rounds (ms). A round is cheap; 10 min default
  // keeps us far below any sane rate limit.
  loopIntervalMs: 10 * 60 * 1000,
  // Delay between write calls so we never burst the API.
  writeDelayMs: 1500,
};

export function assertPolicy() {
  if (!POLICY.neverSpend) throw new Error("policy violation: neverSpend must stay true");
}
