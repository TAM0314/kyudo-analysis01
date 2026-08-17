"use client";

import { ReactNode } from "react";
import { ImportProvider } from "@/contexts/ImportContext";
import { ImportProgressBanner } from "./ImportProgressBanner";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ImportProvider>
      <ImportProgressBanner />
      {children}
    </ImportProvider>
  );
}
