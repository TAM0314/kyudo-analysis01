import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ShotResult } from "@/generated/prisma/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { roundId, memberId, positionInRound, shots } = body;

  if (!roundId || !memberId || !positionInRound) {
    return NextResponse.json(
      { error: "??ID???ID???????????" },
      { status: 400 }
    );
  }

  const entry = await prisma.entry.upsert({
    where: {
      roundId_memberId: {
        roundId: Number(roundId),
        memberId: Number(memberId),
      },
    },
    update: { positionInRound: Number(positionInRound) },
    create: {
      roundId: Number(roundId),
      memberId: Number(memberId),
      positionInRound: Number(positionInRound),
    },
  });

  if (shots && Array.isArray(shots)) {
    for (const shot of shots) {
      await prisma.shot.upsert({
        where: {
          entryId_arrowNumber: {
            entryId: entry.id,
            arrowNumber: Number(shot.arrowNumber),
          },
        },
        update: { result: shot.result as ShotResult },
        create: {
          entryId: entry.id,
          arrowNumber: Number(shot.arrowNumber),
          result: shot.result as ShotResult,
        },
      });
    }
  }

  const fullEntry = await prisma.entry.findUnique({
    where: { id: entry.id },
    include: {
      member: true,
      shots: { orderBy: { arrowNumber: "asc" } },
    },
  });

  return NextResponse.json(fullEntry, { status: 201 });
}
