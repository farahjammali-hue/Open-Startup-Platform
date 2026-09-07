import { useState } from "react";
import { Loader2, Mail, MessageCircle, Linkedin } from "lucide-react";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";

export interface TrainerOption {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  linkedinUrl: string | null;
}

export function TrainerAssignment({
  startupId,
  currentTrainerId,
  trainers,
  onSaved,
}: {
  startupId: string;
  currentTrainerId: string | null;
  trainers: TrainerOption[];
  onSaved?: () => void;
}) {
  const [selected, setSelected] = useState(currentTrainerId ?? "");
  const [saving, setSaving] = useState(false);

  const current = trainers.find((t) => t.id === currentTrainerId) ?? null;

  async function assign() {
    setSaving(true);
    try {
      await api(`/api/admin/startups/${startupId}/trainer`, {
        method: "PATCH",
        body: JSON.stringify({ trainerId: selected || null }),
      });
      showToast(selected ? "Trainer assigned" : "Trainer unassigned");
      onSaved?.();
    } catch (e: any) {
      showToast(e.message || "Couldn't update the trainer assignment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {current && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-100 px-4 py-3 text-sm">
          <span className="font-semibold text-primary">{current.name}</span>
          {current.email && <span className="flex items-center gap-1 text-xs text-slate-400"><Mail className="h-3 w-3" /> {current.email}</span>}
          {current.whatsapp && <span className="flex items-center gap-1 text-xs text-slate-400"><MessageCircle className="h-3 w-3" /> {current.whatsapp}</span>}
          {current.linkedinUrl && (
            <a href={current.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:underline">
              <Linkedin className="h-3 w-3" /> LinkedIn
            </a>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select className="ost-input max-w-xs" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">No trainer assigned</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={assign}
          disabled={saving || selected === (currentTrainerId ?? "")}
          className="ost-btn-primary !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
        </button>
      </div>
      {trainers.length === 0 && <p className="text-xs text-slate-400">No trainers in the directory yet, add one from the Training admin page.</p>}
    </div>
  );
}
