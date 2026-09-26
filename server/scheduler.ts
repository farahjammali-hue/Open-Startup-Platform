import cron from "node-cron";
import { storage } from "./storage";
import { sendMetricsReminder } from "./mailer";

/**
 * A8: the platform's only background job runner. One in-process daily tick
 * (this is a single-container deploy, so no distributed-lock worries);
 * idempotency comes from message_log, not from timing — a restart or a
 * re-run on the same day never double-sends, because each reminder is
 * recorded there and checked first.
 *
 * Ships dark: nothing runs unless REMINDERS_ENABLED=true is in .env.
 */

const APP_URL = process.env.APP_URL || "http://localhost:5000";

/** "2026-09" for the given date. */
export function periodOf(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Reminder days: the 24th (heads-up) and the last day of the month (last call). */
export function reminderTrigger(now: Date): "day24" | "monthEnd" | null {
  const day = now.getDate();
  if (day === 24) return "day24";
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return day === lastDay ? "monthEnd" : null;
}

/**
 * Email every startup that hasn't saved any metrics for the current month.
 * Only startups that finished onboarding (KYS and contract both submitted)
 * are nagged — before that, the dashboard is still locked for them.
 * Returns how many reminders were actually sent.
 */
export async function sendMonthlyMetricsReminders(now: Date): Promise<number> {
  const trigger = reminderTrigger(now);
  if (!trigger) return 0;
  const period = periodOf(now);

  const [startups, reported, alreadyReminded] = await Promise.all([
    storage.listStartupsWithOwners(),
    storage.listStartupIdsWithMetricEntry(period),
    storage.listRemindedStartupIds(period, trigger),
  ]);
  const reportedSet = new Set(reported);
  const remindedSet = new Set(alreadyReminded);

  let sent = 0;
  for (const s of startups) {
    if (!s.ownerEmail) continue;
    if (!s.kysStatus || !s.contractStatus) continue; // onboarding not finished
    if (reportedSet.has(s.id) || remindedSet.has(s.id)) continue;
    const ok = await sendMetricsReminder({
      to: s.ownerEmail,
      name: s.ownerName ?? null,
      startupName: s.companyName,
      monthLabel: now.toLocaleString("en", { month: "long", year: "numeric" }),
      lastCall: trigger === "monthEnd",
      link: `${APP_URL}/dashboard`,
    });
    // Log even when SMTP is off (ok=false logs to console instead): the
    // point of the ledger is "we tried once today", not delivery tracking.
    await storage.logMessage({
      kind: "reminder",
      startupId: s.id,
      recipientEmails: [s.ownerEmail],
      subject: `Reminder: ${period} metrics`,
      bodyPreview: null,
      sentBy: "system",
      meta: { period, trigger, delivered: ok },
    });
    sent++;
  }
  if (sent > 0) console.log(`[scheduler] sent ${sent} ${trigger} metrics reminder(s) for ${period}`);
  return sent;
}

export function startScheduler(): void {
  if (process.env.REMINDERS_ENABLED !== "true") {
    console.log("[scheduler] REMINDERS_ENABLED is not 'true' — reminders are off");
    return;
  }
  // 09:00 server time (the container runs UTC), daily; the job itself
  // decides whether today is a reminder day.
  cron.schedule("0 9 * * *", async () => {
    try {
      await sendMonthlyMetricsReminders(new Date());
    } catch (e) {
      console.error("[scheduler] metrics reminders failed:", e);
    }
  });
  console.log("[scheduler] reminders on (daily 09:00 check; sends on the 24th and the last day of the month)");
}
