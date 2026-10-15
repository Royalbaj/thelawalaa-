"use client";
import { useRef, useState } from "react";
import { Play, RotateCcw, X } from "lucide-react";
import { UI, type SiteLang } from "@/lib/site-lang";

// The how-to-order video, played by the browser itself from our own file
// (public/videos or the site-media bucket) — no YouTube logo, title bar or
// "more videos", so it looks part of the website. Nothing is downloaded until
// someone presses play; the cover picture shows until then.

type Video = { src: string; poster: string | null; title: string; lang: SiteLang };

// Without a cover picture, show the video's own first frame.
const sources = ({ src, poster }: Video) =>
  poster ? { src, poster, preload: "none" as const } : { src: `${src}#t=0.1`, poster: undefined, preload: "metadata" as const };

/** The video in the How to Order section: a big play button on the cover, the browser's own controls once playing. */
export function HowToVideo(props: Video) {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"cover" | "playing" | "ended">("cover");
  const L = UI[props.lang].video;
  const s = sources(props);

  const start = () => {
    const v = ref.current;
    if (!v) return;
    if (state === "ended") v.currentTime = 0;
    void v.play().catch(() => setState("cover"));
  };

  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-[1.75rem] bg-black shadow-2xl shadow-black/50 ring-4 ring-white/10 [-webkit-tap-highlight-color:transparent]">
      <video
        ref={ref}
        src={s.src}
        poster={s.poster}
        preload={s.preload}
        playsInline
        controls={state === "playing"}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        onPlay={() => setState("playing")}
        onEnded={() => setState("ended")}
        aria-label={props.title}
        className="absolute inset-0 h-full w-full object-cover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30"
      />
      {state !== "playing" && (
        <button
          type="button"
          onClick={start}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/60 via-black/10 to-black/20 outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-orange text-white shadow-xl shadow-orange-600/40 ring-8 ring-white/15 transition group-hover:scale-105 group-active:scale-95">
            {state === "ended" ? <RotateCcw size={32} aria-hidden /> : <Play size={34} fill="currentColor" className="ml-1.5" aria-hidden />}
          </span>
          <span className="rounded-full bg-black/50 px-4 py-1.5 text-sm font-bold text-white backdrop-blur-sm">
            {state === "ended" ? L.replay : L.play}
          </span>
        </button>
      )}
    </div>
  );
}

/** "कसरी अर्डर गर्ने?" at the top of the homepage: plays the same video straight away, over the page. */
export function HowToVideoButton({ label, ...props }: Video & { label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const L = UI[props.lang].video;
  const s = sources(props);

  // play() has to run inside the tap itself, or phones (iPhone Safari) refuse sound.
  const open = () => {
    dialog.current?.showModal();
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => {});
  };
  // Stop the sound right away (the dialog's own close event comes a moment later; Esc goes through it).
  const close = () => { video.current?.pause(); dialog.current?.close(); };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="group inline-flex items-center gap-3 rounded-full bg-white/10 py-2 pl-2 pr-6 text-lg font-bold text-amber-50 ring-1 ring-white/20 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange text-white shadow-lg shadow-orange-600/40 transition group-hover:scale-105">
          <Play size={16} fill="currentColor" className="ml-0.5" aria-hidden />
        </span>
        {label}
      </button>

      <dialog
        ref={dialog}
        aria-label={props.title}
        onClose={() => video.current?.pause()}
        onClick={(e) => { if (e.target === dialog.current) close(); }} // a tap outside the video closes it
        className="m-auto max-h-none max-w-none overflow-visible bg-transparent p-0 backdrop:bg-black/85 backdrop:backdrop-blur-sm"
      >
        <div className="relative" style={{ width: "min(92vw, calc(86vh * 9 / 16))", aspectRatio: "9 / 16" }}>
          <video
            ref={video}
            src={s.src}
            poster={s.poster}
            preload="none"
            playsInline
            controls
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            className="h-full w-full rounded-3xl bg-black object-cover shadow-2xl focus-visible:ring-2 focus-visible:ring-white/30"
          />
          <button
            type="button"
            onClick={close}
            aria-label={L.close}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
      </dialog>
    </>
  );
}
