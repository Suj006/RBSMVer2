import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { APP_URL, EVENT } from "@/lib/config";

let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  transporter = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
  return transporter;
}

export const isMailConfigured = () => Boolean(process.env.SMTP_HOST);

/**
 * Sends an e-mail and records it in the outbox. Never throws: a mail failure
 * must not undo the registration or review action that triggered it.
 */
export async function sendMail(to: string, subject: string, text: string) {
  const t = getTransporter();
  let status: "SENT" | "LOGGED" | "FAILED" = "LOGGED";
  let error: string | undefined;
  if (t) {
    try {
      await t.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html: toHtml(text) });
      status = "SENT";
    } catch (e) {
      status = "FAILED";
      error = e instanceof Error ? e.message : String(e);
      console.error("[mail] failed", to, subject, error);
    }
  } else {
    console.info(`[mail:outbox] to=${to} subject=${subject}\n${text}`);
  }
  await prisma.emailLog.create({ data: { to, subject, body: text, status, error } });
  return status;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function toHtml(text: string) {
  const bar = ["#d62a2a", "#dcc72b", "#3cb54a", "#2ea3e6"]
    .map((c) => `<td style="height:4px;background:${c};font-size:0;line-height:0">&nbsp;</td>`).join("");
  return `<div style="background:#f6f8f7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bar}</tr></table></td></tr>
<tr><td style="padding:20px 28px 8px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#237d32">${escape(`${EVENT.name} · ${EVENT.programme}`.toUpperCase())}</td></tr>
<tr><td style="padding:8px 28px 24px;font-size:14px;line-height:1.65;color:#0f1b2d;white-space:pre-line">${escape(text)}</td></tr>
<tr><td style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">${escape(EVENT.organiser)} · This is an automated message from the ${escape(EVENT.name)} ${escape(EVENT.short)} portal.</td></tr>
</table></div>`;
}

const signature = `\n\nRegards,\n${EVENT.name} ${EVENT.short} Secretariat\n${APP_URL}`;

export const mailTemplates = {
  credentials: (name: string, username: string, password: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — your buyer login credentials`,
    text: `Dear ${name},

Thank you for signing up for ${EVENT.name} ${EVENT.programme}.

Your login credentials:
User name: ${username}
Password: ${password}

Sign in at ${APP_URL}/login. You will be asked to change your password on first login and then to complete your application (basic details, sourcing profile and sector requirements) and submit it to FIEO.${signature}`,
  }),
  addedByFieo: (name: string, username: string, password: string, sectors: number) => ({
    subject: `${EVENT.name} ${EVENT.short} — you have been registered as a buyer (temporary login)`,
    text: `Dear ${name},

FIEO has registered your organisation as an international buyer for ${EVENT.name} ${EVENT.programme}.

Your temporary login:
User name: ${username}
Password: ${password}

Sign in at ${APP_URL}/login. You will be asked to change your password first. Please check the details FIEO entered${sectors ? ` (including ${sectors} sector requirement${sectors > 1 ? "s" : ""} now with the Directorate for approval)` : ""} and add your sector requirements.

This login becomes your permanent ${EVENT.short} login as soon as the Directorate approves your registration.${signature}`,
  }),
  basicApproved: (name: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — basic details approved`,
    text: `Dear ${name},

Your basic registration details have been approved by FIEO. Please sign in and complete your detailed sourcing requirement.${signature}`,
  }),
  returned: (name: string, what: string, comment: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — ${what} returned for correction`,
    text: `Dear ${name},

Your ${what} has been returned for correction with the following comment:

"${comment}"

Please sign in, update the details and submit again.${signature}`,
  }),
  sectorsReturned: (name: string, items: { sector: string; comment: string }[]) => ({
    subject: `${EVENT.name} ${EVENT.short} — requirement returned for correction`,
    text: `Dear ${name},

FIEO has returned the following sector requirement${items.length > 1 ? "s" : ""} for correction:

${items.map((i) => `• ${i.sector}: "${i.comment}"`).join("\n")}

Please sign in, update ${items.length > 1 ? "them" : "it"} and submit again. Your other sectors are not affected.${signature}`,
  }),
  fieoReview: (name: string, r: { returned: { sector: string; comment: string }[]; rejected: { sector: string; comment: string }[]; basicComment: string | null }) => ({
    subject: `${EVENT.name} ${EVENT.short} — FIEO has reviewed your application`,
    text: `Dear ${name},

FIEO has reviewed your application.
${r.basicComment ? `
Comment on your basic details: "${r.basicComment}"
` : ""}${r.returned.length ? `
Returned for correction:
${r.returned.map((i) => `• ${i.sector}: "${i.comment}"`).join("\n")}
` : ""}${r.rejected.length ? `
Rejected:
${r.rejected.map((i) => `• ${i.sector}: "${i.comment}"`).join("\n")}
` : ""}
${r.returned.length || r.rejected.length ? "You can sign in, edit these sectors and submit them again. " : ""}Sectors approved by FIEO go to the Directorate for approval.${signature}`,
  }),
  changeVerified: (name: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — change to your details verified`,
    text: `Dear ${name},

FIEO has verified the change to your basic details / sourcing profile. The updated details are now in use.${signature}`,
  }),
  changeReturned: (name: string, comment: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — change to your details returned`,
    text: `Dear ${name},

FIEO has returned the change to your basic details / sourcing profile with the following comment:

"${comment}"

Your verified details are unchanged. Please sign in, correct the change and send it again.${signature}`,
  }),
  sectorsApproved: (name: string, approvedNo: string, sectors: string[], firstTime: boolean, username?: string) => ({
    subject: firstTime
      ? `${EVENT.name} ${EVENT.short} — registration approved (${approvedNo})`
      : `${EVENT.name} ${EVENT.short} — sector requirement approved`,
    text: `Dear ${name},

${firstTime
  ? `We are pleased to inform you that your registration has been approved by the Directorate and you have been added to the ${EVENT.short} buyer list.

Your buyer number: ${approvedNo}
${username ? `Your login ${username} is now your permanent ${EVENT.short} login.
` : ""}
`
  : ""}The following sector requirement${sectors.length > 1 ? "s have" : " has"} been approved:
${sectors.map((s) => `• ${s}`).join("\n")}

You can add new sectors or modify approved ones at any time from your dashboard; changes go through the same approval.${signature}`,
  }),
  approved: (name: string, approvedNo: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — registration approved (${approvedNo})`,
    text: `Dear ${name},

We are pleased to inform you that your registration has been approved by the Directorate and you have been added to the ${EVENT.short} buyer list.

Your buyer number: ${approvedNo}

Further details on matchmaking and B2B meeting schedules will follow.${signature}`,
  }),
};

export const sellerMail = {
  received: (name: string, regNo: string, district: string, taluk: string, username: string, password: string | null, byDistrict = false) => ({
    subject: `${EVENT.name} ${EVENT.short} — seller registration received (${regNo})`,
    text: `Dear ${name},

${byDistrict ? `The District Industries Centre, ${district}, has registered your enterprise` : "Thank you for registering"} as a seller for ${EVENT.name} ${EVENT.programme}.

Your registration number: ${regNo}

Next steps:
1. The Taluk Industries Office, ${taluk}, verifies your details and recommends your application.
2. The Directorate of Industries & Commerce gives initial approval.
3. You attend an awareness session (the date, time and venue will be sent to you).
4. The Directorate gives final approval: your seller number and permanent login.

Temporary login to track your application:
User name: ${username}
${password ? `Password: ${password}
(You will be asked to set your own password when you sign in.)` : "(use the password you have set)"}

Sign in at ${APP_URL}/login to see the status of your application. If the taluk office asks for a correction, you can correct your details and resubmit them with this login.${signature}`,
  }),
  /** The taluk office sends an application back to the applicant for correction. */
  sentBack: (name: string, regNo: string, taluk: string, comment: string, login: { username: string; password: string | null }) => ({
    subject: `${EVENT.name} ${EVENT.short} — please correct your seller registration (${regNo})`,
    text: `Dear ${name},

The Taluk Industries Office, ${taluk}, has returned your seller registration ${regNo} for correction:

"${comment}"

Please sign in at ${APP_URL}/login, correct the details and resubmit them.
${login.password ? `
User name: ${login.username}
Password: ${login.password}
(You will be asked to set your own password when you sign in.)` : `
User name: ${login.username} (use the password you have set)`}${signature}`,
  }),
  notRecommended: (name: string, regNo: string, taluk: string, comment: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — seller registration ${regNo} not recommended`,
    text: `Dear ${name},

The Taluk Industries Office, ${taluk}, has not recommended your seller registration ${regNo}, for the following reason:

"${comment}"

For clarification, please contact the taluk office.${signature}`,
  }),
  initialApproved: (name: string, regNo: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — initial approval (${regNo})`,
    text: `Dear ${name},

Your seller registration ${regNo} has been given initial approval by the Directorate of Industries & Commerce.

Next step: please attend an awareness session. You will be informed of its date, time and venue by e-mail, and you can also see it when you sign in at ${APP_URL}/login with your temporary login.

Your seller number and permanent login are given after the session, on the Directorate's final approval.${signature}`,
  }),
  batch: (name: string, regNo: string, b: { name: string; day: string; time: string; venue: string }, moved: boolean) => ({
    subject: `${EVENT.name} ${EVENT.short} — awareness session ${moved ? "changed" : "scheduled"} (${regNo})`,
    text: `Dear ${name},

${moved ? "Your awareness session has been changed. Please attend the new session:" : "You have been scheduled for an awareness session:"}

${b.name}
Date: ${b.day}
Time: ${b.time}
Venue: ${b.venue}

Attendance is recorded at the session. After it, the Directorate gives final approval and your permanent login.${signature}`,
  }),
  approved: (name: string, approvedNo: string, username: string, password: string | null) => ({
    subject: `${EVENT.name} ${EVENT.short} — seller registration approved (${approvedNo})`,
    text: `Dear ${name},

We are pleased to inform you that your registration has been given final approval by the Directorate of Industries & Commerce and you have been added to the ${EVENT.short} seller list.

Your seller number: ${approvedNo}

${password ? `Your login credentials:
User name: ${username}
Password: ${password}

Sign in at ${APP_URL}/login. You will be asked to change your password on first login.` : `Your login (${username}) is now your permanent seller login. Sign in at ${APP_URL}/login with the password you have set to see your full seller dashboard.`}

Next step: please complete your seller profile (promoter and unit details) from "My profile" in the portal. It is needed before you can send your buyer preferences. Buyer meeting details will be shared through the portal.${signature}`,
  }),
  rejected: (name: string, regNo: string, comment: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — seller registration ${regNo} not accepted`,
    text: `Dear ${name},

Your seller registration ${regNo} could not be accepted, for the following reason:

"${comment}"

For clarification, please contact your Taluk Industries Office or District Industries Centre.${signature}`,
  }),
};

export const matchMail = {
  published: (name: string, who: "buyer" | "seller", count: number, updated: boolean) => ({
    subject: `${EVENT.name} ${EVENT.short} — your B2B matchmaking ${updated ? "has been updated" : "is ready"}`,
    text: `Dear ${name},

The Directorate of Industries & Commerce has ${updated ? "updated" : "published"} the buyer–seller matchmaking for ${EVENT.name} ${EVENT.programme}.

You have been matched with ${count} ${who === "buyer" ? "Kerala MSME seller" : "international buyer"}${count === 1 ? "" : "s"} for one-to-one B2B meetings.

Sign in at ${APP_URL}/login to see the details. Meeting schedules will be shared through the portal.${signature}`,
  }),
};

export const commsMail = {
  /** A new message in a conversation (the text itself is read on the portal). */
  message: (name: string, from: string, where: string, link: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — new message from ${from}`,
    text: `Dear ${name},

You have a new message from ${from} in "${where}" on the ${EVENT.short} portal.

Sign in to read and reply: ${APP_URL}${link}${signature}`,
  }),
  announcement: (name: string, from: string, subject: string, link: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — ${subject}`,
    text: `Dear ${name},

${from} has sent you a communication: "${subject}".

Sign in to read it and any documents shared: ${APP_URL}${link}${signature}`,
  }),
};

export const eventMail = {
  nodalLogin: (name: string, username: string, password: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — nodal officer login`,
    text: `Dear ${name},

You have been added as a nodal officer for the ${EVENT.programme}. You will look after a group of buyers on the event days:
their meeting schedule, verifying sellers' meeting tickets and marking attendance.

User name: ${username}
Password: ${password}

Sign in at ${APP_URL}/login. You will be asked to change your password on first login.${signature}`,
  }),
  schedule: (name: string, id: string, n: number, link: string, updated: boolean, seller: boolean) => ({
    subject: `${EVENT.name} ${EVENT.short} — ${updated ? "your meeting schedule has been updated" : "your meeting schedule"}`,
    text: `Dear ${name},

${updated ? "Your meeting schedule has been updated." : "Your buyer–seller meeting schedule has been published."} You have ${n} meeting${n === 1 ? "" : "s"}.

Your ID: ${id}

${seller ? `See the dates, times, pavilions and your meeting tickets at ${APP_URL}${link}. Please bring the ticket (printed or on your phone) to each meeting and show it to the nodal officer at the pavilion.` : `See the dates, times, your pavilion and the sellers you will meet at ${APP_URL}${link}. Sellers come to your pavilion; your nodal officer verifies their tickets.`}${signature}`,
  }),
};

export const mouMail = {
  approved: (name: string, mouNo: string, other: string, link: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — MoU approved (${mouNo})`,
    text: `Dear ${name},

The memorandum of understanding ${mouNo} with ${other} has been verified by the nodal officer and approved by FIEO.

View and download it at ${APP_URL}${link}.${signature}`,
  }),
  returned: (name: string, mouNo: string, comment: string) => ({
    subject: `${EVENT.name} ${EVENT.short} — MoU returned for correction (${mouNo})`,
    text: `Dear ${name},

The memorandum of understanding ${mouNo} has been returned for correction:

"${comment}"

Please sign in, correct it under MoUs and submit it again.${signature}`,
  }),
};
