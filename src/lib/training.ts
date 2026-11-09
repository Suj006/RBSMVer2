import "server-only";
import type { Prisma, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fmtDay } from "@/lib/event";
import { sellerScope } from "@/lib/seller-query";

/** "Batch 03 · Ernakulam · Tue, 12 Dec 2026" — generated from the batch number, district and date. */
export const batchName = (seq: number, district: string | null, date: string) =>
  `Batch ${String(seq).padStart(2, "0")} · ${district ?? "All districts"} · ${fmtDay(date)}`;

/** "10:00 AM – 1:00 PM" from HH:MM strings. */
export function fmtSlot(start: string, end: string) {
  const f = (t: string) => { const [h, m] = t.split(":").map(Number); return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  return `${f(start)} – ${f(end)}`;
}

export const batchForMail = (b: { name: string; date: string; startTime: string; endTime: string; venue: string }) =>
  ({ name: b.name, day: fmtDay(b.date), time: fmtSlot(b.startTime, b.endTime), venue: b.venue });

/** Who may place sellers in sessions: Admin and the Directorate (any seller), a district office (its own sellers). */
export const canAssign = (role: string) => role === "ADMIN" || role === "DIC" || role === "DISTRICT";

/** Batch members a user may see: a district office sees only its own sellers in a batch. */
export function memberScope(user: Pick<User, "role" | "district" | "taluk">): Prisma.BatchMemberWhereInput {
  return user.role === "DISTRICT" || user.role === "TALUK" ? { seller: sellerScope(user) } : {};
}

/** Initially approved sellers not yet placed in a session (or absent from an earlier one), within the user's scope. */
export function awaitingSession(user: Pick<User, "role" | "district" | "taluk">, district?: string | null): Prisma.SellerWhereInput {
  return { AND: [sellerScope(user), { status: "INITIAL_APPROVED", batches: { none: { attendance: "PENDING" } } }, district ? { district } : {}] };
}

/** Counts used on dashboards. */
export async function trainingCounts(user: Pick<User, "role" | "district" | "taluk">) {
  const scope = sellerScope(user);
  const [unassigned, scheduled, absent, trained, bypassed, batches] = await Promise.all([
    prisma.seller.count({ where: { AND: [scope, { status: "INITIAL_APPROVED", batches: { none: {} } }] } }),
    prisma.seller.count({ where: { AND: [scope, { status: "INITIAL_APPROVED", batches: { some: { attendance: "PENDING" } } }] } }),
    prisma.seller.count({ where: { AND: [scope, { status: "INITIAL_APPROVED", batches: { some: { attendance: "ABSENT" }, none: { attendance: "PENDING" } } }] } }),
    prisma.seller.count({ where: { AND: [scope, { trainedAt: { not: null } }] } }),
    prisma.seller.count({ where: { AND: [scope, { bypassed: true }] } }),
    prisma.trainingBatch.count(),
  ]);
  return { unassigned, scheduled, absent, trained, bypassed, batches };
}
