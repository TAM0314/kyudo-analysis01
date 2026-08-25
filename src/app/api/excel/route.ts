import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { ShotResult, TournamentType, Gender } from "@/generated/prisma/client";
import { isDemoMode, demoResponse } from "@/lib/demo";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "export") {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { date: "asc" },
      include: {
        rounds: {
          orderBy: { roundNumber: "asc" },
          include: {
            entries: {
              orderBy: { positionInRound: "asc" },
              include: {
                member: true,
                shots: { orderBy: { arrowNumber: "asc" } },
              },
            },
          },
        },
      },
    });

    const rows: Record<string, string | number | null>[] = [];
    for (const t of tournaments) {
      for (const round of t.rounds) {
        for (const entry of round.entries) {
          const shotMap: Record<number, string> = {};
          for (const shot of entry.shots) {
            shotMap[shot.arrowNumber] =
              shot.result === "HIT" ? "\u25cb" :
              shot.result === "SHITSU" ? "/" : "\u00d7";
          }
          const hits = entry.shots.filter((s) => s.result === "HIT").length;
          rows.push({
            "\u5927\u4f1a\u540d": t.name,
            "\u7a2e\u5225":
              t.type === "PUBLIC" ? "\u516c\u5f0f\u6226" :
              t.type === "PRACTICE" ? "\u7df4\u7fd2\u8a66\u5408" : "\u6821\u5185\u9078\u8003",
            "\u65e5\u4ed8": new Date(t.date).toLocaleDateString("ja-JP"),
            "\u7acb\u3061\u756a\u53f7": round.roundNumber,
            "\u7acb\u3061\u30e9\u30d9\u30eb": round.label ?? "",
            "\u90e8\u54e1\u756a\u53f7": entry.member.number,
            "\u6027\u5225": entry.member.gender === "MALE" ? "\u7537" : "\u5973",
            "\u5b66\u5e74": entry.member.grade ?? "",
            "1\u5c04\u76ee": shotMap[1] ?? "",
            "2\u5c04\u76ee": shotMap[2] ?? "",
            "3\u5c04\u76ee": shotMap[3] ?? "",
            "4\u5c04\u76ee": shotMap[4] ?? "",
            "\u7684\u4e2d\u6570": hits,
          });
        }
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "\u7684\u4e2d\u30c7\u30fc\u30bf");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="kyudo_data_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ error: "type\u30d1\u30e9\u30e1\u30fc\u30bf\u304c\u5fc5\u8981\u3067\u3059" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) return demoResponse();
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "\u30d5\u30a1\u30a4\u30eb\u304c\u5fc5\u8981\u3067\u3059" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

  let imported = 0;
  const errors: string[] = [];

  for (const [i, row] of rows.entries()) {
    try {
      const tournamentName = row["\u5927\u4f1a\u540d"]?.trim();
      const typeStr = row["\u7a2e\u5225"]?.trim();
      const dateStr = row["\u65e5\u4ed8"]?.trim();
      const roundNumber = Number(row["\u7acb\u3061\u756a\u53f7"]);
      const roundLabel = row["\u7acb\u3061\u30e9\u30d9\u30eb"]?.trim() || null;
      const memberNumber = Number(row["\u90e8\u54e1\u756a\u53f7"]);
      const genderStr = row["\u6027\u5225"]?.trim();
      const gradeStr = row["\u5b66\u5e74"]?.trim();
      const shotStrs = [
        row["1\u5c04\u76ee"],
        row["2\u5c04\u76ee"],
        row["3\u5c04\u76ee"],
        row["4\u5c04\u76ee"],
      ];

      if (!tournamentName || !dateStr || !memberNumber) continue;

      const typeMap: Record<string, TournamentType> = {
        "\u516c\u5f0f\u6226": "PUBLIC",
        "\u7df4\u7fd2\u8a66\u5408": "PRACTICE",
        "\u6821\u5185\u9078\u8003": "SELECTION",
      };
      const genderMap: Record<string, Gender> = {
        "\u7537": "MALE",
        "\u5973": "FEMALE",
      };
      const shotMap: Record<string, ShotResult> = {
        "\u25cb": "HIT",
        "\u00d7": "MISS",
        "/": "SHITSU",
      };

      const tournamentType: TournamentType = typeMap[typeStr] ?? "PRACTICE";
      const gender: Gender = genderMap[genderStr] ?? "MALE";
      const grade = gradeStr ? Number(gradeStr) : null;

      let tournament = await prisma.tournament.findFirst({
        where: { name: tournamentName, type: tournamentType },
      });
      if (!tournament) {
        tournament = await prisma.tournament.create({
          data: { name: tournamentName, type: tournamentType, date: new Date(dateStr) },
        });
      }

      const round = await prisma.round.upsert({
        where: { tournamentId_roundNumber: { tournamentId: tournament.id, roundNumber } },
        create: { tournamentId: tournament.id, roundNumber, label: roundLabel },
        update: {},
      });

      const member = await prisma.member.upsert({
        where: { number: memberNumber },
        create: { number: memberNumber, gender, grade },
        update: { grade: grade ?? undefined },
      });

      const positionInRound =
        (await prisma.entry.count({ where: { roundId: round.id } })) + 1;
      const entry = await prisma.entry.upsert({
        where: { roundId_memberId: { roundId: round.id, memberId: member.id } },
        create: { roundId: round.id, memberId: member.id, positionInRound },
        update: {},
      });

      for (const [idx, shotStr] of shotStrs.entries()) {
        const result: ShotResult = shotMap[shotStr?.trim()] ?? "MISS";
        await prisma.shot.upsert({
          where: { entryId_arrowNumber: { entryId: entry.id, arrowNumber: idx + 1 } },
          create: { entryId: entry.id, arrowNumber: idx + 1, result },
          update: { result },
        });
      }

      imported++;
    } catch (e) {
      errors.push(`\u884c${i + 2}: ${String(e)}`);
    }
  }

  return NextResponse.json({ imported, errors });
}
