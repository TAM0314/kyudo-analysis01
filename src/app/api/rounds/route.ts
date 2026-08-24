import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parsePositiveInt,
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
  PRISMA_NOT_FOUND,
} from "@/lib/validate";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tournamentId, roundNumber, label } = body;

  const tId = parsePositiveInt(tournamentId);
  if (tId === null) {
    return NextResponse.json(
      { error: "大会IDは1以上の整数で指定してください" },
      { status: 400 }
    );
  }

  const rNum = parsePositiveInt(roundNumber);
  if (rNum === null) {
    return NextResponse.json(
      { error: "試合番号は1以上の整数で指定してください" },
      { status: 400 }
    );
  }

  if (label !== undefined && label !== null && typeof label !== "string") {
    return NextResponse.json(
      { error: "ラベルは文字列で指定してください" },
      { status: 400 }
    );
  }

  try {
    const round = await prisma.round.create({
      data: {
        tournamentId: tId,
        roundNumber: rNum,
        label: typeof label === "string" ? label.trim() || null : null,
      },
    });
    return NextResponse.json(round, { status: 201 });
  } catch (e) {
    if (isPrismaError(e, PRISMA_NOT_FOUND)) {
      return NextResponse.json(
        { error: "指定した大会が見つかりません" },
        { status: 404 }
      );
    }
    if (isPrismaError(e, PRISMA_UNIQUE_VIOLATION)) {
      return NextResponse.json(
        { error: `試合番号 ${rNum} は既に登録されています` },
        { status: 409 }
      );
    }
    throw e;
  }
}
