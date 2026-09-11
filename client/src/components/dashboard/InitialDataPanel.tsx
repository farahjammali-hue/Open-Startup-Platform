import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";
import { formatMoney } from "../../lib/format";
import { ModalShell } from "../ModalShell";
import { Skeleton } from "../Skeleton";
import { Pills, MultiPills, Money, LinkInput } from "../StartupFormFields";
import { AchievementsLog, type Achievement } from "../metrics/MetricsKpiPanel";
import { InitialDataCard } from "./InitialDataCard";
import { LEGAL_ENTITY_LABELS, CUSTOMER_BASE_LABELS } from "../../lib/startupProfileLabels";
import {
  BUSINESS_MODEL_OPTIONS, PRODUCT_STAGE_OPTIONS, INVESTMENT_STAGE_OPTIONS, FUNDING_TYPE_OPTIONS,
  PATENT_APPLICATION_TYPE_OPTIONS, PATENT_STATUS_OPTIONS, GTM_STATUS_OPTIONS, CLIENT_TYPE_OPTIONS,
  PARTNER_TYPE_OPTIONS, INVOLVEMENT_OPTIONS, TRL_EXPLAINER_URL, type Option,
} from "@shared/initialDataCatalog";
import { Loader2, Plus, Trash2, ExternalLink } from "lucide-react";

/* ---------------- Types matching the GET response ---------------- */

interface StartupProfileData {
  id: string;
  legalEntityStatus: "yes" | "in_process" | "no" | null;
  startedYear: number | null;
  country: string | null;
  businessModelTypes: string[] | null;
  dataRoomLink: string | null;
  deckUrl: string | null;
  coreBusinessOverview: string | null;
  uniqueValueProposition: string | null;
  teamSize: number | null;
  contractorsCount: number | null;
  paidEmployeesCount: number | null;
  advisorsCount: number | null;
  femaleTeamMembers: number | null;
  youthEmployees: number | null;
  totalFundingRaised: number | null;
  totalFundingDilutive: number | null;
  totalFundingNonDilutive: number | null;
  investmentStage: string | null;
  roundSize: number | null;
  committedFunds: number | null;
  fundingCrmLink: string | null;
  coreIpTechnology: string | null;
  mainTechnologies: string | null;
  productType: string | null;
  productStage: string | null;
  productRoadmapLink: string | null;
  trlLevel: number | null;
  totalAddressableMarket: number | null;
  serviceableAddressableMarket: number | null;
  serviceableObtainableMarket: number | null;
  goToMarketStrategyLink: string | null;
  competitionOverview: string | null;
  idealCustomerPersona: string | null;
  clientsCrmLink: string | null;
  partnersCrmLink: string | null;
  sdgsAddressed: string[] | null;
  countryOfIncorporation: string | null;
  customerBase: string | null;
  countriesOfOperation: string | null;
}

interface TeamMemberRow {
  id: string; name: string; role: string | null; type: "founder" | "full_time" | "part_time" | "advisor";
  gender: string | null; educationalBackground: string | null; professionalBackground: string | null; yearsOfExperience: number | null;
}
interface CapTableEntryRow { id: string; name: string; percentage: number; currentInvolvement: string | null }
interface FundingRoundRow { id: string; amount: number | null; investorName: string | null; fundingType: string | null; round: string | null; roundDate: string | null; dealTerms: string | null }
interface PatentRow {
  id: string; applicantName: string | null; country: string | null; applicationType: string | null;
  priorityDate: string | null; effectiveFilingDate: string | null; publicationDate: string | null;
  publicationNumber: string | null; status: string | null; nextAction: string | null;
}
interface TargetMarketRow { id: string; market: string; status: string }
interface ClientStatRow { id: string; clientType: string; totalClients: number | null; majorClientNames: string | null; retentionRate: number | null }
interface ClientDetailRow { id: string; clientName: string; scopeOfWork: string | null; dealValue: number | null }
interface PartnerStatRow { id: string; partnerType: string; totalPartners: number | null; majorPartnerNames: string | null; retentionRate: number | null }
interface PartnerDetailRow { id: string; partnerName: string; scopeOfPartnership: string | null; nextSteps: string | null }

interface ProfileResponse {
  startup: StartupProfileData;
  teamMembers: TeamMemberRow[];
  capTableEntries: CapTableEntryRow[];
  fundingRounds: FundingRoundRow[];
  patents: PatentRow[];
  targetMarkets: TargetMarketRow[];
  clientStats: ClientStatRow[];
  clientDetails: ClientDetailRow[];
  partnerStats: PartnerStatRow[];
  partnerDetails: PartnerDetailRow[];
  achievements: Achievement[];
}

export interface InitialDataApiConfig {
  getUrl: string;
  overviewPatchUrl: string;
  teamUrl: string;
  capTableUrl: string;
  subResourceBase: string;
  metricsApiBase: string; // for reusing AchievementsLog as-is
}

function labelOf(options: Option[], value: string | null | undefined): string {
  return options.find((o) => o.value === value)?.label ?? (value || "—");
}

/* ---------------- Generic building blocks ---------------- */

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-50 py-1.5 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="truncate text-sm font-medium text-primary">{value || <span className="text-slate-300">—</span>}</span>
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-50 py-1.5 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-secondary hover:underline">
          View <ExternalLink className="h-3 w-3" />
        </a>
      ) : <span className="text-sm text-slate-300">—</span>}
    </div>
  );
}

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  options?: Option[];
}

function AddModal({
  title, fields, onClose, onSubmit,
}: { title: string; fields: FieldDef[]; onClose: () => void; onSubmit: (values: Record<string, string>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (e: any) {
      setError(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell maxWidth="max-w-md">
      <h3 className="mb-4 text-lg font-bold text-primary">{title}</h3>
      {fields.map((f) => (
        <div key={f.key} className="mb-3">
          <label className="ost-label">{f.label}</label>
          {f.type === "select" ? (
            <select className="ost-input" value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
              <option value="">Select…</option>
              {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === "textarea" ? (
            <textarea className="ost-input min-h-[60px]" value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          ) : (
            <input
              type={f.type === "number" ? "number" : "text"}
              className="ost-input"
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          )}
        </div>
      ))}
      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
        <button disabled={saving} onClick={submit} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Add
        </button>
      </div>
    </ModalShell>
  );
}

function RepeatableList<T extends { id: string }>({
  rows, renderRow, onDelete, onAdd, addLabel, emptyText,
}: {
  rows: T[]; renderRow: (row: T) => ReactNode; onDelete: (id: string) => void; onAdd: () => void; addLabel: string; emptyText: string;
}) {
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-xs text-slate-400">{emptyText}</p>}
      {rows.map((row) => (
        <div key={row.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
          <div className="min-w-0 flex-1 text-xs text-slate-600">{renderRow(row)}</div>
          <button aria-label="Delete" onClick={() => onDelete(row.id)} className="shrink-0 text-slate-300 hover:text-red-500">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={onAdd} className="ost-btn-ghost !px-2.5 !py-1 text-xs"><Plus className="h-3.5 w-3.5" /> {addLabel}</button>
    </div>
  );
}

/* ---------------- Main panel ---------------- */

export function InitialDataPanel({ apiConfig }: { apiConfig: InitialDataApiConfig }) {
  const qc = useQueryClient();
  const queryKey = ["initial-data-panel", apiConfig.getUrl];
  const { data, isLoading } = useQuery<ProfileResponse>({ queryKey, queryFn: () => api(apiConfig.getUrl) });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  useEffect(() => {
    if (data?.startup) setForm({ ...data.startup });
  }, [data?.startup]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function set(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey });
  }

  async function saveOverview() {
    setSaving(true);
    try {
      // Zod's `.optional()` fields accept undefined, not null — and every
      // untouched nullable column comes back from the API as null, so strip
      // those keys rather than sending them through as-is.
      const body: Record<string, any> = {};
      for (const [k, v] of Object.entries(form)) {
        if (k === "id" || v === null) continue;
        body[k] = v;
      }
      await api(apiConfig.overviewPatchUrl, { method: "PATCH", body: JSON.stringify(body) });
      showToast("Changes saved");
      invalidate();
    } catch (e: any) {
      showToast(e.message || "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  }

  async function addRow(base: string, values: Record<string, string>, numericKeys: string[] = []) {
    const body: Record<string, any> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v === "" || v == null) continue;
      body[k] = numericKeys.includes(k) ? Number(v) : v;
    }
    await api(base, { method: "POST", body: JSON.stringify(body) });
    invalidate();
  }

  async function deleteRow(base: string, id: string) {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    try {
      await api(`${base}/${id}`, { method: "DELETE" });
      invalidate();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this entry");
    }
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  const s = form as StartupProfileData;
  const sub = apiConfig.subResourceBase;
  const founders = data.teamMembers.filter((m) => m.type === "founder");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={saveOverview} disabled={saving} className="ost-btn-primary !px-4 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Profile */}
        <InitialDataCard
          title="1. Profile"
          isOpen={expanded.has("profile")}
          onToggle={() => toggle("profile")}
          hidden={
            <>
              <div>
                <label className="ost-label">SDGs Addressed</label>
                <input className="ost-input" value={(s.sdgsAddressed ?? []).join(", ")} onChange={(e) => set("sdgsAddressed", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} placeholder="Comma-separated" />
              </div>
              <div>
                <label className="ost-label">Country of Incorporation</label>
                <input className="ost-input" value={s.countryOfIncorporation ?? ""} onChange={(e) => set("countryOfIncorporation", e.target.value)} />
              </div>
              <div>
                <label className="ost-label">Customer Base</label>
                <select className="ost-input" value={s.customerBase ?? ""} onChange={(e) => set("customerBase", e.target.value)}>
                  <option value="">Not set</option>
                  {Object.entries(CUSTOMER_BASE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </>
          }
        >
          <div>
            <label className="ost-label">Legal Entity</label>
            <select className="ost-input" value={s.legalEntityStatus ?? ""} onChange={(e) => set("legalEntityStatus", e.target.value)}>
              <option value="">Not set</option>
              {Object.entries(LEGAL_ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="ost-label">Year of constitution</label>
            <input type="number" className="ost-input" value={s.startedYear ?? ""} onChange={(e) => set("startedYear", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="ost-label">Headquarters</label>
            <input className="ost-input" value={s.country ?? ""} onChange={(e) => set("country", e.target.value)} />
          </div>
          <div>
            <label className="ost-label">Other countries of operation</label>
            <input className="ost-input" value={s.countriesOfOperation ?? ""} onChange={(e) => set("countriesOfOperation", e.target.value)} placeholder="e.g. Uganda, Kenya, Tanzania" />
          </div>
          <div>
            <label className="ost-label">Business model</label>
            <MultiPills options={BUSINESS_MODEL_OPTIONS} value={s.businessModelTypes ?? []} onChange={(v) => set("businessModelTypes", v)} />
          </div>
          <div>
            <label className="ost-label">Pitch deck link</label>
            <LinkInput value={s.deckUrl ?? ""} onChange={(v) => set("deckUrl", v)} />
          </div>
          <div>
            <label className="ost-label">Data Room link</label>
            <LinkInput value={s.dataRoomLink ?? ""} onChange={(v) => set("dataRoomLink", v)} />
          </div>
        </InitialDataCard>

        {/* 2. Brief Description */}
        <InitialDataCard title="2. Brief Description" isOpen={false} onToggle={() => {}}>
          <textarea className="ost-input min-h-[140px] w-full" value={s.coreBusinessOverview ?? ""} onChange={(e) => set("coreBusinessOverview", e.target.value)} placeholder="Mission, target market, and unique value proposition in 200 words or less." />
        </InitialDataCard>

        {/* 3. Unique Value Proposition */}
        <InitialDataCard title="3. Unique Value Proposition" isOpen={false} onToggle={() => {}}>
          <textarea className="ost-input min-h-[140px] w-full" value={s.uniqueValueProposition ?? ""} onChange={(e) => set("uniqueValueProposition", e.target.value)} />
        </InitialDataCard>

        {/* 4. Team */}
        <InitialDataCard
          title="4. Team"
          isOpen={expanded.has("team")}
          onToggle={() => toggle("team")}
          hidden={
            <>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="ost-label">Team Size</label><input type="number" className="ost-input" value={s.teamSize ?? ""} onChange={(e) => set("teamSize", e.target.value ? Number(e.target.value) : null)} /></div>
                <div><label className="ost-label">% Youth in team</label><input type="number" className="ost-input" value={s.youthEmployees ?? ""} onChange={(e) => set("youthEmployees", e.target.value ? Number(e.target.value) : null)} /></div>
                <div><label className="ost-label">Contractors</label><input type="number" className="ost-input" value={s.contractorsCount ?? ""} onChange={(e) => set("contractorsCount", e.target.value ? Number(e.target.value) : null)} /></div>
                <div><label className="ost-label">Paid employees</label><input type="number" className="ost-input" value={s.paidEmployeesCount ?? ""} onChange={(e) => set("paidEmployeesCount", e.target.value ? Number(e.target.value) : null)} /></div>
                <div><label className="ost-label">Advisors</label><input type="number" className="ost-input" value={s.advisorsCount ?? ""} onChange={(e) => set("advisorsCount", e.target.value ? Number(e.target.value) : null)} /></div>
                <div><label className="ost-label">Female employees</label><input type="number" className="ost-input" value={s.femaleTeamMembers ?? ""} onChange={(e) => set("femaleTeamMembers", e.target.value ? Number(e.target.value) : null)} /></div>
              </div>
            </>
          }
        >
          <RepeatableList
            rows={founders}
            emptyText="No founders added yet."
            addLabel="Add founder"
            onAdd={() => setActiveModal("founder")}
            onDelete={(id) => deleteRow(apiConfig.teamUrl, id)}
            renderRow={(m) => (
              <>
                <p className="font-semibold text-primary">{m.name}</p>
                <p className="text-slate-400">{[m.gender, m.educationalBackground, m.professionalBackground, m.yearsOfExperience != null ? `${m.yearsOfExperience} yrs exp.` : null].filter(Boolean).join(" · ")}</p>
              </>
            )}
          />
        </InitialDataCard>

        {/* 5. Shareholders */}
        <InitialDataCard title="5. Shareholders" isOpen={false} onToggle={() => {}}>
          <RepeatableList
            rows={data.capTableEntries}
            emptyText="No shareholders added yet."
            addLabel="Add shareholder"
            onAdd={() => setActiveModal("shareholder")}
            onDelete={(id) => deleteRow(apiConfig.capTableUrl, id)}
            renderRow={(entry) => (
              <>
                <p className="font-semibold text-primary">{entry.name} · {entry.percentage}%</p>
                {entry.currentInvolvement && <p className="text-slate-400">{labelOf(INVOLVEMENT_OPTIONS, entry.currentInvolvement)}</p>}
              </>
            )}
          />
        </InitialDataCard>

        {/* 6. Funding */}
        <InitialDataCard
          title="6. Funding"
          isOpen={expanded.has("funding")}
          onToggle={() => toggle("funding")}
          hidden={
            <>
              <div>
                <label className="ost-label">CRM of investors (link)</label>
                <LinkInput value={s.fundingCrmLink ?? ""} onChange={(v) => set("fundingCrmLink", v)} />
              </div>
              <RepeatableList
                rows={data.fundingRounds}
                emptyText="No funding rounds added yet."
                addLabel="Add funding round"
                onAdd={() => setActiveModal("fundingRound")}
                onDelete={(id) => deleteRow(`${sub}/funding-rounds`, id)}
                renderRow={(r) => (
                  <>
                    <p className="font-semibold text-primary">{r.investorName || "Unnamed investor"} — {formatMoney(r.amount)}</p>
                    <p className="text-slate-400">{[labelOf(FUNDING_TYPE_OPTIONS, r.fundingType), r.round, r.roundDate].filter(Boolean).join(" · ")}</p>
                  </>
                )}
              />
            </>
          }
        >
          <div><label className="ost-label">Total Funding raised</label><Money value={s.totalFundingRaised != null ? String(s.totalFundingRaised) : ""} onChange={(v) => set("totalFundingRaised", v ? Number(v) : null)} /></div>
          <div><label className="ost-label">Total funding (Dilutive)</label><Money value={s.totalFundingDilutive != null ? String(s.totalFundingDilutive) : ""} onChange={(v) => set("totalFundingDilutive", v ? Number(v) : null)} /></div>
          <div><label className="ost-label">Total funding (Non-Dilutive)</label><Money value={s.totalFundingNonDilutive != null ? String(s.totalFundingNonDilutive) : ""} onChange={(v) => set("totalFundingNonDilutive", v ? Number(v) : null)} /></div>
          <div>
            <label className="ost-label">Investment Stage</label>
            <Pills options={INVESTMENT_STAGE_OPTIONS} value={s.investmentStage ?? ""} onChange={(v) => set("investmentStage", v)} />
          </div>
          <div><label className="ost-label">Round Size</label><Money value={s.roundSize != null ? String(s.roundSize) : ""} onChange={(v) => set("roundSize", v ? Number(v) : null)} /></div>
          <div><label className="ost-label">Committed Funds</label><Money value={s.committedFunds != null ? String(s.committedFunds) : ""} onChange={(v) => set("committedFunds", v ? Number(v) : null)} /></div>
        </InitialDataCard>

        {/* 7. Technology */}
        <InitialDataCard title="7. Technology" isOpen={false} onToggle={() => {}}>
          <div><label className="ost-label">Core technology</label><textarea className="ost-input min-h-[60px]" value={s.coreIpTechnology ?? ""} onChange={(e) => set("coreIpTechnology", e.target.value)} /></div>
          <div><label className="ost-label">Main Technologies</label><input className="ost-input" value={s.mainTechnologies ?? ""} onChange={(e) => set("mainTechnologies", e.target.value)} /></div>
          <div><label className="ost-label">Product Type</label><input className="ost-input" value={s.productType ?? ""} onChange={(e) => set("productType", e.target.value)} /></div>
        </InitialDataCard>

        {/* 8. Product */}
        <InitialDataCard
          title="8. Product"
          isOpen={expanded.has("product")}
          onToggle={() => toggle("product")}
          hidden={<a href={TRL_EXPLAINER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-secondary hover:underline">What is a TRL level? <ExternalLink className="h-3.5 w-3.5" /></a>}
        >
          <div>
            <label className="ost-label">Product Stage</label>
            <select className="ost-input" value={s.productStage ?? ""} onChange={(e) => set("productStage", e.target.value)}>
              <option value="">Not set</option>
              {PRODUCT_STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div><label className="ost-label">Product roadmap</label><LinkInput value={s.productRoadmapLink ?? ""} onChange={(v) => set("productRoadmapLink", v)} /></div>
          <div><label className="ost-label">TRL level (1-9)</label><input type="number" min={1} max={9} className="ost-input" value={s.trlLevel ?? ""} onChange={(e) => set("trlLevel", e.target.value ? Number(e.target.value) : null)} /></div>
        </InitialDataCard>

        {/* 9. Patenting */}
        <InitialDataCard title="9. Patenting" isOpen={false} onToggle={() => {}}>
          <RepeatableList
            rows={data.patents}
            emptyText="No patents added yet."
            addLabel="Add patent"
            onAdd={() => setActiveModal("patent")}
            onDelete={(id) => deleteRow(`${sub}/patents`, id)}
            renderRow={(p) => (
              <>
                <p className="font-semibold text-primary">{labelOf(PATENT_APPLICATION_TYPE_OPTIONS, p.applicationType)}</p>
                <p className="text-slate-400">{labelOf(PATENT_STATUS_OPTIONS, p.status)}</p>
              </>
            )}
          />
        </InitialDataCard>

        {/* 10. Market Size */}
        <InitialDataCard title="10. Market Size" isOpen={false} onToggle={() => {}}>
          <div><label className="ost-label">Total Addressable Market</label><Money value={s.totalAddressableMarket != null ? String(s.totalAddressableMarket) : ""} onChange={(v) => set("totalAddressableMarket", v ? Number(v) : null)} /></div>
          <div><label className="ost-label">Serviceable Addressable Market</label><Money value={s.serviceableAddressableMarket != null ? String(s.serviceableAddressableMarket) : ""} onChange={(v) => set("serviceableAddressableMarket", v ? Number(v) : null)} /></div>
          <div><label className="ost-label">Serviceable Obtainable Market</label><Money value={s.serviceableObtainableMarket != null ? String(s.serviceableObtainableMarket) : ""} onChange={(v) => set("serviceableObtainableMarket", v ? Number(v) : null)} /></div>
        </InitialDataCard>

        {/* 11. Go To Market */}
        <InitialDataCard title="11. Go To Market" isOpen={false} onToggle={() => {}}>
          <RepeatableList
            rows={data.targetMarkets}
            emptyText="No target markets added yet."
            addLabel="Add market"
            onAdd={() => setActiveModal("targetMarket")}
            onDelete={(id) => deleteRow(`${sub}/target-markets`, id)}
            renderRow={(m) => (
              <>
                <p className="font-semibold text-primary">{m.market}</p>
                <p className="text-slate-400">{labelOf(GTM_STATUS_OPTIONS, m.status)}</p>
              </>
            )}
          />
          <div className="mt-2"><label className="ost-label">Go To Market strategy (link)</label><LinkInput value={s.goToMarketStrategyLink ?? ""} onChange={(v) => set("goToMarketStrategyLink", v)} /></div>
        </InitialDataCard>

        {/* 12. Competition */}
        <InitialDataCard title="12. Competition" isOpen={false} onToggle={() => {}}>
          <textarea className="ost-input min-h-[140px] w-full" value={s.competitionOverview ?? ""} onChange={(e) => set("competitionOverview", e.target.value)} />
        </InitialDataCard>

        {/* 13. Clients */}
        <InitialDataCard
          title="13. Clients"
          isOpen={expanded.has("clients")}
          onToggle={() => toggle("clients")}
          hidden={
            <>
              <div><label className="ost-label">CRM of clients (link)</label><LinkInput value={s.clientsCrmLink ?? ""} onChange={(v) => set("clientsCrmLink", v)} /></div>
              <RepeatableList
                rows={data.clientDetails}
                emptyText="No client details added yet."
                addLabel="Add client detail"
                onAdd={() => setActiveModal("clientDetail")}
                onDelete={(id) => deleteRow(`${sub}/client-details`, id)}
                renderRow={(c) => (
                  <>
                    <p className="font-semibold text-primary">{c.clientName} — {formatMoney(c.dealValue)}</p>
                    {c.scopeOfWork && <p className="text-slate-400">{c.scopeOfWork}</p>}
                  </>
                )}
              />
            </>
          }
        >
          <RepeatableList
            rows={data.clientStats}
            emptyText="No client types added yet."
            addLabel="Add client type"
            onAdd={() => setActiveModal("clientStat")}
            onDelete={(id) => deleteRow(`${sub}/client-stats`, id)}
            renderRow={(c) => (
              <>
                <p className="font-semibold text-primary">{labelOf(CLIENT_TYPE_OPTIONS, c.clientType)} — {c.totalClients ?? 0} clients</p>
                <p className="text-slate-400">{[c.majorClientNames, c.retentionRate != null ? `${c.retentionRate}% retention` : null].filter(Boolean).join(" · ")}</p>
              </>
            )}
          />
          <div className="mt-2"><label className="ost-label">Ideal Customer Persona</label><textarea className="ost-input min-h-[50px]" value={s.idealCustomerPersona ?? ""} onChange={(e) => set("idealCustomerPersona", e.target.value)} /></div>
        </InitialDataCard>

        {/* 14. Partner */}
        <InitialDataCard
          title="14. Partner"
          isOpen={expanded.has("partners")}
          onToggle={() => toggle("partners")}
          hidden={
            <>
              <div><label className="ost-label">CRM of partners (link)</label><LinkInput value={s.partnersCrmLink ?? ""} onChange={(v) => set("partnersCrmLink", v)} /></div>
              <RepeatableList
                rows={data.partnerDetails}
                emptyText="No partner details added yet."
                addLabel="Add partner detail"
                onAdd={() => setActiveModal("partnerDetail")}
                onDelete={(id) => deleteRow(`${sub}/partner-details`, id)}
                renderRow={(p) => (
                  <>
                    <p className="font-semibold text-primary">{p.partnerName}</p>
                    <p className="text-slate-400">{[p.scopeOfPartnership, p.nextSteps].filter(Boolean).join(" · ")}</p>
                  </>
                )}
              />
            </>
          }
        >
          <RepeatableList
            rows={data.partnerStats}
            emptyText="No partner types added yet."
            addLabel="Add partner type"
            onAdd={() => setActiveModal("partnerStat")}
            onDelete={(id) => deleteRow(`${sub}/partner-stats`, id)}
            renderRow={(p) => (
              <>
                <p className="font-semibold text-primary">{labelOf(PARTNER_TYPE_OPTIONS, p.partnerType)} — {p.totalPartners ?? 0} partners</p>
                <p className="text-slate-400">{[p.majorPartnerNames, p.retentionRate != null ? `${p.retentionRate}% retention` : null].filter(Boolean).join(" · ")}</p>
              </>
            )}
          />
        </InitialDataCard>

        {/* 15. Key Achievements */}
        <InitialDataCard title="15. Key Achievements" isOpen={false} onToggle={() => {}}>
          <AchievementsLog apiBase={apiConfig.metricsApiBase} achievements={data.achievements} onSaved={invalidate} />
        </InitialDataCard>
      </div>

      {activeModal === "founder" && (
        <AddModal
          title="Add founder"
          fields={[
            { key: "name", label: "Name", type: "text" },
            { key: "gender", label: "Gender", type: "text" },
            { key: "educationalBackground", label: "Educational Background", type: "text" },
            { key: "professionalBackground", label: "Professional Background", type: "text" },
            { key: "yearsOfExperience", label: "Years of Experience", type: "number" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => addRow(apiConfig.teamUrl, { ...v, type: "founder" }, ["yearsOfExperience"])}
        />
      )}
      {activeModal === "shareholder" && (
        <AddModal
          title="Add shareholder"
          fields={[
            { key: "name", label: "Shareholder Name", type: "text" },
            { key: "percentage", label: "Shareholder %", type: "number" },
            { key: "currentInvolvement", label: "Current involvement", type: "select", options: INVOLVEMENT_OPTIONS },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => addRow(apiConfig.capTableUrl, v, ["percentage"])}
        />
      )}
      {activeModal === "fundingRound" && (
        <AddModal
          title="Add funding round"
          fields={[
            { key: "fundingType", label: "Type", type: "select", options: FUNDING_TYPE_OPTIONS },
            { key: "amount", label: "Amount", type: "number" },
            { key: "investorName", label: "Investor / Donor Name", type: "text" },
            { key: "round", label: "Round (if applicable)", type: "text" },
            { key: "roundDate", label: "Date (Month & year)", type: "text" },
            { key: "dealTerms", label: "Deal terms", type: "textarea" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => addRow(`${sub}/funding-rounds`, v, ["amount"])}
        />
      )}
      {activeModal === "patent" && (
        <AddModal
          title="Add patent"
          fields={[
            { key: "applicationType", label: "Type of application", type: "select", options: PATENT_APPLICATION_TYPE_OPTIONS },
            { key: "status", label: "Status", type: "select", options: PATENT_STATUS_OPTIONS },
            { key: "applicantName", label: "Patent Applicant Name", type: "text" },
            { key: "country", label: "Country", type: "text" },
            { key: "priorityDate", label: "Priority Date", type: "text" },
            { key: "effectiveFilingDate", label: "Effective filing date", type: "text" },
            { key: "publicationDate", label: "Publication Date", type: "text" },
            { key: "publicationNumber", label: "Publication Number", type: "text" },
            { key: "nextAction", label: "Next Action", type: "textarea" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => addRow(`${sub}/patents`, v)}
        />
      )}
      {activeModal === "targetMarket" && (
        <AddModal
          title="Add target market"
          fields={[
            { key: "market", label: "Market", type: "text" },
            { key: "status", label: "Status", type: "select", options: GTM_STATUS_OPTIONS },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => addRow(`${sub}/target-markets`, v)}
        />
      )}
      {activeModal === "clientStat" && (
        <AddModal
          title="Add client type"
          fields={[
            { key: "clientType", label: "Type of client", type: "select", options: CLIENT_TYPE_OPTIONS },
            { key: "totalClients", label: "Total number of clients", type: "number" },
            { key: "majorClientNames", label: "Name major clients", type: "text" },
            { key: "retentionRate", label: "Retention rate (%)", type: "number" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => addRow(`${sub}/client-stats`, v, ["totalClients", "retentionRate"])}
        />
      )}
      {activeModal === "clientDetail" && (
        <AddModal
          title="Add client detail"
          fields={[
            { key: "clientName", label: "Client Name", type: "text" },
            { key: "scopeOfWork", label: "Scope of work", type: "text" },
            { key: "dealValue", label: "Deal value", type: "number" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => addRow(`${sub}/client-details`, v, ["dealValue"])}
        />
      )}
      {activeModal === "partnerStat" && (
        <AddModal
          title="Add partner type"
          fields={[
            { key: "partnerType", label: "Type of partner", type: "select", options: PARTNER_TYPE_OPTIONS },
            { key: "totalPartners", label: "Total number of partners", type: "number" },
            { key: "majorPartnerNames", label: "Name major partners", type: "text" },
            { key: "retentionRate", label: "Retention rate (%)", type: "number" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => addRow(`${sub}/partner-stats`, v, ["totalPartners", "retentionRate"])}
        />
      )}
      {activeModal === "partnerDetail" && (
        <AddModal
          title="Add partner detail"
          fields={[
            { key: "partnerName", label: "Partner Name", type: "text" },
            { key: "scopeOfPartnership", label: "Scope of partnership", type: "text" },
            { key: "nextSteps", label: "Next steps", type: "text" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => addRow(`${sub}/partner-details`, v)}
        />
      )}
    </div>
  );
}
