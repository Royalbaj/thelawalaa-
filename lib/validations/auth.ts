import { z } from "zod";

export const phoneNP = z.string().regex(/^(\+977)?9[6-8]\d{8}$/, "Enter a valid Nepali mobile number (98XXXXXXXX)");

export const passwordSchema = z.string()
  .min(8, "At least 8 characters")
  .max(72, "Too long")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a special character");

export const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100, "That name is too long"),
  email: z.string().trim().email("Enter a valid email address").max(254, "That email is too long"),
  phone: phoneNP,
  password: passwordSchema,
  accept_terms: z.literal(true, { errorMap: () => ({ message: "Please accept the Terms & Conditions to create an account" }) }),
  // Offers are opt-in only — never ticked for anyone.
  marketing_opt_in: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(72),
});
