import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { restoreDatabaseBackup } from "@/lib/backup/backupEngine";

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No backup file provided." }, { status: 400 });
    }

    if (!file.name.endsWith(".sql") && !file.name.endsWith(".json")) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload a valid .sql or .json backup file." },
        { status: 400 }
      );
    }

    const fileContent = await file.text();
    if (!fileContent || fileContent.trim().length === 0) {
      return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
    }

    const restoreResult = await restoreDatabaseBackup(supabase, businessId, fileContent);

    if (!restoreResult.success) {
      return NextResponse.json({ error: restoreResult.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: restoreResult.message,
      restoredCounts: restoreResult.restoredCounts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Database restoration failed." },
      { status: 500 }
    );
  }
}
