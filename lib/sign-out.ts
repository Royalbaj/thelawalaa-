import { createClient } from "@/lib/supabase/client";

/**
 * Sign out of THIS device only — supabase-js defaults to every device, so
 * logging the shared POS account out on one tablet logged out all of them —
 * then load the login page fresh. A full page load (not router.push) drops
 * Next's in-memory page cache, so Back can't bring the last user's screens up.
 */
export async function signOutHere() {
  await signOutTo("/auth/login");
}

/** The same, landing somewhere else (checkout's "Not you?" goes back to /order as a guest). */
export async function signOutTo(path: string) {
  await createClient().auth.signOut({ scope: "local" });
  window.location.replace(path);
}
