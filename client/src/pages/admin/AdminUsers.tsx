import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { SkeletonRows } from "../../components/Skeleton";
import { showToast } from "../../lib/toast";
import { useAuth, type OnboardingStatus } from "../../lib/auth";

interface U {
  id: string; name: string; email: string; role: string | null;
  isActive: boolean; emailVerified: boolean; createdAt: string;
  onboardingStatus: OnboardingStatus;
  /** Whether their startup has submitted Contract & KYS — the post-approval
   * step onboardingStatus itself never reflects (it's stuck at "complete"
   * from the moment an admin approves them onward). */
  onboardingDone: boolean;
}
const ROLE: Record<string, string> = {
  admin: "Admin", startup: "Startup", mentor: "Mentor", investor: "Investor",
};

/**
 * Progress, not just active/disabled. Before approval, "needs_role" and
 * "needs_profile" both just mean "signed up, hasn't been reviewed yet" — one
 * label. After approval ("complete"), onboardingStatus can't tell "still
 * filling in Contract & KYS" from "fully active", so onboardingDone decides
 * that split instead.
 */
function statusLabel(u: U): { text: string; className: string } {
  if (!u.isActive) return { text: "Disabled", className: "text-red-500" };
  if (u.onboardingStatus === "pending_approval") {
    return { text: "Pending approval", className: "text-amber-600" };
  }
  if (u.onboardingStatus !== "complete") {
    return { text: "Account created", className: "text-slate-400" };
  }
  return u.onboardingDone
    ? { text: "Active", className: "text-secondary" }
    : { text: "Onboarding", className: "text-amber-600" };
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { data, isLoading } = useQuery<{ users: U[] }>({
    queryKey: ["admin-users"],
    queryFn: () => api("/api/admin/users"),
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function toggle(id: string) {
    try {
      await api(`/api/admin/users/${id}/toggle-active`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't update this user");
    }
  }

  // Testing-only super-admin action (server enforces who can actually use
  // it — see SUPER_ADMIN_EMAILS). Permanent and irreversible: erases the
  // user, their startup, and everything under it.
  async function deleteForever(u: U) {
    if (
      !confirm(
        `Permanently delete ${u.name} (${u.email}) and their startup? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(u.id);
    try {
      await api(`/api/admin/users/${u.id}/permanent`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this user");
    } finally {
      setDeletingId(null);
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
                      <span className={`text-xs font-medium ${statusLabel(u).className}`}>
                        {statusLabel(u).text}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => toggle(u.id)} className="ost-btn-ghost py-1.5 text-xs">
                          {u.isActive ? "Disable" : "Enable"}
                        </button>
                        {u.id !== me?.id && u.role !== "admin" && (
                          <button
                            onClick={() => deleteForever(u)}
                            disabled={deletingId === u.id}
                            className="ost-btn-ghost py-1.5 text-xs text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Permanently delete this user and their startup (testing only)"
                          >
                            {deletingId === u.id ? "Deleting…" : "Delete forever"}
                          </button>
                        )}
                      </div>
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
