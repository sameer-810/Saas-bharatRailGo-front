/**
 * Quick-entry parser — the "type a bilti in one line" feature.
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickEntry, bestPartyMatch } from "../src/modules/bookings/lib/parseQuickEntry";

const cases: [string, Record<string, unknown>][] = [
  [
    "DLI 3pkg 60kg Sharma topay 1550",
    { destinationStation: "DLI", packages: 3, chargeableWeight: 60, partyQuery: "Sharma", paymentMode: "to_pay", amount: 1550 },
  ],
  [
    "NDLS 2 pkg 40 kg ramesh onbill",
    { destinationStation: "NDLS", packages: 2, chargeableWeight: 40, partyQuery: "ramesh", paymentMode: "on_bill" },
  ],
  [
    "mum-hwh 5nag 120kgs gupta traders paid rs 2400",
    { originStation: "MUM", destinationStation: "HWH", packages: 5, chargeableWeight: 120, partyQuery: "gupta traders", paymentMode: "paid_source", amount: 2400 },
  ],
  ["ndls 3pkg60kg shyam & sons on bill 1,550/-", { destinationStation: "NDLS", packages: 3, chargeableWeight: 60, paymentMode: "on_bill", amount: 1550 }],
  ["pkg 4 kg 80 BCT slip ramesh", { destinationStation: "BCT", packages: 4, chargeableWeight: 80, paymentMode: "slip" }],
  ["DLI 3 60kg Sharma", { destinationStation: "DLI", packages: 3, chargeableWeight: 60 }],
];

for (const [input, expected] of cases) {
  test(`parses: ${input}`, () => {
    const r = parseQuickEntry(input) as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(expected)) assert.equal(r[k], v, `${k} for "${input}"`);
  });
}

test("keeps unknown tokens as unmatched", () => {
  const r = parseQuickEntry("LKO 4 ctn 25kg Verma paid 900 ???");
  assert.ok(r.unmatched.includes("???"));
});

test("empty input parses to nothing", () => {
  const r = parseQuickEntry("   ");
  assert.equal(r.destinationStation, undefined);
  assert.equal(r.packages, undefined);
});

test("best party match prefers a whole-word match", () => {
  const opts = [{ label: "Om Sharma Traders" }, { label: "Sharma & Co" }, { label: "Sharmila" }];
  assert.equal(bestPartyMatch("sharma", opts)?.label, "Sharma & Co");
});
