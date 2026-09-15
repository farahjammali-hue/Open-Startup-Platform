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
  progressHighlights: string;
  mentorComments: string;
  needsHighlighted: string;
  nextMeetingCheckIns: string;
  actionItemsForOst: string;
}

/** Truncated to stay well within a reasonable token budget for a single session's transcript. */
const MAX_TRANSCRIPT_CHARS = 20000;

export async function generateSessionRecap(transcriptText: string): Promise<SessionRecap> {
  if (!client) throw new Error("AI is not configured — add ANTHROPIC_API_KEY to enable this");

  const transcript = transcriptText.slice(0, MAX_TRANSCRIPT_CHARS);
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1536,
    messages: [
      {
        role: "user",
        content: `Please analyze the meeting transcript and extract the key points using the following structure. Focus only on relevant information discussed.

For each section, provide concise bullet points (use "\\n" between bullets within a section).

1. Progress / Highlights (Startup Updates)
Summarize factual updates shared by the startup, including: milestones achieved; partnerships, pilots, customers, or funding updates; product development progress; any measurable outcomes or traction.

2. Mentor Comments
Capture strategic guidance, recommendations, or feedback provided by the mentor during the meeting.

3. Needs Highlighted (Action Points / Risks / Follow-ups)
Identify clear needs expressed by the startup or risks discussed, including: support required; introductions needed; blockers or challenges; follow-up topics.

4. To Check in the Next Meeting
List specific items that should be reviewed or revisited during the next check-in.

5. Action Items for OST
List concrete actions the OST team committed to (introductions, documents, connections, support, etc.).

Also identify who appears to have attended, based on speaker names in the transcript.

Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{"teamMembersPresence": "...", "progressHighlights": "...", "mentorComments": "...", "needsHighlighted": "...", "nextMeetingCheckIns": "...", "actionItemsForOst": "..."}

- teamMembersPresence: one line, comma-separated. If names aren't identifiable, say "Not clear from the transcript".
- For each of the 5 sections, if nothing relevant was discussed, say "None noted".

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
    progressHighlights: parsed.progressHighlights || "None noted",
    mentorComments: parsed.mentorComments || "None noted",
    needsHighlighted: parsed.needsHighlighted || "None noted",
    nextMeetingCheckIns: parsed.nextMeetingCheckIns || "None noted",
    actionItemsForOst: parsed.actionItemsForOst || "None noted",
  };
}
