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
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

// Snaps playback back whenever the viewer drags/seeks past the furthest
// point they've actually watched — the only reliable way to block skipping
// via the YouTube IFrame API, which has no native "disable seek" flag.
const SEEK_TOLERANCE_SECONDS = 2;

export default function UnskippableVideo({
  id, youtubeUrl, completed, onComplete,
}: { id: string; youtubeUrl: string; completed: boolean; onComplete: () => void }) {
  const containerId = `yt-player-${id}`;
  const playerRef = useRef<any>(null);
  const maxWatchedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(completed);
  const onCompleteRef = useRef(onComplete);
  const [error, setError] = useState(false);
  const ytId = extractYouTubeId(youtubeUrl);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { firedRef.current = completed; }, [completed]);

  useEffect(() => {
    if (!ytId) { setError(true); return; }
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled) return;
      playerRef.current = new window.YT.Player(containerId, {
        videoId: ytId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e: any) => {
            const YT = window.YT;
            if (e.data === YT.PlayerState.PLAYING) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                const p = playerRef.current;
                if (!p?.getCurrentTime) return;
                const t = p.getCurrentTime();
                const duration = p.getDuration?.() || 0;
                if (t > maxWatchedRef.current + SEEK_TOLERANCE_SECONDS) {
                  p.seekTo(maxWatchedRef.current, true);
                } else {
                  maxWatchedRef.current = Math.max(maxWatchedRef.current, t);
                }
                if (duration && t >= duration - 1 && !firedRef.current) {
                  firedRef.current = true;
                  onCompleteRef.current();
                }
              }, 500);
            } else if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            if (e.data === YT.PlayerState.ENDED && !firedRef.current) {
              firedRef.current = true;
              onCompleteRef.current();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current?.destroy?.();
    };
  }, [ytId, containerId]);

  if (error) return <p className="text-sm font-bold text-brand-red">Couldn&apos;t load this video link.</p>;

  return (
    <div>
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <div id={containerId} className="h-full w-full" />
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs font-bold">
        {completed ? (
          <span className="flex items-center gap-1 text-brand-green"><CheckCircle2 size={14} /> Watched</span>
        ) : (
          <span className="flex items-center gap-1 text-stone-400"><Lock size={14} /> Skipping ahead is disabled — watch to the end</span>
        )}
      </div>
    </div>
  );
}
