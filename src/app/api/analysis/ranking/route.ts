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
    where: typeFilter
      ? {
          round: {
            tournament: { type: typeFilter },
          },
        }
      : undefined,
    include: {
      member: true,
      shots: true,
      round: {
        include: { tournament: { select: { id: true, type: true } } },
      },
    },
  });

  type MemberAccumulator = {
    memberNumber: number;
    grade: number | null;
    gender: string;
    regHits: number;
    regTotal: number;
    selectionRates: number[];
    regTournamentIds: Set<number>;
    selTournamentIds: Set<number>;
    processedSelectionTournaments: Set<number>;
  };

  const map = new Map<number, MemberAccumulator>();

  for (const entry of entries) {
    const num = entry.member.number;
    if (num === 9999) continue;
    if (!map.has(num)) {
      map.set(num, {
        memberNumber: num,
        grade: entry.member.grade,
        gender: entry.member.gender,
        regHits: 0,
        regTotal: 0,
        selectionRates: [],
        regTournamentIds: new Set(),
        selTournamentIds: new Set(),
        processedSelectionTournaments: new Set(),
      });
    }
    const acc = map.get(num)!;
    const t = entry.round.tournament;
    const isSelection = t.type === "SELECTION" || entry.overallHitRate != null;

    if (isSelection) {
      if (entry.overallHitRate != null && !acc.processedSelectionTournaments.has(t.id)) {
        acc.processedSelectionTournaments.add(t.id);
        acc.selectionRates.push(entry.overallHitRate);
        acc.selTournamentIds.add(t.id);
      }
    } else {
      const hits = entry.shots.filter((s) => s.result === "HIT").length;
      const total = entry.shots.length;
      acc.regHits += hits;
      acc.regTotal += total;
      acc.regTournamentIds.add(t.id);
    }
  }

  const toRanking = (gender: string): RankingMember[] => {
    const list: RankingMember[] = [];

    for (const acc of map.values()) {
      if (acc.gender !== gender) continue;

      let hits = 0;
      let total = 0;
      let hitRate = 0;
      let tournamentCount = 0;
      let qualifies = false;

      const regRate = acc.regTotal > 0 ? (acc.regHits / acc.regTotal) * 100 : null;
      const selRate = acc.selectionRates.length > 0
        ? (acc.selectionRates.reduce((a, b) => a + b, 0) / acc.selectionRates.length) * 100
        : null;

      if (typeParam === "SELECTION") {
        if (acc.selectionRates.length === 0) continue;
        hits = 0;
        total = 0;
        hitRate = selRate ?? 0;
        tournamentCount = acc.selTournamentIds.size;
        qualifies = tournamentCount > 0;
      } else if (typeParam === "PUBLIC" || typeParam === "PRACTICE") {
        if (acc.regTotal < minShots) continue;
        // Check if regTournamentIds include typeFilter
        // To be strict, let's verify if reg tournaments match typeFilter if typeFilter is specified.
        // Actually, if entries were fetched or filtered by typeFilter:
        // Let's filter entries by typeFilter if typeFilter is set.
        hits = acc.regHits;
        total = acc.regTotal;
        hitRate = regRate ?? 0;
        tournamentCount = acc.regTournamentIds.size;
        qualifies = total >= minShots;
      } else {
        // "ALL"
        if (acc.regTotal < minShots && acc.selectionRates.length === 0) continue;
        if (acc.regTotal > 0 && acc.regTotal < minShots) continue;

        hits = acc.regHits;
        total = acc.regTotal;

        if (regRate !== null && selRate !== null) {
          hitRate = (regRate + selRate) / 2;
        } else if (regRate !== null) {
          hitRate = regRate;
        } else if (selRate !== null) {
          hitRate = selRate;
        } else {
          hitRate = 0;
        }

        tournamentCount = acc.regTournamentIds.size + acc.selTournamentIds.size;
        qualifies = acc.regTotal >= minShots || (acc.regTotal === 0 && acc.selectionRates.length > 0);
      }

      if (!qualifies) continue;

      list.push({
        memberNumber: acc.memberNumber,
        grade: acc.grade,
        hits,
        total,
        hitRate,
        tournamentCount,
      });
    }

    return list;
  };

  return NextResponse.json({
    male: toRanking("MALE"),
    female: toRanking("FEMALE"),
    minShots,
    type: typeParam,
  } satisfies RankingResponse);
}
