// Media the homepage shows that the admin can change (Admin → Website text):
// the how-to-order video and its cover picture. Either one of ours in
// public/videos, or a file uploaded to the public "site-media" bucket
// (migration 047). Nothing else is accepted, so the site never embeds a
// stranger's file. No server-only imports: the admin page uses it too.

export const SITE_MEDIA_BUCKET = "site-media";
export const DEFAULT_HOWTO_VIDEO = "/videos/how-to-order.mp4";
export const DEFAULT_HOWTO_POSTER = "/videos/how-to-order-poster.jpg";
export const MAX_VIDEO_MB = 50;

const bucketUrl = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "")}/storage/v1/object/public/${SITE_MEDIA_BUCKET}/`;
const EXT = { video: /\.(mp4|webm|mov)$/i, image: /\.(jpe?g|png|webp)$/i };

/** The link if it's a video / picture the site may show, otherwise null. */
export function ownMediaUrl(value: string | null | undefined, kind: "video" | "image"): string | null {
  const s = (value ?? "").trim();
  const ours = /^\/videos\/[\w.-]+$/.test(s) || (s.startsWith(bucketUrl) && /^[\w-]+(\/[\w.-]+)+$/.test(s.slice(bucketUrl.length)));
  return ours && EXT[kind].test(s) ? s : null;
}

/** The file's path inside the bucket, when the link is an upload of ours (to delete it once replaced). */
export const bucketPath = (value: string | null | undefined) =>
  value?.startsWith(bucketUrl) ? value.slice(bucketUrl.length) : null;
