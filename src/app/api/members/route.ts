import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Gender } from "@/generated/prisma/client";

export async function GET() {
  const members = await prisma.member.findMany({
    orderBy: { number: "asc" },
  });
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { number, gender, grade } = body;

  if (!number || !gender) {
    return NextResponse.json(
      { error: "????????????" },
      { status: 400 }
    );
  }

  const member = await prisma.member.create({
    data: {
      number: Number(number),
      gender: gender as Gender,
      grade: grade ? Number(grade) : null,
    },
  });
  return NextResponse.json(member, { status: 201 });
}
