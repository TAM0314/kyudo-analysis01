import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidTournamentType,
  parseValidDate,
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
} from "@/lib/validate";
import { isDemoMode, demoResponse } from "@/lib/demo";

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
  if (isDemoMode()) return demoResponse();
  const body = await req.json();
  const { name, type, date, note } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "種別は PUBLIC・PRACTICE・SELECTION のいずれかを指定してください" },
      { status: 400 }
    );
  }

  const parsedDate = parseValidDate(date);
  if (!parsedDate) {
    return NextResponse.json(
      { error: "日付が無効です（例: 2024-04-01）" },
      { status: 400 }
    );
  }

  try {
    const tournament = await prisma.tournament.create({
      data: {
        name: name.trim(),
        type,
        date: parsedDate,
        note: note && typeof note === "string" ? note.trim() || null : null,
      },
    });
    return NextResponse.json(tournament, { status: 201 });
  } catch (e) {
    if (isPrismaError(e, PRISMA_UNIQUE_VIOLATION)) {
      return NextResponse.json(
        { error: "同じ大会が既に存在します" },
        { status: 409 }
      );
    }
    throw e;
  }
}
