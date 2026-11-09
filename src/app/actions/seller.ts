"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser } from "@/lib/auth";
import { approvedSellerNo, EVENT } from "@/lib/config";
import { sendMail, sellerMail } from "@/lib/mail";
import { nextSeq } from "@/lib/sequence";
import { sellerProfileSchema, sellerSchema, type SellerData } from "@/lib/seller-schema";
import { SELLER_APPLICANT_EDITABLE, SELLER_TALUK_EDITABLE } from "@/lib/status";
import { ensureSellerLogin } from "@/lib/seller-login";
import { sellerScope } from "@/lib/seller-query";
import { englishText, firstErrors } from "@/lib/text";
import type { Prisma } from "@/generated/prisma/client";
import { createSeller } from "@/lib/seller-create";
import type { SellerAction, SellerStatus } from "@/generated/prisma/enums";
import type { FormState } from "./auth";

const revalidateAll = () => {
  for (const p of ["/district", "/taluk", "/training", "/dic", "/fieo", "/admin", "/seller"]) revalidatePath(p, "layout");
};

const FIELDS = ["name", "district", "taluk", "localBodyType", "localBodyName", "udyamNo", "exportExperience", "exportedProducts", "iecNo",
  "contactName", "contactMobile", "contactWhatsapp", "contactEmail"] as const;

function readForm(form: FormData) {
  const raw: Record<string, unknown> = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "")]));
  try { raw.products = JSON.parse(String(form.get("products") ?? "[]")); } catch { raw.products = []; }
  try { raw.certifications = JSON.parse(String(form.get("certifications") ?? "[]")); } catch { raw.certifications = []; }
  try { raw.exportCountries = JSON.parse(String(form.get("exportCountries") ?? "[]")); } catch { raw.exportCountries = []; }
  if (form.get("sameWhatsapp") === "on") raw.contactWhatsapp = raw.contactMobile;
  return raw;
}

/** Validates sector ids against the master; returns an error message or null. */
async function checkSectors(d: SellerData) {
  const ids = d.products.map((p) => p.sectorId);
  const n = await prisma.sector.count({ where: { id: { in: ids } } });
  return n === ids.length ? null : "Select sectors from the list.";
}

// ---------------------------------------------------------------- district: add / district & taluk: edit

/**
 * District office registers a seller of its district (a temporary login is created and e-mailed);
 * the district office and the seller's taluk office can edit it while it is with the taluk office.
 * The taluk office can save and recommend in one step.
 */
export async function saveSellerAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["DISTRICT", "TALUK"]);
  const id = String(form.get("id") ?? "") || null;
  if (!id && user.role !== "DISTRICT") return { error: "Sellers are registered by the district office or by the seller." };
  const raw = readForm(form);
  raw.district = user.district; // a district / taluk office handles sellers of its own district only
  if (user.role === "TALUK") raw.taluk = user.taluk;
  const parsed = sellerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error, true), error: "Please correct the highlighted fields." };
  const d = parsed.data;
  const sectorErr = await checkSectors(d);
  if (sectorErr) return { error: sectorErr };

  const dup = await prisma.seller.findUnique({ where: { udyamNo: d.udyamNo } });
  if (dup && dup.id !== id) {
    return { fieldErrors: { udyamNo: `This Udyam number is already registered (${dup.regNo}, ${dup.district}).` }, error: "Please correct the highlighted fields." };
  }
  const recommend = user.role === "TALUK" && form.get("intent") === "recommend";
  const passwordHash = id ? "" : await hashPassword(EVENT.defaultBuyerPassword);

  const result = await prisma.$transaction(async (tx) => {
    if (!id) {
      const s = await createSeller(tx, d, "DISTRICT", { id: user.id, role: "DISTRICT" });
      const login = await ensureSellerLogin(tx, s, passwordHash);
      return { seller: s, login };
    }
    const existing = await tx.seller.findFirst({ where: { AND: [{ id }, sellerScope(user)] } });
    if (!existing || !SELLER_TALUK_EDITABLE.includes(existing.status)) return null;
    const { products, ...rest } = d;
    await tx.sellerProduct.deleteMany({ where: { sellerId: id } });
    const s = await tx.seller.update({
      where: { id },
      data: { ...rest, products: { create: products.map((p, i) => ({ sectorId: p.sectorId, products: p.products, sortOrder: i })) } },
    });
    await tx.sellerLog.create({ data: { sellerId: id, actorId: user.id, actorRole: user.role, action: "UPDATED" } });
    if (recommend) await recommendOne(tx, s.id, s.status, user.id);
    return { seller: s, login: null };
  });
  if (!result) return { error: "This seller can no longer be edited (already with the Directorate or decided)." };
  const { seller, login } = result;
  if (login) {
    const m = sellerMail.received(seller.name, seller.regNo, seller.district, seller.taluk, login.username, login.created ? EVENT.defaultBuyerPassword : null, true);
    await sendMail(seller.contactEmail, m.subject, m.text);
  }
  revalidateAll();
  const base = user.role === "TALUK" ? "/taluk/sellers" : "/district/sellers";
  redirect(`${base}/${seller.id}?done=${recommend ? "recommended" : id ? "updated" : "registered"}`);
}

async function recommendOne(tx: Prisma.TransactionClient, id: string, status: SellerStatus, actorId: string, comment?: string | null) {
  if (!SELLER_TALUK_EDITABLE.includes(status)) return false;
  await tx.seller.update({ where: { id }, data: { status: "RECOMMENDED", recommendedAt: new Date() } });
  await tx.sellerLog.create({ data: { sellerId: id, actorId, actorRole: "TALUK", action: "RECOMMENDED", comment: comment ?? null } });
  return true;
}

// ---------------------------------------------------------------- public self-registration

export async function selfRegisterSellerAction(_: FormState, form: FormData): Promise<FormState> {
  const raw = readForm(form);
  const parsed = sellerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error, true), error: "Please correct the highlighted fields." };
  const d = parsed.data;
  const sectorErr = await checkSectors(d);
  if (sectorErr) return { error: sectorErr };
  if (await prisma.seller.findUnique({ where: { udyamNo: d.udyamNo } })) {
    return { fieldErrors: { udyamNo: "This Udyam number is already registered. Please contact your District Industries Centre." }, error: "Please correct the highlighted fields." };
  }
  const passwordHash = await hashPassword(EVENT.defaultBuyerPassword);
  const { seller, username } = await prisma.$transaction(async (tx) => {
    const s = await createSeller(tx, d, "SELF", null);
    // Temporary applicant login: application status, corrections and the awareness session, until final approval.
    const login = await ensureSellerLogin(tx, s, passwordHash);
    return { seller: s, username: login.username };
  });
  const m = sellerMail.received(seller.name, seller.regNo, seller.district, seller.taluk, username, EVENT.defaultBuyerPassword);
  await sendMail(seller.contactEmail, m.subject, m.text);
  revalidateAll();
  return { ok: true, data: { regNo: seller.regNo, district: seller.district, taluk: seller.taluk, email: seller.contactEmail, username } };
}

// ---------------------------------------------------------------- applicant: correct and resubmit

export async function applicantSaveSellerAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("SELLER");
  const current = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!current || !SELLER_APPLICANT_EDITABLE.includes(current.status)) {
    return { error: "Your application has moved on (recommended or decided), so it can no longer be changed." };
  }
  const parsed = sellerSchema.safeParse(readForm(form));
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error, true), error: "Please correct the highlighted fields." };
  const d = parsed.data;
  const sectorErr = await checkSectors(d);
  if (sectorErr) return { error: sectorErr };
  const dup = await prisma.seller.findUnique({ where: { udyamNo: d.udyamNo } });
  if (dup && dup.id !== current.id) {
    return { fieldErrors: { udyamNo: "This Udyam number is already registered. Please contact your District Industries Centre." }, error: "Please correct the highlighted fields." };
  }
  const resubmitted = current.status === "WITH_SELLER";
  const ok = await prisma.$transaction(async (tx) => {
    const fresh = await tx.seller.findUnique({ where: { id: current.id } });
    if (!fresh || !SELLER_APPLICANT_EDITABLE.includes(fresh.status)) return false;
    const { products, ...rest } = d;
    await tx.sellerProduct.deleteMany({ where: { sellerId: fresh.id } });
    await tx.seller.update({
      where: { id: fresh.id },
      data: { ...rest, status: "WITH_TALUK", products: { create: products.map((p, i) => ({ sectorId: p.sectorId, products: p.products, sortOrder: i })) } },
    });
    await tx.user.update({ where: { id: user.id }, data: { displayName: d.name } });
    await tx.sellerLog.create({
      data: { sellerId: fresh.id, actorId: user.id, actorRole: "SELLER", action: fresh.status === "WITH_SELLER" ? "RESUBMITTED" : "UPDATED" },
    });
    return true;
  });
  if (!ok) return { error: "Your application has just moved on and can no longer be changed. Please refresh." };
  revalidateAll();
  redirect(`/seller?done=${resubmitted ? "resubmitted" : "updated"}`);
}

// ---------------------------------------------------------------- decisions (taluk office / Directorate)

type Decision = "recommend" | "not_recommend" | "to_seller" | "approve_initial" | "return" | "reject" | "approve" | "bypass";

/** Who may take each decision, and from which statuses. */
const RULES: Record<Decision, { role: "TALUK" | "DIC"; from: SellerStatus[]; comment: boolean }> = {
  recommend: { role: "TALUK", from: SELLER_TALUK_EDITABLE, comment: false },
  not_recommend: { role: "TALUK", from: SELLER_TALUK_EDITABLE, comment: true },
  to_seller: { role: "TALUK", from: SELLER_TALUK_EDITABLE, comment: true },
  approve_initial: { role: "DIC", from: ["RECOMMENDED"], comment: false },
  return: { role: "DIC", from: ["RECOMMENDED"], comment: true },
  reject: { role: "DIC", from: ["RECOMMENDED", "INITIAL_APPROVED", "TRAINED"], comment: true },
  approve: { role: "DIC", from: ["TRAINED"], comment: false },
  // Case by case: final approval for a seller who did not attend (or has not yet attended) the awareness session.
  bypass: { role: "DIC", from: ["INITIAL_APPROVED"], comment: true },
};

const commentField = englishText({ max: 2000, label: "Comment", multiline: true });

/**
 * One or many sellers at once (form fields: sellerIds…, decision, comment).
 * Taluk office: recommend / not recommend / return to the applicant.
 * Directorate: initial approval / return to taluk / reject; final approval (or, case by case, bypass) / reject.
 */
export async function sellerDecisionAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["TALUK", "DIC"]);
  const decision = String(form.get("decision")) as Decision;
  const rule = RULES[decision];
  if (!rule || rule.role !== user.role) return { error: "Unknown action." };
  const ids = [...new Set(form.getAll("sellerIds").map(String).filter(Boolean))];
  if (!ids.length) return { error: "Select at least one seller." };
  const pc = commentField.safeParse(String(form.get("comment") ?? ""));
  if (!pc.success) return { fieldErrors: { comment: pc.error.issues[0].message } };
  const comment = pc.data || null;
  if (rule.comment && (!comment || comment.length < 5)) {
    return { fieldErrors: { comment: "A comment (at least 5 characters) is required for this decision." }, error: "Please add a comment." };
  }

  const sellers = await prisma.seller.findMany({ where: { AND: [{ id: { in: ids }, status: { in: rule.from } }, sellerScope(user)] } });
  if (!sellers.length) return { error: "These sellers have already been acted on. Refresh the page." };

  const now = new Date();
  const passwordHash = await hashPassword(EVENT.defaultBuyerPassword);
  type Done = { name: string; email: string; regNo: string; taluk: string; approvedNo?: string; username?: string; newLogin?: boolean };
  const done: Done[] = [];
  for (const s of sellers) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.seller.findUnique({ where: { id: s.id } });
      if (!fresh || !rule.from.includes(fresh.status)) return;
      const base: Done = { name: fresh.name, email: fresh.contactEmail, regNo: fresh.regNo, taluk: fresh.taluk };
      const log = (action: SellerAction) => tx.sellerLog.create({ data: { sellerId: s.id, actorId: user.id, actorRole: user.role, action, comment } });
      switch (decision) {
        case "recommend":
          await recommendOne(tx, s.id, fresh.status, user.id, comment);
          break;
        case "not_recommend":
          await tx.seller.update({ where: { id: s.id }, data: { status: "NOT_RECOMMENDED" } });
          await log("NOT_RECOMMENDED");
          break;
        case "to_seller": {
          const login = await ensureSellerLogin(tx, fresh, passwordHash);
          await tx.seller.update({ where: { id: s.id }, data: { status: "WITH_SELLER" } });
          await log("SENT_TO_SELLER");
          Object.assign(base, { username: login.username, newLogin: login.created });
          break;
        }
        case "approve_initial":
          await tx.seller.update({ where: { id: s.id }, data: { status: "INITIAL_APPROVED", initialApprovedAt: now } });
          await log("INITIAL_APPROVED");
          break;
        case "return":
          await tx.seller.update({ where: { id: s.id }, data: { status: "RETURNED" } });
          await log("RETURNED");
          break;
        case "reject":
          await tx.seller.update({ where: { id: s.id }, data: { status: "REJECTED" } });
          // A pending awareness-session place is released.
          await tx.batchMember.deleteMany({ where: { sellerId: s.id, attendance: "PENDING" } });
          await log("REJECTED");
          break;
        case "approve":
        case "bypass": {
          // Final approval: seller number and permanent login (the temporary login becomes permanent).
          const seq = await nextSeq(tx, `seller-approved-${EVENT.approvedYear}`);
          const login = await ensureSellerLogin(tx, fresh, passwordHash);
          const approvedNo = approvedSellerNo(seq);
          await tx.seller.update({ where: { id: s.id }, data: { status: "APPROVED", approvedAt: now, approvedSeq: seq, approvedNo, bypassed: decision === "bypass" } });
          if (decision === "bypass") await tx.batchMember.deleteMany({ where: { sellerId: s.id, attendance: "PENDING" } });
          await log(decision === "bypass" ? "BYPASSED" : "APPROVED");
          Object.assign(base, { approvedNo, username: login.username, newLogin: login.created });
          break;
        }
      }
      done.push(base);
    });
  }

  for (const d of done) {
    const m = decision === "approve" || decision === "bypass" ? sellerMail.approved(d.name, d.approvedNo!, d.username!, d.newLogin ? EVENT.defaultBuyerPassword : null)
      : decision === "to_seller" ? sellerMail.sentBack(d.name, d.regNo, d.taluk, comment!, { username: d.username!, password: d.newLogin ? EVENT.defaultBuyerPassword : null })
      : decision === "not_recommend" ? sellerMail.notRecommended(d.name, d.regNo, d.taluk, comment!)
      : decision === "approve_initial" ? sellerMail.initialApproved(d.name, d.regNo)
      : decision === "reject" ? sellerMail.rejected(d.name, d.regNo, comment!)
      : null;
    if (m) await sendMail(d.email, m.subject, m.text);
  }
  revalidateAll();
  const verb: Record<Decision, string> = {
    recommend: "recommended to the Directorate", not_recommend: "not recommended", to_seller: "returned to the applicant for correction",
    approve_initial: "initially approved — to attend an awareness session", return: "returned to the taluk office", reject: "rejected",
    approve: "given final approval — seller numbers and permanent logins e-mailed",
    bypass: "given final approval without the awareness session — seller number and permanent login e-mailed",
  };
  return { ok: true, message: `${done.length} seller${done.length === 1 ? "" : "s"} ${verb[decision]}${done.length === 1 ? ` (${done[0].name})` : ""}.` };
}

// ---------------------------------------------------------------- approved seller: profile

const PROFILE_KEYS = ["promoterGender", "promoterDob", "socialCategory", "speciallyAbled", "block", "constitution", "unitCategory", "unitType", "iecNo", "exportedProducts"] as const;

/** An approved seller completes (or updates) the promoter and unit profile. */
export async function saveSellerProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("SELLER");
  const s = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!s || s.status !== "APPROVED") return { error: "The profile can be completed once your registration is approved." };
  const raw: Record<string, unknown> = Object.fromEntries(PROFILE_KEYS.map((k) => [k, String(form.get(k) ?? "")]));
  try { raw.certifications = JSON.parse(String(form.get("certifications") ?? "[]")); } catch { raw.certifications = []; }
  try { raw.exportCountries = JSON.parse(String(form.get("exportCountries") ?? "[]")); } catch { raw.exportCountries = []; }
  const parsed = sellerProfileSchema(s.district, s.exportExperience).safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error, true), error: "Please correct the highlighted fields." };
  const first = !s.profileCompletedAt;
  await prisma.$transaction([
    prisma.seller.update({ where: { id: s.id }, data: { ...parsed.data, profileCompletedAt: s.profileCompletedAt ?? new Date() } }),
    prisma.sellerLog.create({ data: { sellerId: s.id, actorId: user.id, actorRole: "SELLER", action: "PROFILE_UPDATED", comment: first ? "Profile completed" : "Profile updated" } }),
  ]);
  revalidateAll();
  redirect(`/seller/profile?done=${first ? "completed" : "updated"}`);
}
