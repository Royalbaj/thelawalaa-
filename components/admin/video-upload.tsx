"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createSiteMediaUpload } from "@/app/actions/site-content";
import { MAX_VIDEO_MB, SITE_MEDIA_BUCKET } from "@/lib/site-media";
import { cn } from "@/lib/utils";

/** A frame from about a second in, as a JPEG cover picture (null if this browser can't read the video). */
async function coverFrom(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  const wait = (event: "loadeddata" | "seeked") => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 15000);
    video.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
    video.addEventListener("error", () => { clearTimeout(timer); reject(new Error("unreadable")); }, { once: true });
  });
  try {
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await wait("loadeddata");
    video.currentTime = Math.min(1.5, (video.duration || 3) / 3);
    await wait("seeked");
    const scale = Math.min(1, 720 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Upload one file straight to the site-media bucket through a signed URL; returns its public link. */
async function put(kind: "video" | "image", file: Blob, type: string) {
  const slot = await createSiteMediaUpload({ kind, type, size: file.size });
  if ("error" in slot) throw new Error(slot.error);
  const { error } = await createClient().storage.from(SITE_MEDIA_BUCKET)
    .uploadToSignedUrl(slot.path, slot.token, file, { contentType: type });
  if (error) throw new Error("Upload failed — check the connection and try again");
  return slot.url;
}

/**
 * Admin → Website text → How-to-order video: pick an MP4 → it goes to Storage
 * with a cover picture made from it → both fields are filled in; Save puts
 * them on the website (and deletes the old upload).
 */
export default function VideoUpload({ onUploaded }: { onUploaded: (video: string, poster: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(file: File) {
    if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) { toast.error("Choose an MP4 video"); return; }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) { toast.error(`That video is too big — up to ${MAX_VIDEO_MB} MB (export it at 720p)`); return; }
    try {
      setBusy("Making the cover picture…");
      const cover = await coverFrom(file);
      setBusy(`Uploading the video (${(file.size / 1024 / 1024).toFixed(1)} MB)…`);
      const video = await put("video", file, file.type);
      // No cover (the browser couldn't read the video): the player shows the video's first frame.
      const poster = cover ? await put("image", cover, "image/jpeg").catch(() => "none") : "none";
      onUploaded(video, poster);
      toast.success("Uploaded — press Save to put it on the website");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <label className={cn("mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-brand-orange px-4 py-2 text-sm font-bold text-brand-orange transition hover:bg-orange-50",
      busy && "pointer-events-none opacity-60")}>
      <Upload size={15} aria-hidden />
      {busy ?? "Upload a new video"}
      <input
        type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={!!busy}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }}
      />
    </label>
  );
}
