"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, phone, role").eq("id", user.id).single();
      setProfile(data);
    });
  }, []);

  if (!profile) return <p className="animate-pulse font-bold">Loading…</p>;

  return (
    <div className="max-w-md space-y-6">
      <h1 className="font-display text-2xl font-bold text-brand-brown">Your profile</h1>
      <form
        className="card space-y-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = Object.fromEntries(new FormData(e.currentTarget));
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          // RLS limits this to the user's own row; the DB trigger blocks
          // role/is_active/branch changes even if extra fields were sent.
          const { error } = await supabase.from("profiles")
            .update({ full_name: String(fd.full_name).slice(0, 100), phone: String(fd.phone).slice(0, 15) })
            .eq("id", user.id);
          error ? toast.error("Couldn't save") : toast.success("Profile saved");
        }}
      >
        <div><label className="label" htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" defaultValue={profile.full_name} required className="input" /></div>
        <div><label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" defaultValue={profile.phone ?? ""} className="input" /></div>
        <button className="btn-primary">Save changes</button>
      </form>
      <button
        className="text-sm font-bold text-brand-red"
        onClick={async () => { await createClient().auth.signOut(); router.push("/"); router.refresh(); }}
      >
        Sign out
      </button>
    </div>
  );
}
