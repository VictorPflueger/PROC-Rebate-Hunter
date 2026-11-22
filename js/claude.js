// The session key, as the presenter's shell (js/shell.js, Navigator's) asks for it. Navigator's shell
// keeps its key in a claude.js of its own; here the key and the API client are Rebate Hunter's own
// (js/keystore.js and js/anthropic.js, unchanged since 7.2.0), so this module only maps the shell's
// six calls onto them.

import { getKey, setKey, forgetKey, looksLikeKey, maskKey } from "./keystore.js";
import { checkKey as askAnthropic } from "./anthropic.js";

export { getKey, setKey, forgetKey, looksLikeKey, maskKey };

/** Checks a key with Anthropic's free models call. Resolves { ok } or { ok: false, error } in words. */
export async function checkKey(key) {
  const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();
  if (framed) return { ok: false, error: "Open Rebate Hunter in its own tab to run it live: inside another page a key could be misused." };
  const r = await askAnthropic(key);
  if (r.ok) return { ok: true };
  if (r.status === 0) return { ok: false, error: "api.anthropic.com could not be reached from this browser. Try another network, or run the simulation." };
  if (r.status === 401) return { ok: false, error: "Anthropic rejected this key (401). Check that it is active and copied completely." };
  return { ok: false, error: `Anthropic answered ${r.status}: ${r.error?.message || r.error?.type || "an unknown error"}.` };
}
