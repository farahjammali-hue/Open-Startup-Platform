export type StartupStage = "idea" | "prototype" | "mvp" | "early_revenue" | "growth" | "scale";

/** Shared by every screen that shows or edits a startup's stage (form, admin lists, startup detail views). */
export const STAGE_LABELS: Record<StartupStage, string> = {
  idea: "Idea",
  prototype: "Prototype",
  mvp: "MVP",
  early_revenue: "Early revenue",
  growth: "Growth",
  scale: "Scale",
};

export const STAGE_OPTIONS = (Object.keys(STAGE_LABELS) as StartupStage[]).map((value) => ({
  value,
  label: STAGE_LABELS[value],
}));
