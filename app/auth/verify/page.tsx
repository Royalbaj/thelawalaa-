import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card max-w-md p-8 text-center">
        <CheckCircle2 size={40} className="mx-auto text-brand-green" />
        <h1 className="mt-3 font-display text-2xl font-bold">Email verified</h1>
        <p className="mt-2 text-stone-600">Your account is ready. Time for some chatpate.</p>
        <Link href="/auth/login" className="btn-primary mt-6">Sign in</Link>
      </div>
    </div>
  );
}
