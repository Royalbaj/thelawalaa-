// A campaign's tracking link: www.thelawalaa.com/go/<code> (printed as a QR
// on posters, put in ads). Counts the visit, remembers the campaign for 30
// days in a cookie (orders and sign-ups made with it are credited to it —
// lib/marketing.ts), and sends them on to the campaign's page.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CAMPAIGN_COOKIE, CAMPAIGN_DAYS } from "@/lib/marketing-shared";

export const dynamic = "force-dynamic";

// Link previews (WhatsApp, Facebook, Viber…) open the link before anyone taps it.
const BOT = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|viber|telegram|slack|discord|skype|curl|wget|python|headless/i;

export async function GET(req: NextRequest, props: { params: Promise<{ code: string }> }) {
  const code = (await props.params).code.toLowerCase();
  const home = new URL("/", req.url);
  if (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(code)) return NextResponse.redirect(home);

  const isBot = BOT.test(req.headers.get("user-agent") ?? "");
  let landing = "/";
  if (isBot) {
    const { data } = await supabaseAdmin.from("marketing_campaigns").select("landing_path").eq("code", code).neq("status", "ended").maybeSingle();
    if (!data) return NextResponse.redirect(home);
    landing = data.landing_path;
  } else {
    const { data } = await supabaseAdmin.rpc("marketing_click", { p_code: code });
    const hit = (Array.isArray(data) ? data[0] : data) as { id: string; landing_path: string } | undefined;
    if (!hit) return NextResponse.redirect(home);
    landing = hit.landing_path;
  }

  const res = NextResponse.redirect(new URL(landing, req.url));
  if (!isBot) {
    res.cookies.set(CAMPAIGN_COOKIE, code, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: CAMPAIGN_DAYS * 86400,
    });
  }
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
