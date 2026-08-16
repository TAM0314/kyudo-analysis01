import type { Gender, ShotResult } from "@/generated/prisma/client";

export type ParsedShot = ShotResult;

export interface ParsedArcherRow {
  tachiLabel: string;
  positionInTachi: number;
  memberNumber: number;
  gender: Gender;
  round1: (ParsedShot | null)[];
  round2: (ParsedShot | null)[];
}

export interface ParseDiagnostics {
  sheetRows: number;
  sheetColsMax: number;
  titleHint: string | null;
  headerRow: number | null; // 1-based for display
  numberCol: number | null; // 1-based letter-ish: use 0-based + note
  genderCol: number | null;
  tachiCol: number | null;
  nameColIgnored: number | null;
  headerRowPreview: string[];
  subHeaderPreview: string[];
  shotDetectMethod: "subheader_1_2_3_4" | "fallback_layout" | "none";
  round1Cols: number[]; // 0-based
  round2Cols: number[];
  scannedRows: number;
  acceptedRows: number;
  skipCounts: {
    noNumber: number;
    invalidNumber: number;
    noTachi: number;
    noGender: number;
    noShots: number;
    headerRepeat: number;
  };
  stoppedAtFinalsRow: number | null; // 1-based
  sampleDataRows: Array<{
    excelRow: number;
    tachi: string;
    numberRaw: string;
    genderRaw: string;
    round1Raw: string[];
    round2Raw: string[];
    skipReason: string | null;
  }>;
  likelyCause: string | null;
  warnings: string[];
}

export interface ParseTournamentExcelResult {
  titleHint: string | null;
  rows: ParsedArcherRow[];
  warnings: string[];
  diagnostics: ParseDiagnostics;
}

const PRIVACY_HEADERS = /^(氏名|名前|name)$/i;

function cellStr(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function colLabel(i: number): string {
  // 0 -> A, 1 -> B ...
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function normalizeTachi(s: string): string {
  return s
    .replace(/\s+/g, "")
    .replace(/[Ａ-Ｚａ-ｚ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    );
}

/** 女D / 男A など。純数字は暫定番号とみなし立順にしない */
function isValidTachiLabel(s: string): boolean {
  const n = normalizeTachi(s);
  if (!n) return false;
  if (/^\d+$/.test(n)) return false;
  return true;
}

/**
 * 立順セルを最終ラベルに整える。
 * - 「女D」「男A」はそのまま
 * - 「D」「A」のみ → 性別を付けて「女D」「男A」
 */
export function finalizeTachiLabel(raw: string, gender: Gender): string {
  const n = normalizeTachi(raw);
  if (/^[男女]/.test(n)) return n;
  if (/^[A-Za-z]$/.test(n)) {
    return `${gender === "MALE" ? "男" : "女"}${n.toUpperCase()}`;
  }
  return n;
}

/** パース結果から登場順のユニーク立順ラベルを返す */
export function uniqueTachiLabelsInOrder(rows: ParsedArcherRow[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!seen.has(row.tachiLabel)) {
      seen.add(row.tachiLabel);
      order.push(row.tachiLabel);
    }
  }
  return order;
}

/** 「立1（1回目）」→ base「立1」, attempt 1 */
export function splitRoundDisplayLabel(label: string): {
  base: string;
  attempt: 1 | 2 | null;
} {
  const m = label.match(/^(.+?)[（(]\s*([12])\s*回目\s*[）)]$/);
  if (m) {
    return { base: m[1].trim(), attempt: Number(m[2]) as 1 | 2 };
  }
  return { base: label, attempt: null };
}

export function parseShotCell(v: unknown): ParsedShot | null {
  const s = cellStr(v);
  if (!s) return null;
  if (s === "\u25cb" || s === "\u25ef" || s === "\u25ce" || s === "\u3007") {
    return "HIT";
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

function emptyDiagnostics(
  partial: Partial<ParseDiagnostics> & {
    sheetRows: number;
    sheetColsMax: number;
  }
): ParseDiagnostics {
  return {
    titleHint: null,
    headerRow: null,
    numberCol: null,
    genderCol: null,
    tachiCol: null,
    nameColIgnored: null,
    headerRowPreview: [],
    subHeaderPreview: [],
    shotDetectMethod: "none",
    round1Cols: [],
    round2Cols: [],
    scannedRows: 0,
    acceptedRows: 0,
    skipCounts: {
      noNumber: 0,
      invalidNumber: 0,
      noTachi: 0,
      noGender: 0,
      noShots: 0,
      headerRepeat: 0,
    },
    stoppedAtFinalsRow: null,
    sampleDataRows: [],
    likelyCause: null,
    warnings: [],
    ...partial,
  };
}

function inferLikelyCause(d: ParseDiagnostics): string {
  if (d.headerRow == null || d.numberCol == null) {
    return "\u898b\u51fa\u3057\u884c\u306b\u300c\u756a\u53f7\u300d\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002\u9078\u3093\u3060\u30b7\u30fc\u30c8\u304c\u9055\u3046\u304b\u3001\u5217\u540d\u304c\u300c\u756a\u53f7\u300d\u4ee5\u5916\uff08\u4f8b: No.\u30fb\u90e8\u54e1\u756a\u53f7\uff09\u306e\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059\u3002";
  }
  if (d.skipCounts.noShots > 0 && d.acceptedRows === 0) {
    return `\u756a\u53f7\u306f\u8aad\u3081\u307e\u3057\u305f\u304c\u3001\u5c04\u5217\uff08\u4e88\u60f3: ${d.round1Cols.map(colLabel).join(",")}\u3068${d.round2Cols.map(colLabel).join(",")}\uff09\u306b\u25cb\u00d7\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002\u5217\u4f4d\u7f6e\u305a\u308c\u3001\u307e\u305f\u306f\u25cb\u00d7\u304c\u56f3\u5f62\u30fb\u753b\u50cf\u306e\u53ef\u80fd\u6027\u304c\u9ad8\u3044\u3067\u3059\u3002`;
  }
  if (d.skipCounts.noTachi > 0 && d.acceptedRows === 0) {
    return "\u7acb\u9806\u5217\u304c\u7a7a\u306e\u305f\u3081\u5168\u884c\u30b9\u30ad\u30c3\u30d7\u3055\u308c\u307e\u3057\u305f\u3002\u7d50\u5408\u30bb\u30eb\u306e\u8aad\u307f\u53d6\u308a\u5931\u6557\u306e\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059\u3002";
  }
  if (d.skipCounts.noGender > 0 && d.acceptedRows === 0) {
    return "\u6027\u5225\u304c\u5224\u5225\u3067\u304d\u305a\u5168\u884c\u30b9\u30ad\u30c3\u30d7\u3055\u308c\u307e\u3057\u305f\u3002";
  }
  if (d.skipCounts.invalidNumber > 0 && d.acceptedRows === 0) {
    return "\u756a\u53f7\u5217\u306b\u6570\u5024\u3068\u3057\u3066\u8aad\u3081\u308b\u5024\u304c\u3042\u308a\u307e\u305b\u3093\u3067\u3057\u305f\u3002";
  }
  if (d.stoppedAtFinalsRow != null && d.acceptedRows === 0) {
    return `\u884c${d.stoppedAtFinalsRow}\u3067\u6c7a\u52dd\u95a2\u9023\u306e\u6587\u8a00\u3092\u691c\u77e5\u3057\u3001\u305d\u306e\u524d\u306b\u6709\u52b9\u884c\u304c\u3042\u308a\u307e\u305b\u3093\u3067\u3057\u305f\u3002`;
  }
  if (d.acceptedRows === 0) {
    return "\u6709\u52b9\u306a\u90e8\u54e1\u884c\u3092\u4e00\u884c\u3082\u53d6\u308c\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u4e0b\u8a18\u306e\u8a3a\u65ad\u60c5\u5831\u30fb\u30b5\u30f3\u30d7\u30eb\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
  }
  return "";
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
  const sheetRows = aoa.length;
  const sheetColsMax = aoa.reduce(
    (m, row) => Math.max(m, (row ?? []).length),
    0
  );

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
    // Collect nearby header-like cells for diagnosis
    const previewRows: string[] = [];
    for (let r = 0; r < Math.min(8, aoa.length); r++) {
      const cells = (aoa[r] ?? [])
        .slice(0, 15)
        .map((v, i) => `${colLabel(i)}:${cellStr(v) || "-"}`)
        .filter((x) => !x.endsWith(":-"));
      if (cells.length) previewRows.push(`R${r + 1} ${cells.join(" | ")}`);
    }
    const diagnostics = emptyDiagnostics({
      sheetRows,
      sheetColsMax,
      titleHint,
      headerRowPreview: previewRows,
      warnings: [
        "\u300c\u756a\u53f7\u300d\u5217\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002\u5927\u4f1a\u7d50\u679c\u5f62\u5f0f\u306eExcel\u304b\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044",
      ],
    });
    diagnostics.likelyCause = inferLikelyCause(diagnostics);
    diagnostics.warnings = warnings.concat(diagnostics.warnings);
    return { titleHint, rows: [], warnings: diagnostics.warnings, diagnostics };
  }

  if (tachiCol < 0) {
    tachiCol = 0;
    warnings.push(
      "\u300c\u7acb\u9806\u300d\u5217\u304c\u898b\u3064\u304b\u3089\u306a\u3044\u305f\u3081 A\u5217\u3092\u7acb\u9806\u3068\u4eee\u5b9a\u3057\u307e\u3057\u305f"
    );
  }
  if (genderCol < 0) {
    genderCol = numberCol + 1;
    warnings.push(
      "\u300c\u6027\u5225\u300d\u5217\u304c\u898b\u3064\u304b\u3089\u306a\u3044\u305f\u3081\u756a\u53f7\u306e\u53f3\u5217\u3092\u4eee\u5b9a\u3057\u307e\u3057\u305f"
    );
  }

  const headerRowPreview = (aoa[headerRow] ?? [])
    .slice(0, 20)
    .map((v, i) => `${colLabel(i)}:${cellStr(v) || "-"}`);
  const subHeaderPreview = (aoa[headerRow + 1] ?? [])
    .slice(0, 20)
    .map((v, i) => `${colLabel(i)}:${cellStr(v) || "-"}`);

  const sub = aoa[headerRow + 1] ?? [];
  const shotGroups: number[][] = [];
  let shotDetectMethod: ParseDiagnostics["shotDetectMethod"] = "none";

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

  if (shotGroups.length >= 2) {
    shotDetectMethod = "subheader_1_2_3_4";
  } else {
    const base = genderCol + 1;
    shotGroups.length = 0;
    shotGroups.push([base, base + 1, base + 2, base + 3]);
    const base2 = base + 6;
    shotGroups.push([base2, base2 + 1, base2 + 2, base2 + 3]);
    shotDetectMethod = "fallback_layout";
    warnings.push(
      "\u5c04\u5217\u3092\u6a19\u6e96\u30ec\u30a4\u30a2\u30a6\u30c8\uff08\u6027\u5225\u306e\u53f3\uff09\u3067\u89e3\u91c8\u3057\u307e\u3057\u305f"
    );
  }

  const round1Cols = shotGroups[0];
  const round2Cols = shotGroups[1];

  const rows: ParsedArcherRow[] = [];
  let lastTachi = "";
  let lastPos = 0;
  let autoTachiIndex = 0;
  let autoCountInGroup = 0;
  let activeAuto = false;
  let usedAutoTachi = false;
  const AUTO_GROUP_SIZE = 5;
  const skipCounts = {
    noNumber: 0,
    invalidNumber: 0,
    noTachi: 0,
    noGender: 0,
    noShots: 0,
    headerRepeat: 0,
  };
  let scannedRows = 0;
  let stoppedAtFinalsRow: number | null = null;
  const sampleDataRows: ParseDiagnostics["sampleDataRows"] = [];

  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const rowText = row.map(cellStr).join(" ");

    if (
      rowText.includes("\u6c7a\u52dd\u5c04\u8a70\u3081") ||
      (rowText.includes("\u6c7a\u52dd") && rowText.includes("\u5c04"))
    ) {
      stoppedAtFinalsRow = r + 1;
      break;
    }

    if (cellStr(row[numberCol]) === "\u756a\u53f7") {
      skipCounts.headerRepeat++;
      continue;
    }

    scannedRows++;

    const tachiRaw = cellStr(row[tachiCol]);
    if (tachiRaw && isValidTachiLabel(tachiRaw)) {
      lastTachi = normalizeTachi(tachiRaw);
      lastPos = 0;
      activeAuto = false;
      autoCountInGroup = 0;
    }

    const numberRaw = cellStr(row[numberCol]);
    const genderRaw = cellStr(row[genderCol]);
    const round1Raw = round1Cols.map((ci) => cellStr(row[ci]));
    const round2Raw = round2Cols.map((ci) => cellStr(row[ci]));

    const pushSample = (skipReason: string | null, tachiForSample?: string) => {
      if (sampleDataRows.length >= 8) return;
      if (
        !numberRaw &&
        !round1Raw.some(Boolean) &&
        !round2Raw.some(Boolean) &&
        sampleDataRows.length >= 3
      ) {
        return;
      }
      sampleDataRows.push({
        excelRow: r + 1,
        tachi: tachiForSample || lastTachi || tachiRaw || "(empty)",
        numberRaw: numberRaw || "(empty)",
        genderRaw: genderRaw || "(empty)",
        round1Raw,
        round2Raw,
        skipReason,
      });
    };

    if (!numberRaw) {
      skipCounts.noNumber++;
      continue;
    }

    const memberNumber = Number(String(numberRaw).replace(/[^\d]/g, ""));
    if (!memberNumber || isNaN(memberNumber)) {
      skipCounts.invalidNumber++;
      pushSample("invalidNumber");
      continue;
    }

    const round1 = round1Cols.map((ci) => parseShotCell(row[ci]));
    const round2 = round2Cols.map((ci) => parseShotCell(row[ci]));

    if (!hasShots(round1) && !hasShots(round2)) {
      skipCounts.noShots++;
      pushSample("noShots");
      continue;
    }

    // 立順が空 / 純数字のみ → 5人ごとに自動ラベル（A列空白・暫定番号対応）
    if (!lastTachi) {
      autoTachiIndex += 1;
      lastTachi = `\u7acb${autoTachiIndex}`;
      activeAuto = true;
      autoCountInGroup = 0;
      usedAutoTachi = true;
      skipCounts.noTachi++;
    }

    let pos = Number(cellStr(row[tachiCol + 1]));
    if (activeAuto) {
      autoCountInGroup += 1;
      pos = autoCountInGroup;
      lastPos = pos;
    } else if (!pos || pos < 1 || pos > 20) {
      lastPos += 1;
      pos = lastPos;
    } else {
      lastPos = pos;
    }

    const gender = parseGender(row[genderCol], lastTachi);
    if (!gender) {
      skipCounts.noGender++;
      warnings.push(
        `${r + 1}\u884c\u76ee: \u6027\u5225\u304c\u5224\u5225\u3067\u304d\u307e\u305b\u3093 (No.${memberNumber})`
      );
      pushSample("noGender");
      continue;
    }

    // 「D」のみ → 「女D」/「男A」などへ。自動「立N」はそのまま
    const tachiLabel = activeAuto
      ? lastTachi
      : finalizeTachiLabel(lastTachi, gender);
    // 以降の行でも同じ完成形を引き継ぐ
    if (!activeAuto) lastTachi = tachiLabel;

    pushSample(null, tachiLabel);
    rows.push({
      tachiLabel,
      positionInTachi: pos,
      memberNumber,
      gender,
      round1,
      round2,
    });

    if (activeAuto && autoCountInGroup >= AUTO_GROUP_SIZE) {
      lastTachi = "";
      activeAuto = false;
      autoCountInGroup = 0;
      lastPos = 0;
    }
  }

  if (usedAutoTachi) {
    warnings.push(
      "\u7acb\u9806\u304c\u7a7a\uff08\u307e\u305f\u306fA\u5217\u306e\u7d14\u6570\u5b57\uff09\u3060\u3063\u305f\u305f\u3081\u3001\u81ea\u52d5\u30e9\u30d9\u30eb\uff08\u7acb1, \u7acb2\u2026\uff09\u3092\u4ed8\u4e0e\u3057\u307e\u3057\u305f"
    );
  }

  if (rows.length === 0) {
    warnings.push(
      "\u53d6\u308a\u8fbc\u3081\u308b\u90e8\u54e1\u884c\u304c\u3042\u308a\u307e\u305b\u3093\u3067\u3057\u305f"
    );
  }

  const diagnostics: ParseDiagnostics = {
    sheetRows,
    sheetColsMax,
    titleHint,
    headerRow: headerRow + 1,
    numberCol,
    genderCol,
    tachiCol,
    nameColIgnored: nameCol >= 0 ? nameCol : null,
    headerRowPreview,
    subHeaderPreview,
    shotDetectMethod,
    round1Cols,
    round2Cols,
    scannedRows,
    acceptedRows: rows.length,
    skipCounts,
    stoppedAtFinalsRow,
    sampleDataRows,
    likelyCause: null,
    warnings: [...warnings],
  };
  diagnostics.likelyCause = inferLikelyCause(diagnostics) || null;

  return { titleHint, rows, warnings, diagnostics };
}

/** Human-readable diagnostic text for UI */
export function formatParseDiagnostics(d: ParseDiagnostics): string {
  const lines: string[] = [];
  lines.push("=== \u30a4\u30f3\u30dd\u30fc\u30c8\u8a3a\u65ad ===");
  if (d.likelyCause) {
    lines.push(`\u63a8\u5b9a\u539f\u56e0: ${d.likelyCause}`);
    lines.push("");
  }
  lines.push(
    `\u30b7\u30fc\u30c8\u898f\u6a21: ${d.sheetRows}\u884c x \u6700\u5927${d.sheetColsMax}\u5217`
  );
  lines.push(`\u898b\u51fa\u3057\u884c: ${d.headerRow ?? "\u672a\u691c\u51fa"}`);
  lines.push(
    `\u5217: \u7acb\u9806=${d.tachiCol != null ? colLabel(d.tachiCol) : "-"} / \u756a\u53f7=${d.numberCol != null ? colLabel(d.numberCol) : "-"} / \u6027\u5225=${d.genderCol != null ? colLabel(d.genderCol) : "-"} / \u6c0f\u540d(\u7121\u8996)=${d.nameColIgnored != null ? colLabel(d.nameColIgnored) : "-"}`
  );
  lines.push(
    `\u5c04\u5217\u691c\u51fa: ${d.shotDetectMethod} / 1\u56de\u76ee=[${d.round1Cols.map(colLabel).join(",")}] / 2\u56de\u76ee=[${d.round2Cols.map(colLabel).join(",")}]`
  );
  lines.push(
    `\u30b9\u30ad\u30e3\u30f3: ${d.scannedRows}\u884c / \u63a1\u7528: ${d.acceptedRows}\u884c`
  );
  lines.push(
    `\u30b9\u30ad\u30c3\u30d7: \u756a\u53f7\u7a7a=${d.skipCounts.noNumber}, \u756a\u53f7\u7121\u52b9=${d.skipCounts.invalidNumber}, \u7acb\u9806\u81ea\u52d5=${d.skipCounts.noTachi}, \u6027\u5225\u4e0d\u660e=${d.skipCounts.noGender}, \u25cb\u00d7\u306a\u3057=${d.skipCounts.noShots}`
  );
  if (d.stoppedAtFinalsRow != null) {
    lines.push(
      `\u6c7a\u52dd\u95a2\u9023\u3067\u505c\u6b62: ${d.stoppedAtFinalsRow}\u884c\u76ee`
    );
  }
  if (d.titleHint) lines.push(`\u898b\u51fa\u3057\u5019\u88dc: ${d.titleHint}`);
  if (d.headerRowPreview.length) {
    lines.push("");
    lines.push("[\u898b\u51fa\u3057\u884c]");
    lines.push(d.headerRowPreview.join(" | "));
  }
  if (d.subHeaderPreview.length) {
    lines.push("[\u6b21\u884c]");
    lines.push(d.subHeaderPreview.join(" | "));
  }
  if (d.sampleDataRows.length) {
    lines.push("");
    lines.push("[\u30b5\u30f3\u30d7\u30eb\u884c]");
    for (const s of d.sampleDataRows) {
      lines.push(
        `R${s.excelRow} tachi=${s.tachi} no=${s.numberRaw} sex=${s.genderRaw} r1=[${s.round1Raw.join(",")}] r2=[${s.round2Raw.join(",")}]${s.skipReason ? ` SKIP:${s.skipReason}` : " OK"}`
      );
    }
  }
  if (d.warnings.length) {
    lines.push("");
    lines.push("[\u8b66\u544a]");
    for (const w of d.warnings.slice(0, 20)) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}
