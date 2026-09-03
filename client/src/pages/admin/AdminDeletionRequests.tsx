import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCards } from "../../components/Skeleton";
import { ModalShell } from "../../components/ModalShell";
import { showToast } from "../../lib/toast";
import { Trash2, Check, X, Clock, Loader2, Building2 } from "lucide-react";

interface Req {
  id: string; companyName: string; deletionReason: string | null;
  deletionRequestedAt: string | null; logoUrl: string | null;
  ownerName: string | null; ownerEmail: string | null;
}

export default function AdminDeletionRequests() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ requests: Req[] }>({
    queryKey: ["admin-deletion-requests"],
    queryFn: () => api("/api/admin/deletion-requests"),
  });
  const [confirm, setConfirm] = useState<Req | null>(null);
  const [busy, setBusy] = useState(false);

  async function approve(id: string) {
    setBusy(true);
    try {
      await api(`/api/admin/startups/${id}/approve-deletion`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["admin-deletion-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setConfirm(null);
    } catch (e: any) {
      showToast(e.message || "Couldn't approve this deletion");
    } finally { setBusy(false); }
  }
  async function deny(id: string) {
    try {
      await api(`/api/admin/startups/${id}/deny-deletion`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["admin-deletion-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't deny this deletion");
    }
  }

  const requests = data?.requests ?? [];

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader eyebrow="Administration" title="Deletion requests" subtitle="Approve to permanently delete the startup, or deny to keep it." />

        <div className="mt-8 space-y-3">
          {isLoading ? (
            <SkeletonCards count={2} />
          ) : requests.length === 0 ? (
            <EmptyState icon={Trash2} title="No pending deletion requests" description="Startup deletion requests will show up here for your review." />
          ) : (
            requests.map((r) => (
              <div key={r.id} className="ost-card flex flex-wrap items-start justify-between gap-4 p-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {r.logoUrl ? (
                      <img src={r.logoUrl} alt="" className="h-7 w-7 rounded object-contain" />
                    ) : (
                      <Building2 className="h-5 w-5 text-secondary" />
                    )}
                    <span className="text-lg font-bold text-primary">{r.companyName}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {r.ownerName} · {r.ownerEmail}
                  </p>
                  {r.deletionReason && (
                    <p className="mt-2 max-w-lg rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      “{r.deletionReason}”
                    </p>
                  )}
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                    <Clock className="h-3 w-3" />
                    Requested {r.deletionRequestedAt ? new Date(r.deletionRequestedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => deny(r.id)} className="ost-btn-ghost py-2 text-xs">
                    <X className="h-3.5 w-3.5" /> Deny
                  </button>
                  <button
                    onClick={() => setConfirm(r)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Approve & delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {confirm && (
        <ModalShell maxWidth="max-w-md" scrollable={false}>
            <h3 className="text-lg font-bold text-primary">
              Permanently delete {confirm.companyName}?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              This removes the startup and its profile for good. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="ost-btn-ghost">Cancel</button>
              <button
                onClick={() => approve(confirm.id)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Yes, delete it
              </button>
            </div>
        </ModalShell>
      )}
    </AppShell>
  );
}
