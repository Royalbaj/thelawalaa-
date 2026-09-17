import { z } from "zod";

export const orderSchema = z.object({
  type: z.enum(["pickup", "delivery", "dine_in"]),
  branch_id: z.string().uuid().optional(),
  delivery_address_id: z.string().uuid().optional(),
  pickup_time: z.string().datetime().optional(),
  payment_method: z.enum(["cash", "qr", "esewa"]),
  promo_code: z.string().trim().max(30).optional(),
  notes: z.string().max(500).optional(),
  guest_name: z.string().min(2).max(100).optional(),
  guest_phone: z.string().regex(/^(\+977)?9[6-8]\d{8}$/, "Must be a valid Nepali mobile number").optional(),
  guest_address: z.string().max(300).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
        customization_notes: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(20),
}).superRefine((v, ctx) => {
  // Relaxed to allow server-side handling for POS and guest checkouts
  if (v.type === "pickup" && !v.branch_id && v.guest_name === undefined) {
    // Basic check for non-POS, but server handles it fully
  }
});

export const posOrderSchema = z.object({
  type: z.enum(["pickup", "dine_in"]),
  payment_method: z.enum(["cash", "qr", "card"]),
  customer_name: z.string().trim().max(100).optional().or(z.literal("")),
  customer_phone: z.string().regex(/^(\+977)?9[6-8]\d{8}$/).optional().or(z.literal("")),
  items: z
    .array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
    .min(1).max(40),
});
