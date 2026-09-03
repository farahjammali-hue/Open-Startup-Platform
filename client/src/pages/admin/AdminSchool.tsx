import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCards } from "../../components/Skeleton";
import { ModalShell } from "../../components/ModalShell";
import { showToast } from "../../lib/toast";
import { GraduationCap, ExternalLink, ArrowUp, ArrowDown, Pencil, Trash2, Plus, Loader2 } from "lucide-react";

type Module = "expertise" | "immersions" | "alumni";
interface Training {
  id: string; module: Module; title: string; description: string | null;
  resourceUrl: string | null; unlockMonth: number; orderIndex: number;
}

const MODULES: { key: Module; label: string }[] = [
  { key: "expertise", label: "Expertise" },
  { key: "immersions", label: "Immersions" },
  { key: "alumni", label: "Alumni & Fellows" },
];

export default function AdminSchool() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Training | "new" | null>(null);
  const [newModule, setNewModule] = useState<Module>("expertise");
  const { data, isLoading } = useQuery<{ trainings: Training[] }>({
    queryKey: ["admin-trainings"],
    queryFn: () => api("/api/admin/trainings"),
  });

  const all = data?.trainings ?? [];
  const byModule = (m: Module) => all.filter((t) => t.module === m).sort((a, b) => a.orderIndex - b.orderIndex);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-trainings"] });
  }

  async function move(id: string, direction: "up" | "down") {
    try {
      await api(`/api/admin/trainings/${id}/move`, { method: "POST", body: JSON.stringify({ direction }) });
      invalidate();
    } catch (e: any) {
      showToast(e.message || "Couldn't reorder this training");
    }
  }

  async function remove(t: Training) {
    if (!confirm(`Delete "${t.title}"? This can't be undone.`)) return;
    try {
      await api(`/api/admin/trainings/${t.id}`, { method: "DELETE" });
      invalidate();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this training");
    }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader eyebrow="Administration" title="Open Startup School" subtitle="Manage the curriculum shown to every startup." />

        {isLoading ? (
          <div className="mt-8">
            <SkeletonCards count={3} />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {MODULES.map(({ key, label }) => {
              const rows = byModule(key);
              return (
                <div key={key} className="ost-card p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="ost-card-title text-base">{label}</h2>
                    <button
                      onClick={() => { setNewModule(key); setEditing("new"); }}
                      className="ost-btn-ghost !px-3 !py-1.5 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add training
                    </button>
                  </div>
                  {rows.length === 0 ? (
                    <EmptyState icon={GraduationCap} title="No content yet" description="Add the first training for this module." />
                  ) : (
                    <div className="space-y-2">
                      {rows.map((t, i) => (
                        <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-primary">{t.title}</div>
                            {t.description && <p className="mt-1 text-xs text-slate-500">{t.description}</p>}
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              <span>{key === "alumni" ? "Unlocks at graduation" : `Unlocks month ${t.unlockMonth}`}</span>
                              {t.resourceUrl && (
                                <a href={t.resourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-secondary hover:underline">
                                  <ExternalLink className="h-3 w-3" /> Resource
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => move(t.id, "up")} className="ost-btn-ghost !p-1.5 disabled:opacity-30">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button aria-label="Move down" title="Move down" disabled={i === rows.length - 1} onClick={() => move(t.id, "down")} className="ost-btn-ghost !p-1.5 disabled:opacity-30">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button aria-label={`Edit ${t.title}`} title="Edit" onClick={() => setEditing(t)} className="ost-btn-ghost !p-1.5">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button aria-label={`Delete ${t.title}`} title="Delete" onClick={() => remove(t)} className="ost-btn-ghost !p-1.5 text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {editing && (
        <TrainingFormModal
          training={editing === "new" ? null : editing}
          defaultModule={newModule}
          onClose={() => setEditing(null)}
          onSaved={() => { invalidate(); setEditing(null); }}
        />
      )}
    </AppShell>
  );
}

function TrainingFormModal({
  training,
  defaultModule,
  onClose,
  onSaved,
}: {
  training: Training | null;
  defaultModule: Module;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [module, setModule] = useState<Module>(training?.module ?? defaultModule);
  const [title, setTitle] = useState(training?.title ?? "");
  const [description, setDescription] = useState(training?.description ?? "");
  const [resourceUrl, setResourceUrl] = useState(training?.resourceUrl ?? "");
  const [unlockMonth, setUnlockMonth] = useState(String(training?.unlockMonth ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({
        module,
        title,
        description,
        resourceUrl,
        unlockMonth: Number(unlockMonth) || 0,
      });
      if (training) {
        await api(`/api/admin/trainings/${training.id}`, { method: "PATCH", body });
      } else {
        await api("/api/admin/trainings", { method: "POST", body });
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell maxWidth="max-w-lg" scrollable={false}>
        <h3 className="mb-4 text-lg font-bold text-primary">{training ? "Edit training" : "Add training"}</h3>

        <label className="ost-label">Module</label>
        <select className="ost-input mb-3" value={module} onChange={(e) => setModule(e.target.value as Module)}>
          {MODULES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>

        <label className="ost-label">Title</label>
        <input className="ost-input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pricing strategy 101" />

        <label className="ost-label">Description (optional)</label>
        <textarea className="ost-input mb-3 min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown under the title" />

        <label className="ost-label">Resource URL (optional)</label>
        <input className="ost-input mb-3" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://…" />

        {module !== "alumni" && (
          <>
            <label className="ost-label">Unlocks after month</label>
            <input type="number" min={0} className="ost-input mb-3" value={unlockMonth} onChange={(e) => setUnlockMonth(e.target.value)} />
          </>
        )}

        {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
          <button
            disabled={!title.trim() || saving}
            onClick={save}
            className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {training ? "Save changes" : "Add training"}
          </button>
        </div>
    </ModalShell>
  );
}
