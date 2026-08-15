import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Gender } from "@/generated/prisma/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { number, gender, grade } = body;

  const member = await prisma.member.update({
    where: { id: Number(id) },
    data: {
      number: number ? Number(number) : undefined,
      gender: gender ? (gender as Gender) : undefined,
      grade: grade !== undefined ? (grade ? Number(grade) : null) : undefined,
    },
  });
  return NextResponse.json(member);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memberId = Number(id);

  const entries = await prisma.entry.findMany({
    where: { memberId },
    select: { id: true },
  });
  const entryIds = entries.map((e) => e.id);
  if (entryIds.length > 0) {
    await prisma.shot.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.entry.deleteMany({ where: { id: { in: entryIds } } });
  }

  await prisma.member.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
