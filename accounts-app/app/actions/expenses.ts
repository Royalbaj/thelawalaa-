"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

const expenseSchema = z.object({
  category: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).optional(),
  amount: z.coerce.number().positive(),
  spent_at: z.string().trim().min(1),
});

export async function addExpense(input: unknown) {
  const { user } = await requireAuth();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the form fields" };

  const { data, error } = await supabaseAdmin
    .from("expenses")
    .insert({ ...parsed.data, description: parsed.data.description || null, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: "Could not add expense" };

  await audit({ actor_id: user.id, action: "ADD_EXPENSE", target_table: "expenses", target_id: data.id, new_data: parsed.data });
  revalidatePath("/expenses");
  revalidatePath("/reports");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const { user } = await requireAuth();
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("expenses").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_EXPENSE", target_table: "expenses", target_id: id });
  revalidatePath("/expenses");
  revalidatePath("/reports");
  revalidatePath("/");
  return { ok: true };
}
