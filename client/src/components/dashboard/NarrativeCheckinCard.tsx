import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";
import { SkeletonText } from "../Skeleton";
import { ChatCircleText, CircleNotch as Loader2 } from "@phosphor-icons/react";

// A10: the quarterly narrative check-in. The table and API had existed for a
// long time with no screen writing to them — which also meant the Claude
// connector's list_startups_needing_attention always came back empty. One
// row per quarter; resubmitting updates the same quarter.

interface UpdateRow {
  id: string;
  periodQuarter: number;
  periodYear: number;
  achieved: string;
  blocked: string;
  focusNext: string;
  status: "on_track" | "at_risk" | "off_track" | null;
  supportNeeded: string | null;
}

const STATUS_OPTIONS = [
  { value: "on_track", label: "On track" },
  { value: "at_risk", label: "At risk" },
  { value: "off_track", label: "Off track" },
] as const;

export function NarrativeCheckinCard() {
  const qc = useQueryClient();
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const year = now.getFullYear();

  const { data, isLoading } = useQuery<{ updates: UpdateRow[] }>({
    queryKey: ["monthly-updates"],
    queryFn: () => api("/api/monthly-updates"),
  });
  const current = data?.updates.find((u) => u.periodQuarter === quarter && u.periodYear === year);

  const [achieved, setAchieved] = useState("");
  const [blocked, setBlocked] = useState("");
  const [focusNext, setFocusNext] = useState("");
  const [status, setStatus] = useState<"on_track" | "at_risk" | "off_track">("on_track");
  const [supportNeeded, setSupportNeeded] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Prefill once from this quarter's existing check-in (edits keep working).
  useEffect(() => {
    if (!current || loadedId === current.id) return;
    setAchieved(current.achieved);
    setBlocked(current.blocked);
    setFocusNext(current.focusNext);
    setStatus(current.status ?? "on_track");
    setSupportNeeded(current.supportNeeded ?? "");
    setLoadedId(current.id);
  }, [current, loadedId]);

  async function submit() {
    if (!achieved.trim() || !blocked.trim() || !focusNext.trim()) {
      showToast("Fill in the three questions before submitting.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/monthly-updates", {
        method: "POST",
        body: JSON.stringify({ achieved, blocked, focusNext, status, supportNeeded }),
      });
      showToast(`Q${quarter} check-in ${current ? "updated" : "submitted"}.`);
      qc.invalidateQueries({ queryKey: ["monthly-updates"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't save the check-in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ost-card p-6">
      <h2 className="ost-card-title flex items-center gap-2 text-base">
        <ChatCircleText className="h-4 w-4 text-secondary" /> Q{quarter} {year} check-in
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Three quick questions, in your own words — this is what the program team actually reads
        {current ? ". You already submitted this quarter; edits replace it." : "."}
      </p>

      {isLoading ? (
        <div className="mt-4"><SkeletonText lines={3} /></div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="checkin-achieved" className="ost-label">What did you achieve this quarter?</label>
            <textarea id="checkin-achieved" className="ost-input min-h-[70px]" value={achieved} onChange={(e) => setAchieved(e.target.value)} maxLength={2000} />
          </div>
          <div>
            <label htmlFor="checkin-blocked" className="ost-label">What's blocking you?</label>
            <textarea id="checkin-blocked" className="ost-input min-h-[70px]" value={blocked} onChange={(e) => setBlocked(e.target.value)} maxLength={2000} />
          </div>
          <div>
            <label htmlFor="checkin-focus" className="ost-label">What's the focus next?</label>
            <textarea id="checkin-focus" className="ost-input min-h-[70px]" value={focusNext} onChange={(e) => setFocusNext(e.target.value)} maxLength={2000} />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="ost-label">Overall, you're…</label>
              <div className="mt-1.5 flex gap-2">
                {STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setStatus(o.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      status === o.value ? "border-secondary bg-secondary/10 text-secondary" : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-[220px] flex-1">
              <label htmlFor="checkin-support" className="ost-label">Anything the Open Startup team can help with? (optional)</label>
              <input id="checkin-support" className="ost-input" value={supportNeeded} onChange={(e) => setSupportNeeded(e.target.value)} maxLength={2000} />
            </div>
          </div>
          <button onClick={submit} disabled={busy} className="ost-btn-primary">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {current ? "Update Q" + quarter + " check-in" : "Submit Q" + quarter + " check-in"}
          </button>
        </div>
      )}
    </div>
  );
}
