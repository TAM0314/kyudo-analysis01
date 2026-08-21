import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeHitRatePercent } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  const limit = Number(searchParams.get("limit") ?? "10");
  const typeFilter = searchParams.get("type"); // "PUBLIC" | "PRACTICE" | "SELECTION" | null

  if (!memberId) {
    return NextResponse.json({ error: "memberId?????" }, { status: 400 });
  }

  const entries = await prisma.entry.findMany({
    where: {
      memberId: Number(memberId),
      ...(typeFilter ? { round: { tournament: { type: typeFilter as "PUBLIC" | "PRACTICE" | "SELECTION" } } } : {}),
    },
    include: {
      shots: { orderBy: { arrowNumber: "asc" } },
      round: {
        include: { tournament: true },
      },
    },
    orderBy: {
      round: { tournament: { date: "desc" } },
    },
  });

  type TournamentGroup = {
    tournamentId: number;
    tournamentName: string;
    tournamentDate: Date;
    tournamentType: string;
    rounds: {
      roundId: number;
      roundNumber: number;
      label: string | null;
      hits: number;
      total: number;
      arrowResults: string[];
    }[];
  };

  const tournamentMap = new Map<number, TournamentGroup>();

  for (const entry of entries) {
    const t = entry.round.tournament;
    if (!tournamentMap.has(t.id)) {
      tournamentMap.set(t.id, {
        tournamentId: t.id,
        tournamentName: t.name,
        tournamentDate: t.date,
        tournamentType: t.type,
        rounds: [],
      });
    }
    const arrowResults = entry.shots.map((s) => s.result as string);
    const hits = entry.shots.filter((s) => s.result === "HIT").length;
    tournamentMap.get(t.id)!.rounds.push({
      roundId: entry.round.id,
      roundNumber: entry.round.roundNumber,
      label: entry.round.label,
      hits,
      total: entry.shots.length,
      arrowResults,
    });
  }

  const sorted = Array.from(tournamentMap.values())
    .sort(
      (a, b) =>
        new Date(b.tournamentDate).getTime() -
        new Date(a.tournamentDate).getTime()
    )
    .slice(0, limit);

  const chartData = sorted.reverse().map((t) => {
    const totalHits = t.rounds.reduce((sum, r) => sum + r.hits, 0);
    const totalShots = t.rounds.reduce((sum, r) => sum + r.total, 0);
    return {
      tournamentId: t.tournamentId,
      name: t.tournamentName,
      date: t.tournamentDate,
      type: t.tournamentType,
      hitRate: computeHitRatePercent(totalHits, totalShots),
      hits: totalHits,
      total: totalShots,
      rounds: t.rounds,
    };
  });

  const arrowStats = [1, 2, 3, 4].map((n) => {
    const all = entries.flatMap((e) =>
      e.shots.filter((s) => s.arrowNumber === n)
    );
    const hits = all.filter((s) => s.result === "HIT").length;
    return { arrowNumber: n, hits, total: all.length };
  });

  return NextResponse.json({ chartData, arrowStats });
}
