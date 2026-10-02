import { PauseCircle } from "lucide-react";
import { SITE } from "@/lib/seo";
import { getSiteText, whatsappHref } from "@/lib/site-content";

export default async function SuspendedPage() {
  const t = await getSiteText();
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card max-w-md p-8 text-center">
        <PauseCircle size={40} className="mx-auto text-brand-red" />
        <h1 className="mt-3 font-display text-2xl font-bold">Account suspended</h1>
        <p className="mt-2 text-stone-600">This account has been deactivated. Contact us if you think this is a mistake.</p>
        <a href={whatsappHref(t)} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6">
          Chat with us on WhatsApp
        </a>
        <p className="mt-3 text-xs text-stone-400">or email {SITE.email}</p>
      </div>
    </div>
  );
}
