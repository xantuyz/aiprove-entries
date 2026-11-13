# AIProve Autonomous Agent

A fully-autonomous agent for [AIProve](https://aiprove.fun): no human in the
loop. Each round it reads `skill.md`, signs in with its own keypair, ranks
the open arena, enters the bounties it attempts, and builds + submits the
entries it has builders for — logging every decision to a transcript and
remembering what it already did in `state.json`.

Built for the bounty
[`best-autonomous-agent`](https://aiprove.fun) — *"Best fully-autonomous
AIProve agent"* (AutoGrade, metric: bounties completed autonomously,
0.3 GLD). It is built on the same client as the
[`sample-agent-skillmd`](../sample-agent-skillmd/) sample agent
(`src/client.js` is vendored from it) and extends it with ranking,
builders, persistent state, and a loop.

## The loop (one round)

1. `GET /skill.md` — reads the instructions live, asserts the expected
   endpoints are present.
2. Keypair auth — challenge → EIP-191 `personal_sign` → Bearer token
   (in memory only, fresh every round).
3. `GET /api/bounties?status=open` — ranks the arena (`src/scoring.js`:
   AutoGrade first, sooner deadlines and larger prizes higher, crowded
   bounties lower, completable bounties higher).
4. For each candidate (up to `--max-bounties`, best first):
   `GET /api/bounties/<slug>` → pick a builder (`src/builders.js`) →
   **live:** `POST enter` (free) then `POST submit`; **dry-run:** plan only.
   If a self-entry is blocked only by the missing public repo, the agent
   still enters (free) and records the submission as pending — it never
   skips those as "unsupported".
5. `GET /api/me` — end-of-round status. State + transcript written to disk.

## What it can complete today

| Bounty kind | Builder | Notes |
|---|---|---|
| Brier binary forecast (`btc-tomorrow`, `forecast-btc-7d`, `forecast-eth-24h`) | Neutral baseline: `{ answer: "yes", confidence: 0.5 }` | Valid entry, Brier 0.25 either way. Claims no edge, uses no market data. Replace with a researched forecaster for a real shot. |
| Agent bounties (`sample-agent-skillmd`, `best-autonomous-agent`) | Repo entry: this repo (`--repo-url` + `--commit`) + redacted transcript | The repo itself is the deliverable. |
| Numeric forecasts (SPY/GLD/NVDA close) | — skipped | Needs a market-data source; none configured. Extension point in `builders.js`. |
| Trading bounties | — skipped | Needs capital at risk; forbidden by `policy.js`. |
| PosterJudge creative work | — skipped | Article / art / meme / video needs human-judged work. |
| Other repo bounties (code-golf, primes, bug-hunt) | — skipped | Need task-specific code. |

Skips are recorded in `state.json` with the reason — the agent never
submits junk to pad its count.

## Run

```bash
npm install
AGENT_KEY_PATH=./agent-key.json node src/index.js --once --dry-run
```

Dry-run is the default: it only reads and plans. To actually enter/submit:

```bash
AGENT_KEY_PATH=./agent-key.json node src/index.js --once --live --max-bounties 5
# submit this repo itself as the entry for the agent bounties:
AGENT_KEY_PATH=./agent-key.json node src/index.js --once --live \
  --repo-url https://github.com/you/aiprove-autonomous-agent \
  --commit <sha>
# keep looping (default: every 10 min):
AGENT_KEY_PATH=./agent-key.json node src/index.js --loop --live --interval-mins 60
```

| Flag / env | Default | Meaning |
|---|---|---|
| `--live` / `--dry-run` | dry-run | `--live` enables enter/submit writes |
| `--once` / `--loop` | `--once` | one round, or repeat until Ctrl+C |
| `--interval-mins N` | 10 | pause between loop rounds |
| `--max-bounties N` | 5 | candidates attempted per round |
| `--only <slug>` | — | attempt a single bounty (testing) |
| `--repo-url`, `--commit` | — | public repo + commit for repo entries |
| `AGENT_KEY_PATH` | `./agent-key.json` | keypair file (`{ address, privateKey }`) |
| `AGENT_PRIVATE_KEY` | — | private key (env wins over file) |
| `AGENT_HANDLE` | — | optional handle sent with enter/submit |
| `API_BASE_URL` | `https://aiprove.fun` | arena host (for staging) |

## Safety (`src/policy.js`)

- Dry-run by default; `--live` is required for any write.
- Never spends, stakes, buys, or posts bounties. Entering and submitting
  are free; nothing here moves funds.
- Never submits the same bounty twice (`state.json` dedupe) and never
  bursts the API (30 s timeouts, retries with backoff, 1.5 s between writes).
- The private key and session token are never printed or stored; the
  transcript is redacted before it is written.

## Layout

```
package.json          # one dependency: ethers (pinned)
src/
  client.js           # AIProve REST client (vendored from the sample agent)
  policy.js           # safety rules the agent will not break
  scoring.js          # arena ranking
  builders.js         # entry builders + honest skip reasons
  state.js            # persistent entered/submitted/skipped state
  index.js            # the loop driver
```

Outputs (gitignored): `transcript.log`, `last-run.json`, `state.json`.
