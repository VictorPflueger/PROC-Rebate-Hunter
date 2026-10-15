// Figure audit: every money amount the agent writes into a draft, the management summary, an option
// card or an alert must be one that a tool returned in this run (the rebate engine, the ERP or an
// open-data source), in the same currency. The option cards and KPI tiles take their figures from
// the engine directly; this check covers the free text, so "every euro figure comes from a tool
// result" is enforced in code, not only asked for.
//
// Amounts are read in the formats people write them: "€1,048,000", "€1.05M", "1.048.000,00 EUR",
// "1 048 000 €", "1'048'000 CHF", "€1,05 Mio.", "1.084 T€", "£4.6m", and "Amount: 1,048,000.00" in
// a posting. An ambiguous number ("€1.084") is read both ways and must match in one of them.
//
// A written amount matches a known figure within the precision it is written with, but never by
// more than 2 %: "€1.05M" stands for €1,045,000 to €1,055,000; "€1M" does not stand for €1,048,000.

const SP = "[ \\u00a0\\u202f\\u2009]";
// Grouped numbers first (thousands separated by comma, dot, apostrophe or a space), then plain ones.
const NUM = `\\d{1,3}(?:(?:,|\\.|'|’|${SP})\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?`;
const SCALE_RE = "k|K|thousand|Tsd\\.?|m|M|mn|Mn|Mio\\.?|million|millions|Million|Millionen|bn|b|B|Mrd\\.?|billion|billions|Milliarde|Milliarden";
const NOT_WORD = "(?![A-Za-z])";
const CUR_PRE = "€|£|US\\$|\\$|\\b(?:EUR|GBP|USD|CHF)\\b";
const CUR_SUF = `T€|TEUR\\b|k€|€|EUR\\b|GBP\\b|USD\\b|CHF\\b|[Ee]uros?\\b|pounds?\\b|[Dd]ollars?\\b`;

const PREFIX = new RegExp(`(${CUR_PRE})${SP}?(${NUM})(?:${SP}?(${SCALE_RE})${NOT_WORD})?`, "g");
const SUFFIX = new RegExp(`(?<![\\d.,'’])(${NUM})(?:${SP}?(${SCALE_RE})${NOT_WORD})?${SP}?(${CUR_SUF})`, "g");
const LABELLED = new RegExp(`\\b(?:Amount|Betrag|Total|Sum|Summe|Credit|Debit|Gutschrift)\\b[^\\n\\d€£$]{0,24}?(?<![\\d.,'’])(${NUM})(?![\\d.,]*${SP}?(?:%|days?\\b))`, "g");

const SCALE = {
  k: 1e3, thousand: 1e3, tsd: 1e3, "tsd.": 1e3,
  m: 1e6, mn: 1e6, mio: 1e6, "mio.": 1e6, million: 1e6, millions: 1e6, millionen: 1e6,
  bn: 1e9, b: 1e9, mrd: 1e9, "mrd.": 1e9, billion: 1e9, billions: 1e9, milliarde: 1e9, milliarden: 1e9
};
const CURRENCY = {
  "€": "EUR", eur: "EUR", euro: "EUR", euros: "EUR", "t€": "EUR", teur: "EUR", "k€": "EUR",
  "£": "GBP", gbp: "GBP", pound: "GBP", pounds: "GBP",
  "$": "USD", "us$": "USD", usd: "USD", dollar: "USD", dollars: "USD",
  chf: "CHF"
};
const THOUSANDS_SUFFIX = new Set(["t€", "teur", "k€"]);
const MAX_RELATIVE_TOLERANCE = 0.02;

/**
 * Readings of a written number: [{ value, decimals }]. Two readings when the separator is ambiguous
 * ("1.084" is 1.084 in English and 1,084 in German; "1,048" the other way round).
 */
export function readNumber(token) {
  const s = String(token).replace(/[   ’]/g, (c) => (c === "’" ? "'" : " "));
  const seps = [...s.matchAll(/[.,' ]/g)].map((m) => ({ c: m[0], i: m.index }));
  const digits = (t) => t.replace(/[^\d]/g, "");
  const out = (intPart, frac = "") => ({ value: Number(`${digits(intPart) || "0"}${frac ? `.${frac}` : ""}`), decimals: frac.length });
  if (!seps.length) return [out(s)];
  const kinds = [...new Set(seps.map((x) => x.c))];
  const last = seps[seps.length - 1];
  const tail = s.slice(last.i + 1);
  if (kinds.length > 1) {
    // Mixed separators: the last one is the decimal separator ("1.048.000,00", "1,048,000.00").
    if (last.c === "." || last.c === ",") return [out(s.slice(0, last.i), tail)];
    return [out(s)];
  }
  const c = kinds[0];
  if (c === " " || c === "'") return [out(s)];
  if (seps.length > 1) return [out(s)];                    // "1,048,000" or "1.048.000": grouping
  if (tail.length !== 3) return [out(s.slice(0, last.i), tail)]; // "2,14" or "2.5": a decimal
  // One separator before exactly three digits: thousands or a decimal, depending on the writer.
  const grouped = out(s);
  const decimal = out(s.slice(0, last.i), tail);
  return c === "," ? [grouped, decimal] : [decimal, grouped];
}

/**
 * Money amounts written in a text: [{ raw, readings: [{value, tolerance}], value, currency, index }].
 * labelled: also read a bare number after an amount label ("Amount: 1,048,000.00"), for postings.
 */
export function extractAmounts(text, { labelled = false } = {}) {
  const s = String(text || "");
  const out = [];
  const spans = [];
  const add = (raw, index, num, unit, cur) => {
    const end = index + raw.length;
    if (spans.some(([a, b]) => index < b && end > a)) return;
    spans.push([index, end]);
    const curKey = String(cur || "").toLowerCase();
    let scale = unit ? SCALE[String(unit).toLowerCase()] || 1 : 1;
    if (!unit && THOUSANDS_SUFFIX.has(curKey)) scale = 1e3;
    const readings = readNumber(num).map(({ value, decimals }) => {
      const v = value * scale;
      // Half a unit of the last digit written, never more than 2 % of the amount, never under €0.50.
      const half = (scale * 10 ** -decimals) / 2;
      return { value: v, tolerance: Math.max(0.5, Math.min(half, v * MAX_RELATIVE_TOLERANCE)) };
    }).filter((r) => Number.isFinite(r.value));
    if (!readings.length) return;
    out.push({ raw: raw.trim(), readings, value: readings[0].value, tolerance: readings[0].tolerance, currency: CURRENCY[curKey] || "EUR", index });
  };
  for (const m of s.matchAll(PREFIX)) add(m[0], m.index, m[2], m[3], m[1]);
  for (const m of s.matchAll(SUFFIX)) add(m[0], m.index, m[1], m[2], m[3]);
  // "Amount: 1,048,000.00" in a posting: a bare number after an amount label is an amount in euro.
  if (labelled) for (const m of s.matchAll(LABELLED)) {
    const start = m.index + m[0].length - m[1].length;
    add(m[1], start, m[1], null, "EUR");
  }
  return out.sort((a, b) => a.index - b.index);
}

// ---- known figures --------------------------------------------------------------------------------

/** A set of known figures with their currency (null: unknown currency, matches any). */
export class FigureSet {
  constructor() { this.items = []; }
  add(value, currency = null) {
    const v = Math.abs(Number(value));
    if (!Number.isFinite(v) || v < 1) return;
    this.items.push({ value: v, currency });
  }
  get size() { return this.items.length; }
  [Symbol.iterator]() { return this.items[Symbol.iterator](); }
}

// Number fields that are not money: days, counts, percentages, rates, coordinates.
const NOT_MONEY = /(^|_)(days?|pct|percent|count|entries|accounts|lat|lon|horizon|rate|rates|per_eur|eur_per_unit|version|seq|step|tokens|calls|searches)$|orders/i;
const CODE = /^[A-Z]{3}$/;

/** Adds every money figure found in a tool result (numbers and amounts written in strings). */
export function collectFigures(value, known = new FigureSet()) {
  const walk = (v, key, cur, depth) => {
    if (depth > 14 || v === null || v === undefined) return;
    if (typeof v === "number") {
      if (key && NOT_MONEY.test(String(key))) return;
      known.add(v, cur);
      return;
    }
    if (typeof v === "string") { for (const a of extractAmounts(v)) for (const r of a.readings) known.add(r.value, a.currency); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, key, cur, depth + 1); return; }
    if (typeof v === "object") {
      const own = typeof v.currency === "string" && CODE.test(v.currency) ? v.currency
        : typeof v.invoice_currency === "string" && CODE.test(v.invoice_currency) ? v.invoice_currency : cur;
      for (const [k, x] of Object.entries(v)) walk(x, k, currencyOfKey(k) || own, depth + 1);
    }
  };
  walk(value, null, null, 0);
  return known;
}

function currencyOfKey(k) {
  const key = String(k);
  if (/_eur$/i.test(key) || /^eur$/i.test(key)) return "EUR";
  if (/_gbp$/i.test(key) || /^gbp$/i.test(key)) return "GBP";
  if (/_usd$/i.test(key) || /^usd$/i.test(key)) return "USD";
  if (CODE.test(key) && ["EUR", "GBP", "USD", "CHF"].includes(key)) return key;
  return null;
}

/**
 * Amounts in `text` that match no known figure (known: a FigureSet or a list of them). Amounts
 * below `min` (default 100) are not checked: they are prices of a day's work or rounding, not claims.
 */
export function unknownAmounts(text, known, { min = 100, labelled = false } = {}) {
  const sets = Array.isArray(known) ? known : [known];
  const list = sets.flatMap((s) => (s ? [...s] : []));
  return extractAmounts(text, { labelled }).filter((a) => {
    const readings = a.readings.filter((r) => r.value >= min);
    if (!readings.length) return false;
    return !readings.some((r) => list.some((k) => (k.currency === null || k.currency === a.currency) && Math.abs(k.value - r.value) <= r.tolerance + 1e-6));
  });
}
