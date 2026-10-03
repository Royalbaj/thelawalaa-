import { format } from "date-fns";
import { Mail, BellRing, Users, Bike } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NotificationComposer, DeleteNotification } from "@/components/admin/notification-composer";

export const dynamic = "force-dynamic";

export default async function NotificationsAdminPage() {
  await requireRole(["super_admin"]);
  const [{ data: sent }, { count: joined }, { count: customers }, { count: drivers }] = await Promise.all([
    supabaseAdmin.from("notifications").select("id, audience, title, body, link_url, emailed, pushed, created_at").order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").eq("is_active", true).eq("marketing_opt_in", true),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").eq("is_active", true),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "delivery_driver").eq("is_active", true),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-brown">Notifications</h1>
        <p className="mt-0.5 text-sm text-stone-500">Tell customers about new offers and competitions, or send riders a message.
          {" "}<b>{joined ?? 0}</b> of {customers ?? 0} customers have joined offers.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="order-2 lg:order-1">
          <h2 className="mb-2 font-display font-bold text-brand-brown">Sent</h2>
          <div className="card divide-y divide-orange-50">
            {(sent ?? []).map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.audience === "customers" ? "bg-orange-50 text-brand-orange" : "bg-stone-100 text-stone-600"}`}>
                  {n.audience === "customers" ? <Users size={17} /> : <Bike size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-brand-brown">{n.title}</p>
                  <p className="line-clamp-2 whitespace-pre-line text-sm text-stone-600">{n.body}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
                    <span>{format(new Date(n.created_at), "d MMM yyyy, h:mm a")}</span>
                    <span>{n.audience === "customers" ? "Customers (joined offers)" : "Riders"}</span>
                    {n.emailed > 0 && <span className="flex items-center gap-1"><Mail size={12} /> {n.emailed} emailed</span>}
                    {n.pushed > 0 && <span className="flex items-center gap-1"><BellRing size={12} /> {n.pushed} alerted</span>}
                    {n.link_url && <span className="truncate">→ {n.link_url}</span>}
                  </p>
                </div>
                <DeleteNotification id={n.id} />
              </div>
            ))}
            {(sent ?? []).length === 0 && <p className="px-4 py-10 text-center text-sm text-stone-500">Nothing sent yet.</p>}
          </div>
        </section>
        <div className="order-1 lg:order-2">
          <NotificationComposer joinedCount={joined ?? 0} driverCount={drivers ?? 0} />
        </div>
      </div>
    </div>
  );
}
