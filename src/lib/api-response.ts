import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { getUserFacingError, getUserFriendlyErrorMessage } from "@/lib/user-friendly-error";

export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: any;
  error?: string;
  code?: string;
  errors?: Record<string, string[]>;
  details?: any;
}

/**
 * Returns a standardized JSON success response.
 */
export function apiSuccess<T = any>(
  data: T,
  meta?: any,
  status = 200
): NextResponse<StandardApiResponse<T>> {
  const body: StandardApiResponse<T> = {
    success: true,
    data,
  };
  if (meta !== undefined) {
    body.meta = meta;
  }
  return NextResponse.json(body, { status });
}

/**
 * Returns a standardized JSON error response.
 */
export function apiError(
  message: string,
  status = 500,
  code = "INTERNAL_ERROR",
  details?: any
): NextResponse<StandardApiResponse> {
  const body: StandardApiResponse = {
    success: false,
    error: message,
    code,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

/**
 * Robust error handling helper that catches Zod errors, Postgres/Supabase errors,
 * and uncaught exceptions, converting them into safe, sanitized HTTP responses.
 */
export function handleApiError(error: unknown): NextResponse<StandardApiResponse> {
  console.error("[API Error Handler]:", error);

  // 1. Zod Validation Error
  if (error instanceof ZodError) {
    const issues = error.issues || (error as any).errors || [];
    const firstErrorMessage = issues[0]?.message || "Validation failed";
    const fieldErrors = typeof error.flatten === "function" ? error.flatten().fieldErrors : {};

    return NextResponse.json(
      {
        success: false,
        error: firstErrorMessage,
        code: "VALIDATION_ERROR",
        errors: fieldErrors as Record<string, string[]>,
        details: {
          reason: firstErrorMessage,
          action: "Correct the indicated field and submit again.",
        },
      },
      { status: 400 }
    );
  }

  // 2. Standard Error object
  const err = error as any;
  const message: string = err?.message || (typeof error === "string" ? error : "An unexpected error occurred");
  const code: string = err?.code || "INTERNAL_ERROR";
  let status: number = typeof err?.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;

  // Detect specific auth / permission messages
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes("unauthorized") || lowerMsg.includes("jwt expired") || lowerMsg.includes("session")) {
    status = 401;
  } else if (lowerMsg.includes("forbidden") || lowerMsg.includes("insufficient") || lowerMsg.includes("permission")) {
    status = 403;
  } else if (lowerMsg.includes("not found") || lowerMsg.includes("no rows")) {
    status = 404;
  } else if (lowerMsg.includes("duplicate key") || lowerMsg.includes("already exists") || code === "23505") {
    status = 409;
  }

  // In production, sanitize database internals and technical SQL constraints
  let clientMessage = getUserFriendlyErrorMessage(message, "We couldn't complete that request. Please try again.");
  if (process.env.NODE_ENV === "production" && status === 500) {
    if (
      code?.startsWith("23") ||
      code?.startsWith("42") ||
      lowerMsg.includes("relation") ||
      lowerMsg.includes("constraint") ||
      lowerMsg.includes("syntax error") ||
      lowerMsg.includes("select") ||
      lowerMsg.includes("insert into")
    ) {
      clientMessage = "A database error occurred while processing your request. Please contact support if this persists.";
    }
  }
  const userError = getUserFacingError(clientMessage, "We couldn't complete that request. Please try again.");
  const action = status === 401
    ? "Sign in again, then repeat the action."
    : status === 403
    ? "Ask an administrator if you need access."
    : status === 404
    ? "Refresh the page and confirm the record still exists."
    : status === 409
    ? "Refresh the page, review the existing record, and try again."
    : "Review the reason above and try again.";

  return NextResponse.json(
    {
      success: false,
      error: userError.description,
      code,
      details: { reason: userError.description, action },
    },
    { status }
  );
}

/**
 * Validates the JSON request body against a Zod schema.
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse<StandardApiResponse> }> {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType && !contentType.toLowerCase().includes("application/json")) {
      return {
        success: false,
        response: apiError("Content-Type must be application/json", 415, "UNSUPPORTED_MEDIA_TYPE"),
      };
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return {
        success: false,
        response: apiError("Request body must contain valid JSON", 400, "INVALID_JSON"),
      };
    }
    const result = schema.safeParse(rawBody);

    if (!result.success) {
      return {
        success: false,
        response: handleApiError(result.error),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (err) {
    return {
      success: false,
      response: handleApiError(err),
    };
  }
}
