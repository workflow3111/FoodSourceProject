# Database design

Reads and writes from the running UI follow `prisma/schema.prisma`. The generated client output is `src/generated/prisma`.

Reviewed against `prisma/schema.prisma`, `prisma/migrations`, and the local `foodsource` database on 2 November 2026.

## Catalog

| Model | Role |
| --- | --- |
| `Supplier` | Company. Unique `slug`. `dataType` is `REAL` or `DEMO`. `verificationStatus` is the supplier record check (`VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`, `EXPIRED`). `isActive` hides a row from reads. `logoUrl` is optional. |
| `Category` | Product group. Unique `slug` and `nameRu`. Independent of `ProductType`. |
| `SupplierProduct` | One product. Requires `categoryId` and exactly one `ProductType`. Price, MOQ, and `imageUrl` are optional. |
| `SupplierContact` | Published channel (`PHONE`, `EMAIL`, `WEBSITE_FORM`, `WEBSITE`, `OTHER`). This is not a buyer CRM person. |
| `Certification` | Certificate claim. See the status rules below. |
| `SupplierSource` | Evidence URL. Unique per supplier and URL. `checkedAt` is the source review time. |

`ProductType` is `INGREDIENTS`, `FINISHED_PRODUCTS`, `PACKAGING`, or `OTHER_FOOD_RELATED_GOODS`.

## Certification columns

| Column | Role |
| --- | --- |
| `certificateStatus` | Recorded validity. Default `UNKNOWN`. `SUSPENDED` and `REVOKED` are authoritative. `VALID`, `EXPIRING_SOON`, `EXPIRED`, and `UNKNOWN` are recalculated from `expiresAt` on read. |
| `verificationStatus` | Separate check: `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED`. Default `UNVERIFIED`. |
| `certificateNumber`, `verifiedAt`, `verifiedBy` | Optional. Demo seed leaves the number and the verification stamp empty. |
| `verificationNotes` | Present since the initial migration. |
| `isDemo` | `true` when the supplier is demonstration data. |

A date never writes `VERIFIED`. Confirmed evidence, for the match score and the verified count, is `verificationStatus = VERIFIED` and an effective status of `VALID` or `EXPIRING_SOON`, and the row is not demonstration data.

## Workspace tables

There is no user table. The tenant string is `workspaceKey`, default `demo-workspace`.

| Model | Role |
| --- | --- |
| `Shortlist` | One row per workspace and supplier. Status, `lastContactOn`, `nextFollowUpOn`, `contactPerson` (a name string), and `contactMethod`. |
| `SupplierNote` | Private note text for one workspace and supplier. |

A missing shortlist is treated as `NOT_CONTACTED` by search and by the profile form.

`ContactStatus` is `NOT_CONTACTED`, `CONTACTED`, `AWAITING_RESPONSE`, `RESPONDED`, `NEGOTIATING`, `QUALIFIED`, `REJECTED`.

`ContactMethod` is `EMAIL`, `PHONE`, `WEBSITE`, `OTHER`.

## Relationships

```
Supplier 1—* SupplierProduct *—1 Category
Supplier 1—* SupplierContact
Supplier 1—* Certification
Supplier 1—* SupplierSource
Supplier 1—* Shortlist
Supplier 1—* SupplierNote
```

Catalog children cascade when a supplier is deleted. A category cannot be deleted while products reference it (`onDelete: Restrict`).

## Constraints

| Constraint | Where |
| --- | --- |
| Unique slug | `Supplier.slug` |
| Unique category slug and Russian name | `Category` |
| Unique source URL per supplier | `SupplierSource (supplierId, url)` |
| One shortlist per workspace and supplier | `Shortlist (workspaceKey, supplierId)` |

`Shortlist` also indexes `(workspaceKey, nextFollowUpOn)`. That index was created by `20261102220000_contact_integrity` and is declared on the model.

## Indexes declared in the schema

- `Supplier`: `name`; `city, region`; `isActive, city`; `isActive, region`; `dataType, verificationStatus`; `supplierType`
- `SupplierProduct`: `supplierId`; `categoryId`; `name`; `estimatedPrice`; `minimumOrderQuantity`; `dataType`; `productType`; `supplierId, productType`
- `Shortlist`: `workspaceKey, contactStatus`; `workspaceKey, nextFollowUpOn`
- `SupplierNote`: `workspaceKey, supplierId`
- `Certification`: `(supplierId, certificateStatus)`; `(supplierId, verificationStatus)`; `expiresAt`; `isDemo`
- `SupplierContact`: `(supplierId, type)`
- `SupplierSource`: `(supplierId, sourceType)` plus the unique URL

Text search folds `ё` to `е` with `translate(lower(...))` and `LIKE`. It is not a trigram or full-text index.

## Migrations

| Folder | What it does |
| --- | --- |
| `20261031120000_init` | Catalog, shortlist, notes. Old certificate `status` was `VERIFIED`, `UNVERIFIED`, or `EXPIRED`. |
| `20261031160000_search_indexes` | Search indexes. |
| `20261101133000_contact_tracking` | Seven contact statuses. Adds last contact, follow-up, person name, and method on `Shortlist`. |
| `20261101150000_demo_images` | `Supplier.logoUrl`, `SupplierProduct.imageUrl`. Logos and product photos are these columns, not a media table. |
| `20261102120000_certificate_status` | Splits validity from verification. Copies old `EXPIRED`. Leaves every other row `UNKNOWN` and `UNVERIFIED`. Sets `isDemo` from the supplier. |
| `20261102180000_product_type` | Required `productType`, backfilled by exact product name. Fails if any row stays null. |
| `20261102193000_contact_management` | Created `SupplierContactPerson` and `ContactActivity`. Dropped by `20261102230000_drop_unused_records`. |
| `20261102220000_contact_integrity` | Follow-up index on `Shortlist`. The same-supplier trigger was dropped with the activity table. |
| `20261102230000_drop_unused_records` | Drops `ContactActivity`, `SupplierContactPerson`, `MediaAsset`, and their enums and trigger function. |

PostgreSQL 14 cannot `DROP` an enum value. The contact-status migration replaces the enum type instead.

## Transactions the UI actually uses

`toggleFavorite`, `saveNote`, and `updateContactStatus` in `src/server/actions.ts` write `Shortlist` and `SupplierNote` only.

- Removing a favorite deletes notes and the shortlist.
- Creating a note upserts a shortlist and inserts `SupplierNote` in one `$transaction`.
- Updating a note replaces that note’s text.
- `updateContactStatus` upserts the shortlist. An unchanged status still overwrites the row when the form is submitted.

There is no activity-history table. The person name on a shortlist is a string, not a separate contact-person row.

## Seed and the local catalog

`npm run db:seed` upserts catalog rows from `prisma/seed.ts` (compiled by `prisma/seed.mjs`) plus `prisma/real-suppliers.mjs`. A full seed rewrites `updatedAt`, which changes freshness. Do not run it only to refresh CRM rows.

The local database on 2 November 2026:

| Slice | Count |
| --- | --- |
| Active suppliers | 26 (8 `REAL`, 18 `DEMO`) |
| Products | 64, every row classified |
| Demo products | Ingredients 26, finished 9, packaging 2, other 0 |
| Real products | Ingredients 15, finished 9, packaging 2, other 1 (`Корма`) |
| Certificates | 13 demo, all `isDemo` and `UNVERIFIED`; 3 real, recorded `UNKNOWN` and `UNVERIFIED` |
| Verified certificate stamps | 0 |

Demo certificate recorded statuses: valid 3, expiring soon 3, expired 2, unknown 3, suspended 1, revoked 1. Real certificate text is a website claim for Miratorg and Ochakovo. Numbers, issue dates, and document files were not invented.

`20261102100000_media_asset` was applied on this database without a `migration.sql` in the repository. That history row was removed after `MediaAsset` was dropped, so `prisma migrate status` no longer looks for the missing folder. A fresh database never creates that table.
