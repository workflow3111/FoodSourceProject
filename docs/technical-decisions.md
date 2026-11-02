# Technical decisions

## Application model

FoodSource is a catalog plus a single workspace, not a marketplace and not an account-based CRM. Published facts live on the supplier. Buyer engagement that the UI saves lives on `Shortlist` and `SupplierNote`, keyed by `workspaceKey`, so a user table can be added later without rewriting supplier rows.

The split that the pages use:

- `SupplierContact` is a published channel from a source page.
- `Shortlist` is the current relationship: status, dates, a person-name string, and a contact method.
- `SupplierNote` is workspace text.

Search treats a missing shortlist as `NOT_CONTACTED`. The profile “Ход общения” block reads those shortlist columns. It is not a history log.

## No authentication

There is no login. Every workspace query uses `demo-workspace`. Anyone who can open the app can read and write that workspace. Notes are internal only relative to the public catalog include.

`applyCertificateVerification` accepts an administrator object as a function argument. There is no user table, so that check cannot be enforced by a session.

## Next.js 16 and next-intl

The App Router, `cacheComponents`, and `partialPrefetching` are enabled. `Date.now()` / `new Date()` during prerender throws unless the tree is inside `Suspense` and calls `connection()` from `next/server`. Catalog time goes through `catalogNow` and `requestClock`.

The locale list is `ru` only. English keys stay in `messages/en.json` so the trees stay aligned. `src/proxy.ts` redirects `/en`. Serving English is a routing change. `refresh()` in `actions.ts` still calls `revalidatePath("/en", "layout")` after workspace writes.

Prisma 7 uses a generated client under `src/generated/prisma` and `@prisma/adapter-pg`. CLI migrations prefer `DIRECT_URL`.

## SQL search instead of Prisma `findMany` filters

`src/server/supplier-search.ts` builds one `WHERE` from parameterized `Prisma.sql` fragments. City, certificate, freshness, contact status, product type, and price filters stay in the database. Sort `match` still loads the filtered population into `matchSuppliers` because price and MOQ scores need peers.

`Prisma.raw` is used only for a whitelist of `ASC`/`DESC` and the unit-key expression. Filter values stay bound parameters.

Certificate validity in SQL is `effectiveCertificateStatusSql`. It matches `resolveCertificateStatus`: `SUSPENDED` and `REVOKED` stay recorded; a null date stays `EXPIRED` only when that was the recorded status; otherwise the calendar date in the server time zone decides. The 30-day expiring window is `certificateThresholds.expiringSoonDays` only.

## Product type is not a category

Each `SupplierProduct` has one `ProductType` and still belongs to a `Category`. The seed and the product-type migration classify by exact product name. An unknown name throws in `productTypeForName` so a later seed fails loudly. Product type filters suppliers and, on the profile, the product list. It is not a match-score weight and it is not part of `hasRankingContext`.

## Matching score

Weights and the formula live in `src/server/matching.ts` and in [matching-score.md](matching-score.md). Missing facts stay in the denominator so a thin record cannot score 100. The profile uses the same population as the list when the URL has a ranking context. With no search, it uses the active catalog. It does not use the comparison cookie.

## Certificates are two statuses

Validity and verification are different columns. A future date does not verify a claim. Demonstration certificates stay `UNVERIFIED` and `isDemo`. The card and the match score ignore them. The “real certificate records” checkbox excludes demonstration rows and effective expired, suspended, and revoked rows. It still matches an unverified current claim on a real supplier.

`SUSPENDED` and `REVOKED` are never replaced by the date calculation.

## Dates and time zones

`lastContactOn` and `nextFollowUpOn` are PostgreSQL `DATE`. The action stores them as UTC midnight date-only values. Overdue copy compares calendar strings with `isOverdueFollowUp`. Freshness and certificate expiry use `serverTimeZone()`, which is the Node process time zone, or `UTC` when that identifier is invalid. The application does not pin `Asia/Vladivostok` in code. The local Postgres session may still be set to that zone.

Freshness reads `Supplier.updatedAt` only. Source `checkedAt` is shown as last reviewed. It does not change the fresh / aging / stale class. Thresholds are 30 and 90 days in `freshnessThresholds`.

## What a workspace write stores

- Creating or editing a note writes `SupplierNote` only.
- Deleting a note deletes that note row.
- Saving contact status upserts `Shortlist`, including when the status did not change.
- Removing a favorite deletes that workspace’s notes and the shortlist.

## Catalog honesty

`REAL` rows store sourced facts. `DEMO` rows are labeled in the UI. Real contacts, prices, minimum orders, certificate numbers, and delivery notes stay null when no source supports them. The UI prints «Не указано» for those gaps. The seed must not invent GOST numbers or delivery day counts.

## Trade-offs

| Choice | Cost |
| --- | --- |
| Hardcoded workspace | Simple now; no per-buyer isolation |
| Full filtered set scored on every ranked search | Correct peer groups; extra reads as the catalog grows |
| `getWorkspace()` returns every note | Simple favorites page; extra data on profile and compare |
| Current shortlist row, no activity history | The form can show the latest status and dates; earlier edits are not kept |
| Cookie comparison list | No server row; `fs-compare` is readable by JavaScript; limit 3 |
| Favorite removal deletes notes | Clean shortlist; notes are gone |
| Russian-only routing | Matches the served product; English messages are unused |
| Certificate status calculated on read | Stored `VALID` can display as `EXPIRED` after the date, and the column is not rewritten |
