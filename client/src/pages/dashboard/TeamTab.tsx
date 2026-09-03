import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { EmptyState } from "../../components/EmptyState";
import { showToast } from "../../lib/toast";
import { Plus, Loader2, Users } from "lucide-react";
import type { TeamMemberRow } from "./types";

export function TeamTab({ team }: { team: TeamMemberRow[] }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState<TeamMemberRow["type"]>("full_time");
  const [busy, setBusy] = useState(false);

  const founders = team.filter((t) => t.type === "founder");
  const members = team.filter((t) => t.type === "full_time" || t.type === "part_time");
  const advisors = team.filter((t) => t.type === "advisor");

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/team", { method: "POST", body: JSON.stringify({ name, role, type }) });
      qc.invalidateQueries({ queryKey: ["team"] });
      setName(""); setRole(""); setAdding(false);
    } catch (e: any) {
      showToast(e.message || "Couldn't add this team member");
    } finally {
      setBusy(false);
    }
  }

  if (team.length === 0 && !adding) {
    return (
      <EmptyState
        icon={Users}
        title="No team members yet"
        description="Add founders, full-time and part-time members, and advisors to keep your roster current for the program."
        actionLabel="Add member"
        onAction={() => setAdding(true)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {[{ title: "Founders", rows: founders }, { title: "Team members", rows: members }, { title: "Advisors", rows: advisors }].map((group) => (
        <div key={group.title} className="ost-card p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="ost-card-title">{group.title}</h2>
            {group.title === "Team members" && (
              <button onClick={() => setAdding((a) => !a)} className="ost-btn-ghost !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add member</button>
            )}
          </div>
          {group.title === "Team members" && adding && (
            <form onSubmit={addMember} className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 p-4">
              <input className="ost-input flex-1" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="ost-input flex-1" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
              <select className="ost-input" value={type} onChange={(e) => setType(e.target.value as TeamMemberRow["type"])}>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="advisor">Advisor</option>
                <option value="founder">Founder</option>
              </select>
              <button type="submit" className="ost-btn-primary !px-3 !py-1.5 text-xs" disabled={busy}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</button>
            </form>
          )}
          {group.rows.length === 0 ? (
            <p className="ost-card-subtext">Nobody added yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead><tr className="text-slate-400"><th className="pb-2 pr-4 font-semibold">Name</th><th className="pb-2 pr-4 font-semibold">Role</th><th className="pb-2 pr-4 font-semibold">Joined</th></tr></thead>
              <tbody>
                {group.rows.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="py-2 pr-4 font-semibold text-primary">{m.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{m.role}</td>
                    <td className="py-2 pr-4 text-slate-400">{new Date(m.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
