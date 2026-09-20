"use client";
import { useState } from "react";
import UnskippableVideo from "./unskippable-video";
import { markVideoWatched } from "@/app/actions/training";

type Video = { id: string; title: string; youtube_url: string };

export default function TrainingList({ videos, completedIds }: { videos: Video[]; completedIds: string[] }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set(completedIds));

  if (videos.length === 0) {
    return <p className="text-sm text-stone-400">No training videos yet — check back soon.</p>;
  }

  return (
    <div className="space-y-5">
      {videos.map((v) => (
        <div key={v.id} className="card p-4">
          <p className="mb-2 font-bold text-brand-brown">{v.title}</p>
          <UnskippableVideo
            id={v.id}
            youtubeUrl={v.youtube_url}
            completed={completed.has(v.id)}
            onComplete={() => {
              setCompleted((prev) => new Set(prev).add(v.id));
              void markVideoWatched(v.id);
            }}
          />
        </div>
      ))}
    </div>
  );
}
