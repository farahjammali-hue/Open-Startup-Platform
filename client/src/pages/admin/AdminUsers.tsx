import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { SkeletonRows } from "../../components/Skeleton";
import { showToast } from "../../lib/toast";

interface U {
  id: string; name: string; email: string; role: string | null;
  isActive: boolean; emailVerified: boolean; createdAt: string;
}
const ROLE: Record<string, string> = {
  admin: "Admin", startup: "Startup", mentor: "Mentor", investor: "Investor",
};

export default function AdminUsers() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ users: U[] }>({
    queryKey: ["admin-users"],
    queryFn: () => api("/api/admin/users"),
  });
  async function toggle(id: string) {
    try {
      await api(`/api/admin/users/${id}/toggle-active`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't update this user");
    }
  }
  const users = data?.users ?? [];

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader eyebrow="Administration" title="Users" subtitle={`${users.length} total`} />

        <div className="ost-card mt-8 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Verified</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={5} cols={6} />
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-semibold text-primary">{u.name}</td>
                    <td className="px-5 py-3 text-slate-500">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className="ost-chip">{u.role ? ROLE[u.role] || u.role : "—"}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{u.emailVerified ? "Yes" : "No"}</td>
                    <td className="px-5 py-3">
                      {u.isActive ? (
                        <span className="text-xs font-medium text-secondary">Active</span>
                      ) : (
                        <span className="text-xs font-medium text-red-500">Disabled</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => toggle(u.id)} className="ost-btn-ghost py-1.5 text-xs">
                        {u.isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
