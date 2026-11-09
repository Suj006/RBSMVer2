"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/auth";
import { COUNTRIES } from "@/lib/countries";
import { canEditApplication, canRequestChange, canSubmitItems, ITEM_EDITABLE, ITEM_TO_SUBMIT } from "@/lib/status";
import { parseChange, type BasicFields, type BuyerChange, type ProfileFields } from "@/lib/buyer-change";
import { parseCerts } from "@/lib/format";
import { deleteUpload, storeUpload, validateUpload } from "@/lib/storage";
import type { DocumentKind } from "@/generated/prisma/enums";
import type { FormState } from "./auth";
import { designation, emailField, firstErrors, englishText, mobileField, orgName, personName } from "@/lib/text";

const fieldErrors = (e: z.ZodError) => firstErrors(e, true);

/** Empty input → null (draft), otherwise validated by `field` with its own messages. */
const optional = <T extends z.ZodType<string, string>>(field: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), field.nullable());
const opt = (max: number, label: string) =>
  englishText({ max, label }).transform((v) => v || null);

// ---------------------------------------------------------------- basic details

// Every text field is English-only; names are stored in Title Case.
const basicDraft = z.object({
  name: orgName(),
  country: z.string().refine((c) => COUNTRIES.includes(c), "Select a country from the list."),
  pocName: optional(personName("Contact name")),
  pocDesignation: optional(designation()),
  pocEmail: optional(emailField()),
  pocMobile: optional(mobileField()),
});

const basicFull = basicDraft.extend({
  pocName: personName("Contact name"),
  pocDesignation: designation(),
  pocEmail: emailField(),
  pocMobile: mobileField(),
});

const FILE_FIELDS: [string, DocumentKind][] = [["profileFile", "PROFILE"], ["credentialsFile", "CREDENTIALS"]];
const BASIC_KEYS = ["name", "country", "pocName", "pocDesignation", "pocEmail", "pocMobile"] as const;
const LOCKED = "Your application is with FIEO for verification. You can make changes once FIEO has verified it.";

/** Store uploaded files as the buyer's documents (`pending` = part of a change waiting for FIEO). */
async function storeDocs(buyerId: string, files: { kind: DocumentKind; file: File }[], pending: boolean) {
  for (const { kind, file } of files) {
    const storedName = await storeUpload(file, buyerId, kind.toLowerCase());
    const where = { buyerId_kind_pending: { buyerId, kind, pending } };
    const prev = await prisma.document.findUnique({ where });
    const doc = { originalName: file.name.slice(0, 200), storedName, mimeType: file.type, size: file.size, uploadedAt: new Date() };
    await prisma.document.upsert({ where, create: { buyerId, kind, pending, ...doc }, update: doc });
    if (prev) await deleteUpload(prev.storedName);
  }
}

/** Save a requested change; clears it when nothing differs from the verified details any more. */
async function saveChange(buyerId: string, userId: string, change: BuyerChange, what: string) {
  const pendingDocs = await prisma.document.count({ where: { buyerId, pending: true } });
  const any = change.basic || change.profile || pendingDocs > 0;
  delete change.comment; // a fresh request replaces FIEO's earlier return comment
  await prisma.$transaction([
    prisma.buyer.update({ where: { id: buyerId }, data: any
      ? { pendingChange: JSON.stringify(change), changeState: "SUBMITTED", changeAt: new Date() }
      : { pendingChange: null, changeState: null, changeAt: null } }),
    ...(any ? [prisma.reviewLog.create({ data: { buyerId, actorId: userId, actorRole: "BUYER", action: "CHANGE_SUBMITTED", comment: what } })] : []),
  ]);
  return any;
}

export async function saveBasicAction(_: FormState, form: FormData): Promise<FormState> {
  const { user, buyer } = await requireBuyer();
  const mode = canEditApplication(buyer.status) ? "draft" : canRequestChange(buyer.status) ? "change" : null;
  if (!mode) return { error: LOCKED };

  const raw = Object.fromEntries(BASIC_KEYS.map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = (mode === "change" ? basicFull : basicDraft).safeParse(raw);
  const errors: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error);

  // Validate files first, store only when the whole form is valid.
  const files: { kind: DocumentKind; file: File }[] = [];
  for (const [field, kind] of FILE_FIELDS) {
    const f = form.get(field);
    if (f instanceof File && f.size > 0) {
      const err = validateUpload(f);
      if (err) errors[field] = err;
      else files.push({ kind, file: f });
    }
  }
  if (!parsed.success || Object.keys(errors).length) {
    return { fieldErrors: errors, error: "Please correct the highlighted fields.", data: raw };
  }
  try {
    await storeDocs(buyer.id, files, mode === "change");
  } catch (e) {
    return { error: (e as Error).message, data: raw };
  }
  const d = parsed.data;

  if (mode === "draft") {
    await prisma.$transaction([
      prisma.buyer.update({ where: { id: buyer.id }, data: d }),
      prisma.user.update({ where: { id: user.id }, data: { displayName: d.name } }),
    ]);
    revalidatePath("/buyer", "layout");
    return { ok: true, message: "Basic details saved. Submit your application once every section is complete." };
  }

  // Verified buyer: hold the change for FIEO; the verified details stay in use meanwhile.
  const change = parseChange(buyer.pendingChange);
  const next = { name: d.name, country: d.country, pocName: d.pocName!, pocDesignation: d.pocDesignation!, pocEmail: d.pocEmail!, pocMobile: d.pocMobile! };
  const current = Object.fromEntries(BASIC_KEYS.map((k) => [k, buyer[k] ?? ""])) as BasicFields;
  change.basic = BASIC_KEYS.some((k) => (current[k] ?? "") !== next[k]) ? next : undefined;
  const sent = await saveChange(buyer.id, user.id, change, files.length ? "Basic details and documents" : "Basic details");
  revalidatePath("/buyer", "layout");
  revalidatePath("/fieo", "layout");
  if (!sent) return { error: "Nothing has changed — the details are the same as the verified ones." };
  return { ok: true, message: "Change sent to FIEO for verification. Your verified details stay in use until FIEO verifies the change." };
}

/** Buyer withdraws a change that FIEO has not verified yet. */
export async function withdrawChangeAction(): Promise<FormState> {
  const { buyer } = await requireBuyer();
  if (!buyer.changeState) return { error: "There is no change to withdraw." };
  const docs = await prisma.document.findMany({ where: { buyerId: buyer.id, pending: true } });
  await prisma.$transaction([
    prisma.document.deleteMany({ where: { buyerId: buyer.id, pending: true } }),
    prisma.buyer.update({ where: { id: buyer.id }, data: { pendingChange: null, changeState: null, changeAt: null } }),
  ]);
  for (const d of docs) await deleteUpload(d.storedName);
  revalidatePath("/buyer", "layout");
  revalidatePath("/fieo", "layout");
  return { ok: true, message: "Change withdrawn. Your verified details are unchanged." };
}

// ---------------------------------------------------------------- sourcing profile

const profileSchema = z.object({
  organisationType: opt(80, "Organisation type"),
  annualSourcingValue: opt(80, "Annual sourcing value"),
  sourcingTimeline: opt(80, "Sourcing timeline"),
  preferredEngagement: opt(120, "Preferred engagement"),
});
const PROFILE_KEYS = ["organisationType", "annualSourcingValue", "sourcingTimeline", "preferredEngagement"] as const;

/** What is still missing from the sourcing profile before a sector can be submitted. */
function profileGaps(req: { organisationType: string | null; annualSourcingValue: string | null; sourcingTimeline: string | null } | null) {
  const gaps: string[] = [];
  if (!req?.organisationType) gaps.push("organisation type");
  if (!req?.annualSourcingValue) gaps.push("annual sourcing value");
  if (!req?.sourcingTimeline) gaps.push("sourcing timeline");
  return gaps;
}

export async function saveProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const { user, buyer } = await requireBuyer();
  const parsed = profileSchema.safeParse(Object.fromEntries(PROFILE_KEYS.map((k) => [k, String(form.get(k) ?? "")])));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: "Please correct the highlighted fields." };
  const req = await prisma.requirement.findUnique({ where: { buyerId: buyer.id } });
  // A verified buyer whose profile was never completed (earlier registrations) completes it directly.
  const direct = canEditApplication(buyer.status) || (canRequestChange(buyer.status) && profileGaps(req).length > 0);
  if (!direct && !canRequestChange(buyer.status)) return { error: LOCKED };

  if (direct) {
    await prisma.requirement.upsert({ where: { buyerId: buyer.id }, create: { buyerId: buyer.id, ...parsed.data }, update: parsed.data });
    revalidatePath("/buyer", "layout");
    const gaps = profileGaps(parsed.data);
    return { ok: true, message: gaps.length ? `Saved. Still needed: ${gaps.join(", ")}.` : "Sourcing profile saved." };
  }

  const gaps = profileGaps(parsed.data);
  if (gaps.length) return { error: `Please complete the sourcing profile (missing: ${gaps.join(", ")}).` };
  const change = parseChange(buyer.pendingChange);
  const current = Object.fromEntries(PROFILE_KEYS.map((k) => [k, req?.[k] ?? null])) as ProfileFields;
  change.profile = PROFILE_KEYS.some((k) => (current[k] ?? "") !== (parsed.data[k] ?? "")) ? parsed.data : undefined;
  const sent = await saveChange(buyer.id, user.id, change, "Sourcing profile");
  revalidatePath("/buyer", "layout");
  revalidatePath("/fieo", "layout");
  if (!sent) return { error: "Nothing has changed — the sourcing profile is the same as the verified one." };
  return { ok: true, message: "Change sent to FIEO for verification. Your verified sourcing profile stays in use until FIEO verifies the change." };
}

// ---------------------------------------------------------------- submit the application

/** Submits the whole application — basic details, documents, sourcing profile and every sector — to FIEO in one step. */
export async function submitApplicationAction(): Promise<FormState> {
  const { user, buyer } = await requireBuyer();
  if (!canEditApplication(buyer.status)) return { error: "Your application has already been submitted." };
  const [docs, req] = await Promise.all([
    prisma.document.findMany({ where: { buyerId: buyer.id, pending: false }, select: { kind: true } }),
    prisma.requirement.findUnique({ where: { buyerId: buyer.id }, include: { items: { include: { sector: true } } } }),
  ]);
  const missing: string[] = [];
  if (!basicFull.safeParse(Object.fromEntries(BASIC_KEYS.map((k) => [k, buyer[k] ?? ""]))).success) missing.push("basic details (point of contact)");
  if (!docs.some((d) => d.kind === "PROFILE")) missing.push("company profile document");
  if (!docs.some((d) => d.kind === "CREDENTIALS")) missing.push("organisation credentials document");
  const gaps = profileGaps(req);
  if (gaps.length) missing.push(`sourcing profile (${gaps.join(", ")})`);
  if (!req?.items.length) missing.push("at least one sector requirement");
  if (missing.length) return { error: `Please complete before submitting: ${missing.join("; ")}.` };

  const now = new Date();
  const toSubmit = req!.items.filter((i) => ITEM_TO_SUBMIT.includes(i.status));
  await prisma.$transaction(async (tx) => {
    const moved = await tx.buyer.updateMany({ where: { id: buyer.id, status: buyer.status }, data: { status: "BASIC_SUBMITTED", basicSubmittedAt: now } });
    if (moved.count !== 1) return;
    await tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: "BUYER", action: "BASIC_SUBMITTED" } });
    for (const it of toSubmit) {
      await tx.requirementItem.update({ where: { id: it.id }, data: { status: "SUBMITTED", submittedAt: now } });
      await tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: "BUYER", action: "REQ_SUBMITTED", itemId: it.id, sectorName: it.sector.name } });
    }
  });
  revalidatePath("/buyer", "layout");
  revalidatePath("/fieo", "layout");
  return { ok: true, message: `Application submitted to FIEO with ${req!.items.length} sector${req!.items.length > 1 ? "s" : ""}. You will be notified by e-mail.` };
}

// ---------------------------------------------------------------- sector requirements

const itemSchema = z.object({
  sectorId: z.string().min(1, "Select a sector."),
  products: englishText({ min: 2, max: 1000, label: "Products", multiline: true }),
  specifications: englishText({ max: 2000, label: "Specifications", multiline: true }),
  certifications: z.array(englishText({ min: 1, max: 120, label: "Certification" })).max(40),
  quantity: englishText({ max: 200, label: "Quantity" }),
});

const sameContent = (
  a: { sectorId: string; products: string; specifications: string | null; certifications: string; quantity: string | null },
  b: z.infer<typeof itemSchema>,
) =>
  a.sectorId === b.sectorId && a.products === b.products && (a.specifications ?? "") === b.specifications &&
  (a.quantity ?? "") === b.quantity && JSON.stringify([...parseCerts(a.certifications)].sort()) === JSON.stringify([...new Set(b.certifications)].sort());

export async function saveItemAction(_: FormState, form: FormData): Promise<FormState> {
  const { user, buyer } = await requireBuyer();
  if (buyer.status === "BASIC_SUBMITTED") return { error: LOCKED };
  // Before the application is submitted, sectors are saved with it and submitted together.
  const intent = form.get("intent") === "submit" && canSubmitItems(buyer.status) ? "submit" : "save";
  const itemId = String(form.get("itemId") ?? "") || null;

  let certifications: unknown = [];
  try { certifications = JSON.parse(String(form.get("certifications") ?? "[]")); } catch { /* validated below */ }
  const parsed = itemSchema.safeParse({
    sectorId: String(form.get("sectorId") ?? ""),
    products: String(form.get("products") ?? ""),
    specifications: String(form.get("specifications") ?? ""),
    quantity: String(form.get("quantity") ?? ""),
    certifications,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: "Please correct the highlighted fields." };
  const d = parsed.data;

  const req = await prisma.requirement.upsert({ where: { buyerId: buyer.id }, create: { buyerId: buyer.id }, update: {}, include: { items: true } });
  const existing = itemId ? req.items.find((i) => i.id === itemId) : null;
  if (itemId && !existing) return { error: "This requirement no longer exists. Refresh the page." };
  if (existing && !ITEM_EDITABLE.includes(existing.status)) return { error: "This sector is with a reviewer and cannot be changed now." };
  if (req.items.some((i) => i.sectorId === d.sectorId && i.id !== itemId)) {
    return { fieldErrors: { sectorId: "You already have a requirement for this sector — edit that one instead." } };
  }
  const sector = await prisma.sector.findUnique({ where: { id: d.sectorId } });
  if (!sector || (!sector.isActive && existing?.sectorId !== d.sectorId)) return { fieldErrors: { sectorId: "Select a sector from the list." } };
  if (intent === "submit") {
    const gaps = profileGaps(req);
    if (gaps.length) return { error: `Complete your sourcing profile first (missing: ${gaps.join(", ")}).` };
  }

  const unchanged = existing && sameContent(existing, d);
  if (existing?.status === "APPROVED" && unchanged) {
    return { error: "No changes made — this sector is already approved." };
  }

  const content = {
    sectorId: d.sectorId,
    products: d.products,
    specifications: d.specifications || null,
    certifications: JSON.stringify([...new Set(d.certifications)]),
    quantity: d.quantity || null,
  };
  const now = new Date();
  const submit = intent === "submit";

  await prisma.$transaction(async (tx) => {
    const reopened = existing?.status === "APPROVED";
    const status = submit ? "SUBMITTED" : existing?.status === "FIEO_RETURNED" || existing?.status === "FIEO_REJECTED" ? existing.status : "DRAFT";
    const item = existing
      ? await tx.requirementItem.update({
          where: { id: existing.id },
          data: { ...content, status, ...(submit ? { submittedAt: now } : {}), ...(reopened ? { everApproved: true, approvedAt: null } : {}) },
        })
      : await tx.requirementItem.create({
          data: { requirementId: req.id, ...content, status, sortOrder: req.items.length, ...(submit ? { submittedAt: now } : {}) },
        });
    const log = (action: "REQ_MODIFIED" | "REQ_SUBMITTED") =>
      tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: "BUYER", action, itemId: item.id, sectorName: sector.name } });
    if (reopened) await log("REQ_MODIFIED");
    if (submit) await log("REQ_SUBMITTED");
  });

  revalidatePath("/buyer", "layout");
  return {
    ok: true,
    message: submit
      ? `${sector.name}: submitted to FIEO for verification.`
      : existing?.status === "APPROVED"
        ? `${sector.name}: changes saved as a draft. Submit it to send the changes for approval.`
        : canSubmitItems(buyer.status) ? `${sector.name}: draft saved.` : `${sector.name}: saved. It will go to FIEO with your application.`,
  };
}

/** Submits every draft / returned / rejected sector in one go (after the application has been submitted). */
export async function submitAllAction(): Promise<FormState> {
  const { user, buyer } = await requireBuyer();
  if (!canSubmitItems(buyer.status)) return { error: "Submit your application first — the sectors go with it." };
  const req = await prisma.requirement.findUnique({
    where: { buyerId: buyer.id },
    include: { items: { where: { status: { in: ITEM_TO_SUBMIT } }, include: { sector: true } } },
  });
  if (!req?.items.length) return { error: "There are no draft, returned or rejected sectors to submit." };
  const gaps = profileGaps(req);
  if (gaps.length) return { error: `Complete your sourcing profile first (missing: ${gaps.join(", ")}).` };
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const it of req.items) {
      await tx.requirementItem.update({ where: { id: it.id }, data: { status: "SUBMITTED", submittedAt: now } });
      await tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: "BUYER", action: "REQ_SUBMITTED", itemId: it.id, sectorName: it.sector.name } });
    }
  });
  revalidatePath("/buyer", "layout");
  return { ok: true, message: `${req.items.length} sector${req.items.length > 1 ? "s" : ""} submitted to FIEO: ${req.items.map((i) => i.sector.name).join(", ")}.` };
}

export async function removeItemAction(_: FormState, form: FormData): Promise<FormState> {
  const { user, buyer } = await requireBuyer();
  if (buyer.status === "BASIC_SUBMITTED") return { error: LOCKED };
  const item = await prisma.requirementItem.findFirst({
    where: { id: String(form.get("itemId") ?? ""), requirement: { buyerId: buyer.id } },
    include: { sector: true },
  });
  if (!item) return { error: "This requirement no longer exists." };
  if (!ITEM_EDITABLE.includes(item.status)) return { error: "This sector is with a reviewer and cannot be removed now." };
  await prisma.$transaction(async (tx) => {
    // Only record removals of sectors a reviewer has seen; plain drafts vanish quietly.
    if (item.status !== "DRAFT" || item.everApproved || item.submittedAt) {
      await tx.reviewLog.create({ data: { buyerId: buyer.id, actorId: user.id, actorRole: "BUYER", action: "REQ_WITHDRAWN", sectorName: item.sector.name } });
    }
    await tx.requirementItem.delete({ where: { id: item.id } });
  });
  revalidatePath("/buyer", "layout");
  return { ok: true, message: `${item.sector.name} removed.` };
}
