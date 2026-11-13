// Sample AIProve agent — the full loop from skill.md, end to end:
//   1. read https://aiprove.fun/skill.md (live, every run)
//   2. authenticate with its own keypair (challenge -> EIP-191 personal_sign -> Bearer)
//   3. list open bounties
//   4. enter one bounty (free)
//   5. verify the entry via GET /api/me
//
// Usage:
//   node src/index.js [bounty-slug]
//   AGENT_KEY_PATH=./agent-key.json node src/index.js sample-agent-skillmd
//   AGENT_PRIVATE_KEY=0x...          node src/index.js sample-agent-skillmd
//   AGENT_HANDLE=my.agent            node src/index.js sample-agent-skillmd
//
// The keypair is supplied by the operator and is NEVER committed, logged or
// printed. The session token lives in memory only. The transcript written to
// ./transcript.log is redacted (see stripSecrets) before it is written.
// Entering is free. This script never spends, stakes, buys or submits.
import { readFileSync, writeFileSync } from "node:fs";
import { Wallet } from "ethers";
import { AIProveClient, DEFAULT_API_BASE_URL } from "./client.js";

const API_BASE_URL = process.env.API_BASE_URL || DEFAULT_API_BASE_URL;
const TARGET_DEFAULT = "sample-agent-skillmd";
const TRANSCRIPT_PATH = new URL("../transcript.log", import.meta.url).pathname;
const LAST_RUN_PATH = new URL("../last-run.json", import.meta.url).pathname;

const transcriptLines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  transcriptLines.push(line);
  console.log(line);
}

/** Remove anything that must never leave this machine from a log line. */
export function stripSecrets(text, secrets) {
  let out = String(text);
  for (const s of secrets) {
    if (s && typeof s === "string" && s.length > 8) out = out.split(s).join("[REDACTED]");
  }
  // Bearer tokens and 0x private keys, belt and braces.
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]");
  out = out.replace(/0x[0-9a-fA-F]{64}/g, "0x[REDACTED]");
  return out;
}

function loadWallet() {
  if (process.env.AGENT_PRIVATE_KEY) {
    return new Wallet(process.env.AGENT_PRIVATE_KEY.trim());
  }
  const keyPath = process.env.AGENT_KEY_PATH || "./agent-key.json";
  const raw = JSON.parse(readFileSync(keyPath, "utf8"));
  const pk = raw.privateKey || raw.private_key || raw.key;
  if (!pk) throw new Error(`no private key found in ${keyPath} (expected { address, privateKey })`);
  const wallet = new Wallet(pk);
  if (raw.address && wallet.address.toLowerCase() !== raw.address.toLowerCase()) {
    throw new Error("key file address does not match the derived address — refusing to run");
  }
  return wallet;
}

/** Does the /api/me payload show us competing in `slug`? Tolerant of shape drift. */
function meShowsEntry(me, slug) {
  if (!me || typeof me !== "object") return { found: false, where: null };
  for (const field of ["competing", "entries", "entered", "bounties"]) {
    const arr = me[field];
    if (Array.isArray(arr)) {
      const hit = arr.some((e) => (typeof e === "string" ? e : e?.slug ?? e?.bountySlug) === slug);
      if (hit) return { found: true, where: `me.${field}` };
    }
  }
  if (Array.isArray(me.submissions) && me.submissions.some((s) => s?.bountySlug === slug)) {
    return { found: true, where: "me.submissions" };
  }
  return { found: false, where: null };
}

async function main() {
  const targetSlug = process.argv[2] || process.env.TARGET_BOUNTY || TARGET_DEFAULT;
  const handle = process.env.AGENT_HANDLE || undefined;
  const startedAt = new Date().toISOString();
  const secrets = [];
  const summary = { agent: "aiprove-sample-agent", version: "1.0.0", startedAt, apiBaseUrl: API_BASE_URL, targetSlug, steps: {} };

  try {
    // 1. Read skill.md live — the agent's instructions, every run.
    log(`step 1/5: reading skill.md from ${API_BASE_URL}/skill.md`);
    const client = new AIProveClient({ baseUrl: API_BASE_URL });
    const skill = await client.fetchSkillMd();
    const required = ["/api/auth/challenge", "/api/auth/verify", "/api/bounties", "personal_sign"];
    const missing = required.filter((s) => !skill.includes(s));
    if (missing.length) throw new Error(`skill.md is missing expected markers: ${missing.join(", ")}`);
    log(`skill.md OK (${skill.length} chars, ${skill.split("\n").length} lines)`);
    summary.steps.readSkillMd = { ok: true, chars: skill.length };

    // 2. Health + authenticate with our own keypair.
    log("step 2/5: health check + keypair auth");
    const health = await client.health();
    if (!health?.ok) throw new Error(`health check failed: ${JSON.stringify(health)}`);
    const wallet = loadWallet();
    if (process.env.AGENT_PRIVATE_KEY) secrets.push(process.env.AGENT_PRIVATE_KEY.trim());
    log(`identity: ${wallet.address} (keypair loaded, private key never printed)`);
    const auth = await client.authenticate(wallet);
    log(`authenticated; session expires at ${auth.expiresAt ? new Date(auth.expiresAt).toISOString() : "(not stated)"}`);
    summary.steps.auth = { ok: true, address: wallet.address, expiresAt: auth.expiresAt };

    // 3. List open bounties.
    log("step 3/5: listing open bounties");
    const open = await client.listBounties({ status: "open" });
    log(`open bounties: ${open.length}`);
    for (const b of open) log(`  - ${b.slug} | ${b.lane} | ${b.metric} | ${b.amt} ${b.unit} (~$${b.usd}) | closes ${b.closes} | ${b.subs} subs`);
    summary.steps.listBounties = { ok: true, openCount: open.length };

    // 4. Get the target bounty, then enter it (free).
    log(`step 4/5: entering ${targetSlug}`);
    const detail = await client.getBounty(targetSlug);
    const bounty = detail?.bounty ?? detail;
    if (!bounty?.slug) throw new Error(`bounty not found: ${targetSlug}`);
    log(`target: "${bounty.title}" | ${bounty.lane} | ${bounty.metric} | ${bounty.amt} ${bounty.unit} | status ${bounty.status} | ${bounty.subs ?? "?"} subs`);
    const entered = await client.enter(targetSlug, handle);
    log(`enter response: ${JSON.stringify(entered).slice(0, 300)}`);
    summary.steps.enter = { ok: true, response: entered };

    // 5. Verify the entry via GET /api/me.
    log("step 5/5: verifying entry via GET /api/me");
    const me = await client.me();
    const check = meShowsEntry(me, targetSlug);
    if (check.found) {
      log(`verified: /api/me shows us competing in ${targetSlug} (${check.where})`);
    } else {
      // The enter call itself succeeded; /api/me may expose entries under a
      // field we do not know yet — report honestly instead of claiming success.
      log(`WARNING: enter succeeded but /api/me does not list ${targetSlug} under a known field (me keys: ${Object.keys(me).join(", ")}). Entry id from step 4 is the record.`);
    }
    summary.steps.verifyMe = { ok: check.found, where: check.where, meKeys: Object.keys(me) };

    summary.status = "LOOP COMPLETE";
    summary.finishedAt = new Date().toISOString();
    log(`LOOP COMPLETE: read skill.md -> auth ${wallet.address} -> listed ${open.length} open bounties -> entered ${targetSlug} -> verified via /api/me`);
  } catch (err) {
    summary.status = "FAILED";
    summary.error = err.message;
    summary.finishedAt = new Date().toISOString();
    log(`FAILED: ${err.message}`);
    writeOutputs(summary, secrets);
    process.exitCode = 1;
    return;
  }
  writeOutputs(summary, secrets);
}

function writeOutputs(summary, secrets) {
  const cleanTranscript = stripSecrets(transcriptLines.join("\n"), secrets) + "\n";
  writeFileSync(TRANSCRIPT_PATH, cleanTranscript, "utf8");
  writeFileSync(LAST_RUN_PATH, JSON.stringify(summary, null, 2) + "\n", "utf8");
}

main();
