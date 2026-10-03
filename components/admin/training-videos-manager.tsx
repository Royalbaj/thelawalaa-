"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { Trash2, PlayCircle, CheckCircle2, Clock } from "lucide-react";
import { addTrainingVideo, setTrainingVideoActive, deleteTrainingVideo } from "@/app/actions/training";
import type { TrainingVideoStatus as Video } from "@/lib/training-status";

export default function TrainingVideosManager({ videos }: { videos: Video[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h3 className="font-display font-bold text-brand-brown">Training videos</h3>
        <p className="text-xs text-stone-500">Staff can&apos;t skip ahead — they must watch to the end. Each person sees the ones given to them (Team & PINs above).</p>
      </div>
      <div className="space-y-2">
        {videos.map((v) => (
          <div key={v.id} className="flex items-start gap-2 rounded-xl bg-stone-50 p-2.5">
            <PlayCircle size={16} className="mt-0.5 shrink-0 text-brand-brown" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">{v.title}</p>
              <p className="truncate text-[11px] text-stone-500">{v.youtube_url}</p>
              {/* Who finished it (first time, Nepal time) and, while it's on, who hasn't yet. */}
              <ul className="mt-1.5 space-y-0.5 text-[11px]">
                {v.watched.map((w, i) => (
                  <li key={i} className="flex items-center gap-1 font-bold text-green-700">
                    <CheckCircle2 size={11} className="shrink-0" /> {w.name} <span className="font-normal text-stone-400">· {w.at}</span>
                  </li>
                ))}
                {v.is_active && v.notYet.length > 0 && (
                  <li className="flex items-center gap-1 font-bold text-amber-700">
                    <Clock size={11} className="shrink-0" /> Not yet: {v.notYet.join(", ")}
                  </li>
                )}
                {v.watched.length === 0 && !(v.is_active && v.notYet.length > 0) && (
                  <li className="text-stone-400">Nobody has watched this yet.</li>
                )}
              </ul>
            </div>
            <button
              disabled={pending}
              onClick={() => start(async () => {
                const r = await setTrainingVideoActive(v.id, !v.is_active);
                r?.error ? toast.error(r.error) : toast.success("Updated");
              })}
              className={v.is_active ? "badge bg-green-100 text-green-800 shrink-0" : "badge bg-stone-200 text-stone-600 shrink-0"}
            >
              {v.is_active ? "On" : "Off"}
            </button>
            <button
              disabled={pending}
              onClick={() => {
                if (!confirm(`Remove "${v.title}"?`)) return;
                start(async () => {
                  const r = await deleteTrainingVideo(v.id);
                  r?.error ? toast.error(r.error) : toast.success("Removed");
                });
              }}
              className="shrink-0 text-stone-400 hover:text-brand-red transition"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {videos.length === 0 && <p className="text-sm text-stone-400">No training videos yet.</p>}
      </div>
      <form
        className="space-y-2 border-t border-stone-100 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = Object.fromEntries(new FormData(form));
          start(async () => {
            const r = await addTrainingVideo({ title: fd.title, youtube_url: fd.youtube_url, assign_all: fd.assign_all === "on" });
            if (r?.error) toast.error(r.error);
            else { toast.success("Video added"); form.reset(); }
          });
        }}
      >
        <input name="title" required placeholder="Video title (e.g. POS basics)" className="input" maxLength={100} />
        <input name="youtube_url" required type="url" placeholder="https://youtube.com/watch?v=..." className="input" maxLength={300} />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" name="assign_all" defaultChecked className="h-4 w-4 accent-brand-orange" /> Give it to everyone in the team
        </label>
        <button disabled={pending} className="btn-primary w-full">{pending ? "Adding…" : "Add video"}</button>
      </form>
    </div>
  );
}
