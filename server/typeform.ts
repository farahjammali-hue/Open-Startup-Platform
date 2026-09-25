import type { Express } from "express";
import crypto from "crypto";
import { storage } from "./storage";

/**
 * Typeform webhook for the KYC & Compliance form embedded in the founder's
 * KYS step (client/src/pages/contract-kys/KysStep.tsx).
 *
 * The form's first question is the founder's program (Pre-Seed / Seed), so the
 * platform no longer asks for it separately; this webhook reads that answer
 * and stores it as the KYS track, which decides which training sessions the
 * startup sees. Only the track is read: the form's other answers (bank
 * details, IDs, sanctions declarations) stay in Typeform and are never stored
 * here.
 *
 * Setup (Typeform: Connect > Webhooks): URL https://<APP_URL>/api/typeform/webhook
 * with a secret, and the same secret in TYPEFORM_WEBHOOK_SECRET. The form must
 * define the hidden fields startup_id and email, which KysStep fills in.
 */

export const KYS_TYPEFORM_ID = process.env.TYPEFORM_KYS_FORM_ID || "O7MQvYnR";

/** Typeform signs the raw body: header `Typeform-Signature: sha256=<base64 HMAC-SHA256>`. */
export function verifyTypeformSignature(rawBody: Buffer | string, header: string | undefined, secret: string): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("base64"),
  );
  const got = Buffer.from(header);
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

/** Map the program answer ("Pre-Seed Program", "Seed Program - Track 1", "Other") to a KYS track. */
export function trackFromAnswers(answers: any[]): "pre_seed" | "seed" | null {
  for (const a of answers ?? []) {
    const label: string = a?.choice?.label ?? "";
    if (/^\s*pre[\s-]?seed\b/i.test(label)) return "pre_seed";
    if (/^\s*seed\b/i.test(label)) return "seed";
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerTypeform(app: Express) {
  app.post("/api/typeform/webhook", async (req, res) => {
    try {
      const secret = process.env.TYPEFORM_WEBHOOK_SECRET || "";
      if (!secret) return res.status(503).json({ message: "Typeform webhook not configured" });
      const rawBody: Buffer | undefined = (req as any).rawBody;
      if (!rawBody || !verifyTypeformSignature(rawBody, req.get("Typeform-Signature"), secret)) {
        return res.status(401).json({ message: "Invalid Typeform signature" });
      }

      // From here on always 200: Typeform retries non-2xx responses, and a
      // response we can't use won't become usable on retry.
      const r = req.body?.form_response;
      if (req.body?.event_type !== "form_response" || r?.form_id !== KYS_TYPEFORM_ID) {
        return res.json({ ok: true, ignored: "not the KYS form" });
      }

      // Hidden fields come from the embed URL, so a founder could edit them.
      // The startup id is an unguessable UUID and must also match its owner's
      // email, so a response can only ever land on the submitter's own startup.
      const startupId = String(r.hidden?.startup_id ?? "");
      const email = String(r.hidden?.email ?? "").trim().toLowerCase();
      const startup = UUID_RE.test(startupId) ? await storage.getStartupById(startupId) : undefined;
      const owner = startup ? await storage.getUserById(startup.userId) : undefined;
      if (!startup || !owner || owner.email.toLowerCase() !== email) {
        console.warn(`[typeform] response ${r.token ?? "?"} has no matching startup; ignored`);
        return res.json({ ok: true, ignored: "no matching startup" });
      }

      const track = trackFromAnswers(r.answers);
      const existing = await storage.getKysProfile(startup.id);
      if (existing) {
        // The founder's page usually records the submission first; this only
        // fills in the track. Left unchanged for "Other" (an admin sets it).
        if (track) await storage.setKysTrack(existing.id, track);
      } else {
        // The page couldn't record it (closed early, network error): record
        // the submission from here so it still reaches the review queue.
        const profile = await storage.submitKysProfile(startup.id, { track, consentAccepted: true });
        await storage.addKysEvent({ kysProfileId: profile.id, startupId: startup.id, action: "submitted", actorId: owner.id });
      }
      console.log(`[typeform] KYS response for ${startup.companyName}: track ${track ?? "not given"}`);
      res.json({ ok: true });
    } catch (e) {
      console.error("[typeform] webhook error", e);
      res.status(500).json({ message: "Server error" });
    }
  });
}
