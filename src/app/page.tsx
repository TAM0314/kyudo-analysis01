import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate, tournamentTypeLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [tournaments, memberCount] = await Promise.all([
    prisma.tournament.findMany({
      orderBy: { date: "desc" },
      take: 5,
      include: {
        rounds: {
          include: { entries: { include: { shots: true } } },
        },
      },
    }),
    prisma.member.count(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">ダッシュボード</h1>
        <p className="text-stone-500 text-sm mt-1">直近の試合結果と部員情報</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-stone-500">登録部員数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{memberCount}</p>
            <p className="text-xs text-stone-400 mt-1">名</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-stone-500">
              登録大会・試合数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {await prisma.tournament.count()}
            </p>
            <p className="text-xs text-stone-400 mt-1">件</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-stone-500">クイックリンク</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link
              href="/input"
              className="text-sm text-stone-700 hover:underline"
            >
              → データを入力する
            </Link>
            <Link
              href="/analysis/individual"
              className="text-sm text-stone-700 hover:underline"
            >
              → 個人分析を見る
            </Link>
            <Link
              href="/analysis/team"
              className="text-sm text-stone-700 hover:underline"
            >
              → チーム分析を見る
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 直近の試合 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">直近の試合・大会</h2>
        {tournaments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-stone-400">
              まだデータがありません。
              <Link href="/input" className="underline ml-1">
                データを入力する
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => {
              const allShots = t.rounds.flatMap((r) =>
                r.entries.flatMap((e) => e.shots)
              );
              const hits = allShots.filter((s) => s.result === "HIT").length;
              const total = allShots.length;
              const rate =
                total > 0 ? Math.round((hits / total) * 100) : null;

              return (
                <Card key={t.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.name}</span>
                        <Badge variant="outline">
                          {tournamentTypeLabel(t.type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {formatDate(t.date)} ／ {t.rounds.length}立ち
                      </p>
                    </div>
                    <div className="text-right">
                      {rate !== null ? (
                        <>
                          <p className="text-2xl font-bold">{rate}%</p>
                          <p className="text-xs text-stone-400">
                            {hits}/{total}中
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-stone-400">データなし</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
