import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";
import { SkeletonText } from "../Skeleton";
import { Target, Plus, Trash, CircleNotch as Loader2 } from "@phosphor-icons/react";

// A9: the goals API existed with no screen anywhere. One shared panel:
// founders on Home (apiBase /api/goals), admins on a startup's page
// (apiBase /api/admin/startups/:id/goals) — same component, same shapes.

interface Goal {
  id: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: "on_track" | "at_risk" | "off_track" | "done";
}

const STATUS_ORDER: Goal["status"][] = ["on_track", "at_risk", "off_track", "done"];
const STATUS_LABEL: Record<Goal["status"], string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  done: "Done",
};
const STATUS_CLASS: Record<Goal["status"], string> = {
  on_track: "bg-[rgba(98,221,209,0.16)] text-[#0C8479]",
  at_risk: "bg-amber-50 text-amber-700",
  off_track: "bg-red-50 text-red-600",
  done: "bg-slate-100 text-slate-500",
};

export function GoalsPanel({ apiBase, title = "Goals" }: { apiBase: string; title?: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ goals: Goal[] }>({
    queryKey: ["goals", apiBase],
    queryFn: () => api(apiBase),
  });
  const goals = data?.goals ?? [];
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [busy, setBusy] = useState(false);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["goals", apiBase] });
  }

  async function addGoal() {
    if (!newTitle.trim()) return showToast("Give the goal a title first.");
    setBusy(true);
    try {
      await api(apiBase, { method: "POST", body: JSON.stringify({ title: newTitle.trim(), targetDate: newDate }) });
      setNewTitle("");
      setNewDate("");
      setAdding(false);
      refresh();
    } catch (e: any) {
      showToast(e.message || "Couldn't add that goal");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(goal: Goal, status: Goal["status"]) {
    try {
      await api(`${apiBase}/${goal.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      refresh();
    } catch (e: any) {
      showToast(e.message || "Couldn't update that goal");
    }
  }

  async function remove(goal: Goal) {
    if (!confirm(`Delete the goal "${goal.title}"?`)) return;
    try {
      await api(`${apiBase}/${goal.id}`, { method: "DELETE" });
      refresh();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete that goal");
    }
  }

  return (
    <div className="ost-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="ost-card-title flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-secondary" /> {title}
        </h2>
        <button onClick={() => setAdding((v) => !v)} className="ost-btn-ghost !px-3 !py-1.5 text-xs">
          <Plus className="h-4 w-4" /> Add goal
        </button>
      </div>

      {adding && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-[var(--bg-subtle)] p-4">
          <div className="min-w-[220px] flex-1">
            <label className="ost-label">Goal</label>
            <input className="ost-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Close 3 pilot contracts" maxLength={200} />
          </div>
          <div>
            <label className="ost-label">Target date (optional)</label>
            <input type="date" className="ost-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <button onClick={addGoal} disabled={busy} className="ost-btn-primary !px-4 !py-2 text-sm">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save goal
          </button>
        </div>
      )}

      <div className="mt-4">
        {isLoading ? (
          <SkeletonText lines={3} />
        ) : goals.length === 0 && !adding ? (
          <p className="text-sm text-slate-400">No goals yet — add the two or three things this quarter is about.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {goals.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className={`font-semibold ${g.status === "done" ? "text-slate-400 line-through" : "text-primary"}`}>{g.title}</div>
                  {g.targetDate && <div className="text-xs text-slate-400">Target: {new Date(g.targetDate).toLocaleDateString()}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={g.status}
                    onChange={(e) => setStatus(g, e.target.value as Goal["status"])}
                    aria-label={`Status of ${g.title}`}
                    className={`rounded-full border-0 px-3 py-1 text-xs font-semibold ${STATUS_CLASS[g.status]}`}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  <button onClick={() => remove(g)} aria-label={`Delete ${g.title}`} className="text-slate-300 hover:text-red-500">
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
