"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { extractYouTubeId } from "@/lib/youtube";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    // Offline, or YouTube blocked: say so instead of leaving a black box forever.
    tag.onerror = () => { apiPromise = null; tag.remove(); reject(new Error("YouTube player didn't load")); };
    document.head.appendChild(tag);
  });
  return apiPromise;
}

// YouTube's IFrame API has no "disable seeking" option, so the position is
// checked twice a second instead, and only real viewing counts: what's been
// watched can grow no faster than the clock (10% leeway for timer jitter).
// A drag along the timeline, a double-tap "+10s" or a 2x speed all run ahead
// of the clock and get snapped back to the furthest point actually watched.
const TICK_MS = 500;
const CLOCK_LEEWAY = 1.1;
const SNAP_BACK_AFTER_SECONDS = 2;
const END_TOLERANCE_SECONDS = 2;

// YouTube's onError codes → what the staff member can do about it.
const PLAYER_ERRORS: Record<number, string> = {
  2: "This video link isn't valid — ask the office to check it.",
  5: "This video can't play in this browser — try another device.",
  100: "This video was removed or made private — ask the office for a new link.",
  101: "The video's owner doesn't allow it to play outside YouTube — ask the office for a different video.",
  150: "The video's owner doesn't allow it to play outside YouTube — ask the office for a different video.",
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function UnskippableVideo({
  id, youtubeUrl, completed, onComplete,
}: { id: string; youtubeUrl: string; completed: boolean; onComplete: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const watchedRef = useRef(0); // furthest point reached by actually playing
  const lastTickRef = useRef(0); // performance.now() of the previous check
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(completed);
  const onCompleteRef = useRef(onComplete);
  const [problem, setProblem] = useState<string | null>(null);
  const [progress, setProgress] = useState({ watched: 0, duration: 0 });
  const ytId = extractYouTubeId(youtubeUrl);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { completedRef.current = completed; }, [completed]);

  useEffect(() => {
    if (!ytId) { setProblem("Couldn't load this video link."); return; }
    let cancelled = false;

    const stopTicking = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    const finish = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current();
    };
    const tick = () => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const now = performance.now();
      const elapsed = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (completedRef.current) return; // watched once — free to rewind or jump around now
      const t = p.getCurrentTime();
      const duration = p.getDuration?.() || 0;
      watchedRef.current = Math.max(watchedRef.current, Math.min(t, watchedRef.current + elapsed * CLOCK_LEEWAY));
      if (t > watchedRef.current + SNAP_BACK_AFTER_SECONDS) p.seekTo(watchedRef.current, true);
      setProgress({ watched: watchedRef.current, duration });
      if (duration && watchedRef.current >= duration - END_TOLERANCE_SECONDS) finish();
    };

    loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current) return;
      // YouTube swaps this element for its iframe — keep it out of React's hands.
      const el = document.createElement("div");
      hostRef.current.appendChild(el);
      playerRef.current = new window.YT.Player(el, {
        videoId: ytId,
        width: "100%",
        height: "100%",
        // playsinline: on iPhone, play inside the page (where the checks run)
        // instead of jumping to the native full-screen player.
        // disablekb: no arrow-key jumps.
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, origin: window.location.origin },
        events: {
          onStateChange: (e: any) => {
            const { PLAYING, ENDED } = window.YT.PlayerState;
            if (e.data === PLAYING) {
              stopTicking();
              lastTickRef.current = performance.now();
              intervalRef.current = setInterval(tick, TICK_MS);
            } else {
              stopTicking();
            }
            // Dragging to the very end also "ends" the video — only count it if it was really watched.
            if (e.data === ENDED && !completedRef.current) {
              const duration = e.target.getDuration?.() || 0;
              if (duration && watchedRef.current >= duration - END_TOLERANCE_SECONDS) finish();
              else { e.target.seekTo(watchedRef.current, true); e.target.playVideo(); }
            }
          },
          // Faster than normal speed would be skipping too.
          onPlaybackRateChange: (e: any) => {
            if (!completedRef.current && e.data > 1) e.target.setPlaybackRate(1);
          },
          onError: (e: any) => {
            if (!cancelled) setProblem(PLAYER_ERRORS[e.data] ?? "This video couldn't play — try again later.");
          },
        },
      });
    }).catch(() => {
      if (!cancelled) setProblem("Couldn't load the video player — check the internet connection, then reopen this page.");
    });

    return () => {
      cancelled = true;
      stopTicking();
      playerRef.current?.destroy?.();
      playerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [ytId]);

  if (problem) return <p className="text-sm font-bold text-brand-red">{problem}</p>;

  const pct = progress.duration ? Math.min(100, (progress.watched / progress.duration) * 100) : 0;
  return (
    <div>
      <div ref={hostRef} id={`yt-player-${id}`} className="aspect-video w-full overflow-hidden rounded-xl bg-black [&>iframe]:block [&>iframe]:h-full [&>iframe]:w-full" />
      {completed ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-bold text-brand-green">
          <CheckCircle2 size={14} /> Watched — you can rewind or jump around now
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-brand-orange transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="flex items-center justify-between gap-2 text-xs font-bold text-stone-400">
            <span className="flex items-center gap-1"><Lock size={14} /> Can&apos;t skip ahead — watch to the end</span>
            {progress.duration > 0 && <span className="shrink-0 tabular-nums">{clock(progress.watched)} / {clock(progress.duration)}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
