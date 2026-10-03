import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeHitRatePercent } from "@/lib/utils";
import { parsePositiveInt } from "@/lib/validate";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const memberIdRaw = searchParams.get("memberId");
  const limitRaw = searchParams.get("limit");

  const memberId = parsePositiveInt(memberIdRaw);
  if (memberId === null) {
    return NextResponse.json(
      { error: "memberId は必須です（1以上の整数）" },
      { status: 400 }
    );
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member || member.number === 9999) {
    return NextResponse.json({ error: "無効な部員です" }, { status: 400 });
  }

  const limit = limitRaw ? (parsePositiveInt(limitRaw) ?? 10) : 10;

  const entries = await prisma.entry.findMany({
    where: { memberId },
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

  const entriesByTournament = new Map<number, typeof entries>();
  for (const entry of entries) {
    const tId = entry.round.tournament.id;
    if (!entriesByTournament.has(tId)) {
      entriesByTournament.set(tId, []);
    }
    entriesByTournament.get(tId)!.push(entry);
  }

  const tournamentMap = new Map<number, TournamentGroup>();

  for (const [tId, tEntries] of entriesByTournament.entries()) {
    const t = tEntries[0].round.tournament;
    const roundCount = tEntries.length;

    const rounds = tEntries.map((entry, idx) => {
      const arrowResults = entry.shots.map((s) => s.result as string);
      let hits: number;
      let total: number;

      if (entry.overallHitRate != null) {
        total = Math.round(1000 / roundCount);
        if (idx === roundCount - 1) {
          const previousTotalSum = Math.round(1000 / roundCount) * (roundCount - 1);
          total = 1000 - previousTotalSum;
        }
        hits = Math.round(total * entry.overallHitRate);
      } else {
        hits = entry.shots.filter((s) => s.result === "HIT").length;
        total = entry.shots.length;
      }

      return {
        roundId: entry.round.id,
        roundNumber: entry.round.roundNumber,
        label: entry.round.label,
        hits,
        total,
        arrowResults,
      };
    });

    tournamentMap.set(tId, {
      tournamentId: t.id,
      tournamentName: t.name,
      tournamentDate: t.date,
      tournamentType: t.type,
      rounds,
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
