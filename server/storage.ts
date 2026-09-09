import { eq, and, desc, asc, isNotNull, sql, count, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  startups,
  goals,
  startupMetricEntries,
  startupMetricsProfile,
  startupAchievements,
  documents,
  documentEvents,
  officeHourSlots,
  officeHourBookings,
  trainings,
  trainingProgress,
  mentorshipModuleSessions,
  mentorshipSessionNotes,
  trainingModules,
  trainingModuleSessions,
  trainingSessionStartups,
  trainingSessionNotes,
  trainingModuleHomework,
  trainers,
  experts,
  expertPriorities,
  contracts,
  contractEvents,
  kysProfiles,
  kysEvents,
  kysDocuments,
  monthlyUpdates,
  teamMembers,
  dataRoomShares,
  capTableEntries,
  startupCrmEntries,
  type User,
  type Startup,
  type PublicUser,
  type Goal,
  type StartupMetricEntry,
  type StartupMetricsProfile,
  type StartupAchievement,
  type StartupCrmEntry,
  type Document,
  type DocumentEvent,
  type OfficeHourSlot,
  type OfficeHourBooking,
  type Training,
  type TrainingProgress,
  type MentorshipModuleSession,
  type MentorshipSessionNotes,
  type TrainingModule,
  type TrainingModuleSession,
  type TrainingSessionNotes,
  type TrainingModuleHomework,
  type Trainer,
  type Expert,
  type ExpertPriority,
  type Contract,
  type ContractEvent,
  type KysProfile,
  type KysEvent,
  type KysDocument,
  type MonthlyUpdate,
  type TeamMember,
  type DataRoomShare,
  type CapTableEntry,
} from "@shared/schema";

/** Whole months elapsed between two dates (never negative). */
function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Strip the password hash before anything leaves the server. */
export function toPublicUser(user: User): PublicUser {
  // Never expose the password hash or the raw verification token.
  const { password, verificationToken, verificationExpiresAt, emailChangeToken, emailChangeExpiresAt, ...safe } = user;
  return safe as PublicUser;
}

export const storage = {
  /* ---------------- Users ---------------- */
  async getUserById(id: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row;
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    return row;
  },

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId));
    return row;
  },

  async createUser(data: {
    email: string;
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    age?: number | null;
    country?: string | null;
    password?: string | null;
    authProvider?: "local" | "google";
    googleId?: string | null;
    avatarUrl?: string | null;
    emailVerified?: boolean;
    verificationToken?: string | null;
    verificationExpiresAt?: Date | null;
  }): Promise<User> {
    const [row] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        name: data.name,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        age: data.age ?? null,
        country: data.country ?? null,
        password: data.password ?? null,
        authProvider: data.authProvider ?? "local",
        googleId: data.googleId ?? null,
        avatarUrl: data.avatarUrl ?? null,
        onboardingStatus: "needs_role",
        emailVerified: data.emailVerified ?? false,
        verificationToken: data.verificationToken ?? null,
        verificationExpiresAt: data.verificationExpiresAt ?? null,
      })
      .returning();
    return row;
  },

  async getUserByEmailChangeToken(token: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.emailChangeToken, token));
    return row;
  },

  async setEmailChange(
    userId: string,
    newEmail: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await db
      .update(users)
      .set({
        pendingEmail: newEmail.toLowerCase(),
        emailChangeToken: token,
        emailChangeExpiresAt: expiresAt,
      })
      .where(eq(users.id, userId));
  },

  async applyEmailChange(userId: string, newEmail: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({
        email: newEmail.toLowerCase(),
        emailVerified: true,
        pendingEmail: null,
        emailChangeToken: null,
        emailChangeExpiresAt: null,
      })
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token));
    return row;
  },

  async setVerificationToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await db
      .update(users)
      .set({ verificationToken: token, verificationExpiresAt: expiresAt })
      .where(eq(users.id, userId));
  },

  async markEmailVerified(userId: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ emailVerified: true, verificationToken: null, verificationExpiresAt: null })
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  async setUserRole(
    userId: string,
    role: "startup" | "mentor" | "investor" | "admin",
  ): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ role, onboardingStatus: "needs_profile" })
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  async markOnboardingComplete(userId: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ onboardingStatus: "complete" })
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  async setActiveStartup(userId: string, startupId: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ activeStartupId: startupId })
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  async updateAccount(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      age?: number;
      country?: string;
      name?: string;
    },
  ): Promise<User> {
    const patch: Record<string, unknown> = {};
    if (data.firstName !== undefined) patch.firstName = data.firstName;
    if (data.lastName !== undefined) patch.lastName = data.lastName;
    if (data.age !== undefined) patch.age = data.age;
    if (data.country !== undefined) patch.country = data.country;
    if (data.name !== undefined) patch.name = data.name;
    const [row] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({ password: passwordHash })
      .where(eq(users.id, userId));
  },

  async updateAvatar(userId: string, url: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ avatarUrl: url })
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  async touchLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  },

  /* ---------------- Startups ---------------- */
  async getStartupsByUserId(userId: string): Promise<Startup[]> {
    return db
      .select()
      .from(startups)
      .where(eq(startups.userId, userId))
      .orderBy(desc(startups.createdAt));
  },

  async getStartupById(id: string): Promise<Startup | undefined> {
    const [row] = await db.select().from(startups).where(eq(startups.id, id));
    return row;
  },

  /** Fetch a startup only if it belongs to the given user (ownership guard). */
  async getOwnedStartup(
    id: string,
    userId: string,
  ): Promise<Startup | undefined> {
    const [row] = await db
      .select()
      .from(startups)
      .where(and(eq(startups.id, id), eq(startups.userId, userId)));
    return row;
  },

  async createStartup(
    userId: string,
    data: { companyName: string; website?: string | null },
  ): Promise<Startup> {
    const [row] = await db
      .insert(startups)
      .values({
        userId,
        companyName: data.companyName,
        website: data.website ?? null,
      })
      .returning();
    return row;
  },

  async updateStartup(
    id: string,
    data: Partial<typeof startups.$inferInsert>,
  ): Promise<Startup> {
    const [row] = await db
      .update(startups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(startups.id, id))
      .returning();
    return row;
  },

  async requestStartupDeletion(
    id: string,
    reason: string | null,
  ): Promise<Startup> {
    const [row] = await db
      .update(startups)
      .set({ deletionRequestedAt: new Date(), deletionReason: reason })
      .where(eq(startups.id, id))
      .returning();
    return row;
  },

  async cancelStartupDeletion(id: string): Promise<Startup> {
    const [row] = await db
      .update(startups)
      .set({ deletionRequestedAt: null, deletionReason: null })
      .where(eq(startups.id, id))
      .returning();
    return row;
  },

  /* ---------------- Admin ---------------- */
  async promoteToAdmin(userId: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ role: "admin", onboardingStatus: "complete" })
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  async listUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  },

  async setUserActive(id: string, active: boolean): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ isActive: active })
      .where(eq(users.id, id))
      .returning();
    return row;
  },

  async deleteStartup(id: string): Promise<void> {
    await db.delete(startups).where(eq(startups.id, id));
  },

  async listStartupsWithOwners() {
    return db
      .select({
        id: startups.id,
        companyName: startups.companyName,
        website: startups.website,
        location: startups.location,
        stage: startups.stage,
        logoUrl: startups.logoUrl,
        dataRoomLink: startups.dataRoomLink,
        dataRoomUpdatedAt: startups.dataRoomUpdatedAt,
        deletionRequestedAt: startups.deletionRequestedAt,
        deletionReason: startups.deletionReason,
        createdAt: startups.createdAt,
        ownerName: users.name,
        ownerEmail: users.email,
        kysTrack: kysProfiles.track,
        kysStatus: kysProfiles.status,
        contractStatus: contracts.status,
        mentorName: experts.name,
        trainerName: trainers.name,
      })
      .from(startups)
      .leftJoin(users, eq(startups.userId, users.id))
      .leftJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .leftJoin(contracts, eq(contracts.startupId, startups.id))
      .leftJoin(experts, eq(experts.id, startups.mentorId))
      .leftJoin(trainers, eq(trainers.id, startups.trainerId))
      .orderBy(desc(startups.createdAt));
  },

  async listDeletionRequests() {
    return db
      .select({
        id: startups.id,
        companyName: startups.companyName,
        deletionRequestedAt: startups.deletionRequestedAt,
        deletionReason: startups.deletionReason,
        logoUrl: startups.logoUrl,
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(startups)
      .leftJoin(users, eq(startups.userId, users.id))
      .where(isNotNull(startups.deletionRequestedAt))
      .orderBy(desc(startups.deletionRequestedAt));
  },

  async adminCounts() {
    const [u] = await db.select({ c: sql<number>`count(*)::int` }).from(users);
    const [s] = await db.select({ c: sql<number>`count(*)::int` }).from(startups);
    const [d] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(startups)
      .where(isNotNull(startups.deletionRequestedAt));
    const [pc] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(contracts)
      .where(eq(contracts.status, "pending"));
    const [pk] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(kysProfiles)
      .where(eq(kysProfiles.status, "pending"));
    const [ks] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(startupMetricEntries)
      .innerJoin(startups, eq(startupMetricEntries.startupId, startups.id));
    const [pd] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.status, "pending"));
    const [ms] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(mentorshipModuleSessions)
      .where(and(eq(mentorshipModuleSessions.status, "upcoming"), sql`${mentorshipModuleSessions.scheduledAt} > now()`));
    const [tm] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(teamMembers)
      .innerJoin(startups, eq(teamMembers.startupId, startups.id));
    const [tr] = await db.select({ c: sql<number>`count(*)::int` }).from(trainings);
    return {
      users: u?.c ?? 0,
      startups: s?.c ?? 0,
      pendingDeletions: d?.c ?? 0,
      pendingContracts: pc?.c ?? 0,
      pendingKys: pk?.c ?? 0,
      metricEntries: ks?.c ?? 0,
      pendingDocuments: pd?.c ?? 0,
      upcomingMentorshipSessions: ms?.c ?? 0,
      teamMembers: tm?.c ?? 0,
      trainings: tr?.c ?? 0,
    };
  },

  /* ---------------- Ask AI (curated business-metric lookups) ---------------- */
  // Sums a single numeric startups column, optionally scoped to a KYS track,
  // and reports how many startups actually have that field filled in — the
  // fields here are founder-entered and often incomplete.
  async startupMetricSummary(
    metric: "lastValuation" | "amountRaised" | "totalRevenueSinceFounding",
    track?: "seed" | "pre_seed",
  ): Promise<{ total: number; countWithData: number; countTotal: number }> {
    const col =
      metric === "lastValuation" ? startups.lastValuation :
      metric === "amountRaised" ? startups.amountRaised :
      startups.totalRevenueSinceFounding;
    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(${col}), 0)::bigint`,
        countWithData: sql<number>`count(${col})::int`,
        countTotal: sql<number>`count(distinct ${startups.id})::int`,
      })
      .from(startups)
      .leftJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .where(track ? eq(kysProfiles.track, track) : undefined);
    return { total: Number(row?.total ?? 0), countWithData: row?.countWithData ?? 0, countTotal: row?.countTotal ?? 0 };
  },

  async countStartups(track?: "seed" | "pre_seed"): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(distinct ${startups.id})::int` })
      .from(startups)
      .leftJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .where(track ? eq(kysProfiles.track, track) : undefined);
    return row?.c ?? 0;
  },

  async averageTeamSize(): Promise<{ avg: number; totalMembers: number; totalStartups: number }> {
    const [tm] = await db.select({ c: sql<number>`count(*)::int` }).from(teamMembers);
    const [s] = await db.select({ c: sql<number>`count(*)::int` }).from(startups);
    const totalMembers = tm?.c ?? 0;
    const totalStartups = s?.c ?? 0;
    return { avg: totalStartups > 0 ? totalMembers / totalStartups : 0, totalMembers, totalStartups };
  },

  // For matching a startup name mentioned in a free-text question — small
  // enough (a handful of dozen rows) to fetch every name once and search
  // client-side rather than write a fuzzy-match SQL query.
  async listStartupNames(): Promise<{ id: string; companyName: string }[]> {
    return db.select({ id: startups.id, companyName: startups.companyName }).from(startups);
  },

  // Qualitative, per-startup profile — text fields and statuses only, never
  // document/file contents (contract PDFs, decks, KYS uploads stay untouched).
  async getStartupQualitativeProfile(startupId: string) {
    const [row] = await db
      .select({
        companyName: startups.companyName,
        shortDescription: startups.shortDescription,
        location: startups.location,
        markets: startups.markets,
        stage: startups.stage,
        track: kysProfiles.track,
        contractStatus: contracts.status,
        kysStatus: kysProfiles.status,
      })
      .from(startups)
      .leftJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .leftJoin(contracts, eq(contracts.startupId, startups.id))
      .where(eq(startups.id, startupId));
    const [tm] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(teamMembers)
      .where(eq(teamMembers.startupId, startupId));
    return row ? { ...row, teamSize: tm?.c ?? 0 } : undefined;
  },

  // Startups with a monthly update flagged at-risk/off-track, or where the
  // founder explicitly asked for support — names only, no document contents.
  async listStartupsNeedingAttention(): Promise<{ companyName: string; status: string; supportNeeded: string | null }[]> {
    return db
      .select({ companyName: startups.companyName, status: monthlyUpdates.status, supportNeeded: monthlyUpdates.supportNeeded })
      .from(monthlyUpdates)
      .innerJoin(startups, eq(monthlyUpdates.startupId, startups.id))
      .where(sql`${monthlyUpdates.status} != 'on_track' or (${monthlyUpdates.supportNeeded} is not null and ${monthlyUpdates.supportNeeded} != '')`)
      .orderBy(asc(startups.companyName));
  },

  // Startups with a pending Contract or KYS review — names + which is
  // pending, never the document/file contents themselves.
  async listStartupsWithPendingReviews(): Promise<{ companyName: string; contractPending: boolean; kysPending: boolean }[]> {
    const rows = await db
      .select({
        companyName: startups.companyName,
        contractStatus: contracts.status,
        kysStatus: kysProfiles.status,
      })
      .from(startups)
      .leftJoin(contracts, eq(contracts.startupId, startups.id))
      .leftJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .where(sql`${contracts.status} = 'pending' or ${kysProfiles.status} = 'pending'`)
      .orderBy(asc(startups.companyName));
    return rows.map((r) => ({
      companyName: r.companyName,
      contractPending: r.contractStatus === "pending",
      kysPending: r.kysStatus === "pending",
    }));
  },

  // Startup names + stage for a given KYS track — qualitative listing, no totals.
  async listStartupNamesByTrack(track: "seed" | "pre_seed"): Promise<{ companyName: string; stage: string | null }[]> {
    return db
      .select({ companyName: startups.companyName, stage: startups.stage })
      .from(startups)
      .innerJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .where(eq(kysProfiles.track, track))
      .orderBy(asc(startups.companyName));
  },

  /**
   * Resolve the user's currently active startup, falling back to their most
   * recent one (and persisting that choice) when none is set.
   */
  async resolveActiveStartup(user: User): Promise<Startup | undefined> {
    if (user.activeStartupId) {
      const active = await this.getOwnedStartup(user.activeStartupId, user.id);
      if (active) return active;
    }
    const list = await this.getStartupsByUserId(user.id);
    if (list.length === 0) return undefined;
    await this.setActiveStartup(user.id, list[0].id);
    return list[0];
  },

  /* ---------------- Goals (Dashboard) ---------------- */
  async listGoals(startupId: string): Promise<Goal[]> {
    return db
      .select()
      .from(goals)
      .where(eq(goals.startupId, startupId))
      .orderBy(desc(goals.createdAt));
  },

  async getOwnedGoal(id: string, startupId: string): Promise<Goal | undefined> {
    const [row] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.startupId, startupId)));
    return row;
  },

  async createGoal(
    startupId: string,
    data: { title: string; description?: string | null; targetDate?: Date | null; status?: "on_track" | "at_risk" | "off_track" | "done" },
  ): Promise<Goal> {
    const [row] = await db
      .insert(goals)
      .values({ startupId, ...data })
      .returning();
    return row;
  },

  async updateGoal(id: string, data: Partial<typeof goals.$inferInsert>): Promise<Goal> {
    const [row] = await db
      .update(goals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(goals.id, id))
      .returning();
    return row;
  },

  async deleteGoal(id: string): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id));
  },

  /* ---------------- Metrics & KPIs ---------------- */
  async listMetricEntries(startupId: string): Promise<StartupMetricEntry[]> {
    return db.select().from(startupMetricEntries).where(eq(startupMetricEntries.startupId, startupId));
  },

  async upsertMetricEntry(startupId: string, period: string, values: Record<string, number | string>): Promise<StartupMetricEntry> {
    const [existing] = await db
      .select()
      .from(startupMetricEntries)
      .where(and(eq(startupMetricEntries.startupId, startupId), eq(startupMetricEntries.period, period)));
    if (existing) {
      const merged = { ...existing.values, ...values };
      const [row] = await db
        .update(startupMetricEntries)
        .set({ values: merged, updatedAt: new Date() })
        .where(eq(startupMetricEntries.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(startupMetricEntries)
      .values({ startupId, period, values })
      .returning();
    return row;
  },

  async getMetricsProfile(startupId: string): Promise<StartupMetricsProfile | undefined> {
    const [row] = await db.select().from(startupMetricsProfile).where(eq(startupMetricsProfile.startupId, startupId));
    return row;
  },

  async upsertMetricsProfile(startupId: string, data: Partial<typeof startupMetricsProfile.$inferInsert>): Promise<StartupMetricsProfile> {
    const existing = await this.getMetricsProfile(startupId);
    if (existing) {
      const patch = { ...data, updatedAt: new Date() } as Partial<typeof startupMetricsProfile.$inferInsert>;
      if (data.dataRoom) patch.dataRoom = { ...existing.dataRoom, ...data.dataRoom };
      if (data.companyProfile) patch.companyProfile = { ...existing.companyProfile, ...data.companyProfile };
      const [row] = await db
        .update(startupMetricsProfile)
        .set(patch)
        .where(eq(startupMetricsProfile.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(startupMetricsProfile)
      .values({ startupId, ...data })
      .returning();
    return row;
  },

  async listAchievements(startupId: string): Promise<StartupAchievement[]> {
    return db
      .select()
      .from(startupAchievements)
      .where(eq(startupAchievements.startupId, startupId))
      .orderBy(desc(startupAchievements.createdAt));
  },

  async createAchievement(startupId: string, data: { achievedAt?: string | null; details: string }): Promise<StartupAchievement> {
    const [row] = await db.insert(startupAchievements).values({ startupId, ...data }).returning();
    return row;
  },

  async getOwnedAchievement(id: string, startupId: string): Promise<StartupAchievement | undefined> {
    const [row] = await db
      .select()
      .from(startupAchievements)
      .where(and(eq(startupAchievements.id, id), eq(startupAchievements.startupId, startupId)));
    return row;
  },

  async deleteAchievement(id: string): Promise<void> {
    await db.delete(startupAchievements).where(eq(startupAchievements.id, id));
  },

  /* ---------------- CRM ---------------- */
  async listCrmEntries(startupId: string): Promise<StartupCrmEntry[]> {
    return db
      .select()
      .from(startupCrmEntries)
      .where(eq(startupCrmEntries.startupId, startupId))
      .orderBy(asc(startupCrmEntries.createdAt));
  },

  async createCrmEntry(startupId: string, data: Partial<typeof startupCrmEntries.$inferInsert> & { category: "investor" | "client" | "partner"; name: string }): Promise<StartupCrmEntry> {
    const [row] = await db.insert(startupCrmEntries).values({ startupId, ...data }).returning();
    return row;
  },

  async getOwnedCrmEntry(id: string, startupId: string): Promise<StartupCrmEntry | undefined> {
    const [row] = await db
      .select()
      .from(startupCrmEntries)
      .where(and(eq(startupCrmEntries.id, id), eq(startupCrmEntries.startupId, startupId)));
    return row;
  },

  async updateCrmEntry(id: string, data: Partial<typeof startupCrmEntries.$inferInsert>): Promise<StartupCrmEntry> {
    const [row] = await db
      .update(startupCrmEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(startupCrmEntries.id, id))
      .returning();
    return row;
  },

  async deleteCrmEntry(id: string): Promise<void> {
    await db.delete(startupCrmEntries).where(eq(startupCrmEntries.id, id));
  },

  /* ---------------- Data Room ---------------- */
  async listDocuments(startupId: string): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(eq(documents.startupId, startupId))
      .orderBy(desc(documents.createdAt));
  },

  async getOwnedDocument(id: string, startupId: string): Promise<Document | undefined> {
    const [row] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.startupId, startupId)));
    return row;
  },

  async getDocumentById(id: string): Promise<Document | undefined> {
    const [row] = await db.select().from(documents).where(eq(documents.id, id));
    return row;
  },

  // Admin: every Data Room document across every startup.
  async listAllDocumentsWithStartups() {
    return db
      .select({
        id: documents.id,
        startupId: documents.startupId,
        category: documents.category,
        checklistKey: documents.checklistKey,
        title: documents.title,
        fileUrl: documents.fileUrl,
        fileName: documents.fileName,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        status: documents.status,
        reviewNote: documents.reviewNote,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        companyName: startups.companyName,
        ownerEmail: users.email,
      })
      .from(documents)
      .innerJoin(startups, eq(documents.startupId, startups.id))
      .leftJoin(users, eq(startups.userId, users.id))
      .orderBy(desc(documents.createdAt));
  },

  async createDocument(
    startupId: string,
    data: {
      category: "legal" | "financial" | "product" | "team" | "fundraising" | "other" | "main_docs" | "intellectual_property" | "metrics";
      checklistKey?: string | null;
      title: string;
      fileUrl: string;
      fileName: string;
      mimeType?: string | null;
      sizeBytes?: number | null;
      uploadedBy: string;
    },
  ): Promise<Document> {
    const [row] = await db.insert(documents).values({ startupId, ...data }).returning();
    return row;
  },

  async replaceDocumentFile(
    id: string,
    data: { fileUrl: string; fileName: string; mimeType?: string | null; sizeBytes?: number | null },
  ): Promise<Document> {
    const [row] = await db
      .update(documents)
      .set({ ...data, status: "pending", reviewNote: null, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return row;
  },

  async reviewDocument(
    id: string,
    status: "approved" | "rejected",
    reviewNote: string | null,
  ): Promise<Document> {
    const [row] = await db
      .update(documents)
      .set({ status, reviewNote, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return row;
  },

  async listDocumentEvents(documentId: string): Promise<DocumentEvent[]> {
    return db
      .select()
      .from(documentEvents)
      .where(eq(documentEvents.documentId, documentId))
      .orderBy(desc(documentEvents.createdAt));
  },

  async addDocumentEvent(data: {
    documentId: string;
    startupId: string;
    action: "uploaded" | "replaced" | "approved" | "rejected" | "commented";
    note?: string | null;
    actorId?: string | null;
  }): Promise<DocumentEvent> {
    const [row] = await db.insert(documentEvents).values(data).returning();
    return row;
  },

  /* ---------------- Data Room external sharing ---------------- */
  async createDataRoomShare(data: {
    startupId: string;
    token: string;
    title: string | null;
    documentIds: string[];
    expiresAt: Date;
    createdBy: string;
  }): Promise<DataRoomShare> {
    const [row] = await db.insert(dataRoomShares).values(data).returning();
    return row;
  },

  async listDataRoomShares(startupId: string): Promise<DataRoomShare[]> {
    return db
      .select()
      .from(dataRoomShares)
      .where(eq(dataRoomShares.startupId, startupId))
      .orderBy(desc(dataRoomShares.createdAt));
  },

  async getOwnedDataRoomShare(id: string, startupId: string): Promise<DataRoomShare | undefined> {
    const [row] = await db
      .select()
      .from(dataRoomShares)
      .where(and(eq(dataRoomShares.id, id), eq(dataRoomShares.startupId, startupId)));
    return row;
  },

  async revokeDataRoomShare(id: string): Promise<DataRoomShare> {
    const [row] = await db
      .update(dataRoomShares)
      .set({ revokedAt: new Date() })
      .where(eq(dataRoomShares.id, id))
      .returning();
    return row;
  },

  /** Public lookup by token — no ownership check, this is the whole point. */
  async getDataRoomShareByToken(token: string): Promise<DataRoomShare | undefined> {
    const [row] = await db.select().from(dataRoomShares).where(eq(dataRoomShares.token, token));
    return row;
  },

  async recordDataRoomShareView(id: string): Promise<void> {
    await db
      .update(dataRoomShares)
      .set({ viewCount: sql`${dataRoomShares.viewCount} + 1`, lastViewedAt: new Date() })
      .where(eq(dataRoomShares.id, id));
  },

  async listDocumentsByIds(ids: string[]): Promise<Document[]> {
    if (ids.length === 0) return [];
    return db.select().from(documents).where(inArray(documents.id, ids));
  },

  /* ---------------- Contract & KYS ---------------- */
  async getContract(startupId: string): Promise<Contract | undefined> {
    const [row] = await db.select().from(contracts).where(eq(contracts.startupId, startupId));
    return row;
  },

  async getContractById(id: string): Promise<Contract | undefined> {
    const [row] = await db.select().from(contracts).where(eq(contracts.id, id));
    return row;
  },

  async submitContract(
    startupId: string,
    data: { fileUrl: string; fileName: string },
  ): Promise<Contract> {
    const existing = await this.getContract(startupId);
    if (existing) {
      // Re-uploading after a rejection (or a replacement) puts it back up for review.
      const [row] = await db
        .update(contracts)
        .set({
          ...data,
          uploadedAt: new Date(),
          status: "pending",
          reviewNote: null,
          reviewedBy: null,
          reviewedAt: null,
        })
        .where(eq(contracts.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(contracts).values({ startupId, ...data, uploadedAt: new Date() }).returning();
    return row;
  },

  async listContractsWithStartups() {
    return db
      .select({
        id: contracts.id,
        startupId: contracts.startupId,
        fileUrl: contracts.fileUrl,
        fileName: contracts.fileName,
        uploadedAt: contracts.uploadedAt,
        status: contracts.status,
        reviewNote: contracts.reviewNote,
        reviewedAt: contracts.reviewedAt,
        companyName: startups.companyName,
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(contracts)
      .leftJoin(startups, eq(contracts.startupId, startups.id))
      .leftJoin(users, eq(startups.userId, users.id))
      .orderBy(desc(contracts.uploadedAt));
  },

  async reviewContract(
    id: string,
    status: "approved" | "rejected",
    reviewNote: string | null,
    reviewedBy: string,
  ): Promise<Contract> {
    const [row] = await db
      .update(contracts)
      .set({ status, reviewNote, reviewedBy, reviewedAt: new Date() })
      .where(eq(contracts.id, id))
      .returning();
    return row;
  },

  async listContractEvents(contractId: string): Promise<ContractEvent[]> {
    return db
      .select()
      .from(contractEvents)
      .where(eq(contractEvents.contractId, contractId))
      .orderBy(desc(contractEvents.createdAt));
  },

  async addContractEvent(data: {
    contractId: string;
    startupId: string;
    action: "signed" | "uploaded" | "approved" | "rejected" | "commented";
    note?: string | null;
    actorId?: string | null;
  }): Promise<ContractEvent> {
    const [row] = await db.insert(contractEvents).values(data).returning();
    return row;
  },

  async getKysProfile(startupId: string): Promise<KysProfile | undefined> {
    const [row] = await db.select().from(kysProfiles).where(eq(kysProfiles.startupId, startupId));
    return row;
  },

  async getKysProfileById(id: string): Promise<KysProfile | undefined> {
    const [row] = await db.select().from(kysProfiles).where(eq(kysProfiles.id, id));
    return row;
  },

  async submitKysProfile(
    startupId: string,
    data: Omit<typeof kysProfiles.$inferInsert, "id" | "startupId" | "createdAt" | "updatedAt" | "submittedAt">,
  ): Promise<KysProfile> {
    const existing = await this.getKysProfile(startupId);
    if (existing) {
      // Re-submitting after a rejection (or any edit) puts it back up for review.
      const [row] = await db
        .update(kysProfiles)
        .set({
          ...data,
          submittedAt: new Date(),
          updatedAt: new Date(),
          status: "pending",
          reviewNote: null,
          reviewedBy: null,
          reviewedAt: null,
        })
        .where(eq(kysProfiles.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(kysProfiles).values({ startupId, ...data }).returning();
    return row;
  },

  async listKysProfilesWithStartups() {
    return db
      .select({
        id: kysProfiles.id,
        startupId: kysProfiles.startupId,
        track: kysProfiles.track,
        incorporated: kysProfiles.incorporated,
        submittedAt: kysProfiles.submittedAt,
        status: kysProfiles.status,
        reviewNote: kysProfiles.reviewNote,
        reviewedAt: kysProfiles.reviewedAt,
        companyName: startups.companyName,
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(kysProfiles)
      .leftJoin(startups, eq(kysProfiles.startupId, startups.id))
      .leftJoin(users, eq(startups.userId, users.id))
      .orderBy(desc(kysProfiles.submittedAt));
  },

  async reviewKysProfile(
    id: string,
    status: "approved" | "rejected",
    reviewNote: string | null,
    reviewedBy: string,
  ): Promise<KysProfile> {
    const [row] = await db
      .update(kysProfiles)
      .set({ status, reviewNote, reviewedBy, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(kysProfiles.id, id))
      .returning();
    return row;
  },

  async listKysEvents(kysProfileId: string): Promise<KysEvent[]> {
    return db
      .select()
      .from(kysEvents)
      .where(eq(kysEvents.kysProfileId, kysProfileId))
      .orderBy(desc(kysEvents.createdAt));
  },

  async addKysEvent(data: {
    kysProfileId: string;
    startupId: string;
    action: "submitted" | "approved" | "rejected" | "commented";
    note?: string | null;
    actorId?: string | null;
  }): Promise<KysEvent> {
    const [row] = await db.insert(kysEvents).values(data).returning();
    return row;
  },

  async listKysDocuments(startupId: string): Promise<KysDocument[]> {
    return db
      .select()
      .from(kysDocuments)
      .where(eq(kysDocuments.startupId, startupId))
      .orderBy(desc(kysDocuments.createdAt));
  },

  async upsertKysDocument(
    startupId: string,
    data: {
      docType:
        | "certificate_of_incorporation"
        | "proof_of_address"
        | "irs_form"
        | "banking"
        | "declaration"
        | "identity_document";
      fileUrl: string;
      fileName: string;
    },
  ): Promise<KysDocument> {
    // One document per (startup, docType) — re-uploading the same slot replaces it.
    const [existing] = await db
      .select()
      .from(kysDocuments)
      .where(and(eq(kysDocuments.startupId, startupId), eq(kysDocuments.docType, data.docType)));
    if (existing) {
      const [row] = await db
        .update(kysDocuments)
        .set({ fileUrl: data.fileUrl, fileName: data.fileName, createdAt: new Date() })
        .where(eq(kysDocuments.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(kysDocuments).values({ startupId, ...data }).returning();
    return row;
  },

  /* ---------------- Quarterly updates (Dashboard) ---------------- */
  async listMonthlyUpdates(startupId: string): Promise<MonthlyUpdate[]> {
    return db
      .select()
      .from(monthlyUpdates)
      .where(eq(monthlyUpdates.startupId, startupId))
      .orderBy(desc(monthlyUpdates.periodYear), desc(monthlyUpdates.periodQuarter));
  },

  async upsertMonthlyUpdate(
    startupId: string,
    data: {
      periodMonth: number;
      periodQuarter: number;
      periodYear: number;
      achieved: string;
      blocked: string;
      focusNext: string;
      status?: "on_track" | "at_risk" | "off_track";
      supportNeeded?: string | null;
    },
  ): Promise<MonthlyUpdate> {
    // One row per (startup, quarter, year) going forward — if legacy monthly
    // rows land in the same quarter, the most recently touched one is what
    // a new submission updates; older ones stay visible in history as-is.
    const [existing] = await db
      .select()
      .from(monthlyUpdates)
      .where(
        and(
          eq(monthlyUpdates.startupId, startupId),
          eq(monthlyUpdates.periodQuarter, data.periodQuarter),
          eq(monthlyUpdates.periodYear, data.periodYear),
        ),
      )
      .orderBy(desc(monthlyUpdates.updatedAt))
      .limit(1);
    if (existing) {
      const [row] = await db
        .update(monthlyUpdates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(monthlyUpdates.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(monthlyUpdates).values({ startupId, ...data }).returning();
    return row;
  },

  /* ---------------- Team (Dashboard) ---------------- */
  async listTeamMembers(startupId: string): Promise<TeamMember[]> {
    return db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.startupId, startupId))
      .orderBy(asc(teamMembers.joinedAt));
  },

  async createTeamMember(
    startupId: string,
    data: { name: string; role?: string | null; type: "founder" | "full_time" | "part_time" | "advisor" },
  ): Promise<TeamMember> {
    const [row] = await db.insert(teamMembers).values({ startupId, ...data }).returning();
    return row;
  },

  async getOwnedTeamMember(id: string, startupId: string): Promise<TeamMember | undefined> {
    const [row] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, id), eq(teamMembers.startupId, startupId)));
    return row;
  },

  async deleteTeamMember(id: string): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  },

  /* ---------------- Cap Table (Dashboard overview) ---------------- */
  async listCapTableEntries(startupId: string): Promise<CapTableEntry[]> {
    return db
      .select()
      .from(capTableEntries)
      .where(eq(capTableEntries.startupId, startupId))
      .orderBy(asc(capTableEntries.createdAt));
  },

  async createCapTableEntry(
    startupId: string,
    data: { name: string; percentage: number },
  ): Promise<CapTableEntry> {
    const [row] = await db.insert(capTableEntries).values({ startupId, ...data }).returning();
    return row;
  },

  async getOwnedCapTableEntry(id: string, startupId: string): Promise<CapTableEntry | undefined> {
    const [row] = await db
      .select()
      .from(capTableEntries)
      .where(and(eq(capTableEntries.id, id), eq(capTableEntries.startupId, startupId)));
    return row;
  },

  async deleteCapTableEntry(id: string): Promise<void> {
    await db.delete(capTableEntries).where(eq(capTableEntries.id, id));
  },

  /* ---------------- Office Hours ---------------- */
  async listUpcomingOfficeHourSlots(): Promise<(OfficeHourSlot & { bookedCount: number })[]> {
    const rows = await db
      .select({
        slot: officeHourSlots,
        bookedCount: sql<number>`count(${officeHourBookings.id}) filter (where ${officeHourBookings.status} = 'booked')::int`,
      })
      .from(officeHourSlots)
      .leftJoin(officeHourBookings, eq(officeHourBookings.slotId, officeHourSlots.id))
      .where(sql`${officeHourSlots.startsAt} > now()`)
      .groupBy(officeHourSlots.id)
      .orderBy(asc(officeHourSlots.startsAt));
    return rows.map((r) => ({ ...r.slot, bookedCount: r.bookedCount }));
  },

  async getOfficeHourSlot(id: string): Promise<OfficeHourSlot | undefined> {
    const [row] = await db.select().from(officeHourSlots).where(eq(officeHourSlots.id, id));
    return row;
  },

  async createOfficeHourSlot(data: {
    hostName: string;
    topic?: string | null;
    startsAt: Date;
    endsAt: Date;
    capacity?: number;
    meetingLink?: string | null;
  }): Promise<OfficeHourSlot> {
    const [row] = await db.insert(officeHourSlots).values(data).returning();
    return row;
  },

  async countBookingsForSlot(slotId: string): Promise<number> {
    const [row] = await db
      .select({ c: count() })
      .from(officeHourBookings)
      .where(and(eq(officeHourBookings.slotId, slotId), eq(officeHourBookings.status, "booked")));
    return row?.c ?? 0;
  },

  async listOfficeHourBookingsByStartup(startupId: string): Promise<
    (OfficeHourBooking & { slot: OfficeHourSlot })[]
  > {
    const rows = await db
      .select({ booking: officeHourBookings, slot: officeHourSlots })
      .from(officeHourBookings)
      .innerJoin(officeHourSlots, eq(officeHourBookings.slotId, officeHourSlots.id))
      .where(eq(officeHourBookings.startupId, startupId))
      .orderBy(desc(officeHourSlots.startsAt));
    return rows.map((r) => ({ ...r.booking, slot: r.slot }));
  },

  async createOfficeHourBooking(
    startupId: string,
    slotId: string,
    topic?: string | null,
  ): Promise<OfficeHourBooking> {
    const [row] = await db
      .insert(officeHourBookings)
      .values({ startupId, slotId, topic: topic ?? null })
      .returning();
    return row;
  },

  async getOwnedOfficeHourBooking(
    id: string,
    startupId: string,
  ): Promise<OfficeHourBooking | undefined> {
    const [row] = await db
      .select()
      .from(officeHourBookings)
      .where(and(eq(officeHourBookings.id, id), eq(officeHourBookings.startupId, startupId)));
    return row;
  },

  async cancelOfficeHourBooking(id: string): Promise<OfficeHourBooking> {
    const [row] = await db
      .update(officeHourBookings)
      .set({ status: "cancelled" })
      .where(eq(officeHourBookings.id, id))
      .returning();
    return row;
  },

  /* ---------------- Open Startup School ---------------- */
  async listTrainings(): Promise<Training[]> {
    return db.select().from(trainings).orderBy(asc(trainings.module), asc(trainings.orderIndex));
  },

  async getTrainingById(id: string): Promise<Training | undefined> {
    const [row] = await db.select().from(trainings).where(eq(trainings.id, id));
    return row;
  },

  // Admin: curriculum content management (create/edit/reorder/delete trainings).
  async createTraining(data: {
    module: "expertise" | "immersions" | "alumni";
    title: string;
    description?: string | null;
    resourceUrl?: string | null;
    unlockMonth?: number;
  }): Promise<Training> {
    const [{ c }] = await db
      .select({ c: sql<number>`coalesce(max(${trainings.orderIndex}), -1)::int` })
      .from(trainings)
      .where(eq(trainings.module, data.module));
    const [row] = await db.insert(trainings).values({ ...data, orderIndex: c + 1 }).returning();
    return row;
  },

  async updateTraining(
    id: string,
    data: Partial<{
      module: "expertise" | "immersions" | "alumni";
      title: string;
      description: string | null;
      resourceUrl: string | null;
      unlockMonth: number;
      orderIndex: number;
    }>,
  ): Promise<Training> {
    const [row] = await db.update(trainings).set(data).where(eq(trainings.id, id)).returning();
    return row;
  },

  async deleteTraining(id: string): Promise<void> {
    await db.delete(trainings).where(eq(trainings.id, id));
  },

  async listTrainingProgress(startupId: string): Promise<TrainingProgress[]> {
    return db
      .select()
      .from(trainingProgress)
      .where(eq(trainingProgress.startupId, startupId));
  },

  /**
   * Merge the training catalogue with a startup's progress + program timeline
   * to compute each training's effective status (locked / available /
   * in_progress / completed).
   */
  async listSchoolForStartup(startup: Startup) {
    const [all, progressRows] = await Promise.all([
      this.listTrainings(),
      this.listTrainingProgress(startup.id),
    ]);
    const progressByTraining = new Map(progressRows.map((p) => [p.trainingId, p]));
    const elapsedMonths = monthsBetween(new Date(startup.createdAt), new Date());
    return all.map((t) => {
      const progress = progressByTraining.get(t.id);
      let status: "locked" | "available" | "in_progress" | "completed";
      if (progress?.status === "completed") {
        status = "completed";
      } else if (t.module === "alumni") {
        status = startup.graduatedAt ? (progress?.status ?? "available") : "locked";
      } else if (elapsedMonths < t.unlockMonth) {
        status = "locked";
      } else {
        status = progress?.status ?? "available";
      }
      return { ...t, status, completedAt: progress?.completedAt ?? null };
    });
  },

  async setTrainingProgress(
    startupId: string,
    trainingId: string,
    status: "in_progress" | "completed",
  ): Promise<TrainingProgress> {
    const [existing] = await db
      .select()
      .from(trainingProgress)
      .where(
        and(eq(trainingProgress.startupId, startupId), eq(trainingProgress.trainingId, trainingId)),
      );
    const completedAt = status === "completed" ? new Date() : null;
    if (existing) {
      const [row] = await db
        .update(trainingProgress)
        .set({ status, completedAt, updatedAt: new Date() })
        .where(eq(trainingProgress.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(trainingProgress)
      .values({ startupId, trainingId, status, completedAt })
      .returning();
    return row;
  },

  /* ---------------- Mentorship (per-startup sessions, no modules/locking) ---------------- */
  async listMentorshipSessionsForFounder(startupId: string) {
    const [sessions, notes] = await Promise.all([
      db.select().from(mentorshipModuleSessions).where(eq(mentorshipModuleSessions.startupId, startupId)).orderBy(asc(mentorshipModuleSessions.scheduledAt)),
      db.select().from(mentorshipSessionNotes).where(eq(mentorshipSessionNotes.startupId, startupId)),
    ]);
    const notesBySessionId = new Map(notes.map((n) => [n.sessionId, n]));
    const emptyNotes = {
      teamMembersPresence: null,
      pointsDiscussed: null,
      whatIsGoingWell: null,
      whatIsNotGoingWell: null,
      actionItems: null,
      mentorRating: null,
      mentorFeedback: null,
    };
    return sessions.map((s) => ({ ...s, notes: notesBySessionId.get(s.id) ?? emptyNotes }));
  },

  async listMentorshipSessionsForStartup(startupId: string): Promise<MentorshipModuleSession[]> {
    return db
      .select()
      .from(mentorshipModuleSessions)
      .where(eq(mentorshipModuleSessions.startupId, startupId))
      .orderBy(asc(mentorshipModuleSessions.scheduledAt));
  },

  async getMentorshipModuleSessionById(id: string): Promise<MentorshipModuleSession | undefined> {
    const [row] = await db.select().from(mentorshipModuleSessions).where(eq(mentorshipModuleSessions.id, id));
    return row;
  },

  async getMentorshipModuleSessionByZoomMeetingId(zoomMeetingId: string): Promise<MentorshipModuleSession | undefined> {
    const [row] = await db
      .select()
      .from(mentorshipModuleSessions)
      .where(eq(mentorshipModuleSessions.zoomMeetingId, zoomMeetingId));
    return row;
  },

  async createMentorshipModuleSession(data: {
    startupId: string;
    number: number;
    title: string;
    description?: string | null;
    scheduledAt: Date;
    durationMinutes?: number;
    experts?: string | null;
    status?: "upcoming" | "completed";
    meetingLink?: string | null;
    recordingUrl?: string | null;
    transcriptUrl?: string | null;
    materialsUrl?: string | null;
    mentorBio?: string | null;
    zoomMeetingId?: string | null;
    zoomHostEmail?: string | null;
  }): Promise<MentorshipModuleSession> {
    const [row] = await db
      .insert(mentorshipModuleSessions)
      .values(data)
      .returning();
    return row;
  },

  async updateMentorshipModuleSession(
    id: string,
    data: Partial<typeof mentorshipModuleSessions.$inferInsert>,
  ): Promise<MentorshipModuleSession> {
    const [row] = await db
      .update(mentorshipModuleSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mentorshipModuleSessions.id, id))
      .returning();
    return row;
  },

  async deleteMentorshipModuleSession(id: string): Promise<void> {
    await db.delete(mentorshipModuleSessions).where(eq(mentorshipModuleSessions.id, id));
  },

  /* ---------------- Mentorship session notes (per session, per startup) ---------------- */
  async listMentorshipSessionNotesForStartup(startupId: string): Promise<MentorshipSessionNotes[]> {
    return db.select().from(mentorshipSessionNotes).where(eq(mentorshipSessionNotes.startupId, startupId));
  },

  async getMentorshipSessionNotes(sessionId: string, startupId: string): Promise<MentorshipSessionNotes | undefined> {
    const [row] = await db
      .select()
      .from(mentorshipSessionNotes)
      .where(and(eq(mentorshipSessionNotes.sessionId, sessionId), eq(mentorshipSessionNotes.startupId, startupId)));
    return row;
  },

  // Admin/mentor-owned fields only.
  async upsertMentorshipSessionNotes(
    sessionId: string,
    startupId: string,
    data: {
      teamMembersPresence?: string | null;
      pointsDiscussed?: string | null;
      whatIsGoingWell?: string | null;
      whatIsNotGoingWell?: string | null;
      actionItems?: string | null;
      mentorRating?: number | null;
      mentorFeedback?: string | null;
    },
  ): Promise<MentorshipSessionNotes> {
    const existing = await this.getMentorshipSessionNotes(sessionId, startupId);
    if (existing) {
      const [row] = await db
        .update(mentorshipSessionNotes)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(mentorshipSessionNotes.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(mentorshipSessionNotes)
      .values({ sessionId, startupId, ...data })
      .returning();
    return row;
  },

  /* ---------------- Mentor assignment (sourced from the Other-experts catalog) ---------------- */
  async getMentorForStartup(startupId: string): Promise<Expert | undefined> {
    const startup = await this.getStartupById(startupId);
    if (!startup?.mentorId) return undefined;
    return this.getExpertById(startup.mentorId);
  },

  /* ---------------- Training (Modules + Sessions) ---------------- */
  async listTrainingModulesForFounder(startupId: string) {
    const [modules, sessions, notes, homework, targets] = await Promise.all([
      db.select().from(trainingModules).orderBy(asc(trainingModules.number)),
      db.select().from(trainingModuleSessions).orderBy(asc(trainingModuleSessions.number)),
      db.select().from(trainingSessionNotes).where(eq(trainingSessionNotes.startupId, startupId)),
      db.select().from(trainingModuleHomework).where(eq(trainingModuleHomework.startupId, startupId)),
      db.select().from(trainingSessionStartups).where(eq(trainingSessionStartups.startupId, startupId)),
    ]);
    const notesBySessionId = new Map(notes.map((n) => [n.sessionId, n]));
    const homeworkByModuleId = new Map(homework.map((h) => [h.moduleId, h]));
    const targetedSessionIds = new Set(targets.map((t) => t.sessionId));
    const emptyNotes = {
      teamMembersPresence: null,
      pointsDiscussed: null,
      whatIsGoingWell: null,
      whatIsNotGoingWell: null,
      actionItems: null,
      trainerRating: null,
      trainerFeedback: null,
    };
    const emptyHomework = { homeworkUrl: null, submissionFileUrl: null, submissionFileName: null };
    return modules.map((m) => {
      // Locked modules never leak their session content to the founder side,
      // and a session only shows if this startup is one of its targets.
      const moduleSessions = m.unlocked
        ? sessions
            .filter((s) => s.moduleId === m.id && targetedSessionIds.has(s.id))
            .map((s) => ({ ...s, notes: notesBySessionId.get(s.id) ?? emptyNotes }))
        : [];
      return {
        ...m,
        sessions: moduleSessions,
        status: computeModuleStatus(m.unlocked, moduleSessions),
        completedSessionsCount: moduleSessions.filter((s) => s.status === "completed").length,
        totalSessionsCount: moduleSessions.length,
        homework: m.unlocked ? homeworkByModuleId.get(m.id) ?? emptyHomework : emptyHomework,
      };
    });
  },

  async listTrainingModulesWithSessions() {
    const [modules, sessions, targets] = await Promise.all([
      db.select().from(trainingModules).orderBy(asc(trainingModules.number)),
      db.select().from(trainingModuleSessions).orderBy(asc(trainingModuleSessions.number)),
      db.select().from(trainingSessionStartups),
    ]);
    const startupIdsBySessionId = new Map<string, string[]>();
    for (const t of targets) {
      const list = startupIdsBySessionId.get(t.sessionId) ?? [];
      list.push(t.startupId);
      startupIdsBySessionId.set(t.sessionId, list);
    }
    return modules.map((m) => ({
      ...m,
      sessions: sessions
        .filter((s) => s.moduleId === m.id)
        .map((s) => ({ ...s, startupIds: startupIdsBySessionId.get(s.id) ?? [] })),
    }));
  },

  async listTrainingSessionsForStartup(startupId: string) {
    const targets = await db.select().from(trainingSessionStartups).where(eq(trainingSessionStartups.startupId, startupId));
    if (targets.length === 0) return [];
    const sessionIds = targets.map((t) => t.sessionId);
    const [sessions, modules] = await Promise.all([
      db.select().from(trainingModuleSessions).where(inArray(trainingModuleSessions.id, sessionIds)),
      db.select().from(trainingModules),
    ]);
    const moduleById = new Map(modules.map((m) => [m.id, m]));
    return sessions
      .map((s) => ({ ...s, moduleTitle: moduleById.get(s.moduleId)?.title ?? null }))
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  },

  async getTrainingSessionStartupIds(sessionId: string): Promise<string[]> {
    const rows = await db.select().from(trainingSessionStartups).where(eq(trainingSessionStartups.sessionId, sessionId));
    return rows.map((r) => r.startupId);
  },

  async setTrainingSessionStartups(sessionId: string, startupIds: string[]): Promise<void> {
    await db.delete(trainingSessionStartups).where(eq(trainingSessionStartups.sessionId, sessionId));
    if (startupIds.length > 0) {
      await db.insert(trainingSessionStartups).values(startupIds.map((startupId) => ({ sessionId, startupId })));
    }
  },

  async getTrainingModuleById(id: string): Promise<TrainingModule | undefined> {
    const [row] = await db.select().from(trainingModules).where(eq(trainingModules.id, id));
    return row;
  },

  async createTrainingModule(data: {
    number: number;
    title: string;
    description?: string | null;
    durationLabel?: string | null;
    unlocked?: boolean;
  }): Promise<TrainingModule> {
    const [row] = await db
      .insert(trainingModules)
      .values({ ...data, unlockedAt: data.unlocked ? new Date() : null })
      .returning();
    return row;
  },

  async updateTrainingModule(
    id: string,
    data: Partial<typeof trainingModules.$inferInsert>,
  ): Promise<TrainingModule> {
    const patch: Partial<typeof trainingModules.$inferInsert> = { ...data, updatedAt: new Date() };
    if (data.unlocked === true) {
      const existing = await this.getTrainingModuleById(id);
      if (existing && !existing.unlocked) patch.unlockedAt = new Date();
    }
    const [row] = await db
      .update(trainingModules)
      .set(patch)
      .where(eq(trainingModules.id, id))
      .returning();
    return row;
  },

  async deleteTrainingModule(id: string): Promise<void> {
    await db.delete(trainingModules).where(eq(trainingModules.id, id));
  },

  async getTrainingModuleSessionById(id: string): Promise<TrainingModuleSession | undefined> {
    const [row] = await db.select().from(trainingModuleSessions).where(eq(trainingModuleSessions.id, id));
    return row;
  },

  async getTrainingModuleSessionByZoomMeetingId(zoomMeetingId: string): Promise<TrainingModuleSession | undefined> {
    const [row] = await db
      .select()
      .from(trainingModuleSessions)
      .where(eq(trainingModuleSessions.zoomMeetingId, zoomMeetingId));
    return row;
  },

  async createTrainingModuleSession(
    moduleId: string,
    data: {
      number: number;
      title: string;
      description?: string | null;
      scheduledAt: Date;
      durationMinutes?: number;
      experts?: string | null;
      status?: "upcoming" | "completed";
      meetingLink?: string | null;
      presentationUrl?: string | null;
      recordingUrl?: string | null;
      transcriptUrl?: string | null;
      trainerBio?: string | null;
      zoomMeetingId?: string | null;
      zoomHostEmail?: string | null;
    },
  ): Promise<TrainingModuleSession> {
    const [row] = await db
      .insert(trainingModuleSessions)
      .values({ moduleId, ...data })
      .returning();
    return row;
  },

  async updateTrainingModuleSession(
    id: string,
    data: Partial<typeof trainingModuleSessions.$inferInsert>,
  ): Promise<TrainingModuleSession> {
    const [row] = await db
      .update(trainingModuleSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trainingModuleSessions.id, id))
      .returning();
    return row;
  },

  async deleteTrainingModuleSession(id: string): Promise<void> {
    await db.delete(trainingModuleSessions).where(eq(trainingModuleSessions.id, id));
  },

  /* ---------------- Training session notes (per session, per startup) ---------------- */
  async listTrainingSessionNotesForStartup(startupId: string): Promise<TrainingSessionNotes[]> {
    return db.select().from(trainingSessionNotes).where(eq(trainingSessionNotes.startupId, startupId));
  },

  async getTrainingSessionNotes(sessionId: string, startupId: string): Promise<TrainingSessionNotes | undefined> {
    const [row] = await db
      .select()
      .from(trainingSessionNotes)
      .where(and(eq(trainingSessionNotes.sessionId, sessionId), eq(trainingSessionNotes.startupId, startupId)));
    return row;
  },

  // Admin/trainer-owned fields only.
  async upsertTrainingSessionNotes(
    sessionId: string,
    startupId: string,
    data: {
      teamMembersPresence?: string | null;
      pointsDiscussed?: string | null;
      whatIsGoingWell?: string | null;
      whatIsNotGoingWell?: string | null;
      actionItems?: string | null;
      trainerRating?: number | null;
      trainerFeedback?: string | null;
    },
  ): Promise<TrainingSessionNotes> {
    const existing = await this.getTrainingSessionNotes(sessionId, startupId);
    if (existing) {
      const [row] = await db
        .update(trainingSessionNotes)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(trainingSessionNotes.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(trainingSessionNotes)
      .values({ sessionId, startupId, ...data })
      .returning();
    return row;
  },

  /* ---------------- Training module homework (per module, per startup) ---------------- */
  async listTrainingModuleHomeworkForStartup(startupId: string): Promise<TrainingModuleHomework[]> {
    return db.select().from(trainingModuleHomework).where(eq(trainingModuleHomework.startupId, startupId));
  },

  async getTrainingModuleHomework(moduleId: string, startupId: string): Promise<TrainingModuleHomework | undefined> {
    const [row] = await db
      .select()
      .from(trainingModuleHomework)
      .where(and(eq(trainingModuleHomework.moduleId, moduleId), eq(trainingModuleHomework.startupId, startupId)));
    return row;
  },

  // Admin-owned field only — never touches the founder's submission.
  async upsertTrainingModuleHomeworkAssignment(
    moduleId: string,
    startupId: string,
    homeworkUrl: string | null,
  ): Promise<TrainingModuleHomework> {
    const existing = await this.getTrainingModuleHomework(moduleId, startupId);
    if (existing) {
      const [row] = await db
        .update(trainingModuleHomework)
        .set({ homeworkUrl, updatedAt: new Date() })
        .where(eq(trainingModuleHomework.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(trainingModuleHomework)
      .values({ moduleId, startupId, homeworkUrl })
      .returning();
    return row;
  },

  // Founder-owned fields only — never touches the admin's assignment.
  async upsertTrainingModuleHomeworkSubmission(
    moduleId: string,
    startupId: string,
    fileUrl: string,
    fileName: string,
  ): Promise<TrainingModuleHomework> {
    const existing = await this.getTrainingModuleHomework(moduleId, startupId);
    if (existing) {
      const [row] = await db
        .update(trainingModuleHomework)
        .set({ submissionFileUrl: fileUrl, submissionFileName: fileName, updatedAt: new Date() })
        .where(eq(trainingModuleHomework.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(trainingModuleHomework)
      .values({ moduleId, startupId, submissionFileUrl: fileUrl, submissionFileName: fileName })
      .returning();
    return row;
  },

  /* ---------------- Trainers (reusable directory, one assigned per startup) ---------------- */
  async listTrainers(): Promise<Trainer[]> {
    return db.select().from(trainers).orderBy(asc(trainers.name));
  },

  async getTrainerById(id: string): Promise<Trainer | undefined> {
    const [row] = await db.select().from(trainers).where(eq(trainers.id, id));
    return row;
  },

  async createTrainer(data: {
    name: string;
    introduction?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    linkedinUrl?: string | null;
  }): Promise<Trainer> {
    const [row] = await db.insert(trainers).values(data).returning();
    return row;
  },

  async updateTrainer(id: string, data: Partial<typeof trainers.$inferInsert>): Promise<Trainer> {
    const [row] = await db
      .update(trainers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trainers.id, id))
      .returning();
    return row;
  },

  async deleteTrainer(id: string): Promise<void> {
    await db.delete(trainers).where(eq(trainers.id, id));
  },

  async getTrainerForStartup(startupId: string): Promise<Trainer | undefined> {
    const startup = await this.getStartupById(startupId);
    if (!startup?.trainerId) return undefined;
    return this.getTrainerById(startup.trainerId);
  },

  /* ---------------- Experts ("Other experts" catalog, browse-only) ---------------- */
  async listExperts(): Promise<Expert[]> {
    return db.select().from(experts).orderBy(asc(experts.name));
  },

  async getExpertById(id: string): Promise<Expert | undefined> {
    const [row] = await db.select().from(experts).where(eq(experts.id, id));
    return row;
  },

  async createExpert(data: {
    name: string;
    bio?: string | null;
    industries?: string[];
    expertiseAreas?: string[];
  }): Promise<Expert> {
    const [row] = await db.insert(experts).values(data).returning();
    return row;
  },

  async createExperts(rows: {
    name: string;
    bio?: string | null;
    industries?: string[];
    expertiseAreas?: string[];
  }[]): Promise<Expert[]> {
    if (rows.length === 0) return [];
    return db.insert(experts).values(rows).returning();
  },

  async updateExpert(id: string, data: Partial<typeof experts.$inferInsert>): Promise<Expert> {
    const [row] = await db
      .update(experts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(experts.id, id))
      .returning();
    return row;
  },

  async deleteExpert(id: string): Promise<void> {
    await db.delete(experts).where(eq(experts.id, id));
  },

  /* ---------------- Expert priorities (per startup, per expert) ---------------- */
  async listExpertPrioritiesForStartup(startupId: string): Promise<ExpertPriority[]> {
    return db.select().from(expertPriorities).where(eq(expertPriorities.startupId, startupId));
  },

  async getExpertPriority(expertId: string, startupId: string): Promise<ExpertPriority | undefined> {
    const [row] = await db
      .select()
      .from(expertPriorities)
      .where(and(eq(expertPriorities.expertId, expertId), eq(expertPriorities.startupId, startupId)));
    return row;
  },

  async upsertExpertPriority(expertId: string, startupId: string, priority: number): Promise<ExpertPriority> {
    const existing = await this.getExpertPriority(expertId, startupId);
    if (existing) {
      const [row] = await db
        .update(expertPriorities)
        .set({ priority, updatedAt: new Date() })
        .where(eq(expertPriorities.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(expertPriorities)
      .values({ expertId, startupId, priority })
      .returning();
    return row;
  },
};

function computeModuleStatus(
  unlocked: boolean,
  sessions: { status: string }[],
): "locked" | "upcoming" | "active" | "completed" {
  if (!unlocked) return "locked";
  if (sessions.length > 0 && sessions.every((s) => s.status === "completed")) return "completed";
  if (sessions.some((s) => s.status === "completed")) return "active";
  return "upcoming";
}
