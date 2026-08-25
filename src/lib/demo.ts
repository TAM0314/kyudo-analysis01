import { NextResponse } from "next/server";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function demoResponse() {
  return NextResponse.json(
    { error: "デモ版のため、データの変更はできません" },
    { status: 403 }
  );
}
