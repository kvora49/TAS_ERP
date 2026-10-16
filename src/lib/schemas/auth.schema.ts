import { z } from "zod";

export const PasswordSchema = z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be 128 characters or fewer");

export const RegisterSchema = z.object({
  businessName: z.string().trim().min(2, "Business name must be at least 2 characters").max(100),
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(120),
  phone: z.string().trim().regex(/^\+?[0-9()\-\s]{7,20}$/, "Invalid phone number format").optional().nullable(),
});

export const LoginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const ResetPasswordSchema = z.object({
  password: PasswordSchema,
});
