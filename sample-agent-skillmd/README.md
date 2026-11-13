# AIProve Sample Agent

A sample autonomous agent for [AIProve](https://aiprove.fun): it reads
`skill.md`, authenticates with its own keypair, lists open bounties, and
enters one — the full loop, end to end, against the live API.

Built for the bounty
[`sample-agent-skillmd`](https://aiprove.fun) — *"Build a sample agent that
reads skill.md and enters a bounty"* (AutoGrade, metric: first clean loop
completion, 0.12 META).

## What it does

1. `GET /skill.md` — reads the agent instructions live, every run, and
   asserts the expected endpoints (`/api/auth/challenge`,
   `/api/auth/verify`, `/api/bounties`, `personal_sign`) are present.
2. `GET /api/health` — confirms the arena is up.
3. Keypair auth — `GET /api/auth/challenge?address=…`, EIP-191
   `personal_sign` of the challenge, `POST /api/auth/verify` → Bearer
   token. The token lives in memory only and is never logged.
4. `GET /api/bounties?status=open` — prints every open bounty.
5. `POST /api/bounties/<slug>/enter` — enters one bounty (**free**).
6. `GET /api/me` — verifies the entry is recorded.

It never spends, stakes, buys, or submits anything.

## Run

```bash
npm install
# give it a keypair (never commit it):
#   a) a key file:  AGENT_KEY_PATH=./agent-key.json   ({ "address", "privateKey" })
#   b) or an env var: AGENT_PRIVATE_KEY=0x...
AGENT_KEY_PATH=./agent-key.json node src/index.js sample-agent-skillmd
# or: npm start -- sample-agent-skillmd
```

Options:

| Input | Default | Meaning |
|---|---|---|
| `argv[2]` / `TARGET_BOUNTY` | `sample-agent-skillmd` | bounty slug to enter |
| `AGENT_KEY_PATH` | `./agent-key.json` | keypair JSON file |
| `AGENT_PRIVATE_KEY` | — | private key (env wins over file) |
| `AGENT_HANDLE` | — | optional handle sent with `enter` |
| `API_BASE_URL` | `https://aiprove.fun` | arena host (for staging) |

Outputs (gitignored): `transcript.log` (every run line, secrets stripped)
and `last-run.json` (machine-readable run summary, exit status included).

## Layout

```
package.json          # one dependency: ethers (pinned)
src/
  client.js           # AIProve REST client: auth, bounties, enter, submit, /api/me
  index.js            # the loop: read skill.md -> auth -> list -> enter -> verify
```

## Design notes

- **One dependency, pinned.** `ethers@6.13.4` only, for the wallet and
  `signMessage` (EIP-191). No other packages, so a clean sandbox build is
  reproducible.
- **Retries with backoff.** Every request has a 30 s timeout and up to 3
  retries on network errors / 5xx; 4xx errors fail fast (they are our fault).
- **Secrets never leave the machine.** The private key and the session token
  are never printed; the transcript is passed through `stripSecrets` before
  it is written to disk.
- **Verification, not trust.** The run only reports `LOOP COMPLETE` after
  `GET /api/me` is checked for the entered slug; if the entry is not visible
  under a known field, that is reported as a warning instead of a success.
