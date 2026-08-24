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

function checkDeleteAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_DELETE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "サーバー側に ADMIN_DELETE_SECRET が設定されていません" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token !== secret) {
    return NextResponse.json(
      { error: "削除パスワードが正しくありません" },
      { status: 401 }
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authError = checkDeleteAuth(req);
  if (authError) return authError;

  const body = await req.json();
  const { scope, ids, confirm } = body as {
    scope: "tournaments" | "members" | "match_data" | "all";
    ids?: number[];
    confirm?: string;
  };

  if (!scope) {
    return NextResponse.json(
      { error: "削除対象(scope)を指定してください" },
      { status: 400 }
    );
  }

  try {
    if (scope === "tournaments") {
      if (!ids || ids.length === 0) {
        return NextResponse.json(
          { error: "削除する大会を選択してください" },
          { status: 400 }
        );
      }
      const result = await prisma.tournament.deleteMany({
        where: { id: { in: ids.map(Number) } },
      });
      return NextResponse.json({
        ok: true,
        deleted: { tournaments: result.count },
        message: `${result.count}件の大会・試合を削除しました`,
      });
    }

    if (scope === "members") {
      if (!ids || ids.length === 0) {
        return NextResponse.json(
          { error: "削除する部員を選択してください" },
          { status: 400 }
        );
      }
      const memberIds = ids.map(Number);
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
        message: `${result.count}名の部員を削除しました`,
      });
    }

    if (scope === "match_data") {
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
        message: "大会・試合データを全て削除しました（部員は残しています）",
      });
    }

    if (scope === "all") {
      if (confirm !== "DELETE") {
        return NextResponse.json(
          { error: "全消去するには confirm に DELETE を指定してください" },
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
        message: "すべてのデータを消去しました",
      });
    }

    return NextResponse.json({ error: "不正な scope です" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
