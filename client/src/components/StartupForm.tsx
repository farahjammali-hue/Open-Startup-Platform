import { useState, useRef, useEffect } from "react";
import { TagInput, Field } from "./fields";
import {
  LogoUpload, DeckUpload, Section, Counter, LinkInput, Pills, VideoRow,
} from "./StartupFormFields";
import { setNavDirty } from "../lib/navGuard";
import { STAGE_OPTIONS } from "../lib/stageLabels";
import { Loader2 } from "lucide-react";

/* ---------- option sets ---------- */

const OPTIONAL_LINKS = [
  { key: "facebook", label: "Facebook" },
  { key: "twitter", label: "X / Twitter" },
  { key: "github", label: "GitHub" },
  { key: "instagram", label: "Instagram" },
  { key: "telegram", label: "Telegram" },
  { key: "discord", label: "Discord" },
  { key: "snapchat", label: "Snapchat" },
  { key: "tiktok", label: "TikTok" },
  { key: "appleAppStore", label: "Apple App Store" },
  { key: "googlePlayStore", label: "Google Play Store" },
];

export interface StartupFormInitial {
  companyName?: string | null;
  shortDescription?: string | null;
  location?: string | null;
  markets?: string[] | null;
  stage?: string | null;
  website?: string | null;
  links?: Record<string, string> | null;
  productVideoUrl?: string | null;
  productVideoPrivate?: boolean | null;
  teamVideoUrl?: string | null;
  teamVideoPrivate?: boolean | null;
  deckUrl?: string | null;
  logoUrl?: string | null;
}

function isValidUrl(v: string): boolean {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

export function StartupForm({
  initial = {},
  submitLabel,
  onSubmit,
  onDiscard,
  serverError,
  startupId,
}: {
  initial?: StartupFormInitial;
  submitLabel: string;
  onSubmit: (payload: any) => Promise<void>;
  onDiscard?: () => void;
  serverError?: string | null;
  startupId?: string;
}) {
  const initLinks = initial.links || {};

  const [companyName, setCompanyName] = useState(initial.companyName || "");
  const [shortDescription, setShortDescription] = useState(initial.shortDescription || "");
  const [location, setLocation] = useState(initial.location || "");
  const [markets, setMarkets] = useState<string[]>(initial.markets || []);
  const [stage, setStage] = useState(initial.stage || "");
  const [website, setWebsite] = useState(initial.website || "");
  const [linkedin, setLinkedin] = useState(initLinks.linkedin || "");
  const [links, setLinks] = useState<Record<string, string>>(initLinks);
  const [productVideoUrl, setProductVideoUrl] = useState(initial.productVideoUrl || "");
  const [productVideoPrivate, setProductVideoPrivate] = useState(!!initial.productVideoPrivate);
  const [teamVideoUrl, setTeamVideoUrl] = useState(initial.teamVideoUrl || "");
  const [teamVideoPrivate, setTeamVideoPrivate] = useState(!!initial.teamVideoPrivate);
  const [deckUrl, setDeckUrl] = useState(initial.deckUrl || "");

  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl || null);
  const [logoFile, setLogoFile] = useState<Blob | null>(null);
  const [deckFile, setDeckFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const savedRef = useRef(false);

  // ---- unsaved-changes tracking ----
  const snapshot = JSON.stringify({
    companyName, shortDescription, location, markets, stage,
    website, linkedin, links, productVideoUrl, productVideoPrivate, teamVideoUrl,
    teamVideoPrivate, deckUrl,
  });
  const baselineRef = useRef<string | null>(null);
  if (baselineRef.current === null) baselineRef.current = snapshot;
  const dirty =
    (snapshot !== baselineRef.current || logoFile !== null || deckFile !== null) &&
    !savedRef.current;

  useEffect(() => {
    setNavDirty(dirty);
    return () => setNavDirty(false);
  }, [dirty]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);


  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!companyName.trim()) e.companyName = "Required";
    if (!shortDescription.trim()) e.shortDescription = "Required";
    if (!location.trim()) e.location = "Required";
    if (markets.length === 0) e.markets = "Add at least one market";
    if (!stage) e.stage = "Select a stage";
    if (!website.trim()) e.website = "Required";
    else if (!isValidUrl(website)) e.website = "Enter a valid URL (include https://)";
    if (!linkedin.trim()) e.linkedin = "LinkedIn URL is required";
    else if (!isValidUrl(linkedin)) e.linkedin = "Enter a valid URL";
    if (!deckUrl.trim() && !deckFile) e.deckUrl = "A pitch deck (PDF) is required";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const cleanedLinks: Record<string, string> = {};
    if (linkedin.trim()) cleanedLinks.linkedin = linkedin.trim();
    for (const f of OPTIONAL_LINKS) {
      const v = (links[f.key] || "").trim();
      if (v) cleanedLinks[f.key] = v;
    }
    const payload = {
      companyName,
      shortDescription,
      location,
      markets,
      stage,
      website,
      links: cleanedLinks,
      productVideoUrl,
      productVideoPrivate,
      teamVideoUrl,
      teamVideoPrivate,
      deckUrl,
    };
    setBusy(true);
    try {
      // Upload the staged logo (if any) before saving the rest.
      if (logoFile && startupId) {
        try {
          const form = new FormData();
          form.append("logo", logoFile, "logo.jpg");
          const res = await fetch(`/api/startups/${startupId}/logo`, {
            method: "POST",
            credentials: "include",
            body: form,
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.message || "Logo upload failed");
          }
        } catch (err: any) {
          setErrors((prev) => ({ ...prev, logo: err.message || "Logo upload failed" }));
          window.scrollTo({ top: 0, behavior: "smooth" });
          setBusy(false);
          return;
        }
      }
      // Upload the staged deck (PDF) if one was selected.
      if (deckFile && startupId) {
        try {
          const form = new FormData();
          form.append("deck", deckFile, "deck.pdf");
          const res = await fetch(`/api/startups/${startupId}/deck`, {
            method: "POST",
            credentials: "include",
            body: form,
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.message || "Deck upload failed");
          (payload as any).deckUrl = j.deckUrl;
        } catch (err: any) {
          setErrors((prev) => ({ ...prev, deckUrl: err.message || "Deck upload failed" }));
          window.scrollTo({ top: 0, behavior: "smooth" });
          setBusy(false);
          return;
        }
      }
      await onSubmit(payload);
      savedRef.current = true;
      setNavDirty(false);
    } finally {
      setBusy(false);
    }
  }

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {(errorCount > 0 || serverError) && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {serverError ||
            `Please fix ${errorCount} field${errorCount > 1 ? "s" : ""} marked below.`}
        </div>
      )}

      {/* Logo */}
      {startupId && (
        <Section title="Logo" hint="Applied when you click Save changes.">
          <LogoUpload
            preview={logoPreview}
            onPick={(blob, previewUrl) => {
              setLogoFile(blob);
              setLogoPreview(previewUrl);
            }}
          />
          {errors.logo && (
            <p className="mt-2 text-xs font-medium text-red-500">{errors.logo}</p>
          )}
        </Section>
      )}

      {/* About */}
      <Section title="About">
        <Field label="Company name" required error={errors.companyName}>
          <input
            className="ost-input"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Guepard"
          />
        </Field>
        <Field label="Short description" required error={errors.shortDescription}>
          <input
            className="ost-input"
            maxLength={300}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="One line on what you do"
          />
          <Counter value={shortDescription.length} max={300} />
        </Field>
        <Field label="Where are you located?" required error={errors.location}>
          <input
            className="ost-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City"
          />
        </Field>
        <Field label="What markets are you in?" required error={errors.markets}>
          <TagInput value={markets} onChange={setMarkets} placeholder="Type a market and press Enter (more is better)" />
        </Field>
        <Field label="What stage are you at?" required error={errors.stage}>
          <Pills options={STAGE_OPTIONS} value={stage} onChange={setStage} />
        </Field>
      </Section>

      {/* Links */}
      <Section title="Links">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website" required error={errors.website}>
            <LinkInput value={website} onChange={setWebsite} />
          </Field>
          <Field label="LinkedIn" required error={errors.linkedin}>
            <LinkInput value={linkedin} onChange={setLinkedin} />
          </Field>
          {OPTIONAL_LINKS.map((f) => (
            <Field key={f.key} label={f.label}>
              <LinkInput
                value={links[f.key] || ""}
                onChange={(v) => setLinks((p) => ({ ...p, [f.key]: v }))}
              />
            </Field>
          ))}
        </div>
      </Section>

      {/* Videos & deck */}
      <Section title="Videos & deck" hint="Keep videos to ~1 minute. Use the lock to keep a video private.">
        <VideoRow
          label="Product video"
          hint="Demonstrate the product/prototype in 1 minute or less."
          url={productVideoUrl}
          onUrl={setProductVideoUrl}
          isPrivate={productVideoPrivate}
          onPrivate={setProductVideoPrivate}
        />
        <VideoRow
          label="Team video"
          hint="Founders / team introduction in 1 minute or less."
          url={teamVideoUrl}
          onUrl={setTeamVideoUrl}
          isPrivate={teamVideoPrivate}
          onPrivate={setTeamVideoPrivate}
        />
        <Field label="Pitch deck" required error={errors.deckUrl}>
          <DeckUpload
            existingUrl={deckUrl}
            file={deckFile}
            disabled={!startupId}
            onPick={(f) => setDeckFile(f)}
          />
        </Field>
      </Section>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-6">
        {onDiscard && (
          <button
            type="button"
            onClick={() => {
              if (!dirty || window.confirm("Discard your changes and leave this page?")) {
                onDiscard();
              }
            }}
            className="ost-btn-ghost"
            disabled={busy}
          >
            Discard changes
          </button>
        )}
        <button type="submit" className="ost-btn-primary" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
