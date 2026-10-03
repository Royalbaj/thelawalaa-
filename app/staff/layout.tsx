import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/role-home";
import StaffHeader from "@/components/staff/staff-header";
import StaffFooter from "@/components/staff/staff-footer";
import SessionGuard from "@/components/session-guard";
import { ThemeRoot } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["pos_user", "delivery_driver", "super_admin"];
const STAFF_THEME_COOKIE = "staff-theme";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getVerifiedUser();
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    redirect("/auth/login?redirect=/staff");
  }
  const dark = (await cookies()).get(STAFF_THEME_COOKIE)?.value === "dark";

  return (
    <ThemeRoot cookie={STAFF_THEME_COOKIE} initialDark={dark}
      className="flex min-h-dvh flex-col bg-brand-cream text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <SessionGuard userId={profile.id} />
      <StaffHeader backHref={ROLE_HOME[profile.role] ?? "/"} />
      <main className="mx-auto w-full max-w-2xl flex-1">{children}</main>
      <StaffFooter />
    </ThemeRoot>
  );
}
