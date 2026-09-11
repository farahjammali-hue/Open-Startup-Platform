import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const apiKey = process.env.ANTHROPIC_API_KEY;

export const aiConfigured = !!apiKey;

if (!aiConfigured) {
  console.warn("[ai] ANTHROPIC_API_KEY not set — automatic session recaps are disabled.");
}

const client = apiKey ? new Anthropic({ apiKey }) : null;

/** Strips WebVTT cue numbers/timestamps, leaving speaker-labeled dialogue lines. */
export function vttToPlainText(vtt: string): string {
  return vtt
    .split(/\r?\n/)
    .filter((line) => line.trim() && line.trim() !== "WEBVTT" && !/^\d+$/.test(line.trim()) && !line.includes("-->"))
    .join("\n");
}

export interface SessionRecap {
  teamMembersPresence: string;
  pointsDiscussed: string;
  actionItems: string;
}

/** Truncated to stay well within a reasonable token budget for a single session's transcript. */
const MAX_TRANSCRIPT_CHARS = 20000;

export async function generateSessionRecap(transcriptText: string): Promise<SessionRecap> {
  if (!client) throw new Error("AI is not configured — add ANTHROPIC_API_KEY to enable this");

  const transcript = transcriptText.slice(0, MAX_TRANSCRIPT_CHARS);
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are summarizing a call transcript from a startup accelerator program (a mentorship or training session between a startup and their mentor/trainer). Read the transcript and produce a short recap.

Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{"teamMembersPresence": "...", "pointsDiscussed": "...", "actionItems": "..."}

- teamMembersPresence: who appears to have attended, based on speaker names in the transcript. One line, comma-separated. If names aren't identifiable, say "Not clear from the transcript".
- pointsDiscussed: 2-4 sentences summarizing the main topics discussed.
- actionItems: concrete next steps or action items mentioned or implied, as a short list (use "\\n" between items). If none were discussed, say "None noted".

Transcript:
"""
${transcript}
"""`,
      },
    ],
  });

  const block = message.content[0];
  const text = block.type === "text" ? block.text : "";
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  let parsed: Partial<SessionRecap>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI response wasn't valid JSON");
  }

  return {
    teamMembersPresence: parsed.teamMembersPresence || "Not clear from the transcript",
    pointsDiscussed: parsed.pointsDiscussed || "",
    actionItems: parsed.actionItems || "None noted",
  };
}
