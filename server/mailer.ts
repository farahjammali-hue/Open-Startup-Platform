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
}): string {
  const heading = opts.cancelled ? "Session cancelled" : `${opts.kind} session scheduled`;
  const lead = opts.cancelled
    ? `This ${opts.kind.toLowerCase()} session has been cancelled. Your calendar should update automatically.`
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
}): Promise<number> {
  if (!opts.recipients.length) return 0;

  const whenUtc = opts.startsAt.toUTCString();
  const verb = opts.cancelled ? "Cancelled" : "Invitation";
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
          opts.cancelled ? `Cancelled: ${opts.title}` : `You're invited: ${opts.title}`,
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
