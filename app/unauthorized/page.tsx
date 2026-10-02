import Link from "next/link";
import { ACCOUNTS_LOGIN } from "@/lib/role-home";
export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card max-w-md p-8 text-center">
        <p className="text-5xl">🚫</p>
        <h1 className="mt-3 font-display text-2xl font-bold">No access here</h1>
        <p className="mt-2 text-stone-600">Your account doesn&apos;t have permission for that page.</p>
        <Link href="/" className="btn-primary mt-6">Back to home</Link>
        <p className="mt-5 text-sm text-stone-500">
          Accounts staff? Accounts has its own site:{" "}
          <a href={ACCOUNTS_LOGIN} className="font-bold text-brand-orange">accounts.thelawalaa.com</a>
        </p>
      </div>
    </div>
  );
}
