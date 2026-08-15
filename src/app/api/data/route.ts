import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [memberCount, tournamentCount, roundCount, entryCount, shotCount] =
    await Promise.all([
      prisma.member.count(),
      prisma.tournament.count(),
      prisma.round.count(),
      prisma.entry.count(),
      prisma.shot.count(),
    ]);

  const tournaments = await prisma.tournament.findMany({
    orderBy: { date: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      date: true,
      _count: { select: { rounds: true } },
    },
  });

  const members = await prisma.member.findMany({
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      gender: true,
      grade: true,
      _count: { select: { entries: true } },
    },
  });

  return NextResponse.json({
    counts: {
      members: memberCount,
      tournaments: tournamentCount,
      rounds: roundCount,
      entries: entryCount,
      shots: shotCount,
    },
    tournaments,
    members,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { scope, ids, confirm } = body as {
    scope: "tournaments" | "members" | "match_data" | "all";
    ids?: number[];
    confirm?: string;
  };

  if (!scope) {
    return NextResponse.json(
      { error: "\u524a\u9664\u5bfe\u8c61(scope)\u3092\u6307\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044" },
      { status: 400 }
    );
  }

  try {
    if (scope === "tournaments") {
      if (!ids || ids.length === 0) {
        return NextResponse.json(
          { error: "\u524a\u9664\u3059\u308b\u5927\u4f1a\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044" },
          { status: 400 }
        );
      }
      const result = await prisma.tournament.deleteMany({
        where: { id: { in: ids.map(Number) } },
      });
      return NextResponse.json({
        ok: true,
        deleted: { tournaments: result.count },
        message: `${result.count}\u4ef6\u306e\u5927\u4f1a\u30fb\u8a66\u5408\u3092\u524a\u9664\u3057\u307e\u3057\u305f`,
      });
    }

    if (scope === "members") {
      if (!ids || ids.length === 0) {
        return NextResponse.json(
          { error: "\u524a\u9664\u3059\u308b\u90e8\u54e1\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044" },
          { status: 400 }
        );
      }
      const memberIds = ids.map(Number);
      // Entry has Restrict on member - delete entries (shots cascade) first
      const entries = await prisma.entry.findMany({
        where: { memberId: { in: memberIds } },
        select: { id: true },
      });
      const entryIds = entries.map((e) => e.id);
      if (entryIds.length > 0) {
        await prisma.shot.deleteMany({ where: { entryId: { in: entryIds } } });
        await prisma.entry.deleteMany({ where: { id: { in: entryIds } } });
      }
      const result = await prisma.member.deleteMany({
        where: { id: { in: memberIds } },
      });
      return NextResponse.json({
        ok: true,
        deleted: { members: result.count, entries: entryIds.length },
        message: `${result.count}\u540d\u306e\u90e8\u54e1\u3092\u524a\u9664\u3057\u307e\u3057\u305f`,
      });
    }

    if (scope === "match_data") {
      // Keep members, delete all match-related data
      const shots = await prisma.shot.deleteMany({});
      const entries = await prisma.entry.deleteMany({});
      const rounds = await prisma.round.deleteMany({});
      const tournaments = await prisma.tournament.deleteMany({});
      return NextResponse.json({
        ok: true,
        deleted: {
          shots: shots.count,
          entries: entries.count,
          rounds: rounds.count,
          tournaments: tournaments.count,
        },
        message:
          "\u5927\u4f1a\u30fb\u8a66\u5408\u30c7\u30fc\u30bf\u3092\u5168\u3066\u524a\u9664\u3057\u307e\u3057\u305f\uff08\u90e8\u54e1\u306f\u6b8b\u3057\u3066\u3044\u307e\u3059\uff09",
      });
    }

    if (scope === "all") {
      if (confirm !== "DELETE") {
        return NextResponse.json(
          {
            error:
              "\u5168\u6d88\u53bb\u3059\u308b\u306b\u306f confirm \u306b DELETE \u3092\u6307\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044",
          },
          { status: 400 }
        );
      }
      const shots = await prisma.shot.deleteMany({});
      const entries = await prisma.entry.deleteMany({});
      const rounds = await prisma.round.deleteMany({});
      const tournaments = await prisma.tournament.deleteMany({});
      const members = await prisma.member.deleteMany({});
      return NextResponse.json({
        ok: true,
        deleted: {
          shots: shots.count,
          entries: entries.count,
          rounds: rounds.count,
          tournaments: tournaments.count,
          members: members.count,
        },
        message:
          "\u3059\u3079\u3066\u306e\u30c7\u30fc\u30bf\u3092\u6d88\u53bb\u3057\u307e\u3057\u305f",
      });
    }

    return NextResponse.json(
      { error: "\u4e0d\u6b63\u306a scope \u3067\u3059" },
      { status: 400 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
