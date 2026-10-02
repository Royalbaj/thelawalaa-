import { NextResponse } from "next/server";
import { getSiteText, whatsappHref } from "@/lib/site-content";

// /whatsapp → the WhatsApp chat for the number set in Admin → Website text.
// For links in browser-side pages, which can't read the setting themselves.
export async function GET() {
  return NextResponse.redirect(whatsappHref(await getSiteText()), 302);
}
