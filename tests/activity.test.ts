/**
 * Activity log wording — every action the backend writes reads as plain English.
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeAction, deviceOf, targetRoute, type ActivityEntry } from "../src/modules/settings/lib/activity";

test("actions read as plain sentences", () => {
  const cases: [string, string][] = [
    ["consignment.create", "Created a booking"],
    ["consignment.update", "Edited a booking"],
    ["pod.status", "Changed the status of a bilti"],
    ["pod.pdf", "Printed / downloaded bilti PDF"],
    ["invoice.finalize", "Finalised a GST bill"],
    ["invoice.mark_paid", "Marked a GST bill as paid"],
    ["invoice.consignments", "Added bookings to a GST bill"],
    ["invoice.consignments_remove", "Removed a booking from a GST bill"],
    ["user.create", "Created a team member"],
    ["charge_head.delete", "Deleted a rate"],
    ["auth.login", "Signed in"],
    ["auth.login_failed", "Sign-in failed (wrong password)"],
    ["report.gst_export", "Exported the gst report"],
    ["privacy.parties_erase", "Erased a customer's personal data"],
    ["privacy.account_deletion_remove", "Cancelled the account deletion request"],
    ["station.create", "Created a station"],
    ["mystery.thing", "mystery: thing"],
  ];
  for (const [action, text] of cases) assert.equal(describeAction(action), text, action);
});

test("rows open their record, except deletes and refused attempts", () => {
  const row = (over: Partial<ActivityEntry>): ActivityEntry => ({
    id: "1",
    at: "2026-09-24T10:00:00Z",
    actor: null,
    action: "consignment.update",
    outcome: "ok",
    targetType: "consignment",
    targetId: "abc",
    fields: [],
    ...over,
  });
  assert.deepEqual(targetRoute(row({})), { route: "BookingDetail", id: "abc" });
  assert.deepEqual(targetRoute(row({ action: "party.create", targetType: "party" })), { route: "PartyDetail", id: "abc" });
  assert.equal(targetRoute(row({ action: "consignment.delete" })), null);
  assert.equal(targetRoute(row({ outcome: "denied" })), null);
  assert.equal(targetRoute(row({ targetType: "settings" })), null);
});

test("devices are named from the user agent", () => {
  assert.equal(
    deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"),
    "Chrome on Windows",
  );
  assert.equal(deviceOf("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36"), "Chrome on Android");
  assert.equal(deviceOf("okhttp/4.12.0"), "App");
  assert.equal(deviceOf(undefined), "");
});
