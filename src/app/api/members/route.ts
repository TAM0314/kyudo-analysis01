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
      { error: "\u756a\u53f7\u3068\u6027\u5225\u306f\u5fc5\u9808\u3067\u3059" },
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
