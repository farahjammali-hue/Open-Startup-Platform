import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/EmptyState";
import { BackLink, PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/Skeleton";
import { BOOKING_STATUS_TONES, BOOKING_STATUS_ICONS, type BookingStatus } from "../lib/statusTones";
import { Users, Link2, Loader2, CalendarClock } from "lucide-react";

interface Slot {
  id: string; hostName: string; topic: string | null; startsAt: string; endsAt: string; capacity: number; meetingLink: string | null; bookedCount: number;
}
interface Booking { id: string; topic: string | null; status: BookingStatus; recap: string | null; slot: Slot; }

export default function OfficeHours() {
  const qc = useQueryClient();
  const { data: slotsData, isLoading: slotsLoading } = useQuery<{ slots: Slot[] }>({ queryKey: ["office-hour-slots"], queryFn: () => api("/api/office-hours/slots") });
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery<{ bookings: Booking[] }>({ queryKey: ["office-hour-bookings"], queryFn: () => api("/api/office-hours/bookings") });
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slots = slotsData?.slots ?? [];
  const bookings = bookingsData?.bookings ?? [];
  const bookedSlotIds = new Set(bookings.filter((b) => b.status === "booked").map((b) => b.slot.id));

  function refresh() {
    qc.invalidateQueries({ queryKey: ["office-hour-slots"] });
    qc.invalidateQueries({ queryKey: ["office-hour-bookings"] });
  }
  async function book(slotId: string) {
    setBusySlot(slotId); setError(null);
    try { await api("/api/office-hours/bookings", { method: "POST", body: JSON.stringify({ slotId }) }); refresh(); }
    catch (e: any) { setError(e.message || "Couldn't book that slot"); }
    finally { setBusySlot(null); }
  }
  async function cancel(id: string) {
    setError(null);
    try { await api(`/api/office-hours/bookings/${id}/cancel`, { method: "POST" }); refresh(); }
    catch (e: any) { setError(e.message || "Couldn't cancel that booking"); }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="Program tools" title="Office hours" subtitle="Book time with the broader OST team and ecosystem experts." />

        {error && <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        <div className="mb-4 mt-12 flex items-center gap-3 ost-section-label">
          <span>Available slots</span><span className="h-px flex-1 bg-white/10" />
        </div>
        {slotsLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} tone="dark" className="h-32 rounded-2xl" />
            ))}
          </div>
        )}
        {!slotsLoading && slots.length === 0 && (
          <EmptyState icon={CalendarClock} title="No open slots right now" description="New office hour slots are added regularly. Check back soon." />
        )}
        {!slotsLoading && slots.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((s) => {
              const full = s.bookedCount >= s.capacity;
              const already = bookedSlotIds.has(s.id);
              return (
                <div key={s.id} className="ost-card p-6">
                  <p className="text-sm font-bold text-primary">{new Date(s.startsAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  <p className="mt-1 text-sm text-slate-500">{s.hostName}{s.topic ? ` · ${s.topic}` : ""}</p>
                  <p className="mb-4 mt-1 flex items-center gap-1.5 ost-helper-text"><Users className="h-3.5 w-3.5" /> {s.bookedCount}/{s.capacity} booked</p>
                  <button onClick={() => book(s.id)} disabled={full || already || busySlot === s.id} className="ost-btn-primary w-full !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50">
                    {busySlot === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {already ? "Booked" : full ? "Full" : "Book"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mb-4 mt-12 flex items-center gap-3 ost-section-label">
          <span>Past sessions &amp; recaps</span><span className="h-px flex-1 bg-white/10" />
        </div>
        {bookingsLoading && (
          <div className="space-y-3">
            <Skeleton tone="dark" className="h-16 rounded-2xl" />
            <Skeleton tone="dark" className="h-16 rounded-2xl" />
          </div>
        )}
        {!bookingsLoading && bookings.length === 0 && (
          <EmptyState icon={CalendarClock} title="You haven't booked any sessions yet" description="Book a slot above to get time with the broader OST team and ecosystem experts." />
        )}
        {!bookingsLoading && bookings.length > 0 && (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="ost-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-primary">{b.slot.hostName}{b.topic ? ` · ${b.topic}` : ""}</p>
                    <p className="text-sm text-slate-500">{new Date(b.slot.startsAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={BOOKING_STATUS_TONES[b.status]} icon={BOOKING_STATUS_ICONS[b.status]}>{b.status}</StatusBadge>
                    {b.status === "booked" && <button onClick={() => cancel(b.id)} className="ost-btn-ghost !px-2.5 !py-1.5 text-xs">Cancel</button>}
                    {b.slot.meetingLink && b.status === "booked" && <a href={b.slot.meetingLink} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-2.5 !py-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /> Join</a>}
                  </div>
                </div>
                {b.recap && <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">{b.recap}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
