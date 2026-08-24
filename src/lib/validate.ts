import type { Gender, ShotResult, TournamentType } from "@/generated/prisma/client";

export const VALID_TOURNAMENT_TYPES: TournamentType[] = [
  "PUBLIC",
  "PRACTICE",
  "SELECTION",
];
export const VALID_GENDERS: Gender[] = ["MALE", "FEMALE"];
export const VALID_SHOT_RESULTS: ShotResult[] = ["HIT", "MISS", "SHITSU"];

export function isValidTournamentType(v: unknown): v is TournamentType {
  return typeof v === "string" && (VALID_TOURNAMENT_TYPES as string[]).includes(v);
}

export function isValidGender(v: unknown): v is Gender {
  return typeof v === "string" && (VALID_GENDERS as string[]).includes(v);
}

export function isValidShotResult(v: unknown): v is ShotResult {
  return typeof v === "string" && (VALID_SHOT_RESULTS as string[]).includes(v);
}

/** 文字列/数値を正の整数に変換。変換不可な場合は null を返す */
export function parsePositiveInt(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** 日付文字列を Date に変換。無効な場合は null を返す */
export function parseValidDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Prisma の一意制約エラーコード */
export const PRISMA_UNIQUE_VIOLATION = "P2002";
/** Prisma のレコード未存在エラーコード */
export const PRISMA_NOT_FOUND = "P2025";

export function isPrismaError(e: unknown, code: string): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === code
  );
}
