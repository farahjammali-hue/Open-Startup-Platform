import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";
import { formatMoney } from "../../lib/format";
import { downloadXlsx } from "../../lib/xlsx";
import { ModalShell } from "../ModalShell";
import { Skeleton } from "../Skeleton";
import { Pills, MultiPills, Money, LinkInput } from "../StartupFormFields";
import { AchievementsLog, type Achievement } from "../metrics/MetricsKpiPanel";
import { InitialDataCard, type CardCompletion } from "./InitialDataCard";
import { LEGAL_ENTITY_LABELS } from "../../lib/startupProfileLabels";
import {
  BUSINESS_MODEL_OPTIONS, PRODUCT_STAGE_OPTIONS, INVESTMENT_STAGE_OPTIONS, FUNDING_TYPE_OPTIONS,
  PATENT_APPLICATION_TYPE_OPTIONS, PATENT_STATUS_OPTIONS, GTM_STATUS_OPTIONS, CLIENT_TYPE_OPTIONS,
  PARTNER_TYPE_OPTIONS, INVOLVEMENT_OPTIONS, TRL_EXPLAINER_URL, type Option,
} from "@shared/initialDataCatalog";
import {
  CircleNotch as Loader2, Plus, Trash as Trash2, ArrowSquareOut as ExternalLink, Download,
  Buildings, NotePencil, Lightbulb, Users, ChartPieSlice, PiggyBank, Cpu, Package,
  Scales, ChartBar, Target, Binoculars, UserCircle, Handshake, Trophy, type Icon,
} from "@phosphor-icons/react";

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
  totalAddressableMarket: string | null;
  serviceableAddressableMarket: string | null;
  serviceableObtainableMarket: string | null;
  goToMarketStrategyLink: string | null;
  mainCompetitors: string | null;
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
  currentInvolvement: string | null;
}
interface CapTableEntryRow { id: string; name: string; percentage: number; currentInvolvement: string | null }
interface FundingRoundRow { id: string; amount: number | null; investorName: string | null; fundingType: string | null; round: string | null; roundDate: string | null; dealTerms: string | null }
interface PatentRow {
  id: string; applicantName: string | null; country: string | null; applicationType: string | null;
  priorityDate: string | null; effectiveFilingDate: string | null; publicationDate: string | null;
  publicationNumber: string | null; status: string | null; nextAction: string | null;
}
interface TargetMarketRow { id: string; market: string; status: string; strategyLink: string | null }
interface CompetitorRow { id: string; name: string; details: string | null }
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
  competitors: CompetitorRow[];
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

/** empty (0 filled) / partial (some) / complete (all) — the same rule for every card. */
function completionOf(filled: boolean[]): CardCompletion {
  const n = filled.filter(Boolean).length;
  if (n === 0) return "empty";
  return n === filled.length ? "complete" : "partial";
}

/* ---------------- Generic building blocks ---------------- */

/** Label used above every single-line field, identically across all 15 cards. */
function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[13px] font-medium" style={{ color: "var(--text-2)" }}>
      {children}
    </label>
  );
}

/** A labeled field wrapper — pairs FieldLabel with its input so call sites read as one unit. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

// Appended to `ost-input` (not replacing it) so single-line fields get a fixed
// 40px height on top of ost-input's existing border/bg/focus-ring — textareas
// are exempt, they size by content the way a multi-line field should.
const H10 = "h-10";

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
          View <ExternalLink className="h-4 w-4" />
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
  title, fields, initial, submitLabel = "Add", onClose, onSubmit,
}: {
  title: string; fields: FieldDef[]; initial?: Record<string, any>; submitLabel?: string;
  onClose: () => void; onSubmit: (values: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!initial) return {};
    const v: Record<string, string> = {};
    for (const f of fields) v[f.key] = initial[f.key] != null ? String(initial[f.key]) : "";
    return v;
  });
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
          <FieldLabel>{f.label}</FieldLabel>
          {f.type === "select" ? (
            <select className={`ost-input ${H10}`} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
              <option value="">Select…</option>
              {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === "textarea" ? (
            <textarea className="ost-input min-h-[60px]" value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          ) : (
            <input
              type={f.type === "number" ? "number" : "text"}
              className={`ost-input ${H10}`}
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
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}
        </button>
      </div>
    </ModalShell>
  );
}

function RepeatableList<T extends { id: string }>({
  rows, renderRow, onDelete, onAdd, addLabel, emptyText, onRowClick,
}: {
  rows: T[]; renderRow: (row: T) => ReactNode; onDelete: (id: string) => void; emptyText: string;
  /** Omit both when the card fills a new row inline instead of via an "Add" button + modal (e.g. Patenting). */
  onAdd?: () => void; addLabel?: string;
  /** When set, each row becomes clickable (e.g. to view its full details in a modal) — the delete button still works on its own, it just stops the click from also opening the row. */
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-xs text-slate-400">{emptyText}</p>}
      {rows.map((row) => (
        <div
          key={row.id}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          className={`group flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 ${onRowClick ? "cursor-pointer transition hover:border-secondary/40" : ""}`}
        >
          <div className="min-w-0 flex-1 text-xs text-slate-600">{renderRow(row)}</div>
          <button
            aria-label="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(row.id); }}
            className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {onAdd && (
        <button type="button" onClick={onAdd} className="ost-btn-ghost !px-2.5 !py-1 text-xs"><Plus className="h-4 w-4" /> {addLabel}</button>
      )}
    </div>
  );
}

/** Competitor + details, listed one under another, with its own inline add/edit form (no modal). */
function CompetitorsSection({
  sub, competitors, addRow, updateRow, deleteRow,
}: {
  sub: string;
  competitors: CompetitorRow[];
  addRow: (base: string, values: Record<string, string>) => Promise<void>;
  updateRow: (base: string, id: string, values: Record<string, string>) => Promise<void>;
  deleteRow: (base: string, id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setDetails("");
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateRow(`${sub}/competitors`, editingId, { name, details });
      } else {
        await addRow(`${sub}/competitors`, { name, details });
      }
      setName("");
      setDetails("");
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <RepeatableList
        rows={competitors}
        emptyText="No competitors added yet."
        onDelete={(id) => deleteRow(`${sub}/competitors`, id)}
        onRowClick={(c) => { setEditingId(c.id); setName(c.name); setDetails(c.details ?? ""); }}
        renderRow={(c) => (
          <>
            <p className="font-semibold text-primary">{c.name}</p>
            {c.details && <p className="text-slate-400">{c.details}</p>}
          </>
        )}
      />
      <div className="mt-3 space-y-3">
        {editingId && (
          <div className="flex items-center justify-between rounded-lg bg-secondary/5 px-3 py-2 text-xs font-semibold text-secondary">
            Editing competitor
            <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-primary">Cancel</button>
          </div>
        )}
        <div>
          <FieldLabel>Competitor</FieldLabel>
          <input className={`ost-input ${H10}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Competitor A" />
        </div>
        <div>
          <FieldLabel>Details</FieldLabel>
          <input className={`ost-input ${H10}`} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What sets them apart, funding, etc." />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !name.trim()}
          className="ost-btn-ghost !px-2.5 !py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {editingId ? "Update competitor" : "Add competitor"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Main panel ---------------- */

export function InitialDataPanel({ apiConfig, startupName }: { apiConfig: InitialDataApiConfig; startupName?: string }) {
  const qc = useQueryClient();
  const queryKey = ["initial-data-panel", apiConfig.getUrl];
  const { data, isLoading } = useQuery<ProfileResponse>({ queryKey, queryFn: () => api(apiConfig.getUrl) });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  // The row being edited when activeModal is open for an existing entry;
  // null means the modal is in "add a new one" mode.
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);

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

  async function updateRow(base: string, id: string, values: Record<string, string>, numericKeys: string[] = []) {
    const body: Record<string, any> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v === "" || v == null) continue;
      body[k] = numericKeys.includes(k) ? Number(v) : v;
    }
    await api(`${base}/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    invalidate();
  }

  function openAdd(kind: string) {
    setEditingRow(null);
    setActiveModal(kind);
  }

  function openEdit(kind: string, row: Record<string, any>) {
    setEditingRow(row);
    setActiveModal(kind);
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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  const s = form as StartupProfileData;
  const sub = apiConfig.subResourceBase;
  const founders = data.teamMembers.filter((m) => m.type === "founder");

  async function exportSheet() {
    if (!data) return; // already guaranteed by the isLoading check above; narrows for TS inside this closure
    const rows: (string | number)[][] = [["Card", "Field", "Value"]];
    const push = (card: string, field: string, value: string | number | null | undefined) => rows.push([card, field, value ?? ""]);
    const money = (n: number | null | undefined) => (n == null ? null : formatMoney(n));

    push("1. Profile", "Legal Entity", s.legalEntityStatus ? LEGAL_ENTITY_LABELS[s.legalEntityStatus] : "");
    push("1. Profile", "Year of constitution", s.startedYear ?? "");
    push("1. Profile", "Headquarters", s.country ?? "");
    push("1. Profile", "Other countries of operation", s.countriesOfOperation ?? "");
    push("1. Profile", "Business model", (s.businessModelTypes ?? []).map((v) => labelOf(BUSINESS_MODEL_OPTIONS, v)).join(", "));
    push("1. Profile", "Pitch deck link", s.deckUrl ?? "");
    push("1. Profile", "Data Room link", s.dataRoomLink ?? "");

    push("2. Brief Description", "Overview", s.coreBusinessOverview ?? "");

    push("3. Unique Value Proposition", "Description", s.uniqueValueProposition ?? "");

    push("4. Team", "Team Size", s.teamSize ?? "");
    push("4. Team", "% Youth in team", s.youthEmployees ?? "");
    push("4. Team", "Contractors", s.contractorsCount ?? "");
    push("4. Team", "Paid employees", s.paidEmployeesCount ?? "");
    push("4. Team", "Advisors", s.advisorsCount ?? "");
    push("4. Team", "Female employees", s.femaleTeamMembers ?? "");
    founders.forEach((m, i) => push("4. Team", `Founder ${i + 1}`, [m.name, m.role, m.currentInvolvement ? labelOf(INVOLVEMENT_OPTIONS, m.currentInvolvement) : null, m.gender, m.educationalBackground, m.professionalBackground, m.yearsOfExperience != null ? `${m.yearsOfExperience} yrs` : null].filter(Boolean).join(" · ")));

    data.capTableEntries.forEach((e, i) => push("5. Shareholders", `Shareholder ${i + 1}`, [`${e.name} — ${e.percentage}%`, e.currentInvolvement ? labelOf(INVOLVEMENT_OPTIONS, e.currentInvolvement) : null].filter(Boolean).join(" · ")));

    push("6. Funding", "Total raised", s.totalFundingRaised ?? "");
    push("6. Funding", "Dilutive", s.totalFundingDilutive ?? "");
    push("6. Funding", "Non-Dilutive", s.totalFundingNonDilutive ?? "");
    push("6. Funding", "Investment Stage", s.investmentStage ? labelOf(INVESTMENT_STAGE_OPTIONS, s.investmentStage) : "");
    push("6. Funding", "Round Size", s.roundSize ?? "");
    push("6. Funding", "Committed Funds", s.committedFunds ?? "");
    data.fundingRounds.forEach((r, i) => push("6. Funding", `Funding Round ${i + 1}`, [r.investorName || "Unnamed investor", money(r.amount), labelOf(FUNDING_TYPE_OPTIONS, r.fundingType), r.round, r.roundDate].filter(Boolean).join(" · ")));
    push("6. Funding", "CRM of investors (link)", s.fundingCrmLink ?? "");

    push("7. Technology", "Core technology", s.coreIpTechnology ?? "");
    push("7. Technology", "Main Technologies", s.mainTechnologies ?? "");
    push("7. Technology", "Product Type", s.productType ?? "");

    push("8. Product", "Product Stage", s.productStage ? labelOf(PRODUCT_STAGE_OPTIONS, s.productStage) : "");
    push("8. Product", "Product roadmap", s.productRoadmapLink ?? "");
    push("8. Product", "TRL level (1-9)", s.trlLevel ?? "");

    data.patents.forEach((p, i) => push("9. Patenting", `Patent ${i + 1}`, [labelOf(PATENT_APPLICATION_TYPE_OPTIONS, p.applicationType), labelOf(PATENT_STATUS_OPTIONS, p.status), p.applicantName, p.country, p.priorityDate, p.effectiveFilingDate, p.publicationDate, p.publicationNumber, p.nextAction].filter(Boolean).join(" · ")));

    push("10. Market Size", "Total Addressable Market", s.totalAddressableMarket ?? "");
    push("10. Market Size", "Serviceable Addressable Market", s.serviceableAddressableMarket ?? "");
    push("10. Market Size", "Serviceable Obtainable Market", s.serviceableObtainableMarket ?? "");

    data.targetMarkets.forEach((m, i) => push("11. Go To Market", `Target Market ${i + 1}`, [m.market, labelOf(GTM_STATUS_OPTIONS, m.status), m.strategyLink].filter(Boolean).join(" · ")));
    push("11. Go To Market", "Go To Market strategy (link)", s.goToMarketStrategyLink ?? "");

    data.competitors.forEach((c, i) => push("12. Competition", `Competitor ${i + 1}`, [c.name, c.details].filter(Boolean).join(" · ")));
    push("12. Competition", "Overview", s.competitionOverview ?? "");

    data.clientStats.forEach((c, i) => push("13. Clients", `Client Type ${i + 1}`, [labelOf(CLIENT_TYPE_OPTIONS, c.clientType), c.totalClients != null ? `${c.totalClients} clients` : null, c.majorClientNames, c.retentionRate != null ? `${c.retentionRate}% retention` : null].filter(Boolean).join(" · ")));
    push("13. Clients", "Ideal Customer Persona", s.idealCustomerPersona ?? "");
    data.clientDetails.forEach((c, i) => push("13. Clients", `Client Detail ${i + 1}`, [c.clientName, money(c.dealValue), c.scopeOfWork].filter(Boolean).join(" · ")));
    push("13. Clients", "CRM of clients (link)", s.clientsCrmLink ?? "");

    data.partnerStats.forEach((p, i) => push("14. Partner", `Partner Type ${i + 1}`, [labelOf(PARTNER_TYPE_OPTIONS, p.partnerType), p.totalPartners != null ? `${p.totalPartners} partners` : null, p.majorPartnerNames, p.retentionRate != null ? `${p.retentionRate}% retention` : null].filter(Boolean).join(" · ")));
    data.partnerDetails.forEach((p, i) => push("14. Partner", `Partner Detail ${i + 1}`, [p.partnerName, p.scopeOfPartnership, p.nextSteps].filter(Boolean).join(" · ")));
    push("14. Partner", "CRM of partners (link)", s.partnersCrmLink ?? "");

    data.achievements.forEach((a, i) => push("15. Key Achievements", `Achievement ${i + 1}`, [a.achievement, a.details].filter(Boolean).join(" — ")));

    const namePart = startupName ? `${startupName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-` : "";
    await downloadXlsx(`${namePart}initial-data.xlsx`, "Initial Data", rows, { mergeColumns: [0] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={exportSheet} className="ost-btn-ghost !px-4 !py-2 text-sm">
          <Download className="h-4 w-4" /> Export Excel
        </button>
        <button onClick={saveOverview} disabled={saving} className="ost-btn-primary !px-4 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. Profile */}
        <InitialDataCard
          title="1. Profile"
          icon={Buildings}
          completion={completionOf([!!s.legalEntityStatus, s.startedYear != null, !!s.country, (s.businessModelTypes?.length ?? 0) > 0])}
          isOpen={expanded.has("profile")}
          onToggle={() => toggle("profile")}
          hidden={
            <div className="grid grid-cols-2 gap-4">
              <Field label="Pitch deck link"><LinkInput value={s.deckUrl ?? ""} onChange={(v) => set("deckUrl", v)} /></Field>
              <Field label="Data Room link"><LinkInput value={s.dataRoomLink ?? ""} onChange={(v) => set("dataRoomLink", v)} /></Field>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Legal Entity">
              <select className={`ost-input ${H10}`} value={s.legalEntityStatus ?? ""} onChange={(e) => set("legalEntityStatus", e.target.value)}>
                <option value="">Not set</option>
                {Object.entries(LEGAL_ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Year of constitution">
              <input type="number" className={`ost-input ${H10}`} value={s.startedYear ?? ""} onChange={(e) => set("startedYear", e.target.value ? Number(e.target.value) : null)} />
            </Field>
          </div>
          <Field label="Headquarters">
            <input className={`ost-input ${H10}`} value={s.country ?? ""} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field label="Other countries of operation">
            <input className={`ost-input ${H10}`} value={s.countriesOfOperation ?? ""} onChange={(e) => set("countriesOfOperation", e.target.value)} placeholder="e.g. Kenya, Tanzania" />
          </Field>
          <Field label="Business model">
            <MultiPills options={BUSINESS_MODEL_OPTIONS} value={s.businessModelTypes ?? []} onChange={(v) => set("businessModelTypes", v)} />
          </Field>
        </InitialDataCard>

        {/* 2. Brief Description */}
        <InitialDataCard title="2. Brief Description" icon={NotePencil} completion={completionOf([!!s.coreBusinessOverview])} isOpen={false} onToggle={() => {}}>
          <textarea className="ost-input min-h-[90px] w-full" value={s.coreBusinessOverview ?? ""} onChange={(e) => set("coreBusinessOverview", e.target.value)} placeholder="What your startup does, the problem it solves, and who it's for, in 150 words or less." />
        </InitialDataCard>

        {/* 3. Unique Value Proposition */}
        <InitialDataCard title="3. Unique Value Proposition" icon={Lightbulb} completion={completionOf([!!s.uniqueValueProposition])} isOpen={false} onToggle={() => {}}>
          <textarea className="ost-input min-h-[90px] w-full" value={s.uniqueValueProposition ?? ""} onChange={(e) => set("uniqueValueProposition", e.target.value)} placeholder="What sets your solution apart from competitors, in 50 words or less." />
        </InitialDataCard>

        {/* 4. Team */}
        <InitialDataCard
          title="4. Team"
          icon={Users}
          completion={completionOf([founders.length > 0, s.teamSize != null])}
          isOpen={expanded.has("team")}
          onToggle={() => toggle("team")}
          hidden={
            <RepeatableList
              rows={founders}
              emptyText="No founders added yet."
              addLabel="Add team member"
              onAdd={() => openAdd("founder")}
              onRowClick={(row) => openEdit("founder", row)}
              onDelete={(id) => deleteRow(apiConfig.teamUrl, id)}
              renderRow={(m) => (
                <>
                  <p className="font-semibold text-primary">{m.name}{m.role ? ` · ${m.role}` : ""}</p>
                  <p className="text-slate-400">{[m.gender, m.educationalBackground, m.professionalBackground, m.yearsOfExperience != null ? `${m.yearsOfExperience} yrs exp.` : null, m.currentInvolvement ? labelOf(INVOLVEMENT_OPTIONS, m.currentInvolvement) : null].filter(Boolean).join(" · ")}</p>
                </>
              )}
            />
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Team Size"><input type="number" className={`ost-input ${H10}`} value={s.teamSize ?? ""} onChange={(e) => set("teamSize", e.target.value ? Number(e.target.value) : null)} /></Field>
            <Field label="% Youth in team"><input type="number" className={`ost-input ${H10}`} value={s.youthEmployees ?? ""} onChange={(e) => set("youthEmployees", e.target.value ? Number(e.target.value) : null)} /></Field>
            <Field label="Contractors"><input type="number" className={`ost-input ${H10}`} value={s.contractorsCount ?? ""} onChange={(e) => set("contractorsCount", e.target.value ? Number(e.target.value) : null)} /></Field>
            <Field label="Paid employees"><input type="number" className={`ost-input ${H10}`} value={s.paidEmployeesCount ?? ""} onChange={(e) => set("paidEmployeesCount", e.target.value ? Number(e.target.value) : null)} /></Field>
            <Field label="Advisors"><input type="number" className={`ost-input ${H10}`} value={s.advisorsCount ?? ""} onChange={(e) => set("advisorsCount", e.target.value ? Number(e.target.value) : null)} /></Field>
            <Field label="Female employees"><input type="number" className={`ost-input ${H10}`} value={s.femaleTeamMembers ?? ""} onChange={(e) => set("femaleTeamMembers", e.target.value ? Number(e.target.value) : null)} /></Field>
          </div>
        </InitialDataCard>

        {/* 5. Shareholders */}
        <InitialDataCard title="5. Shareholders" icon={ChartPieSlice} completion={completionOf([data.capTableEntries.length > 0])} isOpen={false} onToggle={() => {}}>
          <RepeatableList
            rows={data.capTableEntries}
            emptyText="No shareholders added yet."
            addLabel="Add shareholder"
            onAdd={() => openAdd("shareholder")}
            onRowClick={(row) => openEdit("shareholder", row)}
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
          icon={PiggyBank}
          completion={completionOf([s.totalFundingRaised != null, !!s.investmentStage])}
          isOpen={false}
          onToggle={() => {}}
        >
          <Field label="Total raised">
            <Money value={s.totalFundingRaised != null ? String(s.totalFundingRaised) : ""} onChange={(v) => set("totalFundingRaised", v ? Number(v) : null)} placeholder="Total raised" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dilutive"><Money value={s.totalFundingDilutive != null ? String(s.totalFundingDilutive) : ""} onChange={(v) => set("totalFundingDilutive", v ? Number(v) : null)} placeholder="Dilutive" /></Field>
            <Field label="Non-Dilutive"><Money value={s.totalFundingNonDilutive != null ? String(s.totalFundingNonDilutive) : ""} onChange={(v) => set("totalFundingNonDilutive", v ? Number(v) : null)} placeholder="Non-dilutive" /></Field>
          </div>
          <div>
            <FieldLabel>Funding raised details</FieldLabel>
            <RepeatableList
              rows={data.fundingRounds}
              emptyText="No funding rounds added yet."
              addLabel="Add funding round"
              onAdd={() => openAdd("fundingRound")}
              onRowClick={(row) => openEdit("fundingRound", row)}
              onDelete={(id) => deleteRow(`${sub}/funding-rounds`, id)}
              renderRow={(r) => (
                <>
                  <p className="font-semibold text-primary">{r.investorName || "Unnamed investor"} — {formatMoney(r.amount)}</p>
                  <p className="text-slate-400">{[labelOf(FUNDING_TYPE_OPTIONS, r.fundingType), r.round, r.roundDate].filter(Boolean).join(" · ")}</p>
                </>
              )}
            />
          </div>
          <Field label="Investment Stage">
            <Pills options={INVESTMENT_STAGE_OPTIONS} value={s.investmentStage ?? ""} onChange={(v) => set("investmentStage", v)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Round Size"><Money value={s.roundSize != null ? String(s.roundSize) : ""} onChange={(v) => set("roundSize", v ? Number(v) : null)} placeholder="Round size" /></Field>
            <Field label="Committed Funds"><Money value={s.committedFunds != null ? String(s.committedFunds) : ""} onChange={(v) => set("committedFunds", v ? Number(v) : null)} placeholder="Committed funds" /></Field>
          </div>
          <Field label="CRM of investors (link)"><LinkInput value={s.fundingCrmLink ?? ""} onChange={(v) => set("fundingCrmLink", v)} /></Field>
        </InitialDataCard>

        {/* 7. Technology */}
        <InitialDataCard
          title="7. Technology"
          icon={Cpu}
          completion={completionOf([!!s.coreIpTechnology, !!s.mainTechnologies, !!s.productType])}
          isOpen={false}
          onToggle={() => {}}
        >
          <Field label="Core technology"><textarea className="ost-input min-h-[60px]" value={s.coreIpTechnology ?? ""} onChange={(e) => set("coreIpTechnology", e.target.value)} /></Field>
          <Field label="Main Technologies"><input className={`ost-input ${H10}`} value={s.mainTechnologies ?? ""} onChange={(e) => set("mainTechnologies", e.target.value)} /></Field>
          <Field label="Product Type"><input className={`ost-input ${H10}`} value={s.productType ?? ""} onChange={(e) => set("productType", e.target.value)} /></Field>
        </InitialDataCard>

        {/* 8. Product */}
        <InitialDataCard
          title="8. Product"
          icon={Package}
          completion={completionOf([!!s.productStage, s.trlLevel != null])}
          isOpen={false}
          onToggle={() => {}}
        >
          <Field label="Product Stage">
            <select className={`ost-input ${H10}`} value={s.productStage ?? ""} onChange={(e) => set("productStage", e.target.value)}>
              <option value="">Not set</option>
              {PRODUCT_STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Product roadmap"><LinkInput value={s.productRoadmapLink ?? ""} onChange={(v) => set("productRoadmapLink", v)} /></Field>
            <Field label="TRL level (1-9)"><input type="number" min={1} max={9} className={`ost-input ${H10}`} value={s.trlLevel ?? ""} onChange={(e) => set("trlLevel", e.target.value ? Number(e.target.value) : null)} /></Field>
          </div>
          <a href={TRL_EXPLAINER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-secondary hover:underline">
            What is a TRL level? <ExternalLink className="h-4 w-4" />
          </a>
        </InitialDataCard>

        {/* 9. Patenting */}
        <InitialDataCard title="9. Patenting" icon={Scales} completion={completionOf([data.patents.length > 0])} isOpen={false} onToggle={() => {}}>
          <RepeatableList
            rows={data.patents}
            emptyText="No patents added yet."
            addLabel="Add patent"
            onAdd={() => openAdd("patent")}
            onRowClick={(row) => openEdit("patent", row)}
            onDelete={(id) => deleteRow(`${sub}/patents`, id)}
            renderRow={(p) => (
              <>
                <p className="font-semibold text-primary">{labelOf(PATENT_APPLICATION_TYPE_OPTIONS, p.applicationType)} · {labelOf(PATENT_STATUS_OPTIONS, p.status)}</p>
                <p className="text-slate-400">{[p.applicantName, p.country].filter(Boolean).join(" · ") || "—"}</p>
                <p className="text-slate-400">Priority {p.priorityDate || "—"} · Filing {p.effectiveFilingDate || "—"} · Publication {p.publicationDate || "—"}</p>
                <p className="text-slate-400">Publication #: {p.publicationNumber || "—"}</p>
                <p className="text-slate-400">Next action: {p.nextAction || "—"}</p>
              </>
            )}
          />
        </InitialDataCard>

        {/* 10. Market Size */}
        <InitialDataCard
          title="10. Market Size"
          icon={ChartBar}
          completion={completionOf([!!s.totalAddressableMarket, !!s.serviceableAddressableMarket, !!s.serviceableObtainableMarket])}
          isOpen={false}
          onToggle={() => {}}
        >
          <Field label="Total Addressable Market">
            <input className={`ost-input ${H10}`} value={s.totalAddressableMarket ?? ""} onChange={(e) => set("totalAddressableMarket", e.target.value)} placeholder="e.g. $1.5B+ across Sub-Saharan Africa" />
          </Field>
          <Field label="Serviceable Addressable Market">
            <input className={`ost-input ${H10}`} value={s.serviceableAddressableMarket ?? ""} onChange={(e) => set("serviceableAddressableMarket", e.target.value)} placeholder="e.g. $80-120M annually in Nigeria, Ghana" />
          </Field>
          <Field label="Serviceable Obtainable Market">
            <input className={`ost-input ${H10}`} value={s.serviceableObtainableMarket ?? ""} onChange={(e) => set("serviceableObtainableMarket", e.target.value)} placeholder="e.g. $5-10M annually" />
          </Field>
        </InitialDataCard>

        {/* 11. Go To Market */}
        <InitialDataCard
          title="11. Go To Market"
          icon={Target}
          completion={completionOf([data.targetMarkets.length > 0, !!s.goToMarketStrategyLink])}
          isOpen={false}
          onToggle={() => {}}
        >
          <RepeatableList
            rows={data.targetMarkets}
            emptyText="No target markets added yet."
            addLabel="Add market"
            onAdd={() => openAdd("targetMarket")}
            onRowClick={(row) => openEdit("targetMarket", row)}
            onDelete={(id) => deleteRow(`${sub}/target-markets`, id)}
            renderRow={(m) => (
              <>
                <p className="font-semibold text-primary">{m.market}</p>
                <p className="text-slate-400">{labelOf(GTM_STATUS_OPTIONS, m.status)}</p>
                {m.strategyLink && (
                  <a
                    href={m.strategyLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
                  >
                    Strategy link <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
          />
          <Field label="Go To Market strategy (link)"><LinkInput value={s.goToMarketStrategyLink ?? ""} onChange={(v) => set("goToMarketStrategyLink", v)} /></Field>
        </InitialDataCard>

        {/* 12. Competition */}
        <InitialDataCard title="12. Competition" icon={Binoculars} completion={completionOf([data.competitors.length > 0, !!s.competitionOverview])} isOpen={false} onToggle={() => {}}>
          <Field label="Main Competitors">
            <CompetitorsSection sub={sub} competitors={data.competitors} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow} />
          </Field>
          <textarea className="ost-input min-h-[90px] w-full" value={s.competitionOverview ?? ""} onChange={(e) => set("competitionOverview", e.target.value)} />
        </InitialDataCard>

        {/* 13. Clients */}
        <InitialDataCard
          title="13. Clients"
          icon={UserCircle}
          completion={completionOf([data.clientStats.length > 0, !!s.idealCustomerPersona])}
          isOpen={expanded.has("clients")}
          onToggle={() => toggle("clients")}
          hidden={
            <>
              <RepeatableList
                rows={data.clientDetails}
                emptyText="No client details added yet."
                addLabel="Add client detail"
                onAdd={() => openAdd("clientDetail")}
                onRowClick={(row) => openEdit("clientDetail", row)}
                onDelete={(id) => deleteRow(`${sub}/client-details`, id)}
                renderRow={(c) => (
                  <>
                    <p className="font-semibold text-primary">{c.clientName} — {formatMoney(c.dealValue)}</p>
                    {c.scopeOfWork && <p className="text-slate-400">{c.scopeOfWork}</p>}
                  </>
                )}
              />
              <Field label="CRM of clients (link)"><LinkInput value={s.clientsCrmLink ?? ""} onChange={(v) => set("clientsCrmLink", v)} /></Field>
            </>
          }
        >
          <RepeatableList
            rows={data.clientStats}
            emptyText="No client types added yet."
            addLabel="Add clients by type"
            onAdd={() => openAdd("clientStat")}
            onRowClick={(row) => openEdit("clientStat", row)}
            onDelete={(id) => deleteRow(`${sub}/client-stats`, id)}
            renderRow={(c) => (
              <>
                <p className="font-semibold text-primary">{labelOf(CLIENT_TYPE_OPTIONS, c.clientType)} — {c.totalClients ?? 0} clients</p>
                <p className="text-slate-400">{[c.majorClientNames, c.retentionRate != null ? `${c.retentionRate}% retention` : null].filter(Boolean).join(" · ")}</p>
              </>
            )}
          />
          <Field label="Ideal Customer Persona"><textarea className="ost-input min-h-[50px]" value={s.idealCustomerPersona ?? ""} onChange={(e) => set("idealCustomerPersona", e.target.value)} /></Field>
        </InitialDataCard>

        {/* 14. Partner */}
        <InitialDataCard
          title="14. Partner"
          icon={Handshake}
          completion={completionOf([data.partnerStats.length > 0])}
          isOpen={expanded.has("partners")}
          onToggle={() => toggle("partners")}
          hidden={
            <>
              <RepeatableList
                rows={data.partnerDetails}
                emptyText="No partner details added yet."
                addLabel="Add partner detail"
                onAdd={() => openAdd("partnerDetail")}
                onRowClick={(row) => openEdit("partnerDetail", row)}
                onDelete={(id) => deleteRow(`${sub}/partner-details`, id)}
                renderRow={(p) => <p className="font-semibold text-primary">{p.partnerName}</p>}
              />
              <Field label="CRM of partners (link)"><LinkInput value={s.partnersCrmLink ?? ""} onChange={(v) => set("partnersCrmLink", v)} /></Field>
            </>
          }
        >
          <RepeatableList
            rows={data.partnerStats}
            emptyText="No partner types added yet."
            addLabel="Add partners by type"
            onAdd={() => openAdd("partnerStat")}
            onRowClick={(row) => openEdit("partnerStat", row)}
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
        <InitialDataCard title="15. Key Achievements" icon={Trophy} completion={completionOf([data.achievements.length > 0])} isOpen={false} onToggle={() => {}}>
          <AchievementsLog apiBase={apiConfig.metricsApiBase} achievements={data.achievements} onSaved={invalidate} />
        </InitialDataCard>
      </div>

      {activeModal === "founder" && (
        <AddModal
          title={editingRow ? "Edit team member" : "Add team member"}
          submitLabel={editingRow ? "Save changes" : "Add"}
          initial={editingRow ?? undefined}
          fields={[
            { key: "name", label: "Name", type: "text" },
            { key: "role", label: "Position", type: "text" },
            { key: "currentInvolvement", label: "Current involvement", type: "select", options: INVOLVEMENT_OPTIONS },
            { key: "gender", label: "Gender", type: "text" },
            { key: "educationalBackground", label: "Educational Background", type: "text" },
            { key: "professionalBackground", label: "Professional Background", type: "text" },
            { key: "yearsOfExperience", label: "Years of Experience", type: "number" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => editingRow
            ? updateRow(apiConfig.teamUrl, editingRow.id, { ...v, type: "founder" }, ["yearsOfExperience"])
            : addRow(apiConfig.teamUrl, { ...v, type: "founder" }, ["yearsOfExperience"])}
        />
      )}
      {activeModal === "shareholder" && (
        <AddModal
          title={editingRow ? "Edit shareholder" : "Add shareholder"}
          submitLabel={editingRow ? "Save changes" : "Add"}
          initial={editingRow ?? undefined}
          fields={[
            { key: "name", label: "Shareholder Name", type: "text" },
            { key: "percentage", label: "Shareholder %", type: "number" },
            { key: "currentInvolvement", label: "Current involvement", type: "select", options: INVOLVEMENT_OPTIONS },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => editingRow
            ? updateRow(apiConfig.capTableUrl, editingRow.id, v, ["percentage"])
            : addRow(apiConfig.capTableUrl, v, ["percentage"])}
        />
      )}
      {activeModal === "fundingRound" && (
        <AddModal
          title={editingRow ? "Edit funding round" : "Add funding round"}
          submitLabel={editingRow ? "Save changes" : "Add"}
          initial={editingRow ?? undefined}
          fields={[
            { key: "fundingType", label: "Type", type: "select", options: FUNDING_TYPE_OPTIONS },
            { key: "amount", label: "Amount", type: "number" },
            { key: "investorName", label: "Investor / Donor Name", type: "text" },
            { key: "round", label: "Round (if applicable)", type: "text" },
            { key: "roundDate", label: "Date (Month & year)", type: "text" },
            { key: "dealTerms", label: "Deal terms", type: "textarea" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => editingRow
            ? updateRow(`${sub}/funding-rounds`, editingRow.id, v, ["amount"])
            : addRow(`${sub}/funding-rounds`, v, ["amount"])}
        />
      )}
      {activeModal === "patent" && (
        <AddModal
          title={editingRow ? "Edit patent" : "Add patent"}
          submitLabel={editingRow ? "Save changes" : "Add"}
          initial={editingRow ?? undefined}
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
          onSubmit={(v) => editingRow
            ? updateRow(`${sub}/patents`, editingRow.id, v)
            : addRow(`${sub}/patents`, v)}
        />
      )}
      {activeModal === "targetMarket" && (
        <AddModal
          title={editingRow ? "Edit target market" : "Add target market"}
          submitLabel={editingRow ? "Save changes" : "Add"}
          initial={editingRow ?? undefined}
          fields={[
            { key: "market", label: "Market (Country)", type: "text" },
            { key: "status", label: "Status", type: "select", options: GTM_STATUS_OPTIONS },
            { key: "strategyLink", label: "Go To Market strategy (link)", type: "text" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => editingRow
            ? updateRow(`${sub}/target-markets`, editingRow.id, v)
            : addRow(`${sub}/target-markets`, v)}
        />
      )}
      {activeModal === "clientStat" && (
        <AddModal
          title={editingRow ? "Edit clients by type" : "Add clients by type"}
          submitLabel={editingRow ? "Save changes" : "Add"}
          initial={editingRow ?? undefined}
          fields={[
            { key: "clientType", label: "Type of client", type: "select", options: CLIENT_TYPE_OPTIONS },
            { key: "totalClients", label: "Total number of clients", type: "number" },
            { key: "majorClientNames", label: "Name major clients", type: "text" },
            { key: "retentionRate", label: "Retention rate (%)", type: "number" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => editingRow
            ? updateRow(`${sub}/client-stats`, editingRow.id, v, ["totalClients", "retentionRate"])
            : addRow(`${sub}/client-stats`, v, ["totalClients", "retentionRate"])}
        />
      )}
      {activeModal === "clientDetail" && (
        <AddModal
          title={editingRow ? "Edit client detail" : "Add client detail"}
          submitLabel={editingRow ? "Save changes" : "Add"}
          initial={editingRow ?? undefined}
          fields={[
            { key: "clientName", label: "Client Name", type: "text" },
            { key: "scopeOfWork", label: "Scope of work", type: "text" },
            { key: "dealValue", label: "Deal value", type: "number" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => editingRow
            ? updateRow(`${sub}/client-details`, editingRow.id, v, ["dealValue"])
            : addRow(`${sub}/client-details`, v, ["dealValue"])}
        />
      )}
      {activeModal === "partnerStat" && (
        <AddModal
          title={editingRow ? "Edit partners by type" : "Add partners by type"}
          submitLabel={editingRow ? "Save changes" : "Add"}
          initial={editingRow ?? undefined}
          fields={[
            { key: "partnerType", label: "Type of partner", type: "select", options: PARTNER_TYPE_OPTIONS },
            { key: "totalPartners", label: "Total number of partners", type: "number" },
            { key: "majorPartnerNames", label: "Name major partners", type: "text" },
            { key: "retentionRate", label: "Retention rate (%)", type: "number" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => editingRow
            ? updateRow(`${sub}/partner-stats`, editingRow.id, v, ["totalPartners", "retentionRate"])
            : addRow(`${sub}/partner-stats`, v, ["totalPartners", "retentionRate"])}
        />
      )}
      {activeModal === "partnerDetail" && (
        <AddModal
          title={editingRow ? "Edit partner detail" : "Add partner detail"}
          submitLabel={editingRow ? "Save changes" : "Add"}
          initial={editingRow ?? undefined}
          fields={[
            { key: "partnerName", label: "Partner Name", type: "text" },
            { key: "scopeOfPartnership", label: "Scope of partnership", type: "text" },
            { key: "nextSteps", label: "Next steps", type: "text" },
          ]}
          onClose={() => setActiveModal(null)}
          onSubmit={(v) => editingRow
            ? updateRow(`${sub}/partner-details`, editingRow.id, v)
            : addRow(`${sub}/partner-details`, v)}
        />
      )}
    </div>
  );
}
