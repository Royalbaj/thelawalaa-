"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Check, CheckCircle2, ChevronDown, Play } from "lucide-react";
import UnskippableVideo from "./unskippable-video";
import SwitchTrainee from "./switch-trainee";
import { markVideoWatched } from "@/app/actions/training";
import { extractYouTubeId } from "@/lib/youtube";
import { npDate } from "@/lib/nepal-time";
import { cn } from "@/lib/utils";

export type CourseVideo = {
  id: string; title: string; youtubeUrl: string; sortOrder: number;
  addedAt: string; completedAt: string | null; isNew: boolean;
};

// A dropped connection right at the end of a video shouldn't cost a re-watch.
async function saveWatched(videoId: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await markVideoWatched(videoId);
      if (!r?.error) return true;
    } catch { /* offline — try again */ }
    await new Promise((res) => setTimeout(res, 1500 * attempt));
  }
  return false;
}

/**
 * The Staff Portal's course: progress at the top, then every video given to
 * this person — newest first, a green tick on each one finished. One video is
 * open at a time (only that one loads a player), starting with the newest one
 * not watched yet.
 */
export default function TrainingCourse({ videos, name }: { videos: CourseVideo[]; name: string }) {
  const [finished, setFinished] = useState<Map<string, string>>(
    () => new Map(videos.filter((v) => v.completedAt).map((v) => [v.id, v.completedAt!])));
  const firstToWatch = videos.find((v) => !finished.has(v.id));
  const [open, setOpen] = useState<string | null>(firstToWatch?.id ?? null);

  const setDone = (id: string, at: string | null) => setFinished((prev) => {
    const next = new Map(prev);
    if (at) next.set(id, at); else next.delete(id);
    return next;
  });

  const done = videos.filter((v) => finished.has(v.id)).length;
  const allDone = videos.length > 0 && done === videos.length;
  const upNext = (after?: string) => videos.find((v) => v.id !== after && !finished.has(v.id));
  const show = (id: string) => {
    setOpen(id);
    requestAnimationFrame(() => document.getElementById(`video-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="space-y-8">
      {/* Progress */}
      <section aria-labelledby="progress" className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="progress" className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">Your progress</h2>
            <p className="mt-1 font-display text-2xl font-bold text-brand-brown dark:text-orange-50">
              {videos.length === 0 ? "Nothing to watch yet" : `${done} of ${videos.length} ${videos.length === 1 ? "video" : "videos"} watched`}
            </p>
          </div>
          <SwitchTrainee name={name} />
        </div>
        {videos.length > 0 && (
          <>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800"
              role="progressbar" aria-valuemin={0} aria-valuemax={videos.length} aria-valuenow={done} aria-label="Videos watched">
              <div className={cn("h-full rounded-full transition-[width] duration-700", allDone ? "bg-green-500" : "bg-brand-orange")}
                style={{ width: `${(done / videos.length) * 100}%` }} />
            </div>
            {allDone ? (
              <p className="mt-4 flex items-center gap-2 text-sm font-bold text-green-700 dark:text-green-400">
                <CheckCircle2 size={18} aria-hidden /> All done — thank you, {name.split(" ")[0]}!
              </p>
            ) : firstToWatch && (
              <button type="button" onClick={() => show(firstToWatch.id)}
                className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl bg-orange-50 px-4 py-3 text-left transition hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50">
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-brand-orange">Up next</span>
                  <span className="block truncate font-bold text-brand-brown dark:text-orange-50">{firstToWatch.title}</span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white">
                  <Play size={15} fill="currentColor" className="ml-0.5" aria-hidden />
                </span>
              </button>
            )}
          </>
        )}
      </section>

      {/* The videos */}
      <section aria-labelledby="videos">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="videos" className="font-display text-xl font-bold text-brand-brown dark:text-orange-50">Your videos</h2>
          {videos.length > 1 && <span className="text-xs font-bold text-stone-400">Newest first</span>}
        </div>
        {videos.length === 0 ? (
          <p className="card p-5 text-sm text-stone-500 dark:text-stone-400">No training videos for you yet — the manager adds them in Admin → Staff Training.</p>
        ) : (
          <ol className="space-y-3">
            {videos.map((v) => {
              const doneAt = finished.get(v.id);
              const isOpen = open === v.id;
              const ytId = extractYouTubeId(v.youtubeUrl);
              const next = upNext(v.id);
              return (
                <li key={v.id} id={`video-${v.id}`} className={cn("card scroll-mt-20 overflow-hidden transition", isOpen && "ring-2 ring-brand-orange/50")}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : v.id)} aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 p-3 text-left sm:gap-4 sm:p-4">
                    <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-stone-200 dark:bg-stone-800 sm:w-36">
                      {ytId && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                      {doneAt ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-green-950/45">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-white shadow-lg ring-2 ring-white">
                            <Check size={20} strokeWidth={3} aria-hidden />
                          </span>
                        </span>
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white">
                            <Play size={15} fill="currentColor" className="ml-0.5" aria-hidden />
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {doneAt ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 dark:text-green-400">
                            <CheckCircle2 size={14} aria-hidden /> Completed {npDate(doneAt)}
                          </span>
                        ) : (
                          <>
                            {v.isNew && <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span>}
                            <span className="text-xs font-bold text-stone-400">Not watched yet</span>
                          </>
                        )}
                      </span>
                      <span className="mt-1 line-clamp-2 block font-bold leading-snug text-brand-brown dark:text-orange-50">{v.title}</span>
                      <span className="mt-0.5 block text-xs text-stone-400">Added {npDate(v.addedAt)}</span>
                    </span>
                    <ChevronDown size={20} className={cn("shrink-0 text-stone-400 transition-transform", isOpen && "rotate-180")} aria-hidden />
                  </button>

                  {isOpen && (
                    <div className="border-t border-stone-100 p-3 dark:border-stone-800 sm:p-4">
                      <UnskippableVideo
                        id={v.id}
                        youtubeUrl={v.youtubeUrl}
                        completed={!!doneAt}
                        onComplete={async () => {
                          setDone(v.id, new Date().toISOString());
                          if (await saveWatched(v.id)) toast.success("Finished — the manager can see you've watched it");
                          else {
                            setDone(v.id, null);
                            toast.error("Couldn't save that you finished — check the internet, then play the last few seconds again");
                          }
                        }}
                      />
                      {doneAt && next && (
                        <button type="button" onClick={() => show(next.id)}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110">
                          Next video <Play size={13} fill="currentColor" aria-hidden />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
