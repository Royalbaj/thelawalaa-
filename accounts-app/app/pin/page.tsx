import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getVerifiedUser } from "@/lib/supabase/server";
import PinPad from "@/components/pin-pad";

export const dynamic = "force-dynamic";

export default async function PinPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { profile } = await getVerifiedUser();
  if (!profile) redirect("/login");
  const { next } = await searchParams;
  // Only ever back into this app.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/pin") ? next : "/";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-dark px-4 py-8">
      <div className="card w-full max-w-sm p-6 text-center">
        <p className="font-display text-2xl font-bold brand-gradient-text">Thelawalaa Accounts</p>
        <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-brand-orange">
          <Lock size={22} />
        </div>
        <p className="mt-2 font-bold text-brand-brown">Who&apos;s using Accounts?</p>
        <p className="text-xs text-stone-500">Enter your own PIN — your name goes on everything you enter.</p>
        <PinPad next={safeNext} />
      </div>
    </div>
  );
}
