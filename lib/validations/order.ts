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
  // The typed delivery address (guests, staff, or a signed-in customer's new address).
  guest_address: z.string().max(300).optional(),
  // "Share my location" at checkout — must be in Nepal.
  delivery_location: z.object({
    lat: z.number().min(26.3, "That location is outside Nepal").max(30.5, "That location is outside Nepal"),
    lng: z.number().min(80, "That location is outside Nepal").max(88.3, "That location is outside Nepal"),
    accuracy: z.number().min(0).max(100000).optional(),
  }).optional(),
  // Signed-in customers only — the server works out (and takes) the amounts.
  use_points: z.boolean().optional(),
  use_free_item: z.boolean().optional(),
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

// Someone buying a membership card at the POS: who the new member is.
export const newMemberSchema = z.object({
  full_name: z.string().trim().min(2, "Type the member's full name").max(100, "That name is too long"),
  phone: z.string().transform((v) => v.replace(/[\s-]/g, "")).pipe(z.string().regex(/^(\+977)?9[6-8]\d{8}$/, "Enter the member's mobile number (98XXXXXXXX)")),
  card_number: z.string().trim().max(30, "Card number is too long").optional().transform((v) => v || undefined),
});

export const posOrderSchema = z.object({
  type: z.enum(["pickup", "dine_in"]),
  payment_method: z.enum(["cash", "qr"]),
  student_discount: z.boolean().optional(),
  member: z.boolean().optional(),
  members: z.array(newMemberSchema).max(10).optional(), // one per membership card sold
  items: z
    .array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
    .min(1).max(40),
});
