import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidTournamentType,
  parseValidDate,
  parsePositiveInt,
  isPrismaError,
  PRISMA_NOT_FOUND,
} from "@/lib/validate";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournamentId = parsePositiveInt(id);
  if (tournamentId === null) {
    return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          entries: {
            orderBy: { positionInRound: "asc" },
            include: {
              member: true,
              shots: { orderBy: { arrowNumber: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "大会が見つかりません" }, { status: 404 });
  }
  return NextResponse.json(tournament);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournamentId = parsePositiveInt(id);
  if (tournamentId === null) {
    return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
  }

  const body = await req.json();
  const { name, type, date, note } = body;

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "大会名が無効です" }, { status: 400 });
    }
    updateData.name = name.trim();
  }

  if (type !== undefined) {
    if (!isValidTournamentType(type)) {
      return NextResponse.json(
        {
          error:
            "種別は PUBLIC・PRACTICE・SELECTION のいずれかを指定してください",
        },
        { status: 400 }
      );
    }
    updateData.type = type;
  }

  if (date !== undefined) {
    const parsed = parseValidDate(date);
    if (!parsed) {
      return NextResponse.json(
        { error: "日付が無効です（例: 2024-04-01）" },
        { status: 400 }
      );
    }
    updateData.date = parsed;
  }

  if (note !== undefined) {
    updateData.note =
      note && typeof note === "string" ? note.trim() || null : null;
  }

  try {
    const tournament = await prisma.tournament.update({
      where: { id: tournamentId },
      data: updateData,
    });
    return NextResponse.json(tournament);
  } catch (e) {
    if (isPrismaError(e, PRISMA_NOT_FOUND)) {
      return NextResponse.json(
        { error: "大会が見つかりません" },
        { status: 404 }
      );
    }
    throw e;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournamentId = parsePositiveInt(id);
  if (tournamentId === null) {
    return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
  }

  try {
    await prisma.tournament.delete({ where: { id: tournamentId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isPrismaError(e, PRISMA_NOT_FOUND)) {
      return NextResponse.json(
        { error: "大会が見つかりません" },
        { status: 404 }
      );
    }
    throw e;
  }
}
