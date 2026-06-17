import Link from "next/link";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-cream">
      <header className="bg-brand-dark px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold brand-gradient-text">Thelawalaa</Link>
          <nav className="flex gap-4 text-sm font-bold text-white/90">
            <Link href="/account" className="hover:text-brand-orange">Profile</Link>
            <Link href="/account/orders" className="hover:text-brand-orange">Orders</Link>
            <Link href="/account/addresses" className="hover:text-brand-orange">Addresses</Link>
            <Link href="/order" className="rounded-full bg-brand-orange px-4 py-1 text-white">Order</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
