// Builds data/basemap_offline.js, the offline land layer under the map tiles (developer tool; the
// app needs no build step). Natural Earth 1:50m land and country borders (public domain), via the
// world-atlas package, cut to the inhabited latitudes like the Navigator's map (40° S to 84° N, all
// longitudes), simplified finely around GlobalCorp's accounts (North America and Europe) and coarsely
// elsewhere, and rounded to two decimals.
//
// Usage from the repository root (the two packages are not part of the app):
//   npm install --no-save world-atlas@2.0.2 topojson-client@3.1.0
//   node tools/build_basemap.mjs
// or, with the packages installed elsewhere: NODE_PATH=/path/to/node_modules node tools/build_basemap.mjs

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const resolveFrom = (id) => {
  for (const base of [root, ...(process.env.NODE_PATH || "").split(path.delimiter).filter(Boolean)]) {
    try { return require.resolve(id, { paths: [base] }); } catch { /* try the next one */ }
  }
  console.error(`Cannot find ${id}. Run: npm install --no-save world-atlas@2.0.2 topojson-client@3.1.0`);
  process.exit(2);
};
const topojson = require(resolveFrom("topojson-client"));
const land50 = JSON.parse(fs.readFileSync(resolveFrom("world-atlas/land-50m.json"), "utf8"));
const countries50 = JSON.parse(fs.readFileSync(resolveFrom("world-atlas/countries-50m.json"), "utf8"));

// Region: all longitudes, 40° S to 84° N (the Navigator's extent: no clipped edge in the global view).
const BOX = { west: -180, east: 180, south: -40, north: 84 };
// Douglas-Peucker tolerance in degrees: fine where the accounts are, coarse elsewhere.
const CORE = { west: -135, east: 45, south: 14, north: 72 };
const FINE = 0.035;
const COARSE = 0.16;
const tolAt = ([lon, lat]) => (lon >= CORE.west && lon <= CORE.east && lat >= CORE.south && lat <= CORE.north ? FINE : COARSE);

const inBox = ([lon, lat]) => lon >= BOX.west && lon <= BOX.east && lat >= BOX.south && lat <= BOX.north;

/**
 * A few Natural Earth rings (Eurasia, Wrangel Island) step across the antimeridian from +180 to -180.
 * Drawn as is, that step becomes a band across the whole map. Make the longitudes continuous, keep the
 * ring where most of it lies, and let the clip below cut it at the meridian.
 */
function unwrap(ring) {
  const out = [ring[0].slice()];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  const inside = (k) => out.filter(([lon]) => lon + k >= -180 && lon + k <= 180).length;
  const shift = [0, 360, -360].reduce((best, k) => (inside(k) > inside(best) ? k : best), 0);
  return shift ? out.map(([lon, lat]) => [lon + shift, lat]) : out;
}

/** Sutherland-Hodgman clip of a closed ring to the box (lon/lat pairs). */
function clipRing(ring) {
  const edges = [
    (p) => p[0] >= BOX.west, (p) => p[0] <= BOX.east, (p) => p[1] >= BOX.south, (p) => p[1] <= BOX.north
  ];
  const cut = [
    (a, b) => lerpAt(a, b, 0, BOX.west), (a, b) => lerpAt(a, b, 0, BOX.east),
    (a, b) => lerpAt(a, b, 1, BOX.south), (a, b) => lerpAt(a, b, 1, BOX.north)
  ];
  let out = ring;
  for (let e = 0; e < 4; e++) {
    const input = out;
    out = [];
    if (!input.length) break;
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const curIn = edges[e](cur), prevIn = edges[e](prev);
      if (curIn) {
        if (!prevIn) out.push(cut[e](prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(cut[e](prev, cur));
      }
    }
  }
  return out;
}
function lerpAt(a, b, axis, value) {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return axis === 0 ? [value, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), value];
}

/** Douglas-Peucker simplification of a polyline; the tolerance depends on where the point lies. */
function simplify(points) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, dmax = 0;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(points[i], points[a], points[b]);
      if (d > dmax) { dmax = d; best = i; }
    }
    if (best > 0 && dmax > tolAt(points[best])) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

const r2 = (x) => Math.round(x * 100) / 100;
const toLatLon = (ring) => ring.map(([lon, lat]) => [r2(lat), r2(lon)]);
const dedupe = (pts) => pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
const area = (ring) => Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

// ---- land ------------------------------------------------------------------------------------
const landGeo = topojson.feature(land50, land50.objects.land);
const polygons = landGeo.features.flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates));
const land = [];
for (const poly of polygons) {
  const rings = [];
  for (const ring of poly) {
    if (!ring.some(inBox) && !ringCoversBox(ring)) continue;
    const clipped = clipRing(unwrap(ring.slice(0, -1)));
    if (clipped.length < 3) continue;
    const simple = dedupe(simplify([...clipped, clipped[0]]).map(([lon, lat]) => [r2(lon), r2(lat)]));
    if (simple.length < 4 || area(simple) < (ring.some((p) => tolAt(p) === FINE) ? 0.02 : 0.3)) continue;
    rings.push(toLatLon(simple));
  }
  if (rings.length) land.push(rings);
}
function ringCoversBox(ring) {
  // A ring with no vertex in the box can still surround it (not the case for this region); cheap guard.
  let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
  for (const [lon, lat] of ring) { w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat); }
  return w < BOX.west && e > BOX.east && s < BOX.south && n > BOX.north;
}

// ---- borders between countries --------------------------------------------------------------------
const mesh = topojson.mesh(countries50, countries50.objects.countries, (a, b) => a !== b);
const borders = [];
for (const line of mesh.coordinates) {
  // Split each border line into runs inside the box.
  let run = [];
  const flush = () => {
    if (run.length >= 2) {
      const simple = dedupe(simplify(run).map(([lon, lat]) => [r2(lon), r2(lat)]));
      if (simple.length >= 2) borders.push(toLatLon(simple));
    }
    run = [];
  };
  for (const p of line) {
    if (inBox(p)) run.push(p);
    else flush();
  }
  flush();
}

const points = land.reduce((s, poly) => s + poly.reduce((t, r) => t + r.length, 0), 0) + borders.reduce((s, l) => s + l.length, 0);
const data = { source: "Natural Earth 1:50m land and country borders (public domain), via world-atlas@2.0.2", region: BOX, land, borders };
const header = `/* Offline basemap: Natural Earth 1:50m land polygons and country borders (public domain), via the world-atlas package.
 * GENERATED by tools/build_basemap.mjs: ${BOX.south}° to ${BOX.north}° latitude, all longitudes; simplified to ${FINE}° around
 * North America and Europe and ${COARSE}° elsewhere. Shown under the tiles so the map keeps its geography offline. */
`;
const out = `${header}window.OFFLINE_BASEMAP = ${JSON.stringify(data)};\n`;
fs.writeFileSync(path.join(root, "data/basemap_offline.js"), out);
console.log(`data/basemap_offline.js: ${land.length} land polygons, ${borders.length} border lines, ${points} points (${Math.round(out.length / 1024)} KB).`);
