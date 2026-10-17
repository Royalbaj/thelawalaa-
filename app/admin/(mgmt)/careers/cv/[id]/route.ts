import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// CVs live in a PRIVATE bucket: this hands the admin a 2-minute link to one.
// PDFs and photos open in the browser; Word files download with their own name.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(["super_admin"]); } catch {
    return NextResponse.redirect(new URL("/auth/login?redirect=/admin/careers", request.url));
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const { data } = await supabaseAdmin.from("job_applications").select("cv_path, cv_name, name").eq("id", id).maybeSingle();
  if (!data?.cv_path) return new NextResponse("No CV was sent with this application", { status: 404 });
  const word = /\.(doc|docx)$/.test(data.cv_path);
  const fileName = data.cv_name || `CV - ${data.name}${data.cv_path.slice(data.cv_path.lastIndexOf("."))}`;
  const { data: signed } = await supabaseAdmin.storage.from("cvs")
    .createSignedUrl(data.cv_path.slice("cvs/".length), 120, word ? { download: fileName } : undefined);
  if (!signed?.signedUrl) return new NextResponse("Couldn't open the CV", { status: 502 });
  return NextResponse.redirect(signed.signedUrl);
}
