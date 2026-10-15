const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

/** Only this public pair can enter browser bundles. Worker secrets are never copied. */
export function resolveSupabaseBuildEnv(environment, wranglerText) {
  const varsSection = wranglerText.split(/^\[vars\]\s*$/m)[1]?.split(/^\[/m)[0] || "";
  const configured = Object.fromEntries(names.map(name => {
    const match = varsSection.match(new RegExp(`^${name}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")\\s*(?:#.*)?$`, "m"));
    return [name, match ? JSON.parse(match[1]) : ""];
  }));
  const hasOverride = names.some(name => typeof environment[name] === "string" && environment[name].trim());
  const result = Object.fromEntries(names.map(name => [name, String((hasOverride ? environment[name] : configured[name]) || "").trim()]));
  if (names.some(name => !result[name])) throw new Error("Supabase build configuration is incomplete. Set both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in build variables, or configure the public pair in wrangler.toml [vars].");
  let url;
  try { url = new URL(result.NEXT_PUBLIC_SUPABASE_URL); } catch { throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."); }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Supabase URL must use HTTPS (HTTP is allowed for local development).");
  const key = result.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key.startsWith("sb_publishable_")) {
    let claims;
    try { claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")); } catch { throw new Error("Supabase browser configuration requires an anon or publishable key."); }
    if (claims.role !== "anon") throw new Error("Only a Supabase anon or publishable key may be included in the browser build.");
    if (url.hostname.endsWith(".supabase.co") && claims.ref && url.hostname.split(".")[0] !== claims.ref) throw new Error("Supabase URL and browser key refer to different projects.");
  }
  return result;
}
