import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { EmptyState } from "../../components/EmptyState";
import { showToast } from "../../lib/toast";
import { KPI_PHASES, KPI_PHASE_LABELS, type KpiPhase } from "../../lib/kpiPhases";
import { kpiSectionsForTrack, KPI_FIELD_TO_COLUMN, type StartupTechTrack } from "../../lib/kpiSections";
import { TrendingUp, Plus, Loader2, Cpu, Sparkles, Trash2 } from "lucide-react";
import type { KpiSubmission } from "./types";
import type { StartupProfile } from "../StartupDashboard";

const TRACKS: { id: StartupTechTrack; label: string; icon: typeof Cpu }[] = [
  { id: "deep_tech", label: "Deep-tech", icon: Cpu },
  { id: "soft_tech", label: "Soft-tech", icon: Sparkles },
];

function TrackPicker({ startupId, current, onSaved }: { startupId: string; current: StartupTechTrack | null; onSaved: () => void }) {
  const [busy, setBusy] = useState<StartupTechTrack | "clear" | null>(null);

  async function save(track: StartupTechTrack | null) {
    setBusy(track ?? "clear");
    try {
      await api(`/api/startups/${startupId}/tech-track`, { method: "PATCH", body: JSON.stringify({ techTrack: track }) });
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Couldn't save your track");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="ost-card p-8">
      <h3 className="ost-card-title">Which track fits your startup?</h3>
      <p className="ost-card-subtext mt-1">This decides which questions you'll answer for KPI collection.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {TRACKS.map((t) => {
          const Icon = t.icon;
          const active = current === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => save(active ? null : t.id)}
              disabled={busy !== null}
              className={`group relative flex flex-col items-start rounded-2xl border p-6 text-left transition disabled:cursor-not-allowed ${
                active
                  ? "border-secondary bg-secondary/5"
                  : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-secondary hover:shadow-card-hover"
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${active ? "bg-secondary text-white" : "bg-secondary/10 text-secondary"}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h4 className="mt-4 text-lg font-bold text-primary">{t.label}</h4>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-secondary">
                {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? "Selected" : "Choose →"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Small clickable pill shown once a track is picked — click it again to unselect and go back to the picker. */
function TrackBadge({ startupId, track, onSaved }: { startupId: string; track: StartupTechTrack; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const t = TRACKS.find((x) => x.id === track)!;
  const Icon = t.icon;

  async function unselect() {
    setBusy(true);
    try {
      await api(`/api/startups/${startupId}/tech-track`, { method: "PATCH", body: JSON.stringify({ techTrack: null }) });
      onSaved();
    } catch (e: any) {
      showToast(e.message || "Couldn't update your track");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={unselect}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/5 px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-secondary/10 disabled:cursor-not-allowed"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />} {t.label}
    </button>
  );
}

export function KpiPanel({ submissions, startup }: { submissions: KpiSubmission[]; startup: StartupProfile | null }) {
  const qc = useQueryClient();
  const completedPhases = submissions.map((s) => s.phase);
  const nextPhase = KPI_PHASES.find((p) => !completedPhases.includes(p)) ?? KPI_PHASES[KPI_PHASES.length - 1];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<KpiPhase>(nextPhase);
  const [values, setValues] = useState<Record<string, string>>({});

  function setField(label: string, v: string) {
    setValues((cur) => ({ ...cur, [label]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { phase, metrics: {} };
      for (const [label, raw] of Object.entries(values)) {
        if (raw.trim() === "") continue;
        const column = KPI_FIELD_TO_COLUMN[label];
        if (column) payload[column] = Number(raw);
        else (payload.metrics as Record<string, string>)[label] = raw;
      }
      await api("/api/kpis", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      setValues({});
      qc.invalidateQueries({ queryKey: ["kpis"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't submit this KPI update");
    } finally { setBusy(false); }
  }

  async function removeSubmission(s: KpiSubmission) {
    if (!confirm(`Remove your ${KPI_PHASE_LABELS[s.phase]} submission? This can't be undone.`)) return;
    try {
      await api(`/api/kpis/${s.id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["kpis"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't remove this submission");
    }
  }

  if (!startup) return null;

  if (!startup.techTrack) {
    return (
      <TrackPicker
        startupId={startup.id}
        current={startup.techTrack}
        onSaved={() => qc.invalidateQueries({ queryKey: ["startup-me"] })}
      />
    );
  }

  const sections = kpiSectionsForTrack(startup.techTrack);

  return (
    <div className="space-y-6">
      <section className="ost-card p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="ost-card-title flex items-center gap-2"><TrendingUp className="h-4 w-4 text-secondary" /> Phase KPIs</h3>
          <div className="flex items-center gap-2">
            <TrackBadge startupId={startup.id} track={startup.techTrack} onSaved={() => qc.invalidateQueries({ queryKey: ["startup-me"] })} />
            <button onClick={() => setOpen((o) => !o)} className="ost-btn-ghost !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Submit phase</button>
          </div>
        </div>

          {open && (
            <form onSubmit={submit} className="mt-4 rounded-lg border border-slate-100 p-6">
              <div className="mb-6">
                <label className="ost-label">Phase</label>
                <select className="ost-input" value={phase} onChange={(e) => setPhase(e.target.value as KpiPhase)}>
                  {KPI_PHASES.map((p) => <option key={p} value={p}>{KPI_PHASE_LABELS[p]}{completedPhases.includes(p) ? " (already submitted)" : ""}</option>)}
                </select>
              </div>

              {sections.map((sec, i) => (
                <fieldset key={sec.title} className="mb-6 border-b border-slate-200 pb-6 last:mb-0 last:border-b-0 last:pb-0">
                  <legend className="mb-4 flex w-full items-center justify-between border-b border-slate-200 pb-3 text-sm font-extrabold text-primary">
                    {sec.title}
                    <span className="ost-helper-text font-bold">{i + 1} of {sections.length}</span>
                  </legend>
                  {sec.prefilled && (
                    <p className="mb-4 rounded-lg bg-turq-bg px-4 py-3 text-xs text-turq-text">
                      Pre-filled from your Team records. Confirm or update below.
                    </p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {sec.fields.map((label) => {
                      const isNumeric = !!KPI_FIELD_TO_COLUMN[label];
                      return (
                        <div key={label}>
                          <label className="mb-1.5 block text-xs font-semibold text-primary">{label}</label>
                          <input
                            className="ost-input"
                            type={isNumeric ? "number" : "text"}
                            placeholder="Enter 0 if not yet applicable"
                            value={values[label] ?? ""}
                            onChange={(e) => setField(label, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              <button type="submit" className="ost-btn-primary mt-2 w-full !py-2.5 text-sm" disabled={busy}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save KPIs</button>
            </form>
          )}

          <div className="mt-6">
            {submissions.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No KPIs submitted yet"
                description="Submit your Program entry phase to start building your growth history."
                actionLabel="Submit phase"
                onAction={() => setOpen(true)}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-slate-400"><th className="pb-2 pr-4 font-semibold">Phase</th><th className="pb-2 pr-4 font-semibold">Revenue</th><th className="pb-2 pr-4 font-semibold">Customers</th><th className="pb-2 pr-4 font-semibold">Team size</th><th className="pb-2 pr-4 font-semibold" /></tr></thead>
                  <tbody>
                    {submissions.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="py-2 pr-4 font-semibold text-primary">{KPI_PHASE_LABELS[s.phase]}</td>
                        <td className="py-2 pr-4 text-slate-600">{s.revenue ?? "—"}</td>
                        <td className="py-2 pr-4 text-slate-600">{s.activeUsers ?? "—"}</td>
                        <td className="py-2 pr-4 text-slate-600">{s.teamSize ?? "—"}</td>
                        <td className="py-2 pr-4 text-right">
                          <button
                            aria-label={`Remove ${KPI_PHASE_LABELS[s.phase]} submission`}
                            title="Remove submission"
                            onClick={() => removeSubmission(s)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
  );
}
