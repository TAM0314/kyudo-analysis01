import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { Gender } from "@/generated/prisma/client";

/** Columns that must never be read (personal information) */
const PRIVACY_HEADERS = new Set([
  "\u6c0f\u540d", // 氏名
  "\u540d\u524d", // 名前
  "\u6c0f",
  "name",
  "Name",
  "NAME",
  "full name",
  "Full Name",
]);

const NUMBER_HEADERS = [
  "\u756a\u53f7", // 番号
  "\u901a\u3057\u756a\u53f7", // 通し番号 (Excel\u73fe\u884c\u5f62\u5f0f\u5bfe\u5fdc)
  "\u90e8\u54e1\u756a\u53f7",
  "number",
  "No",
  "no",
];

const GENDER_HEADERS = ["\u6027\u5225", "gender", "Gender"];
const GRADE_HEADERS = ["\u5b66\u5e74", "grade", "Grade"];

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, "");
}

function isPrivacyHeader(h: string): boolean {
  const n = normalizeHeader(h);
  if (PRIVACY_HEADERS.has(h) || PRIVACY_HEADERS.has(n)) return true;
  // never match columns that look like name fields
  return /^(氏名|名前|name)$/i.test(n);
}

function parseGender(value: unknown): Gender | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (s === "\u7537" || s === "MALE" || s === "male" || s === "\u7537\u5b50") {
    return "MALE";
  }
  if (s === "\u5973" || s === "FEMALE" || s === "female" || s === "\u5973\u5b50") {
    return "FEMALE";
  }
  return null;
}

function parseGrade(value: unknown): number | null | undefined {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  if (isNaN(n)) return undefined;
  return n;
}

function getCell(
  row: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  const entries = Object.entries(row);
  for (const key of keys) {
    const found = entries.find(
      ([k]) =>
        normalizeHeader(k) === normalizeHeader(key) || k.trim() === key
    );
    if (
      found &&
      found[1] !== undefined &&
      found[1] !== null &&
      found[1] !== ""
    ) {
      return found[1];
    }
  }
  return undefined;
}

/**
 * Keep only number / gender / grade columns.
 * Drop 氏名 and any other privacy columns entirely.
 */
function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (isPrivacyHeader(key)) continue;
    const n = normalizeHeader(key);
    const isNumber = NUMBER_HEADERS.some(
      (h) => normalizeHeader(h) === n || h === key.trim()
    );
    const isGender = GENDER_HEADERS.some(
      (h) => normalizeHeader(h) === n || h === key.trim()
    );
    const isGrade = GRADE_HEADERS.some(
      (h) => normalizeHeader(h) === n || h === key.trim()
    );
    if (isNumber || isGender || isGrade) {
      safe[key] = value;
    }
  }
  return safe;
}

/** GET: download Excel template
 * A列は空欄（氏名列の位置合わせ）、B列以降が 番号 / 性別 / 学年
 */
export async function GET() {
  const aoa = [
    ["", "\u756a\u53f7", "\u6027\u5225", "\u5b66\u5e74"],
    ["", 1, "\u7537", 2],
    ["", 2, "\u5973", 1],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Column widths: A empty spacer, then data columns
  ws["!cols"] = [{ wch: 4 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "\u90e8\u54e1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="kyudo_members_template.xlsx"',
    },
  });
}

/** POST: import members from Excel (merge / upsert by number). Never reads names. */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: "\u30d5\u30a1\u30a4\u30eb\u304c\u5fc5\u8981\u3067\u3059" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  if (rawRows.length === 0) {
    return NextResponse.json(
      { error: "Excel\u306b\u30c7\u30fc\u30bf\u884c\u304c\u3042\u308a\u307e\u305b\u3093" },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const [i, rawRow] of rawRows.entries()) {
    const rowNum = i + 2;
    try {
      // Strip 氏名 etc. before any further use
      const row = sanitizeRow(rawRow);

      const numberRaw = getCell(row, NUMBER_HEADERS);
      const genderRaw = getCell(row, GENDER_HEADERS);
      const gradeRaw = getCell(row, GRADE_HEADERS);

      const number = Number(numberRaw);
      if (!numberRaw || isNaN(number) || number <= 0) {
        errors.push(
          `${rowNum}\u884c\u76ee: \u756a\u53f7\u304c\u7121\u52b9\u3067\u3059`
        );
        continue;
      }

      const gender = parseGender(genderRaw);
      if (!gender) {
        errors.push(
          `${rowNum}\u884c\u76ee (No.${number}): \u6027\u5225\u306f\u300c\u7537\u300d\u307e\u305f\u306f\u300c\u5973\u300d\u3067\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044`
        );
        continue;
      }

      const grade = parseGrade(gradeRaw);
      const existing = await prisma.member.findUnique({ where: { number } });

      if (existing) {
        await prisma.member.update({
          where: { id: existing.id },
          data: {
            gender,
            ...(grade !== undefined ? { grade } : {}),
          },
        });
        updated++;
      } else {
        await prisma.member.create({
          data: {
            number,
            gender,
            grade: grade === undefined ? null : grade,
          },
        });
        created++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${rowNum}\u884c\u76ee: ${msg}`);
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    updated,
    errors,
    message: `\u65b0\u898f${created}\u540d\u30fb\u66f4\u65b0${updated}\u540d\u3092\u30a4\u30f3\u30dd\u30fc\u30c8\u3057\u307e\u3057\u305f`,
  });
}
