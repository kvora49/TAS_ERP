type ApiErrorBody = { error?: unknown; message?: unknown; code?: unknown; details?: unknown; errors?: Record<string, string[]> };

export interface UserFacingError {
  title: string;
  description: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function asMessage(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Converts network, database, and API failures into text that can safely be shown to users. */
function firstFieldError(errors: Record<string, string[]> | undefined): string | null {
  if (!errors) return null;
  for (const [field, messages] of Object.entries(errors)) {
    if (messages?.[0]) return `${field}: ${messages[0]}`;
  }
  return null;
}

export function getUserFacingError(error: unknown, fallback = "We couldn't complete that request. Please try again."): UserFacingError {
  const message = error instanceof Error ? error.message : asMessage(error);
  const apiError = error instanceof ApiRequestError ? error : null;
  const reason = apiError?.details && typeof apiError.details === "object"
    ? asMessage((apiError.details as { reason?: unknown }).reason)
    : null;
  const action = apiError?.details && typeof apiError.details === "object"
    ? asMessage((apiError.details as { action?: unknown }).action)
    : null;
  if (reason) return { title: "Action needs attention", description: action ? `${reason} ${action}` : reason };
  if (!message) return { title: "Action couldn't be completed", description: fallback };

  const lower = message.toLowerCase();
  if (lower.includes("insufficient") && (lower.includes("stock") || lower.includes("roll") || lower.includes("meter"))) return { title: "Not enough stock", description: `${message} Adjust the quantity or select available stock, then try again.` };
  if (lower === "http 400") return { title: "Check the form", description: "Some details are missing or invalid. Review the highlighted information and try again." };
  if (lower === "http 401" || lower.includes("jwt expired") || lower.includes("session has expired") || lower === "unauthorized") return { title: "Sign in again", description: "Your session has expired. Sign in, then repeat this action." };
  if (lower === "http 403" || lower.includes("forbidden") || lower.includes("row-level security") || lower.includes("permission denied")) return { title: "Permission required", description: "Your role does not allow this action. Ask an administrator if you need access." };
  if (lower === "http 404") return { title: "Record not found", description: "The requested record may have been removed. Refresh the page and try again." };
  if (lower === "http 409" || lower.includes("duplicate key") || lower.includes("already exists") || lower.includes("unique constraint") || lower.includes("23505")) return { title: "Duplicate record", description: "A record with the same value already exists. Change the duplicate value and try again." };
  if (lower === "http 413") return { title: "Request is too large", description: "Reduce the file size or number of items, then try again." };
  if (lower === "http 429") return { title: "Please wait", description: "Too many requests were sent. Wait a moment, then try again." };
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request failed")) return { title: "Connection problem", description: "Couldn't connect to TAS ERP. Check your internet connection and try again." };
  if (lower.includes("the string did not match the expected pattern") || lower.includes("unexpected token <")) return { title: "Invalid server response", description: "The server returned an invalid response. Try again; if it continues, contact support." };
  if (lower.includes("foreign key") || lower.includes("violates foreign key") || lower.includes("23503")) return { title: "Record is in use", description: "This record is linked to other data and cannot be changed or removed." };
  if (lower.includes("invalid input syntax") || lower.includes("22p02") || lower.includes("schema cache")) return { title: "Invalid submitted details", description: "Some submitted details are invalid or the system is being updated. Refresh the page and try again." };
  if (lower.includes("internal server error") || /http 50[0-4]/.test(lower)) return { title: "Server problem", description: "The server couldn't complete the request. Please try again in a moment." };

  // Messages deliberately returned by the app (stock and field validation, for example) are useful as-is.
  return { title: "Action couldn't be completed", description: message };
}

export function getUserFriendlyErrorMessage(error: unknown, fallback = "We couldn't complete that request. Please try again.") {
  return getUserFacingError(error, fallback).description;
}

export async function readApiJson<T>(response: Response, fallback: string): Promise<T> {
  let body: ApiErrorBody | T;
  try {
    body = await response.json();
  } catch {
    throw new ApiRequestError(getUserFriendlyErrorMessage(`HTTP ${response.status}`, fallback), response.status);
  }

  const errorBody = body as ApiErrorBody;
  if (!response.ok || errorBody?.error || errorBody?.code === "INTERNAL_ERROR") {
    const message = asMessage(errorBody?.error) || asMessage(errorBody?.message) || firstFieldError(errorBody?.errors) || `HTTP ${response.status}`;
    throw new ApiRequestError(getUserFriendlyErrorMessage(message, fallback), response.status, asMessage(errorBody?.code) || undefined, errorBody?.details);
  }
  return body as T;
}
