import { PrismaClient } from "@/generated/prisma/client";

// ローカル開発: better-sqlite3
// 本番(Vercel): Neon PostgreSQL
// 環境変数 DATABASE_URL の有無で自動切り替え

function createPrismaClient(): PrismaClient {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres")) {
    // Vercel / Neon 環境
    const { neonConfig, Pool } = require("@neondatabase/serverless");
    const { PrismaNeon } = require("@prisma/adapter-neon");
    neonConfig.webSocketConstructor = require("ws");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0]);
  } else {
    // ローカル SQLite 環境
    const path = require("path");
    const Database = require("better-sqlite3");
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    const dbPath = path.resolve(process.cwd(), "prisma/dev.db");
    const db = new Database(dbPath);
    const adapter = new PrismaBetterSqlite3(db);
    return new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0]);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
