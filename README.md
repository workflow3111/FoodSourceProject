# FoodSource

B2B food supplier discovery for restaurants and procurement teams. This repository currently contains the application foundation: Next.js, a landing-page shell, Russian and English, and the PostgreSQL schema.

The catalog, supplier profiles, comparison, and favorites read from PostgreSQL. Run `npm run db:seed` after migrating. The seed is idempotent: it loads cited Russian suppliers and clearly labeled demonstration records.

## Stack

- Next.js App Router, React, TypeScript strict
- Tailwind CSS and shadcn/ui
- PostgreSQL and Prisma 7
- Zod
- next-intl (`ru` default, `en` at `/en`)

## Setup

Requirements: Node.js 22 and a local PostgreSQL database.

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for Russian and [http://localhost:3000/en](http://localhost:3000/en) for English.

`DATABASE_URL` is the runtime connection used by the app. `DIRECT_URL` is the direct connection used by Prisma migrations. On a local database they can be the same. Hosted Postgres often needs `?sslmode=require`.

## Checks

```bash
npm run typecheck
npm run lint
npx prisma validate
```

## Data

The schema is in `prisma/schema.prisma`. Prices are decimals with an explicit currency. Shortlists and notes are scoped by `workspaceKey` (`demo-workspace`) so authentication can be added later without modeling a login flow now.

`dataType` marks whether a row is a cited record (`REAL`) or fabricated demonstration data (`DEMO`). Real contacts, prices, minimum orders, certificates, and delivery notes are stored only when a source URL supports them. Missing values stay null. `npm run db:seed` can be run more than once.
