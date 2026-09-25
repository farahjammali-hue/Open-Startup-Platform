import type { Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { storage } from "./storage";

/**
 * Adobe Acrobat Sign webhook for the Certifications & Undertakings declaration
 * (step 1 of Contract & KYS, embedded in DeclarationStep.tsx).
 *
 * The embedded form's ESIGN browser event only says "signed" — it carries no
 * document. To let founders and admins preview/download the signed PDF on the
 * platform, an account admin creates a webhook in Adobe Sign
 * (Account Settings > Webhooks) for "Agreement workflow completed" with
 * "Include signed documents" (and participant info) turned on, pointed at
 * https://<APP_URL>/api/adobe-sign/webhook.
 *
 * Authenticity: Adobe sends its application's client id in the
 * X-ADOBESIGN-CLIENTID header on both the registration GET and every POST.
 * We only accept requests whose header matches ADOBE_SIGN_WEBHOOK_CLIENT_ID,
 * and must echo the id back for Adobe to accept the webhook.
 *
 * Matching: the web form doesn't carry our startup id, so the signer is
 * matched by participant email -> platform user -> their startup. Founders
 * are told to sign with their account email; an unmatched signature is
 * logged and skipped (the founder's page still records "signed" via ESIGN,
 * only the stored PDF is missing).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DECLARATIONS_DIR = path.resolve(__dirname, "..", "uploads", "declarations");
fs.mkdirSync(DECLARATIONS_DIR, { recursive: true });

export function declarationFilePath(startupId: string): string {
  // startupId is a UUID from our own DB lookup (never raw client input here),
  // but normalize to the basename anyway so a crafted id can't escape the dir.
  return path.join(DECLARATIONS_DIR, `${path.basename(startupId)}.pdf`);
}

export function hasDeclarationFile(startupId: string): boolean {
  try {
    return fs.existsSync(declarationFilePath(startupId));
  } catch {
    return false;
  }
}

/** Every participant email in the agreement payload, lowercased. */
export function participantEmails(agreement: any): string[] {
  const out: string[] = [];
  for (const set of agreement?.participantSetsInfo?.participantSets ?? agreement?.participantSetsInfo ?? []) {
    for (const m of set?.memberInfos ?? []) {
      if (typeof m?.email === "string" && m.email) out.push(m.email.trim().toLowerCase());
    }
  }
  return out;
}

export function registerAdobeSign(app: Express) {
  const route = "/api/adobe-sign/webhook";

  // Adobe verifies the webhook URL with a GET carrying the client id; the
  // response must repeat it (header + body) or registration fails.
  app.get(route, (req, res) => {
    const clientId = process.env.ADOBE_SIGN_WEBHOOK_CLIENT_ID || "";
    const got = req.get("X-AdobeSign-ClientId") ?? "";
    if (!clientId || got !== clientId) return res.status(401).json({ message: "Unknown client id" });
    res.set("X-AdobeSign-ClientId", clientId).json({ xAdobeSignClientId: clientId });
  });

  app.post(route, async (req, res) => {
    try {
      const clientId = process.env.ADOBE_SIGN_WEBHOOK_CLIENT_ID || "";
      const got = req.get("X-AdobeSign-ClientId") ?? "";
      if (!clientId || got !== clientId) return res.status(401).json({ message: "Unknown client id" });
      res.set("X-AdobeSign-ClientId", clientId);

      // From here on always 2xx: Adobe retries (and eventually disables) a
      // webhook on repeated failures, and an unusable payload stays unusable.
      const body = req.body ?? {};
      const agreement = body.agreement ?? {};
      const eventOk =
        body.event === "AGREEMENT_WORKFLOW_COMPLETED" ||
        body.event === "AGREEMENT_ACTION_COMPLETED" ||
        agreement.status === "SIGNED";
      if (!eventOk) return res.json({ ok: true, ignored: "not a completed signature" });

      const emails = participantEmails(agreement);
      let startup: { id: string; companyName: string } | undefined;
      for (const email of emails) {
        const user = await storage.getUserByEmail(email);
        if (!user) continue;
        const list = await storage.getStartupsByUserId(user.id);
        if (list.length > 0) {
          startup = await storage.resolveActiveStartup(user);
          break;
        }
      }
      if (!startup) {
        console.warn(`[adobe-sign] signed agreement ${agreement.id ?? "?"} matched no startup (signers: ${emails.join(", ") || "none"})`);
        return res.json({ ok: true, ignored: "no matching startup" });
      }

      // "Include signed documents" puts the PDF in the payload as base64.
      const doc =
        body.signedDocumentInfo?.document ??
        agreement.signedDocumentInfo?.document ??
        null;
      if (typeof doc === "string" && doc.length > 0) {
        fs.writeFileSync(declarationFilePath(startup.id), Buffer.from(doc, "base64"));
      } else {
        console.warn(`[adobe-sign] agreement ${agreement.id ?? "?"} for ${startup.companyName} came without the signed document — check "Include signed documents" on the webhook`);
      }

      await storage.markDeclarationSigned(startup.id);
      console.log(`[adobe-sign] declaration signed for ${startup.companyName}${doc ? " (PDF stored)" : ""}`);
      res.json({ ok: true });
    } catch (e) {
      console.error("[adobe-sign] webhook error", e);
      // Still 2xx so Adobe doesn't disable the webhook over one bad payload.
      res.status(200).json({ ok: false });
    }
  });
}
