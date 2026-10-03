"use client";
import { useEffect } from "react";
import { markNotificationsSeen } from "@/app/actions/notifications";

/** Opening an inbox marks its messages read (done here, not while the page renders, so prefetching can't). */
export default function MarkSeen({ when }: { when: boolean }) {
  useEffect(() => { if (when) markNotificationsSeen().catch(() => null); }, [when]);
  return null;
}
