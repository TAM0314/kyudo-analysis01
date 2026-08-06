/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient(): PrismaClient {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres")) {
    const { neonConfig, Pool } = require("@neondatabase/serverless");
    const { PrismaNeon } = require("@prisma/adapter-neon");
    neonConfig.webSocketConstructor = require("ws");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter } as any);
  } else {
    const path = require("path");
    const Database = require("better-sqlite3");
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    const dbPath = path.resolve(process.cwd(), "prisma/dev.db");
    const db = new Database(dbPath);
    const adapter = new PrismaBetterSqlite3(db);
    return new PrismaClient({ adapter } as any);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
