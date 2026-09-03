import { useState } from "react";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { OnboardingShell } from "../../components/OnboardingShell";
import { Loader2 } from "lucide-react";

export default function StartupBasics() {
  const [, navigate] = useLocation();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/startup/basics", {
        method: "POST",
        body: JSON.stringify({ companyName, website }),
      });
      navigate("/onboarding/survey");
    } catch (err: any) {
      setError(err.message || "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingShell
      step={2}
      title="Tell us about your startup"
      subtitle="Start with the essentials. You'll add the full profile next."
    >
      {error && (
        <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-5">
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
          <label className="ost-label">Website</label>
          <input
            type="url"
            className="ost-input"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourstartup.com"
          />
          <p className="mt-1 text-xs text-slate-400">
            Optional, but recommended. Include https://
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="ost-btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue to survey
          </button>
        </div>
      </form>
    </OnboardingShell>
  );
}
