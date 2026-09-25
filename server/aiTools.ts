import { z } from "zod";
import { storage } from "./storage";
import { readTranscriptFile, vttToPlainText } from "./transcripts";

/**
 * The data lookups (and one narrow write) exposed through the Claude
 * connector (server/mcp.ts). Every read maps to an existing storage query that
 * already excludes admin demo startups and never touches document/contract
 * file contents, so anything reachable here is data an admin can already see
 * in the platform. The only write, save_session_recap, fills a mentorship
 * session's six recap fields and nothing else.
 */

export const RECAP_WRITE_SCOPE = "recaps:write";

export interface AiToolDef {
  name: string;
  description: string;
  /** false only for tools that change platform data. */
  readOnly: boolean;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/** Who is calling and what their connection was approved for. */
export interface AiToolContext {
  userEmail: string;
  scopes: string[];
}

const TRACK = { type: "string", enum: ["seed", "pre_seed"], description: "Omit for every track." };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Long transcripts are rare, but one runaway file shouldn't flood a chat.
const MAX_TRANSCRIPT_CHARS = 400_000;

const RECAP_FIELDS = {
  teamMembersPresence: "Who attended, one line, comma-separated. If names aren't identifiable: \"Not clear from the transcript\".",
  progressHighlights:
    "Progress / highlights: factual startup updates (milestones, partnerships, pilots, customers, funding, product progress, measurable traction).",
  mentorComments: "Mentor comments: strategic guidance, recommendations and feedback the mentor gave.",
  needsHighlighted: "Needs highlighted: support required, introductions needed, blockers, risks, follow-up topics.",
  nextMeetingCheckIns: "To check next meeting: specific items to review at the next check-in.",
  actionItemsForOst: "Action items for Open Startup: concrete actions the Open Startup team committed to (intros, documents, support).",
} as const;

const saveRecapInput = z.object({
  sessionId: z.string().regex(UUID, "sessionId must come from list_mentorship_sessions"),
  teamMembersPresence: z.string().trim().min(1).max(1000),
  progressHighlights: z.string().trim().min(1).max(6000),
  mentorComments: z.string().trim().min(1).max(6000),
  needsHighlighted: z.string().trim().min(1).max(6000),
  nextMeetingCheckIns: z.string().trim().min(1).max(6000),
  actionItemsForOst: z.string().trim().min(1).max(6000),
  overwrite: z.boolean().optional(),
});

export const AI_TOOLS: AiToolDef[] = [
  {
    name: "list_startups",
    readOnly: true,
    description:
      "List every real startup in the program with its founder's name and email, location, stage, KYS track, " +
      "KYS and contract review status, assigned mentor and trainer. Use this to find a startup's id or a " +
      "founder's contact details.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_startup_profile",
    readOnly: true,
    description:
      "Get one startup's qualitative profile (description, location, markets, stage, track, team size, " +
      "contract/KYS status) by id. Never returns document/file contents.",
    parameters: { type: "object", properties: { startupId: { type: "string" } }, required: ["startupId"] },
  },
  {
    name: "count_startups",
    readOnly: true,
    description: "Count how many real startups are in the program, optionally filtered to one KYS track.",
    parameters: { type: "object", properties: { track: TRACK }, required: [] },
  },
  {
    name: "startup_metric_summary",
    readOnly: true,
    description: "Sum a numeric metric (valuation, amount raised, or total revenue) across startups, optionally filtered to one track.",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["lastValuation", "amountRaised", "totalRevenueSinceFounding"] },
        track: TRACK,
      },
      required: ["metric"],
    },
  },
  {
    name: "average_team_size",
    readOnly: true,
    description: "Average team size across every startup in the program.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_startups_by_track",
    readOnly: true,
    description: "List startup company names and stage for one KYS track.",
    parameters: {
      type: "object",
      properties: { track: { type: "string", enum: ["seed", "pre_seed"] } },
      required: ["track"],
    },
  },
  {
    name: "list_startups_needing_attention",
    readOnly: true,
    description: "List startups whose latest quarterly update is flagged at-risk/off-track, or that asked for support.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_startups_with_pending_reviews",
    readOnly: true,
    description: "List startups with a Contract and/or KYS submission still awaiting admin review.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_mentorship_sessions",
    readOnly: true,
    description:
      "List mentorship sessions, newest first, with the startup, date, status, whether a Zoom transcript exists " +
      "(hasTranscript) and when a recap was saved (recapSavedAt, null if none). Set needsRecap to true to get " +
      "only sessions that have a transcript but no recap yet.",
    parameters: {
      type: "object",
      properties: {
        needsRecap: { type: "boolean" },
        startupId: { type: "string", description: "Only this startup's sessions (id from list_startups)." },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Default 20." },
      },
      required: [],
    },
  },
  {
    name: "get_session_transcript",
    readOnly: true,
    description: "Get the plain-text Zoom transcript of one mentorship session (speaker-labeled dialogue).",
    parameters: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] },
  },
  {
    name: "save_session_recap",
    readOnly: false,
    description:
      "Save the recap of one mentorship session to the platform, where the startup and admins see it. Base it " +
      "only on the session transcript (get_session_transcript). Use concise bullet points separated by \"\\n\" " +
      "within each field, and \"None noted\" for a section with nothing relevant. Show the user the recap and get " +
      "their OK before saving. Refuses to replace an existing recap unless overwrite is true, which requires the " +
      "user to have explicitly asked to replace it. This is the connector's only way to change data.",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        ...Object.fromEntries(Object.entries(RECAP_FIELDS).map(([k, description]) => [k, { type: "string", description }])),
        overwrite: { type: "boolean", description: "Replace an existing recap. Only when the user explicitly asked." },
      },
      required: ["sessionId", ...Object.keys(RECAP_FIELDS)],
    },
  },
];

export async function executeAiTool(name: string, input: any, ctx: AiToolContext): Promise<unknown> {
  switch (name) {
    case "list_startups":
      return (await storage.listStartupsWithOwners()).map((s) => ({
        id: s.id,
        companyName: s.companyName,
        founderName: s.ownerName,
        founderEmail: s.ownerEmail,
        website: s.website,
        location: s.location,
        stage: s.stage,
        track: s.kysTrack,
        kysStatus: s.kysStatus,
        contractStatus: s.contractStatus,
        mentor: s.mentorName,
        trainer: s.trainerName,
        deletionRequested: !!s.deletionRequestedAt,
      }));
    case "get_startup_profile": {
      const id = String(input?.startupId ?? "");
      if (!UUID.test(id)) return { error: "startupId must be a startup id from list_startups" };
      const profile = await storage.getStartupQualitativeProfile(id);
      return profile ?? { error: "No startup with that id" };
    }
    case "count_startups":
      return { count: await storage.countStartups(input?.track) };
    case "startup_metric_summary":
      return storage.startupMetricSummary(input?.metric, input?.track);
    case "average_team_size":
      return storage.averageTeamSize();
    case "list_startups_by_track":
      return storage.listStartupNamesByTrack(input?.track);
    case "list_startups_needing_attention":
      return storage.listStartupsNeedingAttention();
    case "list_startups_with_pending_reviews":
      return storage.listStartupsWithPendingReviews();

    case "list_mentorship_sessions": {
      const startupId = input?.startupId ? String(input.startupId) : undefined;
      if (startupId && !UUID.test(startupId)) return { error: "startupId must be a startup id from list_startups" };
      const limit = Math.min(Math.max(Number(input?.limit) || 20, 1), 100);
      const rows = await storage.listMentorshipSessionsForConnector({ needsRecap: input?.needsRecap === true, startupId, limit });
      return rows.map(({ transcriptUrl, ...row }) => ({ ...row, hasTranscript: !!transcriptUrl }));
    }

    case "get_session_transcript": {
      const sessionId = String(input?.sessionId ?? "");
      if (!UUID.test(sessionId)) return { error: "sessionId must come from list_mentorship_sessions" };
      const session = await storage.getMentorshipModuleSessionById(sessionId);
      if (!session) return { error: "No mentorship session with that id" };
      if (!session.transcriptUrl) return { error: "This session has no transcript yet" };
      const vtt = readTranscriptFile(session.transcriptUrl);
      if (!vtt) return { error: "The transcript file is missing on the server" };
      const text = vttToPlainText(vtt);
      return {
        sessionId,
        title: session.title,
        scheduledAt: session.scheduledAt,
        transcript: text.length > MAX_TRANSCRIPT_CHARS ? `${text.slice(0, MAX_TRANSCRIPT_CHARS)}\n[transcript truncated]` : text,
      };
    }

    case "save_session_recap": {
      if (!ctx.scopes.includes(RECAP_WRITE_SCOPE)) {
        return {
          error:
            "This connection is read-only. To let Claude save recaps, disconnect and reconnect the Platform " +
            "connector in Claude, then approve the updated permissions.",
        };
      }
      const parsed = saveRecapInput.safeParse(input);
      if (!parsed.success) {
        const issue = parsed.error.errors[0];
        return { error: `Invalid ${issue.path.join(".") || "input"}: ${issue.message}` };
      }
      const { sessionId, overwrite, ...recap } = parsed.data;
      const session = await storage.getMentorshipModuleSessionById(sessionId);
      if (!session) return { error: "No mentorship session with that id" };
      const existing = await storage.getMentorshipSessionNotes(sessionId, session.startupId);
      if (existing?.aiGeneratedAt && !overwrite) {
        return {
          error:
            "This session already has a recap (saved " + existing.aiGeneratedAt.toISOString() + "). Only set " +
            "overwrite to true if the user explicitly asked to replace it.",
        };
      }
      await storage.upsertMentorshipSessionNotes(sessionId, session.startupId, { ...recap, aiGeneratedAt: new Date() });
      console.log(`[mcp] ${ctx.userEmail} saved the recap for mentorship session ${sessionId}${existing?.aiGeneratedAt ? " (replaced)" : ""}`);
      return { ok: true, sessionId, title: session.title, replacedExisting: !!existing?.aiGeneratedAt };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
