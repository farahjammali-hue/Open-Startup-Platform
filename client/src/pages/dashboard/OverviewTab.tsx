import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ModalShell } from "../../components/ModalShell";
import { Counter, Money, MultiPills } from "../../components/StartupFormFields";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";
import { formatMoney } from "../../lib/format";
import { Building2, Briefcase, Cpu, Pencil, ExternalLink, Loader2, TrendingUp, Handshake, Users, Globe2, PieChart, Plus, Trash2 } from "lucide-react";
import type { TeamMemberRow, CapTableEntryRow } from "./types";
import type { StartupProfile } from "../StartupDashboard";

const LEGAL_ENTITY_LABELS: Record<string, string> = {
  yes: "Yes",
  in_process: "In the process",
  no: "No",
};

const BUSINESS_MODEL_LABELS: Record<string, string> = {
  b2b: "B2B",
  b2c: "B2C",
  b2b2c: "B2B2C",
};

const CUSTOMER_BASE_LABELS: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  emerging_market: "Emerging Market",
  saturated_market: "Saturated Market",
};

const SDG_OPTIONS = [
  "1. No Poverty",
  "2. Zero Hunger",
  "3. Good Health and Well-being",
  "4. Quality Education",
  "5. Gender Equality",
  "6. Clean Water and Sanitation",
  "7. Affordable and Clean Energy",
  "8. Decent Work and Economic Growth",
  "9. Industry, Innovation, and Infrastructure",
  "10. Reduced Inequalities",
  "11. Sustainable Cities and Communities",
  "12. Responsible Consumption and Production",
  "13. Climate Action",
  "14. Life Below Water",
  "15. Life on Land",
  "16. Peace, Justice, and Strong Institutions",
  "17. Partnerships for the Goals",
  "None",
].map((s) => ({ value: s, label: s }));

const CORE_BUSINESS_GUIDANCE =
  "Provide a concise overview of the startup, including its mission, target market, and unique value proposition in 200 words or less.";
const CORE_IP_GUIDANCE =
  "Provide a detailed yet concise explanation of the core IP or technology in 200 words or less, focusing on its features, applications, and how it sets your business apart.";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="ost-helper-text">{label}</span>
      <span className="truncate text-sm font-semibold text-primary">{value || "—"}</span>
    </div>
  );
}

function LinkField({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="ost-helper-text">{label}</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline">
          View <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-sm font-semibold text-slate-300">—</span>
      )}
    </div>
  );
}

export function OverviewTab({
  startup,
  team,
  capTable,
}: {
  startup: StartupProfile | null;
  team: TeamMemberRow[];
  capTable: CapTableEntryRow[];
}) {
  const [editing, setEditing] = useState(false);

  const founderCount = team.filter((t) => t.type === "founder").length;
  const fullTimeCount = team.filter((t) => t.type === "founder" || t.type === "full_time").length;
  const capTableTotal = capTable.reduce((sum, e) => sum + e.percentage, 0);

  return (
    <div className="space-y-6">
      {startup && (
        <div>
          <div className="flex items-center justify-end">
            <button onClick={() => setEditing(true)} className="ost-btn-ghost !px-3 !py-1.5 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit startup profile</button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="ost-card p-6">
              <h3 className="ost-card-title flex items-center gap-2"><Building2 className="h-4 w-4 text-secondary" /> Startup Profile</h3>
              <div className="mt-3">
                <Field label="Legal Entity" value={startup.legalEntityStatus ? LEGAL_ENTITY_LABELS[startup.legalEntityStatus] : null} />
                <Field label="Year of constitution" value={startup.startedYear ? String(startup.startedYear) : null} />
                <Field label="Country" value={startup.country} />
                <Field label="Business Model Type" value={startup.businessModelType ? BUSINESS_MODEL_LABELS[startup.businessModelType] : null} />
                <LinkField label="Deck link" url={startup.deckUrl} />
                <LinkField label="Website link" url={startup.website} />
                <LinkField label="Data Room link" url={startup.dataRoomLink} />
              </div>
            </div>

            <div className="ost-card p-6">
              <h3 className="ost-card-title flex items-center gap-2"><Briefcase className="h-4 w-4 text-secondary" /> Core Business</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                {startup.coreBusinessOverview || <span className="text-slate-300">Not added yet.</span>}
              </p>
            </div>

            <div className="ost-card p-6">
              <h3 className="ost-card-title flex items-center gap-2"><Cpu className="h-4 w-4 text-secondary" /> Core IP/ Technology</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                {startup.coreIpTechnology || <span className="text-slate-300">Not added yet.</span>}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="ost-card p-6">
              <h3 className="ost-card-title flex items-center gap-2"><TrendingUp className="h-4 w-4 text-secondary" /> Traction &amp; previous funding</h3>
              <div className="mt-3">
                <Field label="Total revenues since founding year" value={startup.totalRevenueSinceFounding != null ? formatMoney(startup.totalRevenueSinceFounding) : null} />
                <Field label="Total investments raised" value={startup.amountRaised != null ? formatMoney(startup.amountRaised) : null} />
                <Field label="Total Grants" value={startup.totalGrants != null ? formatMoney(startup.totalGrants) : null} />
              </div>
            </div>

            <div className="ost-card p-6">
              <h3 className="ost-card-title flex items-center gap-2"><Handshake className="h-4 w-4 text-secondary" /> Round Details</h3>
              <div className="mt-3">
                <Field label="Total Round Size" value={startup.totalRoundSize != null ? formatMoney(startup.totalRoundSize) : null} />
                <Field label="Round terms" value={startup.roundTerms} />
                <Field label="Last Valuation" value={startup.lastValuation != null ? formatMoney(startup.lastValuation) : null} />
              </div>
            </div>

            <div className="ost-card p-6">
              <h3 className="ost-card-title flex items-center gap-2"><Users className="h-4 w-4 text-secondary" /> Team</h3>
              <div className="mt-3">
                <Field label="Founders (number)" value={String(founderCount)} />
                <Field label="Full-Time Employees (counting founders)" value={String(fullTimeCount)} />
              </div>
              <p className="mt-2 text-xs text-slate-400">Counted from your Team tab roster.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="ost-card p-6">
              <h3 className="ost-card-title flex items-center gap-2"><Globe2 className="h-4 w-4 text-secondary" /> Impact Metrics</h3>
              <div className="mt-3">
                <Field label="SDGs Addressed" value={startup.sdgsAddressed && startup.sdgsAddressed.length > 0 ? startup.sdgsAddressed.join(", ") : null} />
                <Field label="Number of female team members" value={startup.femaleTeamMembers != null ? String(startup.femaleTeamMembers) : null} />
                <Field label="Number of Youth employees" value={startup.youthEmployees != null ? String(startup.youthEmployees) : null} />
              </div>
            </div>

            <div className="ost-card p-6">
              <h3 className="ost-card-title flex items-center gap-2"><Globe2 className="h-4 w-4 text-secondary" /> Markets</h3>
              <div className="mt-3">
                <Field label="Country of Incorporation" value={startup.countryOfIncorporation} />
                <Field label="Customer Base" value={startup.customerBase ? CUSTOMER_BASE_LABELS[startup.customerBase] : null} />
                <Field label="Countries of Operation" value={startup.countriesOfOperation} />
              </div>
            </div>

            <CapTableCard entries={capTable} total={capTableTotal} />
          </div>
        </div>
      )}

      {editing && startup && <StartupProfileEditModal startup={startup} onClose={() => setEditing(false)} />}
    </div>
  );
}

function CapTableCard({ entries, total }: { entries: CapTableEntryRow[]; total: number }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("");
  const [busy, setBusy] = useState(false);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !percentage) return;
    setBusy(true);
    try {
      await api("/api/cap-table", { method: "POST", body: JSON.stringify({ name, percentage: Number(percentage) }) });
      qc.invalidateQueries({ queryKey: ["cap-table"] });
      setName(""); setPercentage(""); setAdding(false);
    } catch (err: any) {
      showToast(err.message || "Couldn't add this entry");
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: string) {
    try {
      await api(`/api/cap-table/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["cap-table"] });
    } catch (err: any) {
      showToast(err.message || "Couldn't remove this entry");
    }
  }

  return (
    <div className="ost-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="ost-card-title flex items-center gap-2"><PieChart className="h-4 w-4 text-secondary" /> Cap Table</h3>
        <button onClick={() => setAdding((a) => !a)} className="ost-btn-ghost !px-2.5 !py-1 text-xs"><Plus className="h-3.5 w-3.5" /> Add</button>
      </div>

      {adding && (
        <form onSubmit={addEntry} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 p-3">
          <input className="ost-input flex-1" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" min={0} max={100} className="ost-input w-24" placeholder="%" value={percentage} onChange={(e) => setPercentage(e.target.value)} />
          <button type="submit" disabled={busy} className="ost-btn-primary !px-3 !py-1.5 text-xs">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</button>
        </form>
      )}

      <div className="mt-3">
        {entries.length === 0 ? (
          <p className="ost-card-subtext">No cap table entries yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="group flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
              <span className="truncate text-sm font-semibold text-primary">{entry.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">{entry.percentage}%</span>
                <button onClick={() => removeEntry(entry.id)} className="text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))
        )}
        {entries.length > 0 && (
          <div className="flex items-center justify-between pt-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Total</span>
            <span className="text-sm font-extrabold text-primary">{total}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StartupProfileEditModal({ startup, onClose }: { startup: StartupProfile; onClose: () => void }) {
  const qc = useQueryClient();
  const [legalEntityStatus, setLegalEntityStatus] = useState(startup.legalEntityStatus ?? "");
  const [startedYear, setStartedYear] = useState(startup.startedYear ? String(startup.startedYear) : "");
  const [country, setCountry] = useState(startup.country ?? "");
  const [businessModelType, setBusinessModelType] = useState(startup.businessModelType ?? "");
  const [dataRoomLink, setDataRoomLink] = useState(startup.dataRoomLink ?? "");
  const [coreBusinessOverview, setCoreBusinessOverview] = useState(startup.coreBusinessOverview ?? "");
  const [coreIpTechnology, setCoreIpTechnology] = useState(startup.coreIpTechnology ?? "");

  const [totalRevenueSinceFounding, setTotalRevenueSinceFounding] = useState(startup.totalRevenueSinceFounding != null ? String(startup.totalRevenueSinceFounding) : "");
  const [amountRaised, setAmountRaised] = useState(startup.amountRaised != null ? String(startup.amountRaised) : "");
  const [totalGrants, setTotalGrants] = useState(startup.totalGrants != null ? String(startup.totalGrants) : "");
  const [totalRoundSize, setTotalRoundSize] = useState(startup.totalRoundSize != null ? String(startup.totalRoundSize) : "");
  const [roundTerms, setRoundTerms] = useState(startup.roundTerms ?? "");
  const [lastValuation, setLastValuation] = useState(startup.lastValuation != null ? String(startup.lastValuation) : "");

  const [sdgsAddressed, setSdgsAddressed] = useState<string[]>(startup.sdgsAddressed ?? []);
  const [femaleTeamMembers, setFemaleTeamMembers] = useState(startup.femaleTeamMembers != null ? String(startup.femaleTeamMembers) : "");
  const [youthEmployees, setYouthEmployees] = useState(startup.youthEmployees != null ? String(startup.youthEmployees) : "");
  const [countryOfIncorporation, setCountryOfIncorporation] = useState(startup.countryOfIncorporation ?? "");
  const [customerBase, setCustomerBase] = useState(startup.customerBase ?? "");
  const [countriesOfOperation, setCountriesOfOperation] = useState(startup.countriesOfOperation ?? "");

  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/startups/${startup.id}/profile-overview`, {
        method: "PATCH",
        body: JSON.stringify({
          legalEntityStatus: legalEntityStatus || undefined,
          startedYear: startedYear ? Number(startedYear) : undefined,
          country,
          businessModelType: businessModelType || undefined,
          dataRoomLink,
          coreBusinessOverview,
          coreIpTechnology,
          totalRevenueSinceFounding: totalRevenueSinceFounding ? Number(totalRevenueSinceFounding) : undefined,
          amountRaised: amountRaised ? Number(amountRaised) : undefined,
          totalGrants: totalGrants ? Number(totalGrants) : undefined,
          totalRoundSize: totalRoundSize ? Number(totalRoundSize) : undefined,
          roundTerms,
          lastValuation: lastValuation ? Number(lastValuation) : undefined,
          sdgsAddressed,
          femaleTeamMembers: femaleTeamMembers ? Number(femaleTeamMembers) : undefined,
          youthEmployees: youthEmployees ? Number(youthEmployees) : undefined,
          countryOfIncorporation,
          customerBase: customerBase || undefined,
          countriesOfOperation,
        }),
      });
      qc.invalidateQueries({ queryKey: ["startup-me"] });
      showToast("Startup profile updated.");
      onClose();
    } catch (err: any) {
      showToast(err.message || "Couldn't save these changes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Edit startup profile" subtitle="Everything on this page, in one place" onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Startup Profile</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="ost-label">Legal Entity</label>
              <select className="ost-input" value={legalEntityStatus} onChange={(e) => setLegalEntityStatus(e.target.value as any)}>
                <option value="">Not set</option>
                <option value="yes">Yes</option>
                <option value="in_process">In the process</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="ost-label">Year of constitution</label>
              <input type="number" className="ost-input" value={startedYear} onChange={(e) => setStartedYear(e.target.value)} placeholder="e.g. 2022" min={1900} max={2100} />
            </div>
            <div>
              <label className="ost-label">Country</label>
              <input className="ost-input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
            </div>
            <div>
              <label className="ost-label">Business Model Type</label>
              <select className="ost-input" value={businessModelType} onChange={(e) => setBusinessModelType(e.target.value as any)}>
                <option value="">Not set</option>
                <option value="b2b">B2B</option>
                <option value="b2c">B2C</option>
                <option value="b2b2c">B2B2C</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="ost-label">Data Room link</label>
              <input type="url" className="ost-input" value={dataRoomLink} onChange={(e) => setDataRoomLink(e.target.value)} placeholder="https://" />
              <p className="mt-1 text-xs text-slate-400">Deck link and Website link are managed from your startup profile page.</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Core Business</h4>
          <p className="mt-1 text-xs text-slate-400">{CORE_BUSINESS_GUIDANCE}</p>
          <textarea className="ost-input mt-2 min-h-[110px]" maxLength={1600} value={coreBusinessOverview} onChange={(e) => setCoreBusinessOverview(e.target.value)} />
          <Counter value={coreBusinessOverview.length} max={1600} />
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Core IP/ Technology</h4>
          <p className="mt-1 text-xs text-slate-400">{CORE_IP_GUIDANCE}</p>
          <textarea className="ost-input mt-2 min-h-[110px]" maxLength={1600} value={coreIpTechnology} onChange={(e) => setCoreIpTechnology(e.target.value)} />
          <Counter value={coreIpTechnology.length} max={1600} />
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Traction &amp; previous funding</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="ost-label">Total revenues since founding year</label>
              <Money value={totalRevenueSinceFounding} onChange={setTotalRevenueSinceFounding} />
            </div>
            <div>
              <label className="ost-label">Total investments raised</label>
              <Money value={amountRaised} onChange={setAmountRaised} />
            </div>
            <div>
              <label className="ost-label">Total Grants</label>
              <Money value={totalGrants} onChange={setTotalGrants} />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Round Details</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="ost-label">Total Round Size</label>
              <Money value={totalRoundSize} onChange={setTotalRoundSize} />
            </div>
            <div>
              <label className="ost-label">Round terms</label>
              <input className="ost-input" value={roundTerms} onChange={(e) => setRoundTerms(e.target.value)} placeholder="e.g. SAFE, $500K cap" />
            </div>
            <div>
              <label className="ost-label">Last Valuation</label>
              <Money value={lastValuation} onChange={setLastValuation} />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Impact Metrics</h4>
          <div className="mt-3 space-y-3">
            <div>
              <label className="ost-label">SDGs Addressed</label>
              <MultiPills options={SDG_OPTIONS} value={sdgsAddressed} onChange={setSdgsAddressed} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="ost-label">Number of female team members</label>
                <input type="number" min={0} className="ost-input" value={femaleTeamMembers} onChange={(e) => setFemaleTeamMembers(e.target.value)} />
              </div>
              <div>
                <label className="ost-label">Number of Youth employees</label>
                <input type="number" min={0} className="ost-input" value={youthEmployees} onChange={(e) => setYouthEmployees(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Markets</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="ost-label">Country of Incorporation</label>
              <input className="ost-input" value={countryOfIncorporation} onChange={(e) => setCountryOfIncorporation(e.target.value)} />
            </div>
            <div>
              <label className="ost-label">Customer Base</label>
              <select className="ost-input" value={customerBase} onChange={(e) => setCustomerBase(e.target.value as any)}>
                <option value="">Not set</option>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="emerging_market">Emerging Market</option>
                <option value="saturated_market">Saturated Market</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="ost-label">Countries of Operation</label>
              <input className="ost-input" value={countriesOfOperation} onChange={(e) => setCountriesOfOperation(e.target.value)} placeholder="e.g. Uganda, Kenya, Tanzania" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ost-btn-ghost">Cancel</button>
          <button type="submit" disabled={busy} className="ost-btn-primary">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
