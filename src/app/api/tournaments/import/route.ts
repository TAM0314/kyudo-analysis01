import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { TournamentType } from "@/generated/prisma/client";
import { parseTournamentResultSheet, formatParseDiagnostics } from "@/lib/tournament-excel";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const listOnly = formData.get("listOnly") === "true";
  const sheetNameRaw = formData.get("sheetName");
  const requestedSheet =
    typeof sheetNameRaw === "string" && sheetNameRaw.trim()
      ? sheetNameRaw.trim()
      : null;

  if (!file) {
    return NextResponse.json(
      { error: "\u30d5\u30a1\u30a4\u30eb\u304c\u5fc5\u8981\u3067\u3059" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });

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
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  });

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

    // Ensure members exist
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
        // update gender if needed
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

    // Group by tachiLabel, preserve first-seen order
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
