import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCards } from "../../components/Skeleton";
import { showToast } from "../../lib/toast";
import { UserCheck, Check, X, Clock, CircleNotch as Loader2, Buildings as Building2 } from "@phosphor-icons/react";

interface Application {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: string;
  startup: { id: string; companyName: string } | null;
}

export default function AdminApprovals() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ applications: Application[] }>({
    queryKey: ["admin-approvals"],
    queryFn: () => api("/api/admin/approvals"),
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      await api(`/api/admin/approvals/${id}/${action}`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["admin-approvals"] });
    } catch (e: any) {
      showToast(e.message || `Couldn't ${action} this application`);
    } finally {
      setBusyId(null);
    }
  }

  const applications = data?.applications ?? [];

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Signup approvals"
          subtitle="New applicants can't access the platform until you approve them."
        />

        <div className="mt-8 space-y-3">
          {isLoading ? (
            <SkeletonCards count={2} />
          ) : applications.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No applications waiting"
              description="New signups will show up here for your review before they can access the platform."
            />
          ) : (
            applications.map((a) => (
              <div key={a.id} className="ost-card flex flex-wrap items-start justify-between gap-4 p-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">{a.name}</span>
                    {a.role && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-500">
                        {a.role}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{a.email}</p>
                  {a.startup && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                      <Building2 className="h-4 w-4 text-secondary" />
                      {a.startup.companyName}
                    </p>
                  )}
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                    <Clock className="h-4 w-4" />
                    Applied {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => decide(a.id, "reject")}
                    disabled={busyId === a.id}
                    className="ost-btn-ghost py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                  <button
                    onClick={() => decide(a.id, "approve")}
                    disabled={busyId === a.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-xs font-semibold text-white hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </AppShell>
  );
}
