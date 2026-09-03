import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  uuid,
  pgEnum,
  jsonb,
  bigint,
  real,
} from "drizzle-orm/pg-core";
import { z } from "zod";

/* =========================================================
 * Enums
 * =======================================================*/
export const userRoleEnum = pgEnum("user_role", [
  "startup",
  "mentor",
  "investor",
  "admin",
]);

export const authProviderEnum = pgEnum("auth_provider", ["local", "google"]);

export const startupStageEnum = pgEnum("startup_stage", [
  "idea",
  "prototype",
  "mvp",
  "early_revenue",
  "growth",
  "scale",
]);

// Deprecated single-select customer type. Kept so DB migrations stay additive
// (we now use the customerTypes array below). Do not use in new code.
export const customerTypeEnum = pgEnum("customer_type", [
  "b2b",
  "b2c",
  "b2g",
  "marketplace",
  "licensing",
]);

// KPI collection: which set of questions a startup answers (deep-tech vs
// soft-tech). Chosen once by the founder and reused for every submission.
export const startupTechTrackEnum = pgEnum("startup_tech_track", [
  "deep_tech",
  "soft_tech",
]);

// Company Profile block (Dashboard overview) — from the GROW tracking dashboard.
export const legalEntityStatusEnum = pgEnum("legal_entity_status", [
  "yes",
  "in_process",
  "no",
]);

export const businessModelTypeEnum = pgEnum("business_model_type", [
  "b2b",
  "b2c",
  "b2b2c",
]);

export const customerBaseEnum = pgEnum("customer_base", [
  "low",
  "moderate",
  "high",
  "emerging_market",
  "saturated_market",
]);

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "needs_role",
  "needs_profile",
  "complete",
]);

/* --------- Modules: goals, KPIs, data room, mentorship, office hours, school --------- */
export const goalStatusEnum = pgEnum("goal_status", [
  "on_track",
  "at_risk",
  "off_track",
  "done",
]);

export const documentCategoryEnum = pgEnum("document_category", [
  "legal",
  "financial",
  "product",
  "team",
  "fundraising",
  "other",
  "main_docs",
  "intellectual_property",
  "metrics",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "approved",
  "rejected",
]);

export const documentActionEnum = pgEnum("document_action", [
  "uploaded",
  "replaced",
  "approved",
  "rejected",
  "commented",
]);

export const officeHourBookingStatusEnum = pgEnum("office_hour_booking_status", [
  "booked",
  "cancelled",
  "completed",
]);

export const trainingModuleEnum = pgEnum("training_module", [
  "expertise",
  "immersions",
  "alumni",
]);

export const trainingProgressStatusEnum = pgEnum("training_progress_status", [
  "locked",
  "available",
  "in_progress",
  "completed",
]);

export const kysTrackEnum = pgEnum("kys_track", ["pre_seed", "seed"]);

export const irsFormEnum = pgEnum("irs_form", ["w9", "w8ben", "w8bene"]);

export const kysDocTypeEnum = pgEnum("kys_doc_type", [
  "certificate_of_incorporation",
  "proof_of_address",
  "irs_form",
  "banking",
  "declaration",
  "identity_document",
]);

// "signed" is kept only for old event rows from before contracts were
// switched to an upload-based flow; new events use "uploaded".
export const contractActionEnum = pgEnum("contract_action", [
  "signed",
  "uploaded",
  "approved",
  "rejected",
  "commented",
]);

export const kysActionEnum = pgEnum("kys_action", [
  "submitted",
  "approved",
  "rejected",
  "commented",
]);

// Five fixed lifetime stages of the program. KPIs are collected once per
// phase, not monthly.
export const kpiPhaseEnum = pgEnum("kpi_phase", [
  "program_entry",
  "during_program_1",
  "during_program_2",
  "graduation",
  "post_program",
]);

export const monthlyUpdateStatusEnum = pgEnum("monthly_update_status", [
  "on_track",
  "at_risk",
  "off_track",
]);

export const teamMemberTypeEnum = pgEnum("team_member_type", [
  "founder",
  "full_time",
  "part_time",
  "advisor",
]);

/* =========================================================
 * Users
 * =======================================================*/
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  age: integer("age"),
  country: text("country"),
  avatarUrl: text("avatar_url"),
  authProvider: authProviderEnum("auth_provider").notNull().default("local"),
  googleId: text("google_id").unique(),
  role: userRoleEnum("role"),
  onboardingStatus: onboardingStatusEnum("onboarding_status")
    .notNull()
    .default("needs_role"),
  // Which of the user's startups is currently in view. No hard FK to avoid a
  // circular reference with the startups table.
  activeStartupId: uuid("active_startup_id"),
  // Email verification
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationExpiresAt: timestamp("verification_expires_at"),
  // Pending email change (must be confirmed via the new address)
  pendingEmail: text("pending_email"),
  emailChangeToken: text("email_change_token"),
  emailChangeExpiresAt: timestamp("email_change_expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Mentors — a reusable directory; each startup gets assigned one.
 * =======================================================*/
export const mentors = pgTable("mentors", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  introduction: text("introduction"),
  pictureUrl: text("picture_url"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  linkedinUrl: text("linkedin_url"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Trainers — the same reusable-directory pattern as Mentors above,
 * but for the Training module (a duplicate of Mentorship). Kept as
 * its own table so a startup can have a different person assigned
 * to Mentorship vs. Training.
 * =======================================================*/
export const trainers = pgTable("trainers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  introduction: text("introduction"),
  pictureUrl: text("picture_url"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  linkedinUrl: text("linkedin_url"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Experts ("Other experts" catalog) — a browsable directory shown
 * on its own Mentorship tab, imported once from an external sheet.
 * No contact info: browsing only. Each startup can rate how much
 * priority they place on a given expert (expertPriorities below).
 * =======================================================*/
export const experts = pgTable("experts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  bio: text("bio"),
  industries: text("industries").array(),
  expertiseAreas: text("expertise_areas").array(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// One row per (expert, startup) — the startup's own priority rating for
// that expert, set from the founder-facing catalog. Created on first save.
export const expertPriorities = pgTable("expert_priorities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  expertId: uuid("expert_id")
    .references(() => experts.id, { onDelete: "cascade" })
    .notNull(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  priority: integer("priority").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Startups (one user can own many)
 * =======================================================*/
export const startups = pgTable("startups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  mentorId: uuid("mentor_id").references(() => mentors.id, { onDelete: "set null" }),
  trainerId: uuid("trainer_id").references(() => trainers.id, { onDelete: "set null" }),

  // Basics
  companyName: text("company_name").notNull(),
  website: text("website"),

  // Survey: about
  shortDescription: varchar("short_description", { length: 300 }),
  location: text("location"),
  markets: text("markets").array(),
  stage: startupStageEnum("stage"),

  // Survey: revenue
  revenueLastMonth: bigint("revenue_last_month", { mode: "number" }),
  revenueLast12Months: bigint("revenue_last_12_months", { mode: "number" }),

  // Survey: detail
  detailedDescription: text("detailed_description"),
  differentiator: varchar("differentiator", { length: 140 }),
  isIncorporated: boolean("is_incorporated"),
  startedMonth: integer("started_month"),
  startedYear: integer("started_year"),

  // Survey: links map (linkedin, facebook, twitter, github, instagram,
  // telegram, discord, snapchat, tiktok, appleAppStore, googlePlayStore)
  links: jsonb("links").$type<Record<string, string>>().default({}),

  // Survey: media
  productVideoUrl: text("product_video_url"),
  productVideoPrivate: boolean("product_video_private").default(false),
  teamVideoUrl: text("team_video_url"),
  teamVideoPrivate: boolean("team_video_private").default(false),
  deckUrl: text("deck_url"),

  // Survey: fundraising
  isRaising: boolean("is_raising"),
  amountRaised: bigint("amount_raised", { mode: "number" }),
  investorsEquityHolders: text("investors_equity_holders"),
  runwayMonths: integer("runway_months"),
  isProfitable: boolean("is_profitable").default(false),

  // Survey: customers & product
  customerType: customerTypeEnum("customer_type"), // deprecated, unused
  customerTypes: text("customer_types").array(), // b2b,b2c,b2g,b2b2c,marketplace,licensing
  interactionPlatforms: text("interaction_platforms").array(),

  logoUrl: text("logo_url"),

  // KPI collection: which question set the startup answers.
  techTrack: startupTechTrackEnum("tech_track"),

  // Dashboard overview — Startup Profile block (GROW tracking dashboard).
  legalEntityStatus: legalEntityStatusEnum("legal_entity_status"),
  country: text("country"),
  businessModelType: businessModelTypeEnum("business_model_type"),
  dataRoomLink: text("data_room_link"),
  // Founder-controlled signal: "I changed something inside my data room."
  // We can't see inside an external link, so this is manual, not detected.
  dataRoomUpdatedAt: timestamp("data_room_updated_at"),
  coreBusinessOverview: text("core_business_overview"),
  coreIpTechnology: text("core_ip_technology"),

  // Dashboard overview — Traction & previous funding / Round Details blocks.
  totalRevenueSinceFounding: bigint("total_revenue_since_founding", { mode: "number" }),
  totalGrants: bigint("total_grants", { mode: "number" }),
  totalRoundSize: bigint("total_round_size", { mode: "number" }),
  roundTerms: text("round_terms"),
  lastValuation: bigint("last_valuation", { mode: "number" }),

  // Dashboard overview — Impact Metrics / Markets blocks.
  sdgsAddressed: text("sdgs_addressed").array(),
  femaleTeamMembers: integer("female_team_members"),
  youthEmployees: integer("youth_employees"),
  countryOfIncorporation: text("country_of_incorporation"),
  customerBase: customerBaseEnum("customer_base"),
  countriesOfOperation: text("countries_of_operation"),

  // Set once the startup finishes the program. Unlocks the Alumni & Fellows
  // section of Open Startup School. Null = still active in the program.
  graduatedAt: timestamp("graduated_at"),

  // Deletion is gated behind admin approval. A non-null requestedAt means the
  // owner has asked to delete it and it is awaiting an admin decision.
  deletionRequestedAt: timestamp("deletion_requested_at"),
  deletionReason: text("deletion_reason"),

  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Goals (Dashboard)
 * =======================================================*/
export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetDate: timestamp("target_date"),
  status: goalStatusEnum("status").notNull().default("on_track"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/* =========================================================
 * KPI submissions (Dashboard / KPI Visualizations)
 * One row per startup per month.
 * =======================================================*/
export const kpiSubmissions = pgTable("kpi_submissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  phase: kpiPhaseEnum("phase").notNull(),
  revenue: bigint("revenue", { mode: "number" }),
  activeUsers: integer("active_users"),
  newCustomers: integer("new_customers"),
  burnRate: bigint("burn_rate", { mode: "number" }),
  cashOnHand: bigint("cash_on_hand", { mode: "number" }),
  teamSize: integer("team_size"),
  runwayMonths: integer("runway_months"),
  // Extra metrics beyond the core columns above, kept flexible on purpose.
  metrics: jsonb("metrics").$type<Record<string, unknown>>().default({}),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Data Room
 * =======================================================*/
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  category: documentCategoryEnum("category").notNull().default("other"),
  // Stable slug (e.g. "pitch_deck") linking this upload to a specific item in
  // the Data Room checklist — null for uploads not tied to a checklist item.
  checklistKey: text("checklist_key"),
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  status: documentStatusEnum("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Audit trail: every upload/replace/review action on a document.
export const documentEvents = pgTable("document_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id")
    .references(() => documents.id, { onDelete: "cascade" })
    .notNull(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  action: documentActionEnum("action").notNull(),
  note: text("note"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// A founder-created, read-only external link into a chosen subset of their
// Data Room documents. The token (not the row id) is the actual secret — long
// and random, so it's safe to put in a URL. Expires on its own; the founder
// can also revoke it early at any time.
export const dataRoomShares = pgTable("data_room_shares", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").notNull().unique(),
  title: text("title"),
  documentIds: uuid("document_ids").array().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  viewCount: integer("view_count").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Office Hours
 * =======================================================*/
export const officeHourSlots = pgTable("office_hour_slots", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hostName: text("host_name").notNull(),
  topic: text("topic"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  capacity: integer("capacity").notNull().default(1),
  meetingLink: text("meeting_link"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const officeHourBookings = pgTable("office_hour_bookings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: uuid("slot_id")
    .references(() => officeHourSlots.id, { onDelete: "cascade" })
    .notNull(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  topic: text("topic"),
  status: officeHourBookingStatusEnum("status").notNull().default("booked"),
  recap: text("recap"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Open Startup School (Expertise / Immersions / Alumni & Fellows)
 * =======================================================*/
export const trainings = pgTable("trainings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  module: trainingModuleEnum("module").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  resourceUrl: text("resource_url"),
  // Months since a startup joined the program before this unlocks.
  // Ignored for the "alumni" module, which unlocks on graduation instead.
  unlockMonth: integer("unlock_month").notNull().default(0),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const trainingProgress = pgTable("training_progress", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  trainingId: uuid("training_id")
    .references(() => trainings.id, { onDelete: "cascade" })
    .notNull(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  status: trainingProgressStatusEnum("status").notNull().default("in_progress"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Mentorship (Sessions) — a flat, ungrouped list of sessions;
 * there is no "module" concept and no per-module/session locking
 * (every session is visible once KYS is submitted). The DB table
 * is still named mentorship_module_sessions and an orphaned,
 * unused mentorship_modules table still exists from the earlier
 * module-based design — left in place non-destructively, same as
 * the older mentorship_sessions table before it.
 * =======================================================*/
export const mentorshipModuleSessionStatusEnum = pgEnum("mentorship_module_session_status", ["upcoming", "completed"]);

export const mentorshipModuleSessions = pgTable("mentorship_module_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(120),
  experts: text("experts"), // free text, e.g. "Ivy Shultz & Farzin Samadani"
  mentorBio: text("mentor_bio"), // shared — describes the mentor, not any one startup
  status: mentorshipModuleSessionStatusEnum("status").notNull().default("upcoming"),
  meetingLink: text("meeting_link"), // "Join" action for upcoming sessions
  recordingUrl: text("recording_url"),
  transcriptUrl: text("transcript_url"),
  materialsUrl: text("materials_url"), // slides/handouts/resources for this session
  // Parsed automatically from meetingLink when it's a Zoom join link — lets
  // the Zoom recording webhook find this exact session with a direct lookup.
  zoomMeetingId: text("zoom_meeting_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Per-(session, startup) recap — the mentor's notes and rating for THIS
// startup's relationship. One row per pair, created on first save (not
// pre-created for every session).
export const mentorshipSessionNotes = pgTable("mentorship_session_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id")
    .references(() => mentorshipModuleSessions.id, { onDelete: "cascade" })
    .notNull(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  // Admin/mentor-owned.
  teamMembersPresence: text("team_members_presence"),
  pointsDiscussed: text("points_discussed"),
  whatIsGoingWell: text("what_is_going_well"),
  whatIsNotGoingWell: text("what_is_not_going_well"),
  actionItems: text("action_items"),
  mentorRating: integer("mentor_rating"),
  mentorFeedback: text("mentor_feedback"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Training (Modules + Sessions) — a duplicate of the Mentorship
 * module above, under its own "Training" nav item and its own
 * trainer directory (see Trainers above). Not the Open Startup
 * School curriculum (trainings/training_progress above) — table
 * names below use "training_module_*" to stay clear of that
 * older "trainings" table.
 * =======================================================*/
export const trainingModuleSessionStatusEnum = pgEnum("training_module_session_status", ["upcoming", "completed"]);

export const trainingModules = pgTable("training_modules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  durationLabel: text("duration_label"), // e.g. "4 weeks"
  unlocked: boolean("unlocked").notNull().default(false), // admin toggle, program-wide
  unlockedAt: timestamp("unlocked_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const trainingModuleSessions = pgTable("training_module_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: uuid("module_id")
    .references(() => trainingModules.id, { onDelete: "cascade" })
    .notNull(),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(120),
  experts: text("experts"), // free text, e.g. "Ivy Shultz & Farzin Samadani"
  trainerBio: text("trainer_bio"), // shared — describes the trainer, not any one startup
  status: trainingModuleSessionStatusEnum("status").notNull().default("upcoming"),
  meetingLink: text("meeting_link"), // "Join" action for upcoming sessions
  presentationUrl: text("presentation_url"),
  recordingUrl: text("recording_url"),
  transcriptUrl: text("transcript_url"),
  // Parsed automatically from meetingLink when it's a Zoom join link — lets
  // the Zoom recording webhook find this exact session with a direct lookup.
  zoomMeetingId: text("zoom_meeting_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Per-(session, startup) recap — the trainer's notes and rating for THIS
// startup's relationship. One row per pair, created on first save (not
// pre-created for every session). Homework lives at the module level (see
// trainingModuleHomework below), not here — one assignment per module.
export const trainingSessionNotes = pgTable("training_session_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id")
    .references(() => trainingModuleSessions.id, { onDelete: "cascade" })
    .notNull(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  // Admin/trainer-owned.
  teamMembersPresence: text("team_members_presence"),
  pointsDiscussed: text("points_discussed"),
  whatIsGoingWell: text("what_is_going_well"),
  whatIsNotGoingWell: text("what_is_not_going_well"),
  actionItems: text("action_items"),
  trainerRating: integer("trainer_rating"),
  trainerFeedback: text("trainer_feedback"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Per-(module, startup) homework — one OST-assigned doc + one startup
// submission per module (not per session). One row per pair, created on
// first save.
export const trainingModuleHomework = pgTable("training_module_homework", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: uuid("module_id")
    .references(() => trainingModules.id, { onDelete: "cascade" })
    .notNull(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  // Admin-owned.
  homeworkUrl: text("homework_url"),
  // Founder-owned.
  submissionFileUrl: text("submission_file_url"),
  submissionFileName: text("submission_file_name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Contract & KYS (Priority lane, step 1 + admin review)
 * Signing/submitting creates or resets the row to "pending"; an admin then
 * approves or rejects it, same lifecycle as the Data Room documents table.
 * =======================================================*/
// The startup signs the program agreement on an external platform, then
// uploads the signed PDF here — the platform never handles signing itself.
export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  uploadedAt: timestamp("uploaded_at"),
  status: documentStatusEnum("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Audit trail: every sign/review action on a contract.
export const contractEvents = pgTable("contract_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: uuid("contract_id")
    .references(() => contracts.id, { onDelete: "cascade" })
    .notNull(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  action: contractActionEnum("action").notNull(),
  note: text("note"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const kysProfiles = pgTable("kys_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  track: kysTrackEnum("track").notNull(),
  incorporated: boolean("incorporated").notNull(),

  // Path A - incorporated
  addressLine1: text("address_line1"),
  city: text("city"),
  country: text("country"),
  incorporationDate: text("incorporation_date"),
  tin: text("tin"),
  signatoryName: text("signatory_name"),
  signatoryPhone: text("signatory_phone"),
  signatoryEmail: text("signatory_email"),
  irsForm: irsFormEnum("irs_form"),
  acceptsAltPayment: boolean("accepts_alt_payment"),
  altPaymentDetail: text("alt_payment_detail"),

  // Path B - not incorporated
  repName: text("rep_name"),
  repPhone: text("rep_phone"),
  repEmail: text("rep_email"),
  disclaimerAccepted: boolean("disclaimer_accepted"),

  consentAccepted: boolean("consent_accepted").notNull().default(false),
  submittedAt: timestamp("submitted_at").notNull().default(sql`now()`),
  status: documentStatusEnum("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Audit trail: every submit/review action on a KYS profile.
export const kysEvents = pgTable("kys_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  kysProfileId: uuid("kys_profile_id")
    .references(() => kysProfiles.id, { onDelete: "cascade" })
    .notNull(),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  action: kysActionEnum("action").notNull(),
  note: text("note"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const kysDocuments = pgTable("kys_documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  docType: kysDocTypeEnum("doc_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Monthly updates (Dashboard)
 * One row per startup per calendar month.
 * =======================================================*/
export const monthlyUpdates = pgTable("monthly_updates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  periodMonth: integer("period_month").notNull(), // 1-12
  periodYear: integer("period_year").notNull(),
  achieved: text("achieved").notNull(),
  blocked: text("blocked").notNull(),
  focusNext: text("focus_next").notNull(),
  status: monthlyUpdateStatusEnum("status").notNull().default("on_track"),
  supportNeeded: text("support_needed"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Team (Dashboard)
 * =======================================================*/
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  role: text("role"),
  type: teamMemberTypeEnum("type").notNull().default("full_time"),
  joinedAt: timestamp("joined_at").notNull().default(sql`now()`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Cap Table (Dashboard overview)
 * =======================================================*/
export const capTableEntries = pgTable("cap_table_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  startupId: uuid("startup_id")
    .references(() => startups.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  percentage: real("percentage").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

/* =========================================================
 * Session store (connect-pg-simple)
 * =======================================================*/
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

/* =========================================================
 * Validation
 * =======================================================*/
export const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    age: z
      .number({ invalid_type_error: "Age is required" })
      .int()
      .min(13, "You must be at least 13")
      .max(120, "Enter a valid age"),
    country: z.string().min(1, "Country is required"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const selectRoleSchema = z.object({
  role: z.enum(["startup", "mentor", "investor", "admin"]),
});

export const startupBasicsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  website: z.string().url("Enter a valid URL (include https://)"),
});

// Account management
export const updateAccountSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  age: z.number().int().min(13).max(120).optional(),
  country: z.string().min(1, "Country is required").optional(),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email("Enter a valid email"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const optionalUrl = z.string().url("Enter a valid URL").optional().or(z.literal(""));

/**
 * Full survey validation reflecting the mapped required / optional / conditional
 * rules from the First Login Survey.
 */
export const startupSurveySchema = z
  .object({
    // required
    companyName: z.string().min(1, "Company name is required"),
    shortDescription: z.string().min(1, "Short description is required").max(300),
    location: z.string().min(1, "Location is required"),
    markets: z.array(z.string()).min(1, "Add at least one market"),
    stage: z.enum(
      ["idea", "prototype", "mvp", "early_revenue", "growth", "scale"],
      { errorMap: () => ({ message: "Select a stage" }) },
    ),
    website: z.string().url("A valid website URL is required"),
    deckUrl: z.string().min(1, "A deck link is required"),

    // links: linkedin required, rest optional
    links: z.record(z.string()).default({}),

    // optional
    productVideoUrl: optionalUrl,
    productVideoPrivate: z.boolean().optional(),
    teamVideoUrl: optionalUrl,
    teamVideoPrivate: z.boolean().optional(),

    // No longer collected in the onboarding survey — dropped from StartupForm,
    // but kept optional (not removed) since existing data still shows on
    // ViewStartup.tsx, and startedYear/amountRaised are also edited from the
    // separate Dashboard "Edit startup profile" flow (OverviewTab.tsx).
    revenueLastMonth: z.number().nonnegative().optional(),
    revenueLast12Months: z.number().nonnegative().optional(),
    detailedDescription: z.string().max(2500).optional().or(z.literal("")),
    differentiator: z.string().max(140).optional().or(z.literal("")),
    isIncorporated: z.boolean().optional(),
    startedMonth: z.number().int().min(1).max(12).optional(),
    startedYear: z.number().int().min(1900).max(2100).optional(),
    isRaising: z.boolean().optional(),
    runwayMonths: z.number().int().nonnegative().optional(),
    customerTypes: z.array(z.string()).optional(),
    isProfitable: z.boolean().optional(),
    investorsEquityHolders: z.string().optional().or(z.literal("")),
    interactionPlatforms: z.array(z.string()).optional(),
    amountRaised: z.number().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.links?.linkedin || data.links.linkedin.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LinkedIn URL is required",
        path: ["links", "linkedin"],
      });
    }
    if (data.isRaising === true && data.amountRaised === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter how much you've raised (0 if none)",
        path: ["amountRaised"],
      });
    }
  });

export const requestDeletionSchema = z.object({
  reason: z.string().max(1000).optional().or(z.literal("")),
});

/* --------- Modules --------- */
export const goalSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  targetDate: z.string().optional().or(z.literal("")),
  status: z.enum(["on_track", "at_risk", "off_track", "done"]).optional(),
});

export const kpiSubmissionSchema = z.object({
  phase: z.enum(["program_entry", "during_program_1", "during_program_2", "graduation", "post_program"]),
  revenue: z.number().nonnegative().optional(),
  activeUsers: z.number().int().nonnegative().optional(),
  newCustomers: z.number().int().nonnegative().optional(),
  burnRate: z.number().nonnegative().optional(),
  cashOnHand: z.number().nonnegative().optional(),
  teamSize: z.number().int().nonnegative().optional(),
  runwayMonths: z.number().int().nonnegative().optional(),
  metrics: z.record(z.any()).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const documentUploadSchema = z.object({
  category: z.enum(["legal", "financial", "product", "team", "fundraising", "other", "main_docs", "intellectual_property", "metrics"]),
  title: z.string().min(1, "Title is required").max(200),
  checklistKey: z.string().max(100).optional().or(z.literal("")),
});

export const documentReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(1000).optional().or(z.literal("")),
});

export const dataRoomShareSchema = z.object({
  title: z.string().max(200).optional().or(z.literal("")),
  documentIds: z.array(z.string().uuid()).min(1, "Pick at least one document to share"),
  expiresInDays: z.number().int().min(1).max(365),
});

// Data Room, for now: the startup just points at wherever their documents
// already live (Google Drive, Dropbox, Notion, DocSend, etc.) instead of
// uploading through the platform. Shares the same startups.dataRoomLink
// column as the Dashboard overview, but as its own small, safe-to-partially-
// submit schema (the overview route replaces every field on every save).
export const dataRoomSubmissionSchema = z.object({
  dataRoomLink: z.string().url("Enter a valid link").max(500).optional().or(z.literal("")),
});

// Dashboard overview — the whole GROW tracking dashboard "1. Startup Profile" sheet.
export const startupProfileOverviewSchema = z.object({
  // Startup Profile
  legalEntityStatus: z.enum(["yes", "in_process", "no"]).optional().or(z.literal("")),
  startedYear: z.number().int().min(1900).max(2100).optional(),
  country: z.string().max(100).optional().or(z.literal("")),
  businessModelType: z.enum(["b2b", "b2c", "b2b2c"]).optional().or(z.literal("")),
  dataRoomLink: z.string().url("Enter a valid URL").max(500).optional().or(z.literal("")),
  // Core Business / Core IP
  coreBusinessOverview: z.string().max(1600).optional().or(z.literal("")),
  coreIpTechnology: z.string().max(1600).optional().or(z.literal("")),
  // Traction & previous funding / Round Details
  totalRevenueSinceFounding: z.number().nonnegative().optional(),
  amountRaised: z.number().nonnegative().optional(),
  totalGrants: z.number().nonnegative().optional(),
  totalRoundSize: z.number().nonnegative().optional(),
  roundTerms: z.string().max(300).optional().or(z.literal("")),
  lastValuation: z.number().nonnegative().optional(),
  // Impact Metrics / Markets
  sdgsAddressed: z.array(z.string()).optional(),
  femaleTeamMembers: z.number().int().nonnegative().optional(),
  youthEmployees: z.number().int().nonnegative().optional(),
  countryOfIncorporation: z.string().max(100).optional().or(z.literal("")),
  customerBase: z
    .enum(["low", "moderate", "high", "emerging_market", "saturated_market"])
    .optional()
    .or(z.literal("")),
  countriesOfOperation: z.string().max(300).optional().or(z.literal("")),
});

export const capTableEntrySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  percentage: z.number().min(0).max(100),
});

export const startupTechTrackSchema = z.object({
  // null clears the choice, sending the startup back to the track picker.
  techTrack: z.enum(["deep_tech", "soft_tech"]).nullable(),
});

export const officeHourBookingSchema = z.object({
  slotId: z.string().uuid("Pick a slot"),
  topic: z.string().max(300).optional().or(z.literal("")),
});

export const trainingProgressSchema = z.object({
  status: z.enum(["in_progress", "completed"]),
});

export const trainingSchema = z.object({
  module: z.enum(["expertise", "immersions", "alumni"]),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  resourceUrl: z.string().max(500).optional().or(z.literal("")),
  unlockMonth: z.number().int().min(0).max(60).optional(),
});

export const mentorSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  introduction: z.string().max(1000).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email").max(320).optional().or(z.literal("")),
  whatsapp: z.string().max(30).optional().or(z.literal("")),
  linkedinUrl: z.string().url("Enter a valid link").max(500).optional().or(z.literal("")),
});

export const assignMentorSchema = z.object({
  mentorId: z.string().uuid().nullable(),
});

export const mentorshipModuleSessionSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  scheduledAt: z.string().min(1, "Date is required"),
  durationMinutes: z.number().int().positive().optional(),
  experts: z.string().max(300).optional().or(z.literal("")),
  mentorBio: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["upcoming", "completed"]).optional(),
  meetingLink: z.string().max(500).optional().or(z.literal("")),
  recordingUrl: z.string().max(500).optional().or(z.literal("")),
  transcriptUrl: z.string().max(500).optional().or(z.literal("")),
  materialsUrl: z.string().max(500).optional().or(z.literal("")),
});

// Filled in by the startup itself, briefly, after a session is held.
export const mentorshipSessionRecapSchema = z.object({
  teamMembersPresence: z.string().max(500).optional().or(z.literal("")),
  pointsDiscussed: z.string().max(2000).optional().or(z.literal("")),
  whatIsGoingWell: z.string().max(2000).optional().or(z.literal("")),
  whatIsNotGoingWell: z.string().max(2000).optional().or(z.literal("")),
  actionItems: z.string().max(2000).optional().or(z.literal("")),
});

// Admin/mentor-owned — the rating and written feedback given to this startup.
export const mentorshipMentorFeedbackSchema = z.object({
  mentorRating: z.number().int().min(1).max(5).optional(),
  mentorFeedback: z.string().max(2000).optional().or(z.literal("")),
});

export const trainingModuleSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  durationLabel: z.string().max(50).optional().or(z.literal("")),
  unlocked: z.boolean().optional(),
});

export const trainerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  introduction: z.string().max(1000).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email").max(320).optional().or(z.literal("")),
  whatsapp: z.string().max(30).optional().or(z.literal("")),
  linkedinUrl: z.string().url("Enter a valid link").max(500).optional().or(z.literal("")),
});

export const expertSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  bio: z.string().max(4000).optional().or(z.literal("")),
  industries: z.array(z.string().max(100)).max(20).optional(),
  expertiseAreas: z.array(z.string().max(100)).max(20).optional(),
});

export const expertPrioritySchema = z.object({
  priority: z.number().int().min(1).max(5),
});

export const assignTrainerSchema = z.object({
  trainerId: z.string().uuid().nullable(),
});

export const trainingModuleSessionSchema = z.object({
  moduleId: z.string().uuid(),
  number: z.number().int().positive(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  scheduledAt: z.string().min(1, "Date is required"),
  durationMinutes: z.number().int().positive().optional(),
  experts: z.string().max(300).optional().or(z.literal("")),
  trainerBio: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["upcoming", "completed"]).optional(),
  meetingLink: z.string().max(500).optional().or(z.literal("")),
  presentationUrl: z.string().max(500).optional().or(z.literal("")),
  recordingUrl: z.string().max(500).optional().or(z.literal("")),
  transcriptUrl: z.string().max(500).optional().or(z.literal("")),
});

// Filled in by the startup itself, briefly, after a session is held.
export const trainingSessionRecapSchema = z.object({
  teamMembersPresence: z.string().max(500).optional().or(z.literal("")),
  pointsDiscussed: z.string().max(2000).optional().or(z.literal("")),
  whatIsGoingWell: z.string().max(2000).optional().or(z.literal("")),
  whatIsNotGoingWell: z.string().max(2000).optional().or(z.literal("")),
  actionItems: z.string().max(2000).optional().or(z.literal("")),
});

// Admin/trainer-owned — the rating and written feedback given to this startup.
export const trainingTrainerFeedbackSchema = z.object({
  trainerRating: z.number().int().min(1).max(5).optional(),
  trainerFeedback: z.string().max(2000).optional().or(z.literal("")),
});

export const trainingModuleHomeworkSchema = z.object({
  homeworkUrl: z.string().max(500).optional().or(z.literal("")),
});

export const kysSubmitSchema = z
  .object({
    track: z.enum(["pre_seed", "seed"], {
      errorMap: () => ({ message: "Select a program track" }),
    }),
    incorporated: z.boolean({ invalid_type_error: "Select Yes or No" }),

    addressLine1: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    incorporationDate: z.string().optional(),
    tin: z.string().optional(),
    signatoryName: z.string().optional(),
    signatoryPhone: z.string().optional(),
    signatoryEmail: z.string().optional(),
    irsForm: z.enum(["w9", "w8ben", "w8bene"]).optional(),
    acceptsAltPayment: z.boolean().optional(),
    altPaymentDetail: z.string().optional().or(z.literal("")),

    repName: z.string().optional(),
    repPhone: z.string().optional(),
    repEmail: z.string().optional(),
    disclaimerAccepted: z.boolean().optional(),

    consentAccepted: z.literal(true, {
      errorMap: () => ({ message: "Consent is required to submit" }),
    }),
  })
  .superRefine((data, ctx) => {
    const req = (field: keyof typeof data, message: string) => {
      if (!data[field]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [field] });
      }
    };
    if (data.incorporated) {
      req("addressLine1", "Registered address is required");
      req("city", "City is required");
      req("country", "Country is required");
      req("incorporationDate", "Date of incorporation is required");
      req("tin", "Tax ID is required");
      req("signatoryName", "Signatory name is required");
      req("signatoryPhone", "Signatory phone is required");
      req("signatoryEmail", "Signatory email is required");
      req("irsForm", "Select an IRS form");
    } else {
      req("repName", "Representative name is required");
      req("repPhone", "Representative phone is required");
      req("repEmail", "Representative email is required");
      if (data.disclaimerAccepted === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Accept or decline the disclaimer",
          path: ["disclaimerAccepted"],
        });
      }
    }
  });

export const kysDocumentUploadSchema = z.object({
  docType: z.enum([
    "certificate_of_incorporation",
    "proof_of_address",
    "irs_form",
    "banking",
    "declaration",
    "identity_document",
  ]),
});

export const monthlyUpdateSchema = z.object({
  achieved: z.string().min(1, "Required").max(2000),
  blocked: z.string().min(1, "Required").max(2000),
  focusNext: z.string().min(1, "Required").max(2000),
  status: z.enum(["on_track", "at_risk", "off_track"]).optional(),
  supportNeeded: z.string().max(2000).optional().or(z.literal("")),
});

export const teamMemberSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  role: z.string().max(200).optional().or(z.literal("")),
  type: z.enum(["founder", "full_time", "part_time", "advisor"]),
});

/* =========================================================
 * Types
 * =======================================================*/
export type User = typeof users.$inferSelect;
export type Startup = typeof startups.$inferSelect;
export type Mentor = typeof mentors.$inferSelect;
export type Trainer = typeof trainers.$inferSelect;
export type Expert = typeof experts.$inferSelect;
export type ExpertPriority = typeof expertPriorities.$inferSelect;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type StartupBasicsInput = z.infer<typeof startupBasicsSchema>;
export type StartupSurveyInput = z.infer<typeof startupSurveySchema>;
export type StartupProfileOverviewInput = z.infer<typeof startupProfileOverviewSchema>;
export type DataRoomSubmissionInput = z.infer<typeof dataRoomSubmissionSchema>;
export type PublicUser = Omit<User, "password">;

export type Goal = typeof goals.$inferSelect;
export type KpiSubmission = typeof kpiSubmissions.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentEvent = typeof documentEvents.$inferSelect;
export type DataRoomShare = typeof dataRoomShares.$inferSelect;
export type DataRoomShareInput = z.infer<typeof dataRoomShareSchema>;
export type OfficeHourSlot = typeof officeHourSlots.$inferSelect;
export type OfficeHourBooking = typeof officeHourBookings.$inferSelect;
export type Training = typeof trainings.$inferSelect;
export type TrainingProgress = typeof trainingProgress.$inferSelect;
export type MentorshipModuleSession = typeof mentorshipModuleSessions.$inferSelect;
export type MentorshipSessionNotes = typeof mentorshipSessionNotes.$inferSelect;
export type TrainingModule = typeof trainingModules.$inferSelect;
export type TrainingModuleSession = typeof trainingModuleSessions.$inferSelect;
export type TrainingSessionNotes = typeof trainingSessionNotes.$inferSelect;
export type TrainingModuleHomework = typeof trainingModuleHomework.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ContractEvent = typeof contractEvents.$inferSelect;
export type KysProfile = typeof kysProfiles.$inferSelect;
export type KysEvent = typeof kysEvents.$inferSelect;
export type KysDocument = typeof kysDocuments.$inferSelect;
export type MonthlyUpdate = typeof monthlyUpdates.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type CapTableEntry = typeof capTableEntries.$inferSelect;

export type GoalInput = z.infer<typeof goalSchema>;
export type KpiSubmissionInput = z.infer<typeof kpiSubmissionSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentReviewInput = z.infer<typeof documentReviewSchema>;
export type OfficeHourBookingInput = z.infer<typeof officeHourBookingSchema>;
export type TrainingProgressInput = z.infer<typeof trainingProgressSchema>;
export type TrainingInput = z.infer<typeof trainingSchema>;
export type MentorInput = z.infer<typeof mentorSchema>;
export type AssignMentorInput = z.infer<typeof assignMentorSchema>;
export type MentorshipModuleSessionInput = z.infer<typeof mentorshipModuleSessionSchema>;
export type MentorshipSessionRecapInput = z.infer<typeof mentorshipSessionRecapSchema>;
export type MentorshipMentorFeedbackInput = z.infer<typeof mentorshipMentorFeedbackSchema>;
export type TrainingModuleInput = z.infer<typeof trainingModuleSchema>;
export type TrainerInput = z.infer<typeof trainerSchema>;
export type ExpertInput = z.infer<typeof expertSchema>;
export type ExpertPriorityInput = z.infer<typeof expertPrioritySchema>;
export type AssignTrainerInput = z.infer<typeof assignTrainerSchema>;
export type TrainingModuleSessionInput = z.infer<typeof trainingModuleSessionSchema>;
export type TrainingSessionRecapInput = z.infer<typeof trainingSessionRecapSchema>;
export type TrainingTrainerFeedbackInput = z.infer<typeof trainingTrainerFeedbackSchema>;
export type TrainingModuleHomeworkInput = z.infer<typeof trainingModuleHomeworkSchema>;
export type KysSubmitInput = z.infer<typeof kysSubmitSchema>;
export type KysDocumentUploadInput = z.infer<typeof kysDocumentUploadSchema>;
export type MonthlyUpdateInput = z.infer<typeof monthlyUpdateSchema>;
export type TeamMemberInput = z.infer<typeof teamMemberSchema>;
export type CapTableEntryInput = z.infer<typeof capTableEntrySchema>;
export type StartupTechTrackInput = z.infer<typeof startupTechTrackSchema>;
