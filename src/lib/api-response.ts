import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";

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
  let clientMessage = message;
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

  return NextResponse.json(
    {
      success: false,
      error: clientMessage,
      code,
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
    const rawBody = await request.json().catch(() => ({}));
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
