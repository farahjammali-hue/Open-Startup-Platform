/** The five fixed lifetime stages of the program. KPIs are collected once per phase, not monthly. */
export const KPI_PHASES = [
  "program_entry",
  "during_program_1",
  "during_program_2",
  "graduation",
  "post_program",
] as const;

export type KpiPhase = (typeof KPI_PHASES)[number];

export const KPI_PHASE_LABELS: Record<KpiPhase, string> = {
  program_entry: "Program entry",
  during_program_1: "During program 1",
  during_program_2: "During program 2",
  graduation: "Graduation",
  post_program: "Post program",
};

export const KPI_PHASE_SHORT_LABELS: Record<KpiPhase, string> = {
  program_entry: "Entry",
  during_program_1: "Prog. 1",
  during_program_2: "Prog. 2",
  graduation: "Grad.",
  post_program: "Post",
};
