import Link from "next/link";
export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card max-w-md p-8 text-center">
        <p className="text-5xl">✅</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Email verified!</h1>
        <p className="mt-2 text-stone-600">Your account is ready. Time for some panipuri.</p>
        <Link href="/auth/login" className="btn-primary mt-6">Sign in</Link>
      </div>
    </div>
  );
}
