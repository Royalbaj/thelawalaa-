import { z } from "zod";

export const phoneNP = z.string().regex(/^(\+977)?9[6-8]\d{8}$/, "Enter a valid Nepali mobile number (98XXXXXXXX)");

export const passwordSchema = z.string()
  .min(8, "At least 8 characters")
  .max(72, "Too long")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a special character");

export const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: phoneNP,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(72),
});
