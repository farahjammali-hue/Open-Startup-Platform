import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonRows } from "../../components/Skeleton";
import { showToast } from "../../lib/toast";
import { CalendarPlus, Trash, CircleNotch as Loader2, ClockAfternoon } from "@phosphor-icons/react";

// A11: the office-hours slot API had existed admin-side with no page.
interface Slot {
  id: string;
  hostName: string;
  topic: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  meetingLink: string | null;
  bookedCount: number;
}

export default function AdminOfficeHours() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ slots: Slot[] }>({
    queryKey: ["admin-office-hours"],
    queryFn: () => api("/api/admin/office-hours/slots"),
  });
  const slots = data?.slots ?? [];

  const [hostName, setHostName] = useState("");
  const [topic, setTopic] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [capacity, setCapacity] = useState("1");
  const [meetingLink, setMeetingLink] = useState("");
  const [busy, setBusy] = useState(false);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-office-hours"] });
  }

  async function addSlot() {
    if (!hostName.trim() || !startsAt) return showToast("A host and a start time are required.");
    const start = new Date(startsAt);
    const end = new Date(start.getTime() + Number(durationMin || "30") * 60000);
    setBusy(true);
    try {
      await api("/api/admin/office-hours/slots", {
        method: "POST",
        body: JSON.stringify({
          hostName: hostName.trim(),
          topic,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          capacity: Number(capacity || "1"),
          meetingLink,
        }),
      });
      showToast("Slot opened.");
      setTopic("");
      setStartsAt("");
      refresh();
    } catch (e: any) {
      showToast(e.message || "Couldn't open that slot");
    } finally {
      setBusy(false);
    }
  }

  async function removeSlot(slot: Slot) {
    const warn = slot.bookedCount > 0 ? ` ${slot.bookedCount} booking(s) will lose their slot.` : "";
    if (!confirm(`Delete the ${new Date(slot.startsAt).toLocaleString()} slot with ${slot.hostName}?${warn}`)) return;
    try {
      await api(`/api/admin/office-hours/slots/${slot.id}`, { method: "DELETE" });
      refresh();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete that slot");
    }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Office hours"
          subtitle="Open bookable slots for founders — time with the team and ecosystem experts."
        />

        <div className="ost-card mt-8 p-6">
          <h2 className="ost-card-title flex items-center gap-2 text-base">
            <CalendarPlus className="h-4 w-4 text-secondary" /> Open a slot
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="ost-label" htmlFor="oh-host">Host</label>
              <input id="oh-host" className="ost-input" value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="e.g. Open Startup Program Team" maxLength={200} />
            </div>
            <div>
              <label className="ost-label" htmlFor="oh-topic">Topic (optional)</label>
              <input id="oh-topic" className="ost-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Fundraising Q&A" maxLength={200} />
            </div>
            <div>
              <label className="ost-label" htmlFor="oh-start">Starts</label>
              <input id="oh-start" type="datetime-local" className="ost-input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <label className="ost-label" htmlFor="oh-duration">Duration (minutes)</label>
              <input id="oh-duration" type="number" min={10} max={240} className="ost-input" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
            <div>
              <label className="ost-label" htmlFor="oh-capacity">Capacity</label>
              <input id="oh-capacity" type="number" min={1} max={100} className="ost-input" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div>
              <label className="ost-label" htmlFor="oh-link">Meeting link (optional)</label>
              <input id="oh-link" className="ost-input" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://…" maxLength={500} />
            </div>
          </div>
          <button onClick={addSlot} disabled={busy} className="ost-btn-primary mt-5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Open slot
          </button>
        </div>

        <div className="ost-card mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">When</th>
                  <th className="px-5 py-3 font-semibold">Host</th>
                  <th className="px-5 py-3 font-semibold">Topic</th>
                  <th className="px-5 py-3 font-semibold">Booked</th>
                  <th className="px-5 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows rows={3} cols={5} />
                ) : slots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState icon={ClockAfternoon} title="No upcoming slots" description="Open a slot above and founders can book it from their Office hours page." />
                    </td>
                  </tr>
                ) : (
                  slots.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 text-slate-600">
                        {new Date(s.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        <span className="text-slate-400"> – {new Date(s.endsAt).toLocaleTimeString(undefined, { timeStyle: "short" })}</span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-primary">{s.hostName}</td>
                      <td className="px-5 py-3 text-slate-500">{s.topic || "—"}</td>
                      <td className="px-5 py-3 text-slate-500">{s.bookedCount}/{s.capacity}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => removeSlot(s)} aria-label={`Delete slot ${s.id}`} className="text-slate-300 hover:text-red-500">
                          <Trash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
