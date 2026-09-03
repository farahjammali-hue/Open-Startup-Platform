import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { showToast } from "../../lib/toast";
import { Target, Loader2 } from "lucide-react";
import { MONTH_NAMES, MONTHLY_STATUS_LABELS, MONTHLY_STATUS_TONES, type MonthlyUpdateRow } from "./types";

export function MonthlyUpdatesTab({ updates }: { updates: MonthlyUpdateRow[] }) {
  const qc = useQueryClient();
  const [achieved, setAchieved] = useState("");
  const [blocked, setBlocked] = useState("");
  const [focusNext, setFocusNext] = useState("");
  const [status, setStatus] = useState<MonthlyUpdateRow["status"]>("on_track");
  const [support, setSupport] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!achieved.trim() || !blocked.trim() || !focusNext.trim()) return;
    setBusy(true);
    try {
      await api("/api/monthly-updates", {
        method: "POST",
        body: JSON.stringify({ achieved, blocked, focusNext, status, supportNeeded: support }),
      });
      showToast("Monthly update submitted.");
      qc.invalidateQueries({ queryKey: ["monthly-updates"] });
      setAchieved(""); setBlocked(""); setFocusNext(""); setSupport(""); setStatus("on_track");
    } catch (e: any) {
      showToast(e.message || "Couldn't submit this update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="ost-card p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="ost-card-title">Monthly check-in</h2>
            <p className="mt-1 ost-helper-text">Brief check-in due by the 5th of each month</p>
          </div>
          <button type="submit" className="ost-btn-primary !px-3 !py-1.5 text-xs" disabled={busy}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Submit update</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="ost-label">What was achieved this month? <span className="text-secondary">*</span></label>
            <textarea className="ost-input" rows={2} value={achieved} onChange={(e) => setAchieved(e.target.value)} placeholder="e.g. Closed 12 new merchant partners" />
          </div>
          <div>
            <label className="ost-label">What was blocked or delayed? <span className="text-secondary">*</span></label>
            <textarea className="ost-input" rows={2} value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="e.g. Onboarding slower than planned" />
          </div>
          <div>
            <label className="ost-label">Focus for next month <span className="text-secondary">*</span></label>
            <textarea className="ost-input" rows={2} value={focusNext} onChange={(e) => setFocusNext(e.target.value)} placeholder="e.g. Close bridge round" />
          </div>
          <div>
            <label className="ost-label">Status</label>
            <div className="flex gap-2">
              {(["on_track", "at_risk", "off_track"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${status === s ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-500"}`}>
                  {s === "on_track" ? "On track" : s === "at_risk" ? "At risk" : "Off track"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="ost-label">Support needed? (optional)</label>
            <textarea className="ost-input" rows={2} value={support} onChange={(e) => setSupport(e.target.value)} placeholder="e.g. Intro to an insurance partner" />
          </div>
        </div>
      </form>

      {updates.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No monthly updates yet"
          description="Your first check-in above will show up here, and every month after that."
        />
      ) : (
        <div className="ost-card p-8">
          <h2 className="ost-card-title">Update history</h2>
          <div className="mt-4 space-y-2">
            {updates.map((u) => (
              <div key={u.id} className="rounded-lg border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">{MONTH_NAMES[u.periodMonth - 1]} {u.periodYear}</p>
                  <StatusBadge tone={MONTHLY_STATUS_TONES[u.status]}>{MONTHLY_STATUS_LABELS[u.status]}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-slate-500">{u.achieved}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
