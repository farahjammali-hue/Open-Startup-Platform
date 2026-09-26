/**
 * C2: one-way ops pings to the team's chat (Slack-compatible incoming
 * webhook — any URL that accepts {"text": "..."} JSON). Off unless
 * OPS_WEBHOOK_URL is set; always fire-and-forget, never throws, so a chat
 * outage can't break a platform action.
 */
export function postOps(text: string): void {
  const url = process.env.OPS_WEBHOOK_URL;
  if (!url) return;
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  })
    .then((res) => {
      if (!res.ok) console.error(`[notify] ops webhook answered ${res.status}`);
    })
    .catch((e) => console.error("[notify] ops webhook failed:", e?.message ?? e));
}
