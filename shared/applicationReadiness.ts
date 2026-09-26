// PHASE D: whether a startup's data is complete enough to submit an
// investment application. Pure and shared: the founder page renders these
// checks as a checklist with deep links, and the server enforces the same
// list at submit time — one source of truth, no drift.

export interface ReadinessInput {
  /** Core profile fields from the startups row. */
  startup: {
    shortDescription?: string | null;
    detailedDescription?: string | null;
    location?: string | null;
    stage?: string | null;
    dataRoomLink?: string | null;
  };
  kysSubmitted: boolean;
  contractUploaded: boolean;
  /** Periods ("initial" | "YYYY-MM") that have at least one metric value. */
  metricPeriodsWithValues: string[];
  /** Uploaded data-room documents. */
  documentsCount: number;
  /** For the freshness check; injectable for tests. */
  now?: Date;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
  /** Where to fix it. */
  link: string;
}

export interface Readiness {
  ready: boolean;
  checks: ReadinessCheck[];
  missing: string[];
}

/** "YYYY-MM" for this month and the previous one — "recent" for metrics. */
function recentPeriods(now: Date): string[] {
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return [fmt(cur), fmt(prev)];
}

export function computeApplicationReadiness(input: ReadinessInput): Readiness {
  const now = input.now ?? new Date();
  const s = input.startup;
  const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;
  const recent = recentPeriods(now);

  const checks: ReadinessCheck[] = [
    {
      key: "kys",
      label: "KYS submitted",
      ok: input.kysSubmitted,
      link: "/contract-kys",
    },
    {
      key: "contract",
      label: "Program agreement uploaded",
      ok: input.contractUploaded,
      link: "/contract-kys",
    },
    {
      key: "profile",
      label: "Company profile filled in (description, location, stage)",
      ok: filled(s.shortDescription) && filled(s.detailedDescription) && filled(s.location) && filled(s.stage),
      link: "/dashboard",
    },
    {
      key: "metrics",
      label: "Metrics saved for this month or last month",
      ok: input.metricPeriodsWithValues.some((p) => recent.includes(p)),
      link: "/dashboard",
    },
    {
      key: "dataRoom",
      label: "Data room started (a document or a link)",
      ok: input.documentsCount > 0 || filled(s.dataRoomLink),
      link: "/data-room",
    },
  ];

  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return { ready: missing.length === 0, checks, missing };
}
