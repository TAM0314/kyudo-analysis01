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
import { shotResultLabel, shotResultColor } from "@/lib/utils";

type ShotResult = "HIT" | "MISS" | "SHITSU";
type TournamentType = "PUBLIC" | "PRACTICE" | "SELECTION";

interface Tournament {
  id: number;
  name: string;
  type: TournamentType;
  date: string;
  rounds: Round[];
}

interface Round {
  id: number;
  roundNumber: number;
  label: string | null;
}

interface Member {
  id: number;
  number: number;
  gender: "MALE" | "FEMALE";
  grade: number | null;
}

interface ShotInput {
  arrowNumber: number;
  result: ShotResult | null;
}

interface EntryRow {
  memberId: number | null;
  positionInRound: number;
  shots: ShotInput[];
  saved: boolean;
}

const EMPTY_SHOTS: ShotInput[] = [
  { arrowNumber: 1, result: null },
  { arrowNumber: 2, result: null },
  { arrowNumber: 3, result: null },
  { arrowNumber: 4, result: null },
];

export default function InputPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [selectedTournamentId, setSelectedTournamentId] = useState<
    number | null
  >(null);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);

  // 新規大会フォーム
  const [showNewTournament, setShowNewTournament] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState("");
  const [newTournamentType, setNewTournamentType] =
    useState<TournamentType>("PUBLIC");
  const [newTournamentDate, setNewTournamentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // 新規立ちフォーム
  const [showNewRound, setShowNewRound] = useState(false);
  const [newRoundLabel, setNewRoundLabel] = useState("");

  // エントリー行
  const [entries, setEntries] = useState<EntryRow[]>([
    {
      memberId: null,
      positionInRound: 1,
      shots: EMPTY_SHOTS.map((s) => ({ ...s })),
      saved: false,
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Excelインポート
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [listingSheets, setListingSheets] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importName, setImportName] = useState("");
  const [importDate, setImportDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [importType, setImportType] = useState<TournamentType>("PUBLIC");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importDiagnostics, setImportDiagnostics] = useState<string | null>(
    null
  );
  const importFileRef = useRef<HTMLInputElement>(null);

  const fetchTournaments = useCallback(async () => {
    const res = await fetch("/api/tournaments");
    const data = await res.json();
    setTournaments(data);
  }, []);

  const fetchMembers = useCallback(async () => {
    const res = await fetch("/api/members");
    const data = await res.json();
    setMembers(data);
  }, []);

  useEffect(() => {
    fetchTournaments();
    fetchMembers();
  }, [fetchTournaments, fetchMembers]);

  const selectedTournament = tournaments.find(
    (t) => t.id === selectedTournamentId
  );

  // 大会作成
  async function createTournament() {
    if (!newTournamentName) return;
    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newTournamentName,
        type: newTournamentType,
        date: newTournamentDate,
      }),
    });
    const t = await res.json();
    await fetchTournaments();
    setSelectedTournamentId(t.id);
    setShowNewTournament(false);
    setNewTournamentName("");
  }

  // 立ち作成
  async function createRound() {
    if (!selectedTournamentId) return;
    const roundNumber = (selectedTournament?.rounds.length ?? 0) + 1;
    const res = await fetch("/api/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId: selectedTournamentId,
        roundNumber,
        label: newRoundLabel || `予選${roundNumber}立ち`,
      }),
    });
    const round = await res.json();
    await fetchTournaments();
    setSelectedRoundId(round.id);
    setShowNewRound(false);
    setNewRoundLabel("");
  }

  // 矢の結果を切り替える（○→×→/→未入力→○）
  function cycleShot(entryIdx: number, arrowIdx: number) {
    const cycle: (ShotResult | null)[] = ["HIT", "MISS", "SHITSU", null];
    setEntries((prev) => {
      const next = [...prev];
      const entry = { ...next[entryIdx] };
      const shots = [...entry.shots];
      const current = shots[arrowIdx].result;
      const nextIdx = (cycle.indexOf(current) + 1) % cycle.length;
      shots[arrowIdx] = { ...shots[arrowIdx], result: cycle[nextIdx] };
      entry.shots = shots;
      next[entryIdx] = entry;
      return next;
    });
  }

  // エントリー行追加
  function addRow() {
    setEntries((prev) => [
      ...prev,
      {
        memberId: null,
        positionInRound: prev.length + 1,
        shots: EMPTY_SHOTS.map((s) => ({ ...s })),
        saved: false,
      },
    ]);
  }

  // エントリー行削除
  function removeRow(idx: number) {
    setEntries((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((e, i) => ({ ...e, positionInRound: i + 1 }))
    );
  }

  // 保存
  async function saveAll() {
    if (!selectedRoundId) {
      setMessage("立ちを選択してください");
      return;
    }
    const unsaved = entries.filter((e) => e.memberId && !e.saved);
    if (unsaved.length === 0) {
      setMessage("保存するデータがありません");
      return;
    }
    setSaving(true);
    setMessage(null);

    for (const entry of unsaved) {
      const shots = entry.shots
        .filter((s) => s.result !== null)
        .map((s) => ({ arrowNumber: s.arrowNumber, result: s.result }));
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: selectedRoundId,
          memberId: entry.memberId,
          positionInRound: entry.positionInRound,
          shots,
        }),
      });
    }

    setSaving(false);
    setMessage(`${unsaved.length}件のデータを保存しました`);
    setEntries((prev) => prev.map((e) => ({ ...e, saved: true })));
  }

  function clearImport() {
    setImportFile(null);
    setSheetNames([]);
    setSelectedSheet("");
    setImportName("");
    if (importFileRef.current) importFileRef.current.value = "";
  }

  async function handleImportFileSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMessage(null);
    setImportDiagnostics(null);
    setImportFile(file);
    setSheetNames([]);
    setSelectedSheet("");
    setListingSheets(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("listOnly", "true");

    try {
      const res = await fetch("/api/tournaments/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportMessage(data.error ?? "シート一覧の取得に失敗しました");
        clearImport();
      } else {
        setSheetNames(data.sheets ?? []);
        setSelectedSheet(data.suggested ?? data.sheets?.[0] ?? "");
      }
    } catch {
      setImportMessage("通信エラーが発生しました");
      clearImport();
    }
    setListingSheets(false);
  }

  async function runTournamentImport() {
    if (!importFile || !selectedSheet) return;
    setImporting(true);
    setImportMessage(null);
    setImportDiagnostics(null);

    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("sheetName", selectedSheet);
    formData.append("name", importName);
    formData.append("date", importDate);
    formData.append("type", importType);

    try {
      const res = await fetch("/api/tournaments/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportMessage(data.error ?? "インポートに失敗しました");
        setImportDiagnostics(
          data.diagnosticText ??
            (data.warnings?.length
              ? data.warnings.join("\n")
              : null)
        );
      } else {
        const warn =
          data.warnings?.length > 0
            ? `（注意${data.warnings.length}件）`
            : "";
        setImportMessage(`${data.message}${warn}`);
        if (data.warnings?.length) {
          setImportDiagnostics(data.warnings.join("\n"));
        }
        clearImport();
        await fetchTournaments();
        await fetchMembers();
        if (data.tournament?.id) {
          setSelectedTournamentId(data.tournament.id);
          setSelectedRoundId(null);
        }
      }
    } catch {
      setImportMessage("通信エラーが発生しました");
    }
    setImporting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">データ入力</h1>
        <p className="text-stone-500 text-sm mt-1">
          大会・立ちを選択して、矢の○×/を入力してください。大会結果Excelからも取り込めます。
        </p>
      </div>

      {/* Excelインポート */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">大会結果Excelから取り込む</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(!showImport)}
          >
            {showImport ? "閉じる" : "開く"}
          </Button>
        </CardHeader>
        {showImport && (
          <CardContent className="space-y-4">
            <p className="text-sm text-stone-500">
              立順・番号・性別・1回目/2回目の○×を読み込みます。氏名は読みません。
              未登録の番号は部員として自動追加し、決勝射詰めは無視します。
            </p>

            <div className="flex flex-wrap gap-3 items-center">
              <Label
                htmlFor="tournament-import-file"
                className="cursor-pointer inline-flex items-center px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-md text-sm font-medium"
              >
                {listingSheets
                  ? "シート確認中..."
                  : importFile
                    ? "別のファイルを選ぶ"
                    : "Excelファイルを選択"}
              </Label>
              <Input
                id="tournament-import-file"
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportFileSelected}
                disabled={importing || listingSheets}
              />
              {importFile && (
                <span className="text-sm text-stone-500 truncate max-w-xs">
                  {importFile.name}
                </span>
              )}
            </div>

            {sheetNames.length > 0 && (
              <div className="space-y-3 border rounded-md p-4 bg-stone-50">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
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
                  <div>
                    <Label>大会名</Label>
                    <Input
                      value={importName}
                      onChange={(e) => setImportName(e.target.value)}
                      placeholder="空欄ならExcel見出しを使用"
                    />
                  </div>
                  <div>
                    <Label>種別</Label>
                    <Select
                      value={importType}
                      onValueChange={(v) =>
                        setImportType(v as TournamentType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLIC">公式戦</SelectItem>
                        <SelectItem value="PRACTICE">練習試合</SelectItem>
                        <SelectItem value="SELECTION">校内選考</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>日付</Label>
                    <Input
                      type="date"
                      value={importDate}
                      onChange={(e) => setImportDate(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={runTournamentImport}
                  disabled={importing || !selectedSheet}
                >
                  {importing ? "取り込み中..." : "この内容で取り込む"}
                </Button>
              </div>
            )}

            {importMessage && (
              <div
                className={`text-sm rounded p-3 ${
                  importMessage.includes("失敗") ||
                  importMessage.includes("ありません") ||
                  importMessage.includes("エラー")
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
              >
                {importMessage}
              </div>
            )}
            {importDiagnostics && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-700">
                  診断情報（この内容を共有すると原因特定が早いです）
                </p>
                <pre className="text-xs bg-stone-900 text-stone-100 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-80">
                  {importDiagnostics}
                </pre>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(importDiagnostics);
                      setImportMessage(
                        (importMessage ?? "") + "（診断情報をコピーしました）"
                      );
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  診断情報をコピー
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* 大会選択 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">① 大会・試合を選択</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Select
                value={selectedTournamentId?.toString() ?? ""}
                onValueChange={(v) => {
                  setSelectedTournamentId(Number(v));
                  setSelectedRoundId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="大会を選択..." />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}（
                      {t.type === "PUBLIC"
                        ? "公式戦"
                        : t.type === "PRACTICE"
                        ? "練習試合"
                        : "校内選考"}
                      ）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowNewTournament(!showNewTournament)}
            >
              新規作成
            </Button>
          </div>

          {showNewTournament && (
            <div className="border rounded-md p-4 bg-stone-50 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>大会名</Label>
                  <Input
                    value={newTournamentName}
                    onChange={(e) => setNewTournamentName(e.target.value)}
                    placeholder="例: ○○高校弓道大会"
                  />
                </div>
                <div>
                  <Label>種別</Label>
                  <Select
                    value={newTournamentType}
                    onValueChange={(v) =>
                      setNewTournamentType(v as TournamentType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">公式戦</SelectItem>
                      <SelectItem value="PRACTICE">練習試合</SelectItem>
                      <SelectItem value="SELECTION">校内選考</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>日付</Label>
                  <Input
                    type="date"
                    value={newTournamentDate}
                    onChange={(e) => setNewTournamentDate(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={createTournament}>作成</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 立ち選択 */}
      {selectedTournamentId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">② 立ちを選択</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Select
                  value={selectedRoundId?.toString() ?? ""}
                  onValueChange={(v) => setSelectedRoundId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="立ちを選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTournament?.rounds.map((r) => (
                      <SelectItem key={r.id} value={r.id.toString()}>
                        {r.label ?? `${r.roundNumber}立ち目`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowNewRound(!showNewRound)}
              >
                立ちを追加
              </Button>
            </div>

            {showNewRound && (
              <div className="border rounded-md p-4 bg-stone-50 space-y-3">
                <div>
                  <Label>立ちのラベル（例: 予選1立ち）</Label>
                  <Input
                    value={newRoundLabel}
                    onChange={(e) => setNewRoundLabel(e.target.value)}
                    placeholder={`予選${(selectedTournament?.rounds.length ?? 0) + 1}立ち`}
                  />
                </div>
                <Button onClick={createRound}>追加</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 的中入力テーブル */}
      {selectedRoundId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">③ 的中入力</CardTitle>
            <p className="text-sm text-stone-500">
              矢のマスをタップするたびに ○ → × → ／ → 未入力 と切り替わります
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3 font-medium text-stone-600 w-24">
                      番号
                    </th>
                    {[1, 2, 3, 4].map((n) => (
                      <th
                        key={n}
                        className="text-center py-2 px-2 font-medium text-stone-600 w-12"
                      >
                        {n}射
                      </th>
                    ))}
                    <th className="text-center py-2 font-medium text-stone-600 w-16">
                      的中
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const hits = entry.shots.filter(
                      (s) => s.result === "HIT"
                    ).length;
                    return (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <Select
                            value={entry.memberId?.toString() ?? ""}
                            onValueChange={(v) => {
                              setEntries((prev) => {
                                const next = [...prev];
                                next[idx] = {
                                  ...next[idx],
                                  memberId: Number(v),
                                };
                                return next;
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map((m) => (
                                <SelectItem
                                  key={m.id}
                                  value={m.id.toString()}
                                >
                                  No.{m.number}（
                                  {m.gender === "MALE" ? "男" : "女"}
                                  {m.grade ? `・${m.grade}年` : ""}）
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {entry.shots.map((shot, arrowIdx) => (
                          <td key={arrowIdx} className="py-2 px-1 text-center">
                            <button
                              onClick={() => cycleShot(idx, arrowIdx)}
                              className={`w-10 h-10 rounded-md border text-lg font-bold transition-colors
                                ${
                                  shot.result === "HIT"
                                    ? "bg-emerald-100 border-emerald-400 text-emerald-700"
                                    : shot.result === "MISS"
                                    ? "bg-red-50 border-red-300 text-red-600"
                                    : shot.result === "SHITSU"
                                    ? "bg-amber-50 border-amber-300 text-amber-600"
                                    : "bg-stone-100 border-stone-300 text-stone-400"
                                }
                              `}
                            >
                              {shot.result
                                ? shotResultLabel(shot.result)
                                : "−"}
                            </button>
                          </td>
                        ))}
                        <td className="py-2 text-center">
                          <span
                            className={`font-bold ${
                              shotResultColor(
                                hits >= 3
                                  ? "HIT"
                                  : hits === 0
                                  ? "MISS"
                                  : "SHITSU"
                              )
                            }`}
                          >
                            {hits}/4
                          </span>
                        </td>
                        <td className="py-2 pl-2">
                          {entries.length > 1 && (
                            <button
                              onClick={() => removeRow(idx)}
                              className="text-stone-400 hover:text-red-500 text-xs"
                            >
                              削除
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={addRow} className="text-sm">
                + 行を追加
              </Button>
              <Button onClick={saveAll} disabled={saving}>
                {saving ? "保存中..." : "保存する"}
              </Button>
              {message && (
                <Badge
                  variant={
                    message.includes("保存しました") ? "default" : "destructive"
                  }
                >
                  {message}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
