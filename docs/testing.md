# Testing

Tests are Node assert scripts, not Jest or Playwright. TypeScript tests run through `scripts/register-loader.mjs`, which resolves `@/` and relative imports.

Reviewed on 2 November 2026. Only the commands listed under “Run during this documentation pass” were executed for this update.

## Strategy

- Pure functions (matching, freshness, certificates, CSV, product type) run without Postgres.
- `scripts/search-behavior.mjs`, `scripts/freshness-behavior.mjs`, `scripts/persist-actions.mjs`, and `scripts/contact-tracking.mjs` post to `http://localhost:3000` or query Postgres. They need a running `npm run dev` and `DATABASE_URL`. `scripts/contact-tracking.mjs` checks the shortlist form, not a separate contact-person service.
- Typecheck, ESLint, Prisma validate, and `next build` are the static gates.

There is no end-to-end browser suite and no CI workflow in this repository.

## Commands in `package.json`

```bash
npm run typecheck
npm run lint
npm run test:matching
npm run test:freshness
npm run test:csv
npm run test:certificates
npm run test:product-type
npm run build
npx prisma validate
```

Behavior scripts:

```bash
node --import ./scripts/register-loader.mjs scripts/search-behavior.mjs
node --import ./scripts/register-loader.mjs scripts/freshness-behavior.mjs
node --import ./scripts/register-loader.mjs scripts/persist-actions.mjs
node --import ./scripts/register-loader.mjs scripts/contact-tracking.mjs
```

The certificate unit file does not open Postgres. Behavior scripts that do load `DATABASE_URL` through `dotenv`.

## What each test covers

| Area | How |
| --- | --- |
| Match score weights, missing facts, certificates, geography | `npm run test:matching` |
| Freshness thresholds and time zones | `npm run test:freshness` |
| Comparison CSV columns and note exclusion | `npm run test:csv` |
| Certificate status math, administrator verification function, badge markup | `npm run test:certificates` |
| Product-type name map and the four enum values | `npm run test:product-type` |
| Search, filters, sort, including product type | `scripts/search-behavior.mjs` |
| Freshness filter on live pages | `scripts/freshness-behavior.mjs` |
| Favorite, note, status, compare, delete-note HTTP forms | `scripts/persist-actions.mjs` |
| Follow-up dates and status updates through the live form | `scripts/contact-tracking.mjs` |

## Run during this documentation pass

Executed and passing during the cleanup:

- `npm run typecheck`
- `npx prisma migrate deploy` applied `20261102230000_drop_unused_records`
- `npx prisma migrate status` reports the database schema is up to date
- `npx prisma validate`
- `npm run test:certificates` on the earlier certificate pass

Not re-run after the unused files were removed:

- `npm run lint`, `npm run build`
- `test:matching`, `test:freshness`, `test:csv`, `test:product-type`
- The four behavior scripts

An earlier pass recorded `tsc --noEmit`, the npm tests, the behavior scripts, and `npm run build` on Next.js 16.4.3 as passing. `npm run lint` was recorded as exit 0 with one warning: `@next/next/no-img-element` on `src/components/landing/home-page.tsx`.

Also not covered by an automated suite:

- Browser clicks, confirmation dialogs, double-submit, and loading-state timing
- Desktop and narrow layouts
- A served English UI (`/en` redirects)
- Hosted production deployment
- A second user (there is no user model)

## Known limitations

- Favorite removal deletes notes and the shortlist.
- `deleteNote` deletes by note id and workspace. It does not check `supplierId`.
- A full `npm run db:seed` rewrites `updatedAt` and changes freshness.
- Certificate tests do not hit the database. They do not prove the live certificate filter SQL.
