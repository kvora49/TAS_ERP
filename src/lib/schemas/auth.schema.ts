import { z } from "zod";

export const RegisterSchema = z.object({
  userId: z.string().uuid("Invalid user ID format").optional(),
  businessName: z.string().trim().min(2, "Business name must be at least 2 characters").max(100),
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(120),
  phone: z.string().trim().max(20).optional().nullable(),
});

export const LoginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});
