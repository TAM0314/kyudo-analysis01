"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface TournamentItem {
  id: number;
  name: string;
  type: string;
  date: string;
  _count: { rounds: number };
}

interface MemberItem {
  id: number;
  number: number;
  gender: "MALE" | "FEMALE";
  grade: number | null;
  _count: { entries: number };
}

interface DataSummary {
  counts: {
    members: number;
    tournaments: number;
    rounds: number;
    entries: number;
    shots: number;
  };
  tournaments: TournamentItem[];
  members: MemberItem[];
}

function typeLabel(type: string) {
  if (type === "PUBLIC") return "公式戦";
  if (type === "PRACTICE") return "練習試合";
  if (type === "SELECTION") return "校内選考";
  return type;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ja-JP");
}

export default function SettingsPage() {
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [summary, setSummary] = useState<DataSummary | null>(null);
  const [selectedTournaments, setSelectedTournaments] = useState<number[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const fetchSummary = useCallback(async () => {
    const res = await fetch("/api/data");
    if (res.ok) {
      setSummary(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  function handleExport() {
    window.location.href = "/api/excel?type=export";
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/excel", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.errors?.length > 0) {
      setImportMessage(
        `${data.imported}件インポート、エラー${data.errors.length}件: ${data.errors[0]}`
      );
    } else {
      setImportMessage(`${data.imported}件のデータをインポートしました`);
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await fetchSummary();
  }

  async function runDelete(
    scope: "tournaments" | "members" | "match_data" | "all",
    ids?: number[],
    confirm?: string
  ) {
    setDeleting(true);
    setDeleteMessage(null);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, ids, confirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteMessage(data.error ?? "削除に失敗しました");
      } else {
        setDeleteMessage(data.message);
        setSelectedTournaments([]);
        setSelectedMembers([]);
        setConfirmText("");
        await fetchSummary();
      }
    } catch {
      setDeleteMessage("通信エラーが発生しました");
    }
    setDeleting(false);
  }

  function toggleTournament(id: number) {
    setSelectedTournaments((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleMember(id: number) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllTournaments() {
    if (!summary) return;
    if (selectedTournaments.length === summary.tournaments.length) {
      setSelectedTournaments([]);
    } else {
      setSelectedTournaments(summary.tournaments.map((t) => t.id));
    }
  }

  function selectAllMembers() {
    if (!summary) return;
    if (selectedMembers.length === summary.members.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(summary.members.map((m) => m.id));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">設定</h1>
        <p className="text-stone-500 text-sm mt-1">
          Excelデータの入出力・データ消去・AI設定
        </p>
      </div>

      {/* データ概要 */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">登録データ概要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div className="bg-stone-50 rounded p-3">
                <p className="text-2xl font-bold">{summary.counts.members}</p>
                <p className="text-xs text-stone-500">部員</p>
              </div>
              <div className="bg-stone-50 rounded p-3">
                <p className="text-2xl font-bold">
                  {summary.counts.tournaments}
                </p>
                <p className="text-xs text-stone-500">大会・試合</p>
              </div>
              <div className="bg-stone-50 rounded p-3">
                <p className="text-2xl font-bold">{summary.counts.rounds}</p>
                <p className="text-xs text-stone-500">立ち</p>
              </div>
              <div className="bg-stone-50 rounded p-3">
                <p className="text-2xl font-bold">{summary.counts.entries}</p>
                <p className="text-xs text-stone-500">出場記録</p>
              </div>
              <div className="bg-stone-50 rounded p-3">
                <p className="text-2xl font-bold">{summary.counts.shots}</p>
                <p className="text-xs text-stone-500">矢記録</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Excel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Excelデータ入出力</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm font-medium text-stone-700 mb-2">
              エクスポート
            </p>
            <p className="text-sm text-stone-500 mb-3">
              現在登録されているすべての的中データをExcel（.xlsx）でダウンロードします。
            </p>
            <Button onClick={handleExport}>Excelでダウンロード</Button>
          </div>

          <div className="border-t pt-5">
            <p className="text-sm font-medium text-stone-700 mb-2">
              インポート
            </p>
            <p className="text-sm text-stone-500 mb-3">
              エクスポートと同じ形式のExcelファイルを読み込みます。
              既存データがある場合は上書き更新されます。
            </p>
            <div className="flex gap-3 items-center">
              <Label
                htmlFor="import-file"
                className="cursor-pointer inline-flex items-center px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-md text-sm font-medium transition-colors"
              >
                {importing ? "インポート中..." : "Excelファイルを選択"}
              </Label>
              <Input
                id="import-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
                disabled={importing}
              />
              {importMessage && (
                <Badge
                  variant={
                    importMessage.includes("エラー") ? "destructive" : "default"
                  }
                >
                  {importMessage}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 部分消去 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">部分消去</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {deleteMessage && (
            <div
              className={`text-sm rounded p-3 ${
                deleteMessage.includes("失敗") ||
                deleteMessage.includes("エラー")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {deleteMessage}
            </div>
          )}

          {/* 大会単位 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-stone-700">
                大会・試合を選択して削除
              </p>
              <button
                type="button"
                onClick={selectAllTournaments}
                className="text-xs text-stone-500 underline"
              >
                {summary &&
                selectedTournaments.length === summary.tournaments.length &&
                summary.tournaments.length > 0
                  ? "選択解除"
                  : "すべて選択"}
              </button>
            </div>
            <p className="text-sm text-stone-500 mb-3">
              選んだ大会の立ち・出場記録・矢記録もまとめて削除されます。
            </p>
            {!summary || summary.tournaments.length === 0 ? (
              <p className="text-sm text-stone-400">大会データがありません</p>
            ) : (
              <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                {summary.tournaments.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-stone-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTournaments.includes(t.id)}
                      onChange={() => toggleTournament(t.id)}
                      className="size-4"
                    />
                    <span className="flex-1 text-sm">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-stone-400 ml-2">
                        {formatDate(t.date)} / {typeLabel(t.type)} /{" "}
                        {t._count.rounds}立ち
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <Button
              className="mt-3"
              variant="destructive"
              disabled={deleting || selectedTournaments.length === 0}
              onClick={() => {
                if (
                  !confirm(
                    `選択した${selectedTournaments.length}件の大会・試合を削除しますか？`
                  )
                )
                  return;
                runDelete("tournaments", selectedTournaments);
              }}
            >
              選択した大会を削除
              {selectedTournaments.length > 0
                ? `（${selectedTournaments.length}件）`
                : ""}
            </Button>
          </div>

          {/* 部員単位 */}
          <div className="border-t pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-stone-700">
                部員を選択して削除
              </p>
              <button
                type="button"
                onClick={selectAllMembers}
                className="text-xs text-stone-500 underline"
              >
                {summary &&
                selectedMembers.length === summary.members.length &&
                summary.members.length > 0
                  ? "選択解除"
                  : "すべて選択"}
              </button>
            </div>
            <p className="text-sm text-stone-500 mb-3">
              選んだ部員の出場記録・矢記録もまとめて削除されます。
            </p>
            {!summary || summary.members.length === 0 ? (
              <p className="text-sm text-stone-400">部員データがありません</p>
            ) : (
              <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                {summary.members.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-stone-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                      className="size-4"
                    />
                    <span className="flex-1 text-sm">
                      <span className="font-medium">{m.number}番</span>
                      <span className="text-stone-400 ml-2">
                        {m.gender === "MALE" ? "男子" : "女子"}
                        {m.grade != null ? ` / ${m.grade}年` : ""}
                        {m._count.entries > 0
                          ? ` / 記録${m._count.entries}件`
                          : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <Button
              className="mt-3"
              variant="destructive"
              disabled={deleting || selectedMembers.length === 0}
              onClick={() => {
                if (
                  !confirm(
                    `選択した${selectedMembers.length}名の部員を削除しますか？`
                  )
                )
                  return;
                runDelete("members", selectedMembers);
              }}
            >
              選択した部員を削除
              {selectedMembers.length > 0
                ? `（${selectedMembers.length}名）`
                : ""}
            </Button>
          </div>

          {/* 試合データのみ全削除 */}
          <div className="border-t pt-5">
            <p className="text-sm font-medium text-stone-700 mb-2">
              試合データだけ全削除（部員は残す）
            </p>
            <p className="text-sm text-stone-500 mb-3">
              大会・立ち・出場記録・矢記録をすべて消します。部員名簿は残ります。
            </p>
            <Button
              variant="destructive"
              disabled={
                deleting || !summary || summary.counts.tournaments === 0
              }
              onClick={() => {
                if (
                  !confirm(
                    "すべての大会・試合データを削除します。部員は残ります。よろしいですか？"
                  )
                )
                  return;
                runDelete("match_data");
              }}
            >
              試合データをすべて削除
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 全消去 */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-700">全消去</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-stone-500">
            部員・大会・立ち・出場記録・矢記録をすべて消去します。
            この操作は取り消せません。事前にExcelエクスポートでバックアップしてください。
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirm-delete" className="text-sm">
              確認のため「DELETE」と入力してください
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="max-w-xs font-mono"
              disabled={deleting}
            />
          </div>
          <Button
            variant="destructive"
            disabled={deleting || confirmText !== "DELETE"}
            onClick={() => {
              if (
                !confirm(
                  "本当にすべてのデータを消去しますか？この操作は取り消せません。"
                )
              )
                return;
              runDelete("all", undefined, "DELETE");
            }}
          >
            すべてのデータを消去する
          </Button>
        </CardContent>
      </Card>

      {/* AI設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI分析設定（OpenAI）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-stone-500">
            AI分析機能（AIコーチコメント）を使うには、OpenAI の
            APIキーが必要です。
            <br />
            プロジェクトフォルダの{" "}
            <code className="bg-stone-100 px-1 rounded">.env.local</code>{" "}
            ファイルに以下を追記してください：
          </p>
          <div className="bg-stone-900 text-stone-100 rounded-md p-4 text-sm font-mono">
            OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
          </div>
          <p className="text-xs text-stone-400">
            ※ APIキーは{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              OpenAI Platform
            </a>{" "}
            で取得できます。設定後はサーバーを再起動してください。
            <br />
            Vercel では環境変数に{" "}
            <code className="bg-stone-100 px-1 rounded">OPENAI_API_KEY</code>{" "}
            を設定してください。
          </p>
        </CardContent>
      </Card>

      {/* データ管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">データについて</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-stone-500 space-y-2">
          <p>
            データは Neon（PostgreSQL）に保存されています。ローカル開発と
            Vercel 本番で同じデータベースを参照します。
          </p>
          <p>
            定期的にExcelエクスポートでバックアップを取ることをお勧めします。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
