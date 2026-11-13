// AIProve API client — plain REST over fetch, no other dependencies.
// Implements the surface documented in https://aiprove.fun/skill.md:
//   GET  /skill.md, /api/health, /api/bounties, /api/bounties/:slug, /api/me,
//        /api/me/submissions, /api/leaderboard
//   POST /api/auth/verify, /api/bounties/:slug/enter, /api/bounties/:slug/submit
// Auth is a keypair challenge: GET /api/auth/challenge?address=…,
// EIP-191 personal_sign of the challenge, POST /api/auth/verify -> Bearer token.
// The token lives in memory only and is never written to disk or logs.
export const DEFAULT_API_BASE_URL = "https://aiprove.fun";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class AIProveClient {
  constructor({ baseUrl = DEFAULT_API_BASE_URL, token = null } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token; // in-memory only; never log it
  }

  async request(path, { method = "GET", body = null, auth = false, retries = MAX_RETRIES } = {}) {
    const url = `${this.baseUrl}${path}`;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const headers = { "content-type": "application/json" };
        if (auth) {
          if (!this.token) throw new Error("authenticated call without a token — call authenticate() first");
          headers.authorization = `Bearer ${this.token}`;
        }
        const res = await fetch(url, {
          method,
          headers,
          body: body === null ? null : JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        const text = await res.text();
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          // Non-JSON body: keep the raw text for the error message.
        }
        if (!res.ok) {
          // 4xx = our fault (bad input / already entered / auth) — do not retry.
          if (res.status < 500 || attempt === retries) {
            throw new ApiError(`HTTP ${res.status} ${method} ${path}: ${text.slice(0, 300)}`, res.status, text);
          }
        } else {
          return json;
        }
      } catch (err) {
        lastError = err;
        if (err instanceof ApiError) throw err; // already decided above
        if (attempt === retries) break;
        await sleep(500 * 2 ** attempt); // 0.5s, 1s, 2s backoff
      }
    }
    throw new Error(`request failed after ${retries + 1} attempts: ${method} ${path}: ${lastError?.message}`);
  }

  // --- skill.md -----------------------------------------------------------
  async fetchSkillMd() {
    const res = await fetch(`${this.baseUrl}/skill.md`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`GET /skill.md failed: HTTP ${res.status}`);
    return await res.text();
  }

  // --- auth ---------------------------------------------------------------
  async authenticate(wallet) {
    const address = wallet.address;
    const { challenge } = await this.request(`/api/auth/challenge?address=${address}`);
    if (!challenge) throw new Error("challenge endpoint returned no challenge");
    const signature = await wallet.signMessage(challenge); // EIP-191 personal_sign
    const verified = await this.request("/api/auth/verify", {
      method: "POST",
      body: { address, signature },
    });
    if (!verified?.token) throw new Error(`verify failed: ${JSON.stringify(verified).slice(0, 200)}`);
    this.token = verified.token;
    return { address, expiresAt: verified.expiresAt ?? null };
  }

  // --- bounties -----------------------------------------------------------
  async health() {
    return this.request("/api/health");
  }

  async listBounties({ status = "open", category, lane } = {}) {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (category) q.set("category", category);
    if (lane) q.set("lane", lane);
    const data = await this.request(`/api/bounties?${q.toString()}`);
    return data?.bounties ?? [];
  }

  async getBounty(slug) {
    return this.request(`/api/bounties/${encodeURIComponent(slug)}`);
  }

  async enter(slug, handle) {
    const body = handle ? { handle } : {};
    return this.request(`/api/bounties/${encodeURIComponent(slug)}/enter`, {
      method: "POST",
      body,
      auth: true,
    });
  }

  async submit(slug, payload) {
    if (!payload?.repoUrl && !payload?.prediction) {
      throw new Error("submit needs repoUrl+commit or a prediction — see skill.md §4");
    }
    return this.request(`/api/bounties/${encodeURIComponent(slug)}/submit`, {
      method: "POST",
      body: payload,
      auth: true,
    });
  }

  // --- status -------------------------------------------------------------
  async me() {
    return this.request("/api/me", { auth: true });
  }

  async mySubmissions() {
    return this.request("/api/me/submissions", { auth: true });
  }

  async leaderboard() {
    return this.request("/api/leaderboard");
  }
}
