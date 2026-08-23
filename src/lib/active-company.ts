import { cookies } from "next/headers";

export const ACTIVE_COMPANY_COOKIE = "active_company_id";
export const LEGACY_BUSINESS_COOKIE = "sb-business-id";

/**
 * Retrieves the currently active company / business UUID from cookies.
 */
export function getActiveCompanyId(): string | undefined {
  try {
    const cookieStore = cookies();
    return (
      cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ||
      cookieStore.get(LEGACY_BUSINESS_COOKIE)?.value
    );
  } catch (err) {
    // In static rendering or non-request contexts, cookies() can throw
    return undefined;
  }
}

/**
 * Sets the active company ID cookie across the entire domain.
 */
export function setActiveCompanyId(companyId: string): void {
  try {
    const cookieStore = cookies();
    const cookieOptions = {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 90, // 90 days
    };

    cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, cookieOptions);
    cookieStore.set(LEGACY_BUSINESS_COOKIE, companyId, cookieOptions);
  } catch (err) {
    console.error("Failed to set active company cookie:", err);
  }
}

/**
 * Clears the active company cookie (e.g. on logout or invalid session).
 */
export function clearActiveCompanyId(): void {
  try {
    const cookieStore = cookies();
    cookieStore.delete(ACTIVE_COMPANY_COOKIE);
    cookieStore.delete(LEGACY_BUSINESS_COOKIE);
  } catch (err) {
    console.error("Failed to clear active company cookie:", err);
  }
}
