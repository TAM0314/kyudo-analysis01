import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY \u304c\u8a2d\u5b9a\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002\u8a2d\u5b9a\u30da\u30fc\u30b8\u3084 Vercel \u306e\u74b0\u5883\u5909\u6570\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      },
      { status: 503 }
    );
  }

  let body: { type?: string; data?: Record<string, unknown>; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "\u30ea\u30af\u30a8\u30b9\u30c8\u672c\u6587\u304c\u7121\u52b9\u3067\u3059" },
      { status: 400 }
    );
  }

  const { type, data } = body;

  if (!type || !data) {
    return NextResponse.json(
      {
        error:
          "type \u3068 data \u304c\u5fc5\u8981\u3067\u3059",
      },
      { status: 400 }
    );
  }

  let prompt = "";

  if (type === "individual") {
    const memberNumber = data.memberNumber as number;
    const gender = data.gender as string;
    const chartData = (data.chartData ?? []) as Array<{
      name: string;
      hitRate: number;
      hits: number;
      total: number;
    }>;
    const arrowStats = (data.arrowStats ?? []) as Array<{
      arrowNumber: number;
      hits: number;
      total: number;
    }>;

    const genderLabel =
      gender === "MALE" ? "\u7537" : gender === "FEMALE" ? "\u5973" : gender;
    const recentData = chartData
      .map((d) => `${d.name}: ${d.hits}/${d.total}\u4e2d (${d.hitRate}%)`)
      .join("\n");
    const arrowData = arrowStats
      .map(
        (a) =>
          `${a.arrowNumber}\u5c04\u76ee: ${a.hits}/${a.total}\u4e2d`
      )
      .join("\n");

    prompt = [
      "\u3042\u306a\u305f\u306f\u9ad8\u6821\u5f13\u9053\u90e8\u306e\u9867\u554f\u3092\u652f\u63f4\u3059\u308b\u30b3\u30fc\u30c1\u3067\u3059\u3002",
      "\u4ee5\u4e0b\u306e\u90e8\u54e1\u306e\u7684\u4e2d\u30c7\u30fc\u30bf\u3092\u5206\u6790\u3057\u3001\u5b9f\u8df5\u306b\u5f79\u7acb\u3064\u30b3\u30e1\u30f3\u30c8\u3092\u65e5\u672c\u8a9e\u3067\u7d04200\u5b57\u4ee5\u5185\u3067\u66f8\u3044\u3066\u304f\u3060\u3055\u3044\u3002",
      "\u4e2a\u4eba\u540d\u306f\u4f7f\u308f\u305a\u3001\u756a\u53f7\u3067\u547c\u3093\u3067\u304f\u3060\u3055\u3044\u3002",
      "\u63a8\u6e2c\u306f\u30c7\u30fc\u30bf\u306b\u57fa\u3065\u304d\u3001\u52c9\u5f37\u30fb\u52c9\u3081\u3059\u304e\u306a\u3044\u53e3\u8abf\u3067\u304a\u9858\u3044\u3057\u307e\u3059\u3002",
      "",
      `\u90e8\u54e1: ${genderLabel} No.${memberNumber}`,
      `\u76f4\u8fd1\u306e\u7684\u4e2d\u7387\u63a8\u79fb:`,
      recentData || "\uff08\u30c7\u30fc\u30bf\u306a\u3057\uff09",
      `\u5c04\u9806\uff081\u301c4\u5c04\u76ee\uff09\u306e\u50be\u5411:`,
      arrowData || "\uff08\u30c7\u30fc\u30bf\u306a\u3057\uff09",
      "",
      "\u63a8\u79fb\u306e\u898b\u65b9\u3001\u5f37\u307f\u30fb\u5f31\u307f\u3001\u6b21\u306e\u5927\u4f1a\u306b\u5411\u3051\u305f\u30a2\u30c9\u30d0\u30a4\u30b9\u3092\u542b\u3081\u3066\u304f\u3060\u3055\u3044\u3002",
    ].join("\n");
  } else if (type === "team") {
    const tournamentName = data.tournamentName as string;
    const roundStats = (data.roundStats ?? []) as Array<{
      label: string;
      hits: number;
      total: number;
      hitRate: number;
    }>;
    const arrowStats = (data.arrowStats ?? []) as Array<{
      arrowNumber: number;
      hits: number;
      total: number;
      hitRate: number;
    }>;

    const roundData = roundStats
      .map(
        (r) => `${r.label}: ${r.hits}/${r.total}\u4e2d (${r.hitRate}%)`
      )
      .join("\n");
    const arrowData = arrowStats
      .map(
        (a) =>
          `${a.arrowNumber}\u5c04\u76ee: ${a.hits}/${a.total}\u4e2d (${a.hitRate}%)`
      )
      .join("\n");

    prompt = [
      "\u3042\u306a\u305f\u306f\u9ad8\u6821\u5f13\u9053\u90e8\u306e\u9867\u554f\u3092\u652f\u63f4\u3059\u308b\u30b3\u30fc\u30c1\u3067\u3059\u3002",
      "\u4ee5\u4e0b\u306e\u30c1\u30fc\u30e0\uff08\u7acb\u3061\uff09\u7684\u4e2d\u30c7\u30fc\u30bf\u3092\u5206\u6790\u3057\u3001\u5b9f\u8df5\u306b\u5f79\u7acb\u3064\u30b3\u30e1\u30f3\u30c8\u3092\u65e5\u672c\u8a9e\u3067\u7d04200\u5b57\u4ee5\u5185\u3067\u66f8\u3044\u3066\u304f\u3060\u3055\u3044\u3002",
      "\u4e2a\u4eba\u540d\u306f\u4f7f\u308f\u306a\u3044\u3067\u304f\u3060\u3055\u3044\u3002",
      "\u52c9\u5f37\u30fb\u52c9\u3081\u3059\u304e\u306a\u3044\u53e3\u8abf\u3067\u304a\u9858\u3044\u3057\u307e\u3059\u3002",
      "",
      `\u5927\u4f1a: ${tournamentName}`,
      `\u7acb\u3061\u5225\u7684\u4e2d:`,
      roundData || "\uff08\u30c7\u30fc\u30bf\u306a\u3057\uff09",
      `\u5c04\u9806\uff081\u301c4\u5c04\u76ee\uff09\u306e\u50be\u5411:`,
      arrowData || "\uff08\u30c7\u30fc\u30bf\u306a\u3057\uff09",
      "",
      "\u7acb\u3061\u9593\u306e\u5dee\u3001\u5c04\u9806\u306e\u50be\u5411\u3001\u6b21\u306b\u5411\u3051\u305f\u30c1\u30fc\u30e0\u3068\u3057\u3066\u306e\u30a2\u30c9\u30d0\u30a4\u30b9\u3092\u542b\u3081\u3066\u304f\u3060\u3055\u3044\u3002",
    ].join("\n");
  } else {
    return NextResponse.json(
      { error: "\u4e0d\u6b63\u306a type \u3067\u3059" },
      { status: 400 }
    );
  }

  try {
    const result = streamText({
      model: openai("gpt-4o-mini"),
      prompt,
    });
    return result.toTextStreamResponse();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
