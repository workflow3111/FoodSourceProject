# Future improvements

These items are not in the current delivery. Do not treat them as implemented.

## Product

- Authentication and a real user or organization tenant instead of `demo-workspace`
- Per-user shortlists and notes that a second buyer cannot read
- Soft-delete or archive for favorites so notes are not destroyed
- A persisted certificate review. `applyCertificateVerification` returns a record and does not write it. There is no administrator screen.
- Upcoming and overdue follow-ups as their own list. The profile only flags an overdue date already stored on the shortlist.
- Settings that persist. `/settings` is a static section.
- Serve English by adding `en` to `src/i18n/routing.ts` and removing the `/en` redirect, or drop `messages/en.json` if English will not ship
- Remove the extra `revalidatePath("/en", "layout")` in `src/server/actions.ts`
- A hosted demo environment and a real `NEXT_PUBLIC_APP_URL`

## Technical debt

- Stop loading every workspace note on profile, compare, and CSV export. Search already uses `getSavedSupplierIds`.
- `searchSuppliers` loads every filtered supplier to compute match peers even when the page shows nine rows and no score is shown. Load the page first when `hasRankingContext` is false and sort is not `match`.
- `discovery-filters.tsx` and `matching.ts` are large. Split them when a change needs it.
- Add a CI workflow that runs `typecheck`, `lint`, the unit tests, and `build`
- Write the effective certificate status back only if a later design wants the column to match the badge. Today the column is the recorded status and the read path recalculates.

## Scalability

The current catalog is 26 suppliers and 64 products. The following will matter after the catalog grows:

- Trigram or full-text indexes for name and product search. `LIKE` plus `translate` cannot use a btree on `name` efficiently.
- Avoid scoring the full filtered set on every ranked request, or keep scoring a bounded peer group
- Facets are global and cheap at this size. They will need cached or incremental counts later.
- Do not add Redis or an application cache until a measured page is slow

## Quality

- Playwright or equivalent for the status form, note delete, follow-up, and double-submit
- Viewport checks for the search filter grid, the product-type cards, and the profile
- A database assertion that the certificate filter SQL matches `resolveCertificateStatus`, including suspended and revoked rows
