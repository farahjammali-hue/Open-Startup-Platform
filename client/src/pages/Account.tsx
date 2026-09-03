import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { PasswordInput } from "../components/PasswordInput";
import { AvatarUpload } from "../components/AvatarUpload";
import { EmptyState } from "../components/EmptyState";
import { ModalShell } from "../components/ModalShell";
import { StatusBadge } from "../components/StatusBadge";
import { COUNTRIES } from "../lib/countries";
import { setNavDirty } from "../lib/navGuard";
import { showToast } from "../lib/toast";
import {
  Loader2, Plus, Pencil, Check, Building2, Trash2, Clock, MapPin, Mail, RotateCcw,
} from "lucide-react";

interface StartupLite {
  id: string; companyName: string; website: string | null;
  location: string | null; stage: string | null;
  deletionRequestedAt: string | null; logoUrl: string | null;
}
interface StartupsResponse { startups: StartupLite[]; activeStartupId: string | null; }
type Msg = { t: "ok" | "err"; m: string } | null;

export default function Account() {
  const { user, refresh } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data } = useQuery<StartupsResponse>({
    queryKey: ["startups"], queryFn: () => api("/api/startups"),
  });

  const emailChange =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("emailChange")
      : null;

  /* ---- profile ---- */
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [age, setAge] = useState(user?.age ? String(user.age) : "");
  const [country, setCountry] = useState(user?.country || "");
  const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [profMsg, setProfMsg] = useState<Msg>(null);
  const [profBusy, setProfBusy] = useState(false);

  // Unsaved-changes tracking for the profile form.
  const dirty =
    firstName !== (user?.firstName || "") ||
    lastName !== (user?.lastName || "") ||
    age !== (user?.age ? String(user.age) : "") ||
    country !== (user?.country || "") ||
    avatarFile !== null;

  useEffect(() => {
    setNavDirty(dirty);
    return () => setNavDirty(false);
  }, [dirty]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function discardProfile() {
    setFirstName(user?.firstName || "");
    setLastName(user?.lastName || "");
    setAge(user?.age ? String(user.age) : "");
    setCountry(user?.country || "");
    setAvatarFile(null);
    setAvatarPreview(user?.avatarUrl || null);
    setProfMsg(null);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfMsg(null); setProfBusy(true);
    try {
      if (avatarFile) {
        const form = new FormData();
        form.append("avatar", avatarFile, "avatar.jpg");
        const res = await fetch("/api/account/avatar", {
          method: "POST", credentials: "include", body: form,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || "Photo upload failed");
        }
        setAvatarFile(null);
      }
      await api("/api/account", {
        method: "PATCH",
        body: JSON.stringify({
          firstName, lastName,
          age: age === "" ? undefined : Number(age),
          country,
        }),
      });
      await refresh();
      setProfMsg({ t: "ok", m: "Profile updated." });
    } catch (err: any) {
      setProfMsg({ t: "err", m: err.message || "Couldn't update" });
    } finally { setProfBusy(false); }
  }

  /* ---- email change ---- */
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<Msg>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null); setEmailBusy(true);
    try {
      const r = await api<{ emailSent: boolean }>("/api/account/email", {
        method: "POST", body: JSON.stringify({ newEmail }),
      });
      setNewEmail("");
      setEmailMsg({
        t: "ok",
        m: r.emailSent
          ? `Confirmation link sent to ${newEmail}. Your email changes once you click it.`
          : "Email isn't configured, so the confirmation link was printed in the app console.",
      });
    } catch (err: any) {
      setEmailMsg({ t: "err", m: err.message || "Couldn't start email change" });
    } finally { setEmailBusy(false); }
  }

  /* ---- password ---- */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [pwBusy, setPwBusy] = useState(false);
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmNew) {
      setPwMsg({ t: "err", m: "New passwords don't match." });
      return;
    }
    setPwBusy(true);
    try {
      await api("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword: confirmNew }),
      });
      setCurrentPassword(""); setNewPassword(""); setConfirmNew("");
      setPwMsg({ t: "ok", m: "Password changed. A confirmation email was sent." });
    } catch (err: any) {
      setPwMsg({ t: "err", m: err.message || "Couldn't change password" });
    } finally { setPwBusy(false); }
  }

  /* ---- startups ---- */
  async function activate(id: string) {
    try {
      await api(`/api/startups/${id}/activate`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["startups"] });
      qc.invalidateQueries({ queryKey: ["startup-me"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't switch to this startup");
    }
  }
  async function cancelDeletion(id: string) {
    try {
      await api(`/api/startups/${id}/cancel-deletion`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["startups"] });
      qc.invalidateQueries({ queryKey: ["startup-me"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't cancel the deletion request");
    }
  }
  const [delTarget, setDelTarget] = useState<StartupLite | null>(null);
  const [delReason, setDelReason] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  async function confirmDeletion() {
    if (!delTarget) return;
    setDelBusy(true);
    try {
      await api(`/api/startups/${delTarget.id}/request-deletion`, {
        method: "POST", body: JSON.stringify({ reason: delReason }),
      });
      qc.invalidateQueries({ queryKey: ["startups"] });
      qc.invalidateQueries({ queryKey: ["startup-me"] });
      setDelTarget(null); setDelReason("");
    } catch (e: any) {
      showToast(e.message || "Couldn't send the deletion request");
    } finally { setDelBusy(false); }
  }

  const startups = data?.startups ?? [];

  return (
    <AppShell>
      <main className="ost-page">
        <span className="ost-eyebrow">Settings</span>
        <h1 className="mt-2 ost-page-title">Account settings</h1>
        <p className="mt-2 ost-page-subtext">Manage your details, login, and startups.</p>

        {emailChange === "done" && (
          <div className="mt-6 rounded-lg border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm font-medium text-secondary-700">
            Your email address was updated successfully.
          </div>
        )}
        {emailChange === "expired" && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            That email confirmation link expired. Please request the change again.
          </div>
        )}
        {emailChange === "taken" && (
          <div className="mt-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            That email was taken before you confirmed. Try a different address.
          </div>
        )}

        {/* Profile */}
        <section className="ost-card mt-8 max-w-[640px] p-8">
          <h2 className="text-lg font-bold text-primary">Profile</h2>
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <AvatarUpload
              preview={avatarPreview}
              onPick={(blob, url) => { setAvatarFile(blob); setAvatarPreview(url); }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="ost-label">First name</label>
                <input className="ost-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="ost-label">Last name</label>
                <input className="ost-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="ost-label">Age</label>
                <input type="number" min={13} max={120} className="ost-input" value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div>
                <label className="ost-label">Country</label>
                <select className="ost-input" value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {profMsg && <p className={`text-sm font-medium ${profMsg.t === "ok" ? "text-secondary" : "text-red-500"}`}>{profMsg.m}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={discardProfile} disabled={!dirty || profBusy} className="ost-btn-ghost disabled:opacity-40">
                Discard
              </button>
              <button className="ost-btn-primary" disabled={profBusy}>
                {profBusy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
              </button>
            </div>
          </form>
        </section>

        {/* Email */}
        <section className="ost-card mt-6 max-w-[640px] p-8">
          <h2 className="text-lg font-bold text-primary">Email</h2>
          <p className="mt-1 text-sm text-slate-500">
            Current: <span className="font-medium text-primary">{user?.email}</span>
            {user?.pendingEmail && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                <Clock className="h-3 w-3" /> Pending: {user.pendingEmail}
              </span>
            )}
          </p>
          <form onSubmit={changeEmail} className="mt-4 space-y-4">
            <div>
              <label className="ost-label">New email</label>
              <input type="email" className="ost-input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" required />
              <p className="mt-1 text-xs text-slate-400">
                We'll send a confirmation link to the new address. Your email only changes once you click it.
              </p>
            </div>
            {emailMsg && <p className={`text-sm font-medium ${emailMsg.t === "ok" ? "text-secondary" : "text-red-500"}`}>{emailMsg.m}</p>}
            <div className="flex justify-end">
              <button className="ost-btn-primary" disabled={emailBusy}>
                {emailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send confirmation
              </button>
            </div>
          </form>
        </section>

        {/* Password */}
        <section className="ost-card mt-6 max-w-[640px] p-8">
          <h2 className="text-lg font-bold text-primary">Password</h2>
          <form onSubmit={savePassword} className="mt-4 space-y-4">
            <div>
              <label className="ost-label">Current password</label>
              <PasswordInput value={currentPassword} onChange={setCurrentPassword} placeholder="Leave blank if you signed up with Google" autoComplete="current-password" />
            </div>
            <div>
              <label className="ost-label">New password</label>
              <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" autoComplete="new-password" />
            </div>
            <div>
              <label className="ost-label">Confirm new password</label>
              <PasswordInput value={confirmNew} onChange={setConfirmNew} placeholder="Re-enter new password" autoComplete="new-password" />
              {confirmNew && newPassword !== confirmNew && (
                <p className="mt-1 text-xs font-medium text-red-500">Passwords don't match</p>
              )}
            </div>
            {pwMsg && <p className={`text-sm font-medium ${pwMsg.t === "ok" ? "text-secondary" : "text-red-500"}`}>{pwMsg.m}</p>}
            <div className="flex justify-end">
              <button className="ost-btn-primary" disabled={pwBusy}>
                {pwBusy && <Loader2 className="h-4 w-4 animate-spin" />} Update password
              </button>
            </div>
          </form>
        </section>

        {/* Startups */}
        <section id="startups" className="mt-12 scroll-mt-20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold ost-page-title">My startups</h2>
            {startups.length < 2 && (
              <button onClick={() => navigate("/startups/new")} className="ost-btn-secondary">
                <Plus className="h-4 w-4" /> New startup
              </button>
            )}
          </div>
          <div className="mt-4 space-y-4">
            {startups.map((s) => {
              const isActive = s.id === data?.activeStartupId;
              const pending = !!s.deletionRequestedAt;
              return (
                <div key={s.id} className="ost-card flex flex-wrap items-center justify-between gap-4 p-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {s.logoUrl ? (
                        <img src={s.logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
                      ) : (
                        <Building2 className="h-4 w-4 text-secondary" />
                      )}
                      <span className="font-bold text-primary">{s.companyName}</span>
                      {isActive && <span className="ost-chip"><Check className="h-3 w-3" /> Viewing</span>}
                      {pending && <StatusBadge tone="amber" icon={Clock}>Deletion pending</StatusBadge>}
                    </div>
                    {s.location && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="h-3 w-3" /> {s.location}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isActive && (
                      <button onClick={() => activate(s.id)} className="ost-btn-ghost py-1.5 text-xs">View</button>
                    )}
                    <button onClick={() => navigate(`/startups/${s.id}/edit`)} className="ost-btn-ghost py-1.5 text-xs">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    {pending ? (
                      <button onClick={() => cancelDeletion(s.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-secondary/40 px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-secondary/10">
                        <RotateCcw className="h-3.5 w-3.5" /> Cancel deletion
                      </button>
                    ) : (
                      <button onClick={() => setDelTarget(s)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> Request deletion
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {startups.length === 0 && (
              <EmptyState
                icon={Building2}
                title="You have no startups yet"
                description="Create your startup profile to start the program: sign your contract, complete your KYS, and unlock the dashboard."
                actionLabel="New startup"
                onAction={() => navigate("/startups/new")}
              />
            )}
          </div>
        </section>
      </main>

      {delTarget && (
        <ModalShell maxWidth="max-w-md" scrollable={false}>
            <h3 className="text-lg font-bold text-primary">Request deletion of {delTarget.companyName}?</h3>
            <p className="mt-2 text-sm text-slate-500">
              Startups can only be deleted with admin approval. This sends a request to the OST team — nothing is removed until they approve it. You can cancel the request anytime before then.
            </p>
            <label className="ost-label mt-4">Reason (optional)</label>
            <textarea className="ost-input min-h-[80px] resize-y" value={delReason} onChange={(e) => setDelReason(e.target.value)} placeholder="Tell the admin why you'd like this removed" />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDelTarget(null)} className="ost-btn-ghost">Cancel</button>
              <button onClick={confirmDeletion} disabled={delBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60">
                {delBusy && <Loader2 className="h-4 w-4 animate-spin" />} Send request
              </button>
            </div>
        </ModalShell>
      )}
    </AppShell>
  );
}
