// Persistent state — what this agent has already entered / submitted /
// skipped, so a later round (or a restart) never duplicates work.
// File: state.json next to this repo. Secrets are never stored here.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export const STATE_PATH = new URL("../state.json", import.meta.url).pathname;

export function loadState() {
  if (!existsSync(STATE_PATH)) return { entered: {}, submitted: {}, skipped: {}, runs: 0 };
  try {
    const s = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    return { entered: s.entered || {}, submitted: s.submitted || {}, skipped: s.skipped || {}, runs: s.runs || 0 };
  } catch {
    return { entered: {}, submitted: {}, skipped: {}, runs: 0 };
  }
}

export function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

export function markEntered(state, slug, info) {
  state.entered[slug] = { at: new Date().toISOString(), ...info };
}

export function markSubmitted(state, slug, info) {
  state.submitted[slug] = { at: new Date().toISOString(), ...info };
}

export function markSkipped(state, slug, reason) {
  state.skipped[slug] = { at: new Date().toISOString(), reason };
}
