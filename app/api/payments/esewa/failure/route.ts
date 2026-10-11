import { NextRequest, NextResponse } from "next/server";

// eSewa's failure_url. The order stays payment_status 'pending' — the
// customer can retry eSewa or fall back to cash/QR from the track page.
export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const order = request.nextUrl.searchParams.get("order");
  const orderId = order && /^[0-9a-f-]{36}$/i.test(order) ? order : null;
  const dest = orderId ?`${siteUrl}/track/${orderId}?payment=failed` : `${siteUrl}/?payment=error`;
  return NextResponse.redirect(dest);
}
