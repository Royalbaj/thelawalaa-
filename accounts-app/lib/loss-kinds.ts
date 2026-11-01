// Waste & loss (migration 052) — the four kinds, shared by the form and the page.
export const LOSS_KINDS = {
  waste: { label: "Food waste", hint: "Spoiled, burnt, dropped, past its date" },
  broken: { label: "Broken / damaged", hint: "Plates, glasses, a tool, equipment" },
  missing: { label: "Missing / stolen", hint: "Can't be found, short in a delivery, taken" },
  other: { label: "Other loss", hint: "Anything else the shop lost" },
} as const;
export type LossKind = keyof typeof LOSS_KINDS;
export const LOSS_KIND_KEYS = Object.keys(LOSS_KINDS) as LossKind[];
