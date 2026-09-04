/**
 * iCalendar (RFC 5545) generation for program sessions.
 *
 * Emitted as an email attachment so founders get a real invite in whichever
 * calendar they use, with no OAuth and no Workspace admin setup. Updates and
 * cancellations reuse the same UID with a higher SEQUENCE, which is what tells
 * a calendar client to replace the existing entry rather than add another.
 */

// Written via char codes because the escaping rules below are almost entirely
// backslashes, and spelling them as literals here is easy to get wrong.
const BS = String.fromCharCode(92); // backslash
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const CRLF = CR + LF;

export type CalendarAttendee = { email: string; name?: string | null };

export type SessionCalendarEvent = {
  /** Stable for the lifetime of the session. Changing it creates a duplicate. */
  uid: string;
  /** Must increase on every update, or clients ignore the change. */
  sequence: number;
  title: string;
  description?: string | null;
  /** Zoom join link (or any meeting URL). Shown as the event location. */
  joinUrl?: string | null;
  startsAt: Date;
  durationMinutes: number;
  organizerName: string;
  organizerEmail: string;
  attendees: CalendarAttendee[];
  /** Emits METHOD:CANCEL + STATUS:CANCELLED, which removes the entry. */
  cancelled?: boolean;
  /** Injectable so tests aren't time-dependent. */
  now?: Date;
};

/** RFC 5545 3.3.11: escape backslash, semicolon, comma and newline in TEXT. */
export function escapeIcsText(value: string): string {
  return value
    .split(BS).join(BS + BS)
    .split(";").join(BS + ";")
    .split(",").join(BS + ",")
    .split(CRLF).join(BS + "n")
    .split(LF).join(BS + "n")
    .split(CR).join(BS + "n");
}

/** UTC date-time form: YYYYMMDDTHHMMSSZ. */
export function toIcsUtc(d: Date): string {
  const iso = d.toISOString(); // 2026-09-04T13:02:00.000Z
  return (
    iso.slice(0, 4) + iso.slice(5, 7) + iso.slice(8, 10) +
    "T" +
    iso.slice(11, 13) + iso.slice(14, 16) + iso.slice(17, 19) +
    "Z"
  );
}

/**
 * RFC 5545 3.1: fold content lines longer than 75 octets. Folds on octets
 * rather than characters, so multi-byte text (accented names, emoji) can't
 * push a line over the limit, and never splits a UTF-8 sequence at the fold.
 */
export function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75; // continuation lines carry a leading space, so they hold 74
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Continuation bytes are 0b10xxxxxx; back off so we cut on a boundary.
    while (end > start + 1 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74;
  }
  return parts.join(CRLF + " ");
}

export function buildSessionIcs(event: SessionCalendarEvent): string {
  const start = event.startsAt;
  const end = new Date(start.getTime() + Math.max(1, event.durationMinutes) * 60_000);

  const descriptionParts: string[] = [];
  if (event.description) descriptionParts.push(event.description);
  if (event.joinUrl) descriptionParts.push("Join the meeting: " + event.joinUrl);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Open Startup//Platform//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:" + (event.cancelled ? "CANCEL" : "REQUEST"),
    "BEGIN:VEVENT",
    "UID:" + event.uid,
    "SEQUENCE:" + Math.max(0, Math.trunc(event.sequence)),
    "DTSTAMP:" + toIcsUtc(event.now ?? new Date()),
    "DTSTART:" + toIcsUtc(start),
    "DTEND:" + toIcsUtc(end),
    "SUMMARY:" + escapeIcsText(event.title),
    "ORGANIZER;CN=" + escapeIcsText(event.organizerName) + ":mailto:" + event.organizerEmail,
    "STATUS:" + (event.cancelled ? "CANCELLED" : "CONFIRMED"),
  ];

  if (descriptionParts.length) {
    lines.push("DESCRIPTION:" + escapeIcsText(descriptionParts.join(LF + LF)));
  }
  if (event.joinUrl) {
    lines.push("LOCATION:" + escapeIcsText(event.joinUrl));
  }
  for (const attendee of event.attendees) {
    const cn = attendee.name ? ";CN=" + escapeIcsText(attendee.name) : "";
    lines.push(
      "ATTENDEE" + cn +
        ";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:" +
        attendee.email,
    );
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  // RFC 5545 requires CRLF separators and a trailing CRLF.
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
