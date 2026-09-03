import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import multer from "multer";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { storage, toPublicUser } from "./storage";
import { requireAuth } from "./auth";
import {
  registerSchema,
  loginSchema,
  selectRoleSchema,
  startupBasicsSchema,
  startupSurveySchema,
  updateAccountSchema,
  changePasswordSchema,
  requestDeletionSchema,
  changeEmailSchema,
  goalSchema,
  kpiSubmissionSchema,
  documentUploadSchema,
  documentReviewSchema,
  officeHourBookingSchema,
  trainingProgressSchema,
  trainingSchema,
  mentorshipModuleSessionSchema,
  mentorshipSessionRecapSchema,
  mentorshipMentorFeedbackSchema,
  mentorSchema,
  assignMentorSchema,
  trainingModuleSchema,
  trainingModuleSessionSchema,
  trainingSessionRecapSchema,
  trainingTrainerFeedbackSchema,
  trainingModuleHomeworkSchema,
  trainerSchema,
  assignTrainerSchema,
  expertSchema,
  expertPrioritySchema,
  kysSubmitSchema,
  kysDocumentUploadSchema,
  monthlyUpdateSchema,
  teamMemberSchema,
  dataRoomShareSchema,
  startupProfileOverviewSchema,
  dataRoomSubmissionSchema,
  capTableEntrySchema,
  startupTechTrackSchema,
} from "@shared/schema";
import {
  sendVerificationEmail,
  smtpConfigured,
  sendEmailChangeVerification,
  sendPasswordChangedNotice,
} from "./mailer";
import {
  parseZoomMeetingId,
  verifyZoomWebhookSignature,
  respondToZoomUrlValidation,
  downloadZoomRecordingFile,
} from "./zoom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGOS_DIR = path.resolve(__dirname, "..", "uploads", "logos");
fs.mkdirSync(LOGOS_DIR, { recursive: true });

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, LOGOS_DIR),
    // Always overwrite — same name means re-upload replaces the old file cleanly.
    filename: (req, _file, cb) => cb(null, `${req.params.id as string}.jpg`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files are allowed") as any, false),
}).single("logo");

const DECKS_DIR = path.resolve(__dirname, "..", "uploads", "decks");
fs.mkdirSync(DECKS_DIR, { recursive: true });

const deckUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DECKS_DIR),
    filename: (req, _file, cb) => cb(null, `${req.params.id as string}.pdf`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
  fileFilter: (_req, file, cb) =>
    file.mimetype === "application/pdf"
      ? cb(null, true)
      : cb(new Error("Only PDF files are allowed") as any, false),
}).single("deck");

const AVATARS_DIR = path.resolve(__dirname, "..", "uploads", "avatars");
fs.mkdirSync(AVATARS_DIR, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
    filename: (req, _file, cb) => cb(null, `${req.session.userId as string}.jpg`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files are allowed") as any, false),
}).single("avatar");

const MENTOR_PICTURES_DIR = path.resolve(__dirname, "..", "uploads", "mentors");
fs.mkdirSync(MENTOR_PICTURES_DIR, { recursive: true });

const mentorPictureUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, MENTOR_PICTURES_DIR),
    filename: (req, _file, cb) => cb(null, `${req.params.id as string}-${Date.now()}.jpg`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files are allowed") as any, false),
}).single("picture");

const TRAINER_PICTURES_DIR = path.resolve(__dirname, "..", "uploads", "trainers");
fs.mkdirSync(TRAINER_PICTURES_DIR, { recursive: true });

const trainerPictureUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TRAINER_PICTURES_DIR),
    filename: (req, _file, cb) => cb(null, `${req.params.id as string}-${Date.now()}.jpg`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files are allowed") as any, false),
}).single("picture");

const DOCS_DIR = path.resolve(__dirname, "..", "uploads", "documents");
fs.mkdirSync(DOCS_DIR, { recursive: true });

const ALLOWED_DOC_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
]);

const documentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DOCS_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safe}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) =>
    ALLOWED_DOC_TYPES.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error("File type not allowed") as any, false),
}).single("file");

const HOMEWORK_DIR = path.resolve(__dirname, "..", "uploads", "homework");
fs.mkdirSync(HOMEWORK_DIR, { recursive: true });

const homeworkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, HOMEWORK_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safe}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) =>
    ALLOWED_DOC_TYPES.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error("File type not allowed") as any, false),
}).single("file");

const CONTRACTS_DIR = path.resolve(__dirname, "..", "uploads", "contracts");
fs.mkdirSync(CONTRACTS_DIR, { recursive: true });

const contractUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CONTRACTS_DIR),
    filename: (req, _file, cb) => cb(null, `${req.session.userId as string}-${Date.now()}.pdf`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype === "application/pdf"
      ? cb(null, true)
      : cb(new Error("Only PDF files are allowed") as any, false),
}).single("file");

const KYS_DIR = path.resolve(__dirname, "..", "uploads", "kys");
fs.mkdirSync(KYS_DIR, { recursive: true });

const kysDocUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, KYS_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safe}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) =>
    ALLOWED_DOC_TYPES.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error("File type not allowed") as any, false),
}).single("file");

const APP_URL = process.env.APP_URL || "http://localhost:5000";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Auto-promote configured emails to admin on login / session check.
async function ensureAdmin(user: any) {
  if (ADMIN_EMAILS.includes(user.email) && user.role !== "admin") {
    return await storage.promoteToAdmin(user.id);
  }
  return user;
}

// Gate admin-only routes.
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const u = await storage.getUserById(req.session.userId);
  if (!u || u.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || "";
const captchaEnabled = !!(process.env.RECAPTCHA_SITE_KEY && RECAPTCHA_SECRET);

// Blunt brute-force protection: 10 attempts per IP per 15 minutes. Counts
// every request (not just failures) so it can't be bypassed by spacing out
// only-failed attempts, and responds with a plain-text-friendly JSON body.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please wait a few minutes and try again." },
});

// The share token is the only secret protecting a public Data Room link — it's
// long and random enough that guessing is infeasible, but this caps automated
// scanning attempts as a second layer.
const shareViewRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again shortly." },
});

// Verify a reCAPTCHA token with Google. If captcha isn't configured, allow.
async function verifyCaptcha(token: string | undefined): Promise<boolean> {
  if (!captchaEnabled) return true;
  if (!token) return false;
  try {
    const params = new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token });
    const r = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data: any = await r.json();
    return !!data.success;
  } catch (e) {
    console.error("[captcha] verify failed", e);
    return false;
  }
}

// Generate a fresh verification token and email (or log) the link.
async function issueVerification(user: { id: string; email: string; name: string }) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await storage.setVerificationToken(user.id, token, expires);
  const link = `${APP_URL}/api/auth/verify?token=${token}`;
  await sendVerificationEmail(user.email, user.name, link);
}

// Wrap an async handler so any thrown/rejected error is forwarded to the
// error middleware instead of taking the whole process down.
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;
const ah =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Resolve the signed-in user's active startup, or send a 400/401 and return
// undefined. Every module route (goals, KPIs, data room, etc.) is scoped to
// this startup.
async function requireActiveStartup(req: Request, res: Response) {
  const user = await storage.getUserById(req.session.userId!);
  if (!user) {
    res.status(401).json({ message: "Not authenticated" });
    return undefined;
  }
  const startup = await storage.resolveActiveStartup(user);
  if (!startup) {
    res.status(400).json({ message: "Create a startup first" });
    return undefined;
  }
  return startup;
}

// Gate a :id-scoped route on the caller owning that startup, BEFORE any
// upload middleware runs — file uploads must never write to disk ahead of
// the ownership check, or a non-owner could overwrite another startup's file.
async function requireOwnedStartupParam(req: Request, res: Response, next: NextFunction) {
  try {
    const owned = await storage.getOwnedStartup(req.params.id as string, req.session.userId!);
    if (!owned) return res.status(404).json({ message: "Not found" });
    res.locals.startup = owned;
    next();
  } catch (e) {
    next(e);
  }
}

// Map validated survey input onto startup columns.
function surveyToColumns(d: any) {
  return {
    companyName: d.companyName,
    shortDescription: d.shortDescription,
    location: d.location,
    markets: d.markets ?? [],
    stage: d.stage,
    revenueLastMonth: d.revenueLastMonth ?? null,
    revenueLast12Months: d.revenueLast12Months ?? null,
    detailedDescription: d.detailedDescription,
    differentiator: d.differentiator,
    isIncorporated: d.isIncorporated ?? null,
    startedMonth: d.startedMonth ?? null,
    startedYear: d.startedYear ?? null,
    website: d.website || null,
    links: d.links ?? {},
    productVideoUrl: d.productVideoUrl || null,
    productVideoPrivate: d.productVideoPrivate ?? false,
    teamVideoUrl: d.teamVideoUrl || null,
    teamVideoPrivate: d.teamVideoPrivate ?? false,
    deckUrl: d.deckUrl || null,
    isRaising: d.isRaising ?? null,
    amountRaised: d.amountRaised ?? null,
    investorsEquityHolders: d.investorsEquityHolders || null,
    runwayMonths: d.runwayMonths ?? null,
    isProfitable: d.isProfitable ?? false,
    customerTypes: d.customerTypes ?? [],
    interactionPlatforms: d.interactionPlatforms ?? [],
  };
}

export function registerRoutes(app: Express) {
  /* ---------------- Email / password auth ---------------- */
  app.post("/api/auth/register", ah(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const { firstName, lastName, age, country, email, password } = parsed.data;
    const captchaOk = await verifyCaptcha((req.body as any).captchaToken);
    if (!captchaOk) {
      return res
        .status(400)
        .json({ message: "Captcha check failed. Please tick the box and try again." });
    }
    const existing = await storage.getUserByEmail(email);
    if (existing) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }
    const hash = await bcrypt.hash(password, 12);
    const user = await storage.createUser({
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      age,
      country,
      email,
      password: hash,
      authProvider: "local",
      emailVerified: false,
    });
    await issueVerification(user);
    req.session.userId = user.id;
    res.status(201).json(toPublicUser(user));
  }));

  app.post("/api/auth/login", loginRateLimiter, ah(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const { email, password } = parsed.data;
    const user = await storage.getUserByEmail(email);
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "This account is disabled" });
    }
    req.session.userId = user.id;
    await storage.touchLogin(user.id);
    const promoted = await ensureAdmin(user);
    res.json(toPublicUser(promoted));
  }));

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", ah(async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Not authenticated" });
    }
    const promoted = await ensureAdmin(user);
    res.json(toPublicUser(promoted));
  }));

  /* ---------------- Public config + email verification ---------------- */
  app.get("/api/config", (_req, res) => {
    res.json({ recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || null });
  });

  // Clicked from the verification email (no auth required).
  app.get("/api/auth/verify", ah(async (req, res) => {
    const token = String(req.query.token || "");
    if (!token) return res.redirect(`${APP_URL}/login?verify=invalid`);
    const user = await storage.getUserByVerificationToken(token);
    if (
      !user ||
      !user.verificationExpiresAt ||
      new Date(user.verificationExpiresAt) < new Date()
    ) {
      return res.redirect(`${APP_URL}/login?verify=expired`);
    }
    await storage.markEmailVerified(user.id);
    if (req.session.userId === user.id) {
      return res.redirect(`${APP_URL}/?verified=1`);
    }
    return res.redirect(`${APP_URL}/login?verified=1`);
  }));

  app.post("/api/auth/resend-verification", requireAuth, ah(async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
    await issueVerification(user);
    res.json({ ok: true, emailSent: smtpConfigured });
  }));

  /* ---------------- Google OAuth ---------------- */
  const googleEnabled = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  app.get("/api/auth/google", (req, res, next) => {
    if (!googleEnabled) {
      return res
        .status(503)
        .json({ message: "Google login is not configured yet" });
    }
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false,
    })(req, res, next);
  });

  app.get(
    "/api/auth/google/callback",
    (req, res, next) => {
      if (!googleEnabled) {
        return res.redirect(`${APP_URL}/login?error=google_unconfigured`);
      }
      passport.authenticate("google", {
        session: false,
        failureRedirect: `${APP_URL}/login?error=google_failed`,
      })(req, res, next);
    },
    ah(async (req, res) => {
      const user = req.user as { id: string } | undefined;
      if (!user) return res.redirect(`${APP_URL}/login?error=google_failed`);
      req.session.userId = user.id;
      await storage.touchLogin(user.id);
      res.redirect(`${APP_URL}/`);
    }),
  );

  /* ---------------- Account management ---------------- */
  app.patch("/api/account", requireAuth, ah(async (req, res) => {
    const parsed = updateAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const { firstName, lastName, age, country } = parsed.data;
    const current = await storage.getUserById(req.session.userId!);
    const name =
      firstName !== undefined || lastName !== undefined
        ? `${firstName ?? current?.firstName ?? ""} ${lastName ?? current?.lastName ?? ""}`.trim()
        : undefined;
    const user = await storage.updateAccount(req.session.userId!, {
      firstName,
      lastName,
      age,
      country,
      name,
    });
    res.json(toPublicUser(user));
  }));

  // Request an email change -> sends a confirmation link to the NEW address.
  app.post("/api/account/email", requireAuth, ah(async (req, res) => {
    const parsed = changeEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const newEmail = parsed.data.newEmail.toLowerCase();
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    if (newEmail === user.email) {
      return res.status(400).json({ message: "That is already your email" });
    }
    const other = await storage.getUserByEmail(newEmail);
    if (other) {
      return res.status(409).json({ message: "That email is already in use" });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await storage.setEmailChange(user.id, newEmail, token, expires);
    const link = `${APP_URL}/api/auth/verify-email-change?token=${token}`;
    const sent = await sendEmailChangeVerification(newEmail, user.name, link);
    res.json({ ok: true, emailSent: sent, pendingEmail: newEmail });
  }));

  // Clicked from the email-change confirmation email.
  app.get("/api/auth/verify-email-change", ah(async (req, res) => {
    const token = String(req.query.token || "");
    if (!token) return res.redirect(`${APP_URL}/account?emailChange=invalid`);
    const user = await storage.getUserByEmailChangeToken(token);
    if (
      !user ||
      !user.pendingEmail ||
      !user.emailChangeExpiresAt ||
      new Date(user.emailChangeExpiresAt) < new Date()
    ) {
      return res.redirect(`${APP_URL}/account?emailChange=expired`);
    }
    const other = await storage.getUserByEmail(user.pendingEmail);
    if (other && other.id !== user.id) {
      return res.redirect(`${APP_URL}/account?emailChange=taken`);
    }
    await storage.applyEmailChange(user.id, user.pendingEmail);
    return res.redirect(`${APP_URL}/account?emailChange=done`);
  }));

  app.post("/api/account/password", requireAuth, ah(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    if (user.password) {
      const ok = await bcrypt.compare(parsed.data.currentPassword || "", user.password);
      if (!ok) {
        return res.status(403).json({ message: "Your current password is incorrect" });
      }
    }
    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await storage.updatePassword(user.id, hash);
    await sendPasswordChangedNotice(user.email, user.name).catch(() => {});
    res.json({ ok: true });
  }));

  // Profile photo upload (image only).
  app.post("/api/account/avatar", requireAuth, (req, res, next) => {
    avatarUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const url = `/uploads/avatars/${req.session.userId as string}.jpg?v=${Date.now()}`;
        const user = await storage.updateAvatar(req.session.userId!, url);
        res.json({ avatarUrl: url, user: toPublicUser(user) });
      } catch (e) {
        next(e);
      }
    });
  });

  /* ---------------- Role selection ---------------- */
  app.post("/api/onboarding/role", requireAuth, ah(async (req, res) => {
    const parsed = selectRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    if (parsed.data.role !== "startup") {
      return res.status(403).json({
        message: "That role isn't available yet. Please choose Startup.",
      });
    }
    const user = await storage.setUserRole(req.session.userId!, "startup");
    res.json(toPublicUser(user));
  }));

  /* ---------------- Onboarding: first startup ---------------- */
  app.post("/api/startup/basics", requireAuth, ah(async (req, res) => {
    const parsed = startupBasicsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const user = await storage.getUserById(req.session.userId!);
    if (user?.role !== "startup") {
      return res.status(403).json({ message: "Startup role required" });
    }
    const startup = await storage.createStartup(req.session.userId!, {
      companyName: parsed.data.companyName,
      website: parsed.data.website || null,
    });
    await storage.setActiveStartup(req.session.userId!, startup.id);
    res.status(201).json(startup);
  }));

  app.post("/api/startup/survey", requireAuth, ah(async (req, res) => {
    const parsed = startupSurveySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.errors[0].message,
        errors: parsed.error.flatten(),
      });
    }
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    const active = await storage.resolveActiveStartup(user);
    if (!active) return res.status(400).json({ message: "Create a startup first" });
    const startup = await storage.updateStartup(active.id, surveyToColumns(parsed.data));
    await storage.markOnboardingComplete(user.id);
    res.json(startup);
  }));

  /* ---------------- Startups (multi) ---------------- */
  app.get("/api/startup/me", requireAuth, ah(async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    const active = await storage.resolveActiveStartup(user);
    if (!active) return res.status(404).json({ message: "No startup yet" });
    res.json(active);
  }));

  app.get("/api/startups", requireAuth, ah(async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    const list = await storage.getStartupsByUserId(user.id);
    res.json({ startups: list, activeStartupId: user.activeStartupId });
  }));

  app.post("/api/startups", requireAuth, ah(async (req, res) => {
    const parsed = startupBasicsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const existing = await storage.getStartupsByUserId(req.session.userId!);
    if (existing.length >= 2) {
      return res.status(403).json({ message: "You can have at most 2 startups per account." });
    }
    const startup = await storage.createStartup(req.session.userId!, {
      companyName: parsed.data.companyName,
      website: parsed.data.website || null,
    });
    await storage.setActiveStartup(req.session.userId!, startup.id);
    res.status(201).json(startup);
  }));

  app.get("/api/startups/:id", requireAuth, ah(async (req, res) => {
    const startup = await storage.getOwnedStartup(req.params.id as string, req.session.userId!);
    if (!startup) return res.status(404).json({ message: "Not found" });
    res.json(startup);
  }));

  app.patch("/api/startups/:id", requireAuth, ah(async (req, res) => {
    const owned = await storage.getOwnedStartup(req.params.id as string, req.session.userId!);
    if (!owned) return res.status(404).json({ message: "Not found" });
    const parsed = startupSurveySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.errors[0].message,
        errors: parsed.error.flatten(),
      });
    }
    const startup = await storage.updateStartup(owned.id, surveyToColumns(parsed.data));
    res.json(startup);
  }));

  // Dashboard overview: Startup Profile / Core Business / Core IP blocks.
  app.patch("/api/startups/:id/profile-overview", requireAuth, ah(async (req, res) => {
    const owned = await storage.getOwnedStartup(req.params.id as string, req.session.userId!);
    if (!owned) return res.status(404).json({ message: "Not found" });
    const parsed = startupProfileOverviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const startup = await storage.updateStartup(owned.id, {
      legalEntityStatus: d.legalEntityStatus || null,
      startedYear: d.startedYear ?? null,
      country: d.country || null,
      businessModelType: d.businessModelType || null,
      dataRoomLink: d.dataRoomLink || null,
      coreBusinessOverview: d.coreBusinessOverview || null,
      coreIpTechnology: d.coreIpTechnology || null,
      totalRevenueSinceFounding: d.totalRevenueSinceFounding ?? null,
      amountRaised: d.amountRaised ?? null,
      totalGrants: d.totalGrants ?? null,
      totalRoundSize: d.totalRoundSize ?? null,
      roundTerms: d.roundTerms || null,
      lastValuation: d.lastValuation ?? null,
      sdgsAddressed: d.sdgsAddressed ?? [],
      femaleTeamMembers: d.femaleTeamMembers ?? null,
      youthEmployees: d.youthEmployees ?? null,
      countryOfIncorporation: d.countryOfIncorporation || null,
      customerBase: d.customerBase || null,
      countriesOfOperation: d.countriesOfOperation || null,
    });
    res.json(startup);
  }));

  // KPI collection: pick (or change) the deep-tech / soft-tech question track.
  app.patch("/api/startups/:id/tech-track", requireAuth, ah(async (req, res) => {
    const owned = await storage.getOwnedStartup(req.params.id as string, req.session.userId!);
    if (!owned) return res.status(404).json({ message: "Not found" });
    const parsed = startupTechTrackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const startup = await storage.updateStartup(owned.id, { techTrack: parsed.data.techTrack });
    res.json(startup);
  }));

  app.post("/api/startups/:id/activate", requireAuth, ah(async (req, res) => {
    const owned = await storage.getOwnedStartup(req.params.id as string, req.session.userId!);
    if (!owned) return res.status(404).json({ message: "Not found" });
    await storage.setActiveStartup(req.session.userId!, owned.id);
    res.json({ ok: true, activeStartupId: owned.id });
  }));

  app.post("/api/startups/:id/request-deletion", requireAuth, ah(async (req, res) => {
    const owned = await storage.getOwnedStartup(req.params.id as string, req.session.userId!);
    if (!owned) return res.status(404).json({ message: "Not found" });
    const parsed = requestDeletionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const startup = await storage.requestStartupDeletion(owned.id, parsed.data.reason || null);
    res.json(startup);
  }));

  // Cancel a pending deletion request (reverts it).
  app.post("/api/startups/:id/cancel-deletion", requireAuth, ah(async (req, res) => {
    const owned = await storage.getOwnedStartup(req.params.id, req.session.userId!);
    if (!owned) return res.status(404).json({ message: "Not found" });
    const startup = await storage.cancelStartupDeletion(owned.id);
    res.json(startup);
  }));

  /* ---------------- Logo upload ---------------- */
  app.post("/api/startups/:id/logo", requireAuth, requireOwnedStartupParam, (req, res, next) => {
    logoUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const version = Date.now();
        const logoUrl = `/uploads/logos/${req.params.id as string}.jpg?v=${version}`;
        await storage.updateStartup(res.locals.startup.id, { logoUrl });
        res.json({ logoUrl });
      } catch (e) {
        next(e);
      }
    });
  });

  // PDF-only pitch-deck upload.
  app.post("/api/startups/:id/deck", requireAuth, requireOwnedStartupParam, (req, res, next) => {
    deckUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const version = Date.now();
        const deckUrl = `/uploads/decks/${req.params.id as string}.pdf?v=${version}`;
        await storage.updateStartup(res.locals.startup.id, { deckUrl });
        res.json({ deckUrl });
      } catch (e) {
        next(e);
      }
    });
  });

  /* ---------------- Goals (Dashboard) ---------------- */
  app.get("/api/goals", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    res.json({ goals: await storage.listGoals(startup.id) });
  }));

  app.post("/api/goals", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = goalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const goal = await storage.createGoal(startup.id, {
      title: parsed.data.title,
      description: parsed.data.description || null,
      targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
      status: parsed.data.status,
    });
    res.status(201).json(goal);
  }));

  app.patch("/api/goals/:id", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const owned = await storage.getOwnedGoal(req.params.id, startup.id);
    if (!owned) return res.status(404).json({ message: "Not found" });
    const parsed = goalSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const goal = await storage.updateGoal(owned.id, {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}),
      ...(parsed.data.targetDate !== undefined
        ? { targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null }
        : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    });
    res.json(goal);
  }));

  app.delete("/api/goals/:id", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const owned = await storage.getOwnedGoal(req.params.id, startup.id);
    if (!owned) return res.status(404).json({ message: "Not found" });
    await storage.deleteGoal(owned.id);
    res.json({ ok: true });
  }));

  /* ---------------- KPIs (Dashboard / KPI Visualizations) ---------------- */
  app.get("/api/kpis", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    res.json({ submissions: await storage.listKpiSubmissions(startup.id) });
  }));

  app.post("/api/kpis", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = kpiSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const submission = await storage.upsertKpiSubmission(startup.id, {
      ...parsed.data,
      notes: parsed.data.notes || null,
    });
    res.status(201).json(submission);
  }));

  app.delete("/api/kpis/:id", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const owned = await storage.getOwnedKpiSubmission(req.params.id, startup.id);
    if (!owned) return res.status(404).json({ message: "Not found" });
    await storage.deleteKpiSubmission(owned.id);
    res.json({ ok: true });
  }));

  /* ---------------- Data Room ---------------- */
  // For now: the startup just points at wherever their data room already
  // lives, instead of uploading documents through the platform.
  app.get("/api/data-room", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    res.json({ dataRoomLink: startup.dataRoomLink ?? null, dataRoomUpdatedAt: startup.dataRoomUpdatedAt ?? null });
  }));

  app.patch("/api/data-room", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = dataRoomSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const updated = await storage.updateStartup(startup.id, { dataRoomLink: parsed.data.dataRoomLink || null });
    res.json({ dataRoomLink: updated.dataRoomLink ?? null, dataRoomUpdatedAt: updated.dataRoomUpdatedAt ?? null });
  }));

  // Manual signal only — we can't see inside an external data room, so the
  // founder tells us when they've changed something in it.
  app.post("/api/data-room/mark-updated", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const updated = await storage.updateStartup(startup.id, { dataRoomUpdatedAt: new Date() });
    res.json({ dataRoomUpdatedAt: updated.dataRoomUpdatedAt ?? null });
  }));

  app.get("/api/documents", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    res.json({ documents: await storage.listDocuments(startup.id) });
  }));

  app.post("/api/documents", requireAuth, (req, res, next) => {
    documentUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        const startup = await requireActiveStartup(req, res);
        if (!startup) return;
        const parsed = documentUploadSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.errors[0].message });
        }
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const fileUrl = `/uploads/documents/${req.file.filename}`;
        const doc = await storage.createDocument(startup.id, {
          category: parsed.data.category,
          checklistKey: parsed.data.checklistKey || null,
          title: parsed.data.title,
          fileUrl,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          uploadedBy: req.session.userId!,
        });
        await storage.addDocumentEvent({
          documentId: doc.id,
          startupId: startup.id,
          action: "uploaded",
          actorId: req.session.userId!,
        });
        res.status(201).json(doc);
      } catch (e) {
        next(e);
      }
    });
  });

  app.post("/api/documents/:id/replace", requireAuth, (req, res, next) => {
    documentUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        const startup = await requireActiveStartup(req, res);
        if (!startup) return;
        const owned = await storage.getOwnedDocument(req.params.id, startup.id);
        if (!owned) return res.status(404).json({ message: "Not found" });
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const fileUrl = `/uploads/documents/${req.file.filename}`;
        const doc = await storage.replaceDocumentFile(owned.id, {
          fileUrl,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
        });
        await storage.addDocumentEvent({
          documentId: doc.id,
          startupId: startup.id,
          action: "replaced",
          actorId: req.session.userId!,
        });
        res.json(doc);
      } catch (e) {
        next(e);
      }
    });
  });

  app.get("/api/documents/:id/events", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const owned = await storage.getOwnedDocument(req.params.id, startup.id);
    if (!owned) return res.status(404).json({ message: "Not found" });
    res.json({ events: await storage.listDocumentEvents(owned.id) });
  }));

  /* ---------------- Data Room external sharing ---------------- */
  app.get("/api/data-room-shares", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    res.json({ shares: await storage.listDataRoomShares(startup.id) });
  }));

  app.post("/api/data-room-shares", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = dataRoomShareSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    // Every chosen document must actually belong to this startup — otherwise a
    // crafted request could hand out a link to someone else's files.
    const owned = await storage.listDocuments(startup.id);
    const ownedIds = new Set(owned.map((d) => d.id));
    if (!parsed.data.documentIds.every((id) => ownedIds.has(id))) {
      return res.status(400).json({ message: "One or more selected documents were not found" });
    }
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000);
    const share = await storage.createDataRoomShare({
      startupId: startup.id,
      token,
      title: parsed.data.title || null,
      documentIds: parsed.data.documentIds,
      expiresAt,
      createdBy: req.session.userId!,
    });
    res.status(201).json(share);
  }));

  app.post("/api/data-room-shares/:id/revoke", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const owned = await storage.getOwnedDataRoomShare(req.params.id, startup.id);
    if (!owned) return res.status(404).json({ message: "Not found" });
    const share = await storage.revokeDataRoomShare(owned.id);
    res.json(share);
  }));

  // Public, unauthenticated: anyone with the token can view (not modify) the
  // documents the founder chose, as long as the link hasn't expired or been revoked.
  app.get("/api/public/data-room-share/:token", shareViewRateLimiter, ah(async (req, res) => {
    const share = await storage.getDataRoomShareByToken(req.params.token);
    if (!share) return res.status(404).json({ message: "This link doesn't exist." });
    if (share.revokedAt) return res.status(410).json({ message: "This link has been revoked by the startup." });
    if (share.expiresAt.getTime() < Date.now()) return res.status(410).json({ message: "This link has expired." });

    const startup = await storage.getStartupById(share.startupId);
    if (!startup) return res.status(404).json({ message: "This link doesn't exist." });
    const docs = await storage.listDocumentsByIds(share.documentIds);
    await storage.recordDataRoomShareView(share.id);

    res.json({
      companyName: startup.companyName,
      logoUrl: startup.logoUrl,
      title: share.title,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        fileUrl: d.fileUrl,
        fileName: d.fileName,
        status: d.status,
      })),
    });
  }));

  /* ---------------- Contract & KYS ---------------- */
  app.get("/api/contract", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const contract = await storage.getContract(startup.id);
    res.json({ contract: contract ?? null });
  }));

  // The startup signs the agreement on an external platform and uploads the
  // signed PDF here — the platform never handles signing itself.
  app.post("/api/contract/upload", requireAuth, (req, res, next) => {
    contractUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        const startup = await requireActiveStartup(req, res);
        if (!startup) return;
        if (!req.file) return res.status(400).json({ message: "Upload the signed contract as a PDF" });
        const fileUrl = `/uploads/contracts/${req.file.filename}`;
        const contract = await storage.submitContract(startup.id, {
          fileUrl,
          fileName: req.file.originalname,
        });
        await storage.addContractEvent({
          contractId: contract.id,
          startupId: startup.id,
          action: "uploaded",
          actorId: req.session.userId!,
        });
        res.status(201).json(contract);
      } catch (e) {
        next(e);
      }
    });
  });

  app.get("/api/kys", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const [profile, documents] = await Promise.all([
      storage.getKysProfile(startup.id),
      storage.listKysDocuments(startup.id),
    ]);
    res.json({ profile: profile ?? null, documents });
  }));

  app.post("/api/kys", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = kysSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const profile = await storage.submitKysProfile(startup.id, {
      track: d.track,
      incorporated: d.incorporated,
      addressLine1: d.addressLine1 || null,
      city: d.city || null,
      country: d.country || null,
      incorporationDate: d.incorporationDate || null,
      tin: d.tin || null,
      signatoryName: d.signatoryName || null,
      signatoryPhone: d.signatoryPhone || null,
      signatoryEmail: d.signatoryEmail || null,
      irsForm: d.irsForm ?? null,
      acceptsAltPayment: d.acceptsAltPayment ?? null,
      altPaymentDetail: d.altPaymentDetail || null,
      repName: d.repName || null,
      repPhone: d.repPhone || null,
      repEmail: d.repEmail || null,
      disclaimerAccepted: d.disclaimerAccepted ?? null,
      consentAccepted: d.consentAccepted,
    });
    await storage.addKysEvent({
      kysProfileId: profile.id,
      startupId: startup.id,
      action: "submitted",
      actorId: req.session.userId!,
    });
    res.status(201).json(profile);
  }));

  app.post("/api/kys/documents", requireAuth, (req, res, next) => {
    kysDocUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        const startup = await requireActiveStartup(req, res);
        if (!startup) return;
        const parsed = kysDocumentUploadSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.errors[0].message });
        }
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const fileUrl = `/uploads/kys/${req.file.filename}`;
        const doc = await storage.upsertKysDocument(startup.id, {
          docType: parsed.data.docType,
          fileUrl,
          fileName: req.file.originalname,
        });
        res.status(201).json(doc);
      } catch (e) {
        next(e);
      }
    });
  });

  /* ---------------- Monthly updates (Dashboard) ---------------- */
  app.get("/api/monthly-updates", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    res.json({ updates: await storage.listMonthlyUpdates(startup.id) });
  }));

  app.post("/api/monthly-updates", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = monthlyUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const now = new Date();
    const update = await storage.upsertMonthlyUpdate(startup.id, {
      periodMonth: now.getMonth() + 1,
      periodYear: now.getFullYear(),
      achieved: parsed.data.achieved,
      blocked: parsed.data.blocked,
      focusNext: parsed.data.focusNext,
      status: parsed.data.status,
      supportNeeded: parsed.data.supportNeeded || null,
    });
    res.status(201).json(update);
  }));

  /* ---------------- Team (Dashboard) ---------------- */
  app.get("/api/team", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    res.json({ members: await storage.listTeamMembers(startup.id) });
  }));

  app.post("/api/team", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = teamMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const member = await storage.createTeamMember(startup.id, {
      name: parsed.data.name,
      role: parsed.data.role || null,
      type: parsed.data.type,
    });
    res.status(201).json(member);
  }));

  app.delete("/api/team/:id", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const owned = await storage.getOwnedTeamMember(req.params.id, startup.id);
    if (!owned) return res.status(404).json({ message: "Not found" });
    await storage.deleteTeamMember(owned.id);
    res.json({ ok: true });
  }));

  /* ---------------- Cap Table (Dashboard overview) ---------------- */
  app.get("/api/cap-table", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    res.json({ entries: await storage.listCapTableEntries(startup.id) });
  }));

  app.post("/api/cap-table", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = capTableEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const entry = await storage.createCapTableEntry(startup.id, parsed.data);
    res.status(201).json(entry);
  }));

  app.delete("/api/cap-table/:id", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const owned = await storage.getOwnedCapTableEntry(req.params.id, startup.id);
    if (!owned) return res.status(404).json({ message: "Not found" });
    await storage.deleteCapTableEntry(owned.id);
    res.json({ ok: true });
  }));

  /* ---------------- Mentorship (flat list of sessions, no modules/locking) ---------------- */
  // Session content is program-wide, but each session embeds this startup's
  // own recap/feedback notes, so active-startup context is needed.
  app.get("/api/mentorship", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const [sessions, mentor] = await Promise.all([
      storage.listMentorshipSessionsForFounder(startup.id),
      storage.getMentorForStartup(startup.id),
    ]);
    res.json({ sessions, mentor: mentor ?? null });
  }));

  // Founder's own brief recap of a session they held. Never touches the
  // mentor's rating/feedback, which stays admin-owned.
  app.patch("/api/mentorship/sessions/:sessionId/notes", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = mentorshipSessionRecapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const notes = await storage.upsertMentorshipSessionNotes(req.params.sessionId, startup.id, {
      teamMembersPresence: d.teamMembersPresence || null,
      pointsDiscussed: d.pointsDiscussed || null,
      whatIsGoingWell: d.whatIsGoingWell || null,
      whatIsNotGoingWell: d.whatIsNotGoingWell || null,
      actionItems: d.actionItems || null,
    });
    res.json(notes);
  }));

  /* ---------------- Other experts (browse-only catalog + priority rating) ---------------- */
  app.get("/api/other-experts", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const [expertsList, priorities] = await Promise.all([
      storage.listExperts(),
      storage.listExpertPrioritiesForStartup(startup.id),
    ]);
    const priorityByExpertId = new Map(priorities.map((p) => [p.expertId, p.priority]));
    res.json({
      experts: expertsList.map((e) => ({ ...e, priority: priorityByExpertId.get(e.id) ?? null })),
    });
  }));

  app.patch("/api/other-experts/:expertId/priority", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const expert = await storage.getExpertById(req.params.expertId);
    if (!expert) return res.status(404).json({ message: "Not found" });
    const parsed = expertPrioritySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const priority = await storage.upsertExpertPriority(expert.id, startup.id, parsed.data.priority);
    res.json(priority);
  }));

  /* ---------------- Training (Modules + Sessions) — duplicate of Mentorship ---------------- */
  app.get("/api/training", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const [modules, trainer] = await Promise.all([
      storage.listTrainingModulesForFounder(startup.id),
      storage.getTrainerForStartup(startup.id),
    ]);
    res.json({ modules, trainer: trainer ?? null });
  }));

  app.post("/api/training/modules/:moduleId/homework", requireAuth, (req, res, next) => {
    homeworkUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        const startup = await requireActiveStartup(req, res);
        if (!startup) return;
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const fileUrl = `/uploads/homework/${req.file.filename}`;
        const homework = await storage.upsertTrainingModuleHomeworkSubmission(
          req.params.moduleId,
          startup.id,
          fileUrl,
          req.file.originalname,
        );
        res.status(201).json(homework);
      } catch (e) {
        next(e);
      }
    });
  });

  // Founder's own brief recap of a session they held. Never touches the
  // trainer's rating/feedback, which stays admin-owned.
  app.patch("/api/training/sessions/:sessionId/notes", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = trainingSessionRecapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const notes = await storage.upsertTrainingSessionNotes(req.params.sessionId, startup.id, {
      teamMembersPresence: d.teamMembersPresence || null,
      pointsDiscussed: d.pointsDiscussed || null,
      whatIsGoingWell: d.whatIsGoingWell || null,
      whatIsNotGoingWell: d.whatIsNotGoingWell || null,
      actionItems: d.actionItems || null,
    });
    res.json(notes);
  }));

  /* ---------------- Office Hours ---------------- */
  app.get("/api/office-hours/slots", requireAuth, ah(async (_req, res) => {
    res.json({ slots: await storage.listUpcomingOfficeHourSlots() });
  }));

  app.get("/api/office-hours/bookings", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    res.json({ bookings: await storage.listOfficeHourBookingsByStartup(startup.id) });
  }));

  app.post("/api/office-hours/bookings", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = officeHourBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const slot = await storage.getOfficeHourSlot(parsed.data.slotId);
    if (!slot) return res.status(404).json({ message: "Slot not found" });
    const bookedCount = await storage.countBookingsForSlot(slot.id);
    if (bookedCount >= slot.capacity) {
      return res.status(409).json({ message: "That slot is fully booked" });
    }
    const booking = await storage.createOfficeHourBooking(startup.id, slot.id, parsed.data.topic);
    res.status(201).json(booking);
  }));

  app.post("/api/office-hours/bookings/:id/cancel", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const owned = await storage.getOwnedOfficeHourBooking(req.params.id, startup.id);
    if (!owned) return res.status(404).json({ message: "Not found" });
    const booking = await storage.cancelOfficeHourBooking(owned.id);
    res.json(booking);
  }));

  // Admin: open a new office-hours slot for startups to book.
  app.post("/api/admin/office-hours/slots", requireAdmin, ah(async (req, res) => {
    const { hostName, topic, startsAt, endsAt, capacity, meetingLink } = req.body || {};
    if (!hostName || !startsAt || !endsAt) {
      return res.status(400).json({ message: "hostName, startsAt and endsAt are required" });
    }
    const slot = await storage.createOfficeHourSlot({
      hostName,
      topic: topic || null,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      capacity: capacity ? Number(capacity) : 1,
      meetingLink: meetingLink || null,
    });
    res.status(201).json(slot);
  }));

  /* ---------------- Open Startup School ---------------- */
  app.get("/api/school", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    res.json({ trainings: await storage.listSchoolForStartup(startup) });
  }));

  app.post("/api/school/:trainingId/progress", requireAuth, ah(async (req, res) => {
    const startup = await requireActiveStartup(req, res);
    if (!startup) return;
    const parsed = trainingProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const training = await storage.getTrainingById(req.params.trainingId);
    if (!training) return res.status(404).json({ message: "Not found" });
    const [effective] = (await storage.listSchoolForStartup(startup)).filter(
      (t) => t.id === training.id,
    );
    if (effective?.status === "locked") {
      return res.status(403).json({ message: "This module isn't unlocked yet" });
    }
    const progress = await storage.setTrainingProgress(startup.id, training.id, parsed.data.status);
    res.json(progress);
  }));

  /* ---------------- Admin: Open Startup School curriculum ---------------- */
  app.get("/api/admin/trainings", requireAdmin, ah(async (_req, res) => {
    res.json({ trainings: await storage.listTrainings() });
  }));

  app.post("/api/admin/trainings", requireAdmin, ah(async (req, res) => {
    const parsed = trainingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const training = await storage.createTraining({
      module: d.module,
      title: d.title,
      description: d.description || null,
      resourceUrl: d.resourceUrl || null,
      unlockMonth: d.unlockMonth ?? 0,
    });
    res.status(201).json(training);
  }));

  app.patch("/api/admin/trainings/:id", requireAdmin, ah(async (req, res) => {
    const training = await storage.getTrainingById(req.params.id);
    if (!training) return res.status(404).json({ message: "Not found" });
    const parsed = trainingSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const updated = await storage.updateTraining(training.id, {
      ...(d.module !== undefined ? { module: d.module } : {}),
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description || null } : {}),
      ...(d.resourceUrl !== undefined ? { resourceUrl: d.resourceUrl || null } : {}),
      ...(d.unlockMonth !== undefined ? { unlockMonth: d.unlockMonth } : {}),
    });
    res.json(updated);
  }));

  // Swap this training's orderIndex with the one immediately before/after it
  // in the same module — the reorder mechanism the admin UI's up/down buttons use.
  app.post("/api/admin/trainings/:id/move", requireAdmin, ah(async (req, res) => {
    const training = await storage.getTrainingById(req.params.id);
    if (!training) return res.status(404).json({ message: "Not found" });
    const direction = req.body?.direction;
    if (direction !== "up" && direction !== "down") {
      return res.status(400).json({ message: "direction must be 'up' or 'down'" });
    }
    const siblings = (await storage.listTrainings()).filter((t) => t.module === training.module);
    const idx = siblings.findIndex((t) => t.id === training.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return res.json({ ok: true });
    const other = siblings[swapIdx];
    await Promise.all([
      storage.updateTraining(training.id, { orderIndex: other.orderIndex }),
      storage.updateTraining(other.id, { orderIndex: training.orderIndex }),
    ]);
    res.json({ trainings: await storage.listTrainings() });
  }));

  app.delete("/api/admin/trainings/:id", requireAdmin, ah(async (req, res) => {
    const training = await storage.getTrainingById(req.params.id);
    if (!training) return res.status(404).json({ message: "Not found" });
    await storage.deleteTraining(training.id);
    res.json({ ok: true });
  }));

  /* ---------------- Zoom integration (public — Zoom calls this directly) ---------------- */
  const TRANSCRIPTS_DIR = path.resolve(__dirname, "..", "uploads", "transcripts");
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });

  app.post("/api/integrations/zoom/webhook", ah(async (req, res) => {
    const body = req.body as any;

    // One-time challenge Zoom sends when the webhook URL is first saved.
    if (body?.event === "endpoint.url_validation") {
      return res.json(respondToZoomUrlValidation(body.payload.plainToken));
    }

    // Every other event is signed — verify before trusting the payload.
    const signature = req.header("x-zm-signature");
    const timestamp = req.header("x-zm-request-timestamp");
    const rawBody = (req as any).rawBody?.toString("utf8") ?? "";
    if (!signature || !timestamp || !verifyZoomWebhookSignature(rawBody, timestamp, signature)) {
      return res.status(401).json({ message: "Invalid Zoom signature" });
    }

    const meetingId = String(body?.payload?.object?.id ?? "");
    const session = meetingId ? await storage.getMentorshipModuleSessionByZoomMeetingId(meetingId) : undefined;

    // Always 200 once the signature checks out — Zoom retries on non-2xx,
    // and there's nothing to retry if we simply don't recognize the meeting.
    if (!session) return res.json({ ok: true });

    if (body.event === "recording.completed") {
      const files: any[] = body.payload.object.recording_files ?? [];
      const video = files.find((f) => f.file_type === "MP4" && f.play_url);
      if (video) {
        await storage.updateMentorshipModuleSession(session.id, { recordingUrl: video.play_url });
      }
    }

    if (body.event === "recording.transcript_completed") {
      const files: any[] = body.payload.object.recording_files ?? [];
      const transcript = files.find((f) => f.file_type === "TRANSCRIPT" && f.download_url);
      const downloadToken = body.download_token;
      if (transcript && downloadToken) {
        try {
          const buf = await downloadZoomRecordingFile(transcript.download_url, downloadToken);
          const filename = `${session.id}-${Date.now()}.vtt`;
          fs.writeFileSync(path.join(TRANSCRIPTS_DIR, filename), buf);
          await storage.updateMentorshipModuleSession(session.id, { transcriptUrl: `/uploads/transcripts/${filename}` });
        } catch (e) {
          console.error("[zoom webhook] transcript download failed:", e);
        }
      }
    }

    res.json({ ok: true });
  }));

  /* ---------------- Admin: Mentorship (flat list of sessions) ---------------- */
  app.get("/api/admin/mentorship/sessions", requireAdmin, ah(async (_req, res) => {
    res.json({ sessions: await storage.listAllMentorshipSessions() });
  }));

  app.post("/api/admin/mentorship/sessions", requireAdmin, ah(async (req, res) => {
    const parsed = mentorshipModuleSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const session = await storage.createMentorshipModuleSession({
      number: parsed.data.number,
      title: parsed.data.title,
      description: parsed.data.description || null,
      scheduledAt: new Date(parsed.data.scheduledAt),
      durationMinutes: parsed.data.durationMinutes ?? 120,
      experts: parsed.data.experts || null,
      status: parsed.data.status ?? "upcoming",
      meetingLink: parsed.data.meetingLink || null,
      recordingUrl: parsed.data.recordingUrl || null,
      transcriptUrl: parsed.data.transcriptUrl || null,
      materialsUrl: parsed.data.materialsUrl || null,
      mentorBio: parsed.data.mentorBio || null,
      zoomMeetingId: parseZoomMeetingId(parsed.data.meetingLink),
    });
    res.status(201).json(session);
  }));

  app.patch("/api/admin/mentorship/sessions/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getMentorshipModuleSessionById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const parsed = mentorshipModuleSessionSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const patch: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.scheduledAt !== undefined) patch.scheduledAt = new Date(parsed.data.scheduledAt);
    if (parsed.data.description !== undefined) patch.description = parsed.data.description || null;
    if (parsed.data.experts !== undefined) patch.experts = parsed.data.experts || null;
    if (parsed.data.meetingLink !== undefined) {
      patch.meetingLink = parsed.data.meetingLink || null;
      patch.zoomMeetingId = parseZoomMeetingId(parsed.data.meetingLink);
    }
    if (parsed.data.recordingUrl !== undefined) patch.recordingUrl = parsed.data.recordingUrl || null;
    if (parsed.data.transcriptUrl !== undefined) patch.transcriptUrl = parsed.data.transcriptUrl || null;
    if (parsed.data.materialsUrl !== undefined) patch.materialsUrl = parsed.data.materialsUrl || null;
    if (parsed.data.mentorBio !== undefined) patch.mentorBio = parsed.data.mentorBio || null;
    const session = await storage.updateMentorshipModuleSession(existing.id, patch as any);
    res.json(session);
  }));

  app.delete("/api/admin/mentorship/sessions/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getMentorshipModuleSessionById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    await storage.deleteMentorshipModuleSession(existing.id);
    res.json({ ok: true });
  }));

  /* ---------------- Admin: Mentors (directory, one assigned per startup) ---------------- */
  app.get("/api/admin/mentors", requireAdmin, ah(async (_req, res) => {
    res.json({ mentors: await storage.listMentors() });
  }));

  app.post("/api/admin/mentors", requireAdmin, ah(async (req, res) => {
    const parsed = mentorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const mentor = await storage.createMentor({
      name: d.name,
      introduction: d.introduction || null,
      email: d.email || null,
      whatsapp: d.whatsapp || null,
      linkedinUrl: d.linkedinUrl || null,
    });
    res.status(201).json(mentor);
  }));

  app.patch("/api/admin/mentors/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getMentorById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const parsed = mentorSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const patch: Record<string, unknown> = { ...d };
    if (d.introduction !== undefined) patch.introduction = d.introduction || null;
    if (d.email !== undefined) patch.email = d.email || null;
    if (d.whatsapp !== undefined) patch.whatsapp = d.whatsapp || null;
    if (d.linkedinUrl !== undefined) patch.linkedinUrl = d.linkedinUrl || null;
    const mentor = await storage.updateMentor(existing.id, patch as any);
    res.json(mentor);
  }));

  app.delete("/api/admin/mentors/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getMentorById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    await storage.deleteMentor(existing.id);
    res.json({ ok: true });
  }));

  app.post("/api/admin/mentors/:id/picture", requireAdmin, (req, res, next) => {
    mentorPictureUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        const existing = await storage.getMentorById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Not found" });
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const pictureUrl = `/uploads/mentors/${req.file.filename}`;
        const mentor = await storage.updateMentor(existing.id, { pictureUrl });
        res.json(mentor);
      } catch (e) {
        next(e);
      }
    });
  });

  // Assign (or unassign, with mentorId: null) a mentor to a specific startup.
  app.patch("/api/admin/startups/:id/mentor", requireAdmin, ah(async (req, res) => {
    const startup = await storage.getStartupById(req.params.id);
    if (!startup) return res.status(404).json({ message: "Not found" });
    const parsed = assignMentorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const updated = await storage.updateStartup(startup.id, { mentorId: parsed.data.mentorId });
    res.json(updated);
  }));

  /* ---------------- Admin: Training (Modules + Sessions) — duplicate of Mentorship ---------------- */
  app.get("/api/admin/training/modules", requireAdmin, ah(async (_req, res) => {
    res.json({ modules: await storage.listTrainingModulesWithSessions() });
  }));

  app.post("/api/admin/training/modules", requireAdmin, ah(async (req, res) => {
    const parsed = trainingModuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const module = await storage.createTrainingModule({
      number: parsed.data.number,
      title: parsed.data.title,
      description: parsed.data.description || null,
      durationLabel: parsed.data.durationLabel || null,
      unlocked: parsed.data.unlocked ?? false,
    });
    res.status(201).json(module);
  }));

  app.patch("/api/admin/training/modules/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getTrainingModuleById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const parsed = trainingModuleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const patch: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.description !== undefined) patch.description = parsed.data.description || null;
    if (parsed.data.durationLabel !== undefined) patch.durationLabel = parsed.data.durationLabel || null;
    const module = await storage.updateTrainingModule(existing.id, patch as any);
    res.json(module);
  }));

  app.delete("/api/admin/training/modules/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getTrainingModuleById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    await storage.deleteTrainingModule(existing.id);
    res.json({ ok: true });
  }));

  app.post("/api/admin/training/sessions", requireAdmin, ah(async (req, res) => {
    const parsed = trainingModuleSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const module = await storage.getTrainingModuleById(parsed.data.moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });
    const session = await storage.createTrainingModuleSession(module.id, {
      number: parsed.data.number,
      title: parsed.data.title,
      description: parsed.data.description || null,
      scheduledAt: new Date(parsed.data.scheduledAt),
      durationMinutes: parsed.data.durationMinutes ?? 120,
      experts: parsed.data.experts || null,
      status: parsed.data.status ?? "upcoming",
      meetingLink: parsed.data.meetingLink || null,
      presentationUrl: parsed.data.presentationUrl || null,
      recordingUrl: parsed.data.recordingUrl || null,
      transcriptUrl: parsed.data.transcriptUrl || null,
      trainerBio: parsed.data.trainerBio || null,
      zoomMeetingId: parseZoomMeetingId(parsed.data.meetingLink),
    });
    res.status(201).json(session);
  }));

  app.patch("/api/admin/training/sessions/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getTrainingModuleSessionById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const parsed = trainingModuleSessionSchema.omit({ moduleId: true }).partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const patch: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.scheduledAt !== undefined) patch.scheduledAt = new Date(parsed.data.scheduledAt);
    if (parsed.data.description !== undefined) patch.description = parsed.data.description || null;
    if (parsed.data.experts !== undefined) patch.experts = parsed.data.experts || null;
    if (parsed.data.meetingLink !== undefined) {
      patch.meetingLink = parsed.data.meetingLink || null;
      patch.zoomMeetingId = parseZoomMeetingId(parsed.data.meetingLink);
    }
    if (parsed.data.presentationUrl !== undefined) patch.presentationUrl = parsed.data.presentationUrl || null;
    if (parsed.data.recordingUrl !== undefined) patch.recordingUrl = parsed.data.recordingUrl || null;
    if (parsed.data.transcriptUrl !== undefined) patch.transcriptUrl = parsed.data.transcriptUrl || null;
    if (parsed.data.trainerBio !== undefined) patch.trainerBio = parsed.data.trainerBio || null;
    const session = await storage.updateTrainingModuleSession(existing.id, patch as any);
    res.json(session);
  }));

  app.delete("/api/admin/training/sessions/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getTrainingModuleSessionById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    await storage.deleteTrainingModuleSession(existing.id);
    res.json({ ok: true });
  }));

  /* ---------------- Admin: Trainers (directory, one assigned per startup) ---------------- */
  app.get("/api/admin/trainers", requireAdmin, ah(async (_req, res) => {
    res.json({ trainers: await storage.listTrainers() });
  }));

  app.post("/api/admin/trainers", requireAdmin, ah(async (req, res) => {
    const parsed = trainerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const trainer = await storage.createTrainer({
      name: d.name,
      introduction: d.introduction || null,
      email: d.email || null,
      whatsapp: d.whatsapp || null,
      linkedinUrl: d.linkedinUrl || null,
    });
    res.status(201).json(trainer);
  }));

  app.patch("/api/admin/trainers/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getTrainerById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const parsed = trainerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const patch: Record<string, unknown> = { ...d };
    if (d.introduction !== undefined) patch.introduction = d.introduction || null;
    if (d.email !== undefined) patch.email = d.email || null;
    if (d.whatsapp !== undefined) patch.whatsapp = d.whatsapp || null;
    if (d.linkedinUrl !== undefined) patch.linkedinUrl = d.linkedinUrl || null;
    const trainer = await storage.updateTrainer(existing.id, patch as any);
    res.json(trainer);
  }));

  app.delete("/api/admin/trainers/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getTrainerById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    await storage.deleteTrainer(existing.id);
    res.json({ ok: true });
  }));

  app.post("/api/admin/trainers/:id/picture", requireAdmin, (req, res, next) => {
    trainerPictureUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        const existing = await storage.getTrainerById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Not found" });
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const pictureUrl = `/uploads/trainers/${req.file.filename}`;
        const trainer = await storage.updateTrainer(existing.id, { pictureUrl });
        res.json(trainer);
      } catch (e) {
        next(e);
      }
    });
  });

  // Assign (or unassign, with trainerId: null) a trainer to a specific startup.
  app.patch("/api/admin/startups/:id/trainer", requireAdmin, ah(async (req, res) => {
    const startup = await storage.getStartupById(req.params.id);
    if (!startup) return res.status(404).json({ message: "Not found" });
    const parsed = assignTrainerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const updated = await storage.updateStartup(startup.id, { trainerId: parsed.data.trainerId });
    res.json(updated);
  }));

  /* ---------------- Admin: Experts ("Other experts" catalog) ---------------- */
  app.get("/api/admin/experts", requireAdmin, ah(async (_req, res) => {
    res.json({ experts: await storage.listExperts() });
  }));

  app.post("/api/admin/experts", requireAdmin, ah(async (req, res) => {
    const parsed = expertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const expert = await storage.createExpert({
      name: d.name,
      bio: d.bio || null,
      industries: d.industries ?? [],
      expertiseAreas: d.expertiseAreas ?? [],
    });
    res.status(201).json(expert);
  }));

  app.patch("/api/admin/experts/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getExpertById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const parsed = expertSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const patch: Record<string, unknown> = { ...d };
    if (d.bio !== undefined) patch.bio = d.bio || null;
    const expert = await storage.updateExpert(existing.id, patch as any);
    res.json(expert);
  }));

  app.delete("/api/admin/experts/:id", requireAdmin, ah(async (req, res) => {
    const existing = await storage.getExpertById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    await storage.deleteExpert(existing.id);
    res.json({ ok: true });
  }));

  /* ---------------- Admin ---------------- */
  // List every Data Room document across every startup.
  app.get("/api/admin/documents", requireAdmin, ah(async (_req, res) => {
    res.json({ documents: await storage.listAllDocumentsWithStartups() });
  }));

  app.get("/api/admin/documents/:id/events", requireAdmin, ah(async (req, res) => {
    const doc = await storage.getDocumentById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json({ events: await storage.listDocumentEvents(doc.id) });
  }));

  // Review a submitted Data Room document (approve / reject).
  app.post("/api/admin/documents/:id/review", requireAdmin, ah(async (req, res) => {
    const doc = await storage.getDocumentById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    const parsed = documentReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const updated = await storage.reviewDocument(doc.id, parsed.data.status, parsed.data.reviewNote || null);
    await storage.addDocumentEvent({
      documentId: doc.id,
      startupId: doc.startupId,
      action: parsed.data.status,
      note: parsed.data.reviewNote || null,
      actorId: req.session.userId!,
    });
    res.json(updated);
  }));

  // Contract & KYS review.
  app.get("/api/admin/contracts", requireAdmin, ah(async (_req, res) => {
    res.json({ contracts: await storage.listContractsWithStartups() });
  }));

  app.get("/api/admin/contracts/:id/events", requireAdmin, ah(async (req, res) => {
    const contract = await storage.getContractById(req.params.id);
    if (!contract) return res.status(404).json({ message: "Not found" });
    res.json({ events: await storage.listContractEvents(contract.id) });
  }));

  app.post("/api/admin/contracts/:id/review", requireAdmin, ah(async (req, res) => {
    const contract = await storage.getContractById(req.params.id);
    if (!contract) return res.status(404).json({ message: "Not found" });
    const parsed = documentReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const updated = await storage.reviewContract(
      contract.id,
      parsed.data.status,
      parsed.data.reviewNote || null,
      req.session.userId!,
    );
    await storage.addContractEvent({
      contractId: contract.id,
      startupId: contract.startupId,
      action: parsed.data.status,
      note: parsed.data.reviewNote || null,
      actorId: req.session.userId!,
    });
    res.json(updated);
  }));

  app.get("/api/admin/kys", requireAdmin, ah(async (_req, res) => {
    res.json({ profiles: await storage.listKysProfilesWithStartups() });
  }));

  app.get("/api/admin/kys/:id", requireAdmin, ah(async (req, res) => {
    const profile = await storage.getKysProfileById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Not found" });
    const documents = await storage.listKysDocuments(profile.startupId);
    res.json({ profile, documents });
  }));

  app.get("/api/admin/kys/:id/events", requireAdmin, ah(async (req, res) => {
    const profile = await storage.getKysProfileById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Not found" });
    res.json({ events: await storage.listKysEvents(profile.id) });
  }));

  app.post("/api/admin/kys/:id/review", requireAdmin, ah(async (req, res) => {
    const profile = await storage.getKysProfileById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Not found" });
    const parsed = documentReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const updated = await storage.reviewKysProfile(
      profile.id,
      parsed.data.status,
      parsed.data.reviewNote || null,
      req.session.userId!,
    );
    await storage.addKysEvent({
      kysProfileId: profile.id,
      startupId: profile.startupId,
      action: parsed.data.status,
      note: parsed.data.reviewNote || null,
      actorId: req.session.userId!,
    });
    res.json(updated);
  }));

  app.get("/api/admin/stats", requireAdmin, ah(async (_req, res) => {
    res.json(await storage.adminCounts());
  }));

  const STAGE_LABELS: Record<string, string> = {
    idea: "Idea", prototype: "Prototype", mvp: "MVP",
    early_revenue: "Early revenue", growth: "Growth", scale: "Scale",
  };
  const REVIEW_LABELS: Record<string, string> = { pending: "pending", approved: "approved", rejected: "changes requested" };

  // "Ask AI" preview — answers a curated set of business questions (totals,
  // counts, and qualitative text/status fields) by keyword-matching the
  // question and running a real query. It never reads document/file contents
  // (contracts, decks, KYS uploads) — only structured fields already in the
  // database. This is a stand-in for a real LLM call (no Anthropic API key
  // configured yet); swapping in a real Claude tool-use loop later can reuse
  // these same storage functions as its tools, so nothing here goes to waste.
  app.post("/api/admin/ask", requireAdmin, ah(async (req, res) => {
    const question = String(req.body?.question || "").trim();
    if (!question) return res.status(400).json({ message: "Ask a question first" });
    const q = question.toLowerCase();

    const track: "seed" | "pre_seed" | undefined = /\bpre[\s-]?seed\b/.test(q)
      ? "pre_seed"
      : /\bseed\b/.test(q)
        ? "seed"
        : undefined;
    const trackLabel = track === "seed" ? "Seed" : track === "pre_seed" ? "Pre-Seed" : "all";

    const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

    // Per-startup lookup — only fires when a real startup name appears in the
    // question, so it never accidentally swallows a general question.
    const allStartups = await storage.listStartupNames();
    const matched = allStartups
      .filter((s) => s.companyName && q.includes(s.companyName.toLowerCase()))
      .sort((a, b) => b.companyName.length - a.companyName.length)[0]; // longest match wins
    if (matched) {
      const p = await storage.getStartupQualitativeProfile(matched.id);
      if (p) {
        const parts = [
          p.shortDescription ? `${p.companyName} — ${p.shortDescription}.` : `${p.companyName}.`,
          p.stage ? `Stage: ${STAGE_LABELS[p.stage] ?? p.stage}.` : null,
          p.track ? `Track: ${p.track === "seed" ? "Seed" : "Pre-Seed"}.` : null,
          p.location ? `Based in ${p.location}.` : null,
          p.markets?.length ? `Markets: ${p.markets.join(", ")}.` : null,
          `Team size: ${p.teamSize}.`,
          `Contract: ${p.contractStatus ? REVIEW_LABELS[p.contractStatus] ?? p.contractStatus : "not submitted"}.`,
          `KYS: ${p.kysStatus ? REVIEW_LABELS[p.kysStatus] ?? p.kysStatus : "not submitted"}.`,
        ].filter(Boolean);
        return res.json({ preview: true, answer: parts.join(" ") });
      }
    }

    if (/valuation/.test(q)) {
      const { total, countWithData, countTotal } = await storage.startupMetricSummary("lastValuation", track);
      return res.json({
        preview: true,
        answer: `The cumulative valuation across ${trackLabel} startups is ${money(total)}, based on ${countWithData} of ${countTotal} startup${countTotal === 1 ? "" : "s"} that have a valuation on file.`,
      });
    }
    if (/revenue/.test(q)) {
      const { total, countWithData, countTotal } = await storage.startupMetricSummary("totalRevenueSinceFounding", track);
      return res.json({
        preview: true,
        answer: `Total revenue since founding across ${trackLabel} startups is ${money(total)}, based on ${countWithData} of ${countTotal} startups with revenue data on file.`,
      });
    }
    if (/rais|fund|invest/.test(q)) {
      const { total, countWithData, countTotal } = await storage.startupMetricSummary("amountRaised", track);
      return res.json({
        preview: true,
        answer: `Total amount raised across ${trackLabel} startups is ${money(total)}, based on ${countWithData} of ${countTotal} startups with this reported.`,
      });
    }
    if (/team size|employees|headcount/.test(q)) {
      const { avg, totalMembers, totalStartups } = await storage.averageTeamSize();
      return res.json({
        preview: true,
        answer: `The average team size is ${avg.toFixed(1)} people, across ${totalMembers} total team members over ${totalStartups} startups.`,
      });
    }
    if (/attention|at risk|off.?track|behind|support needed|struggling/.test(q)) {
      const rows = await storage.listStartupsNeedingAttention();
      const answer = rows.length === 0
        ? "No startups currently have a monthly update flagged at-risk or off-track, or asking for support."
        : `${rows.length} startup${rows.length === 1 ? "" : "s"} need${rows.length === 1 ? "s" : ""} attention: ${rows.map((r) => `${r.companyName} (${r.status.replace("_", " ")}${r.supportNeeded ? `, asked: "${r.supportNeeded}"` : ""})`).join("; ")}.`;
      return res.json({ preview: true, answer });
    }
    if (/pending review|waiting.*review|pending contract|pending kys|need.*review/.test(q)) {
      const rows = await storage.listStartupsWithPendingReviews();
      const answer = rows.length === 0
        ? "No startups have a pending Contract or KYS review right now."
        : `${rows.length} startup${rows.length === 1 ? "" : "s"} ${rows.length === 1 ? "has" : "have"} a pending review: ${rows.map((r) => `${r.companyName} (${[r.contractPending && "Contract", r.kysPending && "KYS"].filter(Boolean).join(" & ")})`).join("; ")}.`;
      return res.json({ preview: true, answer });
    }
    if (/which startups|list.*startups|startups in\b/.test(q) && track) {
      const rows = await storage.listStartupNamesByTrack(track);
      const answer = rows.length === 0
        ? `No startups are on the ${trackLabel} track yet.`
        : `${rows.length} ${trackLabel} startup${rows.length === 1 ? "" : "s"}: ${rows.map((r) => `${r.companyName}${r.stage ? ` (${STAGE_LABELS[r.stage] ?? r.stage})` : ""}`).join(", ")}.`;
      return res.json({ preview: true, answer });
    }
    if (/how many|number of|count/.test(q)) {
      const count = await storage.countStartups(track);
      return res.json({
        preview: true,
        answer: `There are ${count} ${trackLabel === "all" ? "" : trackLabel + " "}startup${count === 1 ? "" : "s"} in the program.`,
      });
    }

    res.json({
      preview: true,
      unmatched: true,
      answer: "I don't have a canned answer for that yet — this preview only understands a few example questions using simple keyword matching, not a real LLM. Connecting an Anthropic API key will let it understand any question.",
    });
  }));

  app.get("/api/admin/startups", requireAdmin, ah(async (_req, res) => {
    res.json({ startups: await storage.listStartupsWithOwners() });
  }));

  // Portfolio-wide monthly update stream (achieved/blocked/focus-next) across every startup.
  app.get("/api/admin/monthly-updates", requireAdmin, ah(async (_req, res) => {
    res.json({ updates: await storage.listAllMonthlyUpdates() });
  }));

  // Portfolio-wide team roster visibility across every startup.
  app.get("/api/admin/team", requireAdmin, ah(async (_req, res) => {
    res.json({ members: await storage.listAllTeamMembers() });
  }));

  // Portfolio-wide KPI coverage + comparison across every startup.
  app.get("/api/admin/kpi", requireAdmin, ah(async (_req, res) => {
    const [submissions, startups] = await Promise.all([
      storage.listAllKpiSubmissions(),
      storage.listStartupsWithOwners(),
    ]);
    res.json({
      submissions,
      startups: startups.map((s) => ({ id: s.id, companyName: s.companyName })),
    });
  }));

  // Full detail view of one startup — goals, KPIs, monthly updates, team,
  // Data Room documents, and contract/KYS status, all in one call.
  app.get("/api/admin/startups/:id", requireAdmin, ah(async (req, res) => {
    const startup = await storage.getStartupById(req.params.id);
    if (!startup) return res.status(404).json({ message: "Not found" });
    const owner = await storage.getUserById(startup.userId);
    const [goals, kpiSubmissions, monthlyUpdates, teamMembers, contract, kysProfile, documents, mentorshipNotes, trainingNotes, trainingHomework] =
      await Promise.all([
        storage.listGoals(startup.id),
        storage.listKpiSubmissions(startup.id),
        storage.listMonthlyUpdates(startup.id),
        storage.listTeamMembers(startup.id),
        storage.getContract(startup.id),
        storage.getKysProfile(startup.id),
        storage.listDocuments(startup.id),
        storage.listMentorshipSessionNotesForStartup(startup.id),
        storage.listTrainingSessionNotesForStartup(startup.id),
        storage.listTrainingModuleHomeworkForStartup(startup.id),
      ]);
    res.json({
      startup,
      owner: owner ? toPublicUser(owner) : null,
      goals,
      kpiSubmissions,
      monthlyUpdates,
      teamMembers,
      contract: contract ?? null,
      kysProfile: kysProfile ?? null,
      documents,
      mentorshipNotes,
      trainingNotes,
      trainingHomework,
    });
  }));

  // Admin/mentor upsert of a startup's rating and written feedback. Never
  // touches the startup's own recap (see the founder-facing route above) or
  // homework submission.
  app.patch("/api/admin/startups/:id/mentorship-notes/:sessionId", requireAdmin, ah(async (req, res) => {
    const startup = await storage.getStartupById(req.params.id);
    if (!startup) return res.status(404).json({ message: "Not found" });
    const parsed = mentorshipMentorFeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const notes = await storage.upsertMentorshipSessionNotes(req.params.sessionId, startup.id, {
      mentorRating: d.mentorRating ?? null,
      mentorFeedback: d.mentorFeedback || null,
    });
    res.json(notes);
  }));

  // Admin/trainer upsert of a startup's rating and written feedback for a
  // Training session. Never touches the startup's own recap or homework
  // submission.
  app.patch("/api/admin/startups/:id/training-notes/:sessionId", requireAdmin, ah(async (req, res) => {
    const startup = await storage.getStartupById(req.params.id);
    if (!startup) return res.status(404).json({ message: "Not found" });
    const parsed = trainingTrainerFeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const d = parsed.data;
    const notes = await storage.upsertTrainingSessionNotes(req.params.sessionId, startup.id, {
      trainerRating: d.trainerRating ?? null,
      trainerFeedback: d.trainerFeedback || null,
    });
    res.json(notes);
  }));

  // Admin assignment of a startup's per-module Training homework doc/link.
  // Never touches the startup's own submission.
  app.patch("/api/admin/startups/:id/training-homework/:moduleId", requireAdmin, ah(async (req, res) => {
    const startup = await storage.getStartupById(req.params.id);
    if (!startup) return res.status(404).json({ message: "Not found" });
    const parsed = trainingModuleHomeworkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const homework = await storage.upsertTrainingModuleHomeworkAssignment(
      req.params.moduleId,
      startup.id,
      parsed.data.homeworkUrl || null,
    );
    res.json(homework);
  }));

  app.get("/api/admin/deletion-requests", requireAdmin, ah(async (_req, res) => {
    res.json({ requests: await storage.listDeletionRequests() });
  }));

  // Approve a deletion request -> permanently delete the startup.
  app.post("/api/admin/startups/:id/approve-deletion", requireAdmin, ah(async (req, res) => {
    const startup = await storage.getStartupById(req.params.id);
    if (!startup) return res.status(404).json({ message: "Not found" });
    await storage.deleteStartup(startup.id);
    res.json({ ok: true });
  }));

  // Deny a deletion request -> clear the request (startup stays).
  app.post("/api/admin/startups/:id/deny-deletion", requireAdmin, ah(async (req, res) => {
    const startup = await storage.getStartupById(req.params.id);
    if (!startup) return res.status(404).json({ message: "Not found" });
    await storage.cancelStartupDeletion(startup.id);
    res.json({ ok: true });
  }));

  app.get("/api/admin/users", requireAdmin, ah(async (_req, res) => {
    const list = await storage.listUsers();
    res.json({ users: list.map(toPublicUser) });
  }));

  app.post("/api/admin/users/:id/toggle-active", requireAdmin, ah(async (req, res) => {
    if (req.params.id === req.session.userId) {
      return res.status(400).json({ message: "You can't disable your own account" });
    }
    const target = await storage.getUserById(req.params.id);
    if (!target) return res.status(404).json({ message: "Not found" });
    const updated = await storage.setUserActive(target.id, !target.isActive);
    res.json(toPublicUser(updated));
  }));

  /* ---------------- API error handler ----------------
   * Returns a clean JSON 500 (with a hint about missing DB columns) instead of
   * letting an error bubble up and crash the process. */
  app.use("/api", (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api error]", err);
    const msg = String(err?.message || "");
    const isMissingColumn = /column .* does not exist|relation .* does not exist/i.test(msg);
    if (res.headersSent) return;
    res.status(500).json({
      message: isMissingColumn
        ? "The database is out of date. Please run 3-update-database.bat, then restart the app."
        : "Server error. Please try again.",
    });
  });
}
