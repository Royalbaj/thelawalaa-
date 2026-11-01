import { NextResponse } from "next/server";

// The build that's live now — open pages compare it with their own and reload
// after a deploy (components/version-guard.tsx). Nothing secret: a deployment id.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ v: process.env.NEXT_PUBLIC_APP_VERSION ?? null }, { headers: { "Cache-Control": "no-store" } });
}
