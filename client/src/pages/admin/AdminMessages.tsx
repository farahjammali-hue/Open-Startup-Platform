import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { showToast } from "../../lib/toast";
import { PaperPlaneTilt as Send, CircleNotch as Loader2 } from "@phosphor-icons/react";

interface StartupOption {
  id: string;
  companyName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  kysTrack: "seed" | "pre_seed" | null;
}

type Audience = "cohort" | "startup";
type Track = "seed" | "pre_seed" | "all";

const TRACK_OPTIONS: { value: Track; label: string }[] = [
  { value: "all", label: "Every founder" },
  { value: "seed", label: "Seed track" },
  { value: "pre_seed", label: "Pre-seed track" },
];

export default function AdminMessages() {
  const { user } = useAuth();
  const { data } = useQuery<{ startups: StartupOption[] }>({
    queryKey: ["admin-startups"],
    queryFn: () => api("/api/admin/startups"),
  });
  const startups = data?.startups ?? [];

  const [audience, setAudience] = useState<Audience>("cohort");
  const [track, setTrack] = useState<Track>("all");
  const [startupId, setStartupId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [asSelf, setAsSelf] = useState(false);
  const [busy, setBusy] = useState(false);

  const cohortCount =
    track === "all" ? startups.length : startups.filter((s) => s.kysTrack === track).length;
  const selectedStartup = startups.find((s) => s.id === startupId);

  async function send() {
    if (!subject.trim() || !body.trim()) {
      showToast("Add a subject and a message before sending.");
      return;
    }
    if (audience === "startup" && !startupId) {
      showToast("Choose a startup to message.");
      return;
    }
    setBusy(true);
    try {
      const payload = { subject, body, asSelf };
      const result =
        audience === "cohort"
          ? await api<{ sent: number; total: number }>("/api/admin/messages/cohort", {
              method: "POST",
              body: JSON.stringify({ ...payload, track }),
            })
          : await api<{ sent: number; total: number }>(`/api/admin/messages/startup/${startupId}`, {
              method: "POST",
              body: JSON.stringify(payload),
            });
      if (result.total === 0) {
        showToast("No eligible recipients found — nothing was sent.");
      } else {
        showToast(`Sent to ${result.sent}/${result.total} recipient${result.total > 1 ? "s" : ""}.`);
        setSubject("");
        setBody("");
      }
    } catch (e: any) {
      showToast(e.message || "Couldn't send that message");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Message founders"
          subtitle="Email a whole cohort or a single startup, as the platform or from your own address."
        />

        <div className="mt-8 max-w-2xl space-y-6">
          <div className="ost-card space-y-5 p-6">
            <div>
              <label className="ost-label">Send to</label>
              <div className="mt-1.5 flex gap-2">
                <button
                  onClick={() => setAudience("cohort")}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                    audience === "cohort" ? "border-secondary bg-secondary/10 text-secondary" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  A cohort
                </button>
                <button
                  onClick={() => setAudience("startup")}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                    audience === "startup" ? "border-secondary bg-secondary/10 text-secondary" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  One startup
                </button>
              </div>
            </div>

            {audience === "cohort" ? (
              <div>
                <label className="ost-label">Cohort</label>
                <select className="ost-input" value={track} onChange={(e) => setTrack(e.target.value as Track)}>
                  {TRACK_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-400">
                  {cohortCount} founder{cohortCount === 1 ? "" : "s"} will receive this (active, verified accounts only).
                </p>
              </div>
            ) : (
              <div>
                <label className="ost-label">Startup</label>
                <select className="ost-input" value={startupId} onChange={(e) => setStartupId(e.target.value)}>
                  <option value="">Select a startup</option>
                  {startups.map((s) => (
                    <option key={s.id} value={s.id}>{s.companyName}</option>
                  ))}
                </select>
                {selectedStartup && (
                  <p className="mt-1.5 text-xs text-slate-400">
                    Goes to {selectedStartup.ownerName || "the founder"} ({selectedStartup.ownerEmail}).
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="ost-label">Subject</label>
              <input
                className="ost-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Office hours this Thursday"
                maxLength={200}
              />
            </div>

            <div>
              <label className="ost-label">Message</label>
              <textarea
                className="ost-input min-h-[160px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                maxLength={5000}
              />
            </div>

            <div>
              <label className="ost-label">Send as</label>
              <div className="mt-1.5 flex gap-2">
                <button
                  onClick={() => setAsSelf(false)}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-left text-sm font-semibold transition ${
                    !asSelf ? "border-secondary bg-secondary/10 text-secondary" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  Open Startup (platform)
                </button>
                <button
                  onClick={() => setAsSelf(true)}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-left text-sm font-semibold transition ${
                    asSelf ? "border-secondary bg-secondary/10 text-secondary" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {user?.name || "Me"}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {asSelf
                  ? `Shown as "${user?.name} via Open Startup" — replies land in your own inbox (${user?.email}).`
                  : "Shown as \"Open Startup\" — replies land in the shared platform inbox."}
              </p>
            </div>

            <button onClick={send} disabled={busy} className="ost-btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send message
            </button>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
