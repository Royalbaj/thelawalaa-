import { redirect } from "next/navigation";

// Saved addresses aren't used any more: a delivery goes to the location the
// customer shares at checkout (owner's call, Oct 2026). Old links land on Profile.
export default function AddressesPage() {
  redirect("/account/profile");
}
