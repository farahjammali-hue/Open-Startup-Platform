import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";

// The mentor picked for a startup — sourced from the "Other experts"
// catalog, not a separate mentors directory.
export interface MentorOption {
  id: string;
  name: string;
  bio: string | null;
}

export function MentorAssignment({
  startupId,
  currentMentorId,
  mentors,
  onSaved,
}: {
  startupId: string;
  currentMentorId: string | null;
  mentors: MentorOption[];
  onSaved?: () => void;
}) {
  const [selected, setSelected] = useState(currentMentorId ?? "");
  const [saving, setSaving] = useState(false);

  const current = mentors.find((m) => m.id === currentMentorId) ?? null;

  async function assign() {
    setSaving(true);
    try {
      await api(`/api/admin/startups/${startupId}/mentor`, {
        method: "PATCH",
        body: JSON.stringify({ mentorId: selected || null }),
      });
      showToast(selected ? "Mentor assigned" : "Mentor unassigned");
      onSaved?.();
    } catch (e: any) {
      showToast(e.message || "Couldn't update the mentor assignment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {current && (
        <div className="rounded-lg border border-slate-100 px-4 py-3 text-sm">
          <span className="font-semibold text-primary">{current.name}</span>
          {current.bio && <p className="mt-1 text-xs text-slate-400">{current.bio}</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select className="ost-input max-w-xs" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">No mentor assigned</option>
          {mentors.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <button
          onClick={assign}
          disabled={saving || selected === (currentMentorId ?? "")}
          className="ost-btn-primary !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
        </button>
      </div>
      {mentors.length === 0 && <p className="text-xs text-slate-400">No experts in the catalog yet, add one from the Mentorship admin page.</p>}
    </div>
  );
}
