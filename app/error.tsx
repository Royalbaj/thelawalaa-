"use client";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card max-w-md p-8 text-center">
        <AlertTriangle size={40} className="mx-auto text-brand-red" />
        <h1 className="mt-3 font-display text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-stone-600">That page hit an unexpected error. Try again, or head back home.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="btn-outline !border-stone-300 !text-brand-brown hover:!bg-stone-100">Try again</button>
          <Link href="/" className="btn-primary">Go home</Link>
        </div>
      </div>
    </div>
  );
}
