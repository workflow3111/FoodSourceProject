# Architecture

FoodSource is a Next.js App Router catalog for discovering food suppliers. Pages load catalog and workspace data on the server. Mutations that the UI actually posts go through Server Actions in `src/server/actions.ts`. There is one Route Handler: comparison CSV export. There is no separate HTTP API and no user authentication.

Reviewed against the repository and the local database on 2 November 2026.

## System shape

```
Browser
  → src/proxy.ts (next-intl + /en redirect)
    → src/app/[locale]/* pages
        → src/server/catalog.ts, supplier-search.ts, matching.ts
        → PostgreSQL through Prisma 7 + @prisma/adapter-pg
  → src/server/actions.ts (favorite, compare cookies, note, contact status)
```

`src/proxy.ts` is the Next.js request proxy. This Next.js version does not use `middleware.ts`. The proxy redirects `/en` and `/en/*` to the same path without the prefix, then runs next-intl. Routing in `src/i18n/routing.ts` lists only `ru`, with `localePrefix: "never"` and `localeDetection: false`.

`messages/ru.json` is the served catalog. `messages/en.json` matches the Russian key tree and is imported from `src/i18n/request.ts`, but the router never selects `en`.

## Pages

| Route | What it loads |
| --- | --- |
| `/` | Home. Hero search, product-type cards, category chips. Counts come from `getProductTypeCounts` and `getCategories`. |
| `/dashboard` | Overview. Supplier, category, region, and saved counts, then product-type cards, recent suppliers, and popular categories. |
| `/suppliers` | Search. Query string is parsed by `parseDiscoveryQuery`. Page size is 9. |
| `/suppliers/[slug]` | Profile. `getSupplier`, `getWorkspace`, and `scoreSupplier`. The comparison cookie selects the compare button state. It is not the score population. |
| `/compare` | Suppliers named in the `fs-compare` cookie, plus workspace rows for notes and status. |
| `/favorites` | Active suppliers that have a `demo-workspace` shortlist. |
| `/categories` | Two sections: product-type cards, then category cards. |
| `/settings` | Static section page. It does not persist preferences. |

Header links are overview, suppliers, compare, and favorites. Categories and settings stay in the fuller navigation list.

## Main modules

| Area | Location | Responsibility |
| --- | --- | --- |
| Pages | `src/app/[locale]` | Routes above |
| Catalog UI | `src/components/catalog` | Cards, three-layer filters, profile, comparison, certificate badges, product-type badges, workspace forms |
| Shell | `src/components/layout`, `src/components/landing` | Header, footer, back to top, home |
| Server reads | `src/server/catalog.ts`, `supplier-search.ts`, `matching.ts` | Catalog mapping, SQL search, match score |
| Server writes used by the UI | `src/server/actions.ts` | Shortlist, notes, contact fields on `Shortlist`, compare cookies |
| Certificate rules | `src/lib/certificate-status.ts`, `src/server/certificate-sql.ts`, `src/server/certificate-verification.ts` | Effective validity, search SQL, administrator decision function |
| Product types | `src/lib/product-type.ts` | Four-value enum and the name map used by seed |
| Parsing | `src/lib/discovery-query.ts`, `contact-tracking.ts`, `freshness.ts` | URL, contact dates, freshness |
| i18n | `src/i18n/*`, `messages/*.json` | Locale assertion and message types |
| Data | `prisma/schema.prisma`, `prisma/migrations`, `prisma/seed.mjs` | Schema, SQL history, seed |

`src/server/supplier-records.ts` is used by tests and seed helpers. The public UI does not create suppliers.

## Data flow

### Search

1. The search form submits query-string parameters. Search applies on submit. Sort applies immediately from the results toolbar and resets the page to 1.
2. `parseDiscoveryQuery` drops unknown enum values. Default sort is `name`, and that value is omitted from the URL.
3. `searchSuppliers` loads facets, the filtered id set, the match cohort, and the current page.
4. `querySupplierPage` / `querySupplierIds` run parameterized SQL. Page size is `discoveryPageSize` (9).
5. `hasRankingContext` is true when the URL has text, category, city, region, a certificate filter, the real-certificate checkbox, freshness, maximum price, or maximum MOQ. Product type, supplier type, and contact status are filters only. They do not turn the score on.
6. When a ranking context is present, or the sort is `match`, `matchSuppliers` scores the full filtered set. Price and MOQ need that peer group.
7. The filter panel keeps search and primary filters visible. Advanced filters stay collapsed until opened or until an advanced value is already in the URL.

### Profile

1. `getSupplier(slug)` loads an active supplier with products, public contacts, certifications, and sources.
2. `getWorkspace()` loads every `demo-workspace` shortlist and note. The page keeps the row for this supplier.
3. `scoreSupplier` uses the filtered catalog when the profile URL has a ranking context. With no search, it scores against the active catalog. The comparison cookie is not applied.
4. Certificate status on the mapped supplier is the effective status from `resolveCertificateStatus`. The stored column is kept as `recordedStatus`.
5. The profile contact form writes `Shortlist` through `updateContactStatus` with `details=1`. It shows the saved status, dates, person name, and method.

### Workspace writes that the UI posts

`src/server/actions.ts` validates `FormData` and writes Prisma models that are in `schema.prisma`.

- Favorite creates a shortlist. Removing it deletes that workspace’s notes and the shortlist.
- Notes create or update `SupplierNote`. Creating a note also upserts a shortlist. The action does not insert a history row.
- Contact status, last contact, follow-up, person name, and method are columns on `Shortlist`.

Successful writes call `revalidatePath("/", "layout")` and `revalidatePath("/en", "layout")`.

### Comparison

Comparison membership is cookie `fs-compare` (`httpOnly: false`, limit 3). Optional match context is cookie `fs-match` (`httpOnly: true`). `GET /compare/export` builds a CSV. Note text is not a column. Product type is a column. The comparison page shows product-type badges on each product and does not render a product-type filter bar.

## Code that is not a page

`src/server/certificate-verification.ts` checks an administrator decision and returns the next record. No action writes that result. Match scoring stays in `src/server/matching.ts`.

## Validation and errors

- URL search parameters are parsed in `parseDiscoveryQuery`. Unknown enum values become the empty default.
- Server Actions that the UI calls return `{ ok, error }` with `invalid`, `missing`, `empty`, or `full`.
- Catalog loaders catch database failures, log the error, and throw `DataError`. Pages render `ErrorState`.

## Localization

Message types come from `messages/ru.json` via `src/i18n/global.ts`. Missing catalog facts display «Не указано». Demonstration records display «Демонстрационные данные».

## Complexity that remains

- `searchSuppliers` loads the full filtered supplier set so scores share one peer group, including when the page shows nine rows.
- Profile, compare, favorites, and CSV export call `getWorkspace()`, which loads every workspace note.
- `discovery-filters.tsx` and `matching.ts` are the largest modules.
