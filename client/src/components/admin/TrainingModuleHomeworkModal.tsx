import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";
import { ModalShell } from "../ModalShell";

export interface TrainingModuleHomeworkRow {
  moduleId: string;
  homeworkUrl: string | null;
  submissionFileUrl: string | null;
  submissionFileName: string | null;
}

export function TrainingModuleHomeworkModal({
  startupId,
  moduleId,
  title,
  homework,
  onClose,
  onSaved,
}: {
  startupId: string;
  moduleId: string;
  title: string;
  homework: TrainingModuleHomeworkRow | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [homeworkUrl, setHomeworkUrl] = useState(homework?.homeworkUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/admin/startups/${startupId}/training-homework/${moduleId}`, {
        method: "PATCH",
        body: JSON.stringify({ homeworkUrl }),
      });
      showToast("Homework assignment saved");
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell maxWidth="max-w-md">
      <h3 className="mb-4 text-lg font-bold text-primary">{title}</h3>

      <label className="ost-label">Homework assignment (link)</label>
      <input className="ost-input mb-3" value={homeworkUrl} onChange={(e) => setHomeworkUrl(e.target.value)} placeholder="https://…" />

      {homework?.submissionFileUrl && (
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Startup submitted: <a href={homework.submissionFileUrl} target="_blank" rel="noreferrer" className="font-semibold text-secondary hover:underline">
            {homework.submissionFileName ?? "file"}
          </a>
        </p>
      )}

      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
        <button disabled={saving} onClick={save} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save homework
        </button>
      </div>
    </ModalShell>
  );
}
