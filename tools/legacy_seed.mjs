// The vendor master and purchase orders of the Streamlit version of the Rebate Hunter (app.py v6.2),
// regenerated bit for bit in JavaScript. The Streamlit app built its 150 vendor accounts and 1,203
// purchase orders in memory with Python's random module, seed 1337. This module re-implements the
// parts of Python's random it used (Mersenne Twister MT19937, seed(), random(), uniform(),
// randint() and choice()), so tools/build_world.mjs can carry the same accounts and orders over.
// tests/engine.mjs checks the result against the fingerprint tools/legacy_reference.py prints.

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER = 0x80000000;
const LOWER = 0x7fffffff;

/** Python's random.Random, limited to what the legacy generator calls. */
export class PyRandom {
  constructor(seed) {
    this.mt = new Uint32Array(N);
    this.mti = N + 1;
    this.seed(seed);
  }

  initGenrand(s) {
    const mt = this.mt;
    mt[0] = s >>> 0;
    for (let i = 1; i < N; i++) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    this.mti = N;
  }

  /** random.seed(int): the absolute value split into 32-bit words, fed to init_by_array. */
  seed(a) {
    let n = BigInt(Math.abs(Number(a)));
    const key = [];
    do { key.push(Number(n & 0xffffffffn)); n >>= 32n; } while (n > 0n);
    this.initByArray(key);
  }

  initByArray(key) {
    const mt = this.mt;
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    for (let k = Math.max(N, key.length); k > 0; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0;
      i++; j++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (let k = N - 1; k > 0; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
    }
    mt[0] = 0x80000000;
  }

  genrandInt32() {
    const mt = this.mt;
    if (this.mti >= N) {
      let kk = 0;
      for (; kk < N - M; kk++) {
        const y = (mt[kk] & UPPER) | (mt[kk + 1] & LOWER);
        mt[kk] = mt[kk + M] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      for (; kk < N - 1; kk++) {
        const y = (mt[kk] & UPPER) | (mt[kk + 1] & LOWER);
        mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      const y = (mt[N - 1] & UPPER) | (mt[0] & LOWER);
      mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      this.mti = 0;
    }
    let y = mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** random.random(): 53-bit float in [0, 1). */
  random() {
    const a = this.genrandInt32() >>> 5;
    const b = this.genrandInt32() >>> 6;
    return (a * 67108864 + b) * (1 / 9007199254740992);
  }

  /** getrandbits(k) for 1 ≤ k ≤ 32 (all the legacy generator needs). */
  getrandbits(k) {
    if (k < 1 || k > 32) throw new Error("getrandbits: only 1 to 32 bits are implemented");
    return this.genrandInt32() >>> (32 - k);
  }

  randbelow(n) {
    const k = n.toString(2).length;
    let r = this.getrandbits(k);
    while (r >= n) r = this.getrandbits(k);
    return r;
  }

  /** random.randint(a, b), both ends included. */
  randint(a, b) {
    return a + this.randbelow(b - a + 1);
  }

  choice(seq) {
    return seq[this.randbelow(seq.length)];
  }

  uniform(a, b) {
    return a + (b - a) * this.random();
  }
}

/** Python's round(x, 2) for the values the generator produces (no exact binary ties occur). */
export function round2(x) {
  return Number(x.toFixed(2));
}

/** The nine storyline accounts of the Streamlit app, exactly as app.py defined them. */
export const LEGACY_CORE = [
  { LIFNR: "10001", NAME1: "Cisco Systems Germany GmbH", ORT01: "Bonn", LAND1: "DE", STCD1: "DE123456780", SPEND_YTD: 18200000.0 },
  { LIFNR: "10002", NAME1: "Cisco Technology Inc.", ORT01: "San Jose", LAND1: "US", STCD1: "US987654321", SPEND_YTD: 14100000.0 },
  { LIFNR: "10003", NAME1: "Meraki Cloud Networks Ltd.", ORT01: "London", LAND1: "GB", STCD1: "GB554433221", SPEND_YTD: 9500000.0 },
  { LIFNR: "10004", NAME1: "Acacia Communications Opto", ORT01: "Maynard", LAND1: "US", STCD1: "US112233445", SPEND_YTD: 6200000.0 },
  { LIFNR: "10005", NAME1: "Splunk Software EMEA", ORT01: "Munich", LAND1: "DE", STCD1: "DE887766554", SPEND_YTD: 4400000.0 },
  { LIFNR: "20001", NAME1: "Microsoft Deutschland GmbH", ORT01: "Munich", LAND1: "DE", STCD1: "DE998877665", SPEND_YTD: 41000000.0 },
  { LIFNR: "20002", NAME1: "Activision Blizzard Germany", ORT01: "Ismaning", LAND1: "DE", STCD1: "DE556677889", SPEND_YTD: 6000000.0 },
  { LIFNR: "40001", NAME1: "Apex Robotics Solutions GmbH", ORT01: "Stuttgart", LAND1: "DE", STCD1: "DE606060601", SPEND_YTD: 2300000.0 },
  { LIFNR: "40002", NAME1: "Apex Robotics Systems Ltd.", ORT01: "Manchester", LAND1: "GB", STCD1: "GB707070702", SPEND_YTD: 1900000.0 }
];

/**
 * Regenerates app.py's generate_enterprise_sap_data(): 9 core + 141 filler accounts and their
 * purchase orders, in the same random-call order. Returns { vendors, pos } with the original field
 * names (LIFNR, NAME1, ORT01, LAND1, STCD1, SPEND_YTD; EBELN, LIFNR, AEDAT, NETWR).
 */
export function legacyData() {
  const rnd = new PyRandom(1337);
  const stems = ["Logistics", "Facility", "Consulting", "MRO", "Packaging", "IT-Services", "Robotics", "Chemicals", "Security", "Fleet"];
  const cities = ["Frankfurt", "Stuttgart", "Hamburg", "Berlin", "Düsseldorf", "Paris", "Zurich", "Vienna", "Milan", "Madrid", "Amsterdam"];
  const prefixes = ["Global", "Nova", "Sino", "Euro", "Chroma", "Stellar", "Vanguard", "Omni", "Inno"];

  const fillers = [];
  for (let i = 8; i < 149; i++) {
    const spend = round2(rnd.uniform(15000.0, 3800000.0));
    const name = `${rnd.choice(prefixes)} ${rnd.choice(stems)} ${rnd.choice(["GmbH", "AG", "S.A.", "Ltd"])}`;
    const city = rnd.choice(cities);
    const land = rnd.choice(["DE", "FR", "CH", "AT", "IT", "ES", "NL"]);
    const stcd = `EU${rnd.randint(100000000, 999999999)}`;
    fillers.push({ LIFNR: String(30000 + i), NAME1: name, ORT01: city, LAND1: land, STCD1: stcd, SPEND_YTD: spend });
  }

  const all = [...LEGACY_CORE, ...fillers];
  const poCounts = { "10001": 30, "10002": 25, "10003": 20, "10004": 15, "10005": 10, "20001": 35, "20002": 15, "40001": 9, "40002": 8 };
  fillers.forEach((v, idx) => { poCounts[v.LIFNR] = idx < 49 ? 8 : 7; });

  const pos = [];
  let ebeln = 4500000001;
  for (const v of all) {
    const n = poCounts[v.LIFNR];
    const target = Math.trunc(v.SPEND_YTD * 100);
    const cuts = [];
    for (let k = 0; k < n - 1; k++) cuts.push(rnd.randint(1, target - 1));
    cuts.sort((a, b) => a - b);
    const points = [0, ...cuts, target];
    for (let k = 0; k < points.length - 1; k++) {
      const netwr = (points[k + 1] - points[k]) / 100;
      const month = rnd.randint(1, 5);
      const day = rnd.randint(1, 28);
      pos.push({ EBELN: String(ebeln), LIFNR: v.LIFNR, AEDAT: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, NETWR: netwr });
      ebeln += 1;
    }
  }
  return { vendors: all, pos };
}
