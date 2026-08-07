/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "";

  if (dbUrl.startsWith("postgres")) {
    try {
      const { neon } = require("@neondatabase/serverless");
      const { PrismaNeonHttp } = require("@prisma/adapter-neon");
      // channel_binding パラメータを除去（HTTP transport非対応）
      const cleanUrl = dbUrl
        .replace(/[?&]channel_binding=[^&]*/g, "")
        .replace(/\?&/, "?")
        .replace(/\?$/, "");
      const sql = neon(cleanUrl || dbUrl);
      const adapter = new PrismaNeonHttp(sql);
      return new PrismaClient({ adapter } as any);
    } catch (e) {
      console.error("[prisma] Neon client creation failed:", e);
      throw e;
    }
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
