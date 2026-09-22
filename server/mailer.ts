import nodemailer from "nodemailer";
import "dotenv/config";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

export const smtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;
if (smtpConfigured) {
  const port = Number(SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
} else {
  console.warn(
    "[mailer] SMTP not configured — verification links will be printed to this console instead of emailed.",
  );
}

const FROM = SMTP_FROM || SMTP_USER || "no-reply@open-startup.org";
const BRAND = "#1d2853";
const ACCENT = "#469BE2";

function verificationHtml(name: string, link: string): string {
  return `
  <div style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:0 auto;color:${BRAND}">
    <div style="background:${BRAND};border-radius:14px 14px 0 0;padding:28px 32px;color:#fff">
      <div style="font-size:20px;font-weight:800">Open Startup</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${ACCENT}">Platform</div>
    </div>
    <div style="border:1px solid #eef0f6;border-top:0;border-radius:0 0 14px 14px;padding:32px">
      <h1 style="font-size:20px;margin:0 0 12px">Confirm your email</h1>
      <p style="font-size:14px;line-height:1.6;color:#475569">
        Hi ${name || "there"}, welcome to Open Startup. Please confirm your email
        address to activate your account.
      </p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block">
          Verify my email
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;line-height:1.6">
        Or paste this link into your browser:<br>
        <a href="${link}" style="color:${ACCENT};word-break:break-all">${link}</a>
      </p>
      <p style="font-size:12px;color:#94a3b8;margin-top:20px">
        This link expires in 24 hours. If you didn't create this account, you can ignore this email.
      </p>
    </div>
  </div>`;
}

/**
 * Send (or, if SMTP isn't set up, log) the verification link.
 * Returns true if an email was actually dispatched.
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  link: string,
): Promise<boolean> {
  if (!transporter) {
    console.log("\n==================== EMAIL VERIFICATION ====================");
    console.log(`  To: ${to}`);
    console.log(`  Verify link: ${link}`);
    console.log("  (SMTP not configured — open this link to verify.)");
    console.log("============================================================\n");
    return false;
  }
  await transporter.sendMail({
    from: `"Open Startup" <${FROM}>`,
    to,
    subject: "Confirm your email — Open Startup",
    html: verificationHtml(name, link),
    text: `Welcome to Open Startup! Confirm your email: ${link}`,
  });
  return true;
}


function emailChangeHtml(name: string, link: string): string {
  return `
  <div style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:0 auto;color:${BRAND}">
    <div style="background:${BRAND};border-radius:14px 14px 0 0;padding:28px 32px;color:#fff">
      <div style="font-size:20px;font-weight:800">Open Startup</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${ACCENT}">Platform</div>
    </div>
    <div style="border:1px solid #eef0f6;border-top:0;border-radius:0 0 14px 14px;padding:32px">
      <h1 style="font-size:20px;margin:0 0 12px">Confirm your new email</h1>
      <p style="font-size:14px;line-height:1.6;color:#475569">
        Hi ${name || "there"}, we received a request to change your Open Startup
        email to this address. Click below to confirm. If this wasn't you, ignore this email.
      </p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block">
          Confirm new email
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;word-break:break-all">
        <a href="${link}" style="color:${ACCENT}">${link}</a>
      </p>
      <p style="font-size:12px;color:#94a3b8;margin-top:16px">This link expires in 24 hours.</p>
    </div>
  </div>`;
}

export async function sendEmailChangeVerification(
  toNewEmail: string,
  name: string,
  link: string,
): Promise<boolean> {
  if (!transporter) {
    console.log("\n=============== EMAIL CHANGE CONFIRMATION ===============");
    console.log(`  To (new address): ${toNewEmail}`);
    console.log(`  Confirm link: ${link}`);
    console.log("========================================================\n");
    return false;
  }
  await transporter.sendMail({
    from: `"Open Startup" <${FROM}>`,
    to: toNewEmail,
    subject: "Confirm your new email - Open Startup",
    html: emailChangeHtml(name, link),
    text: `Confirm your new Open Startup email: ${link}`,
  });
  return true;
}

export async function sendPasswordChangedNotice(
  toEmail: string,
  name: string,
): Promise<boolean> {
  if (!transporter) {
    console.log(`\n[mailer] (would notify ${toEmail}: password changed)\n`);
    return false;
  }
  await transporter.sendMail({
    from: `"Open Startup" <${FROM}>`,
    to: toEmail,
    subject: "Your Open Startup password was changed",
    html: `<div style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:0 auto;color:${BRAND}">
      <p style="font-size:14px;line-height:1.6">Hi ${name || "there"}, your Open Startup password was just changed. If this was you, no action is needed. If it wasn't, please reset your password immediately and contact us.</p>
    </div>`,
    text: "Your Open Startup password was just changed. If this wasn't you, reset it immediately.",
  });
  return true;
}


/* ---------------- Session calendar invites ---------------- */

export type SessionInviteRecipient = { email: string; name?: string | null };

function sessionInviteHtml(opts: {
  name?: string | null;
  kind: string;
  title: string;
  whenUtc: string;
  durationMinutes: number;
  joinUrl?: string | null;
  cancelled?: boolean;
  updated?: boolean;
}): string {
  const heading = opts.cancelled
    ? "Session cancelled"
    : opts.updated
      ? `${opts.kind} session updated`
      : `${opts.kind} session scheduled`;
  const lead = opts.cancelled
    ? `This ${opts.kind.toLowerCase()} session has been cancelled. Your calendar should update automatically.`
    : opts.updated
      ? `A ${opts.kind.toLowerCase()} session you're invited to has changed. Accept the attached update to refresh it on your calendar.`
      : `You're invited to a ${opts.kind.toLowerCase()} session. Accept the attached invite to add it to your calendar.`;
  const joinBlock = opts.cancelled || !opts.joinUrl
    ? ""
    : `<p style="margin:24px 0">
         <a href="${opts.joinUrl}" style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block">
           Join the meeting
         </a>
       </p>`;
  return `
  <div style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:0 auto;color:${BRAND}">
    <div style="background:${BRAND};border-radius:14px 14px 0 0;padding:28px 32px;color:#fff">
      <div style="font-size:20px;font-weight:800">Open Startup</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${ACCENT}">Platform</div>
    </div>
    <div style="border:1px solid #eef0f6;border-top:0;border-radius:0 0 14px 14px;padding:32px">
      <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
      <p style="font-size:14px;line-height:1.6;color:#475569">
        Hi ${opts.name || "there"}, ${lead}
      </p>
      <table style="font-size:14px;color:#475569;line-height:1.8;margin:16px 0">
        <tr><td style="padding-right:12px;color:#94a3b8">Session</td><td><strong>${opts.title}</strong></td></tr>
        <tr><td style="padding-right:12px;color:#94a3b8">When</td><td>${opts.whenUtc}</td></tr>
        <tr><td style="padding-right:12px;color:#94a3b8">Duration</td><td>${opts.durationMinutes} minutes</td></tr>
      </table>
      ${joinBlock}
      <p style="font-size:12px;color:#94a3b8;margin-top:20px">
        The time above is shown in UTC. Your calendar will display it in your own timezone.
      </p>
    </div>
  </div>`;
}

/**
 * Email a calendar invite (or cancellation) for a session.
 *
 * Sent one message per recipient rather than one message with everyone in To,
 * so founders' addresses are never disclosed to each other. Returns the number
 * of messages actually dispatched.
 *
 * A failure for one recipient is logged and skipped: a bounced address must not
 * stop the rest of the cohort being told about the session.
 */
export async function sendSessionInvite(opts: {
  recipients: SessionInviteRecipient[];
  kind: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  joinUrl?: string | null;
  ics: string;
  cancelled?: boolean;
  updated?: boolean;
}): Promise<number> {
  if (!opts.recipients.length) return 0;

  const whenUtc = opts.startsAt.toUTCString();
  const verb = opts.cancelled ? "Cancelled" : opts.updated ? "Updated" : "Invitation";
  const subject = `${verb}: ${opts.title} — ${whenUtc}`;

  if (!transporter) {
    console.log("\n==================== SESSION INVITE ====================");
    console.log(`  ${subject}`);
    console.log(`  Recipients: ${opts.recipients.map((r) => r.email).join(", ")}`);
    console.log("  (SMTP not configured — no invite was emailed.)");
    console.log("=======================================================\n");
    return 0;
  }

  let sent = 0;
  for (const recipient of opts.recipients) {
    try {
      await transporter.sendMail({
        from: `"Open Startup" <${FROM}>`,
        to: recipient.email,
        subject,
        html: sessionInviteHtml({ ...opts, name: recipient.name, whenUtc }),
        text: [
          opts.cancelled
            ? `Cancelled: ${opts.title}`
            : opts.updated
              ? `Updated: ${opts.title}`
              : `You're invited: ${opts.title}`,
          `When: ${whenUtc} (${opts.durationMinutes} minutes)`,
          opts.joinUrl && !opts.cancelled ? `Join: ${opts.joinUrl}` : "",
        ].filter(Boolean).join("\n"),
        // nodemailer emits this as text/calendar in a multipart/alternative,
        // which is what makes Gmail and Outlook render it as an invite with
        // Accept/Decline rather than as a file attachment.
        icalEvent: {
          method: opts.cancelled ? "CANCEL" : "REQUEST",
          filename: "invite.ics",
          content: opts.ics,
        },
      });
      sent += 1;
    } catch (error) {
      console.error(`[mailer] session invite to ${recipient.email} failed:`, error);
    }
  }
  return sent;
}

/* ---------------- Admin broadcast (cohort / single startup) ---------------- */

function adminBroadcastHtml(opts: {
  name?: string | null;
  body: string;
  senderName: string;
  asSelf: boolean;
}): string {
  const paragraphs = opts.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#475569">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const byline = opts.asSelf
    ? `<p style="font-size:12px;color:#94a3b8;margin-top:20px">Sent by ${opts.senderName} via the Open Startup Platform. Replying goes directly to them.</p>`
    : `<p style="font-size:12px;color:#94a3b8;margin-top:20px">Sent by the Open Startup team.</p>`;
  return `
  <div style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:0 auto;color:${BRAND}">
    <div style="background:${BRAND};border-radius:14px 14px 0 0;padding:28px 32px;color:#fff">
      <div style="font-size:20px;font-weight:800">Open Startup</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${ACCENT}">Platform</div>
    </div>
    <div style="border:1px solid #eef0f6;border-top:0;border-radius:0 0 14px 14px;padding:32px">
      <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 16px">Hi ${opts.name || "there"},</p>
      ${paragraphs}
      ${byline}
    </div>
  </div>`;
}

/**
 * A message an admin sends to either a whole cohort (by KYS track) or a
 * single startup. Sent one message per recipient (never a shared To list),
 * same convention as sendSessionInvite.
 *
 * The literal "From" address is always the platform's own authenticated SMTP
 * account, regardless of asSelf — Gmail's relay only permits a different
 * visible sender when that exact address is registered as a "Send mail as"
 * alias on the account, which isn't set up here. "Send as me" instead sets
 * the display name to the admin and Reply-To to their own address, so
 * replies land in their inbox even though the raw From stays the platform's.
 */
export async function sendAdminBroadcast(opts: {
  recipients: { email: string; name?: string | null }[];
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
  asSelf: boolean;
}): Promise<number> {
  if (!opts.recipients.length) return 0;
  const displayName = opts.asSelf ? `${opts.senderName} via Open Startup` : "Open Startup";

  if (!transporter) {
    console.log("\n==================== ADMIN MESSAGE ====================");
    console.log(`  ${opts.subject}`);
    console.log(`  From: ${displayName}${opts.asSelf ? ` (reply-to ${opts.senderEmail})` : ""}`);
    console.log(`  Recipients: ${opts.recipients.map((r) => r.email).join(", ")}`);
    console.log("  (SMTP not configured — no message was emailed.)");
    console.log("=======================================================\n");
    return 0;
  }

  let sent = 0;
  for (const recipient of opts.recipients) {
    try {
      await transporter.sendMail({
        from: `"${displayName}" <${FROM}>`,
        ...(opts.asSelf ? { replyTo: opts.senderEmail } : {}),
        to: recipient.email,
        subject: opts.subject,
        html: adminBroadcastHtml({ name: recipient.name, body: opts.body, senderName: opts.senderName, asSelf: opts.asSelf }),
        text: opts.body,
      });
      sent += 1;
    } catch (error) {
      console.error(`[mailer] admin message to ${recipient.email} failed:`, error);
    }
  }
  return sent;
}

/* ---------------- Signup approval ---------------- */

/**
 * Notify every active admin that a new applicant is waiting for review.
 * Best-effort: logs and moves on if SMTP isn't configured, and a failure for
 * one admin doesn't stop the others from being told.
 */
export async function sendApplicationNotice(opts: {
  admins: { email: string; name: string | null }[];
  applicantName: string;
  applicantEmail: string;
  role: string;
  startupName: string | null;
  reviewUrl: string;
}): Promise<number> {
  if (!opts.admins.length) return 0;
  const subject = `New ${opts.role} application: ${opts.applicantName}`;

  if (!transporter) {
    console.log("\n==================== NEW APPLICATION ====================");
    console.log(`  ${opts.applicantName} <${opts.applicantEmail}> — ${opts.role}${opts.startupName ? ` (${opts.startupName})` : ""}`);
    console.log(`  Review: ${opts.reviewUrl}`);
    console.log("  (SMTP not configured — no email was sent.)");
    console.log("===========================================================\n");
    return 0;
  }

  const html = `
  <div style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:0 auto;color:${BRAND}">
    <div style="background:${BRAND};border-radius:14px 14px 0 0;padding:28px 32px;color:#fff">
      <div style="font-size:20px;font-weight:800">Open Startup</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${ACCENT}">Platform</div>
    </div>
    <div style="border:1px solid #eef0f6;border-top:0;border-radius:0 0 14px 14px;padding:32px">
      <h1 style="font-size:20px;margin:0 0 12px">New application to review</h1>
      <table style="font-size:14px;color:#475569;line-height:1.8;margin:16px 0">
        <tr><td style="padding-right:12px;color:#94a3b8">Name</td><td><strong>${opts.applicantName}</strong></td></tr>
        <tr><td style="padding-right:12px;color:#94a3b8">Email</td><td>${opts.applicantEmail}</td></tr>
        <tr><td style="padding-right:12px;color:#94a3b8">Role</td><td>${opts.role}</td></tr>
        ${opts.startupName ? `<tr><td style="padding-right:12px;color:#94a3b8">Startup</td><td>${opts.startupName}</td></tr>` : ""}
      </table>
      <p style="margin:24px 0">
        <a href="${opts.reviewUrl}" style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block">
          Review application
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8">They cannot access the platform until you approve or reject them.</p>
    </div>
  </div>`;

  let sent = 0;
  for (const admin of opts.admins) {
    try {
      await transporter.sendMail({
        from: `"Open Startup" <${FROM}>`,
        to: admin.email,
        subject,
        html,
        text: `New ${opts.role} application from ${opts.applicantName} (${opts.applicantEmail}). Review: ${opts.reviewUrl}`,
      });
      sent += 1;
    } catch (error) {
      console.error(`[mailer] application notice to ${admin.email} failed:`, error);
    }
  }
  return sent;
}

/** Tell the applicant the outcome of their review. */
export async function sendApplicationDecision(opts: {
  to: string;
  name: string | null;
  approved: boolean;
  loginUrl: string;
}): Promise<boolean> {
  const subject = opts.approved ? "You're approved — welcome to Open Startup" : "About your Open Startup application";

  if (!transporter) {
    console.log("\n==================== APPLICATION DECISION ====================");
    console.log(`  To: ${opts.to} — ${opts.approved ? "APPROVED" : "REJECTED"}`);
    console.log("  (SMTP not configured — no email was sent.)");
    console.log("================================================================\n");
    return false;
  }

  const body = opts.approved
    ? `<p style="font-size:14px;line-height:1.6;color:#475569">
         Hi ${opts.name || "there"}, good news: your application has been approved.
         You can now sign in and use the platform.
       </p>
       <p style="margin:24px 0">
         <a href="${opts.loginUrl}" style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block">
           Sign in
         </a>
       </p>`
    : `<p style="font-size:14px;line-height:1.6;color:#475569">
         Hi ${opts.name || "there"}, thanks for applying to Open Startup. After
         review, we won't be moving forward with your application at this time.
       </p>`;

  const html = `
  <div style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:0 auto;color:${BRAND}">
    <div style="background:${BRAND};border-radius:14px 14px 0 0;padding:28px 32px;color:#fff">
      <div style="font-size:20px;font-weight:800">Open Startup</div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${ACCENT}">Platform</div>
    </div>
    <div style="border:1px solid #eef0f6;border-top:0;border-radius:0 0 14px 14px;padding:32px">
      <h1 style="font-size:20px;margin:0 0 12px">${opts.approved ? "You're approved" : "Application update"}</h1>
      ${body}
    </div>
  </div>`;

  try {
    await transporter.sendMail({
      from: `"Open Startup" <${FROM}>`,
      to: opts.to,
      subject,
      html,
      text: opts.approved
        ? `Your application has been approved. Sign in: ${opts.loginUrl}`
        : "Thanks for applying to Open Startup. We won't be moving forward with your application at this time.",
    });
    return true;
  } catch (error) {
    console.error(`[mailer] application decision to ${opts.to} failed:`, error);
    return false;
  }
}
