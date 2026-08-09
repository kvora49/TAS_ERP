import { NextResponse } from "next/server";
import { processBackupSync } from "@/lib/backup/backupSync";

export async function POST(_request: Request) {
  const result = await processBackupSync();
  if (!result.success && result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}

export async function GET(_request: Request) {
  return POST(_request);
}
