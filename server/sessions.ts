import { storage } from "./storage";
import { sendSessionInvite } from "./mailer";
import { buildSessionIcs } from "./calendar";
import { createZoomMeeting, deleteZoomMeeting, parseZoomMeetingId } from "./zoom";

/**
 * B3: session creation and calendar-invite dispatch, extracted from routes.ts
 * so the admin routes and the Claude connector's scheduling tools run the
 * exact same code path (Zoom meeting, invite emails, rollback) instead of
 * two copies drifting apart.
 */

const APP_URL = (process.env.APP_URL || "http://localhost:5000").replace(/\/+$/, "");

// "off" (default) or "ics". "google" is reserved for a future Calendar-API
// integration and currently behaves like "off".
const CALENDAR_INVITES = (process.env.CALENDAR_INVITES || "off").trim().toLowerCase();
const icsInvitesEnabled = CALENDAR_INVITES === "ics";

const CALENDAR_ORGANIZER =
  process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@open-startup.org";

/** Host portion of APP_URL, used to build stable iCalendar UIDs. */
function appHost(): string {
  try {
    return new URL(APP_URL).hostname;
  } catch {
    return "open-startup.org";
  }
}

/**
 * Email a calendar invite (or cancellation) for a session.
 *
 * Best-effort and never throws: the admin's save is already committed by the
 * time this runs, so a mail problem must not surface as a failed save. It is
 * also deliberately not awaited before responding, because SMTP is slow and
 * scales with the size of the cohort.
 */
export async function dispatchSessionInvite(
  kind: "Mentorship" | "Training",
  session: {
    id: string;
    title: string;
    description?: string | null;
    meetingLink?: string | null;
    scheduledAt: Date | string;
    durationMinutes: number;
    calendarSequence?: number | null;
    zoomHostEmail?: string | null;
    startupId?: string | null;
  },
  opts: { cancelled?: boolean; sequence?: number; updated?: boolean } = {},
): Promise<void> {
  if (!icsInvitesEnabled) return;
  try {
    // Mentorship sessions belong to one startup; Training is programme-wide.
    // Inviting the whole cohort to a 1:1 session would disclose who is being
    // mentored and when.
    const recipients = session.startupId
      ? await storage.listStartupSessionInviteRecipients(session.startupId)
      : await storage.listSessionInviteRecipients();

    // The Zoom host needs it in their own calendar too, and they may not have
    // a platform account at all. Deduplicated case-insensitively, since a
    // host who is also an admin would otherwise be invited twice.
    if (session.zoomHostEmail) {
      const seen = new Set(recipients.map((r) => r.email.toLowerCase()));
      if (!seen.has(session.zoomHostEmail.toLowerCase())) {
        recipients.push({ email: session.zoomHostEmail, name: null });
      }
    }

    if (!recipients.length) return;

    const startsAt = new Date(session.scheduledAt);
    const ics = buildSessionIcs({
      uid: `session-${session.id}@${appHost()}`,
      sequence: opts.sequence ?? session.calendarSequence ?? 0,
      title: session.title,
      description: session.description ?? null,
      joinUrl: session.meetingLink ?? null,
      startsAt,
      durationMinutes: session.durationMinutes,
      organizerName: "Open Startup",
      organizerEmail: CALENDAR_ORGANIZER,
      attendees: recipients,
      cancelled: opts.cancelled,
    });

    const sent = await sendSessionInvite({
      recipients,
      kind,
      title: session.title,
      startsAt,
      durationMinutes: session.durationMinutes,
      joinUrl: session.meetingLink ?? null,
      ics,
      cancelled: opts.cancelled,
      updated: opts.updated,
    });
    console.log(`[calendar] ${opts.cancelled ? "cancellation" : opts.updated ? "update" : "invite"} for ${kind} session ${session.id}: ${sent}/${recipients.length} sent`);
  } catch (error) {
    console.error("[calendar] invite dispatch failed:", error);
  }
}

export interface SessionCreateInput {
  number: number;
  title: string;
  description?: string | null;
  scheduledAt: Date;
  durationMinutes?: number;
  experts?: string | null;
  status?: "upcoming" | "completed";
  meetingLink?: string | null;
  zoomHostEmail?: string | null;
  recordingUrl?: string | null;
  transcriptUrl?: string | null;
  visibilityTrack?: "seed" | "pre_seed" | "all" | null;
  startupIds?: string[];
  /** Mentorship only. */
  materialsUrl?: string | null;
  mentorBio?: string | null;
  /** Training only. */
  presentationUrl?: string | null;
  trainerBio?: string | null;
}

/** Create-a-Zoom-meeting-if-a-host-was-named, shared by both cores. */
async function resolveMeeting(d: SessionCreateInput) {
  const hostEmail = d.zoomHostEmail || null;
  let meetingLink = d.meetingLink || null;
  let zoomMeetingId = parseZoomMeetingId(meetingLink);
  let createdMeetingId: string | null = null;
  if (hostEmail) {
    const meeting = await createZoomMeeting(hostEmail, {
      topic: d.title,
      scheduledAt: d.scheduledAt,
      durationMinutes: d.durationMinutes ?? 120,
    });
    meetingLink = meeting.joinUrl;
    zoomMeetingId = meeting.id;
    createdMeetingId = meeting.id;
  }
  return { hostEmail, meetingLink, zoomMeetingId, createdMeetingId };
}

export async function createMentorshipSessionCore(startupId: string, d: SessionCreateInput) {
  const { hostEmail, meetingLink, zoomMeetingId, createdMeetingId } = await resolveMeeting(d);
  try {
    const session = await storage.createMentorshipModuleSession({
      startupId,
      number: d.number,
      title: d.title,
      description: d.description || null,
      scheduledAt: d.scheduledAt,
      durationMinutes: d.durationMinutes ?? 120,
      experts: d.experts || null,
      status: d.status ?? "upcoming",
      meetingLink,
      recordingUrl: d.recordingUrl || null,
      transcriptUrl: d.transcriptUrl || null,
      materialsUrl: d.materialsUrl || null,
      mentorBio: d.mentorBio || null,
      zoomMeetingId,
      zoomHostEmail: hostEmail,
      visibilityTrack: d.visibilityTrack || null,
    });
    if (d.startupIds) await storage.setMentorshipSessionStartups(session.id, d.startupIds);
    void dispatchSessionInvite("Mentorship", session);
    return session;
  } catch (error) {
    if (createdMeetingId) await deleteZoomMeeting(createdMeetingId).catch(() => undefined);
    throw error;
  }
}

export async function createTrainingSessionCore(moduleId: string, d: SessionCreateInput) {
  const { hostEmail, meetingLink, zoomMeetingId, createdMeetingId } = await resolveMeeting(d);
  try {
    const session = await storage.createTrainingModuleSession(moduleId, {
      number: d.number,
      title: d.title,
      description: d.description || null,
      scheduledAt: d.scheduledAt,
      durationMinutes: d.durationMinutes ?? 120,
      experts: d.experts || null,
      status: d.status ?? "upcoming",
      meetingLink,
      presentationUrl: d.presentationUrl || null,
      recordingUrl: d.recordingUrl || null,
      transcriptUrl: d.transcriptUrl || null,
      trainerBio: d.trainerBio || null,
      zoomMeetingId,
      zoomHostEmail: hostEmail,
      visibilityTrack: d.visibilityTrack || null,
    });
    if (d.startupIds) await storage.setTrainingSessionStartups(session.id, d.startupIds);
    void dispatchSessionInvite("Training", session);
    return session;
  } catch (error) {
    if (createdMeetingId) await deleteZoomMeeting(createdMeetingId).catch(() => undefined);
    throw error;
  }
}
