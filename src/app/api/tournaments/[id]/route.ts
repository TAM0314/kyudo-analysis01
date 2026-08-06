import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TournamentType } from "@/generated/prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: Number(id) },
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
  const body = await req.json();
  const { name, type, date, note } = body;

  const tournament = await prisma.tournament.update({
    where: { id: Number(id) },
    data: {
      name: name ?? undefined,
      type: type ? (type as TournamentType) : undefined,
      date: date ? new Date(date) : undefined,
      note: note !== undefined ? note : undefined,
    },
  });
  return NextResponse.json(tournament);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.tournament.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
