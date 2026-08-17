"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

type TournamentType = "PUBLIC" | "PRACTICE" | "SELECTION";

export interface ImportResult {
  ok: boolean;
  message: string;
  diagnostics: string | null;
  tournamentId?: number;
}

interface ImportContextValue {
  importing: boolean;
  result: ImportResult | null;
  runImport: (params: {
    file: File;
    sheetName: string;
    name: string;
    date: string;
    type: TournamentType;
  }) => Promise<ImportResult>;
  clearResult: () => void;
}

const ImportContext = createContext<ImportContextValue | null>(null);

export function ImportProvider({ children }: { children: ReactNode }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const runImport = useCallback(
    async (params: {
      file: File;
      sheetName: string;
      name: string;
      date: string;
      type: TournamentType;
    }): Promise<ImportResult> => {
      setImporting(true);
      setResult(null);

      const formData = new FormData();
      formData.append("file", params.file);
      formData.append("sheetName", params.sheetName);
      formData.append("name", params.name);
      formData.append("date", params.date);
      formData.append("type", params.type);

      try {
        const res = await fetch("/api/tournaments/import", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        let importResult: ImportResult;
        if (!res.ok) {
          importResult = {
            ok: false,
            message: data.error ?? "インポートに失敗しました",
            diagnostics:
              data.diagnosticText ??
              (data.warnings?.length ? data.warnings.join("\n") : null),
          };
        } else {
          const warn =
            data.warnings?.length > 0
              ? `（注意${data.warnings.length}件）`
              : "";
          const labels =
            data.tachiLabels?.length > 0
              ? `／立順: ${data.tachiLabels.join("、")}`
              : "";
          importResult = {
            ok: true,
            message: `${data.message}${warn}${labels}`,
            diagnostics: data.warnings?.length
              ? data.warnings.join("\n")
              : null,
            tournamentId: data.tournament?.id,
          };
        }

        setResult(importResult);
        return importResult;
      } catch {
        const importResult: ImportResult = {
          ok: false,
          message: "通信エラーが発生しました",
          diagnostics: null,
        };
        setResult(importResult);
        return importResult;
      } finally {
        setImporting(false);
      }
    },
    []
  );

  const clearResult = useCallback(() => setResult(null), []);

  return (
    <ImportContext.Provider value={{ importing, result, runImport, clearResult }}>
      {children}
    </ImportContext.Provider>
  );
}

export function useImport() {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error("useImport must be used within ImportProvider");
  return ctx;
}
