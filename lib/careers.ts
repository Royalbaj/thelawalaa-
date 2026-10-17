// Careers (/careers, Admin → Careers, migration 048) — the words both sides
// share. No server-only imports: the public apply form uses them too.

export const JOB_TYPES = { full_time: "Full time", part_time: "Part time", shift: "Shifts", internship: "Internship" } as const;
export type JobType = keyof typeof JOB_TYPES;

export const APPLICATION_STATUS = {
  new: "New", shortlisted: "Shortlisted", interview: "Interview", hired: "Hired", rejected: "Not this time",
} as const;
export type ApplicationStatus = keyof typeof APPLICATION_STATUS;

export const EXPERIENCE = ["No experience — happy to learn", "Under 1 year", "1–2 years", "3 years or more"] as const;
export const AVAILABILITY = ["Full time", "Part time", "Mornings", "Evenings", "Weekends"] as const;

/** "Any job": a CV kept on file for when we're hiring (no listing open, or none that fits). */
export const ANY_ROLE = "Any role";
export const ROLE_IDEAS = ["Counter & cashier", "Kitchen / cook", "Delivery rider", "Cleaning & helper"] as const;

export const CV_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};
export const MAX_CV_MB = 5;
export const CV_PATH = /^cvs\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(pdf|doc|docx|jpg|png|webp)$/;
