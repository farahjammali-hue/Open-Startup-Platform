import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { SkeletonText } from "../Skeleton";
import { EmptyState } from "../EmptyState";
import { ClockCounterClockwise as History, CaretDown, CaretUp, Users, Buildings as Building2 } from "@phosphor-icons/react";

interface MessageLogRow {
  id: string;
  kind: string;
  startupId: string | null;
  startupName: string | null;
  recipientEmails: string[];
  subject: string;
  bodyPreview: string | null;
  sentBy: string;
  meta: Record<string, unknown>;
  sentAt: string;
}

const KIND_FILTERS = [
  { value: "", label: "All messages" },
  { value: "cohort_message", label: "Cohort" },
  { value: "startup_message", label: "Single startup" },
] as const;

function kindLabel(row: MessageLogRow): string {
  if (row.kind === "cohort_message") {
    const track = row.meta.track as string | undefined;
    return track && track !== "all" ? `Cohort (${track === "pre_seed" ? "Pre-Seed" : "Seed"})` : "Cohort (everyone)";
  }
  if (row.kind === "startup_message") return row.startupName ?? "One startup";
  return row.kind;
}

/** A7: what got sent, to whom, by whom, and when — the "Message founders" tool kept no record of this before. */
export function MessageHistory() {
  const [kind, setKind] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useQuery<{ messages: MessageLogRow[] }>({
    queryKey: ["admin-message-log", kind],
    queryFn: () => api(kind ? `/api/admin/messages/log?kind=${kind}` : "/api/admin/messages/log"),
  });
  const rows = data?.messages ?? [];

  return (
    <div className="ost-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ost-card-title flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-secondary" /> Sent messages
        </h2>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="ost-input w-auto !py-1.5 text-sm" aria-label="Filter by audience">
          {KIND_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <SkeletonText lines={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={History} title="Nothing sent yet" description="Messages you send from the Compose tab will show up here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => {
              const open = openId === row.id;
              return (
                <li key={row.id} className="py-3">
                  <button onClick={() => setOpenId(open ? null : row.id)} className="flex w-full items-start justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {row.kind === "startup_message" ? <Building2 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                        {kindLabel(row)}
                      </div>
                      <div className="mt-0.5 truncate font-semibold text-primary">{row.subject}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {new Date(row.sentAt).toLocaleString()} · from {row.sentBy} · to {row.recipientEmails.length} recipient{row.recipientEmails.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    {open ? <CaretUp className="mt-1 h-4 w-4 shrink-0 text-slate-400" /> : <CaretDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" />}
                  </button>
                  {open && (
                    <div className="mt-3 rounded-lg bg-[var(--bg-subtle)] p-4 text-sm">
                      {row.bodyPreview && <p className="whitespace-pre-wrap text-slate-600">{row.bodyPreview}</p>}
                      <p className="mt-3 text-xs text-slate-400">Sent to: {row.recipientEmails.join(", ")}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
