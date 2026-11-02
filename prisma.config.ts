import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations prefer a direct connection. Local setups can use one URL for both.
// The fallback exists so `prisma generate` can run before `.env` is created.
const url =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/foodsource";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
