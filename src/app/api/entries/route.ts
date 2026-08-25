import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parsePositiveInt,
  isValidShotResult,
  isPrismaError,
  PRISMA_NOT_FOUND,
  PRISMA_UNIQUE_VIOLATION,
} from "@/lib/validate";
import { isDemoMode, demoResponse } from "@/lib/demo";

export async function POST(req: NextRequest) {
  if (isDemoMode()) return demoResponse();
  const body = await req.json();
  const { roundId, memberId, positionInRound, shots } = body;

  const rId = parsePositiveInt(roundId);
  if (rId === null) {
    return NextResponse.json(
      { error: "試合IDは1以上の整数で指定してください" },
      { status: 400 }
    );
  }

  const mId = parsePositiveInt(memberId);
  if (mId === null) {
    return NextResponse.json(
      { error: "部員IDは1以上の整数で指定してください" },
      { status: 400 }
    );
  }

  const position = parsePositiveInt(positionInRound);
  if (position === null) {
    return NextResponse.json(
      { error: "射順は1以上の整数で指定してください" },
      { status: 400 }
    );
  }

  if (shots !== undefined && !Array.isArray(shots)) {
    return NextResponse.json(
      { error: "shots は配列で指定してください" },
      { status: 400 }
    );
  }

  if (Array.isArray(shots)) {
    for (const shot of shots) {
      const arrowNum = parsePositiveInt(shot?.arrowNumber);
      if (arrowNum === null || arrowNum > 4) {
        return NextResponse.json(
          { error: "arrowNumber は1〜4の整数で指定してください" },
          { status: 400 }
        );
      }
      if (!isValidShotResult(shot?.result)) {
        return NextResponse.json(
          { error: `result は HIT・MISS・SHITSU のいずれかを指定してください（受け取った値: ${shot?.result}）` },
          { status: 400 }
        );
      }
    }
  }

  try {
    const entry = await prisma.entry.upsert({
      where: {
        roundId_memberId: {
          roundId: rId,
          memberId: mId,
        },
      },
      update: { positionInRound: position },
      create: {
        roundId: rId,
        memberId: mId,
        positionInRound: position,
      },
    });

    if (Array.isArray(shots)) {
      for (const shot of shots) {
        await prisma.shot.upsert({
          where: {
            entryId_arrowNumber: {
              entryId: entry.id,
              arrowNumber: Number(shot.arrowNumber),
            },
          },
          update: { result: shot.result },
          create: {
            entryId: entry.id,
            arrowNumber: Number(shot.arrowNumber),
            result: shot.result,
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
  } catch (e) {
    if (isPrismaError(e, PRISMA_NOT_FOUND)) {
      return NextResponse.json(
        { error: "指定した試合または部員が見つかりません" },
        { status: 404 }
      );
    }
    if (isPrismaError(e, PRISMA_UNIQUE_VIOLATION)) {
      return NextResponse.json(
        { error: "その射順は既に別の部員に割り当てられています" },
        { status: 409 }
      );
    }
    throw e;
  }
}
