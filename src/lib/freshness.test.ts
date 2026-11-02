import assert from "node:assert/strict";
import { parseDiscoveryQuery, toSearchParams } from "./discovery-query";
import {
  calendarDaySpan,
  freshnessFacts,
  freshnessStatus,
  freshnessThresholds,
  isFreshnessStatus,
  isTimeZone,
} from "./freshness";

const now = new Date("2026-11-01T12:00:00.000Z");

function shiftUtcDays(instant: Date, days: number) {
  return new Date(
    Date.UTC(
      instant.getUTCFullYear(),
      instant.getUTCMonth(),
      instant.getUTCDate() + days,
      instant.getUTCHours(),
      instant.getUTCMinutes(),
      instant.getUTCSeconds(),
      instant.getUTCMilliseconds(),
    ),
  );
}

assert.equal(freshnessThresholds.freshDays, 30);
assert.equal(freshnessThresholds.agingDays, 90);
assert.equal(freshnessStatus(now, now, "UTC"), "fresh");
assert.equal(freshnessStatus(shiftUtcDays(now, -freshnessThresholds.freshDays), now, "UTC"), "fresh");
assert.equal(freshnessStatus(shiftUtcDays(now, -(freshnessThresholds.freshDays + 1)), now, "UTC"), "aging");
assert.equal(freshnessStatus(shiftUtcDays(now, -freshnessThresholds.agingDays), now, "UTC"), "aging");
assert.equal(freshnessStatus(shiftUtcDays(now, -(freshnessThresholds.agingDays + 1)), now, "UTC"), "stale");
assert.equal(freshnessStatus(shiftUtcDays(now, -200), now, "UTC"), "stale");

for (const missing of [null, undefined, "", "   ", "not-a-date", new Date("invalid")]) {
  assert.equal(freshnessStatus(missing, now, "UTC"), "unknown");
}
assert.equal(freshnessStatus(shiftUtcDays(now, 1), now, "UTC"), "unknown");
assert.equal(freshnessStatus(now, new Date("invalid"), "UTC"), "unknown");

const boundaryNow = new Date("2026-11-01T20:00:00.000Z");
const boundaryUpdated = new Date("2026-10-02T02:00:00.000Z");
assert.equal(calendarDaySpan("2026-10-02", "2026-11-01"), 30);
assert.equal(freshnessStatus(boundaryUpdated, boundaryNow, "UTC"), "fresh");
assert.equal(freshnessStatus(boundaryUpdated, boundaryNow, "America/Los_Angeles"), "aging");
assert.equal(freshnessStatus(boundaryUpdated, boundaryNow, "Pacific/Kiritimati"), "aging");
assert.equal(freshnessStatus(boundaryUpdated, boundaryNow, "Not/AZone"), "fresh");
assert.equal(isTimeZone("Asia/Vladivostok"), true);
assert.equal(isTimeZone("Not/AZone"), false);

const recent = shiftUtcDays(now, -2).toISOString();
const oldVerification = shiftUtcDays(now, -200).toISOString();
const facts = freshnessFacts(
  {
    createdAt: shiftUtcDays(now, -10).toISOString(),
    updatedAt: recent,
    lastVerifiedAt: oldVerification,
    sourceUrl: "https://example.com/source",
    sources: [
      {
        id: "source-1",
        sourceType: "OFFICIAL_WEBSITE",
        url: "https://example.com/source",
        title: "Official page",
        evidence: "Stored citation",
        checkedAt: oldVerification,
      },
    ],
  },
  now,
  "UTC",
);
assert.equal(facts.status, "fresh");
assert.equal(facts.verifiedAt, new Date(oldVerification).toISOString());
assert.equal(facts.externalSyncedAt, null);
assert.equal(facts.sourceCheckedAt, new Date(oldVerification).toISOString());
assert.equal(facts.sourceTitle, "Official page");
assert.notEqual(facts.recordUpdatedAt, facts.verifiedAt);

const unverifiedRecent = freshnessFacts(
  {
    createdAt: recent,
    updatedAt: null,
    lastVerifiedAt: recent,
    sourceUrl: "https://example.com/source",
    sources: [],
  },
  now,
  "UTC",
);
assert.equal(unverifiedRecent.status, "unknown");
assert.equal(unverifiedRecent.recordUpdatedAt, null);
assert.equal(unverifiedRecent.verifiedAt, new Date(recent).toISOString());
assert.equal(unverifiedRecent.externalSyncedAt, null);
assert.equal(unverifiedRecent.sourceUrl, "https://example.com/source");

assert.equal(isFreshnessStatus("stale"), true);
assert.equal(isFreshnessStatus("updatedAt"), false);
assert.equal(parseDiscoveryQuery({ freshness: "aging" }).freshness, "aging");
assert.equal(parseDiscoveryQuery({ freshness: "updatedAt;drop" }).freshness, "");
assert.equal(parseDiscoveryQuery({}).freshness, "");
const params = toSearchParams(parseDiscoveryQuery({ freshness: "stale", category: "dairy", page: "2" }), 2);
assert.equal(params.get("freshness"), "stale");
assert.equal(params.get("category"), "dairy");
assert.equal(params.get("page"), "2");

console.log("freshness checks passed");
