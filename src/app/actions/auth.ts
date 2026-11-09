"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { COUNTRIES } from "@/lib/countries";
import { EVENT, buyerRegNo, buyerUsername } from "@/lib/config";
import { mailTemplates, sendMail, isMailConfigured } from "@/lib/mail";
import { nextSeq } from "@/lib/sequence";
import { ROLE_HOME } from "@/lib/status";
import { emailField, firstErrors, orgName } from "@/lib/text";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  message?: string;
  data?: Record<string, string>;
} | undefined;

const fieldErrors = (e: z.ZodError) => firstErrors(e);

// ---------------------------------------------------------------- login

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your user name and password." };

  // User names are case-insensitive: "tradex2027-001" and "FIEO" also work.
  const prefix = EVENT.usernamePrefix.toLowerCase();
  const canonical = username.toLowerCase().startsWith(prefix)
    ? EVENT.usernamePrefix + username.slice(prefix.length).toUpperCase() // Tradex2027-001 / Tradex2027-S001
    : username.toLowerCase();
  const user = await prisma.user.findUnique({ where: { username: canonical } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid user name or password.", data: { username } };
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  redirect(user.mustChangePassword ? "/change-password" : ROLE_HOME[user.role]);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ---------------------------------------------------------------- sign-up

const signupSchema = z.object({
  country: z.string().refine((c) => COUNTRIES.includes(c), "Select your country from the list."),
  name: orgName(),
  email: emailField(),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const raw = {
    country: String(form.get("country") ?? ""),
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
  };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), data: raw };
  const { country, name, email } = parsed.data;

  if (await prisma.buyer.findUnique({ where: { signupEmail: email } })) {
    return {
      fieldErrors: { email: "This e-mail address is already registered. Please sign in, or contact the RBSM secretariat." },
      data: raw,
    };
  }

  const passwordHash = await hashPassword(EVENT.defaultBuyerPassword);
  const buyer = await prisma.$transaction(async (tx) => {
    const seq = await nextSeq(tx, "buyer");
    const user = await tx.user.create({
      data: {
        username: buyerUsername(seq),
        passwordHash,
        role: "BUYER",
        displayName: name,
        mustChangePassword: true,
      },
    });
    const b = await tx.buyer.create({
      data: { userId: user.id, seq, regNo: buyerRegNo(seq), name, country, signupEmail: email },
      include: { user: true },
    });
    await tx.reviewLog.create({ data: { buyerId: b.id, actorId: user.id, actorRole: "BUYER", action: "SIGNED_UP" } });
    return b;
  });

  const mail = mailTemplates.credentials(name, buyer.user.username, EVENT.defaultBuyerPassword);
  const status = await sendMail(email, mail.subject, mail.text);

  return {
    ok: true,
    message: status === "SENT"
      ? `Your login credentials have been sent to ${email}.`
      : status === "FAILED"
        ? `Your account was created, but the e-mail to ${email} could not be sent. Please note your credentials below.`
        : `Your login credentials have been e-mailed to ${email}.`,
    data: {
      email,
      username: buyer.user.username,
      regNo: buyer.regNo,
      // Shown on screen only while outgoing mail is not configured (development)
      // or when sending failed, so the buyer is never locked out.
      ...(status !== "SENT" || !isMailConfigured() ? { password: EVENT.defaultBuyerPassword } : {}),
    },
  };
}

// ---------------------------------------------------------------- password change

const pwSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72)
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords do not match." })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a password different from the current one." });

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = pwSchema.safeParse({
    current: String(form.get("current") ?? ""),
    next: String(form.get("next") ?? ""),
    confirm: String(form.get("confirm") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { fieldErrors: { current: "Current password is incorrect." } };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.next), mustChangePassword: false },
  });
  redirect(user.role === "BUYER" ? "/buyer/application?welcome=1" : ROLE_HOME[user.role]);
}
