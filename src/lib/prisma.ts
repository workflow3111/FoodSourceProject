import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env before querying the database.",
    );
  }
  // if (!caCert) {
  //   throw new Error("DATABASE_CA_CERT is missing");
  // }
  // const ca = process.env.PG_SSL_CA?.replace(/\\n/g, "\n");
  // const adapter = new PrismaPg({ connectionString });
  const adapter = new PrismaPg({connectionString});

  return new PrismaClient({ adapter });
}

export function getPrisma() {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}
