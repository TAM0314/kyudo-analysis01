import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidTournamentType, parsePositiveInt } from "@/lib/validate";
import { computeHitRatePercent } from "@/lib/utils";

export interface RankingMember {
  memberNumber: number;
  grade: number | null;
  hits: number;
  total: number;
  hitRate: number;
  tournamentCount: number;
}

export interface RankingResponse {
  male: RankingMember[];
  female: RankingMember[];
  minShots: number;
  type: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type") ?? "ALL";
  const minShotsParam = searchParams.get("minShots") ?? "8";

  const minShots = parsePositiveInt(minShotsParam) ?? 8;

  const typeFilter =
    typeParam !== "ALL" && isValidTournamentType(typeParam)
      ? typeParam
      : undefined;

  const entries = await prisma.entry.findMany({
    where: {
      round: {
        tournament: typeFilter ? { type: typeFilter } : undefined,
      },
    },
    include: {
      member: true,
      shots: true,
      round: {
        include: { tournament: { select: { id: true, type: true } } },
      },
    },
  });

  type MemberStats = {
    memberNumber: number;
    grade: number | null;
    gender: string;
    hits: number;
    total: number;
    tournamentIds: Set<number>;
  };

  const statsMap = new Map<number, MemberStats>();

  for (const entry of entries) {
    const num = entry.member.number;
    if (!statsMap.has(num)) {
      statsMap.set(num, {
        memberNumber: num,
        grade: entry.member.grade,
        gender: entry.member.gender,
        hits: 0,
        total: 0,
        tournamentIds: new Set(),
      });
    }
    const stat = statsMap.get(num)!;
    const hits = entry.shots.filter((s) => s.result === "HIT").length;
    stat.hits += hits;
    stat.total += entry.shots.length;
    stat.tournamentIds.add(entry.round.tournament.id);
  }

  const toRanking = (gender: string): RankingMember[] =>
    Array.from(statsMap.values())
      .filter((s) => s.gender === gender && s.total >= minShots)
      .map((s) => ({
        memberNumber: s.memberNumber,
        grade: s.grade,
        hits: s.hits,
        total: s.total,
        hitRate: computeHitRatePercent(s.hits, s.total),
        tournamentCount: s.tournamentIds.size,
      }));

  return NextResponse.json({
    male: toRanking("MALE"),
    female: toRanking("FEMALE"),
    minShots,
    type: typeParam,
  } satisfies RankingResponse);
}
