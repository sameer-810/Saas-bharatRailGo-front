/**
 * Quick-entry parser — turns one line typed at the counter into booking fields.
 *
 *   "DLI 3pkg 60kg Sharma topay 1550"
 *   "NDLS 2 pkg 40 kg ramesh onbill"
 *   "mum-hwh 5nag 120kgs gupta traders paid rs 2400"
 *
 * Pure function: no I/O. The party is returned as free text (`partyQuery`);
 * the UI resolves it against the party list.
 *
 * Rules (case-insensitive, order-independent):
 *   packages   <n> pkg|pkgs|pk|pcs|pc|nag|nags|package(s)|bag(s)|box(es)|ctn   (attached or separated, unit may come first)
 *   weight     <n> kg|kgs|kilo(s)                                             (decimals ok)
 *   mode       topay|to_pay|"to pay"|tp · onbill|on_bill|"on bill"|ob · paid|pd · slip
 *   amount     rs|₹|inr prefix, "/-" suffix, or a bare number left over
 *   station    ORIG-DEST pair (mum-dli, mum>dli, mum→dli), else an ALL-CAPS 2–5 letter code,
 *              else the first 2–5 letter word
 *   party      first run of remaining words
 *   anything else → unmatched
 */
import type { PaymentMode } from "./types";

export type QuickTokenKind =
  | "destination"
  | "origin"
  | "packages"
  | "weight"
  | "party"
  | "paymentMode"
  | "amount"
  | "unmatched";

export interface QuickToken {
  /** Text as typed (may be several words joined, e.g. "5 pkg"). */
  raw: string;
  kind: QuickTokenKind;
}

export interface ParsedQuickEntry {
  destinationStation?: string;
  originStation?: string;
  packages?: number;
  chargeableWeight?: number;
  partyQuery?: string;
  paymentMode?: PaymentMode;
  amount?: number;
  /** Every piece of input in typed order, labelled. */
  tokens: QuickToken[];
  /** Pieces that were not understood. */
  unmatched: string[];
}

const PKG_UNITS = new Set([
  "pkg",
  "pkgs",
  "pk",
  "pks",
  "pkt",
  "pkts",
  "pcs",
  "pc",
  "pce",
  "nag",
  "nags",
  "package",
  "packages",
  "packet",
  "packets",
  "bag",
  "bags",
  "box",
  "boxes",
  "ctn",
  "ctns",
  "carton",
  "cartons",
  "parcel",
  "parcels",
]);
const KG_UNITS = new Set([
  "kg",
  "kgs",
  "kilo",
  "kilos",
  "kilogram",
  "kilograms",
]);

const MODE_WORDS: Record<string, PaymentMode> = {
  topay: "to_pay",
  to_pay: "to_pay",
  "to-pay": "to_pay",
  tp: "to_pay",
  onbill: "on_bill",
  on_bill: "on_bill",
  "on-bill": "on_bill",
  ob: "on_bill",
  bill: "on_bill",
  paid: "paid_source",
  pd: "paid_source",
  paid_source: "paid_source",
  prepaid: "paid_source",
  slip: "slip",
};
/** Two-word modes: "to pay", "on bill". */
const MODE_PAIRS: Record<string, PaymentMode> = {
  "to pay": "to_pay",
  "on bill": "on_bill",
};

const MONEY_PREFIX = new Set([
  "rs",
  "rs.",
  "₹",
  "inr",
  "amt",
  "amount",
  "freight",
  "fr",
]);

const NUM = /^\d+(?:\.\d+)?$/;
const WORD = /^[a-z][a-z.&'-]*$/i;
/** Words that may continue a party name ("Shyam & Sons"). */
const WORD_CONT = /^(?:&|[a-z][a-z.&'-]*)$/i;
const STATION_CODE = /^[a-z]{2,5}$/i;

interface Piece {
  raw: string;
  lower: string;
  kind?: QuickTokenKind;
}

/** Split "3pkg60kg" → ["3pkg", "60kg"], "₹1550" → ["₹", "1550"], "rs.1550/-" → ["rs.", "1550/-"]. */
function explode(token: string): string[] {
  const t = token.trim();
  if (!t) return [];
  // money prefix glued to a number
  const money = /^(rs\.?|₹|inr)(\d[\d.,]*(?:\/-)?)$/i.exec(t);
  if (money) return [money[1], money[2]];
  // one or more <number><unit> pairs glued together
  if (/^(?:\d+(?:\.\d+)?[a-z]+)+$/i.test(t)) {
    const pairs = t.match(/\d+(?:\.\d+)?[a-z]+/gi) || [t];
    return pairs;
  }
  // unit glued before a number: "pkg3", "kg60"
  const unitFirst = /^([a-z]+)(\d+(?:\.\d+)?)$/i.exec(t);
  if (
    unitFirst &&
    (PKG_UNITS.has(unitFirst[1].toLowerCase()) ||
      KG_UNITS.has(unitFirst[1].toLowerCase()))
  ) {
    return [`${unitFirst[2]}${unitFirst[1]}`];
  }
  return [t];
}

function toNumber(s: string): number | undefined {
  const clean = s.replace(/,/g, "").replace(/\/-$/, "");
  if (!NUM.test(clean)) return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

export function parseQuickEntry(input: string): ParsedQuickEntry {
  const result: ParsedQuickEntry = { tokens: [], unmatched: [] };
  const rawTokens = String(input || "")
    .replace(/(\d),(?=\d{2,3}(?:\D|$))/g, "$1") // 1,550 / 1,55,000 → plain digits
    .replace(/[,;|]+/g, " ")
    .split(/\s+/)
    .flatMap(explode)
    .filter(Boolean);
  const pieces: Piece[] = rawTokens.map((raw) => ({
    raw,
    lower: raw.toLowerCase(),
  }));

  // Output groups: each group is a list of piece indexes that form one token.
  const groups: { idx: number[]; kind: QuickTokenKind }[] = [];
  const claim = (idx: number[], kind: QuickTokenKind) => {
    idx.forEach((i) => (pieces[i].kind = kind));
    groups.push({ idx, kind });
  };
  const free = (i: number) => i >= 0 && i < pieces.length && !pieces[i].kind;

  /* 1. station pair "mum-dli" / "mum>dli" / "mum→dli" / "mum->dli" */
  for (let i = 0; i < pieces.length && !result.destinationStation; i++) {
    const m = /^([a-z]{2,5})(?:-|>|->|→|\/|2)([a-z]{2,5})$/i.exec(
      pieces[i].raw,
    );
    if (m && !MODE_WORDS[pieces[i].lower]) {
      result.originStation = m[1].toUpperCase();
      result.destinationStation = m[2].toUpperCase();
      claim([i], "destination");
    }
  }

  /* 2. number + unit (attached, separated, or unit first) */
  for (let i = 0; i < pieces.length; i++) {
    if (!free(i)) continue;
    const p = pieces[i];
    const attached = /^(\d+(?:\.\d+)?)([a-z]+)$/i.exec(p.raw);
    if (attached) {
      const unit = attached[2].toLowerCase();
      const n = Number(attached[1]);
      if (PKG_UNITS.has(unit) && result.packages === undefined) {
        result.packages = Math.round(n);
        claim([i], "packages");
        continue;
      }
      if (KG_UNITS.has(unit) && result.chargeableWeight === undefined) {
        result.chargeableWeight = n;
        claim([i], "weight");
        continue;
      }
    }
    const n = toNumber(p.raw);
    if (n !== undefined && free(i + 1)) {
      const next = pieces[i + 1].lower;
      if (PKG_UNITS.has(next) && result.packages === undefined) {
        result.packages = Math.round(n);
        claim([i, i + 1], "packages");
        continue;
      }
      if (KG_UNITS.has(next) && result.chargeableWeight === undefined) {
        result.chargeableWeight = n;
        claim([i, i + 1], "weight");
        continue;
      }
    }
    // unit first: "pkg 3", "kg 60"
    if ((PKG_UNITS.has(p.lower) || KG_UNITS.has(p.lower)) && free(i + 1)) {
      const v = toNumber(pieces[i + 1].raw);
      if (v !== undefined) {
        if (PKG_UNITS.has(p.lower) && result.packages === undefined) {
          result.packages = Math.round(v);
          claim([i, i + 1], "packages");
          continue;
        }
        if (KG_UNITS.has(p.lower) && result.chargeableWeight === undefined) {
          result.chargeableWeight = v;
          claim([i, i + 1], "weight");
          continue;
        }
      }
    }
  }

  /* 3. payment mode (two-word first, then single word) */
  for (let i = 0; i < pieces.length && !result.paymentMode; i++) {
    if (free(i) && free(i + 1)) {
      const pair = MODE_PAIRS[`${pieces[i].lower} ${pieces[i + 1].lower}`];
      if (pair) {
        result.paymentMode = pair;
        claim([i, i + 1], "paymentMode");
      }
    }
  }
  for (let i = 0; i < pieces.length && !result.paymentMode; i++) {
    if (!free(i)) continue;
    const mode = MODE_WORDS[pieces[i].lower];
    if (mode) {
      result.paymentMode = mode;
      claim([i], "paymentMode");
    }
  }

  /* 4. explicit money: "rs 1550", "₹ 1550", "1550/-" */
  for (let i = 0; i < pieces.length && result.amount === undefined; i++) {
    if (!free(i)) continue;
    if (MONEY_PREFIX.has(pieces[i].lower) && free(i + 1)) {
      const v = toNumber(pieces[i + 1].raw);
      if (v !== undefined) {
        result.amount = v;
        claim([i, i + 1], "amount");
        continue;
      }
    }
    if (/\/-$/.test(pieces[i].raw)) {
      const v = toNumber(pieces[i].raw);
      if (v !== undefined) {
        result.amount = v;
        claim([i], "amount");
      }
    }
  }

  /* 5. destination station: ALL-CAPS code, else first short word */
  const isKeyword = (l: string) =>
    !!MODE_WORDS[l] ||
    PKG_UNITS.has(l) ||
    KG_UNITS.has(l) ||
    MONEY_PREFIX.has(l);
  if (!result.destinationStation) {
    let at = pieces.findIndex(
      (p, i) =>
        free(i) &&
        STATION_CODE.test(p.raw) &&
        p.raw === p.raw.toUpperCase() &&
        !isKeyword(p.lower),
    );
    if (at < 0) {
      const first = pieces.findIndex((_, i) => free(i));
      if (
        first >= 0 &&
        STATION_CODE.test(pieces[first].raw) &&
        !isKeyword(pieces[first].lower)
      )
        at = first;
    }
    if (at >= 0) {
      result.destinationStation = pieces[at].raw.toUpperCase();
      claim([at], "destination");
    }
  }

  /* 6. bare leftover numbers → amount (largest), then packages (small integer) */
  const bare = () =>
    pieces
      .map((p, i) => ({ i, v: toNumber(p.raw) }))
      .filter((x) => free(x.i) && x.v !== undefined) as {
      i: number;
      v: number;
    }[];
  if (result.amount === undefined) {
    const nums = bare();
    if (nums.length) {
      const top = nums.reduce((a, b) => (b.v > a.v ? b : a));
      // A freight under ₹50 is implausible: a lone small integer is a package count.
      if (
        top.v < 50 &&
        Number.isInteger(top.v) &&
        result.packages === undefined
      ) {
        result.packages = top.v;
        claim([top.i], "packages");
      } else {
        result.amount = top.v;
        claim([top.i], "amount");
      }
    }
  }
  if (result.packages === undefined) {
    const small = bare().find(
      (x) => Number.isInteger(x.v) && x.v >= 1 && x.v <= 999,
    );
    if (small) {
      result.packages = small.v;
      claim([small.i], "packages");
    }
  }

  /* 7. party: first contiguous run of free words */
  const start = pieces.findIndex(
    (p, i) => free(i) && WORD.test(p.raw) && !isKeyword(p.lower),
  );
  if (start >= 0) {
    const run: number[] = [];
    for (
      let i = start;
      i < pieces.length && free(i) && WORD_CONT.test(pieces[i].raw);
      i++
    )
      run.push(i);
    result.partyQuery = run.map((i) => pieces[i].raw).join(" ");
    claim(run, "party");
  }

  /* 8. whatever is left */
  pieces.forEach((p, i) => {
    if (free(i)) {
      claim([i], "unmatched");
      result.unmatched.push(p.raw);
    }
  });

  // Tokens in typed order (by first piece index).
  result.tokens = groups
    .sort((a, b) => Math.min(...a.idx) - Math.min(...b.idx))
    .map((g) => ({
      raw: g.idx
        .slice()
        .sort((a, b) => a - b)
        .map((i) => pieces[i].raw)
        .join(" "),
      kind: g.kind,
    }));
  return result;
}

/** True when enough was understood to be worth opening the form. */
export function hasUsefulQuickEntry(p: ParsedQuickEntry): boolean {
  return !!(
    p.destinationStation ||
    p.packages !== undefined ||
    p.chargeableWeight !== undefined ||
    p.partyQuery ||
    p.paymentMode ||
    p.amount !== undefined
  );
}

/**
 * Pick the best party option for a free-text query:
 * exact name > name starts with query > a word starts with query > contains > first result.
 */
export function bestPartyMatch<T extends { label: string }>(
  query: string,
  options: T[],
): T | undefined {
  const q = query.trim().toLowerCase();
  if (!q || options.length === 0) return undefined;
  const score = (label: string) => {
    const l = label.toLowerCase();
    if (l === q) return 100;
    if (l.startsWith(q)) return 80;
    if (l.split(/[\s.&-]+/).some((w) => w.startsWith(q))) return 60;
    if (l.includes(q)) return 40;
    const qWords = q.split(/\s+/);
    if (qWords.every((w) => l.includes(w))) return 30;
    return 10;
  };
  return options
    .map((o, i) => ({ o, s: score(o.label), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)[0].o;
}
