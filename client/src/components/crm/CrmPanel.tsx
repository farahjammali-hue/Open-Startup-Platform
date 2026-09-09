import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";
import { Skeleton } from "../Skeleton";
import { TabBar } from "../PageHeader";
import { CRM_CATEGORIES, CRM_FIELDS, type CrmCategory, type CrmFieldDef } from "@shared/crmCatalog";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface CrmEntry {
  id: string;
  category: CrmCategory;
  name: string;
  type: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  introVia: string | null;
  lastContact: string | null;
  ctaStartup: string | null;
  ctaOst: string | null;
  howItHelps: string | null;
  contractValue: string | null;
  proof: string | null;
}

type DraftRow = CrmEntry & { isNew?: boolean };

const FIELD_MIN_WIDTH: Record<CrmFieldDef["key"], string> = {
  name: "min-w-[150px]",
  type: "min-w-[220px]",
  description: "min-w-[220px]",
  priority: "min-w-[110px]",
  status: "min-w-[180px]",
  introVia: "min-w-[140px]",
  lastContact: "min-w-[120px]",
  ctaStartup: "min-w-[200px]",
  ctaOst: "min-w-[200px]",
  howItHelps: "min-w-[200px]",
  contractValue: "min-w-[120px]",
  proof: "min-w-[180px]",
};

const CELL_INPUT_CLASS = "w-full border-0 bg-transparent px-2.5 py-2 text-xs text-primary outline-none focus:bg-secondary/5";

function blankRow(id: string, category: CrmCategory): DraftRow {
  return {
    id, category, name: "", type: null, description: null, priority: null, status: null,
    introVia: null, lastContact: null, ctaStartup: null, ctaOst: null, howItHelps: null,
    contractValue: null, proof: null, isNew: true,
  };
}

export function CrmPanel({ apiBase }: { apiBase: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ entries: CrmEntry[] }>({
    queryKey: ["crm-panel", apiBase],
    queryFn: () => api(apiBase),
  });

  const [activeCategory, setActiveCategory] = useState<CrmCategory>("investor");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setRows(data.entries.map((e) => ({ ...e })));
    setDirty(new Set());
  }, [data]);

  function addRow() {
    const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setRows((prev) => [...prev, blankRow(id, activeCategory)]);
    setDirty((prev) => new Set(prev).add(id));
  }

  function setField(id: string, key: CrmFieldDef["key"], value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setDirty((prev) => new Set(prev).add(id));
  }

  async function removeRow(row: DraftRow) {
    if (!row.isNew && !confirm(`Delete "${row.name || "this entry"}"? This can't be undone.`)) return;
    if (!row.isNew) {
      try {
        await api(`${apiBase}/${row.id}`, { method: "DELETE" });
      } catch (e: any) {
        showToast(e.message || "Couldn't delete this entry");
        return;
      }
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setDirty((prev) => {
      const next = new Set(prev);
      next.delete(row.id);
      return next;
    });
  }

  async function saveAll() {
    setSaving(true);
    let skipped = 0;
    try {
      for (const id of dirty) {
        const row = rows.find((r) => r.id === id);
        if (!row) continue;
        if (!row.name.trim()) { skipped++; continue; }
        const { id: _id, isNew, ...rawFields } = row;
        const fields = Object.fromEntries(Object.entries(rawFields).map(([k, v]) => [k, v ?? ""]));
        if (isNew) {
          await api(apiBase, { method: "POST", body: JSON.stringify(fields) });
        } else {
          await api(`${apiBase}/${id}`, { method: "PATCH", body: JSON.stringify(fields) });
        }
      }
      showToast(skipped > 0 ? `Saved (${skipped} row${skipped > 1 ? "s" : ""} need a name first)` : "Changes saved");
      qc.invalidateQueries({ queryKey: ["crm-panel", apiBase] });
    } catch (e: any) {
      showToast(e.message || "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const visibleRows = rows.filter((r) => r.category === activeCategory);
  const hasUnsaved = dirty.size > 0;
  const activeLabel = CRM_CATEGORIES.find((c) => c.key === activeCategory)?.label ?? "";

  return (
    <div>
      <TabBar
        tabs={CRM_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
        active={activeCategory}
        onChange={setActiveCategory}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Editable by both the founder and the OST team.</p>
        <button
          onClick={saveAll}
          disabled={!hasUnsaved || saving}
          className="ost-btn-primary !px-4 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </button>
      </div>

      <div className="ost-card overflow-hidden">
        {visibleRows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            No {activeLabel.toLowerCase()} yet. Add a row below to start tracking.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {CRM_FIELDS.map((f) => (
                    <th
                      key={f.key}
                      className={`border border-slate-200 bg-slate-50 px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${FIELD_MIN_WIDTH[f.key]} ${
                        f.key === "name" ? "sticky left-0 z-10" : ""
                      }`}
                    >
                      {f.label}
                    </th>
                  ))}
                  <th className="border border-slate-200 bg-slate-50 px-2.5 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    {CRM_FIELDS.map((f) => (
                      <td
                        key={f.key}
                        className={`border border-slate-200 p-0 ${f.key === "name" ? "sticky left-0 z-10 bg-white" : ""}`}
                      >
                        {f.kind === "select" ? (
                          <select
                            className={CELL_INPUT_CLASS}
                            aria-label={f.label}
                            value={row[f.key] ?? ""}
                            onChange={(e) => setField(row.id, f.key, e.target.value)}
                          >
                            <option value="">—</option>
                            {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : f.kind === "textarea" ? (
                          <textarea
                            className={`${CELL_INPUT_CLASS} resize-none`}
                            rows={1}
                            aria-label={f.label}
                            value={row[f.key] ?? ""}
                            onChange={(e) => setField(row.id, f.key, e.target.value)}
                          />
                        ) : (
                          <input
                            className={CELL_INPUT_CLASS}
                            aria-label={f.label}
                            value={row[f.key] ?? ""}
                            onChange={(e) => setField(row.id, f.key, e.target.value)}
                          />
                        )}
                      </td>
                    ))}
                    <td className="border border-slate-200 px-2 py-1.5 text-center">
                      <button
                        aria-label={`Delete ${row.name || "this entry"}`}
                        onClick={() => removeRow(row)}
                        className="ost-btn-ghost !p-1.5 text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-100 p-4">
          <button onClick={addRow} className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add {activeLabel.replace(/s$/, "")}
          </button>
        </div>
      </div>
    </div>
  );
}
