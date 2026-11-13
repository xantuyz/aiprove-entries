// Fully-autonomous AIProve agent — no human in the loop.
//   read skill.md -> keypair auth -> rank the open arena -> enter the
//   bounties it attempts -> build + submit the entries it has builders for
//   -> record everything in state.json + transcript.log.
//
// Usage:
//   node src/index.js --once [--live] [--max-bounties N] [--only slug]
//                     [--repo-url URL --commit SHA] [--interval-mins N]
//   node src/index.js --loop --live --interval-mins 60
//
// DRY-RUN IS THE DEFAULT: without --live the agent only reads and plans —
// it makes no enter/submit calls at all. With --live it enters (free) the
// bounties it attempts and submits only entries a builder produced.
// It never spends, stakes, buys, or posts bounties (see policy.js).
// Keypair: AGENT_KEY_PATH (./agent-key.json) or AGENT_PRIVATE_KEY.
// The private key and the session token are never printed or stored.
import { readFileSync, writeFileSync } from "node:fs";
import { Wallet } from "ethers";
import { AIProveClient, DEFAULT_API_BASE_URL } from "./client.js";
import { POLICY, assertPolicy } from "./policy.js";
import { rankBounties } from "./scoring.js";
import { canComplete, buildEntry } from "./builders.js";
import { loadState, saveState, markEntered, markSubmitted, markSkipped } from "./state.js";

const API_BASE_URL = process.env.API_BASE_URL || DEFAULT_API_BASE_URL;
const TRANSCRIPT_PATH = new URL("../transcript.log", import.meta.url).pathname;
const LAST_RUN_PATH = new URL("../last-run.json", import.meta.url).pathname;

const transcriptLines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  transcriptLines.push(line);
  console.log(line);
}

export function stripSecrets(text, secrets) {
  let out = String(text);
  for (const s of secrets) {
    if (s && typeof s === "string" && s.length > 8) out = out.split(s).join("[REDACTED]");
  }
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]");
  out = out.replace(/0x[0-9a-fA-F]{64}/g, "0x[REDACTED]");
  return out;
}

function parseArgs(argv) {
  const o = {
    live: false,
    loop: false,
    once: true,
    intervalMins: 10,
    maxBounties: POLICY.maxBountiesPerRun,
    only: null,
    repoUrl: process.env.REPO_URL || null,
    commit: process.env.COMMIT || null,
    handle: process.env.AGENT_HANDLE || null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--live") o.live = true;
    else if (a === "--dry-run") o.live = false;
    else if (a === "--loop") { o.loop = true; o.once = false; }
    else if (a === "--once") { o.once = true; o.loop = false; }
    else if (a === "--max-bounties") o.maxBounties = Math.max(1, parseInt(argv[++i], 10) || POLICY.maxBountiesPerRun);
    else if (a === "--only") o.only = argv[++i];
    else if (a === "--repo-url") o.repoUrl = argv[++i];
    else if (a === "--commit") o.commit = argv[++i];
    else if (a === "--interval-mins") o.intervalMins = Math.max(1, parseInt(argv[++i], 10) || 10);
    else if (a === "--handle") o.handle = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log("usage: node src/index.js --once [--live] [--max-bounties N] [--only slug] [--repo-url URL --commit SHA] | --loop [--interval-mins N]");
      process.exit(0);
    }
  }
  return o;
}

function loadWallet() {
  if (process.env.AGENT_PRIVATE_KEY) return new Wallet(process.env.AGENT_PRIVATE_KEY.trim());
  const keyPath = process.env.AGENT_KEY_PATH || "./agent-key.json";
  const raw = JSON.parse(readFileSync(keyPath, "utf8"));
  const pk = raw.privateKey || raw.private_key || raw.key;
  if (!pk) throw new Error(`no private key found in ${keyPath}`);
  const wallet = new Wallet(pk);
  if (raw.address && wallet.address.toLowerCase() !== raw.address.toLowerCase()) {
    throw new Error("key file address does not match the derived address — refusing to run");
  }
  return wallet;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runRound(opts, client, wallet, state, secrets) {
  const round = { startedAt: new Date().toISOString(), mode: opts.live ? "live" : "dry-run", attempted: [], skipped: [], entered: [], submitted: [], blocked: [] };

  // 1. skill.md + health + auth (fresh token every round — cheap and safe).
  log("round: reading skill.md");
  const skill = await client.fetchSkillMd();
  for (const marker of ["/api/auth/challenge", "/api/auth/verify", "/api/bounties", "personal_sign"]) {
    if (!skill.includes(marker)) throw new Error(`skill.md missing marker: ${marker}`);
  }
  const health = await client.health();
  if (!health?.ok) throw new Error(`health check failed: ${JSON.stringify(health)}`);
  const auth = await client.authenticate(wallet);
  log(`authenticated as ${wallet.address}; session expires ${auth.expiresAt ? new Date(auth.expiresAt).toISOString() : "(not stated)"}`);

  // 2. Rank the open arena.
  const open = await client.listBounties({ status: "open" });
  log(`open bounties: ${open.length}`);
  // List rows carry no submitKind; infer it from the category for ranking
  // (forecast -> prediction, development -> repo). The detail fetch in step 3
  // replaces the guess with the real submitKind before any build decision.
  const inferKind = (b) => (b.cat === "forecast" ? "prediction" : b.cat === "development" ? "repo" : null);
  let ranked = rankBounties(open, (b) => canComplete({ ...b, submitKind: inferKind(b) }));
  if (opts.only) ranked = ranked.filter((r) => r.bounty.slug === opts.only);
  ranked = ranked.slice(0, opts.maxBounties);
  for (const r of ranked) log(`  rank ${r.score}: ${r.bounty.slug} (${r.bounty.lane}, ${r.bounty.metric}) — ${r.why}`);

  // 3. Attempt each candidate: detail -> build -> (live) enter + submit.
  for (const { bounty: row } of ranked) {
    const slug = row.slug;
    if (state.submitted[slug]) {
      log(`skip ${slug}: already submitted (state.json)`);
      round.skipped.push({ slug, reason: "already submitted" });
      continue;
    }
    const detail = await client.getBounty(slug);
    const bounty = { ...row, ...(detail?.bounty ?? {}), submitKind: detail?.submitKind ?? row.submitKind };
    const built = buildEntry(bounty, {
      repoUrl: opts.repoUrl,
      commit: opts.commit,
      transcript: "", // filled below for repo entries, from this run's log
      handle: opts.handle,
    });
    if (!built.supported) {
      if (built.enterAnyway) {
        // Blocked only by a missing input (public repo) — enter now (free),
        // submit later once the repo exists. Never skip these as "unsupported".
        log(`deferred ${slug}: ${built.reason}`);
        if (!opts.live) {
          log(`  [dry-run] would enter ${slug}; submit pending public repoUrl+commit`);
          round.blocked.push({ slug, reason: built.reason });
        } else {
          if (!state.entered[slug]) {
            const entered = await client.enter(slug, opts.handle || undefined);
            markEntered(state, slug, { entry: entered, submissionPending: built.reason });
            delete state.skipped[slug];
            round.entered.push(slug);
            log(`  entered ${slug} (submission pending: public repoUrl+commit)`);
            await sleep(POLICY.writeDelayMs);
          } else {
            log(`  already entered ${slug} (state.json); submission still pending`);
          }
          round.blocked.push({ slug, reason: built.reason });
        }
        continue;
      }
      log(`skip ${slug}: ${built.reason}`);
      markSkipped(state, slug, built.reason);
      round.skipped.push({ slug, reason: built.reason });
      continue;
    }
    round.attempted.push({ slug, kind: built.kind, note: built.note });
    log(`attempt ${slug} (${built.kind}): ${built.note}`);

    if (!opts.live) {
      log(`  [dry-run] would enter + submit ${slug}; no write calls made`);
      round.blocked.push({ slug, reason: "dry-run: submit needs --live" });
      continue;
    }

    // Live: enter first (free), then submit the built entry.
    if (!state.entered[slug]) {
      const entered = await client.enter(slug, opts.handle || undefined);
      markEntered(state, slug, { entry: entered });
      round.entered.push(slug);
      log(`  entered ${slug}`);
      await sleep(POLICY.writeDelayMs);
    } else {
      log(`  already entered ${slug} (state.json)`);
    }
    const payload = { ...built.payload };
    if (built.kind === "repo") {
      payload.transcript = stripSecrets(transcriptLines.join("\n"), secrets);
    }
    const submitted = await client.submit(slug, payload);
    markSubmitted(state, slug, { submission: submitted });
    delete state.skipped[slug];
    round.submitted.push(slug);
    log(`  submitted ${slug}: ${JSON.stringify(submitted).slice(0, 300)}`);
    await sleep(POLICY.writeDelayMs);
  }

  // 4. End-of-round status.
  const me = await client.me();
  round.meKeys = Object.keys(me);
  round.finishedAt = new Date().toISOString();
  log(`round done: attempted ${round.attempted.length}, entered ${round.entered.length}, submitted ${round.submitted.length}, skipped ${round.skipped.length}`);
  return round;
}

async function main() {
  assertPolicy();
  const opts = parseArgs(process.argv.slice(2));
  const secrets = [];
  if (process.env.AGENT_PRIVATE_KEY) secrets.push(process.env.AGENT_PRIVATE_KEY.trim());
  const state = loadState();
  const wallet = loadWallet();
  const client = new AIProveClient({ baseUrl: API_BASE_URL });
  log(`aiprove-autonomous-agent v1.0.0 | mode=${opts.live ? "LIVE" : "DRY-RUN"} | address=${wallet.address} | maxBounties=${opts.maxBounties}${opts.only ? ` | only=${opts.only}` : ""}`);
  if (!opts.live) log("dry-run: no enter/submit calls will be made (pass --live to write)");

  const rounds = [];
  let roundNo = 0;
  try {
    do {
      roundNo += 1;
      state.runs += 1;
      log(`--- round ${roundNo} ---`);
      const round = await runRound(opts, client, wallet, state, secrets);
      rounds.push(round);
      saveState(state);
      if (opts.loop) {
        log(`sleeping ${opts.intervalMins} min until next round (Ctrl+C to stop)`);
        await sleep(opts.intervalMins * 60 * 1000);
      }
    } while (opts.loop);
  } catch (err) {
    log(`FAILED: ${err.message}`);
    writeOutputs({ status: "FAILED", error: err.message, rounds }, secrets);
    process.exitCode = 1;
    return;
  }
  writeOutputs({ status: "OK", mode: opts.live ? "live" : "dry-run", rounds }, secrets);
  log("DONE");
}

function writeOutputs(summary, secrets) {
  writeFileSync(TRANSCRIPT_PATH, stripSecrets(transcriptLines.join("\n"), secrets) + "\n", "utf8");
  writeFileSync(LAST_RUN_PATH, JSON.stringify({ ...summary, finishedAt: new Date().toISOString() }, null, 2) + "\n", "utf8");
}

main();
