# DATA_MODEL.md — everything the platform stores, and where the truth lives

> **Maintenance rule:** any commit that touches `shared/schema.ts` or `server/migrate.mjs` must update this file.
> **Never run `drizzle-kit push` against the production database.** The live DB holds legacy objects that exist only in `server/migrate.mjs` (e.g. `kpi_submissions`, which has real rows); `push` would propose dropping them. All schema changes go through idempotent statements appended to `server/migrate.mjs`, executed by `./deploy/deploy.sh`.

Sources of column-level detail: `shared/schema.ts` (the Drizzle model + zod validation) and `server/migrate.mjs` (the real DB, including legacy objects the model no longer declares). Line references drift; search by table name.

---

## 1. The ten-second orientation

- **One row per company in `startups`** (~90 columns), owned by a `users` row. A user may own up to 2 startups; `users.active_startup_id` picks the one in view.
- **Time-series numbers live in `startup_metric_entries`**: one row per startup per period (`"initial"` baseline or `"YYYY-MM"`), values in a jsonb keyed by `shared/metricsCatalog.ts`.
- **Repeatable facts live in child tables** (`team_members`, `cap_table_entries`, `startup_funding_rounds`, patents, target markets, competitors, client/partner stats+details, CRM entries, documents…), all `startup_id → startups` ON DELETE CASCADE.
- **Program state** hangs off users (`role`, `onboarding_status`) and startups (`kys_profiles.track`, contract/KYS review status, `graduated_at`, `declaration_signed_at`).
- Everything else is program machinery (sessions, notes, homework, office hours, school), messaging/audit ledgers, and OAuth for the Claude connector.

## 2. Domain map (49 tables)

### Identity & access
| Table | Purpose | Keys & notes |
|---|---|---|
| `users` | Every account (founder, admin, alumni…) | `role` enum (startup/mentor/investor/admin/alumni), `onboarding_status` (needs_role→needs_profile→pending_approval→complete), `active_startup_id` (uuid, deliberately no FK), email-verification + email-change token pairs, `auth_provider`/`google_id`, `is_active` |
| `session` | connect-pg-simple session store | `sid` PK, `sess` jsonb |

### Startup core
| Table | Purpose | Keys & notes |
|---|---|---|
| `startups` | The company row (see §3) | `user_id`→users CASCADE; `mentor_id`→experts SET NULL; `trainer_id`→trainers SET NULL |
| `team_members` | Team roster; rows with `type='founder'` are Card 4's founder list | founder-only columns: gender, backgrounds, years_of_experience, current_involvement |
| `cap_table_entries` | Card 5 shareholders | `percentage` real 0-100 (not forced to total 100) |
| `startup_funding_rounds` | Card 6, one row per round | amount, investor_name, funding_type, round, round_date (text), deal_terms |
| `startup_patents` | Card 9 IP filings | statuses/dates as text, catalog-validated |
| `startup_target_markets` | Card 11 GTM per market | market, status, per-market strategy_link |
| `startup_competitors` | Card 12 (replaces `startups.main_competitors`) | name, details |
| `startup_client_stats` / `startup_client_details` | Card 13 totals per client type / per-client rows | retention_rate real 0-100; deal_value bigint |
| `startup_partner_stats` / `startup_partner_details` | Card 14 equivalents | |

All Card child tables: CASCADE to startups, add/delete-only (no edit), `created_at` only.

### Onboarding & compliance
| Table | Purpose | Keys & notes |
|---|---|---|
| `kys_profiles` | One KYS per startup (UNIQUE), admin-reviewed | `track` (pre_seed/seed) filled by the Typeform webhook or an admin; Path A/B detail columns are **dormant** (the form moved to Typeform); status/review_note/reviewed_by |
| `kys_documents` | KYS uploads (cert of incorporation, IDs…) | linked to startup, not to the profile row |
| `contracts` | The uploaded signed program agreement, one per startup (UNIQUE) | status/review; DB also holds unmodeled e-sign-era columns (signer_name, signature_method…) |
| `kys_events` / `contract_events` / `document_events` | Append-only audit of submits & reviews | actor_id→users |

Also on `startups`: `declaration_signed_at` (Acrobat Sign step 1; the signed PDF lives in Adobe, or under `uploads/declarations/` when an admin files it).

### Metrics & reporting
| Table | Purpose | Keys & notes |
|---|---|---|
| `startup_metric_entries` | Monthly KPIs + `"initial"` baseline | UNIQUE(startup_id, period) exists in DB; `values` jsonb keyed by `metricsCatalog.ts` (5 sections: Sales, Revenues, HR, Partnerships, Fundraising) |
| `startup_metrics_profile` | One row per startup: 5 section notes + Section VI jsonbs | `data_room` checklist {inception,graduation}; `company_profile` field pairs |
| `startup_achievements` | Achievements log (shown on Initial Data + Metrics) | `achieved_at` superseded |
| `goals` | Quarterly goals (Home + admin) | status on_track/at_risk/off_track/done |
| `monthly_updates` | **Quarterly** narrative check-in (legacy name) | period_quarter is live; period_month legacy; feeds the connector's needs-attention tool |

### Program (mentorship / training / office hours / school)
| Table | Purpose | Keys & notes |
|---|---|---|
| `experts` | "Other experts" catalog; also the mentor directory (`startups.mentor_id`) | no contact info by design |
| `expert_priorities` | A startup's 1-5 rating of an expert | one-per-pair is app-enforced only |
| `expert_catalog_settings` | Singleton visibility switch | `visible_startup_ids` uuid[] (no FK) |
| `trainers` | Trainer directory (photo, contacts) | `expert_id`→experts SET NULL |
| `mentorship_module_sessions` | 1:1 sessions owned by one startup ("module" in the name is historical) | zoom_meeting_id/host, transcript/recording URLs, calendar_sequence, visibility_track + explicit share list |
| `mentorship_session_startups` | Extra startups who can see a session | |
| `mentorship_session_notes` | Per (session, startup): AI recap fields, founder_comments, mentor rating/feedback | legacy points_discussed group superseded |
| `training_modules` / `training_module_startups` | Cohort modules (track or explicit list) | `unlocked` admin toggle |
| `training_module_sessions` / `training_session_startups` | Sessions inside a module, cohort-wide | same Zoom/calendar columns |
| `training_session_notes` | Per (session, startup): legacy 5 fields + AI recap fields + trainer rating | AI fields written by the connector for every visible startup |
| `training_module_homework` | Per (module, startup): assignment URL + submission | |
| `office_hour_slots` / `office_hour_bookings` | Bookable slots; bookings per startup | host_name is free text; `recap` never written |
| `trainings` / `training_progress` | Open Startup School curriculum + progress | founder side currently has no live UI |

### CRM
| Table | Purpose | Keys & notes |
|---|---|---|
| `startup_crm_entries` | Investors/Clients/Partners tracker (3 tabs via `category`) | everything else free text, catalogs in `shared/crmCatalog.ts` |

### Data room & documents
| Table | Purpose | Keys & notes |
|---|---|---|
| `documents` | Uploaded data-room files with review lifecycle | `checklist_key` slug ties to a checklist item |
| `data_room_shares` | Expiring public share links over chosen documents | `document_ids` uuid[] (no FK — deleting a doc leaves a dangling id) |

Plus on `startups`: `data_room_link` (external folder) and `data_room_updated_at` (manual flag).

### Investment applications (alumni)
| Table | Purpose | Keys & notes |
|---|---|---|
| `investment_applications` | Repeatable applications: draft→submitted→under_review→accepted/rejected | `answers` jsonb (amountSought, roundType, useOfFunds, tractionNarrative, timeline); `snapshot` jsonb frozen at submit (headline numbers + readiness report) |

### Messaging & audit
| Table | Purpose | Keys & notes |
|---|---|---|
| `message_log` | Every non-transactional email (broadcasts, review/investment decisions, reminders, connector sends) | `sent_by` = admin email \| `system` \| `mcp:<email>`; `meta.period`+`meta.trigger` = the reminder scheduler's idempotency ledger; startup_id SET NULL |
| `mcp_audit_log` | Every Claude-connector tool call (ok or failed) | user kept as text so rows outlive accounts |

### Integrations & OAuth
| Table | Purpose | Keys & notes |
|---|---|---|
| `mcp_oauth_clients` / `mcp_oauth_tokens` | The connector's OAuth (dynamic registration; hashed, scoped tokens) | scope space-separated; old tokens keep old scopes until reconnect |

Integration columns elsewhere: Zoom (`zoom_meeting_id`, `zoom_host_email`, recording/transcript URLs on both session tables), iCal (`calendar_sequence`), Typeform (`kys_profiles.track`), Adobe Sign (`startups.declaration_signed_at`), Google login (`users.google_id`).

## 3. The `startups` mega-table, group by group

| Group | Columns (essentials) |
|---|---|
| Keys | id; user_id; mentor_id; trainer_id (stale — see §4.7) |
| Basics | company_name; website; logo_url |
| Survey: about | short_description (300); location (HQ country — canonical); markets[] (sector tags, not geographies); stage (idea→scale) |
| Survey: money (no longer collected; legacy) | revenue_last_month; revenue_last_12_months; is_raising; amount_raised; investors_equity_holders; runway_months; is_profitable |
| Survey: detail/media | detailed_description; differentiator; is_incorporated; started_month/year; product/team video URLs + private flags; deck_url |
| Survey: customers | customer_types[]; interaction_platforms[]; customer_type (deprecated enum) |
| Card 1 Profile | legal_entity_status; country; business_model_types[] (+ superseded business_model_type); data_room_link; data_room_updated_at; deck_url; started_year |
| Card 2/3 | core_business_overview; unique_value_proposition |
| Card 4 Team stats | team_size; contractors_count; paid_employees_count; advisors_count; female_team_members; youth_employees (label says %, stores a count — see §4.1) |
| Card 6 Funding | total_funding_raised/dilutive/non_dilutive; investment_stage; round_size; committed_funds; funding_crm_link |
| Card 7/8 Tech & product | core_ip_technology; main_technologies; product_type; product_stage; product_roadmap_link; trl_level |
| Card 10 Market | TAM/SAM/SOM (free text) |
| Card 11/12 | go_to_market_strategy_link; competition_overview; main_competitors (superseded) |
| Card 13/14 | ideal_customer_persona; clients_crm_link; partners_crm_link |
| Legacy traction | total_revenue_since_founding; total_grants; total_round_size; round_terms; last_valuation |
| Impact/geography ghosts | sdgs_addressed[]; country_of_incorporation; customer_base; countries_of_operation (no live writers) |
| Lifecycle | tech_track (dead); graduated_at (alumni); deletion_requested_at/reason; declaration_signed_at; created_at/updated_at |

## 4. Source-of-truth register (the 15 duplication clusters)

For each fact: **CANONICAL** store first, then the fallbacks in order, then the stores that should eventually stop being read.

**Implemented (Phase 3a):** `server/canonical.ts` resolves clusters 1–4 and cluster 9's HQ into `{value, source, asOf}` facts; readers go through `storage.canonicalFactsFor` — the Claude connector's `get_startup_profile` and `startup_metric_summary`, and the investment-application snapshot. **Phase 3b:** `rev_monthly_change` and `sales_ltv_cac` carry `derived: true` in `shared/metricsCatalog.ts` and are recomputed from their inputs at display time (charts).

1. **Team size / headcount** — CANONICAL: latest `hr_team_size` (+ other `hr_*`) metric → Card 4 `startups.team_size` → `count(team_members)`. `team_members` is in practice the founders list. Known mislabels: `youth_employees` (count stored, % shown), `hr_pct_youth` (a real %).
2. **Funding raised** — CANONICAL: Card 6 `total_funding_raised` → `sum(startup_funding_rounds.amount)` → survey `amount_raised` (legacy). Grants: `total_funding_non_dilutive` → latest `fund_grants` → `total_grants` (legacy). Valuation: latest `fund_valuation` → `last_valuation` (legacy). Round terms/size: funding_rounds rows are the detail; `round_terms`/`total_round_size` legacy.
3. **Revenue** — CANONICAL: latest `rev_cumulative` (cumulative) and `rev_mrr_b2b + rev_mrr_b2c` (MRR) → `total_revenue_since_founding` / `revenue_last_12_months` (legacy survey). B2C revenue also appears in two metric sections (`rev_*` canonical over `sales_*_revenue_*`).
4. **Stage & program track** — `kys_profiles.track` is THE program cohort (drives training visibility, messaging, filters); `startups.stage` is the maturity scale; `product_stage`/`trl_level` are product-specific scales; `investment_stage` duplicates the track and drives nothing (retire in Phase 4). Alumni-ness: `users.role='alumni'` (access) + `startups.graduated_at` (fact/date).
5. **Clients & partners** — CANONICAL: the CRM (`startup_crm_entries`) for relationships; monthly `sales_*`/`partner_*` metrics for counts over time. Card 13/14 stats are static copies (become derived displays in Phase 4). The 6 partner types are spelled 3 ways across catalogs (unify in Phase 4).
6. **Descriptions** — CANONICAL: `short_description` (one-liner) + Card 2 `core_business_overview` (long) + Card 3 `unique_value_proposition`. `detailed_description`/`differentiator` are survey-era with no live editor (readiness now accepts Card 2 — Phase 2c).
7. **People & identity** — Account: `users.name` is what's displayed; first/last are inputs (Google accounts may have only `name`). Founders exist as: owner (`startups.user_id`, canonical contact), `team_members` type=founder rows, cap-table names, dormant KYS signatory fields — matched only by name today. Mentors: `startups.mentor_id`→experts is canonical; session `experts` text is a copy. Trainers: derived from session names in founder views; `trainer_id` written by a route no UI calls (stale).
8. **Session recaps** — CANONICAL: the AI recap fields (same 6 names on both notes tables; on training, `mentor_comments` holds the trainer's comments). Legacy `points_discussed`/`what_is_going_well`/`what_is_not_going_well`(+`action_items`) are superseded on mentorship and being retired from training (Phase 4.7). One quirk: a cohort training recap is copied into every visible startup's row by design.
9. **Geography & incorporation** — CANONICAL HQ: `location`. Card 1 `country` secondary; `country_of_incorporation`, `users.country`, KYS address fields, Section VI `legal_domicile` are ghosts/dormant. Incorporation: `legal_entity_status` canonical; `is_incorporated`, KYS `incorporated`, Section VI `legal_incorporated` secondary/dormant.
10. **Data room** — CANONICAL: `data_room_link` (+ `documents` rows where uploads are used). Checklist: `metricsCatalog.DATA_ROOM_ITEMS` (the client `dataRoomChecklist.ts` file is unused and slated for deletion). Individual link columns (deck, roadmap, GTM, CRM links) intentionally stay per-card.
11. **Narrative/achievements** — `startup_achievements` (one table, two screens — fine); quarterly story in `monthly_updates`; goals in `goals`. Overlap is thematic, not duplicated storage.
12. **Competition** — CANONICAL: `startup_competitors` rows. `main_competitors` text superseded (still round-tripped; removed from payloads in Phase 4.6).
13. **Business model / customer type** — CANONICAL: `business_model_types[]` and `customer_types[]`. Deprecated: `business_model_type`, `customer_type` enums, `customer_base`.
14. **Declaration & "onboarding complete"** — Declaration signed = `declaration_signed_at` OR a KYS profile exists (pre-declaration-era accounts). "Onboarding complete" (client + reminders) = KYS submitted AND contract uploaded; `users.onboarding_status='complete'` means admin-approved signup — different things by design.
15. **Homework** — one row per (module, startup); the shared assignment URL is duplicated per startup (acceptable; noted).

## 5. Legacy register

**DB-only tables (not in schema.ts — do not drop, do not model):** `kpi_submissions` (old KPI snapshots, has rows), `mentorship_sessions` (old 1:1 log), possibly `mentorship_modules` (survives only if it had rows). DB-only enums: `mentorship_status`, `signature_method`, `kpi_phase`. Contracts' e-sign-era columns (signer_name, signature_method, signed_at…).

**Modeled but superseded/dormant:** `startups`: customer_type, business_model_type, main_competitors, tech_track, the survey money/detail fields, sdgs_addressed, country_of_incorporation, customer_base, the legacy traction group. `kys_profiles`: incorporated + all Path A/B fields. `mentorship_session_notes`: points_discussed group. `monthly_updates.period_month`. `startup_achievements.achieved_at`. `office_hour_bookings.recap`. `startups.trainer_id`.

**Dead code paths (candidates to delete or revive — decide in Phase 4.9):** founder School routes/page, KYS-document upload route, document/share routes without UI callers, `client/src/lib/dataRoomChecklist.ts`, `BUSINESS_MODEL_LABELS`/`CUSTOMER_BASE_LABELS`.

## 6. Integrity gaps (fixed in Phase 3c)

- **"One row per pair" enforced only in code** (no DB UNIQUE): mentorship/training session notes, training_module_homework, training_progress, expert_priorities, the three `*_startups` link tables, the expert_catalog_settings singleton.
- **`NO ACTION` FKs to `users`** block deleting a referenced (usually departed-admin) account: documents.uploaded_by, document/contract/kys `actor_id`, contracts/kys `reviewed_by`, data_room_shares.created_by, investment_applications.decided_by. → become SET NULL.
- **uuid[] without referential integrity:** data_room_shares.document_ids (danglers after doc deletion), expert_catalog_settings.visible_startup_ids.
- **In DB but not declared in schema.ts:** UNIQUE(startup_id, period) on metric entries; indexes on message_log, mcp_audit_log, investment_applications.

## 7. Migration hazards & conventions

- `server/migrate.mjs` is idempotent and runs as **one transaction** (a failure applies nothing — this saved us on 2026-09-26).
- **Dollar-quoting rule:** JS `String.replace(a, stringB)` collapses `$$`→`$` in the replacement. Edit scripts must use function replacers: `s.replace(a, () => b)`.
- The **mentorship reset** from the 89842d1 reorg is fenced behind `information_schema` (only runs while the old `module_id` column exists). Never unfence it.
- Two statements re-run every migration **by design** (benign): the `period_quarter` recompute from legacy `period_month`, and the legacy email-verified backfill for token-less users.
- `ALTER TYPE … ADD VALUE` appends at the end, so enum value ORDER differs between old and fresh databases (`onboarding_status`, `contract_action`, `user_role`) — never sort by enum order.
- Deploy flow: schema-file commits block auto-deploy; batch them; each batch = one manual `./deploy/deploy.sh`.
