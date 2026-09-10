import { describe, it, expect } from "vitest";
import { buildSessionIcs, escapeIcsText, toIcsUtc, foldIcsLine } from "./calendar";

const BS = String.fromCharCode(92); // backslash
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);

const base = {
  uid: "session-1@platform-test.open-startup.org",
  sequence: 0,
  title: "Mentorship Session 1",
  startsAt: new Date("2026-09-04T13:02:00.000Z"),
  durationMinutes: 120,
  organizerName: "Open Startup",
  organizerEmail: "no-reply@open-startup.org",
  attendees: [{ email: "founder@example.com", name: "A Founder" }],
  now: new Date("2026-09-01T09:00:00.000Z"),
};

/** Reverse RFC 5545 line folding so assertions can look at logical lines. */
function unfold(ics: string): string[] {
  return ics.split(CRLF + " ").join("").split(CRLF).filter(Boolean);
}

describe("toIcsUtc", () => {
  it("formats as YYYYMMDDTHHMMSSZ", () => {
    expect(toIcsUtc(new Date("2026-09-04T13:02:00.000Z"))).toBe("20260904T130200Z");
  });
});

describe("escapeIcsText", () => {
  it("escapes the four reserved characters", () => {
    expect(escapeIcsText("a;b")).toBe("a" + BS + ";b");
    expect(escapeIcsText("a,b")).toBe("a" + BS + ",b");
    expect(escapeIcsText("a" + BS + "b")).toBe("a" + BS + BS + "b");
    expect(escapeIcsText("a\nb")).toBe("a" + BS + "nb");
  });

  it("escapes the backslash before the characters it introduces", () => {
    // A literal backslash must not turn its neighbour into an escape sequence.
    expect(escapeIcsText(BS + ";")).toBe(BS + BS + BS + ";");
  });
});

describe("foldIcsLine", () => {
  it("leaves short lines alone", () => {
    expect(foldIcsLine("SUMMARY:hi")).toBe("SUMMARY:hi");
  });

  it("folds long lines so every physical line fits 75 octets", () => {
    const folded = foldIcsLine("DESCRIPTION:" + "x".repeat(300));
    for (const physical of folded.split(CRLF)) {
      expect(Buffer.from(physical, "utf8").length).toBeLessThanOrEqual(75);
    }
  });

  it("round-trips: unfolding restores the original line", () => {
    const original = "DESCRIPTION:" + "abc ".repeat(90);
    expect(foldIcsLine(original).split(CRLF + " ").join("")).toBe(original);
  });

  it("never splits a multi-byte character across a fold", () => {
    // Each emoji is 4 octets, so a naive 75-octet cut lands mid-character.
    const folded = foldIcsLine("SUMMARY:" + "😀".repeat(40));
    expect(folded.split(CRLF + " ").join("")).toBe("SUMMARY:" + "😀".repeat(40));
    expect(folded).not.toContain("�"); // replacement char = broken UTF-8
  });
});

describe("buildSessionIcs", () => {
  it("emits a well-formed VCALENDAR with CRLF endings", () => {
    const ics = buildSessionIcs(base);
    expect(ics.startsWith("BEGIN:VCALENDAR" + CRLF)).toBe(true);
    expect(ics.endsWith("END:VCALENDAR" + CRLF)).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/); // no bare LF anywhere
  });

  it("derives DTEND from the duration", () => {
    const lines = unfold(buildSessionIcs(base));
    expect(lines).toContain("DTSTART:20260904T130200Z");
    expect(lines).toContain("DTEND:20260904T150200Z"); // +120 minutes
  });

  it("uses the injected clock for DTSTAMP", () => {
    expect(unfold(buildSessionIcs(base))).toContain("DTSTAMP:20260901T090000Z");
  });

  it("requests attendance and names the organiser", () => {
    const lines = unfold(buildSessionIcs(base));
    expect(lines).toContain("ORGANIZER;CN=Open Startup:mailto:no-reply@open-startup.org");
    expect(lines.some((l) => l.startsWith("ATTENDEE") && l.endsWith("mailto:founder@example.com"))).toBe(true);
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines).toContain("METHOD:REQUEST");
  });

  it("puts the join link in LOCATION and DESCRIPTION", () => {
    const lines = unfold(buildSessionIcs({ ...base, joinUrl: "https://zoom.us/j/123" }));
    expect(lines).toContain("LOCATION:https://zoom.us/j/123");
    expect(lines.some((l) => l.startsWith("DESCRIPTION:") && l.includes("https://zoom.us/j/123"))).toBe(true);
  });

  it("cancels with the same UID so clients remove the existing entry", () => {
    const lines = unfold(buildSessionIcs({ ...base, sequence: 3, cancelled: true }));
    expect(lines).toContain("METHOD:CANCEL");
    expect(lines).toContain("STATUS:CANCELLED");
    expect(lines).toContain("UID:session-1@platform-test.open-startup.org");
    expect(lines).toContain("SEQUENCE:3");
  });

  it("escapes reserved characters in user-supplied text", () => {
    const lines = unfold(buildSessionIcs({ ...base, title: "Growth; Metrics, Part 1" }));
    expect(lines).toContain("SUMMARY:Growth" + BS + "; Metrics" + BS + ", Part 1");
  });

  it("keeps SEQUENCE a non-negative integer", () => {
    expect(unfold(buildSessionIcs({ ...base, sequence: -5 }))).toContain("SEQUENCE:0");
    expect(unfold(buildSessionIcs({ ...base, sequence: 2.7 }))).toContain("SEQUENCE:2");
  });
});
