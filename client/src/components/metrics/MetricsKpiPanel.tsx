import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";
import { Skeleton } from "../Skeleton";
import {
  METRIC_SECTIONS, MONTHS, monthPeriodsForYear, QUARTER_END_MONTH_INDEX,
  DATA_ROOM_ITEMS, COMPANY_PROFILE_GROUPS,
  type MetricSection, type MetricDef,
} from "@shared/metricsCatalog";
import { Loader2, Plus, Trash2, ChevronDown, Table2, ListChecks } from "lucide-react";

interface MetricEntry { id: string; period: string; values: Record<string, number | string> }
interface MetricsProfile {
  salesNotes: string | null;
  revenueNotes: string | null;
  teamRecruitNotes: string | null;
  partnershipNotes: string | null;
  fundraisingNotes: string | null;
  dataRoom: Record<string, { inception?: boolean; graduation?: boolean }>;
  companyProfile: Record<string, { inception?: string; graduation?: string }>;
}
interface Achievement { id: string; achievedAt: string | null; details: string; createdAt: string }

const EMPTY_PROFILE: MetricsProfile = {
  salesNotes: null, revenueNotes: null, teamRecruitNotes: null, partnershipNotes: null, fundraisingNotes: null,
  dataRoom: {}, companyProfile: {},
};

function parseValue(v: string): number | string {
  const trimmed = v.trim();
  if (trimmed === "") return "";
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : v;
}

function periodLabel(period: string, year: number): string {
  if (period === "initial") return "Initial Data";
  const monthIdx = Number(period.slice(5, 7)) - 1;
  return MONTHS[monthIdx] ?? period;
}

/** A section is "filled" for a period once at least one of its metrics has a value. */
function filledCount(values: Record<string, string> | undefined, section: MetricSection): number {
  if (!values) return 0;
  return section.metrics.filter((m) => (values[m.key] ?? "").trim() !== "").length;
}

/** A number input that shows a fixed "$" prefix inside the field for dollar-denominated metrics. */
function MetricInput({
  metric,
  className,
  ...rest
}: {
  metric: MetricDef;
  className: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  if (metric.unit !== "money") {
    return <input className={className} {...rest} />;
  }
  // The "$" is an absolutely-positioned overlay inside the same box as every
  // other cell, so columns stay aligned. Its wrapper needs an explicit
  // z-index below the sticky "Metric" column's (see SectionTable) — without
  // that, this positioned wrapper paints above the sticky column on scroll.
  return (
    <div className="relative z-0">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">$</span>
      <input className={`${className} pl-5`} {...rest} />
    </div>
  );
}

export function MetricsKpiPanel({ apiBase }: { apiBase: string }) {
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const periods = useMemo(() => ["initial", ...monthPeriodsForYear(year)], [year]);
  const defaultPeriod = periods[new Date().getMonth() + 1]; // current month, "initial" is index 0

  const { data, isLoading } = useQuery<{ entries: MetricEntry[]; profile: MetricsProfile | null; achievements: Achievement[] }>({
    queryKey: ["metrics-panel", apiBase],
    queryFn: () => api(apiBase),
  });

  const [viewMode, setViewMode] = useState<"simple" | "table">("simple");
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([METRIC_SECTIONS[0].key]));
  const [otherExpanded, setOtherExpanded] = useState(false);

  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [dirtyPeriods, setDirtyPeriods] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<MetricsProfile>(EMPTY_PROFILE);
  const [profileDirty, setProfileDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const next: Record<string, Record<string, string>> = {};
    for (const period of periods) next[period] = {};
    for (const entry of data.entries) {
      next[entry.period] = Object.fromEntries(
        Object.entries(entry.values).map(([k, v]) => [k, String(v)]),
      );
    }
    setValues(next);
    setDirtyPeriods(new Set());
    setProfile(data.profile ?? EMPTY_PROFILE);
    setProfileDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function setCell(period: string, key: string, val: string) {
    setValues((prev) => ({ ...prev, [period]: { ...prev[period], [key]: val } }));
    setDirtyPeriods((prev) => new Set(prev).add(period));
  }

  function toggleSection(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function setNote(field: keyof MetricsProfile, val: string) {
    setProfile((prev) => ({ ...prev, [field]: val }));
    setProfileDirty(true);
  }

  function setDataRoomField(itemKey: string, point: "inception" | "graduation", checked: boolean) {
    setProfile((prev) => ({
      ...prev,
      dataRoom: { ...prev.dataRoom, [itemKey]: { ...prev.dataRoom[itemKey], [point]: checked } },
    }));
    setProfileDirty(true);
  }

  function setCompanyProfileField(fieldKey: string, point: "inception" | "graduation", val: string) {
    setProfile((prev) => ({
      ...prev,
      companyProfile: { ...prev.companyProfile, [fieldKey]: { ...prev.companyProfile[fieldKey], [point]: val } },
    }));
    setProfileDirty(true);
  }

  async function saveAll() {
    setSaving(true);
    try {
      for (const period of dirtyPeriods) {
        const raw = values[period] ?? {};
        const parsed: Record<string, number | string> = {};
        for (const [k, v] of Object.entries(raw)) parsed[k] = parseValue(v);
        await api(`${apiBase}/${period}`, { method: "PATCH", body: JSON.stringify({ values: parsed }) });
      }
      if (profileDirty) {
        await api(`${apiBase}/profile`, {
          method: "PATCH",
          body: JSON.stringify({
            salesNotes: profile.salesNotes ?? "",
            revenueNotes: profile.revenueNotes ?? "",
            teamRecruitNotes: profile.teamRecruitNotes ?? "",
            partnershipNotes: profile.partnershipNotes ?? "",
            fundraisingNotes: profile.fundraisingNotes ?? "",
            dataRoom: profile.dataRoom,
            companyProfile: profile.companyProfile,
          }),
        });
      }
      showToast("Changes saved");
      qc.invalidateQueries({ queryKey: ["metrics-panel", apiBase] });
    } catch (e: any) {
      showToast(e.message || "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  }

  const hasUnsaved = dirtyPeriods.size > 0 || profileDirty;

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Editable by both the founder and the OST team.</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
            <button
              onClick={() => setViewMode("simple")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "simple" ? "bg-secondary text-white" : "text-slate-500 hover:text-primary"
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" /> Fill in by month
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "table" ? "bg-secondary text-white" : "text-slate-500 hover:text-primary"
              }`}
            >
              <Table2 className="h-3.5 w-3.5" /> Full table
            </button>
          </div>
          <button
            onClick={saveAll}
            disabled={!hasUnsaved || saving}
            className="ost-btn-primary !px-4 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </button>
        </div>
      </div>

      {viewMode === "simple" ? (
        <>
          <div className="ost-card p-4">
            <p className="ost-label !mb-2">Period</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    selectedPeriod === p ? "bg-secondary text-white" : "bg-slate-100 text-slate-500 hover:text-primary"
                  }`}
                >
                  {periodLabel(p, year)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">Quarterly summaries (Q1–Q4) are shown in Full table view, once March/June/September/December have values.</p>
          </div>

          {METRIC_SECTIONS.map((section) => (
            <SectionSimpleForm
              key={section.key}
              section={section}
              isOpen={expanded.has(section.key)}
              onToggle={() => toggleSection(section.key)}
              period={selectedPeriod}
              periodLabel={periodLabel(selectedPeriod, year)}
              values={values[selectedPeriod]}
              setCell={setCell}
              note={(profile[section.noteField as keyof MetricsProfile] as string | null) ?? ""}
              onNoteChange={(v) => setNote(section.noteField as keyof MetricsProfile, v)}
            />
          ))}
        </>
      ) : (
        METRIC_SECTIONS.map((section) => (
          <SectionTable
            key={section.key}
            section={section}
            isOpen={expanded.has(section.key)}
            onToggle={() => toggleSection(section.key)}
            periods={periods}
            values={values}
            setCell={setCell}
            note={(profile[section.noteField as keyof MetricsProfile] as string | null) ?? ""}
            onNoteChange={(v) => setNote(section.noteField as keyof MetricsProfile, v)}
          />
        ))
      )}

      <div className="ost-card overflow-hidden">
        <button
          onClick={() => setOtherExpanded((v) => !v)}
          className="flex w-full items-center justify-between p-6 text-left"
        >
          <h3 className="ost-card-title text-base">VI. Other metrics</h3>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${otherExpanded ? "rotate-180" : ""}`} />
        </button>

        {otherExpanded && (
          <div className="border-t border-slate-100 p-6 pt-5">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Data Room checklist</h4>
            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 font-semibold">Item</th>
                    <th className="py-2 pr-4 font-semibold">Ready by Inception</th>
                    <th className="py-2 pr-4 font-semibold">Ready by Graduation</th>
                  </tr>
                </thead>
                <tbody>
                  {DATA_ROOM_ITEMS.map((item) => (
                    <tr key={item.key} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-4 font-medium text-primary">{item.label}</td>
                      <td className="py-2 pr-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          aria-label={`${item.label} — ready by Inception`}
                          checked={profile.dataRoom[item.key]?.inception ?? false}
                          onChange={(e) => setDataRoomField(item.key, "inception", e.target.checked)}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          aria-label={`${item.label} — ready by Graduation`}
                          checked={profile.dataRoom[item.key]?.graduation ?? false}
                          onChange={(e) => setDataRoomField(item.key, "graduation", e.target.checked)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Company profile</h4>
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              {COMPANY_PROFILE_GROUPS.map((group) => (
                <div key={group.title} className="rounded-lg border border-slate-100 p-4">
                  <p className="mb-2 text-sm font-bold text-primary">{group.title}</p>
                  {group.fields.map((field) => (
                    <div key={field.key} className="mb-3 last:mb-0">
                      <label className="ost-label">{field.label}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="ost-input"
                          placeholder="At Inception"
                          aria-label={`${field.label} — at Inception`}
                          value={profile.companyProfile[field.key]?.inception ?? ""}
                          onChange={(e) => setCompanyProfileField(field.key, "inception", e.target.value)}
                        />
                        <input
                          className="ost-input"
                          placeholder="At Graduation"
                          aria-label={`${field.label} — at Graduation`}
                          value={profile.companyProfile[field.key]?.graduation ?? ""}
                          onChange={(e) => setCompanyProfileField(field.key, "graduation", e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Achievements</h4>
            <AchievementsLog apiBase={apiBase} achievements={data.achievements} />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  badge,
  isOpen,
  onToggle,
}: {
  title: string;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between p-6 text-left">
      <span className="flex items-center gap-2.5">
        <h3 className="ost-card-title text-base">{title}</h3>
        {badge && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{badge}</span>}
      </span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
    </button>
  );
}

function SectionSimpleForm({
  section,
  isOpen,
  onToggle,
  period,
  periodLabel: periodLabelText,
  values,
  setCell,
  note,
  onNoteChange,
}: {
  section: MetricSection;
  isOpen: boolean;
  onToggle: () => void;
  period: string;
  periodLabel: string;
  values: Record<string, string> | undefined;
  setCell: (period: string, key: string, val: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
}) {
  const filled = filledCount(values, section);
  return (
    <div className="ost-card overflow-hidden">
      <SectionHeader title={section.title} badge={`${filled}/${section.metrics.length} filled for ${periodLabelText}`} isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="border-t border-slate-100 p-6 pt-5">
          <div className="space-y-3">
            {section.metrics.map((metric) => (
              <div key={metric.key} className="flex items-center justify-between gap-4">
                <label htmlFor={`${section.key}-${period}-${metric.key}`} className="text-sm text-slate-600">{metric.label}</label>
                <MetricInput
                  metric={metric}
                  id={`${section.key}-${period}-${metric.key}`}
                  className="ost-input w-36 shrink-0 tabular-nums"
                  value={values?.[metric.key] ?? ""}
                  onChange={(e) => setCell(period, metric.key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <label className="ost-label mt-5">{section.noteLabel}</label>
          <textarea className="ost-input min-h-[50px]" value={note} onChange={(e) => onNoteChange(e.target.value)} />
        </div>
      )}
    </div>
  );
}

function SectionTable({
  section,
  isOpen,
  onToggle,
  periods,
  values,
  setCell,
  note,
  onNoteChange,
}: {
  section: MetricSection;
  isOpen: boolean;
  onToggle: () => void;
  periods: string[];
  values: Record<string, Record<string, string>>;
  setCell: (period: string, key: string, val: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
}) {
  const monthPeriods = periods.slice(1); // drop "initial"

  function quarterValue(metricKey: string, quarterIdx: number): string {
    const monthIdx = QUARTER_END_MONTH_INDEX[quarterIdx];
    const period = monthPeriods[monthIdx];
    return values[period]?.[metricKey] ?? "";
  }

  return (
    <div className="ost-card overflow-hidden">
      <SectionHeader title={section.title} isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="border-t border-slate-100 p-6 pt-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="sticky left-0 z-10 bg-white py-2 pr-4 font-semibold">Metric</th>
                  <th className="py-2 px-2 font-semibold">Initial Data</th>
                  {MONTHS.map((m) => <th key={m} className="py-2 px-2 font-semibold">{m.slice(0, 3)}</th>)}
                  <th className="py-2 px-2 font-semibold text-slate-300">Q1</th>
                  <th className="py-2 px-2 font-semibold text-slate-300">Q2</th>
                  <th className="py-2 px-2 font-semibold text-slate-300">Q3</th>
                  <th className="py-2 px-2 font-semibold text-slate-300">Q4</th>
                </tr>
              </thead>
              <tbody>
                {section.metrics.map((metric) => (
                  <tr key={metric.key} className="border-b border-slate-50 last:border-0">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-1.5 pr-4 font-medium text-primary">{metric.label}</td>
                    <td className="px-1 py-1.5">
                      <MetricInput
                        metric={metric}
                        className="ost-input !py-1 w-24 text-xs tabular-nums"
                        aria-label={`${metric.label} — Initial Data`}
                        value={values.initial?.[metric.key] ?? ""}
                        onChange={(e) => setCell("initial", metric.key, e.target.value)}
                      />
                    </td>
                    {monthPeriods.map((period, i) => (
                      <td key={period} className="px-1 py-1.5">
                        <MetricInput
                          metric={metric}
                          className="ost-input !py-1 w-20 text-xs tabular-nums"
                          aria-label={`${metric.label} — ${MONTHS[i]}`}
                          value={values[period]?.[metric.key] ?? ""}
                          onChange={(e) => setCell(period, metric.key, e.target.value)}
                        />
                      </td>
                    ))}
                    {(["Q1", "Q2", "Q3", "Q4"] as const).map((q, i) => (
                      <td key={q} className="px-1 py-1.5">
                        <MetricInput
                          metric={metric}
                          className="ost-input !py-1 w-20 bg-slate-50 text-xs tabular-nums text-slate-400"
                          aria-label={`${metric.label} — ${q} (computed from ${MONTHS[QUARTER_END_MONTH_INDEX[i]]})`}
                          value={quarterValue(metric.key, i)}
                          disabled
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="ost-label mt-4">{section.noteLabel}</label>
          <textarea className="ost-input min-h-[50px]" value={note} onChange={(e) => onNoteChange(e.target.value)} />
        </div>
      )}
    </div>
  );
}

function AchievementsLog({ apiBase, achievements }: { apiBase: string; achievements: Achievement[] }) {
  const qc = useQueryClient();
  const [achievedAt, setAchievedAt] = useState("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["metrics-panel", apiBase] });
  }

  async function add() {
    if (!details.trim()) return;
    setSaving(true);
    try {
      await api(`${apiBase}/achievements`, {
        method: "POST",
        body: JSON.stringify({ achievedAt: achievedAt || undefined, details }),
      });
      setAchievedAt("");
      setDetails("");
      invalidate();
    } catch (e: any) {
      showToast(e.message || "Couldn't add this entry");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Delete this achievement entry? "${label}" — this can't be undone.`)) return;
    try {
      await api(`${apiBase}/achievements/${id}`, { method: "DELETE" });
      invalidate();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this entry");
    }
  }

  return (
    <div>
      <div className="mb-3 space-y-2">
        {achievements.length === 0 && <p className="text-sm text-slate-400">No achievements logged yet.</p>}
        {achievements.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
            <div className="min-w-0">
              {a.achievedAt && <span className="mr-2 text-xs font-semibold text-slate-400">{a.achievedAt}</span>}
              <span className="text-sm text-slate-600">{a.details}</span>
            </div>
            <button
              aria-label={`Delete achievement: ${a.details}`}
              onClick={() => remove(a.id, a.details)}
              className="ost-btn-ghost !p-1.5 shrink-0 text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <div className="w-40">
          <label className="ost-label" htmlFor="achievement-date">Date</label>
          <input id="achievement-date" className="ost-input" placeholder="e.g. 2026-09" value={achievedAt} onChange={(e) => setAchievedAt(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="ost-label" htmlFor="achievement-details">Details</label>
          <input id="achievement-details" className="ost-input" placeholder="What happened?" value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
        <div>
          <label className="ost-label invisible">Add</label>
          <button
            onClick={add}
            disabled={saving || !details.trim()}
            className="ost-btn-ghost !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
          </button>
        </div>
      </div>
    </div>
  );
}
