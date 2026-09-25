import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/** Where the Zoom webhook saves session transcripts (.vtt), served as /uploads/transcripts/... */
export const TRANSCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads", "transcripts");
fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });

/**
 * Reads a transcript given its stored `/uploads/transcripts/...` URL. Only the
 * file name is used, so a crafted URL can't reach outside TRANSCRIPTS_DIR.
 */
export function readTranscriptFile(transcriptUrl: string): string | null {
  const filePath = path.join(TRANSCRIPTS_DIR, path.basename(transcriptUrl));
  if (!filePath.startsWith(TRANSCRIPTS_DIR) || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

/** Strips WebVTT cue numbers/timestamps, leaving speaker-labeled dialogue lines. */
export function vttToPlainText(vtt: string): string {
  return vtt
    .split(/\r?\n/)
    .filter((line) => line.trim() && line.trim() !== "WEBVTT" && !/^\d+$/.test(line.trim()) && !line.includes("-->"))
    .join("\n");
}
