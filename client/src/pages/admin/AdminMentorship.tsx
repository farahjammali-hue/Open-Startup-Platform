import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { parseCsvWithHeader } from "../../lib/csv";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { SkeletonRows } from "../../components/Skeleton";
import { ModalShell } from "../../components/ModalShell";
import { showToast } from "../../lib/toast";
import {
  Pencil, Trash2, Plus, Loader2, Building2, Upload,
} from "lucide-react";

interface Expert {
  id: string;
  name: string;
  bio: string | null;
  industries: string[] | null;
  expertiseAreas: string[] | null;
}

interface StartupRow {
  id: string;
  companyName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  mentorName: string | null;
}

/** Matches a CSV header cell to a field name, forgiving of spacing/casing/punctuation. */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z]/g, "");
}

const HEADER_ALIASES: Record<string, "name" | "bio" | "industries" | "expertiseAreas"> = {
  name: "name",
  bio: "bio",
  biobackground: "bio",
  background: "bio",
  industries: "industries",
  industry: "industries",
  industrytechnology: "industries",
  expertiseareas: "expertiseAreas",
  areasofexpertise: "expertiseAreas",
  expertise: "expertiseAreas",
};

export default function AdminMentorship() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [editingExpert, setEditingExpert] = useState<Expert | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const { data: startupsData, isLoading: startupsLoading } = useQuery<{ startups: StartupRow[] }>({
    queryKey: ["admin-startups"],
    queryFn: () => api("/api/admin/startups"),
  });
  const startups = startupsData?.startups ?? [];

  const { data: expertsData, isLoading: expertsLoading } = useQuery<{ experts: Expert[] }>({
    queryKey: ["admin-experts"],
    queryFn: () => api("/api/admin/experts"),
  });
  const experts = expertsData?.experts ?? [];

  function invalidateExperts() {
    qc.invalidateQueries({ queryKey: ["admin-experts"] });
  }

  async function removeExpert(e: Expert) {
    if (!confirm(`Delete "${e.name}" from the experts catalog? This can't be undone.`)) return;
    try {
      await api(`/api/admin/experts/${e.id}`, { method: "DELETE" });
      invalidateExperts();
    } catch (err: any) {
      showToast(err.message || "Couldn't delete this expert");
    }
  }

  async function handleCsvFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const records = parseCsvWithHeader(text);
      if (records.length === 0) {
        showToast("That CSV file had no rows to import");
        return;
      }
      const rows = records.map((record) => {
        const mapped: Record<string, string> = {};
        for (const [header, value] of Object.entries(record)) {
          const field = HEADER_ALIASES[normalizeHeader(header)];
          if (field) mapped[field] = value;
        }
        return {
          name: mapped.name ?? "",
          bio: mapped.bio || undefined,
          industries: mapped.industries ? splitTags(mapped.industries) : undefined,
          expertiseAreas: mapped.expertiseAreas ? splitTags(mapped.expertiseAreas) : undefined,
        };
      });
      const result = await api<{ created: number; errors: { row: number; message: string }[] }>("/api/admin/experts/bulk", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      invalidateExperts();
      if (result.errors.length === 0) {
        showToast(`Imported ${result.created} expert${result.created === 1 ? "" : "s"}`);
      } else {
        showToast(`Imported ${result.created}, skipped ${result.errors.length} (row ${result.errors[0].row}: ${result.errors[0].message})`);
      }
    } catch (err: any) {
      showToast(err.message || "Couldn't import that CSV file");
    } finally {
      setImporting(false);
    }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Mentorship"
          subtitle="Pick a startup to manage their mentor and sessions. The experts catalog below is shared."
        />

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Startups</h2>
        </div>

        <div className="ost-card mt-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Startup</th>
                  <th className="px-5 py-3 font-semibold">Owner</th>
                  <th className="px-5 py-3 font-semibold">Mentor</th>
                </tr>
              </thead>
              <tbody>
                {startupsLoading ? (
                  <SkeletonRows rows={4} cols={3} />
                ) : startups.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-6 text-slate-400">No startups yet.</td></tr>
                ) : (
                  startups.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/admin/mentorship/${s.id}`)}
                      className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-secondary" />
                          <span className="font-semibold text-primary">{s.companyName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        <div>{s.ownerName}</div>
                        <div className="text-xs text-slate-400">{s.ownerEmail}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{s.mentorName || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Other experts</h2>
          <div className="flex items-center gap-2">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvFile(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={importing}
              className="ost-btn-ghost !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Import CSV
            </button>
            <button onClick={() => setEditingExpert("new")} className="ost-btn-ghost !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add expert</button>
          </div>
        </div>

        <div className="ost-card mt-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Expert</th>
                  <th className="px-5 py-3 font-semibold">Industry / Technology</th>
                  <th className="px-5 py-3 font-semibold">Areas of expertise</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {expertsLoading ? (
                  <SkeletonRows rows={3} cols={4} />
                ) : experts.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-6 text-slate-400">No experts yet. Add one or import a CSV.</td></tr>
                ) : (
                  experts.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0">
                      <td className="max-w-[220px] px-5 py-3">
                        <div className="font-semibold text-primary">{e.name}</div>
                        {e.bio && <div className="mt-0.5 line-clamp-2 text-xs text-slate-400" title={e.bio}>{e.bio}</div>}
                      </td>
                      <td className="max-w-[220px] px-5 py-3 text-slate-500">{(e.industries ?? []).join(", ") || "—"}</td>
                      <td className="max-w-[280px] px-5 py-3 text-slate-500">{(e.expertiseAreas ?? []).join(", ") || "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button aria-label={`Edit ${e.name}`} title="Edit" onClick={() => setEditingExpert(e)} className="ost-btn-ghost !p-1.5">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button aria-label={`Delete ${e.name}`} title="Delete" onClick={() => removeExpert(e)} className="ost-btn-ghost !p-1.5 text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {editingExpert && (
        <ExpertFormModal
          expert={editingExpert === "new" ? null : editingExpert}
          onClose={() => setEditingExpert(null)}
          onSaved={() => { invalidateExperts(); setEditingExpert(null); }}
        />
      )}
    </AppShell>
  );
}

function splitTags(v: string): string[] {
  return v.split(",").map((t) => t.trim()).filter(Boolean);
}

function ExpertFormModal({
  expert,
  onClose,
  onSaved,
}: {
  expert: Expert | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(expert?.name ?? "");
  const [bio, setBio] = useState(expert?.bio ?? "");
  const [industries, setIndustries] = useState((expert?.industries ?? []).join(", "));
  const [expertiseAreas, setExpertiseAreas] = useState((expert?.expertiseAreas ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({
        name,
        bio,
        industries: splitTags(industries),
        expertiseAreas: splitTags(expertiseAreas),
      });
      if (expert) {
        await api(`/api/admin/experts/${expert.id}`, { method: "PATCH", body });
      } else {
        await api("/api/admin/experts", { method: "POST", body });
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell maxWidth="max-w-lg">
      <h3 className="mb-4 text-lg font-bold text-primary">{expert ? "Edit expert" : "Add expert"}</h3>

      <label className="ost-label">Name</label>
      <input className="ost-input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ozan Sonmez" />

      <label className="ost-label">Bio & background (optional)</label>
      <textarea className="ost-input mb-3 min-h-[90px]" value={bio} onChange={(e) => setBio(e.target.value)} />

      <label className="ost-label">Industry / Technology (comma-separated)</label>
      <input className="ost-input mb-3" value={industries} onChange={(e) => setIndustries(e.target.value)} placeholder="e.g. Fintech, Healthtech" />

      <label className="ost-label">Areas of expertise (comma-separated)</label>
      <input className="ost-input mb-3" value={expertiseAreas} onChange={(e) => setExpertiseAreas(e.target.value)} placeholder="e.g. Fundraising, Pricing Strategy" />

      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
        <button disabled={!name.trim() || saving} onClick={save} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {expert ? "Save changes" : "Add expert"}
        </button>
      </div>
    </ModalShell>
  );
}
