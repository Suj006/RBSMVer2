"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { sendMail, sellerMail } from "@/lib/mail";
import { nextSeq } from "@/lib/sequence";
import { DISTRICT_NAMES } from "@/lib/config";
import { isDay, isTime } from "@/lib/event";
import { englishText, firstErrors } from "@/lib/text";
import { sellerScope } from "@/lib/seller-query";
import { batchForMail, batchName } from "@/lib/training";
import type { Attendance } from "@/generated/prisma/enums";
import type { FormState } from "./auth";

const revalidateAll = () => {
  for (const p of ["/admin", "/dic", "/district", "/taluk", "/training", "/seller"]) revalidatePath(p, "layout");
};

const batchSchema = z.object({
  date: z.string().refine(isDay, "Enter the date."),
  startTime: z.string().refine(isTime, "Enter the start time."),
  endTime: z.string().refine(isTime, "Enter the end time."),
  venue: englishText({ min: 3, max: 300, label: "Venue" }),
  district: z.string().refine((d) => d === "" || DISTRICT_NAMES.includes(d), "Select a district from the list.").transform((d) => d || null),
}).refine((b) => b.startTime < b.endTime, { path: ["endTime"], message: "The end time must be after the start time." });

/** Admin creates or edits an awareness session. Sellers already placed in it are told about changes. */
export async function saveBatchAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("ADMIN");
  const id = String(form.get("id") ?? "") || null;
  const raw = Object.fromEntries(["date", "startTime", "endTime", "venue", "district"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = batchSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error, true), error: "Please correct the highlighted fields.", data: raw };
  const d = parsed.data;
  if (!id) {
    const b = await prisma.$transaction(async (tx) => {
      const seq = await nextSeq(tx, "training-batch");
      return tx.trainingBatch.create({ data: { ...d, seq, name: batchName(seq, d.district, d.date), createdById: user.id } });
    });
    revalidateAll();
    redirect(`/admin/batches/${b.id}?done=created`);
  }
  const old = await prisma.trainingBatch.findUnique({ where: { id } });
  if (!old) return { error: "This session no longer exists." };
  if (d.district && d.district !== old.district) {
    const others = await prisma.batchMember.count({ where: { batchId: id, seller: { district: { not: d.district } } } });
    if (others) return { fieldErrors: { district: `${others} seller${others > 1 ? "s" : ""} from other districts are in this session — move them first.` }, data: raw };
  }
  const b = await prisma.trainingBatch.update({ where: { id }, data: { ...d, name: batchName(old.seq, d.district, d.date) } });
  // Tell the sellers still to attend if the date, time or venue changed.
  if (old.date !== b.date || old.startTime !== b.startTime || old.endTime !== b.endTime || old.venue !== b.venue) {
    const members = await prisma.batchMember.findMany({ where: { batchId: id, attendance: "PENDING" }, include: { seller: true } });
    for (const m of members) {
      const mail = sellerMail.batch(m.seller.name, m.seller.regNo, batchForMail(b), true);
      await sendMail(m.seller.contactEmail, mail.subject, mail.text);
    }
  }
  revalidateAll();
  return { ok: true, message: "Session updated." };
}

/** Admin deletes a session nobody's attendance has been marked in; its sellers go back to "awaiting a session". */
export async function deleteBatchAction(_: FormState, form: FormData): Promise<FormState> {
  await requireUser("ADMIN");
  const id = String(form.get("id") ?? "");
  const marked = await prisma.batchMember.count({ where: { batchId: id, attendance: { not: "PENDING" } } });
  if (marked) return { error: "Attendance has been marked in this session, so it cannot be deleted." };
  await prisma.trainingBatch.delete({ where: { id } }).catch(() => null);
  revalidateAll();
  redirect("/admin/batches?done=deleted");
}

/**
 * Admin, the Directorate or a district office places initially approved sellers in a session (a district
 * office its own sellers only). A seller already waiting for another session is moved. Sellers are e-mailed.
 */
export async function assignBatchAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["ADMIN", "DIC", "DISTRICT"]);
  const batch = await prisma.trainingBatch.findUnique({ where: { id: String(form.get("batchId") ?? "") } });
  if (!batch) return { error: "Choose a session." };
  const ids = [...new Set(form.getAll("sellerIds").map(String).filter(Boolean))];
  if (!ids.length) return { error: "Select at least one seller." };
  const sellers = await prisma.seller.findMany({
    where: { AND: [{ id: { in: ids }, status: "INITIAL_APPROVED" }, sellerScope(user), batch.district ? { district: batch.district } : {}] },
    include: { batches: { where: { attendance: "PENDING" } } },
  });
  if (!sellers.length) return { error: batch.district ? `Only initially approved sellers of ${batch.district} can be placed in this session.` : "These sellers cannot be placed in a session now." };
  const placed: { s: (typeof sellers)[number]; moved: boolean }[] = [];
  for (const s of sellers) {
    const pending = s.batches[0];
    if (pending?.batchId === batch.id) continue;
    await prisma.$transaction(async (tx) => {
      // Absent from this session before: a second place in the same session reopens it.
      const again = await tx.batchMember.findUnique({ where: { batchId_sellerId: { batchId: batch.id, sellerId: s.id } } });
      if (pending) await tx.batchMember.delete({ where: { id: pending.id } });
      if (again) await tx.batchMember.update({ where: { id: again.id }, data: { attendance: "PENDING", markedAt: null, markedById: null, assignedById: user.id, assignedAt: new Date() } });
      else await tx.batchMember.create({ data: { batchId: batch.id, sellerId: s.id, assignedById: user.id } });
      await tx.sellerLog.create({ data: { sellerId: s.id, actorId: user.id, actorRole: user.role, action: "BATCH_ASSIGNED", comment: `${pending ? "Moved to" : "Placed in"} ${batch.name}` } });
    });
    placed.push({ s, moved: !!pending });
  }
  for (const { s, moved } of placed) {
    const mail = sellerMail.batch(s.name, s.regNo, batchForMail(batch), moved);
    await sendMail(s.contactEmail, mail.subject, mail.text);
  }
  revalidateAll();
  const moved = placed.filter((p) => p.moved).length;
  return { ok: true, message: `${placed.length} seller${placed.length === 1 ? "" : "s"} placed in ${batch.name}${moved ? ` (${moved} moved from another session)` : ""} and informed by e-mail.` };
}

/** Takes a seller out of a session they have not attended yet. */
export async function removeFromBatchAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["ADMIN", "DIC", "DISTRICT"]);
  const m = await prisma.batchMember.findFirst({ where: { id: String(form.get("memberId") ?? ""), attendance: "PENDING", seller: sellerScope(user) }, include: { batch: true } });
  if (!m) return { error: "This seller can no longer be removed (attendance marked or already removed)." };
  await prisma.$transaction([
    prisma.batchMember.delete({ where: { id: m.id } }),
    prisma.sellerLog.create({ data: { sellerId: m.sellerId, actorId: user.id, actorRole: user.role, action: "BATCH_ASSIGNED", comment: `Removed from ${m.batch.name}` } }),
  ]);
  revalidateAll();
  return { ok: true, message: "Removed from the session." };
}

/**
 * Training admin marks attendance (fields att_<memberId> = PRESENT / ABSENT / PENDING).
 * Present: the seller goes to the Directorate for final approval. Absent: the seller can be placed in another
 * session, or given final approval by the Directorate case by case.
 */
export async function markAttendanceAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("TRAINING");
  const batchId = String(form.get("batchId") ?? "");
  const members = await prisma.batchMember.findMany({ where: { batchId }, include: { seller: true } });
  const now = new Date();
  let present = 0, absent = 0;
  for (const m of members) {
    const v = String(form.get(`att_${m.id}`) ?? "") as Attendance;
    if (!["PRESENT", "ABSENT", "PENDING"].includes(v) || v === m.attendance) continue;
    // Once finally approved or rejected, the record stays as it is.
    if (m.seller.status !== "INITIAL_APPROVED" && m.seller.status !== "TRAINED") continue;
    // A seller already placed in a later session keeps that place; this mark is then not changed.
    if (v === "PENDING" && (await prisma.batchMember.count({ where: { sellerId: m.sellerId, attendance: "PENDING", id: { not: m.id } } }))) continue;
    await prisma.$transaction(async (tx) => {
      await tx.batchMember.update({ where: { id: m.id }, data: { attendance: v, markedAt: v === "PENDING" ? null : now, markedById: v === "PENDING" ? null : user.id } });
      if (v === "PRESENT") {
        await tx.seller.update({ where: { id: m.sellerId }, data: { status: "TRAINED", trainedAt: now } });
        await tx.sellerLog.create({ data: { sellerId: m.sellerId, actorId: user.id, actorRole: "TRAINING", action: "ATTENDED" } });
      } else {
        // Absent (or reset): back to the awareness-session stage.
        if (m.seller.status === "TRAINED") await tx.seller.update({ where: { id: m.sellerId }, data: { status: "INITIAL_APPROVED", trainedAt: null } });
        if (v === "ABSENT") await tx.sellerLog.create({ data: { sellerId: m.sellerId, actorId: user.id, actorRole: "TRAINING", action: "ABSENT" } });
      }
    });
    if (v === "PRESENT") present++; else if (v === "ABSENT") absent++;
  }
  revalidateAll();
  if (!present && !absent) return { ok: true, message: "Attendance saved." };
  return { ok: true, message: `Attendance saved: ${present} present${present ? " (now with the Directorate for final approval)" : ""}, ${absent} absent.` };
}
