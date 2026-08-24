import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { formatHitRate } from "@/lib/utils";

export const maxDuration = 60;

function getGoogleApiKey(): string | undefined {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY
  );
}

export async function POST(req: NextRequest) {
  if (!getGoogleApiKey()) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_GENERATIVE_AI_API_KEY が設定されていません。Google AI Studio でキーを作成し、設定ページまたは Vercel 環境変数に追記してください。",
      },
      { status: 503 }
    );
  }

  let body: { type?: string; data?: Record<string, unknown>; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "リクエスト本文が無効です" },
      { status: 400 }
    );
  }

  const { type, data } = body;

  if (!type || !data) {
    return NextResponse.json(
      { error: "type と data が必要です" },
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
      gender === "MALE" ? "男" : gender === "FEMALE" ? "女" : gender;
    const recentData = chartData
      .map((d) => `${d.name}: ${d.hits}/${d.total}中 (${formatHitRate(d.hitRate)})`)
      .join("\n");
    const arrowData = arrowStats
      .map((a) => `${a.arrowNumber}射目: ${a.hits}/${a.total}中`)
      .join("\n");

    prompt = [
      "あなたは高校弓道部の顧問を支援するコーチです。",
      "以下の部員の的中データを分析し、実践に役立つコメントを日本語で約200字以内で書いてください。",
      "個人名は使わず、番号で呼んでください。",
      "推測はデータに基づき、勉強・励めすぎない口調でお願いします。",
      "",
      `部員: ${genderLabel} No.${memberNumber}`,
      `直近の的中率推移:`,
      recentData || "（データなし）",
      `射順（1〜4射目）の傾向:`,
      arrowData || "（データなし）",
      "",
      "推移の見方、強み・弱み、次の大会に向けたアドバイスを含めてください。",
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
      .map((r) => `${r.label}: ${r.hits}/${r.total}中 (${formatHitRate(r.hitRate)})`)
      .join("\n");
    const arrowData = arrowStats
      .map((a) => `${a.arrowNumber}射目: ${a.hits}/${a.total}中 (${formatHitRate(a.hitRate)})`)
      .join("\n");

    prompt = [
      "あなたは高校弓道部の顧問を支援するコーチです。",
      "以下のチーム（立ち）的中データを分析し、実践に役立つコメントを日本語で約200字以内で書いてください。",
      "個人名は使わないでください。",
      "勉強・励めすぎない口調でお願いします。",
      "",
      `大会: ${tournamentName}`,
      `立ち別的中:`,
      roundData || "（データなし）",
      `射順（1〜4射目）の傾向:`,
      arrowData || "（データなし）",
      "",
      "立ち間の差、射順の傾向、次に向けたチームとしてのアドバイスを含めてください。",
    ].join("\n");
  } else {
    return NextResponse.json(
      { error: "不正な type です" },
      { status: 400 }
    );
  }

  try {
    const { text } = await generateText({
      model: google(process.env.GEMINI_MODEL || "gemini-3.5-flash"),
      prompt,
    });

    if (!text || !text.trim()) {
      return NextResponse.json(
        {
          error:
            "AIから空の応答が返りました。APIキーや利用上限を確認してください。",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ text });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("[ai analysis]", raw);

    let message = raw;
    if (/quota|billing|RESOURCE_EXHAUSTED|exceeded/i.test(raw)) {
      message =
        "Google AI の利用上限（クォータ）を超えています。aistudio.google.com で利用状況を確認してください。";
    } else if (/api key|API_KEY|PERMISSION_DENIED|unauthenticated|401|403/i.test(raw)) {
      message =
        "Google APIキーが無効です。GOOGLE_GENERATIVE_AI_API_KEY を確認してください。";
    } else if (/rate limit|429/i.test(raw)) {
      message =
        "Google AI のリクエスト制限に達しました。少し待って再試行してください。";
    } else if (/model|not found|404/i.test(raw)) {
      message = "Gemini モデルへの接続に失敗しました。" + raw;
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
