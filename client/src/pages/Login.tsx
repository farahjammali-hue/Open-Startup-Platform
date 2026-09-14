import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/utils";
import { BrandPanel, Logo } from "../components/Brand";
import { ReCaptcha } from "../components/ReCaptcha";
import { PasswordInput } from "../components/PasswordInput";
import { COUNTRIES } from "../lib/countries";
import { CircleNotch as Loader2, CheckCircle as CheckCircle2 } from "@phosphor-icons/react";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");

  // login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // register fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const urlError = params.get("error");
  const verifyState = params.get("verify");
  const justVerified = params.get("verified") === "1";

  useEffect(() => {
    api<{ recaptchaSiteKey: string | null }>("/api/config")
      .then((c) => setSiteKey(c.recaptchaSiteKey))
      .catch(() => setSiteKey(null));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      if (siteKey && !captchaToken) {
        setError("Please complete the captcha below.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({
          firstName,
          lastName,
          age: Number(age),
          country,
          email,
          password,
          confirmPassword,
          captchaToken: captchaToken || undefined,
        });
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ost-canvas flex min-h-screen">
      <BrandPanel />

      <div className="brand-tokens-root flex flex-1 items-center justify-center px-6 py-12">
        <div className="card w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <span className="eyebrow">Open Startup</span>
          <h2 className="mt-1">
            {mode === "login" ? "Welcome" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
            {mode === "login"
              ? "Sign in to your Open Startup workspace."
              : "Join the Open Startup platform."}
          </p>

          {justVerified && (
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm font-medium text-secondary-700">
              <CheckCircle2 className="h-4 w-4" /> Email verified — you can sign in now.
            </div>
          )}
          {verifyState === "expired" && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              That verification link expired. Sign in and we'll send a fresh one.
            </div>
          )}
          {(error || urlError) && (
            <div className="mt-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error ||
                (urlError === "google_unconfigured"
                  ? "Google login isn't set up yet."
                  : "Google sign-in didn't complete. Try again.")}
            </div>
          )}

          <a
            href="/api/auth/google"
            className="btn btn--secondary mt-6 flex w-full items-center justify-center gap-3"
          >
            <GoogleIcon />
            Continue with Google
          </a>

          <div className="my-6 flex items-center gap-3 text-xs font-medium" style={{ color: "var(--text-3)" }}>
            <span className="h-px flex-1" style={{ background: "var(--border)" }} />
            OR
            <span className="h-px flex-1" style={{ background: "var(--border)" }} />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">First name</label>
                    <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Last name</label>
                    <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Age</label>
                    <input type="number" min={13} max={120} className="input" value={age} onChange={(e) => setAge(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Country</label>
                    <select className="input" value={country} onChange={(e) => setCountry(e.target.value)} required>
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@startup.com"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
            </div>
            {mode === "register" && (
              <div>
                <label className="label">Confirm password</label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-xs font-medium" style={{ color: "var(--danger)" }}>Passwords don't match</p>
                )}
              </div>
            )}

            {mode === "register" && siteKey && (
              <ReCaptcha siteKey={siteKey} onChange={setCaptchaToken} />
            )}

            <button type="submit" className="btn btn--primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: "var(--text-2)" }}>
            {mode === "login" ? (
              <>
                New to Open Startup?{" "}
                <button className="font-semibold hover:underline" style={{ color: "var(--info)" }} onClick={() => { setMode("register"); setError(null); }}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="font-semibold hover:underline" style={{ color: "var(--info)" }} onClick={() => { setMode("login"); setError(null); }}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.6 5.6C41.4 36.4 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
