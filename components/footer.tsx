import { Facebook, Instagram, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import TikTokIcon from "@/components/icons/tiktok";

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p === "facebook") return Facebook;
  if (p === "instagram") return Instagram;
  if (p === "tiktok") return TikTokIcon;
  return Link2;
}

export default async function Footer() {
  const supabase = createClient();
  const { data: socialLinks } = await supabase
    .from("social_links").select("id, platform, url").order("sort_order");

  return (
    <footer className="bg-brand-brown px-4 py-12 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl font-bold brand-gradient-text">Thelawalaa</p>
          <p className="mt-2 text-sm text-orange-100/80">
            Crispy, spicy, straight from the thela — now at your door.
          </p>
          {(socialLinks ?? []).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-100/60">Follow Us</p>
              <div className="mt-2 flex gap-2">
                {(socialLinks ?? []).map((s) => {
                  const Icon = platformIcon(s.platform);
                  return (
                    <a
                      key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                      aria-label={`Thelawalaa on ${s.platform}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
                    >
                      <Icon size={17} />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-orange-100/90">
          <a href="#home" className="hover:text-white">Home</a>
          <a href="#menu" className="hover:text-white">Menu</a>
          <a href="#order" className="hover:text-white">Order</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
          <a href="#contact" className="hover:text-white">Contact</a>
        </nav>
        <div className="text-sm text-orange-100/70">
          <p>Privacy Policy · Terms of Service</p>
          <p className="mt-2">© {new Date().getFullYear()} Thelawalaa.com — All rights reserved</p>
        </div>
      </div>
    </footer>
  );
}
