# Server Actions and routes

FoodSource does not expose a versioned REST or RPC API. The browser posts HTML forms to Server Actions. One Route Handler exports comparison CSV.

All workspace writes use the server-side constant `demoWorkspaceKey` (`demo-workspace`). Clients cannot choose a workspace.

## Search query string

`GET /suppliers` and the supplier profile read the same parser, `parseDiscoveryQuery` in `src/lib/discovery-query.ts`. Unknown values are dropped. Empty filters and the default sort `name` are omitted by `toSearchParams`. Page 1 is omitted.

| Parameter | Meaning |
| --- | --- |
| `q` | Text, max 200 characters. |
| `scope` | `all` (default), `name`, `product`, or `place`. |
| `category` | Category slug. |
| `city`, `region` | Exact strings. |
| `type` | Supplier type: `MANUFACTURER`, `DISTRIBUTOR`, `FARM`, `IMPORTER`, `PACKAGING`, `WHOLESALER`, `OTHER`. The filter UI lists those except `OTHER`. |
| `productType` | `INGREDIENTS`, `FINISHED_PRODUCTS`, `PACKAGING`, `OTHER_FOOD_RELATED_GOODS`. |
| `certificate` | `verified`, `valid`, `expiring`, `expired`, or `unverified`. |
| `certified` | `1`. Real suppliers whose effective certificate status is not expired, suspended, or revoked. This does not require `VERIFIED`. |
| `contact` | A `ContactStatus`. Missing shortlist counts as `NOT_CONTACTED`. |
| `freshness` | `fresh` (0–30 days), `aging` (31–90), `stale` (older), `unknown` (null, invalid, or future `updatedAt`). |
| `maxPrice`, `maxMoq` | Finite numbers ≥ 0. A comma is accepted as a decimal separator. |
| `sort` | `match`, `name`, `name-desc`, `price`, `price-desc`, `moq`, `moq-desc`, `updated`, `created`, `complete`, `relevance`. |
| `page` | Integer from 1 to 10000. Page size is 9. |

`verified` certificate filter requires `verificationStatus = VERIFIED` and `isDemo = false`. Validity filters use the effective status SQL, which keeps `SUSPENDED` and `REVOKED` and otherwise follows `expiresAt`. The expiring-soon window is 30 days (`certificateThresholds.expiringSoonDays`).

Product type, supplier type, and contact status do not by themselves enable the match-score breakdown. See [matching-score.md](matching-score.md).

## Route Handler

### `GET /compare/export`

File: `src/app/[locale]/compare/export/route.ts`. The locale prefix is never sent, so the public path is `/compare/export`. `assertLocale` accepts `ru` only.

- Reads cookies `fs-compare` and `fs-match`.
- `400` when the cookie has no slugs, or none of them resolve to active suppliers.
- `500` when catalog loading throws `DataError`.
- Success: `text/csv; charset=utf-8`, `Cache-Control: no-store`.
- Columns are `comparisonExportColumns` in `src/lib/comparison-export.ts`: name, supplier type, categories, products, product types, place, website, workspace contact-person name, public email and phone, price, currency, unit, MOQ, certifications, delivery text, score, contact status, freshness, updated time, source URL.
- Internal note text is not exported.

## Server Actions

File: `src/server/actions.ts`. These are the actions the UI imports.

### `toggleFavorite(previous, formData)`

- Input: `supplierId` (UUID).
- Creates a shortlist, or deletes that workspace’s notes and the shortlist.
- Result: `{ ok: true, saved }` or `{ ok: false, error: "invalid" | "missing" }`.

### `addToComparison(previous, formData)`

- Input: `slug`. Optional `rememberContext=1` plus search fields stores `fs-match` (`httpOnly`).
- Cookie `fs-compare` is `httpOnly: false`, limited to 3 slugs, `sameSite: lax`, path `/`, max age 180 days.
- Result: `{ ok: true, comparing }` or `{ ok: false, error: "full" | "invalid" | "missing" }`.

### `removeFromComparison(formData)`

- Input: `slug`. An invalid slug is ignored. The function returns `void`.

### `saveNote(previous, formData)`

- Input: `supplierId`, optional `noteId`, `content` trimmed to 1–2000 characters.
- Create upserts a shortlist and inserts `SupplierNote` in one transaction.
- Update requires the note id, `demo-workspace`, and the same supplier.
- Result: `{ ok: true }` or `{ ok: false, error: "invalid" | "empty" | "missing" }`.

### `deleteNote(formData)`

- Input: `noteId` (UUID). A missing or invalid id returns without an error object.
- Deletes a `demo-workspace` note with that id. The action does not also require `supplierId`.

### `updateContactStatus(previous, formData)`

- Input: `supplierId` and `status` (`ContactStatus`).
- `details=1` also reads `contactPerson` (max 120), `lastContactOn`, `nextFollowUpOn`, and `contactMethod`.
- The profile form `ContactTracking` sends `details=1`. The comparison status form does not, so it updates status only.
- Dates use `parseContactDate`. A last-contact date after today is `invalid`. An empty date clears the column when details are sent.
- Result: `{ ok: true }` or `{ ok: false, error: "invalid" | "missing" }`.
- The write is a shortlist upsert. It does not append a status or follow-up history row.

## Certificate verification function

`applyCertificateVerification` and `applyRecordedCertificateStatus` in `src/server/certificate-verification.ts` are not Server Actions.

- The actor argument must be `{ role: "administrator", name }` with a non-empty name.
- `VERIFIED` and `REJECTED` set `verifiedAt` and `verifiedBy`.
- `UNVERIFIED` and `PENDING` clear both.
- Notes are trimmed and rejected above 2000 characters.
- Nothing calls these functions from a page, and nothing writes the result.

## Reads used by pages

These are server functions, not HTTP endpoints.

| Function | Used by |
| --- | --- |
| `searchSuppliers` | `/suppliers` |
| `getSupplier`, `scoreSupplier`, `getWorkspace` | `/suppliers/[slug]` |
| `getCatalog`, `getWorkspace` | `/favorites` |
| `getSuppliersBySlugs`, `getWorkspace` | `/compare` and CSV export |
| `getDashboard` | `/dashboard`, including its product-type supplier counts |
| `getCategories`, `getProductTypeCounts` | `/` and `/categories` |
| `getSavedSupplierIds` | `/suppliers` favorite state |

`supplierInclude` loads products, public contacts, certifications, and sources. Notes come from `getWorkspace()`.
