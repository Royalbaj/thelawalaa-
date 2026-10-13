import { z } from "zod";

export const orderSchema = z.object({
  type: z.enum(["pickup", "delivery", "dine_in"]),
  branch_id: z.string().uuid().optional(),
  delivery_address_id: z.string().uuid().optional(),
  pickup_time: z.string().datetime().optional(),
  // A booked delivery slot's start (Admin → Settings → Delivery hours); none = as soon as possible.
  scheduled_for: z.string().datetime({ offset: true }).optional(),
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
  // The number written on the card (101, 102 … — migration 044). Empty = the next automatic one, while 101–200 last.
  card_number: z.string().trim().max(6, "Card numbers are up to 6 digits").regex(/^\d*$/, "Card numbers are digits only").optional().transform((v) => v || undefined),
});

// A delivery taken at the counter (phone orders, migration 045): who and where.
export const posDeliverySchema = z.object({
  name: z.string().trim().min(2, "Type the customer's name").max(100, "That name is too long"),
  phone: z.string().transform((v) => v.replace(/[\s-]/g, "")).pipe(z.string().regex(/^(\+977)?9[6-8]\d{8}$/, "Enter the customer's mobile number (98XXXXXXXX)")),
  address: z.string().trim().min(10, "Add the full address — tole/street, house and a landmark").max(300, "Keep the address under 300 characters"),
});

export const posOrderSchema = z.object({
  type: z.enum(["pickup", "dine_in", "delivery"]),
  delivery: posDeliverySchema.optional(), // required when type is delivery
  payment_method: z.enum(["cash", "qr"]),
  student_discount: z.boolean().optional(),
  member: z.boolean().optional(),
  staff: z.boolean().optional(), // staff sale — up to app_settings.staff_free_items free
  manager: z.boolean().optional(), // manager discount — everything but frozen items free
  manager_pin: z.string().regex(/^\d{4}$/).optional(), // the approving manager's own PIN, checked again on the server
  member_card: z.string().regex(/^\d{3}$/).optional(), // member price: the last 3 digits of the member's card, checked again on the server
  promo_code: z.string().trim().min(1).max(30).optional(), // "Code" deal: a discount code from Admin → Settings, checked again on the server
  members: z.array(newMemberSchema).max(10).optional(), // one per membership card sold
  items: z
    // half: an extra half plate on top of `quantity` whole plates (1½, 2½ …) — migration 041
    .array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(50), half: z.boolean().optional() }))
    .min(1).max(40),
});
