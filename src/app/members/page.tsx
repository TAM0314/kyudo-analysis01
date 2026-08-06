"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [number, setNumber] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE");
  const [grade, setGrade] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  // 一括登録（1〜N番）
  async function bulkAdd() {
    const input = prompt("何番まで一括登録しますか？（例: 40）");
    if (!input) return;
    const max = Number(input);
    if (isNaN(max) || max <= 0) return;

    const genderInput = prompt(
      "性別を入力してください（男 / 女）"
    );
    const g = genderInput === "女" ? "FEMALE" : "MALE";

    for (let i = 1; i <= max; i++) {
      const exists = members.find((m) => m.number === i);
      if (exists) continue;
      await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: i, gender: g }),
      });
    }
    setMessage(`${max}名まで一括登録しました`);
    await fetchMembers();
  }

  const males = members.filter((m) => m.gender === "MALE");
  const females = members.filter((m) => m.gender === "FEMALE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">部員管理</h1>
        <p className="text-stone-500 text-sm mt-1">
          部員の通し番号・性別・学年を管理します
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={() => setShowAdd(!showAdd)}>+ 部員を追加</Button>
        <Button variant="outline" onClick={bulkAdd}>
          一括登録
        </Button>
        {message && (
          <Badge variant="outline" className="self-center">
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
                <Label>通し番号</Label>
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
