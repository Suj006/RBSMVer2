"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { mailTemplates, sendMail } from "@/lib/mail";
import { nextSeq } from "@/lib/sequence";
import { approvedBuyerNo, EVENT } from "@/lib/config";
import { DIC_ITEM_QUEUE, FIEO_ITEM_QUEUE } from "@/lib/status";
import type { ItemStatus, ReviewAction } from "@/generated/prisma/enums";
import type { FormState } from "./auth";
import { englishText } from "@/lib/text";
import { itemSnapshot, profileSnapshot } from "@/lib/item-snapshot";
import { parseChange } from "@/lib/buyer-change";
import { deleteUpload } from "@/lib/storage";

const commentField = englishText({ max: 2000, label: "Comment", multiline: true });

const revalidateAll = () => {
  revalidatePath("/fieo", "layout");
  revalidatePath("/dic", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/buyer", "layout");
};

// ---------------------------------------------------------------- changes to verified details (FIEO)

/** FIEO verifies (or returns) a change an approved / verified buyer asked for in basic details, documents or sourcing profile. */
export async function changeReviewAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("FIEO");
  const decision = String(form.get("decision"));
  if (decision !== "approve_change" && decision !== "return_change") return { error: "Unknown action." };
  const parsed = commentField.safeParse(String(form.get("comment") ?? ""));
  if (!parsed.success) return { fieldErrors: { comment: parsed.error.issues[0].message } };
  const comment = parsed.data || null;
  if (decision === "return_change" && (!comment || comment.length < 5)) {
    return { fieldErrors: { comment: "A comment (at least 5 characters) is required when returning." } };
  }
  const buyerId = String(form.get("buyerId") ?? "");
  const approve = decision === "approve_change";
  const dropFiles: string[] = [];
  const buyer = await prisma.$transaction(async (tx) => {
    const b = await tx.buyer.findUnique({ where: { id: buyerId } });
    if (!b || b.changeState !== "SUBMITTED") return null;
    const change = parseChange(b.pendingChange);
    if (approve) {
      if (change.basic) await tx.buyer.update({ where: { id: buyerId }, data: change.basic });
      if (change.basic?.name) await tx.user.update({ where: { id: b.userId }, data: { displayName: change.basic.name } });
      if (change.profile) {
        const req = await tx.requirement.upsert({ where: { buyerId }, create: { buyerId, ...change.profile }, update: change.profile });
        await tx.requirement.update({ where: { id: req.id }, data: { approvedProfile: profileSnapshot(req) } });
      }
      // New documents replace the verified ones.
      for (const d of await tx.document.findMany({ where: { buyerId, pending: true } })) {
        const old = await tx.document.findUnique({ where: { buyerId_kind_pending: { buyerId, kind: d.kind, pending: false } } });
        if (old) { dropFiles.push(old.storedName); await tx.document.delete({ where: { id: old.id } }); }
        await tx.document.update({ where: { id: d.id }, data: { pending: false } });
      }
      await tx.buyer.update({ where: { id: buyerId }, data: { pendingChange: null, changeState: null, changeAt: null } });
    } else {
      // Back to the buyer: the requested change (and its documents) is kept so they can correct it.
      await tx.buyer.update({ where: { id: buyerId }, data: { pendingChange: JSON.stringify({ ...change, comment }), changeState: "RETURNED" } });
    }
    await tx.reviewLog.create({ data: { buyerId, actorId: user.id, actorRole: "FIEO", action: approve ? "CHANGE_APPROVED" : "CHANGE_RETURNED", comment } });
    return tx.buyer.findUnique({ where: { id: buyerId } });
  });
  if (!buyer) return { error: "This change has already been acted on. Refresh the page." };
  for (const f of dropFiles) await deleteUpload(f);
  const mail = approve ? mailTemplates.changeVerified(buyer.name) : mailTemplates.changeReturned(buyer.name, comment!);
  await sendMail(buyer.pocEmail ?? buyer.signupEmail, mail.subject, mail.text);
  revalidateAll();
  return { ok: true, message: approve ? "Change verified. The buyer's updated details are now in use." : "Change returned to the buyer with your comment. The verified details are unchanged." };
}

// ---------------------------------------------------------------- sector requirements (FIEO / DIC)

type Decision = "recommend" | "return" | "reject" | "approve";

const RULES = {
  FIEO: {
    from: FIEO_ITEM_QUEUE,
    recommend: { to: "FIEO_RECOMMENDED" as ItemStatus, log: "FIEO_RECOMMENDED" as ReviewAction },
    return: { to: "FIEO_RETURNED" as ItemStatus, log: "REQ_RETURNED" as ReviewAction },
    reject: { to: "FIEO_REJECTED" as ItemStatus, log: "REQ_REJECTED" as ReviewAction },
  },
  DIC: {
    from: DIC_ITEM_QUEUE,
    approve: { to: "APPROVED" as ItemStatus, log: "DIC_APPROVED" as ReviewAction },
    return: { to: "DIC_RETURNED" as ItemStatus, log: "DIC_RETURNED" as ReviewAction },
  },
};

/**
 * One submission can carry a different decision for every sector, e.g. FIEO
 * approves "Tea & Coffee", returns "Spices" and rejects "Furniture" in the same step.
 * FIEO's first review of a submitted application also verifies the basic details,
 * with an optional comment for the buyer (basicComment).
 * Form fields: buyerId, itemIds (repeated), decision_<id>, comment_<id>, basicComment.
 */
export async function itemReviewAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(["FIEO", "DIC"]);
  const role = user.role as "FIEO" | "DIC";
  const rules = RULES[role];
  const buyerId = String(form.get("buyerId") ?? "");
  const ids = form.getAll("itemIds").map(String);

  const decisions: { id: string; decision: Decision; comment: string | null }[] = [];
  const fieldErrors: Record<string, string> = {};
  for (const id of ids) {
    const decision = String(form.get(`decision_${id}`) ?? "") as Decision | "";
    if (!decision) continue;
    if (!(decision in rules)) return { error: "Unknown decision." };
    const parsed = commentField.safeParse(String(form.get(`comment_${id}`) ?? ""));
    if (!parsed.success) { fieldErrors[`comment_${id}`] = parsed.error.issues[0].message; continue; }
    const comment = parsed.data || null;
    if ((decision === "return" || decision === "reject") && (!comment || comment.length < 5)) {
      fieldErrors[`comment_${id}`] = `A comment (at least 5 characters) is required when ${decision === "reject" ? "rejecting" : "returning"}.`;
      continue;
    }
    decisions.push({ id, decision, comment });
  }
  const basic = commentField.safeParse(String(form.get("basicComment") ?? ""));
  if (!basic.success) fieldErrors.basicComment = basic.error.issues[0].message;
  const basicComment = basic.success ? basic.data || null : null;
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Please add the missing comments." };
  const verifyBasic = role === "FIEO" && (await prisma.buyer.count({ where: { id: buyerId, status: "BASIC_SUBMITTED" } })) === 1;
  if (!decisions.length && !verifyBasic) return { error: "Choose a decision for at least one sector." };

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) return null;
    const items = await tx.requirementItem.findMany({
      where: { id: { in: decisions.map((d) => d.id) }, requirement: { buyerId } },
      include: { sector: true },
    });
    const done: { sector: string; decision: Decision; comment: string | null }[] = [];
    for (const d of decisions) {
      const item = items.find((i) => i.id === d.id);
      if (!item || !rules.from.includes(item.status)) continue; // already acted on by someone else
      const rule = (rules as unknown as Record<Decision, { to: ItemStatus; log: ReviewAction }>)[d.decision];
      const snap = itemSnapshot(item, item.sector.name);
      const moved = await tx.requirementItem.updateMany({
        where: { id: item.id, status: item.status },
        data: {
          status: rule.to,
          ...(rule.to === "FIEO_RECOMMENDED" ? { recommendedAt: now } : {}),
          // Keep what was approved / returned so later changes can be highlighted for reviewers.
          ...(rule.to === "APPROVED" ? { approvedAt: now, everApproved: true, approvedSnapshot: snap, returnedSnapshot: null } : {}),
          ...(rule.to === "FIEO_RETURNED" || rule.to === "FIEO_REJECTED" ? { returnedSnapshot: snap } : {}),
        },
      });
      if (moved.count !== 1) continue;
      await tx.reviewLog.create({
        data: { buyerId, actorId: user.id, actorRole: role, action: rule.log, comment: d.comment, itemId: item.id, sectorName: item.sector.name },
      });
      done.push({ sector: item.sector.name, decision: d.decision, comment: d.comment });
    }

    // FIEO's first review of the application verifies the basic details (with an optional comment for the buyer).
    let basicVerified = false;
    if (verifyBasic) {
      const moved = await tx.buyer.updateMany({ where: { id: buyerId, status: "BASIC_SUBMITTED" }, data: { status: "BASIC_APPROVED", basicApprovedAt: now } });
      if (moved.count === 1) {
        basicVerified = true;
        buyer.status = "BASIC_APPROVED";
        await tx.reviewLog.create({ data: { buyerId, actorId: user.id, actorRole: "FIEO", action: "BASIC_APPROVED", comment: basicComment } });
      }
    }

    if (done.some((d) => d.decision === "approve")) {
      const req = await tx.requirement.findUnique({ where: { buyerId } });
      if (req) await tx.requirement.update({ where: { id: req.id }, data: { approvedProfile: profileSnapshot(req) } });
    }

    // First approved sector makes the buyer an approved RBSM buyer.
    let newlyApproved = false;
    if (done.some((d) => d.decision === "approve") && buyer.status !== "APPROVED") {
      const seq = buyer.approvedSeq ?? (await nextSeq(tx, `approved-${EVENT.approvedYear}`));
      const updated = await tx.buyer.update({
        where: { id: buyerId },
        data: { status: "APPROVED", approvedSeq: seq, approvedNo: buyer.approvedNo ?? approvedBuyerNo(seq), approvedAt: buyer.approvedAt ?? now },
      });
      buyer.approvedNo = updated.approvedNo;
      newlyApproved = true;
    }
    return { buyer, done, newlyApproved, basicVerified };
  });

  if (!result) return { error: "Buyer not found." };
  const { buyer, done, newlyApproved, basicVerified } = result;
  if (!done.length && !basicVerified) return { error: "These sectors have already been acted on. Refresh the page." };

  // E-mail the buyer about returns (FIEO) and approvals (DIC); hand-offs between reviewers are internal.
  const to = buyer.pocEmail ?? buyer.signupEmail;
  const returned = done.filter((d) => d.decision === "return");
  const rejected = done.filter((d) => d.decision === "reject");
  const approved = done.filter((d) => d.decision === "approve");
  if (role === "FIEO" && (returned.length || rejected.length || (basicVerified && basicComment))) {
    const m = mailTemplates.fieoReview(buyer.name, {
      returned: returned.map((r) => ({ sector: r.sector, comment: r.comment! })),
      rejected: rejected.map((r) => ({ sector: r.sector, comment: r.comment! })),
      basicComment: basicVerified ? basicComment : null,
    });
    await sendMail(to, m.subject, m.text);
  }
  if (approved.length) {
    // A buyer added by FIEO had a temporary login: on the first approval it becomes the permanent login.
    const login = newlyApproved && buyer.source !== "SELF" ? (await prisma.user.findFirst({ where: { buyer: { id: buyer.id } }, select: { username: true } }))?.username : undefined;
    const m = mailTemplates.sectorsApproved(buyer.name, buyer.approvedNo!, approved.map((a) => a.sector), newlyApproved, login);
    await sendMail(to, m.subject, m.text);
  }

  revalidateAll();
  const verb: Record<Decision, string> = {
    recommend: "approved and sent to the Directorate",
    approve: "approved",
    return: role === "FIEO" ? "returned to the buyer" : "returned to FIEO",
    reject: "rejected",
  };
  const summary = (["recommend", "approve", "return", "reject"] as Decision[])
    .map((k) => {
      const names = done.filter((d) => d.decision === k).map((d) => d.sector);
      return names.length ? `${names.join(", ")} ${verb[k]}` : null;
    })
    .filter(Boolean)
    .join("; ");
  return {
    ok: true,
    message: `${basicVerified ? "Basic details verified" + (summary ? ". " : ".") : ""}${summary ? summary + "." : ""}${newlyApproved ? ` ${buyer.name} is now an approved RBSM buyer (${buyer.approvedNo}).` : ""}`,
  };
}
