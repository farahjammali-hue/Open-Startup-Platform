/**
 * One-off seed for content that has no in-app "admin creates this" UI yet:
 * the Open Startup School catalogue and a few starter Office Hours slots.
 * Safe to re-run — it skips anything that's already there.
 *
 * Run with: npm run db:seed
 */
import { db } from "./db";
import { trainings, officeHourSlots } from "@shared/schema";
import { sql } from "drizzle-orm";

async function seedTrainings() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(trainings);
  if (count > 0) {
    console.log(`[seed] trainings already has ${count} rows, skipping`);
    return;
  }

  await db.insert(trainings).values([
    // Expertise — unlocks from month 6
    { module: "expertise", title: "Financial modeling for early-stage startups", description: "Build a 12-month cash flow model investors trust.", unlockMonth: 6, orderIndex: 1 },
    { module: "expertise", title: "Go-to-market strategy workshop", description: "Position, price and channel-plan your product.", unlockMonth: 6, orderIndex: 2 },
    { module: "expertise", title: "Fundraising 101", description: "Term sheets, cap tables and how rounds actually close.", unlockMonth: 7, orderIndex: 3 },

    // Immersions — unlocks from month 8
    { module: "immersions", title: "Market immersion: customer discovery sprint", description: "A structured week of user interviews and synthesis.", unlockMonth: 8, orderIndex: 1 },
    { module: "immersions", title: "Investor immersion: pitch clinic", description: "Live pitch practice with feedback from investors.", unlockMonth: 9, orderIndex: 2 },

    // Alumni & Fellows — unlocks at graduation
    { module: "alumni", title: "Alumni network onboarding", description: "Meet the alumni community and mentorship pool.", unlockMonth: 0, orderIndex: 1 },
    { module: "alumni", title: "Fellows track: become a mentor", description: "Give back by mentoring the next cohort.", unlockMonth: 0, orderIndex: 2 },
  ]);
  console.log("[seed] inserted 7 trainings");
}

async function seedOfficeHours() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(officeHourSlots);
  if (count > 0) {
    console.log(`[seed] office_hour_slots already has ${count} rows, skipping`);
    return;
  }

  const now = new Date();
  function at(daysFromNow: number, hour: number, minute = 0) {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  await db.insert(officeHourSlots).values([
    { hostName: "OST Program Team", topic: "General office hours", startsAt: at(3, 10, 0), endsAt: at(3, 10, 30), capacity: 3 },
    { hostName: "OST Program Team", topic: "Fundraising Q&A", startsAt: at(7, 15, 0), endsAt: at(7, 15, 30), capacity: 2 },
  ]);
  console.log("[seed] inserted 2 office hour slots");
}

async function main() {
  await seedTrainings();
  await seedOfficeHours();
  console.log("[seed] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
