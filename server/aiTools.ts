import { z } from "zod";
import { storage } from "./storage";
import { readTranscriptFile, vttToPlainText } from "./transcripts";
import { ALL_METRIC_KEYS } from "@shared/metricsCatalog";
import { postOps } from "./notify";
import { sendAdminBroadcast } from "./mailer";
import { createMentorshipSessionCore, createTrainingSessionCore } from "./sessions";

/**
 * The data lookups (and one narrow write) exposed through the Claude
 * connector (server/mcp.ts). Every read maps to an existing storage query that
 * already excludes admin demo startups and never touches document/contract
 * file contents, so anything reachable here is data an admin can already see
 * in the platform. The only write, save_session_recap, fills a mentorship
 * session's six recap fields and nothing else.
 */

export const READ_SCOPE = "platform:read";
export const RECAP_WRITE_SCOPE = "recaps:write";
export const METRICS_WRITE_SCOPE = "metrics:write";
export const SESSIONS_WRITE_SCOPE = "sessions:write";
export const MESSAGES_WRITE_SCOPE = "messages:write";

/**
 * B1: the single source of truth for connector scopes. The OAuth server
 * derives everything from this list — what a new connection is granted, the
 * consent-page bullets, both discovery documents' scopes_supported, and the
 * "what can it change" sentence in the server instructions — so none of them
 * can drift from what the tools actually enforce. Adding a scope here (plus
 * requiredScope on its tools) is the whole wiring; existing connections keep
 * their old grant until the admin reconnects and re-approves.
 */
export const SCOPE_REGISTRY: { id: string; consent: string }[] = [
  { id: READ_SCOPE, consent: "Read startups, founders, tracks, metrics, review status and session transcripts" },
  { id: RECAP_WRITE_SCOPE, consent: "Save mentorship and training session recaps" },
  { id: METRICS_WRITE_SCOPE, consent: "Record a startup's monthly metrics (the same numbers founders type in)" },
  { id: SESSIONS_WRITE_SCOPE, consent: "Schedule mentorship and training sessions (with Zoom and calendar invites) and mark held ones completed" },
  { id: MESSAGES_WRITE_SCOPE, consent: "Email founders (a cohort or one startup) — every send previews first and needs an explicit confirm" },
];

export interface AiToolDef {
  name: string;
  description: string;
  /** false only for tools that change platform data. */
  readOnly: boolean;
  /** Write tools name the scope the connection must carry; reads leave it unset. */
  requiredScope?: string;
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
    name: "list_training_sessions",
    readOnly: true,
    description:
      "List cohort training sessions, newest first, with module, track, status, hasTranscript and recapSavedAt. " +
      "needsRecap: true keeps only sessions with a transcript and no saved recap yet.",
    parameters: {
      type: "object",
      properties: {
        needsRecap: { type: "boolean" },
        limit: { type: "number", description: "Max sessions (default 20, max 100)." },
      },
      required: [],
    },
  },
  {
    name: "get_training_transcript",
    readOnly: true,
    description: "Get the plain-text Zoom transcript of one training session (speaker-labeled dialogue).",
    parameters: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] },
  },
  {
    name: "save_training_recap",
    readOnly: false,
    requiredScope: RECAP_WRITE_SCOPE,
    description:
      "Save the recap of one cohort training session. Training sessions are cohort-wide, so the recap is saved to " +
      "every startup the session was visible to. Base it only on the transcript (get_training_transcript), use " +
      "concise bullet points, show the user the recap and get their OK before saving. Refuses to replace an " +
      "existing recap unless overwrite is true (only when the user explicitly asked). mentorComments here means " +
      "the trainer's comments.",
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
  {
    name: "record_startup_metrics",
    readOnly: false,
    requiredScope: METRICS_WRITE_SCOPE,
    description:
      "Record metric values for one startup and one period — exactly what an admin types into the Monthly Updates " +
      "grid (e.g. from a founder's email). period is \"initial\" or \"YYYY-MM\". values maps metric keys to " +
      "numbers (or short strings for text metrics); unknown keys are rejected with the valid names. Existing values " +
      "for other keys are kept; provided keys are overwritten. Returns a before/after diff — show it to the user. " +
      "Only record numbers the user actually gave you.",
    parameters: {
      type: "object",
      properties: {
        startupId: { type: "string", description: "From list_startups." },
        period: { type: "string", description: '"initial" or "YYYY-MM", e.g. "2026-09".' },
        values: { type: "object", description: "Metric key -> value. Keys must be valid metric keys." },
      },
      required: ["startupId", "period", "values"],
    },
  },
  {
    name: "complete_session",
    readOnly: false,
    requiredScope: SESSIONS_WRITE_SCOPE,
    description:
      "Mark one mentorship or training session as completed (it happened). Finds the session by id in either kind. " +
      "Idempotent: completing an already-completed session just says so.",
    parameters: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] },
  },
  {
    name: "send_startup_message",
    readOnly: false,
    requiredScope: MESSAGES_WRITE_SCOPE,
    description:
      "Email one startup's founder from the platform. DRY-RUN BY DEFAULT: without confirm:true it only returns " +
      "the resolved recipients and the exact subject/body so the user can check them. Set confirm:true ONLY after " +
      "the user has seen that preview in chat and explicitly said to send. Sends are rate-limited and logged in " +
      "the admin message history as coming from Claude.",
    parameters: {
      type: "object",
      properties: {
        startupId: { type: "string", description: "From list_startups." },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text; keep it short and human." },
        asSelf: { type: "boolean", description: "true = shown as the connected admin (replies go to them); false/omitted = shown as Open Startup." },
        confirm: { type: "boolean", description: "true actually sends. Only after the user approved the previewed message." },
      },
      required: ["startupId", "subject", "body"],
    },
  },
  {
    name: "send_cohort_message",
    readOnly: false,
    requiredScope: MESSAGES_WRITE_SCOPE,
    description:
      "Email a whole cohort of founders (seed, pre_seed, or all). DRY-RUN BY DEFAULT: without confirm:true it " +
      "returns the recipient count and the exact subject/body for the user to check. Set confirm:true ONLY after " +
      "the user has seen that preview in chat and explicitly said to send. Rate-limited and logged in the admin " +
      "message history as coming from Claude.",
    parameters: {
      type: "object",
      properties: {
        track: { type: "string", enum: ["seed", "pre_seed", "all"] },
        subject: { type: "string" },
        body: { type: "string" },
        asSelf: { type: "boolean" },
        confirm: { type: "boolean", description: "true actually sends. Only after the user approved the previewed message." },
      },
      required: ["track", "subject", "body"],
    },
  },
  {
    name: "list_training_modules",
    readOnly: true,
    description: "List training modules (id, title, track, session count) — needed to schedule a training session.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "schedule_mentorship_session",
    readOnly: false,
    requiredScope: SESSIONS_WRITE_SCOPE,
    description:
      "Create a mentorship session for one startup — the same thing an admin does in the UI, including the Zoom " +
      "meeting (when zoomHostEmail is a configured Zoom host) and calendar invites to the startup and admins. " +
      "Confirm the details with the user before calling. Returns the join link so the user can verify. Session " +
      "numbers auto-increment when omitted.",
    parameters: {
      type: "object",
      properties: {
        startupId: { type: "string", description: "From list_startups." },
        title: { type: "string" },
        scheduledAt: { type: "string", description: "ISO 8601 date-time with timezone, e.g. 2026-10-02T14:00:00Z." },
        durationMinutes: { type: "number", description: "Default 120." },
        description: { type: "string" },
        zoomHostEmail: { type: "string", description: "A configured Zoom host's email; omit to create without a Zoom meeting." },
        number: { type: "number", description: "Session number; omitted = next in sequence." },
      },
      required: ["startupId", "title", "scheduledAt"],
    },
  },
  {
    name: "schedule_training_session",
    readOnly: false,
    requiredScope: SESSIONS_WRITE_SCOPE,
    description:
      "Create a cohort training session under a training module (list_training_modules for the id) — same as the " +
      "admin UI, including the Zoom meeting (when zoomHostEmail is set) and calendar invites to the whole cohort. " +
      "Confirm the details with the user before calling. Returns the join link. Session numbers auto-increment " +
      "when omitted.",
    parameters: {
      type: "object",
      properties: {
        moduleId: { type: "string", description: "From list_training_modules." },
        title: { type: "string" },
        scheduledAt: { type: "string", description: "ISO 8601 date-time with timezone." },
        durationMinutes: { type: "number", description: "Default 120." },
        description: { type: "string" },
        zoomHostEmail: { type: "string" },
        number: { type: "number" },
      },
      required: ["moduleId", "title", "scheduledAt"],
    },
  },
  {
    name: "save_session_recap",
    readOnly: false,
    requiredScope: RECAP_WRITE_SCOPE,
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

/**
 * Every call goes through here: one central scope gate (from the tool's
 * requiredScope) and one durable audit row, success or failure. The audit
 * write itself is best-effort — a logging hiccup must never break a tool.
 */
export async function executeAiTool(name: string, input: any, ctx: AiToolContext): Promise<unknown> {
  const def = AI_TOOLS.find((t) => t.name === name);
  let result: unknown;
  try {
    if (def?.requiredScope && !ctx.scopes.includes(def.requiredScope)) {
      result = {
        error:
          `This connection wasn't approved for "${def.requiredScope}". Disconnect and reconnect the Platform ` +
          "connector in Claude, then approve the updated permissions.",
      };
    } else {
      result = await runTool(name, input, ctx);
    }
  } catch (e: any) {
    result = { error: "The tool failed unexpectedly. The team can check the server logs." };
    console.error(`[mcp] ${name} threw:`, e);
  }
  await auditToolCall(name, input, ctx, result);
  return result;
}

function summarizeResult(result: unknown): string {
  if (Array.isArray(result)) return `array of ${result.length}`;
  if (result && typeof result === "object") {
    const err = (result as any).error;
    if (typeof err === "string") return `error: ${err.slice(0, 200)}`;
    return `keys: ${Object.keys(result).slice(0, 8).join(", ")}`;
  }
  return String(result).slice(0, 200);
}

async function auditToolCall(name: string, input: any, ctx: AiToolContext, result: unknown): Promise<void> {
  try {
    let auditInput: Record<string, unknown> = {};
    try {
      const json = JSON.stringify(input ?? {});
      auditInput = json.length <= 4000 ? JSON.parse(json) : { truncated: true, chars: json.length };
    } catch {
      auditInput = { unserializable: true };
    }
    const err = (result as any)?.error;
    await storage.logMcpAudit({
      userEmail: ctx.userEmail,
      tool: name,
      input: auditInput,
      ok: typeof err !== "string",
      error: typeof err === "string" ? err.slice(0, 500) : null,
      resultSummary: summarizeResult(result),
    });
    const def = AI_TOOLS.find((t) => t.name === name);
    if (def && !def.readOnly && typeof err !== "string") {
      postOps(`🤖 Claude (as ${ctx.userEmail}) ran ${name} — ${summarizeResult(result)}`);
    }
  } catch (e) {
    console.error("[mcp] audit write failed:", e);
  }
}

/** B3: 10 real sends per connected admin per hour — a stuck loop can't spam founders. */
const SEND_LIMIT = 10;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const sendTimestamps = new Map<string, number[]>();
function sendAllowed(email: string): boolean {
  const now = Date.now();
  const recent = (sendTimestamps.get(email) ?? []).filter((t) => now - t < SEND_WINDOW_MS);
  if (recent.length >= SEND_LIMIT) {
    sendTimestamps.set(email, recent);
    return false;
  }
  recent.push(now);
  sendTimestamps.set(email, recent);
  return true;
}
/** Test hook. */
export function __resetMcpSendLimiter(): void {
  sendTimestamps.clear();
}

const messageInput = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  asSelf: z.boolean().optional(),
  confirm: z.boolean().optional(),
});

async function sendConnectorMessage(
  ctx: AiToolContext,
  opts: {
    kind: "cohort_message" | "startup_message";
    recipients: { email: string; name: string | null }[];
    audienceLabel: string;
    startupId?: string;
    subject: string;
    body: string;
    asSelf: boolean;
    confirm: boolean;
    meta: Record<string, unknown>;
  },
): Promise<unknown> {
  if (opts.recipients.length === 0) return { error: "No eligible recipients — nothing to send." };
  if (!opts.confirm) {
    return {
      dryRun: true,
      wouldSendTo: opts.recipients.map((r) => r.email),
      audience: opts.audienceLabel,
      subject: opts.subject,
      body: opts.body,
      sentAs: opts.asSelf ? ctx.userEmail : "Open Startup (platform)",
      note: "Nothing was sent. Show this preview to the user; only call again with confirm:true after they approve it.",
    };
  }
  if (!sendAllowed(ctx.userEmail)) {
    return { error: `Rate limit: at most ${SEND_LIMIT} sends per hour per admin through the connector. Try later or send from the admin UI.` };
  }
  const admin = await storage.getUserByEmail(ctx.userEmail);
  const sent = await sendAdminBroadcast({
    recipients: opts.recipients,
    subject: opts.subject,
    body: opts.body,
    senderName: admin?.name || ctx.userEmail,
    senderEmail: ctx.userEmail,
    asSelf: opts.asSelf,
  });
  await storage.logMessage({
    kind: opts.kind,
    startupId: opts.startupId ?? null,
    recipientEmails: opts.recipients.map((r) => r.email),
    subject: opts.subject,
    bodyPreview: opts.body.slice(0, 300),
    sentBy: `mcp:${ctx.userEmail}`,
    meta: { ...opts.meta, asSelf: opts.asSelf, sent, total: opts.recipients.length },
  });
  console.log(`[mcp] ${ctx.userEmail} sent a ${opts.kind} to ${opts.recipients.length} recipient(s)`);
  return { ok: true, sentTo: opts.recipients.length, delivered: sent, audience: opts.audienceLabel };
}

async function runTool(name: string, input: any, ctx: AiToolContext): Promise<unknown> {
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
      // Scope already checked centrally in executeAiTool (requiredScope).
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

    case "list_training_sessions": {
      const limit = Math.min(Math.max(Number(input?.limit) || 20, 1), 100);
      const rows = await storage.listTrainingSessionsForConnector({ needsRecap: input?.needsRecap === true, limit });
      return rows.map(({ transcriptUrl, ...row }) => ({ ...row, hasTranscript: !!transcriptUrl }));
    }

    case "get_training_transcript": {
      const sessionId = String(input?.sessionId ?? "");
      if (!UUID.test(sessionId)) return { error: "sessionId must come from list_training_sessions" };
      const session = await storage.getTrainingModuleSessionById(sessionId);
      if (!session) return { error: "No training session with that id" };
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

    case "save_training_recap": {
      const parsed = saveRecapInput.safeParse(input);
      if (!parsed.success) {
        const issue = parsed.error.errors[0];
        return { error: `Invalid ${issue.path.join(".") || "input"}: ${issue.message}` };
      }
      const { sessionId, overwrite, ...recap } = parsed.data;
      const session = await storage.getTrainingModuleSessionById(sessionId);
      if (!session) return { error: "No training session with that id" };
      const startupIds = await storage.listStartupIdsVisibleToTrainingSession(sessionId);
      if (startupIds.length === 0) return { error: "This session isn't visible to any startup, so there's nowhere to save the recap" };
      // "Already recapped" = any visible startup's notes carry an AI recap.
      let existingAt: Date | null = null;
      for (const sid of startupIds) {
        const notes = await storage.getTrainingSessionNotes(sessionId, sid);
        if (notes?.aiGeneratedAt && (!existingAt || notes.aiGeneratedAt > existingAt)) existingAt = notes.aiGeneratedAt;
      }
      if (existingAt && !overwrite) {
        return {
          error:
            "This session already has a recap (saved " + existingAt.toISOString() + "). Only set overwrite to " +
            "true if the user explicitly asked to replace it.",
        };
      }
      const savedAt = new Date();
      for (const sid of startupIds) {
        await storage.upsertTrainingSessionNotes(sessionId, sid, { ...recap, aiGeneratedAt: savedAt });
      }
      console.log(`[mcp] ${ctx.userEmail} saved the recap for training session ${sessionId} (${startupIds.length} startups)${existingAt ? " (replaced)" : ""}`);
      return { ok: true, sessionId, title: session.title, savedForStartups: startupIds.length, replacedExisting: !!existingAt };
    }

    case "record_startup_metrics": {
      const startupId = String(input?.startupId ?? "");
      if (!UUID.test(startupId)) return { error: "startupId must be a startup id from list_startups" };
      const period = String(input?.period ?? "");
      if (!/^(initial|\d{4}-(0[1-9]|1[0-2]))$/.test(period)) return { error: 'period must be "initial" or "YYYY-MM"' };
      const values = input?.values;
      if (!values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).length === 0) {
        return { error: "values must be a non-empty object of metric key -> value" };
      }
      const unknown = Object.keys(values).filter((k) => !ALL_METRIC_KEYS.has(k));
      if (unknown.length > 0) {
        return { error: `Unknown metric key(s): ${unknown.join(", ")}. Valid keys: ${[...ALL_METRIC_KEYS].join(", ")}` };
      }
      const bad = Object.entries(values).find(([, v]) => !(typeof v === "number" ? Number.isFinite(v) : typeof v === "string" && v.length <= 200));
      if (bad) return { error: `Metric "${bad[0]}" must be a finite number or a short string` };
      const startup = await storage.getStartupById(startupId);
      if (!startup) return { error: "No startup with that id" };
      const entries = await storage.listMetricEntries(startupId);
      const beforeValues = entries.find((e) => e.period === period)?.values ?? {};
      const before: Record<string, unknown> = {};
      for (const k of Object.keys(values)) before[k] = (beforeValues as any)[k] ?? null;
      await storage.upsertMetricEntry(startupId, period, values as Record<string, number | string>);
      console.log(`[mcp] ${ctx.userEmail} recorded ${Object.keys(values).length} metric(s) for ${startup.companyName} ${period}`);
      return { ok: true, startup: startup.companyName, period, before, after: values };
    }

    case "complete_session": {
      const sessionId = String(input?.sessionId ?? "");
      if (!UUID.test(sessionId)) return { error: "sessionId must come from list_mentorship_sessions or list_training_sessions" };
      const mentorship = await storage.getMentorshipModuleSessionById(sessionId);
      if (mentorship) {
        if (mentorship.status === "completed") return { ok: true, kind: "mentorship", title: mentorship.title, alreadyCompleted: true };
        await storage.updateMentorshipModuleSession(sessionId, { status: "completed" });
        console.log(`[mcp] ${ctx.userEmail} marked mentorship session ${sessionId} completed`);
        return { ok: true, kind: "mentorship", title: mentorship.title, alreadyCompleted: false };
      }
      const training = await storage.getTrainingModuleSessionById(sessionId);
      if (training) {
        if (training.status === "completed") return { ok: true, kind: "training", title: training.title, alreadyCompleted: true };
        await storage.updateTrainingModuleSession(sessionId, { status: "completed" });
        console.log(`[mcp] ${ctx.userEmail} marked training session ${sessionId} completed`);
        return { ok: true, kind: "training", title: training.title, alreadyCompleted: false };
      }
      return { error: "No session with that id" };
    }

    case "send_startup_message": {
      const startupId = String(input?.startupId ?? "");
      if (!UUID.test(startupId)) return { error: "startupId must be a startup id from list_startups" };
      const parsed = messageInput.safeParse(input);
      if (!parsed.success) return { error: `Invalid ${parsed.error.errors[0].path.join(".") || "input"}: ${parsed.error.errors[0].message}` };
      const startup = await storage.getStartupById(startupId);
      if (!startup) return { error: "No startup with that id" };
      const recipients = await storage.listStartupMessageRecipients(startupId);
      return sendConnectorMessage(ctx, {
        kind: "startup_message",
        recipients,
        audienceLabel: startup.companyName,
        startupId,
        subject: parsed.data.subject,
        body: parsed.data.body,
        asSelf: parsed.data.asSelf === true,
        confirm: parsed.data.confirm === true,
        meta: {},
      });
    }

    case "send_cohort_message": {
      const track = String(input?.track ?? "");
      if (!["seed", "pre_seed", "all"].includes(track)) return { error: 'track must be "seed", "pre_seed" or "all"' };
      const parsed = messageInput.safeParse(input);
      if (!parsed.success) return { error: `Invalid ${parsed.error.errors[0].path.join(".") || "input"}: ${parsed.error.errors[0].message}` };
      const recipients = await storage.listCohortMessageRecipients(track as "seed" | "pre_seed" | "all");
      return sendConnectorMessage(ctx, {
        kind: "cohort_message",
        recipients,
        audienceLabel: track === "all" ? "every founder" : `the ${track} cohort`,
        subject: parsed.data.subject,
        body: parsed.data.body,
        asSelf: parsed.data.asSelf === true,
        confirm: parsed.data.confirm === true,
        meta: { track },
      });
    }

    case "list_training_modules": {
      const modules = await storage.listTrainingModulesWithSessions();
      return modules.map((m: any) => ({ id: m.id, title: m.title, track: m.track, sessions: m.sessions?.length ?? 0 }));
    }

    case "schedule_mentorship_session": {
      const startupId = String(input?.startupId ?? "");
      if (!UUID.test(startupId)) return { error: "startupId must be a startup id from list_startups" };
      const startup = await storage.getStartupById(startupId);
      if (!startup) return { error: "No startup with that id" };
      const when = new Date(String(input?.scheduledAt ?? ""));
      if (Number.isNaN(+when)) return { error: "scheduledAt must be an ISO 8601 date-time" };
      const title = String(input?.title ?? "").trim();
      if (!title || title.length > 200) return { error: "title is required (max 200 chars)" };
      const existing = await storage.listMentorshipSessionsForStartup(startupId);
      const number = Number(input?.number) > 0 ? Number(input.number) : Math.max(0, ...existing.map((s) => s.number)) + 1;
      try {
        const session = await createMentorshipSessionCore(startupId, {
          number,
          title,
          description: input?.description ? String(input.description).slice(0, 1000) : null,
          scheduledAt: when,
          durationMinutes: Number(input?.durationMinutes) > 0 ? Number(input.durationMinutes) : 120,
          zoomHostEmail: input?.zoomHostEmail ? String(input.zoomHostEmail) : null,
        });
        console.log(`[mcp] ${ctx.userEmail} scheduled mentorship session ${session.id} for ${startup.companyName}`);
        return { ok: true, sessionId: session.id, startup: startup.companyName, number: session.number, scheduledAt: session.scheduledAt, joinUrl: session.meetingLink ?? null };
      } catch (e: any) {
        return { error: `Couldn't create the session: ${e?.message ?? "unknown error"}` };
      }
    }

    case "schedule_training_session": {
      const moduleId = String(input?.moduleId ?? "");
      if (!UUID.test(moduleId)) return { error: "moduleId must come from list_training_modules" };
      const module = await storage.getTrainingModuleById(moduleId);
      if (!module) return { error: "No training module with that id" };
      const when = new Date(String(input?.scheduledAt ?? ""));
      if (Number.isNaN(+when)) return { error: "scheduledAt must be an ISO 8601 date-time" };
      const title = String(input?.title ?? "").trim();
      if (!title || title.length > 200) return { error: "title is required (max 200 chars)" };
      const existing = await storage.listTrainingModuleSessionsByModule(moduleId);
      const number = Number(input?.number) > 0 ? Number(input.number) : Math.max(0, ...existing.map((s) => s.number)) + 1;
      try {
        const session = await createTrainingSessionCore(moduleId, {
          number,
          title,
          description: input?.description ? String(input.description).slice(0, 1000) : null,
          scheduledAt: when,
          durationMinutes: Number(input?.durationMinutes) > 0 ? Number(input.durationMinutes) : 120,
          zoomHostEmail: input?.zoomHostEmail ? String(input.zoomHostEmail) : null,
        });
        console.log(`[mcp] ${ctx.userEmail} scheduled training session ${session.id} (${module.title})`);
        return { ok: true, sessionId: session.id, module: module.title, number: session.number, scheduledAt: session.scheduledAt, joinUrl: session.meetingLink ?? null };
      } catch (e: any) {
        return { error: `Couldn't create the session: ${e?.message ?? "unknown error"}` };
      }
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
