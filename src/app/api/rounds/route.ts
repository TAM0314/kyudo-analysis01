import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tournamentId, roundNumber, label } = body;

  if (!tournamentId || !roundNumber) {
    return NextResponse.json(
      { error: "??ID??????????" },
      { status: 400 }
    );
  }

  const round = await prisma.round.create({
    data: {
      tournamentId: Number(tournamentId),
      roundNumber: Number(roundNumber),
      label: label ?? null,
    },
  });
  return NextResponse.json(round, { status: 201 });
}
