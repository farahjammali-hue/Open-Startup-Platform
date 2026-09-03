import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function CreateStartup() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const startup = await api<{ id: string }>("/api/startups", {
        method: "POST",
        body: JSON.stringify({ companyName, website }),
      });
      qc.invalidateQueries({ queryKey: ["startups"] });
      qc.invalidateQueries({ queryKey: ["startup-me"] });
      // Continue to the full profile for the new startup.
      navigate(`/startups/${startup.id}/edit`);
    } catch (err: any) {
      setError(err.message || "Couldn't create startup");
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <button
          onClick={() => navigate("/account")}
          className="mb-4 flex items-center gap-2 text-sm font-medium ost-back-link"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="ost-card max-w-[560px] p-8">
          <h1 className="ost-card-title text-xl">
            Add a new startup
          </h1>
          <p className="mt-2 ost-card-subtext">
            Start with the essentials. You'll fill in the full profile next.
          </p>

          {error && (
            <div className="mt-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            <div>
              <label className="ost-label">
                Startup name <span className="text-secondary">*</span>
              </label>
              <input
                className="ost-input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Cynoia"
                required
              />
            </div>
            <div>
              <label className="ost-label">
                Website <span className="text-secondary">*</span>
              </label>
              <input
                type="url"
                className="ost-input"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourstartup.com"
                required
              />
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="ost-btn-primary" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue to profile
              </button>
            </div>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
