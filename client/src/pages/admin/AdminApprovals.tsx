import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCards } from "../../components/Skeleton";
import { showToast } from "../../lib/toast";
import { UserCheck, Check, X, Clock, CircleNotch as Loader2, Buildings as Building2 } from "@phosphor-icons/react";

interface StartupDetail {
  id: string;
  companyName: string;
  website: string | null;
  shortDescription: string | null;
  location: string | null;
  markets: string[] | null;
  stage: string | null;
  revenueLastMonth: number | null;
  revenueLast12Months: number | null;
  detailedDescription: string | null;
  differentiator: string | null;
  isIncorporated: boolean | null;
  startedMonth: number | null;
  startedYear: number | null;
  links: Record<string, string> | null;
  productVideoUrl: string | null;
  teamVideoUrl: string | null;
  deckUrl: string | null;
  isRaising: boolean | null;
  amountRaised: number | null;
  investorsEquityHolders: string | null;
  runwayMonths: number | null;
  isProfitable: boolean | null;
  customerTypes: string[] | null;
  interactionPlatforms: string[] | null;
}

interface KysDetail {
  track: string;
  incorporated: boolean;
  addressLine1: string | null;
  city: string | null;
  country: string | null;
  incorporationDate: string | null;
  tin: string | null;
  signatoryName: string | null;
  signatoryPhone: string | null;
  signatoryEmail: string | null;
  irsForm: string | null;
  repName: string | null;
  repPhone: string | null;
  repEmail: string | null;
  status: string;
}

interface Application {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: string;
  startup: StartupDetail | null;
  kys: KysDetail | null;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-1.5 text-sm last:border-0">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="truncate text-right font-medium text-primary">{value}</span>
    </div>
  );
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
            applications.map((a) => {
              const s = a.startup;
              const k = a.kys;
              return (
                <div key={a.id} className="ost-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
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
                      {s && (
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                          <Building2 className="h-4 w-4 text-secondary" />
                          {s.companyName}
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

                  {s && (
                    <div className="mt-5 grid gap-6 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">About</p>
                        <Field label="Website" value={s.website} />
                        <Field label="Location" value={s.location} />
                        <Field label="Markets" value={s.markets?.join(", ")} />
                        <Field label="Stage" value={s.stage} />
                        <Field label="Started" value={s.startedMonth && s.startedYear ? `${s.startedMonth}/${s.startedYear}` : null} />
                        <Field label="Incorporated" value={s.isIncorporated === null ? null : s.isIncorporated ? "Yes" : "No"} />
                        <Field label="Differentiator" value={s.differentiator} />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Revenue &amp; fundraising</p>
                        <Field label="Revenue (last month)" value={s.revenueLastMonth?.toLocaleString()} />
                        <Field label="Revenue (12 months)" value={s.revenueLast12Months?.toLocaleString()} />
                        <Field label="Profitable" value={s.isProfitable ? "Yes" : "No"} />
                        <Field label="Raising" value={s.isRaising === null ? null : s.isRaising ? "Yes" : "No"} />
                        <Field label="Amount raised" value={s.amountRaised?.toLocaleString()} />
                        <Field label="Investors / equity holders" value={s.investorsEquityHolders} />
                        <Field label="Runway (months)" value={s.runwayMonths} />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Product &amp; links</p>
                        <Field label="Customer types" value={s.customerTypes?.join(", ")} />
                        <Field label="Platforms" value={s.interactionPlatforms?.join(", ")} />
                        <Field label="Deck" value={s.deckUrl ? "Uploaded" : null} />
                        <Field label="Product video" value={s.productVideoUrl ? "Provided" : null} />
                        <Field label="Team video" value={s.teamVideoUrl ? "Provided" : null} />
                        <Field label="LinkedIn" value={s.links?.linkedin} />
                      </div>
                      {s.detailedDescription && (
                        <div className="sm:col-span-2 lg:col-span-3">
                          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Detailed description</p>
                          <p className="text-sm text-slate-600">{s.detailedDescription}</p>
                        </div>
                      )}
                      {k && (
                        <div className="sm:col-span-2 lg:col-span-3">
                          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">KYC</p>
                          <div className="grid gap-x-6 sm:grid-cols-3">
                            <Field label="Track" value={k.track} />
                            <Field label="Status" value={k.status} />
                            <Field label="Country" value={k.country} />
                            <Field label="City" value={k.city} />
                            <Field label="Address" value={k.addressLine1} />
                            <Field label="Incorporation date" value={k.incorporationDate} />
                            <Field label="TIN" value={k.tin} />
                            <Field label="IRS form" value={k.irsForm} />
                            <Field label="Signatory" value={k.signatoryName} />
                            <Field label="Signatory phone" value={k.signatoryPhone} />
                            <Field label="Signatory email" value={k.signatoryEmail} />
                            <Field label="Representative" value={k.repName} />
                            <Field label="Rep. phone" value={k.repPhone} />
                            <Field label="Rep. email" value={k.repEmail} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </AppShell>
  );
}
