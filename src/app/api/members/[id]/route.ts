import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidGender,
  isPrismaError,
  PRISMA_NOT_FOUND,
  PRISMA_UNIQUE_VIOLATION,
  parsePositiveInt,
} from "@/lib/validate";
import { isDemoMode, demoResponse } from "@/lib/demo";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isDemoMode()) return demoResponse();
  const { id } = await params;
  const memberId = parsePositiveInt(id);
  if (memberId === null) {
    return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
  }

  const body = await req.json();
  const { number, gender, grade } = body;

  const updateData: Record<string, unknown> = {};

  if (number !== undefined) {
    const n = parsePositiveInt(number);
    if (n === null) {
      return NextResponse.json(
        { error: "番号は1以上の整数で入力してください" },
        { status: 400 }
      );
    }
    updateData.number = n;
  }

  if (gender !== undefined) {
    if (!isValidGender(gender)) {
      return NextResponse.json(
        { error: "性別は MALE または FEMALE を指定してください" },
        { status: 400 }
      );
    }
    updateData.gender = gender;
  }

  if (grade !== undefined) {
    if (grade === null || grade === "") {
      updateData.grade = null;
    } else {
      const g = parsePositiveInt(grade);
      if (g === null || g > 6) {
        return NextResponse.json(
          { error: "学年は1〜6の整数で入力してください" },
          { status: 400 }
        );
      }
      updateData.grade = g;
    }
  }

  try {
    const member = await prisma.member.update({
      where: { id: memberId },
      data: updateData,
    });
    return NextResponse.json(member);
  } catch (e) {
    if (isPrismaError(e, PRISMA_NOT_FOUND)) {
      return NextResponse.json(
        { error: "部員が見つかりません" },
        { status: 404 }
      );
    }
    if (isPrismaError(e, PRISMA_UNIQUE_VIOLATION)) {
      return NextResponse.json(
        { error: `その番号の部員は既に存在します` },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isDemoMode()) return demoResponse();
  const { id } = await params;
  const memberId = parsePositiveInt(id);
  if (memberId === null) {
    return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
  }

  try {
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
  } catch (e) {
    if (isPrismaError(e, PRISMA_NOT_FOUND)) {
      return NextResponse.json(
        { error: "部員が見つかりません" },
        { status: 404 }
      );
    }
    throw e;
  }
}
