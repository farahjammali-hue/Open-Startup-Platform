import { eq, ne, and, desc, asc, isNotNull, sql, count, inArray } from "drizzle-orm";
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
  mentorshipSessionStartups,
  mentorshipSessionNotes,
  trainingModules,
  trainingModuleStartups,
  trainingModuleSessions,
  trainingSessionStartups,
  trainingSessionNotes,
  trainingModuleHomework,
  trainers,
  experts,
  expertPriorities,
  expertCatalogSettings,
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
  startupFundingRounds,
  startupPatents,
  startupTargetMarkets,
  startupCompetitors,
  startupClientStats,
  startupClientDetails,
  startupPartnerStats,
  startupPartnerDetails,
  aiChatSessions,
  mcpOauthClients,
  mcpOauthTokens,
  type McpOauthClient,
  type AiChatSession,
  type AiChatMessage,
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
  type MentorshipSessionStartup,
  type MentorshipSessionNotes,
  type TrainingModule,
  type TrainingModuleStartup,
  type TrainingModuleSession,
  type TrainingSessionStartup,
  type TrainingSessionNotes,
  type TrainingModuleHomework,
  type Trainer,
  type Expert,
  type ExpertPriority,
  type ExpertCatalogSettings,
  type Contract,
  type ContractEvent,
  type KysProfile,
  type KysEvent,
  type KysDocument,
  type MonthlyUpdate,
  type TeamMember,
  type DataRoomShare,
  type CapTableEntry,
  type StartupFundingRound,
  type StartupPatent,
  type StartupTargetMarket,
  type StartupCompetitor,
  type StartupClientStat,
  type StartupClientDetail,
  type StartupPartnerStat,
  type StartupPartnerDetail,
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

  /** Profile submitted; holds the account until an admin reviews it. */
  async markPendingApproval(userId: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ onboardingStatus: "pending_approval" })
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  /** Applicants waiting on an admin decision, oldest first. */
  /**
   * Full detail for the admin's approval queue: the applicant's whole
   * survey (and KYS, if already submitted) so an admin can actually verify
   * the request, not just see who applied. The applicant's own pending-
   * approval screen deliberately shows none of this (name/email/startup
   * name only) — this data is admin-only.
   */
  async listPendingApprovals(): Promise<
    {
      id: string;
      name: string;
      email: string;
      role: string | null;
      createdAt: Date;
      startup: (typeof startups.$inferSelect) | null;
      kys: (typeof kysProfiles.$inferSelect) | null;
    }[]
  > {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        startup: startups,
        kys: kysProfiles,
      })
      .from(users)
      // Join on the user's ACTIVE startup specifically, not every startup
      // they've ever created — re-doing the Basics step (e.g. via Back)
      // creates a fresh startup row each time, and joining on userId alone
      // would fan out into one duplicate "application" per leftover startup.
      .leftJoin(startups, eq(startups.id, users.activeStartupId))
      .leftJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .where(and(eq(users.onboardingStatus, "pending_approval"), eq(users.isActive, true)))
      .orderBy(asc(users.createdAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      createdAt: r.createdAt,
      startup: r.startup,
      kys: r.kys,
    }));
  },

  /** Admits the applicant: they can now use the platform normally. */
  async approveUser(userId: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ onboardingStatus: "complete" })
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  /**
   * Rejects the applicant. Disables the account rather than deleting it, so
   * there's a record of the decision, and requireAuth's isActive check (which
   * every route already goes through) is what actually keeps them out.
   */
  async rejectUser(userId: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, userId))
      .returning();
    return row;
  },

  /** Active, verified admins — used to notify about new applications. */
  async listAdminEmails(): Promise<{ email: string; name: string | null }[]> {
    return db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true), eq(users.emailVerified, true)));
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

  /**
   * The startup an admin sees when they flip to "Startup view" (App.tsx /
   * Sidebar.tsx use this instead of the admin routes). Auto-provisioned once
   * per admin account: a fully filled-in profile of a strong, top-performing
   * seed-stage startup, so every founder-facing screen — Dashboard, Data
   * Room, Mentorship, Training, CRM, Contract & KYS — has real content
   * instead of empty states. Placeholder file links (contract, KYS docs,
   * data room docs) are clearly named but do not point at real uploads —
   * everything else here is structured data, not files.
   */
  async getOrCreateDemoStartup(userId: string): Promise<Startup> {
    const existing = await this.getStartupsByUserId(userId);
    if (existing.length > 0) return existing[0];

    const [row] = await db
      .insert(startups)
      .values({
        userId,
        companyName: "Verdant Energy",
        website: "https://verdant.energy",
        shortDescription: "Pay-as-you-go solar financing for off-grid households across West Africa.",
        location: "Lagos, Nigeria",
        markets: ["Climate", "Fintech", "Energy Access"],
        stage: "growth",
        revenueLastMonth: 28000,
        revenueLast12Months: 240000,
        detailedDescription:
          "Verdant Energy sells and finances solar home systems on a pay-as-you-go basis to off-grid and " +
          "under-grid households and small shops across Nigeria, Ghana and Ivory Coast. Repayments are collected " +
          "via mobile money and USSD, and an embedded credit-scoring engine — built from two years of repayment " +
          "data — keeps default rates well below the market average.",
        differentiator: "Only pay-as-you-go solar platform with embedded credit scoring built for informal-economy customers.",
        isIncorporated: true,
        startedMonth: 3,
        startedYear: 2022,
        links: {
          linkedin: "https://linkedin.com/company/verdant-energy",
          twitter: "https://twitter.com/verdantenergy",
          instagram: "https://instagram.com/verdantenergy",
        },
        isRaising: true,
        amountRaised: 350000,
        investorsEquityHolders: "Savanna Seed Fund (8%), angel syndicate (4%)",
        runwayMonths: 14,
        isProfitable: false,
        customerTypes: ["b2c", "b2b"],
        interactionPlatforms: ["mobile app", "USSD", "web"],
        techTrack: "soft_tech",
        legalEntityStatus: "yes",
        country: "Nigeria",
        businessModelTypes: ["b2c", "b2b2c"],
        dataRoomUpdatedAt: new Date(),
        coreBusinessOverview:
          "Sells and finances solar home systems on a pay-as-you-go basis, collected via mobile money and USSD.",
        coreIpTechnology: "IoT-enabled solar meters paired with a proprietary embedded credit-scoring engine.",
        uniqueValueProposition:
          "Lower default rates than competitors thanks to two years of proprietary repayment data feeding the credit model.",
        totalRevenueSinceFounding: 410000,
        totalGrants: 25000,
        totalRoundSize: 350000,
        roundTerms: "SAFE, $4M valuation cap, 20% discount",
        lastValuation: 4000000,
        sdgsAddressed: ["SDG 7 — Affordable and Clean Energy", "SDG 1 — No Poverty"],
        femaleTeamMembers: 4,
        youthEmployees: 6,
        countryOfIncorporation: "Nigeria",
        customerBase: "emerging_market",
        countriesOfOperation: "Nigeria, Ghana, Ivory Coast",
        teamSize: 14,
        contractorsCount: 3,
        paidEmployeesCount: 11,
        advisorsCount: 2,
        totalFundingRaised: 350000,
        totalFundingDilutive: 300000,
        totalFundingNonDilutive: 50000,
        investmentStage: "Seed",
        roundSize: 500000,
        committedFunds: 350000,
        mainTechnologies: "IoT solar meters, embedded credit-scoring engine, USSD/mobile-money integration",
        productType: "Hardware-enabled fintech platform",
        productStage: "Live with paying customers",
        trlLevel: 7,
        totalAddressableMarket: "$18B pay-as-you-go solar market across Sub-Saharan Africa",
        serviceableAddressableMarket: "$2.1B across Nigeria, Ghana and Ivory Coast",
        serviceableObtainableMarket: "$40M across current target regions over 3 years",
        mainCompetitors: "M-KOPA, PEG Africa, Bboxx",
        competitionOverview: "Differentiated through proprietary credit scoring and materially lower default rates.",
        idealCustomerPersona: "Off-grid or under-grid households and small shops earning $150-$400/month",
      })
      .returning();

    const startupId = row.id;
    const now = new Date();
    const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);
    const monthsAgo = (n: number) => new Date(now.getTime() - n * 30 * 86400000);

    await db.insert(kysProfiles).values({
      startupId,
      track: "seed",
      incorporated: true,
      addressLine1: "14 Adeola Odeku Street",
      city: "Lagos",
      country: "Nigeria",
      incorporationDate: "2022-04-01",
      tin: "10293847",
      signatoryName: "Amara Okafor",
      signatoryPhone: "+2348012345678",
      signatoryEmail: "amara@verdant.energy",
      irsForm: "w8ben",
      consentAccepted: true,
      status: "approved",
      reviewedAt: monthsAgo(6),
    });

    await db.insert(contracts).values({
      startupId,
      fileUrl: "/placeholder/verdant-energy-program-agreement.pdf",
      fileName: "Program-Agreement-Signed.pdf",
      uploadedAt: monthsAgo(6),
      status: "approved",
      reviewedAt: monthsAgo(6),
    });

    await db.insert(kysDocuments).values([
      { startupId, docType: "certificate_of_incorporation", fileUrl: "/placeholder/certificate-of-incorporation.pdf", fileName: "Certificate-of-Incorporation.pdf" },
      { startupId, docType: "proof_of_address", fileUrl: "/placeholder/proof-of-address.pdf", fileName: "Proof-of-Address.pdf" },
      { startupId, docType: "irs_form", fileUrl: "/placeholder/w8ben.pdf", fileName: "W8-BEN.pdf" },
      { startupId, docType: "banking", fileUrl: "/placeholder/banking-details.pdf", fileName: "Banking-Details.pdf" },
    ]);

    await db.insert(documents).values([
      { startupId, category: "main_docs", title: "Pitch Deck", fileUrl: "/placeholder/verdant-energy-deck.pdf", fileName: "Verdant-Energy-Deck.pdf", status: "approved" },
      { startupId, category: "financial", title: "Financial Model", fileUrl: "/placeholder/financial-model.xlsx", fileName: "Financial-Model.xlsx", status: "approved" },
      { startupId, category: "legal", title: "Certificate of Incorporation", fileUrl: "/placeholder/certificate-of-incorporation.pdf", fileName: "Certificate-of-Incorporation.pdf", status: "approved" },
      { startupId, category: "legal", title: "Shareholder Agreement", fileUrl: "/placeholder/shareholder-agreement.pdf", fileName: "Shareholder-Agreement.pdf", status: "approved" },
      { startupId, category: "product", title: "Product Roadmap", fileUrl: "/placeholder/product-roadmap.pdf", fileName: "Product-Roadmap.pdf", status: "approved" },
    ]);

    await db.insert(goals).values([
      { startupId, title: "Close $350k seed extension", description: "Finalize terms with Savanna Seed Fund and the angel syndicate.", targetDate: daysFromNow(30), status: "on_track" },
      { startupId, title: "Launch in Ghana", description: "Onboard first 500 households in Accra and Kumasi.", targetDate: daysFromNow(75), status: "at_risk" },
      { startupId, title: "Reach 50,000 active customers", description: "Cross the 50k mark on active pay-as-you-go accounts.", targetDate: daysFromNow(150), status: "on_track" },
    ]);

    await db.insert(startupMetricsProfile).values({
      startupId,
      salesNotes: "Strong repeat-purchase rate on accessory add-ons (lanterns, fans) once a household completes its first unit.",
      revenueNotes: "Mobile-money repayments (USSD + app) account for ~92% of revenue; the remainder is cash collected by field agents.",
      teamRecruitNotes: "Hiring a Ghana country lead and two additional embedded-credit data analysts.",
      partnershipNotes: "Distribution partnership with a regional mobile-money operator signed this quarter.",
      fundraisingNotes: "In discussion with Savanna Seed Fund (lead) and a syndicate of climate-focused angels.",
      dataRoom: Object.fromEntries(
        ["website", "product_demo", "deck", "financial_model", "registration_documents", "shareholder_agreement",
         "cap_table", "product_roadmap", "technology_roadmap", "sales_status", "partnerships_overview", "gtm",
         "investor_crm", "trademarks", "patents", "ip"].map((k) => [k, { inception: true, graduation: true }]),
      ),
      companyProfile: {
        tech_hardware: { inception: "IoT solar meter, v1", graduation: "IoT solar meter, v3 (BLE-enabled)" },
        tech_ip_status: { inception: "None filed", graduation: "1 utility patent filed" },
        tech_stage: { inception: "Prototype", graduation: "Live with paying customers" },
        legal_incorporated: { inception: "In process", graduation: "Incorporated (Nigeria)" },
        legal_domicile: { inception: "Nigeria", graduation: "Nigeria" },
        regulatory_status: { inception: "Preparing", graduation: "Approved" },
        impact_sdgs: { inception: "SDG 7", graduation: "SDG 7, SDG 1" },
      },
    });

    await db.insert(startupMetricEntries).values([
      {
        startupId,
        period: "initial",
        values: {
          sales_paying_customers_b2c: 1200, sales_retention_b2c_pct: 78, sales_cac: 18, sales_ltv: 96,
          rev_mrr_b2c: 9500, rev_cumulative: 60000,
          hr_founders: 2, hr_team_size: 6, hr_contractors: 1, hr_advisors: 1, hr_paid_employees: 4, hr_female_employees: 2,
          partner_total: 1,
          fund_investment_raised: 50000, fund_valuation: 1500000,
        },
      },
      {
        startupId,
        period: "2026-08",
        values: {
          sales_paying_customers_b2c: 41500, sales_retention_b2c_pct: 91, sales_cac: 11, sales_ltv: 140,
          rev_mrr_b2c: 28000, rev_cumulative: 410000,
          hr_founders: 2, hr_team_size: 14, hr_contractors: 3, hr_advisors: 2, hr_paid_employees: 11, hr_female_employees: 4,
          partner_total: 4,
          fund_investment_raised: 350000, fund_valuation: 4000000,
        },
      },
    ]);

    await db.insert(startupAchievements).values([
      { startupId, achievement: "Crossed 40,000 active customers", details: "Reached 41,500 active pay-as-you-go accounts across 3 countries." },
      { startupId, achievement: "Signed regional mobile-money distribution deal", details: "Partnership gives access to 2M+ registered mobile-money users in Ghana." },
    ]);

    await db.insert(startupCrmEntries).values([
      { startupId, category: "investor", name: "Savanna Seed Fund", type: "VC", priority: "high", status: "term sheet", introVia: "Demo Day", ctaStartup: "Send updated data room", ctaOst: "Warm intro follow-up" },
      { startupId, category: "investor", name: "Angel syndicate (climate-focused)", type: "Angels", priority: "medium", status: "in discussion" },
      { startupId, category: "client", name: "Kano Households Cooperative", type: "B2B2C", priority: "high", status: "active", contractValue: "$40,000/yr" },
      { startupId, category: "partner", name: "PanAfricom Mobile Money", type: "Distribution", priority: "high", status: "signed", howItHelps: "Access to 2M+ registered mobile-money users in Ghana" },
    ]);

    await db.insert(monthlyUpdates).values([
      {
        startupId, periodMonth: 6, periodQuarter: 2, periodYear: 2026,
        achieved: "Crossed 40,000 active customers; signed Ghana distribution partnership.",
        blocked: "Import duties on solar hardware delaying Ghana inventory by ~3 weeks.",
        focusNext: "Close the seed extension; onboard first 500 Ghana households.",
        status: "on_track",
      },
    ]);

    await db.insert(teamMembers).values([
      { startupId, name: "Amara Okafor", role: "Co-Founder & CEO", type: "founder", gender: "Female", educationalBackground: "MBA, Lagos Business School", professionalBackground: "Ex-Interswitch, payments", yearsOfExperience: 9, currentInvolvement: "Full-time" },
      { startupId, name: "Tunde Bello", role: "Co-Founder & CTO", type: "founder", gender: "Male", educationalBackground: "BSc Electrical Engineering, University of Lagos", professionalBackground: "Ex-Arnergy, solar hardware", yearsOfExperience: 8, currentInvolvement: "Full-time" },
      { startupId, name: "Fatima Sani", role: "Head of Operations", type: "full_time" },
      { startupId, name: "Kwame Mensah", role: "Ghana Country Lead", type: "full_time" },
    ]);

    await db.insert(capTableEntries).values([
      { startupId, name: "Amara Okafor", percentage: 42, currentInvolvement: "Full-time" },
      { startupId, name: "Tunde Bello", percentage: 38, currentInvolvement: "Full-time" },
      { startupId, name: "Savanna Seed Fund", percentage: 8, currentInvolvement: "Investor" },
      { startupId, name: "ESOP pool", percentage: 7, currentInvolvement: "N/A" },
      { startupId, name: "Angel syndicate", percentage: 5, currentInvolvement: "Investor" },
    ]);

    await db.insert(startupFundingRounds).values([
      { startupId, amount: 50000, investorName: "Climate Grant Facility", fundingType: "Grant", round: "Pre-Seed", roundDate: "2022-09", dealTerms: "Non-dilutive" },
      { startupId, amount: 300000, investorName: "Savanna Seed Fund, angel syndicate", fundingType: "Equity", round: "Seed", roundDate: "2025-11", dealTerms: "SAFE, $4M cap, 20% discount" },
    ]);

    await db.insert(startupPatents).values([
      { startupId, applicantName: "Verdant Energy Ltd", country: "Nigeria", applicationType: "Utility patent", priorityDate: "2025-02-10", status: "Filed", nextAction: "Awaiting examination" },
    ]);

    await db.insert(startupTargetMarkets).values([
      { startupId, market: "Nigeria", status: "Active" },
      { startupId, market: "Ghana", status: "Launching" },
      { startupId, market: "Ivory Coast", status: "Planned" },
    ]);

    await db.insert(startupCompetitors).values([
      { startupId, name: "M-KOPA", details: "Larger, East-Africa-first incumbent; less focus on West Africa." },
      { startupId, name: "PEG Africa", details: "Ghana-based, similar pay-as-you-go model, weaker credit-scoring tech." },
      { startupId, name: "Bboxx", details: "Broader multi-country footprint, higher default rates reported." },
    ]);

    await db.insert(startupClientStats).values([
      { startupId, clientType: "b2c", totalClients: 41500, majorClientNames: "N/A (individual households)", retentionRate: 0.91 },
    ]);
    await db.insert(startupClientDetails).values([
      { startupId, clientName: "Kano Households Cooperative", scopeOfWork: "Bulk household solar financing", dealValue: 40000 },
    ]);

    await db.insert(startupPartnerStats).values([
      { startupId, partnerType: "Distribution", totalPartners: 4, majorPartnerNames: "PanAfricom Mobile Money", retentionRate: 1 },
    ]);
    await db.insert(startupPartnerDetails).values([
      { startupId, partnerName: "PanAfricom Mobile Money", scopeOfPartnership: "Repayment collection + customer distribution", nextSteps: "Expand integration to Ghana in Q1" },
    ]);

    // Mentorship sessions belong 1:1 to a startup, so seeding these is safe —
    // unlike Training, nothing here is shared with any real startup's view.
    await db.insert(mentorshipModuleSessions).values([
      {
        startupId, number: 1, title: "Go-to-market strategy for Ghana expansion",
        description: "Reviewed distribution partnership terms and Ghana launch plan.",
        scheduledAt: monthsAgo(1), durationMinutes: 60, experts: "Ivy Shultz", status: "completed",
      },
      {
        startupId, number: 2, title: "Seed extension fundraising prep",
        description: "Prepping the data room and pitch narrative for Savanna Seed Fund's partner meeting.",
        scheduledAt: daysFromNow(10), durationMinutes: 60, experts: "Ivy Shultz", status: "upcoming",
      },
    ]);

    await this.setActiveStartup(userId, startupId);
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

  /**
   * kysSubmitted here drives the admin Users status column's post-approval
   * "Onboarding" (filling in Contract & KYS) vs "Active" split — onboardingStatus
   * alone only tracks the pre-approval steps and never changes again after
   * approveUser sets it to "complete".
   */
  async listUsers(): Promise<(User & { kysSubmitted: boolean })[]> {
    const rows = await db
      .select({ user: users, kysProfileId: kysProfiles.id })
      .from(users)
      .leftJoin(startups, eq(startups.id, users.activeStartupId))
      .leftJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .orderBy(desc(users.createdAt));
    return rows.map((r) => ({ ...r.user, kysSubmitted: !!r.kysProfileId }));
  },

  async setUserActive(id: string, active: boolean): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ isActive: active })
      .where(eq(users.id, id))
      .returning();
    return row;
  },

  /**
   * Testing-only super-admin action: permanently erases a user, their
   * startup(s), and everything cascading from those (documents, sessions,
   * KPI submissions, etc. — see `onDelete: "cascade"` on startups.userId in
   * shared/schema.ts).
   *
   * Several tables record this user as an actor/reviewer/uploader without a
   * cascade rule, on purpose — they're audit trails meant to survive a
   * deletion. Those get cleared to null (not deleted) here first, so the
   * user row itself can go: this is exactly what an earlier support incident
   * had to do by hand, one FK-violation error at a time. Wrapped in one
   * transaction so a mid-way failure leaves nothing half-deleted.
   */
  async permanentlyDeleteUser(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(documents).set({ uploadedBy: null }).where(eq(documents.uploadedBy, id));
      await tx.update(documentEvents).set({ actorId: null }).where(eq(documentEvents.actorId, id));
      await tx.update(dataRoomShares).set({ createdBy: null }).where(eq(dataRoomShares.createdBy, id));
      await tx.update(contracts).set({ reviewedBy: null }).where(eq(contracts.reviewedBy, id));
      await tx.update(contractEvents).set({ actorId: null }).where(eq(contractEvents.actorId, id));
      await tx.update(kysProfiles).set({ reviewedBy: null }).where(eq(kysProfiles.reviewedBy, id));
      await tx.update(kysEvents).set({ actorId: null }).where(eq(kysEvents.actorId, id));
      await tx.delete(users).where(eq(users.id, id));
    });
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
      .innerJoin(users, eq(startups.userId, users.id))
      .leftJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .leftJoin(contracts, eq(contracts.startupId, startups.id))
      .leftJoin(experts, eq(experts.id, startups.mentorId))
      .leftJoin(trainers, eq(trainers.id, startups.trainerId))
      // Excludes every admin's auto-provisioned "Startup view" demo startup —
      // owned by whichever admin toggled into it, never a real founder.
      .where(ne(users.role, "admin"))
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
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [reported] = await db
      .select({ c: sql<number>`count(distinct ${startupMetricEntries.startupId})::int` })
      .from(startupMetricEntries)
      .where(and(eq(startupMetricEntries.period, currentPeriod), sql`${startupMetricEntries.values} != '{}'::jsonb`));
    const [ms] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(mentorshipModuleSessions)
      .where(and(eq(mentorshipModuleSessions.status, "upcoming"), sql`${mentorshipModuleSessions.scheduledAt} > now()`));
    const [ts] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(trainingModuleSessions)
      .where(and(eq(trainingModuleSessions.status, "upcoming"), sql`${trainingModuleSessions.scheduledAt} > now()`));
    const [tr] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(trainings)
      .where(isNotNull(trainings.resourceUrl));
    return {
      users: u?.c ?? 0,
      startups: s?.c ?? 0,
      pendingDeletions: d?.c ?? 0,
      pendingContracts: pc?.c ?? 0,
      pendingKys: pk?.c ?? 0,
      startupsMissingMetrics: Math.max((s?.c ?? 0) - (reported?.c ?? 0), 0),
      upcomingMentorshipSessions: ms?.c ?? 0,
      upcomingTrainingSessions: ts?.c ?? 0,
      schoolDocs: tr?.c ?? 0,
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
      .innerJoin(users, eq(users.id, startups.userId))
      .leftJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .where(and(ne(users.role, "admin"), track ? eq(kysProfiles.track, track) : undefined));
    return { total: Number(row?.total ?? 0), countWithData: row?.countWithData ?? 0, countTotal: row?.countTotal ?? 0 };
  },

  async countStartups(track?: "seed" | "pre_seed"): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(distinct ${startups.id})::int` })
      .from(startups)
      .innerJoin(users, eq(users.id, startups.userId))
      .leftJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .where(and(ne(users.role, "admin"), track ? eq(kysProfiles.track, track) : undefined));
    return row?.c ?? 0;
  },

  async averageTeamSize(): Promise<{ avg: number; totalMembers: number; totalStartups: number }> {
    const [tm] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(teamMembers)
      .innerJoin(startups, eq(startups.id, teamMembers.startupId))
      .innerJoin(users, eq(users.id, startups.userId))
      .where(ne(users.role, "admin"));
    const [s] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(startups)
      .innerJoin(users, eq(users.id, startups.userId))
      .where(ne(users.role, "admin"));
    const totalMembers = tm?.c ?? 0;
    const totalStartups = s?.c ?? 0;
    return { avg: totalStartups > 0 ? totalMembers / totalStartups : 0, totalMembers, totalStartups };
  },

  // For matching a startup name mentioned in a free-text question — small
  // enough (a handful of dozen rows) to fetch every name once and search
  // client-side rather than write a fuzzy-match SQL query.
  async listStartupNames(): Promise<{ id: string; companyName: string }[]> {
    return db
      .select({ id: startups.id, companyName: startups.companyName })
      .from(startups)
      .innerJoin(users, eq(users.id, startups.userId))
      .where(ne(users.role, "admin"));
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
      .innerJoin(users, eq(users.id, startups.userId))
      .innerJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .where(and(ne(users.role, "admin"), eq(kysProfiles.track, track)))
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

  async createAchievement(startupId: string, data: { achievement: string; details: string }): Promise<StartupAchievement> {
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
    data: {
      name: string;
      role?: string | null;
      type: "founder" | "full_time" | "part_time" | "advisor";
      gender?: string | null;
      educationalBackground?: string | null;
      professionalBackground?: string | null;
      yearsOfExperience?: number | null;
      currentInvolvement?: string | null;
    },
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

  async updateTeamMember(id: string, data: Partial<typeof teamMembers.$inferInsert>): Promise<TeamMember> {
    const [row] = await db.update(teamMembers).set(data).where(eq(teamMembers.id, id)).returning();
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
    data: { name: string; percentage: number; currentInvolvement?: string | null },
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

  async updateCapTableEntry(id: string, data: Partial<typeof capTableEntries.$inferInsert>): Promise<CapTableEntry> {
    const [row] = await db.update(capTableEntries).set(data).where(eq(capTableEntries.id, id)).returning();
    return row;
  },

  async deleteCapTableEntry(id: string): Promise<void> {
    await db.delete(capTableEntries).where(eq(capTableEntries.id, id));
  },

  /* ---------------- Initial Data: new repeatable tables (Cards 6, 9, 11, 13, 14) ---------------- */
  async listFundingRounds(startupId: string): Promise<StartupFundingRound[]> {
    return db.select().from(startupFundingRounds).where(eq(startupFundingRounds.startupId, startupId)).orderBy(asc(startupFundingRounds.createdAt));
  },
  async createFundingRound(startupId: string, data: Partial<typeof startupFundingRounds.$inferInsert>): Promise<StartupFundingRound> {
    const [row] = await db.insert(startupFundingRounds).values({ ...data, startupId }).returning();
    return row;
  },
  async getOwnedFundingRound(id: string, startupId: string): Promise<StartupFundingRound | undefined> {
    const [row] = await db.select().from(startupFundingRounds).where(and(eq(startupFundingRounds.id, id), eq(startupFundingRounds.startupId, startupId)));
    return row;
  },
  async updateFundingRound(id: string, data: Partial<typeof startupFundingRounds.$inferInsert>): Promise<StartupFundingRound> {
    const [row] = await db.update(startupFundingRounds).set(data).where(eq(startupFundingRounds.id, id)).returning();
    return row;
  },
  async deleteFundingRound(id: string): Promise<void> {
    await db.delete(startupFundingRounds).where(eq(startupFundingRounds.id, id));
  },

  async listPatents(startupId: string): Promise<StartupPatent[]> {
    return db.select().from(startupPatents).where(eq(startupPatents.startupId, startupId)).orderBy(asc(startupPatents.createdAt));
  },
  async createPatent(startupId: string, data: Partial<typeof startupPatents.$inferInsert>): Promise<StartupPatent> {
    const [row] = await db.insert(startupPatents).values({ ...data, startupId }).returning();
    return row;
  },
  async getOwnedPatent(id: string, startupId: string): Promise<StartupPatent | undefined> {
    const [row] = await db.select().from(startupPatents).where(and(eq(startupPatents.id, id), eq(startupPatents.startupId, startupId)));
    return row;
  },
  async updatePatent(id: string, data: Partial<typeof startupPatents.$inferInsert>): Promise<StartupPatent> {
    const [row] = await db.update(startupPatents).set(data).where(eq(startupPatents.id, id)).returning();
    return row;
  },
  async deletePatent(id: string): Promise<void> {
    await db.delete(startupPatents).where(eq(startupPatents.id, id));
  },

  async listTargetMarkets(startupId: string): Promise<StartupTargetMarket[]> {
    return db.select().from(startupTargetMarkets).where(eq(startupTargetMarkets.startupId, startupId)).orderBy(asc(startupTargetMarkets.createdAt));
  },
  async createTargetMarket(startupId: string, data: { market: string; status: string; strategyLink?: string | null }): Promise<StartupTargetMarket> {
    const [row] = await db.insert(startupTargetMarkets).values({ ...data, startupId }).returning();
    return row;
  },
  async getOwnedTargetMarket(id: string, startupId: string): Promise<StartupTargetMarket | undefined> {
    const [row] = await db.select().from(startupTargetMarkets).where(and(eq(startupTargetMarkets.id, id), eq(startupTargetMarkets.startupId, startupId)));
    return row;
  },
  async updateTargetMarket(id: string, data: Partial<typeof startupTargetMarkets.$inferInsert>): Promise<StartupTargetMarket> {
    const [row] = await db.update(startupTargetMarkets).set(data).where(eq(startupTargetMarkets.id, id)).returning();
    return row;
  },
  async deleteTargetMarket(id: string): Promise<void> {
    await db.delete(startupTargetMarkets).where(eq(startupTargetMarkets.id, id));
  },

  async listCompetitors(startupId: string): Promise<StartupCompetitor[]> {
    return db.select().from(startupCompetitors).where(eq(startupCompetitors.startupId, startupId)).orderBy(asc(startupCompetitors.createdAt));
  },
  async createCompetitor(startupId: string, data: { name: string; details?: string | null }): Promise<StartupCompetitor> {
    const [row] = await db.insert(startupCompetitors).values({ ...data, startupId }).returning();
    return row;
  },
  async getOwnedCompetitor(id: string, startupId: string): Promise<StartupCompetitor | undefined> {
    const [row] = await db.select().from(startupCompetitors).where(and(eq(startupCompetitors.id, id), eq(startupCompetitors.startupId, startupId)));
    return row;
  },
  async updateCompetitor(id: string, data: Partial<typeof startupCompetitors.$inferInsert>): Promise<StartupCompetitor> {
    const [row] = await db.update(startupCompetitors).set(data).where(eq(startupCompetitors.id, id)).returning();
    return row;
  },
  async deleteCompetitor(id: string): Promise<void> {
    await db.delete(startupCompetitors).where(eq(startupCompetitors.id, id));
  },

  async listClientStats(startupId: string): Promise<StartupClientStat[]> {
    return db.select().from(startupClientStats).where(eq(startupClientStats.startupId, startupId)).orderBy(asc(startupClientStats.createdAt));
  },
  async createClientStat(startupId: string, data: Partial<typeof startupClientStats.$inferInsert>): Promise<StartupClientStat> {
    const [row] = await db.insert(startupClientStats).values({ ...data, startupId } as typeof startupClientStats.$inferInsert).returning();
    return row;
  },
  async getOwnedClientStat(id: string, startupId: string): Promise<StartupClientStat | undefined> {
    const [row] = await db.select().from(startupClientStats).where(and(eq(startupClientStats.id, id), eq(startupClientStats.startupId, startupId)));
    return row;
  },
  async updateClientStat(id: string, data: Partial<typeof startupClientStats.$inferInsert>): Promise<StartupClientStat> {
    const [row] = await db.update(startupClientStats).set(data).where(eq(startupClientStats.id, id)).returning();
    return row;
  },
  async deleteClientStat(id: string): Promise<void> {
    await db.delete(startupClientStats).where(eq(startupClientStats.id, id));
  },

  async listClientDetails(startupId: string): Promise<StartupClientDetail[]> {
    return db.select().from(startupClientDetails).where(eq(startupClientDetails.startupId, startupId)).orderBy(asc(startupClientDetails.createdAt));
  },
  async createClientDetail(startupId: string, data: Partial<typeof startupClientDetails.$inferInsert>): Promise<StartupClientDetail> {
    const [row] = await db.insert(startupClientDetails).values({ ...data, startupId } as typeof startupClientDetails.$inferInsert).returning();
    return row;
  },
  async getOwnedClientDetail(id: string, startupId: string): Promise<StartupClientDetail | undefined> {
    const [row] = await db.select().from(startupClientDetails).where(and(eq(startupClientDetails.id, id), eq(startupClientDetails.startupId, startupId)));
    return row;
  },
  async updateClientDetail(id: string, data: Partial<typeof startupClientDetails.$inferInsert>): Promise<StartupClientDetail> {
    const [row] = await db.update(startupClientDetails).set(data).where(eq(startupClientDetails.id, id)).returning();
    return row;
  },
  async deleteClientDetail(id: string): Promise<void> {
    await db.delete(startupClientDetails).where(eq(startupClientDetails.id, id));
  },

  async listPartnerStats(startupId: string): Promise<StartupPartnerStat[]> {
    return db.select().from(startupPartnerStats).where(eq(startupPartnerStats.startupId, startupId)).orderBy(asc(startupPartnerStats.createdAt));
  },
  async createPartnerStat(startupId: string, data: Partial<typeof startupPartnerStats.$inferInsert>): Promise<StartupPartnerStat> {
    const [row] = await db.insert(startupPartnerStats).values({ ...data, startupId } as typeof startupPartnerStats.$inferInsert).returning();
    return row;
  },
  async getOwnedPartnerStat(id: string, startupId: string): Promise<StartupPartnerStat | undefined> {
    const [row] = await db.select().from(startupPartnerStats).where(and(eq(startupPartnerStats.id, id), eq(startupPartnerStats.startupId, startupId)));
    return row;
  },
  async updatePartnerStat(id: string, data: Partial<typeof startupPartnerStats.$inferInsert>): Promise<StartupPartnerStat> {
    const [row] = await db.update(startupPartnerStats).set(data).where(eq(startupPartnerStats.id, id)).returning();
    return row;
  },
  async deletePartnerStat(id: string): Promise<void> {
    await db.delete(startupPartnerStats).where(eq(startupPartnerStats.id, id));
  },

  async listPartnerDetails(startupId: string): Promise<StartupPartnerDetail[]> {
    return db.select().from(startupPartnerDetails).where(eq(startupPartnerDetails.startupId, startupId)).orderBy(asc(startupPartnerDetails.createdAt));
  },
  async createPartnerDetail(startupId: string, data: Partial<typeof startupPartnerDetails.$inferInsert>): Promise<StartupPartnerDetail> {
    const [row] = await db.insert(startupPartnerDetails).values({ ...data, startupId } as typeof startupPartnerDetails.$inferInsert).returning();
    return row;
  },
  async getOwnedPartnerDetail(id: string, startupId: string): Promise<StartupPartnerDetail | undefined> {
    const [row] = await db.select().from(startupPartnerDetails).where(and(eq(startupPartnerDetails.id, id), eq(startupPartnerDetails.startupId, startupId)));
    return row;
  },
  async updatePartnerDetail(id: string, data: Partial<typeof startupPartnerDetails.$inferInsert>): Promise<StartupPartnerDetail> {
    const [row] = await db.update(startupPartnerDetails).set(data).where(eq(startupPartnerDetails.id, id)).returning();
    return row;
  },
  async deletePartnerDetail(id: string): Promise<void> {
    await db.delete(startupPartnerDetails).where(eq(startupPartnerDetails.id, id));
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
  // A session is visible to a startup if it owns it, OR it's on the explicit
  // shared list for that session, OR its track matches (and there's no
  // explicit list at all — an explicit list always wins over a track).
  async listMentorshipSessionsForFounder(startupId: string) {
    const kysProfile = await this.getKysProfile(startupId);
    const track = kysProfile?.track ?? null;
    const [allSessions, sharedRows, notes] = await Promise.all([
      db.select().from(mentorshipModuleSessions).orderBy(asc(mentorshipModuleSessions.scheduledAt)),
      db.select().from(mentorshipSessionStartups),
      db.select().from(mentorshipSessionNotes).where(eq(mentorshipSessionNotes.startupId, startupId)),
    ]);
    const sharedBySession = groupStartupIdsBySessionId(sharedRows);
    const sessions = allSessions.filter((s) => {
      if (s.startupId === startupId) return true;
      const shared = sharedBySession.get(s.id);
      if (shared && shared.size > 0) return shared.has(startupId);
      return !!s.visibilityTrack && (s.visibilityTrack === "all" || s.visibilityTrack === track);
    });
    const notesBySessionId = new Map(notes.map((n) => [n.sessionId, n]));
    const emptyNotes = {
      teamMembersPresence: null,
      pointsDiscussed: null,
      whatIsGoingWell: null,
      whatIsNotGoingWell: null,
      actionItems: null,
      progressHighlights: null,
      mentorComments: null,
      needsHighlighted: null,
      nextMeetingCheckIns: null,
      actionItemsForOst: null,
      mentorRating: null,
      mentorFeedback: null,
    };
    return sessions.map((s) => ({ ...s, notes: notesBySessionId.get(s.id) ?? emptyNotes }));
  },

  /**
   * Recipients for a programme-wide session (Training has no startup_id):
   * every active, verified founder, plus the admins.
   *
   * Admins are included on purpose. They run the programme, so excluding them
   * meant the person scheduling a session never saw it in their own calendar.
   *
   * Unverified addresses are excluded: there is no evidence they are
   * reachable, and inviting them would send the session to a wrong inbox.
   */
  async listSessionInviteRecipients(): Promise<{ email: string; name: string | null }[]> {
    return db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(
        and(
          inArray(users.role, ["startup", "admin"]),
          eq(users.isActive, true),
          eq(users.emailVerified, true),
        ),
      );
  },

  /**
   * Recipients for a session belonging to a single startup. Mentorship is now
   * 1:1, and inviting the whole cohort to one startup's mentoring session
   * would disclose who is being mentored and when, so this is that startup's
   * own user plus the admins.
   */
  async listStartupSessionInviteRecipients(
    startupId: string,
  ): Promise<{ email: string; name: string | null }[]> {
    const [founders, admins] = await Promise.all([
      db
        .select({ email: users.email, name: users.name })
        .from(startups)
        .innerJoin(users, eq(users.id, startups.userId))
        .where(
          and(
            eq(startups.id, startupId),
            eq(users.isActive, true),
            eq(users.emailVerified, true),
          ),
        ),
      db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(
          and(eq(users.role, "admin"), eq(users.isActive, true), eq(users.emailVerified, true)),
        ),
    ]);
    const seen = new Set<string>();
    return [...founders, ...admins].filter((r) => {
      const key = r.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  /**
   * Recipients for an admin's cohort-wide message: every active, verified
   * founder on the given KYS track ("all" = every founder, regardless of
   * track). Unlike listSessionInviteRecipients, admins are NOT included —
   * this is the admin's own outgoing message, not a session they'd expect to
   * see themselves invited to.
   */
  async listCohortMessageRecipients(
    track: "seed" | "pre_seed" | "all",
  ): Promise<{ email: string; name: string | null }[]> {
    const rows = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .innerJoin(startups, eq(startups.userId, users.id))
      .innerJoin(kysProfiles, eq(kysProfiles.startupId, startups.id))
      .where(
        and(
          eq(users.role, "startup"),
          eq(users.isActive, true),
          eq(users.emailVerified, true),
          track === "all" ? undefined : eq(kysProfiles.track, track),
        ),
      );
    const seen = new Set<string>();
    return rows.filter((r) => {
      const key = r.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  /* ---------------- Ask AI saved conversations (per admin) ---------------- */
  async listAiChatSessions(userId: string): Promise<{ id: string; title: string; updatedAt: Date }[]> {
    return db
      .select({ id: aiChatSessions.id, title: aiChatSessions.title, updatedAt: aiChatSessions.updatedAt })
      .from(aiChatSessions)
      .where(eq(aiChatSessions.userId, userId))
      .orderBy(desc(aiChatSessions.updatedAt));
  },

  async getAiChatSession(id: string, userId: string): Promise<AiChatSession | undefined> {
    const [row] = await db
      .select()
      .from(aiChatSessions)
      .where(and(eq(aiChatSessions.id, id), eq(aiChatSessions.userId, userId)));
    return row;
  },

  async createAiChatSession(userId: string, title: string, messages: AiChatMessage[]): Promise<AiChatSession> {
    const [row] = await db.insert(aiChatSessions).values({ userId, title, messages }).returning();
    return row;
  },

  async updateAiChatMessages(id: string, messages: AiChatMessage[]): Promise<AiChatSession> {
    const [row] = await db
      .update(aiChatSessions)
      .set({ messages, updatedAt: new Date() })
      .where(eq(aiChatSessions.id, id))
      .returning();
    return row;
  },

  async deleteAiChatSession(id: string, userId: string): Promise<void> {
    await db.delete(aiChatSessions).where(and(eq(aiChatSessions.id, id), eq(aiChatSessions.userId, userId)));
  },

  /* ---------------- Claude connector (MCP) OAuth ---------------- */
  async getMcpClient(clientId: string): Promise<McpOauthClient | undefined> {
    const [row] = await db.select().from(mcpOauthClients).where(eq(mcpOauthClients.clientId, clientId));
    return row;
  },

  async createMcpClient(data: typeof mcpOauthClients.$inferInsert): Promise<McpOauthClient> {
    const [row] = await db.insert(mcpOauthClients).values(data).returning();
    return row;
  },

  async createMcpToken(data: typeof mcpOauthTokens.$inferInsert): Promise<void> {
    await db.insert(mcpOauthTokens).values(data);
    // Opportunistic cleanup, so expired tokens don't pile up forever.
    await db.delete(mcpOauthTokens).where(sql`${mcpOauthTokens.expiresAt} < now()`);
  },

  /** A still-valid token of the given kind, with its owner's current access. */
  async findMcpToken(tokenHash: string, kind: "access" | "refresh") {
    const [row] = await db
      .select({
        id: mcpOauthTokens.id,
        userId: mcpOauthTokens.userId,
        clientId: mcpOauthTokens.clientId,
        expiresAt: mcpOauthTokens.expiresAt,
        userRole: users.role,
        userActive: users.isActive,
        userEmail: users.email,
      })
      .from(mcpOauthTokens)
      .innerJoin(users, eq(users.id, mcpOauthTokens.userId))
      .where(
        and(
          eq(mcpOauthTokens.tokenHash, tokenHash),
          eq(mcpOauthTokens.kind, kind),
          sql`${mcpOauthTokens.expiresAt} > now()`,
        ),
      );
    return row;
  },

  async deleteMcpToken(id: string): Promise<void> {
    await db.delete(mcpOauthTokens).where(eq(mcpOauthTokens.id, id));
  },

  /** Distinct apps (Claude clients) currently holding a valid token for this user. */
  async countMcpConnections(userId: string): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(distinct ${mcpOauthTokens.clientId})::int` })
      .from(mcpOauthTokens)
      .where(and(eq(mcpOauthTokens.userId, userId), sql`${mcpOauthTokens.expiresAt} > now()`));
    return row?.c ?? 0;
  },

  /** Instantly disconnects every Claude connection for this user. */
  async deleteMcpTokensForUser(userId: string): Promise<void> {
    await db.delete(mcpOauthTokens).where(eq(mcpOauthTokens.userId, userId));
  },

  /** The founder who owns a specific startup — normally exactly one. */
  async listStartupMessageRecipients(
    startupId: string,
  ): Promise<{ email: string; name: string | null }[]> {
    return db
      .select({ email: users.email, name: users.name })
      .from(startups)
      .innerJoin(users, eq(users.id, startups.userId))
      .where(
        and(
          eq(startups.id, startupId),
          eq(users.isActive, true),
          eq(users.emailVerified, true),
        ),
      );
  },

  // Sessions this startup owns (created from its own admin page) — the
  // shared-in-via-track/list case is deliberately not surfaced here, so a
  // session's admin management always lives on the one page it was created
  // from. sharedStartupIds is attached for the edit modal to prefill from.
  async listMentorshipSessionsForStartup(startupId: string): Promise<(MentorshipModuleSession & { sharedStartupIds: string[] })[]> {
    const sessions = await db
      .select()
      .from(mentorshipModuleSessions)
      .where(eq(mentorshipModuleSessions.startupId, startupId))
      .orderBy(asc(mentorshipModuleSessions.scheduledAt));
    if (sessions.length === 0) return [];
    const rows = await db
      .select()
      .from(mentorshipSessionStartups)
      .where(inArray(mentorshipSessionStartups.sessionId, sessions.map((s) => s.id)));
    const bySession = groupStartupIdsBySessionId(rows);
    return sessions.map((s) => ({ ...s, sharedStartupIds: [...(bySession.get(s.id) ?? [])] }));
  },

  async listMentorshipSessionStartupIds(sessionId: string): Promise<string[]> {
    const rows = await db.select().from(mentorshipSessionStartups).where(eq(mentorshipSessionStartups.sessionId, sessionId));
    return rows.map((r) => r.startupId);
  },

  /** Replaces a session's explicit shared-startup list wholesale (delete + reinsert). */
  async setMentorshipSessionStartups(sessionId: string, startupIds: string[]): Promise<void> {
    await db.delete(mentorshipSessionStartups).where(eq(mentorshipSessionStartups.sessionId, sessionId));
    if (startupIds.length > 0) {
      await db.insert(mentorshipSessionStartups).values(startupIds.map((startupId) => ({ sessionId, startupId })));
    }
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
    visibilityTrack?: "seed" | "pre_seed" | "all" | null;
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

  async upsertMentorshipSessionNotes(
    sessionId: string,
    startupId: string,
    data: {
      teamMembersPresence?: string | null;
      pointsDiscussed?: string | null;
      whatIsGoingWell?: string | null;
      whatIsNotGoingWell?: string | null;
      actionItems?: string | null;
      progressHighlights?: string | null;
      mentorComments?: string | null;
      needsHighlighted?: string | null;
      nextMeetingCheckIns?: string | null;
      actionItemsForOst?: string | null;
      aiGeneratedAt?: Date | null;
      founderComments?: string | null;
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

  /* ---------------- Training (Modules + Sessions) ----------------
   * One trainer runs each real track (seed/pre_seed), so a module is scoped
   * to a whole track (or "all") by default — see trainingModules.track. An
   * individual session can narrow that further (its own visibilityTrack, or
   * an explicit trainingSessionStartups list), but only for startups the
   * module itself is already visible to — see trainingSessionVisibleTo. */
  async listTrainingModulesForFounder(startupId: string) {
    const kysProfile = await this.getKysProfile(startupId);
    const track = kysProfile?.track ?? null;
    const [modules, sessions, sharedRows, moduleSharedRows, notes, homework] = await Promise.all([
      db.select().from(trainingModules).orderBy(asc(trainingModules.number)),
      db.select().from(trainingModuleSessions).orderBy(asc(trainingModuleSessions.number)),
      db.select().from(trainingSessionStartups),
      db.select().from(trainingModuleStartups),
      db.select().from(trainingSessionNotes).where(eq(trainingSessionNotes.startupId, startupId)),
      db.select().from(trainingModuleHomework).where(eq(trainingModuleHomework.startupId, startupId)),
    ]);
    const sharedBySession = groupStartupIdsBySessionId(sharedRows);
    const sharedByModule = groupStartupIdsBy(moduleSharedRows, (r) => r.moduleId);
    const notesBySessionId = new Map(notes.map((n) => [n.sessionId, n]));
    const homeworkByModuleId = new Map(homework.map((h) => [h.moduleId, h]));
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
    return modules
      .filter((m) => trainingModuleVisibleTo(startupId, track, m, sharedByModule))
      .map((m) => {
        // Locked modules never leak their session content to the founder side.
        const moduleSessions = m.unlocked
          ? sessions
              .filter((s) => s.moduleId === m.id && trainingSessionVisibleTo(startupId, track, s, sharedBySession))
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
    const [modules, sessions, sharedRows, moduleSharedRows] = await Promise.all([
      db.select().from(trainingModules).orderBy(asc(trainingModules.number)),
      db.select().from(trainingModuleSessions).orderBy(asc(trainingModuleSessions.number)),
      db.select().from(trainingSessionStartups),
      db.select().from(trainingModuleStartups),
    ]);
    const sharedBySession = groupStartupIdsBySessionId(sharedRows);
    const sharedByModule = groupStartupIdsBy(moduleSharedRows, (r) => r.moduleId);
    return modules.map((m) => ({
      ...m,
      startupIds: [...(sharedByModule.get(m.id) ?? [])],
      sessions: sessions
        .filter((s) => s.moduleId === m.id)
        .map((s) => ({ ...s, sharedStartupIds: [...(sharedBySession.get(s.id) ?? [])] })),
    }));
  },

  async listTrainingSessionsForStartup(startupId: string) {
    const kysProfile = await this.getKysProfile(startupId);
    const track = kysProfile?.track ?? null;
    const [allModules, moduleSharedRows] = await Promise.all([
      db.select().from(trainingModules),
      db.select().from(trainingModuleStartups),
    ]);
    const sharedByModule = groupStartupIdsBy(moduleSharedRows, (r) => r.moduleId);
    const modules = allModules.filter((m) => trainingModuleVisibleTo(startupId, track, m, sharedByModule));
    if (modules.length === 0) return [];
    const moduleById = new Map(modules.map((m) => [m.id, m]));
    const [sessions, sharedRows] = await Promise.all([
      db.select().from(trainingModuleSessions).where(inArray(trainingModuleSessions.moduleId, modules.map((m) => m.id))),
      db.select().from(trainingSessionStartups),
    ]);
    const sharedBySession = groupStartupIdsBySessionId(sharedRows);
    return sessions
      .filter((s) => trainingSessionVisibleTo(startupId, track, s, sharedBySession))
      .map((s) => ({ ...s, moduleTitle: moduleById.get(s.moduleId)?.title ?? null }))
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  },

  async listTrainingSessionStartupIds(sessionId: string): Promise<string[]> {
    const rows = await db.select().from(trainingSessionStartups).where(eq(trainingSessionStartups.sessionId, sessionId));
    return rows.map((r) => r.startupId);
  },

  /** Replaces a session's explicit shared-startup list wholesale (delete + reinsert). */
  async setTrainingSessionStartups(sessionId: string, startupIds: string[]): Promise<void> {
    await db.delete(trainingSessionStartups).where(eq(trainingSessionStartups.sessionId, sessionId));
    if (startupIds.length > 0) {
      await db.insert(trainingSessionStartups).values(startupIds.map((startupId) => ({ sessionId, startupId })));
    }
  },

  async listTrainingModuleStartupIds(moduleId: string): Promise<string[]> {
    const rows = await db.select().from(trainingModuleStartups).where(eq(trainingModuleStartups.moduleId, moduleId));
    return rows.map((r) => r.startupId);
  },

  /** Replaces a module's explicit startup list wholesale (delete + reinsert). */
  async setTrainingModuleStartups(moduleId: string, startupIds: string[]): Promise<void> {
    await db.delete(trainingModuleStartups).where(eq(trainingModuleStartups.moduleId, moduleId));
    if (startupIds.length > 0) {
      await db.insert(trainingModuleStartups).values(startupIds.map((startupId) => ({ moduleId, startupId })));
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
    track?: "seed" | "pre_seed" | "all";
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
      visibilityTrack?: "seed" | "pre_seed" | "all" | null;
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
    expertId?: string | null;
  }): Promise<Trainer> {
    const [row] = await db.insert(trainers).values(data).returning();
    return row;
  },

  async getTrainerByExpertId(expertId: string): Promise<Trainer | undefined> {
    const [row] = await db.select().from(trainers).where(eq(trainers.expertId, expertId));
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
    // No manual per-startup assignment: whichever trainer was picked for this
    // startup's track sessions IS their trainer. Most recently scheduled
    // session with a recognized trainer wins.
    const sessions = await this.listTrainingSessionsForStartup(startupId);
    if (sessions.length === 0) return undefined;
    const allTrainers = await this.listTrainers();
    const trainerByName = new Map(allTrainers.map((t) => [t.name, t]));
    const sorted = [...sessions].sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
    for (const s of sorted) {
      if (s.experts && trainerByName.has(s.experts)) return trainerByName.get(s.experts);
    }
    return undefined;
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

  /* ---------------- Expert catalog visibility (singleton) ---------------- */
  async getExpertCatalogSettings(): Promise<ExpertCatalogSettings> {
    const [existing] = await db.select().from(expertCatalogSettings).limit(1);
    if (existing) return existing;
    const [row] = await db.insert(expertCatalogSettings).values({}).returning();
    return row;
  },

  async updateExpertCatalogSettings(data: { visibleToAll: boolean; visibleStartupIds?: string[] }): Promise<ExpertCatalogSettings> {
    const existing = await this.getExpertCatalogSettings();
    const [row] = await db
      .update(expertCatalogSettings)
      .set({
        visibleToAll: data.visibleToAll,
        visibleStartupIds: data.visibleToAll ? [] : (data.visibleStartupIds ?? []),
        updatedAt: new Date(),
      })
      .where(eq(expertCatalogSettings.id, existing.id))
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

/** Groups {startupId} rows by whichever other id column they carry (sessionId, moduleId, ...). */
function groupStartupIdsBy<T extends { startupId: string }>(rows: T[], key: (row: T) => string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const k = key(row);
    if (!map.has(k)) map.set(k, new Set());
    map.get(k)!.add(row.startupId);
  }
  return map;
}

function groupStartupIdsBySessionId(rows: { sessionId: string; startupId: string }[]): Map<string, Set<string>> {
  return groupStartupIdsBy(rows, (r) => r.sessionId);
}

/**
 * Whether a training session — already gated at the module level by the
 * caller — is also visible to this specific startup. An explicit shared
 * list (if non-empty) wins outright; otherwise the session's own track
 * override applies if set; otherwise it inherits the module's own track,
 * which the caller has already checked.
 */
function trainingSessionVisibleTo(
  startupId: string,
  founderTrack: "seed" | "pre_seed" | null,
  session: { id: string; visibilityTrack: "seed" | "pre_seed" | "all" | null },
  sharedBySession: Map<string, Set<string>>,
): boolean {
  const shared = sharedBySession.get(session.id);
  if (shared && shared.size > 0) return shared.has(startupId);
  if (session.visibilityTrack) return session.visibilityTrack === "all" || session.visibilityTrack === founderTrack;
  return true;
}

/**
 * Whether a training module is visible to this startup at all. An explicit
 * startup list (if non-empty) wins outright over the module's own track.
 */
function trainingModuleVisibleTo(
  startupId: string,
  founderTrack: "seed" | "pre_seed" | null,
  module: { id: string; track: "seed" | "pre_seed" | "all" },
  sharedByModule: Map<string, Set<string>>,
): boolean {
  const shared = sharedByModule.get(module.id);
  if (shared && shared.size > 0) return shared.has(startupId);
  return module.track === "all" || module.track === founderTrack;
}
