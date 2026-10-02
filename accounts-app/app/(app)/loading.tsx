// Shown the moment a tab is tapped, while the page loads — so every tap
// answers instantly instead of the screen sitting still.
export default function Loading() {
  const bar = "animate-pulse rounded-2xl bg-stone-200/70";
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className={`${bar} h-8 w-48`} />
      <div className={`${bar} h-28`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${bar} h-24`} /><div className={`${bar} h-24`} /><div className={`${bar} h-24`} />
      </div>
      <div className={`${bar} h-56`} />
    </div>
  );
}
