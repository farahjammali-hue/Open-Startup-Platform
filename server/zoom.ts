import crypto from "crypto";
import "dotenv/config";

const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_WEBHOOK_SECRET_TOKEN } = process.env;

export const zoomConfigured = !!(ZOOM_ACCOUNT_ID && ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET);

if (!zoomConfigured) {
  console.warn("[zoom] ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET not set — Zoom recording sync is disabled.");
}

/** A Zoom meeting join link always embeds the numeric meeting ID after /j/. */
export function parseZoomMeetingId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/j\/(\d+)/);
  return match ? match[1] : null;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Server-to-Server OAuth token, cached in memory until shortly before it expires. */
export async function getZoomAccessToken(): Promise<string> {
  if (!zoomConfigured) throw new Error("Zoom is not configured");
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const basic = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` } },
  );
  if (!res.ok) {
    throw new Error(`Zoom token request failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

/** Zoom signs each webhook: v0=HMAC_SHA256("v0:{timestamp}:{rawBody}", secret). */
export function verifyZoomWebhookSignature(rawBody: string, timestamp: string, signature: string): boolean {
  if (!ZOOM_WEBHOOK_SECRET_TOKEN) return false;
  const expected =
    "v0=" +
    crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET_TOKEN).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Zoom's webhook challenge, sent once when the webhook URL is first saved. */
export function respondToZoomUrlValidation(plainToken: string) {
  if (!ZOOM_WEBHOOK_SECRET_TOKEN) throw new Error("ZOOM_WEBHOOK_SECRET_TOKEN is not configured");
  const encryptedToken = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET_TOKEN).update(plainToken).digest("hex");
  return { plainToken, encryptedToken };
}

/** Downloads a Zoom recording asset (needs the short-lived download_token from the webhook payload). */
export async function downloadZoomRecordingFile(downloadUrl: string, downloadToken: string): Promise<Buffer> {
  const res = await fetch(`${downloadUrl}?access_token=${downloadToken}`);
  if (!res.ok) throw new Error(`Zoom file download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
