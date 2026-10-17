// The /feedback form's choices — shared by the form, submitFeedback (which only
// accepts these) and Admin → Feedback. Plain words, no emoji (owner's call).

export const RATING_LABELS = ["", "Terrible", "Not good", "Okay", "Good", "Loved it"];

export const GOOD_TAGS = ["Tasty", "Hot & fresh", "Clean & hygienic", "Quick service", "Friendly staff", "Good value", "Nice packaging"] as const;
export const BAD_TAGS = ["Cold food", "Too spicy", "Not spicy enough", "Took too long", "Wrong or missing item", "Small portion", "Too expensive", "Not clean"] as const;
export const ALL_TAGS: readonly string[] = [...GOOD_TAGS, ...BAD_TAGS];
export const isGoodTag = (t: string) => (GOOD_TAGS as readonly string[]).includes(t);

/** The details people can rate on their own (1–5 each, all optional). */
export const ASPECTS = [
  { key: "taste", label: "Taste" },
  { key: "hygiene", label: "Cleanliness" },
  { key: "speed", label: "Speed" },
  { key: "value", label: "Value for money" },
] as const;
export type AspectKey = (typeof ASPECTS)[number]["key"];

export const VISITS = [["dine_in", "Ate here"], ["pickup", "Picked up"], ["delivery", "Delivery"]] as const;
export const VISIT_LABELS: Record<string, string> = Object.fromEntries(VISITS);
