import type { Gender, ShotResult } from "@/generated/prisma/client";

export type ParsedShot = ShotResult;

export interface ParsedArcherRow {
  tachiLabel: string; // 女D など
  positionInTachi: number; // 1-5
  memberNumber: number;
  gender: Gender;
  round1: (ParsedShot | null)[]; // length 4
  round2: (ParsedShot | null)[]; // length 4
}

export interface ParseTournamentExcelResult {
  titleHint: string | null;
  rows: ParsedArcherRow[];
  warnings: string[];
}

const PRIVACY_HEADERS = /^(氏名|名前|name)$/i;

function cellStr(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function normalizeTachi(s: string): string {
  return s.replace(/\s+/g, "");
}

export function parseShotCell(v: unknown): ParsedShot | null {
  const s = cellStr(v);
  if (!s) return null;
  if (s === "\u25cb" || s === "\u25ef" || s === "\u25ce" || s === "\u3007") {
    return "HIT"; // ○ ◯ ◎ 〇
  }
  if (
    s === "\u00d7" ||
    s === "\u2715" ||
    s === "\u2716" ||
    s === "\u2717" ||
    s === "x" ||
    s === "X"
  ) {
    return "MISS";
  }
  if (s === "/" || s === "\uff0f" || s === "\u5931") {
    return "SHITSU";
  }
  return null;
}

function parseGender(v: unknown, tachiLabel: string): Gender | null {
  const s = cellStr(v);
  if (s === "\u7537" || s === "MALE" || s === "\u7537\u5b50") return "MALE";
  if (s === "\u5973" || s === "FEMALE" || s === "\u5973\u5b50") return "FEMALE";
  if (tachiLabel.startsWith("\u7537")) return "MALE";
  if (tachiLabel.startsWith("\u5973")) return "FEMALE";
  return null;
}

function hasShots(shots: (ParsedShot | null)[]): boolean {
  return shots.some((s) => s !== null);
}

/**
 * Parse kyudo match-result Excel (立順 / 番号 / 性別 / 1回目4射 / 2回目4射).
 * Ignores 氏名 and 決勝射詰め section.
 */
export function parseTournamentResultSheet(
  aoa: unknown[][]
): ParseTournamentExcelResult {
  const warnings: string[] = [];
  let titleHint: string | null = null;

  // Title hint from early rows
  for (let r = 0; r < Math.min(5, aoa.length); r++) {
    const joined = (aoa[r] ?? []).map(cellStr).filter(Boolean).join(" ");
    if (joined.includes("\u6c7a\u52dd\u5c04\u8a70\u3081")) break;
    if (
      joined.includes("\u5927\u4f1a") ||
      joined.includes("\u8a66\u5408\u7d50\u679c") ||
      joined.includes("\u9ad8\u7b49\u5b66\u6821")
    ) {
      titleHint = joined.slice(0, 80);
      break;
    }
  }

  // Find header row with 番号
  let headerRow = -1;
  let numberCol = -1;
  let genderCol = -1;
  let tachiCol = -1;
  let nameCol = -1;

  for (let r = 0; r < Math.min(30, aoa.length); r++) {
    const row = aoa[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const v = cellStr(row[c]);
      if (v === "\u756a\u53f7") {
        headerRow = r;
        numberCol = c;
      }
    }
    if (headerRow === r) {
      for (let c = 0; c < row.length; c++) {
        const v = cellStr(row[c]);
        if (v === "\u6027\u5225") genderCol = c;
        if (v === "\u7acb\u9806" || v === "\u7acb\u3061") tachiCol = c;
        if (PRIVACY_HEADERS.test(v)) nameCol = c;
      }
      break;
    }
  }

  if (headerRow < 0 || numberCol < 0) {
    return {
      titleHint,
      rows: [],
      warnings: [
        "\u300c\u756a\u53f7\u300d\u5217\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002\u5927\u4f1a\u7d50\u679c\u5f62\u5f0f\u306eExcel\u304b\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044",
      ],
    };
  }

  if (tachiCol < 0) tachiCol = 0;
  if (genderCol < 0) genderCol = numberCol + 1;

  // Detect two groups of 4 shot columns after 性別
  // Strategy: find subheader "1","2","3","4" sequences; else fixed layout
  const sub = aoa[headerRow + 1] ?? [];
  const shotGroups: number[][] = [];

  for (let c = genderCol + 1; c < sub.length - 3; c++) {
    const a = cellStr(sub[c]);
    const b = cellStr(sub[c + 1]);
    const c2 = cellStr(sub[c + 2]);
    const d = cellStr(sub[c + 3]);
    if (a === "1" && b === "2" && c2 === "3" && d === "4") {
      shotGroups.push([c, c + 1, c + 2, c + 3]);
      c += 3;
      if (shotGroups.length >= 2) break;
    }
  }

  // Fallback: gender + 1..4, then skip 2 cols (小計・団体), then +4
  if (shotGroups.length < 2) {
    const base = genderCol + 1;
    shotGroups.length = 0;
    shotGroups.push([base, base + 1, base + 2, base + 3]);
    const base2 = base + 6;
    shotGroups.push([base2, base2 + 1, base2 + 2, base2 + 3]);
    warnings.push(
      "\u5c04\u5217\u3092\u6a19\u6e96\u30ec\u30a4\u30a2\u30a6\u30c8\uff08\u6027\u5225\u306e\u53f3\uff09\u3067\u89e3\u91c8\u3057\u307e\u3057\u305f"
    );
  }

  const round1Cols = shotGroups[0];
  const round2Cols = shotGroups[1];

  const rows: ParsedArcherRow[] = [];
  let lastTachi = "";
  let lastPos = 0;

  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const rowText = row.map(cellStr).join(" ");

    // Stop at 決勝射詰め or similar
    if (
      rowText.includes("\u6c7a\u52dd\u5c04\u8a70\u3081") ||
      rowText.includes("\u6c7a\u52dd") && rowText.includes("\u5c04")
    ) {
      break;
    }

    // Skip pure header continuation
    if (cellStr(row[numberCol]) === "\u756a\u53f7") continue;

    let tachiRaw = cellStr(row[tachiCol]);
    if (tachiRaw) {
      lastTachi = normalizeTachi(tachiRaw);
      lastPos = 0;
    }

    // Never use name column
    void nameCol;

    const numberRaw = cellStr(row[numberCol]);
    if (!numberRaw) continue;
    // skip if number cell is not numeric (subheader leftovers)
    const memberNumber = Number(String(numberRaw).replace(/[^\d]/g, ""));
    if (!memberNumber || isNaN(memberNumber)) continue;

    // position: prefer explicit 1-5 col (usually tachiCol+1)
    let pos = Number(cellStr(row[tachiCol + 1]));
    if (!pos || pos < 1 || pos > 20) {
      lastPos += 1;
      pos = lastPos;
    } else {
      lastPos = pos;
    }

    if (!lastTachi) {
      warnings.push(
        `${r + 1}\u884c\u76ee: \u7acb\u9806\u304c\u7a7a\u306e\u305f\u3081\u30b9\u30ad\u30c3\u30d7 (No.${memberNumber})`
      );
      continue;
    }

    const gender = parseGender(row[genderCol], lastTachi);
    if (!gender) {
      warnings.push(
        `${r + 1}\u884c\u76ee: \u6027\u5225\u304c\u5224\u5225\u3067\u304d\u307e\u305b\u3093 (No.${memberNumber})`
      );
      continue;
    }

    const round1 = round1Cols.map((ci) => parseShotCell(row[ci]));
    const round2 = round2Cols.map((ci) => parseShotCell(row[ci]));

    if (!hasShots(round1) && !hasShots(round2)) {
      // empty placeholder row
      continue;
    }

    rows.push({
      tachiLabel: lastTachi,
      positionInTachi: pos,
      memberNumber,
      gender,
      round1,
      round2,
    });
  }

  if (rows.length === 0) {
    warnings.push("\u53d6\u308a\u8fbc\u3081\u308b\u90e8\u54e1\u884c\u304c\u3042\u308a\u307e\u305b\u3093\u3067\u3057\u305f");
  }

  return { titleHint, rows, warnings };
}
