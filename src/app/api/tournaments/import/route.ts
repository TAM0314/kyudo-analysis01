import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { TournamentType } from "@/generated/prisma/client";
import {
  parseTournamentResultSheet,
  formatParseDiagnostics,
  uniqueTachiLabelsInOrder,
  splitRoundDisplayLabel,
} from "@/lib/tournament-excel";
import { isDemoMode, demoResponse } from "@/lib/demo";

/** 結合セルの値を範囲内へ展開（立順の女D等が先頭行にしか無い場合に必要） */
function expandMergedCells(ws: XLSX.WorkSheet): void {
  const merges = ws["!merges"];
  if (!merges?.length) return;

  for (const range of merges) {
    const topLeft = XLSX.utils.encode_cell(range.s);
    const src = ws[topLeft];
    if (!src || (src.v === undefined && src.w === undefined)) continue;

    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        if (R === range.s.r && C === range.s.c) continue;
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cur = ws[addr];
        const empty =
          !cur ||
          cur.v === undefined ||
          cur.v === null ||
          String(cur.v).trim() === "";
        if (empty) {
          ws[addr] = { t: src.t ?? "s", v: src.v, w: src.w };
        }
      }
    }
  }
}

function sheetToAoa(wb: XLSX.WorkBook, sheetName: string): unknown[][] {
  const ws = wb.Sheets[sheetName];
  expandMergedCells(ws);
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  });
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) return demoResponse();
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const listOnly = formData.get("listOnly") === "true";
  const relabelOnly = formData.get("relabelOnly") === "true";
  const sheetNameRaw = formData.get("sheetName");
  const requestedSheet =
    typeof sheetNameRaw === "string" && sheetNameRaw.trim()
      ? sheetNameRaw.trim()
      : null;
  const tournamentIdRaw = formData.get("tournamentId");
  const tournamentId =
    typeof tournamentIdRaw === "string" && tournamentIdRaw.trim()
      ? Number(tournamentIdRaw)
      : null;

  if (!file) {
    return NextResponse.json(
      { error: "\u30d5\u30a1\u30a4\u30eb\u304c\u5fc5\u8981\u3067\u3059" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array", cellStyles: false });

  if (wb.SheetNames.length === 0) {
    return NextResponse.json(
      { error: "\u30b7\u30fc\u30c8\u304c\u3042\u308a\u307e\u305b\u3093" },
      { status: 400 }
    );
  }

  if (listOnly) {
    return NextResponse.json({
      sheets: wb.SheetNames,
      suggested: wb.SheetNames[0],
    });
  }

  if (requestedSheet && !wb.SheetNames.includes(requestedSheet)) {
    return NextResponse.json(
      {
        error: `\u30b7\u30fc\u30c8\u300c${requestedSheet}\u300d\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093`,
        sheets: wb.SheetNames,
      },
      { status: 400 }
    );
  }

  const sheetName = requestedSheet ?? wb.SheetNames[0];
  const aoa = sheetToAoa(wb, sheetName);
  const parsed = parseTournamentResultSheet(aoa);

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "\u53d6\u308a\u8fbc\u3081\u308b\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093",
        warnings: parsed.warnings,
        titleHint: parsed.titleHint,
        diagnostics: parsed.diagnostics,
        diagnosticText: formatParseDiagnostics(parsed.diagnostics),
        sheetName,
      },
      { status: 400 }
    );
  }

  // 既存大会の立ちラベルだけ Excel の立順（女D / 男A 等）に更新
  if (relabelOnly) {
    if (!tournamentId || Number.isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "tournamentId \u304c\u5fc5\u8981\u3067\u3059" },
        { status: 400 }
      );
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { rounds: { orderBy: { roundNumber: "asc" } } },
    });
    if (!tournament) {
      return NextResponse.json(
        { error: "\u5927\u4f1a\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093" },
        { status: 404 }
      );
    }

    const excelTachis = uniqueTachiLabelsInOrder(parsed.rows);
    const autoOnly = excelTachis.every((t) => /^立\d+$/.test(t));
    if (autoOnly) {
      return NextResponse.json(
        {
          error:
            "Excel\u304b\u3089\u5973D/\u7537A\u306a\u3069\u306e\u7acb\u9806\u304c\u8aad\u3081\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u7acb\u9806\u5217\uff08\u7d50\u5408\u30bb\u30eb\u3092\u542b\u3080\uff09\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
          excelTachis,
          warnings: parsed.warnings,
          diagnosticText: formatParseDiagnostics(parsed.diagnostics),
        },
        { status: 400 }
      );
    }

    const baseOrder: string[] = [];
    const seenBase = new Set<string>();
    for (const round of tournament.rounds) {
      const label = round.label ?? `${round.roundNumber}立ち`;
      const { base } = splitRoundDisplayLabel(label);
      if (!seenBase.has(base)) {
        seenBase.add(base);
        baseOrder.push(base);
      }
    }

    if (baseOrder.length === 0) {
      return NextResponse.json(
        { error: "\u66f4\u65b0\u5bfe\u8c61\u306e\u7acb\u3061\u304c\u3042\u308a\u307e\u305b\u3093" },
        { status: 400 }
      );
    }

    if (excelTachis.length < baseOrder.length) {
      return NextResponse.json(
        {
          error: `Excel\u306e\u7acb\u9806\u6570\uff08${excelTachis.length}\uff09\u304c\u65e2\u5b58\u306e\u7acb\u3061\u6570\uff08${baseOrder.length}\uff09\u3088\u308a\u5c11\u306a\u3044\u3067\u3059`,
          excelTachis,
          currentLabels: baseOrder,
        },
        { status: 400 }
      );
    }

    const renameMap = new Map<string, string>();
    const changes: Array<{ from: string; to: string }> = [];
    for (let i = 0; i < baseOrder.length; i++) {
      const from = baseOrder[i];
      const to = excelTachis[i];
      renameMap.set(from, to);
      if (from !== to) changes.push({ from, to });
    }

    let updated = 0;
    for (const round of tournament.rounds) {
      const label = round.label ?? `${round.roundNumber}立ち`;
      const { base, attempt } = splitRoundDisplayLabel(label);
      const newBase = renameMap.get(base);
      if (!newBase || newBase === base) continue;
      const newLabel =
        attempt === 1
          ? `${newBase}（1回目）`
          : attempt === 2
            ? `${newBase}（2回目）`
            : newBase;
      await prisma.round.update({
        where: { id: round.id },
        data: { label: newLabel },
      });
      updated++;
    }

    return NextResponse.json({
      ok: true,
      sheetName,
      excelTachis,
      changes,
      updated,
      message:
        changes.length === 0
          ? "\u30e9\u30d9\u30eb\u306f\u65e2\u306bExcel\u3068\u4e00\u81f4\u3057\u3066\u3044\u307e\u3059"
          : `\u7acb\u3061\u30e9\u30d9\u30eb\u3092${updated}\u4ef6\u66f4\u65b0\u3057\u307e\u3057\u305f\uff08${changes
              .map((c) => `${c.from}\u2192${c.to}`)
              .join("\u3001")}\uff09`,
      warnings: parsed.warnings,
    });
  }

  const name =
    (typeof formData.get("name") === "string" &&
      (formData.get("name") as string).trim()) ||
    parsed.titleHint ||
    "\u30a4\u30f3\u30dd\u30fc\u30c8\u3057\u305f\u5927\u4f1a";
  const dateStr =
    (typeof formData.get("date") === "string" &&
      (formData.get("date") as string).trim()) ||
    new Date().toISOString().slice(0, 10);
  const typeStr =
    (typeof formData.get("type") === "string" &&
      (formData.get("type") as string).trim()) ||
    "PUBLIC";
  const type = (
    ["PUBLIC", "PRACTICE", "SELECTION"].includes(typeStr)
      ? typeStr
      : "PUBLIC"
  ) as TournamentType;

  try {
    let membersCreated = 0;
    let roundsCreated = 0;
    let entriesCreated = 0;
    let shotsCreated = 0;

    const tournament = await prisma.tournament.create({
      data: {
        name,
        type,
        date: new Date(dateStr),
      },
    });

    const memberIdByNumber = new Map<number, number>();
    const uniqueMembers = new Map<
      number,
      { number: number; gender: "MALE" | "FEMALE" }
    >();
    for (const row of parsed.rows) {
      uniqueMembers.set(row.memberNumber, {
        number: row.memberNumber,
        gender: row.gender,
      });
    }

    for (const m of uniqueMembers.values()) {
      const existing = await prisma.member.findUnique({
        where: { number: m.number },
      });
      if (existing) {
        memberIdByNumber.set(m.number, existing.id);
        if (existing.gender !== m.gender) {
          await prisma.member.update({
            where: { id: existing.id },
            data: { gender: m.gender },
          });
        }
      } else {
        const created = await prisma.member.create({
          data: { number: m.number, gender: m.gender, grade: null },
        });
        memberIdByNumber.set(m.number, created.id);
        membersCreated++;
      }
    }

    const tachiOrder: string[] = [];
    const byTachi = new Map<string, typeof parsed.rows>();
    for (const row of parsed.rows) {
      if (!byTachi.has(row.tachiLabel)) {
        tachiOrder.push(row.tachiLabel);
        byTachi.set(row.tachiLabel, []);
      }
      byTachi.get(row.tachiLabel)!.push(row);
    }

    let roundNumber = 0;

    for (const tachi of tachiOrder) {
      const group = byTachi.get(tachi)!;

      for (const kai of [1, 2] as const) {
        const shooters = group
          .map((row) => ({
            row,
            shots: kai === 1 ? row.round1 : row.round2,
          }))
          .filter(({ shots }) => shots.some((s) => s !== null));

        if (shooters.length === 0) continue;

        roundNumber += 1;
        const roundLabel =
          kai === 1
            ? `${tachi}\uff081\u56de\u76ee\uff09`
            : `${tachi}\uff082\u56de\u76ee\uff09`;

        const round = await prisma.round.create({
          data: {
            tournamentId: tournament.id,
            roundNumber,
            label: roundLabel,
          },
        });
        roundsCreated++;

        for (const { row, shots } of shooters) {
          const memberId = memberIdByNumber.get(row.memberNumber);
          if (!memberId) continue;

          const entry = await prisma.entry.create({
            data: {
              roundId: round.id,
              memberId,
              positionInRound: row.positionInTachi,
            },
          });
          entriesCreated++;

          for (let i = 0; i < 4; i++) {
            const result = shots[i];
            if (!result) continue;
            await prisma.shot.create({
              data: {
                entryId: entry.id,
                arrowNumber: i + 1,
                result,
              },
            });
            shotsCreated++;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        type: tournament.type,
        date: tournament.date,
      },
      sheetName,
      titleHint: parsed.titleHint,
      tachiLabels: tachiOrder,
      warnings: parsed.warnings,
      created: {
        members: membersCreated,
        rounds: roundsCreated,
        entries: entriesCreated,
        shots: shotsCreated,
      },
      message: `\u5927\u4f1a\u300c${tournament.name}\u300d\u3092\u53d6\u308a\u8fbc\u307f\u307e\u3057\u305f\uff08\u7acb\u3061${roundsCreated}\u30fb\u8a18\u9332${entriesCreated}\u30fb\u65b0\u898f\u90e8\u54e1${membersCreated}\uff09`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
