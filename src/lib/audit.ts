import { createClient } from "@/lib/supabase/server";

export async function logAudit(
  businessId: string,
  action: string,
  tableName: string,
  recordId: string,
  newValues: any,
  oldValues: any = {}
) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  try {
    await supabase.from("audit_log").insert({
      business_id: businessId,
      user_id: user?.id || null,
      user_name: user?.user_metadata?.full_name || user?.email || "System",
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: "127.0.0.1",
      user_agent: "NextJS Server",
    });
  } catch (err) {
    console.error("Failed to log audit:", err);
  }
}
