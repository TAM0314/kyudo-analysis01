"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Member {
  id: number;
  number: number;
  gender: "MALE" | "FEMALE";
  grade: number | null;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [number, setNumber] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE");
  const [grade, setGrade] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [listingSheets, setListingSheets] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMembers = useCallback(async () => {
    const res = await fetch("/api/members");
    setMembers(await res.json());
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function addMember() {
    if (!number) return;
    setSaving(true);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number, gender, grade: grade || null }),
    });
    if (res.ok) {
      setMessage("部員を追加しました");
      setNumber("");
      setGrade("");
      setGender("MALE");
      setShowAdd(false);
      await fetchMembers();
    } else {
      const err = await res.json();
      setMessage(err.error);
    }
    setSaving(false);
  }

  async function deleteMember(id: number) {
    if (!confirm("この部員を削除しますか？関連する記録も削除されます。")) return;
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    await fetchMembers();
  }

  function clearImportSelection() {
    setImportFile(null);
    setSheetNames([]);
    setSelectedSheet("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    setImportFile(file);
    setSheetNames([]);
    setSelectedSheet("");
    setListingSheets(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("listOnly", "true");

    try {
      const res = await fetch("/api/members/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "シート一覧の取得に失敗しました");
        clearImportSelection();
      } else {
        setSheetNames(data.sheets ?? []);
        setSelectedSheet(data.suggested ?? data.sheets?.[0] ?? "");
      }
    } catch {
      setMessage("通信エラーが発生しました");
      clearImportSelection();
    }
    setListingSheets(false);
  }

  async function handleExcelImport() {
    if (!importFile || !selectedSheet) return;
    setImporting(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("sheetName", selectedSheet);

    try {
      const res = await fetch("/api/members/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "インポートに失敗しました");
      } else {
        const errNote =
          data.errors?.length > 0
            ? `（エラー${data.errors.length}件: ${data.errors[0]}）`
            : "";
        setMessage(`${data.message}${errNote}`);
        clearImportSelection();
        await fetchMembers();
      }
    } catch {
      setMessage("通信エラーが発生しました");
    }

    setImporting(false);
  }

  const males = members.filter((m) => m.gender === "MALE");
  const females = members.filter((m) => m.gender === "FEMALE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">部員管理</h1>
        <p className="text-stone-500 text-sm mt-1">
          部員の番号・性別・学年を管理します
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setShowAdd(!showAdd)}>+ 部員を追加</Button>
        <Button
          variant="outline"
          onClick={() => setShowImport(!showImport)}
        >
          Excelからインポート
        </Button>
        {message && (
          <Badge variant="outline" className="self-center max-w-md truncate">
            {message}
          </Badge>
        )}
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">部員追加</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>番号</Label>
                <Input
                  type="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="例: 1"
                  min={1}
                />
              </div>
              <div>
                <Label>性別</Label>
                <Select
                  value={gender}
                  onValueChange={(v) => setGender(v as "MALE" | "FEMALE")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">男</SelectItem>
                    <SelectItem value="FEMALE">女</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>学年（任意）</Label>
                <Select
                  value={grade}
                  onValueChange={(v) => setGrade(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="未設定" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">未設定</SelectItem>
                    <SelectItem value="1">1年</SelectItem>
                    <SelectItem value="2">2年</SelectItem>
                    <SelectItem value="3">3年</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={addMember} disabled={saving}>
              {saving ? "追加中..." : "追加"}
            </Button>
          </CardContent>
        </Card>
      )}

      {showImport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Excelから部員インポート</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-stone-500">
              既存の部員はそのまま残します。同じ番号がある場合は性別・学年を更新し、
              ない番号は新規追加します。A列の氏名など個人情報は読み込みません。
            </p>
            <div className="bg-stone-50 rounded-md p-3 text-sm text-stone-600 space-y-1">
              <p className="font-medium text-stone-700">読み込む列</p>
              <p>
                <code className="bg-white px-1 rounded border">番号</code>
                （または通し番号）
                {" / "}
                <code className="bg-white px-1 rounded border">性別</code>
                （男 または 女）
                {" / "}
                <code className="bg-white px-1 rounded border">学年</code>
                （任意・1〜3）
              </p>
              <p className="text-xs text-stone-400">
                ※ テンプレートはA列空欄・B列から番号/性別/学年です。氏名は入れないでください
              </p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = "/api/members/import";
                }}
              >
                テンプレートをダウンロード
              </Button>
              <Label
                htmlFor="member-import-file"
                className="cursor-pointer inline-flex items-center px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-md text-sm font-medium transition-colors"
              >
                {listingSheets
                  ? "シート確認中..."
                  : importFile
                    ? "別のファイルを選ぶ"
                    : "Excelファイルを選択"}
              </Label>
              <Input
                id="member-import-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelected}
                disabled={importing || listingSheets}
              />
              {importFile && (
                <span className="text-sm text-stone-500 truncate max-w-xs">
                  {importFile.name}
                </span>
              )}
            </div>

            {sheetNames.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <div className="max-w-xs">
                  <Label>読み込むシート</Label>
                  <Select
                    value={selectedSheet}
                    onValueChange={(v) => setSelectedSheet(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="シートを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleExcelImport}
                  disabled={importing || !selectedSheet}
                >
                  {importing
                    ? "インポート中..."
                    : `「${selectedSheet}」をインポート`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {[
          { label: "男子部員", list: males },
          { label: "女子部員", list: females },
        ].map(({ label, list }) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-base">
                {label}（{list.length}名）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <p className="text-stone-400 text-sm">登録なし</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {list.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-stone-50 group"
                    >
                      <span className="text-sm">
                        No.{m.number}
                        {m.grade && (
                          <span className="text-stone-400 ml-2 text-xs">
                            {m.grade}年
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => deleteMember(m.id)}
                        className="text-xs text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
