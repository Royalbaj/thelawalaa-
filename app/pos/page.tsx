import { redirect } from "next/navigation";

// /admin is the one real POS workspace (terminal + live orders, correct
// role checks, correct product data). This route used to duplicate it
// with a stale, broken copy — redirect instead of maintaining two.
export default function PosPage() {
  redirect("/admin");
}
