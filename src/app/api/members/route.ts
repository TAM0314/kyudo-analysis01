import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidGender,
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
  parsePositiveInt,
} from "@/lib/validate";

export async function GET() {
  const members = await prisma.member.findMany({
    orderBy: { number: "asc" },
  });
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { number, gender, grade } = body;

  const memberNumber = parsePositiveInt(number);
  if (memberNumber === null) {
    return NextResponse.json(
      { error: "番号は1以上の整数で入力してください" },
      { status: 400 }
    );
  }

  if (!isValidGender(gender)) {
    return NextResponse.json(
      { error: `性別は MALE または FEMALE を指定してください` },
      { status: 400 }
    );
  }

  let gradeValue: number | null = null;
  if (grade !== undefined && grade !== null && grade !== "") {
    gradeValue = parsePositiveInt(grade);
    if (gradeValue === null || gradeValue > 6) {
      return NextResponse.json(
        { error: "学年は1〜6の整数で入力してください" },
        { status: 400 }
      );
    }
  }

  try {
    const member = await prisma.member.create({
      data: {
        number: memberNumber,
        gender,
        grade: gradeValue,
      },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (e) {
    if (isPrismaError(e, PRISMA_UNIQUE_VIOLATION)) {
      return NextResponse.json(
        { error: `番号 ${memberNumber} の部員は既に存在します` },
        { status: 409 }
      );
    }
    throw e;
  }
}
