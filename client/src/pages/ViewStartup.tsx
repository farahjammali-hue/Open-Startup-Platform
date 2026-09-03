import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { BackLink } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { STAGE_LABELS, type StartupStage } from "../lib/stageLabels";
import { MONTH_NAMES } from "../lib/months";
import { formatMoney } from "../lib/format";
import {
  Pencil,
  Globe,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  ExternalLink,
} from "lucide-react";

interface Startup {
  id: string;
  companyName: string;
  website: string | null;
  logoUrl: string | null;
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
  productVideoPrivate: boolean | null;
  teamVideoUrl: string | null;
  teamVideoPrivate: boolean | null;
  deckUrl: string | null;
  isRaising: boolean | null;
  amountRaised: number | null;
  investorsEquityHolders: string | null;
  runwayMonths: number | null;
  isProfitable: boolean | null;
  customerTypes: string[] | null;
  interactionPlatforms: string[] | null;
  deletionRequestedAt: string | null;
}

const CUSTOMER: Record<string, string> = {
  b2b: "B2B", b2c: "B2C", b2g: "B2G", b2b2c: "B2B2C",
  marketplace: "Marketplace", licensing: "Licensing",
};
const INTERACTION: Record<string, string> = {
  desktop: "Desktop", android: "Mobile/Tablet (Android)", ios: "Mobile/Tablet (iOS)",
  api: "API", server_software: "Server software",
  hardware_wearable: "Hardware - wearable", hardware_non_wearable: "Hardware - non-wearable",
};
const LINK_LABEL: Record<string, string> = {
  linkedin: "LinkedIn", facebook: "Facebook", twitter: "X / Twitter", github: "GitHub",
  instagram: "Instagram", telegram: "Telegram", discord: "Discord", snapchat: "Snapchat",
  tiktok: "TikTok", appleAppStore: "Apple App Store", googlePlayStore: "Google Play Store",
};

export default function ViewStartup() {
  const [, params] = useRoute("/startups/:id");
  const [, navigate] = useLocation();
  const id = params?.id;

  const { data: s, isLoading } = useQuery<Startup>({
    queryKey: ["startup", id],
    queryFn: () => api(`/api/startups/${id}`),
    enabled: !!id,
  });

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />

        {isLoading || !s ? (
          <div className="max-w-[720px] space-y-4">
            <Skeleton tone="dark" className="h-40 rounded-2xl" />
            <Skeleton tone="dark" className="h-56 rounded-2xl" />
          </div>
        ) : (
          <div className="max-w-[720px]">
            {/* Header card */}
            <div className="ost-card p-8">
              {s.deletionRequestedAt && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
                  <Clock className="h-4 w-4" /> Deletion requested — awaiting admin approval.
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {s.logoUrl && (
                    <img
                      src={s.logoUrl}
                      alt={s.companyName}
                      className="h-16 w-16 rounded-xl border border-slate-100 object-contain"
                    />
                  )}
                  <div>
                    <h1 className="text-3xl font-extrabold text-primary">{s.companyName}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      {s.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-secondary" />{s.location}
                        </span>
                      )}
                      {s.website && (
                        <a href={s.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-secondary">
                          <Globe className="h-4 w-4 text-secondary" />
                          {s.website.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                      {s.stage && <span className="ost-chip">{STAGE_LABELS[s.stage as StartupStage] || s.stage}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => navigate(`/startups/${s.id}/edit`)} className="ost-btn-primary">
                  <Pencil className="h-4 w-4" /> Edit profile
                </button>
              </div>

              {s.shortDescription && (
                <p className="mt-5 text-slate-600">{s.shortDescription}</p>
              )}

              {(s.markets?.length || s.customerTypes?.length) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(s.markets ?? []).map((m) => (
                    <span key={m} className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">{m}</span>
                  ))}
                  {(s.customerTypes ?? []).map((c) => (
                    <span key={c} className="ost-chip">{CUSTOMER[c] || c}</span>
                  ))}
                </div>
              )}
            </div>

            {/* What you do */}
            <ViewSection title="What you do">
              <Item label="In detail" value={s.detailedDescription} long />
              <Item label="What's different / interesting" value={s.differentiator} long />
            </ViewSection>

            {/* Startup */}
            <ViewSection title="Startup">
              <Pair label="Registered / incorporated">
                {s.isIncorporated === null ? "—" : s.isIncorporated ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Yes</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-500"><XCircle className="h-4 w-4" /> No</span>
                )}
              </Pair>
              <Pair label="Started">
                {s.startedMonth || s.startedYear
                  ? `${s.startedMonth ? MONTH_NAMES[s.startedMonth - 1] + " " : ""}${s.startedYear ?? ""}`.trim()
                  : "—"}
              </Pair>
            </ViewSection>

            {/* Revenue */}
            <ViewSection title="Revenue">
              <Pair label="Last month">{formatMoney(s.revenueLastMonth)}</Pair>
              <Pair label="Last 12 months">{formatMoney(s.revenueLast12Months)}</Pair>
              <Pair label="Profitable">{s.isProfitable ? "Yes" : "No"}</Pair>
            </ViewSection>

            {/* Fundraising */}
            <ViewSection title="Fundraising">
              <Pair label="Currently raising">
                {s.isRaising === null ? "—" : s.isRaising ? "Yes" : "No"}
              </Pair>
              <Pair label="Raised from investors">{formatMoney(s.amountRaised)}</Pair>
              <Pair label="Runway">
                {s.runwayMonths === null ? "—" : `${s.runwayMonths} months`}
              </Pair>
              <Item label="Investors & equity holders" value={s.investorsEquityHolders} long />
            </ViewSection>

            {/* Links */}
            {s.links && Object.keys(s.links).length > 0 && (
              <ViewSection title="Links">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(s.links).map(([k, v]) =>
                    v ? (
                      <a key={k} href={v} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-primary hover:border-secondary hover:text-secondary">
                        {LINK_LABEL[k] || k} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null,
                  )}
                </div>
              </ViewSection>
            )}

            {/* Media */}
            <ViewSection title="Videos & deck">
              <LinkRow label="Product video" url={s.productVideoUrl} priv={s.productVideoPrivate} />
              <LinkRow label="Team video" url={s.teamVideoUrl} priv={s.teamVideoPrivate} />
              <LinkRow label="Pitch deck" url={s.deckUrl} />
            </ViewSection>

            {/* Product */}
            {s.interactionPlatforms && s.interactionPlatforms.length > 0 && (
              <ViewSection title="How customers use the product">
                <div className="flex flex-wrap gap-2">
                  {s.interactionPlatforms.map((p) => (
                    <span key={p} className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                      {INTERACTION[p] || p}
                    </span>
                  ))}
                </div>
              </ViewSection>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function ViewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ost-card mt-6 p-8">
      <h2 className="ost-card-title mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="w-56 shrink-0 font-medium text-slate-500">{label}</span>
      <span className="text-primary">{children}</span>
    </div>
  );
}

function Item({ label, value, long }: { label: string; value: string | null; long?: boolean }) {
  if (!value) return <Pair label={label}>—</Pair>;
  if (long) {
    return (
      <div className="text-sm">
        <div className="mb-1 font-medium text-slate-500">{label}</div>
        <p className="whitespace-pre-wrap text-primary">{value}</p>
      </div>
    );
  }
  return <Pair label={label}>{value}</Pair>;
}

function LinkRow({ label, url, priv }: { label: string; url: string | null; priv?: boolean | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-56 shrink-0 font-medium text-slate-500">{label}</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-secondary hover:underline">
          Open <ExternalLink className="h-3.5 w-3.5" />
          {priv && <span className="ml-1 inline-flex items-center gap-1 text-xs text-slate-400"><Lock className="h-3 w-3" /> Private</span>}
        </a>
      ) : (
        <span className="text-primary">—</span>
      )}
    </div>
  );
}
