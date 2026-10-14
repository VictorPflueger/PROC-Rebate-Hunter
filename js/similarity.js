// Name similarity, ported from Python's difflib.SequenceMatcher(None, a, b).ratio(), which the
// Streamlit version used. Similarity only ever makes a vendor pair a *candidate* for review: the
// subscription register is the only merge authority (names, cities and categories never merge).
// tests/engine.mjs checks the port against values printed by Python (Apex 66.7 %, Cisco/Meraki 23.1 %).

/** SequenceMatcher(None, a, b).ratio() for two strings, in [0, 1]. */
export function sequenceRatio(a, b) {
  const A = String(a ?? "");
  const B = String(b ?? "");
  const total = A.length + B.length;
  if (!total) return 1;
  return (2 * matchingCharacters(A, B)) / total;
}

/** Python's name_similarity(): case-insensitive ratio, as app.py computed it. */
export function nameSimilarity(a, b) {
  return sequenceRatio(String(a ?? "").toLowerCase(), String(b ?? "").toLowerCase());
}

function matchingCharacters(a, b) {
  // b2j: positions of each character in b. difflib drops "popular" characters only when b has at
  // least 200 elements (autojunk); vendor names never do, but the rule is kept for fidelity.
  const b2j = new Map();
  for (let j = 0; j < b.length; j++) {
    const c = b[j];
    if (!b2j.has(c)) b2j.set(c, []);
    b2j.get(c).push(j);
  }
  if (b.length >= 200) {
    const ntest = Math.floor(b.length / 100) + 1;
    for (const [c, idx] of [...b2j]) if (idx.length > ntest) b2j.delete(c);
  }

  const longest = (alo, ahi, blo, bhi) => {
    let besti = alo, bestj = blo, bestsize = 0;
    let j2len = new Map();
    for (let i = alo; i < ahi; i++) {
      const next = new Map();
      for (const j of b2j.get(a[i]) || []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) || 0) + 1;
        next.set(j, k);
        if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
      }
      j2len = next;
    }
    // With no junk function nothing is junk, so difflib's extension loops only add equal
    // neighbours that popularity pruning hid.
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) { besti--; bestj--; bestsize++; }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) bestsize++;
    return [besti, bestj, bestsize];
  };

  let matches = 0;
  const queue = [[0, a.length, 0, b.length]];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const [i, j, k] = longest(alo, ahi, blo, bhi);
    if (!k) continue;
    matches += k;
    if (alo < i && blo < j) queue.push([alo, i, blo, j]);
    if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
  }
  return matches;
}

/** Legal-form words that make different companies look alike; ignored by the name stem. */
const LEGAL_FORMS = /\b(gmbh|ag|se|s\.?a\.?s?|ltd\.?|limited|plc|inc\.?|llc|corp\.?|co\.?|unlimited|company|bv|nv|spa|srl)\b/gi;

/** Lower-case name without legal form and punctuation ("Apex Robotics Solutions GmbH" → "apex robotics solutions"). */
export function nameStem(name) {
  return String(name || "").toLowerCase().replace(LEGAL_FORMS, " ").replace(/[^a-z0-9äöüß ]+/g, " ").replace(/\s+/g, " ").trim();
}
