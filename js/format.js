// Formatting helpers for money, durations and dates (English UI, EUR).

import { appToday } from "./clock.js";

const nf0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Euro amount for KPIs and cards: €2.14M, €437,500, €17,100. Claims are exact, so amounts below a
 * million keep every euro; millions show two decimals.
 */
export function eurCompact(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const v = Number(value);
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}€${nf2.format(a / 1e9)}B`;
  if (a >= 1e6) return `${sign}€${nf2.format(a / 1e6)}M`;
  return `${sign}€${nf0.format(Math.round(a))}`;
}

/** Full euro amount: €2,640,000. */
export function eurFull(value) {
  if (value === null || value === undefined) return "—";
  return `€${nf0.format(Math.round(Number(value)))}`;
}

/** Small euro amounts with cents, for the cost meter: €0.38. */
export function eurCents(value) {
  return `€${nf2.format(Number(value) || 0)}`;
}

export function int(value) {
  return nf0.format(Math.round(Number(value) || 0));
}

export function days(n) {
  if (n === null || n === undefined) return "—";
  const v = Math.round(Number(n) * 10) / 10;
  return `${v} ${Math.abs(v) === 1 ? "day" : "days"}`;
}

/** mm:ss (or h:mm:ss) for the stopwatch. */
export function clock(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (x) => String(x).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/**
 * "Tue 21 Oct" for an ISO date or a day offset from today; "Wed 21 Oct 2027" when the date falls in
 * another year, so a running-year deadline never reads like this year's.
 */
export function shortDate(isoOrOffset) {
  let d;
  const now = appToday();
  if (typeof isoOrOffset === "number") {
    d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + isoOrOffset);
  } else {
    const text = String(isoOrOffset);
    d = new Date(text.includes("T") ? text : `${text}T12:00:00`);
  }
  const year = d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {};
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...year });
}

/** "12 Oct 2026" from an ISO date or timestamp (for recordings made on another day). */
export function dateWithYear(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "an earlier date" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "15:56:03" local time from an ISO timestamp. */
export function timeOfDay(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

