// Direct, idempotent database updater. Adds any columns the app needs that are
// missing, and relaxes the old one-startup-per-user limit. Safe to run anytime.
import pkg from "pg";
import "dotenv/config";

const { Client } = pkg;
const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

function sanitize(u) {
  try {
    const url = new URL(u);
    url.searchParams.delete("channel_binding");
    return url.toString();
  } catch {
    return u;
  }
}

const connectionString = sanitize(raw);
const needsSSL =
  /sslmode=require/.test(connectionString) ||
  /neon\.tech|supabase\.|render\.com|amazonaws\.com|azure\.com/.test(connectionString);

const client = new Client({
  connectionString,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
});

const sql = `
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'main_docs';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'intellectual_property';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'metrics';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS checklist_key text;
CREATE TABLE IF NOT EXISTS data_room_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  title text,
  document_ids uuid[] NOT NULL,
  expires_at timestamp NOT NULL,
  revoked_at timestamp,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamp,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_startup_id uuid;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS customer_types text[];
ALTER TABLE startups ADD COLUMN IF NOT EXISTS deletion_requested_at timestamp;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS deletion_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_expires_at timestamp;
-- Grandfather every existing account as verified so no one is locked out.
UPDATE users SET email_verified = true
  WHERE email_verified = false AND verification_token IS NULL;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS interaction_platforms text[];
ALTER TABLE startups ADD COLUMN IF NOT EXISTS graduated_at timestamp;
ALTER TABLE startups ALTER COLUMN short_description TYPE varchar(300);
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
    FROM pg_constraint
   WHERE conrelid = 'startups'::regclass
     AND contype = 'u'
     AND pg_get_constraintdef(oid) ILIKE '%user_id%'
   LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE startups DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

-- Module tables (goals, KPIs, data room, mentorship, office hours, school).
-- These were defined in shared/schema.ts but never actually created in the
-- database because this hand-rolled script only ever ALTERed users/startups.
DO $$ BEGIN
  CREATE TYPE goal_status AS ENUM ('on_track','at_risk','off_track','done');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE document_category AS ENUM ('legal','financial','product','team','fundraising','other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE document_action AS ENUM ('uploaded','replaced','approved','rejected','commented');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE mentorship_status AS ENUM ('scheduled','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE office_hour_booking_status AS ENUM ('booked','cancelled','completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE training_module AS ENUM ('expertise','immersions','alumni');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE training_progress_status AS ENUM ('locked','available','in_progress','completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_date timestamp,
  status goal_status NOT NULL DEFAULT 'on_track',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kpi_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  revenue bigint,
  active_users integer,
  new_customers integer,
  burn_rate bigint,
  cash_on_hand bigint,
  team_size integer,
  runway_months integer,
  metrics jsonb DEFAULT '{}',
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  category document_category NOT NULL DEFAULT 'other',
  title text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes integer,
  status document_status NOT NULL DEFAULT 'pending',
  review_note text,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  action document_action NOT NULL,
  note text,
  actor_id uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mentorship_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  mentor_name text NOT NULL,
  topic text,
  scheduled_at timestamp NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 45,
  status mentorship_status NOT NULL DEFAULT 'scheduled',
  notes text,
  action_items text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS meeting_link text;

CREATE TABLE IF NOT EXISTS office_hour_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_name text NOT NULL,
  topic text,
  starts_at timestamp NOT NULL,
  ends_at timestamp NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  meeting_link text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS office_hour_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES office_hour_slots(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  topic text,
  status office_hour_booking_status NOT NULL DEFAULT 'booked',
  recap text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module training_module NOT NULL,
  title text NOT NULL,
  description text,
  resource_url text,
  unlock_month integer NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  status training_progress_status NOT NULL DEFAULT 'in_progress',
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Contract & KYS (Priority lane, step 1). Auto-submit for now, no admin
-- review step - signedAt/submittedAt non-null means done.
DO $$ BEGIN
  CREATE TYPE signature_method AS ENUM ('type','draw','upload');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE kys_track AS ENUM ('pre_seed','seed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE irs_form AS ENUM ('w9','w8ben','w8bene');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE kys_doc_type AS ENUM ('certificate_of_incorporation','proof_of_address','irs_form','banking','declaration','identity_document');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL UNIQUE REFERENCES startups(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  signer_title text NOT NULL,
  authority_confirmed boolean NOT NULL DEFAULT false,
  terms_accepted boolean NOT NULL DEFAULT false,
  signature_method signature_method NOT NULL,
  signature_value text NOT NULL,
  signed_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kys_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL UNIQUE REFERENCES startups(id) ON DELETE CASCADE,
  track kys_track NOT NULL,
  incorporated boolean NOT NULL,
  address_line1 text,
  city text,
  country text,
  incorporation_date text,
  tin text,
  signatory_name text,
  signatory_phone text,
  signatory_email text,
  irs_form irs_form,
  accepts_alt_payment boolean,
  alt_payment_detail text,
  rep_name text,
  rep_phone text,
  rep_email text,
  disclaimer_accepted boolean,
  consent_accepted boolean NOT NULL DEFAULT false,
  submitted_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kys_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  doc_type kys_doc_type NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Team + Monthly updates (Dashboard).
DO $$ BEGIN
  CREATE TYPE monthly_update_status AS ENUM ('on_track','at_risk','off_track');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE team_member_type AS ENUM ('founder','full_time','part_time','advisor');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS monthly_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  achieved text NOT NULL,
  blocked text NOT NULL,
  focus_next text NOT NULL,
  status monthly_update_status NOT NULL DEFAULT 'on_track',
  support_needed text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  type team_member_type NOT NULL DEFAULT 'full_time',
  joined_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

-- KPIs move from monthly collection to five fixed program phases.
DO $$ BEGIN
  CREATE TYPE kpi_phase AS ENUM ('program_entry','during_program_1','during_program_2','graduation','post_program');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TABLE kpi_submissions ADD COLUMN IF NOT EXISTS phase kpi_phase;
UPDATE kpi_submissions SET phase = 'program_entry' WHERE phase IS NULL;
ALTER TABLE kpi_submissions ALTER COLUMN phase SET NOT NULL;
ALTER TABLE kpi_submissions DROP COLUMN IF EXISTS period_month;
ALTER TABLE kpi_submissions DROP COLUMN IF EXISTS period_year;

-- Contract & KYS admin review (approve/reject + audit trail), same lifecycle
-- as the Data Room documents table above.
DO $$ BEGIN
  CREATE TYPE contract_action AS ENUM ('signed','approved','rejected','commented');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE kys_action AS ENUM ('submitted','approved','rejected','commented');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS status document_status NOT NULL DEFAULT 'pending';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS reviewed_at timestamp;

ALTER TABLE kys_profiles ADD COLUMN IF NOT EXISTS status document_status NOT NULL DEFAULT 'pending';
ALTER TABLE kys_profiles ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE kys_profiles ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id);
ALTER TABLE kys_profiles ADD COLUMN IF NOT EXISTS reviewed_at timestamp;

CREATE TABLE IF NOT EXISTS contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  action contract_action NOT NULL,
  note text,
  actor_id uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kys_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kys_profile_id uuid NOT NULL REFERENCES kys_profiles(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  action kys_action NOT NULL,
  note text,
  actor_id uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

-- Several tables were first created by an earlier one-off run of this script,
-- before their foreign keys were added below — CREATE TABLE IF NOT EXISTS is a
-- no-op on a table that already exists, so those FKs never actually landed in
-- the database despite being declared in shared/schema.ts. Adding them now
-- (idempotently) so startup deletion actually cascades instead of leaving
-- orphaned rows behind forever.
DO $$ BEGIN
  ALTER TABLE goals ADD CONSTRAINT goals_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE kpi_submissions ADD CONSTRAINT kpi_submissions_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE documents ADD CONSTRAINT documents_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE document_events ADD CONSTRAINT document_events_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE document_events ADD CONSTRAINT document_events_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE mentorship_sessions ADD CONSTRAINT mentorship_sessions_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE office_hour_bookings ADD CONSTRAINT office_hour_bookings_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE office_hour_bookings ADD CONSTRAINT office_hour_bookings_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES office_hour_slots(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE training_progress ADD CONSTRAINT training_progress_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE training_progress ADD CONSTRAINT training_progress_training_id_fkey FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Dashboard overview: Startup Profile / Core Business / Core IP blocks.
DO $$ BEGIN
  CREATE TYPE legal_entity_status AS ENUM ('yes','in_process','no');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE business_model_type AS ENUM ('b2b','b2c','b2b2c');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS legal_entity_status legal_entity_status;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS business_model_type business_model_type;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS data_room_link text;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS core_business_overview text;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS core_ip_technology text;

-- Dashboard overview: Traction & previous funding / Round Details / Impact Metrics / Markets.
DO $$ BEGIN
  CREATE TYPE customer_base AS ENUM ('low','moderate','high','emerging_market','saturated_market');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS total_revenue_since_founding bigint;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS total_grants bigint;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS total_round_size bigint;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS round_terms text;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS last_valuation bigint;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS sdgs_addressed text[];
ALTER TABLE startups ADD COLUMN IF NOT EXISTS female_team_members integer;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS youth_employees integer;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS country_of_incorporation text;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS customer_base customer_base;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS countries_of_operation text;

-- Dashboard overview: Cap Table.
CREATE TABLE IF NOT EXISTS cap_table_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  name text NOT NULL,
  percentage real NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- KPI collection: deep-tech vs soft-tech track.
DO $$ BEGIN
  CREATE TYPE startup_tech_track AS ENUM ('deep_tech','soft_tech');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS tech_track startup_tech_track;

-- Mentorship (Modules + Sessions) — replaces the old 1:1 mentor-logging
-- model (mentorship_sessions, left in place below but no longer used by the
-- app). Renamed from an earlier "Training" naming mistake; not the Open
-- Startup School curriculum (trainings/training_progress above). This
-- one-time rename is long done in every real database (mentorship_modules
-- already exists), and is now guarded so it can never fire again — the
-- unguarded form used to collide with the unrelated "training_modules" /
-- "training_sessions" tables the separate Training feature (below) creates,
-- since it happens to reuse those same now-free legacy names.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'training_modules')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'mentorship_modules') THEN
    ALTER TABLE training_modules RENAME TO mentorship_modules;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'training_sessions')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'mentorship_module_sessions') THEN
    ALTER TABLE training_sessions RENAME TO mentorship_module_sessions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'training_session_status')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mentorship_module_session_status') THEN
    ALTER TYPE training_session_status RENAME TO mentorship_module_session_status;
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE mentorship_module_session_status AS ENUM ('upcoming','completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS mentorship_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  title text NOT NULL,
  description text,
  duration_label text,
  unlocked boolean NOT NULL DEFAULT false,
  unlocked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mentorship_module_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES mentorship_modules(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL,
  description text,
  scheduled_at timestamp NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 120,
  experts text,
  status mentorship_module_session_status NOT NULL DEFAULT 'upcoming',
  meeting_link text,
  presentation_url text,
  recording_url text,
  transcript_url text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Mentorship: per-(session, startup) recap and mentor feedback.
ALTER TABLE mentorship_module_sessions ADD COLUMN IF NOT EXISTS mentor_bio text;
CREATE TABLE IF NOT EXISTS mentorship_session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES mentorship_module_sessions(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  team_members_presence text,
  points_discussed text,
  what_is_going_well text,
  what_is_not_going_well text,
  action_items text,
  mentor_rating integer,
  mentor_feedback text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE mentorship_session_notes DROP COLUMN IF EXISTS homework_url;
ALTER TABLE mentorship_session_notes DROP COLUMN IF EXISTS homework_submission_file_url;
ALTER TABLE mentorship_session_notes DROP COLUMN IF EXISTS homework_submission_file_name;

-- Mentorship: homework is per-(module, startup), not per-session — one
-- assignment and one submission per module.
CREATE TABLE IF NOT EXISTS mentorship_module_homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES mentorship_modules(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  homework_url text,
  submission_file_url text,
  submission_file_name text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Mentors: a reusable directory, one assigned per startup.
CREATE TABLE IF NOT EXISTS mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  introduction text,
  picture_url text,
  email text,
  whatsapp text,
  linkedin_url text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE startups ADD COLUMN IF NOT EXISTS mentor_id uuid REFERENCES mentors(id) ON DELETE SET NULL;
ALTER TABLE startups ADD COLUMN IF NOT EXISTS data_room_updated_at timestamp;

-- Zoom recording sync: lets the webhook find the exact session a completed
-- recording belongs to.
ALTER TABLE mentorship_module_sessions ADD COLUMN IF NOT EXISTS zoom_meeting_id text;

-- Contract: switched from in-platform e-signing to "sign externally, upload
-- the signed PDF here." Old signature columns are relaxed (not dropped, so
-- existing signed contracts aren't destroyed) and new upload columns added.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS uploaded_at timestamp;
ALTER TABLE contracts ALTER COLUMN signer_name DROP NOT NULL;
ALTER TABLE contracts ALTER COLUMN signer_title DROP NOT NULL;
ALTER TABLE contracts ALTER COLUMN signature_method DROP NOT NULL;
ALTER TABLE contracts ALTER COLUMN signature_value DROP NOT NULL;
ALTER TYPE contract_action ADD VALUE IF NOT EXISTS 'uploaded';

-- Training (Modules + Sessions) — a duplicate of the Mentorship module
-- above, with its own trainer directory, under a separate "Training" nav
-- item. Not the Open Startup School curriculum (trainings/training_progress
-- above) — table names below use "training_module_*" to stay clear of that
-- older "trainings" table.
DO $$ BEGIN
  CREATE TYPE training_module_session_status AS ENUM ('upcoming','completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  title text NOT NULL,
  description text,
  duration_label text,
  unlocked boolean NOT NULL DEFAULT false,
  unlocked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS training_module_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL,
  description text,
  scheduled_at timestamp NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 120,
  experts text,
  trainer_bio text,
  status training_module_session_status NOT NULL DEFAULT 'upcoming',
  meeting_link text,
  presentation_url text,
  recording_url text,
  transcript_url text,
  zoom_meeting_id text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Training: per-(session, startup) recap and trainer feedback.
CREATE TABLE IF NOT EXISTS training_session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES training_module_sessions(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  team_members_presence text,
  points_discussed text,
  what_is_going_well text,
  what_is_not_going_well text,
  action_items text,
  trainer_rating integer,
  trainer_feedback text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Training: homework is per-(module, startup), not per-session.
CREATE TABLE IF NOT EXISTS training_module_homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  homework_url text,
  submission_file_url text,
  submission_file_name text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Trainers: a reusable directory, one assigned per startup (separate from Mentors).
CREATE TABLE IF NOT EXISTS trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  introduction text,
  picture_url text,
  email text,
  whatsapp text,
  linkedin_url text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE startups ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES trainers(id) ON DELETE SET NULL;

-- Mentorship: dropped the module-grouping/locking design in favor of a flat
-- session list. module_id is relaxed (not dropped, so existing sessions keep
-- their historical link) rather than removed, and mentorship_module_homework
-- had zero rows so it's dropped outright — homework is not part of Mentorship
-- anymore. The orphaned mentorship_modules table is left in place, same as
-- the older mentorship_sessions table before it.
ALTER TABLE mentorship_module_sessions ALTER COLUMN module_id DROP NOT NULL;
DROP TABLE IF EXISTS mentorship_module_homework;

-- "Other experts" catalog — a browse-only directory (no contact info),
-- imported once from an external sheet, shown on its own Mentorship tab.
-- Each startup can rate how much priority they place on an expert.
CREATE TABLE IF NOT EXISTS experts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bio text,
  industries text[],
  expertise_areas text[],
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS expert_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES experts(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  priority integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Mentorship sessions: a "Materials" link/button (slides, handouts, resources).
ALTER TABLE mentorship_module_sessions ADD COLUMN IF NOT EXISTS materials_url text;
`;

try {
  await client.connect();
  await client.query(sql);
  console.log("Database updated successfully. You can close this window.");
} catch (e) {
  console.error("Update failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
