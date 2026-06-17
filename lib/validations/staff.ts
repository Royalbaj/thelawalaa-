import { z } from "zod";
import { phoneNP } from "./auth";

export const inviteStaffSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: phoneNP,
  role: z.enum(["pos_user", "delivery_driver"]), // admin can NEVER be created via form
  branch_id: z.string().uuid(),
  vehicle_type: z.enum(["bike", "scooter", "cycle"]).optional(),
  vehicle_number: z.string().trim().max(20).optional(),
});
