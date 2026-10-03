"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import UnskippableVideo from "./unskippable-video";
import { markVideoWatched } from "@/app/actions/training";

type Video = { id: string; title: string; youtube_url: string };

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

export default function TrainingList({ videos, completedIds }: { videos: Video[]; completedIds: string[] }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set(completedIds));
  const setDone = (id: string, done: boolean) =>
    setCompleted((prev) => {
      const next = new Set(prev);
      if (done) next.add(id); else next.delete(id);
      return next;
    });

  if (videos.length === 0) {
    return <p className="text-sm text-stone-400">No training videos for you yet — the manager adds them in Admin → Staff Training.</p>;
  }

  const doneCount = videos.filter((v) => completed.has(v.id)).length;
  return (
    <div className="space-y-5">
      <p className="text-sm font-bold text-stone-500 dark:text-stone-400">
        {doneCount === videos.length ? "✅ All training watched — thank you!" : `${doneCount} of ${videos.length} watched`}
      </p>
      {videos.map((v) => (
        <div key={v.id} className="card p-4">
          <p className="mb-2 font-bold text-brand-brown dark:text-orange-100">{v.title}</p>
          <UnskippableVideo
            id={v.id}
            youtubeUrl={v.youtube_url}
            completed={completed.has(v.id)}
            onComplete={async () => {
              setDone(v.id, true);
              if (await saveWatched(v.id)) toast.success("Finished — the manager can see you've watched it");
              else {
                setDone(v.id, false);
                toast.error("Couldn't save that you finished — check the internet, then play the last few seconds again");
              }
            }}
          />
        </div>
      ))}
    </div>
  );
}
