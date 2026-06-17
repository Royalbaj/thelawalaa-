export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card max-w-md p-8 text-center">
        <p className="text-5xl">⏸️</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Account suspended</h1>
        <p className="mt-2 text-stone-600">This account has been deactivated. Contact support@thelawalaa.com if you think this is a mistake.</p>
      </div>
    </div>
  );
}
