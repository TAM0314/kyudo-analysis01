import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeHitRatePercent } from "@/lib/utils";
import { parsePositiveInt } from "@/lib/validate";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tournamentIdRaw = searchParams.get("tournamentId");

  const tournamentId = parsePositiveInt(tournamentIdRaw);
  if (tournamentId === null) {
    return NextResponse.json(
      { error: "tournamentId は必須です（1以上の整数）" },
      { status: 400 }
    );
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          entries: {
            orderBy: { positionInRound: "asc" },
            include: {
              member: true,
              shots: { orderBy: { arrowNumber: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "大会が見つかりません" }, { status: 404 });
  }

  const roundStats = tournament.rounds.map((round) => {
    const allShots = round.entries.flatMap((e) => e.shots);
    const hits = allShots.filter((s) => s.result === "HIT").length;
    const total = allShots.length;

    const memberResults = round.entries.map((entry) => ({
      memberNumber: entry.member.number,
      gender: entry.member.gender as string,
      grade: entry.member.grade,
      arrowResults: entry.shots.map((s) => s.result as string),
      hits: entry.shots.filter((s) => s.result === "HIT").length,
      total: entry.shots.length,
    }));

    return {
      roundId: round.id,
      roundNumber: round.roundNumber,
      label: round.label ?? `${round.roundNumber}立目`,
      hits,
      total,
      hitRate: computeHitRatePercent(hits, total),
      memberResults,
    };
  });

  const allEntries = tournament.rounds.flatMap((r) => r.entries);
  const arrowStats = [1, 2, 3, 4].map((n) => {
    const all = allEntries.flatMap((e) =>
      e.shots.filter((s) => s.arrowNumber === n)
    );
    const hits = all.filter((s) => s.result === "HIT").length;
    return {
      arrowNumber: n,
      hits,
      total: all.length,
      hitRate: computeHitRatePercent(hits, all.length),
    };
  });

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      type: tournament.type as string,
      date: tournament.date,
    },
    roundStats,
    arrowStats,
  });
}
