import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TournamentType } from "@/generated/prisma/client";

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { date: "desc" },
    include: {
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: { entries: { include: { shots: true } } },
      },
    },
  });
  return NextResponse.json(tournaments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, type, date, note } = body;

  if (!name || !type || !date) {
    return NextResponse.json(
      { error: "\u5927\u4f1a\u540d\u30fb\u7a2e\u5225\u30fb\u65e5\u4ed8\u306f\u5fc5\u9808\u3067\u3059" },
      { status: 400 }
    );
  }

  const tournament = await prisma.tournament.create({
    data: {
      name,
      type: type as TournamentType,
      date: new Date(date),
      note: note ?? null,
    },
  });
  return NextResponse.json(tournament, { status: 201 });
}
