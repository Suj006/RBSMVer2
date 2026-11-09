import type { Prisma } from "@/generated/prisma/client";
import type { BuyerStatus, ItemStatus, Role } from "@/generated/prisma/enums";
import { ALL_ITEM_STATUSES, ALL_STATUSES, DIC_ITEM_QUEUE, FIEO_ITEM_QUEUE } from "@/lib/status";

export type BuyerFilters = { q?: string; status?: string; item?: string; country?: string; sector?: string; source?: string; page?: string };

/**
 * Sector rows a staff role may see. FIEO, the Directorate (the central team) and Admin
 * all see every buyer and every sector, at every stage; decisions stay with each role's queue.
 */
export function itemScope(_role: Role): Prisma.RequirementItemWhereInput {
  return {};
}

/** Which buyers a staff role may see at all (all of them; see itemScope). */
export function scopeFor(_role: Role): Prisma.BuyerWhereInput {
  return {};
}

/** Buyers waiting for this role's decision (a submitted application, a requested change, or any sector). */
export function actionWhere(role: Role): Prisma.BuyerWhereInput {
  if (role === "DIC") return { requirement: { items: { some: { status: { in: DIC_ITEM_QUEUE } } } } };
  return {
    OR: [
      { status: "BASIC_SUBMITTED" },
      { changeState: "SUBMITTED" },
      { requirement: { items: { some: { status: { in: FIEO_ITEM_QUEUE } } } } },
    ],
  };
}

export function buyerWhere(role: Role, f: BuyerFilters): Prisma.BuyerWhereInput {
  const and: Prisma.BuyerWhereInput[] = [scopeFor(role)];
  const q = f.q?.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q } },
        { regNo: { contains: q } },
        { approvedNo: { contains: q } },
        { signupEmail: { contains: q } },
        { pocName: { contains: q } },
        { pocEmail: { contains: q } },
        { user: { username: { contains: q } } },
      ],
    });
  }
  if (f.status === "action") and.push(actionWhere(role));
  else if (f.status === "basic_approved") and.push({ status: { in: ["BASIC_APPROVED", "APPROVED"] } });
  else if (f.status === "basic_pending") and.push({ status: { in: ["SIGNED_UP", "BASIC_RETURNED"] } });
  else if (f.status && ALL_STATUSES.includes(f.status as BuyerStatus)) and.push({ status: f.status as BuyerStatus });

  const item: Prisma.RequirementItemWhereInput = { ...itemScope(role) };
  let filterItems = false;
  if (f.item && ALL_ITEM_STATUSES.includes(f.item as ItemStatus)) {
    item.status = f.item as ItemStatus;
    filterItems = true;
  }
  if (f.sector) {
    item.sectorId = f.sector;
    filterItems = true;
  }
  if (filterItems) and.push({ requirement: { items: { some: item } } });
  if (f.country) and.push({ country: f.country });
  if (f.source === "SELF" || f.source === "FIEO" || f.source === "BULK") and.push({ source: f.source });
  else if (f.source === "STAFF") and.push({ source: { in: ["FIEO", "BULK"] } });
  return { AND: and };
}

export const PAGE_SIZE = 25;
