"use client";

import { useState, useRef } from "react";
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

export default function SettingsPage() {
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excelエクスポート
  function handleExport() {
    window.location.href = "/api/excel?type=export";
  }

  // Excelインポート
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
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">設定</h1>
        <p className="text-stone-500 text-sm mt-1">
          Excelデータの入出力・AI設定
        </p>
      </div>

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

      {/* AI設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI分析設定（OpenAI）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-stone-500">
            AI分析機能（AIコーチコメント）を使うには、OpenAI の APIキーが必要です。
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
            データはローカルの SQLite データベースファイル（
            <code className="bg-stone-100 px-1 rounded">prisma/dev.db</code>
            ）に保存されます。
          </p>
          <p>
            定期的にExcelエクスポートでバックアップを取ることをお勧めします。
          </p>
          <p>
            将来的にVercel + Neon（クラウドDB）に移行すると、スマートフォン・タブレットからも入力できるようになります。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
