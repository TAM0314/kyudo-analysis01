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
  await prisma.member.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
