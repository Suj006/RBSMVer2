import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { sellerUsername } from "@/lib/config";

/**
 * The seller's login (Tradex2027-S + registration sequence). Created when missing, with the
 * default password to be changed at first sign-in; an existing login keeps its password.
 * It is a temporary login (application status, corrections, awareness session) until the
 * Directorate's final approval, when the same login becomes the permanent one.
 * `created` is true while the initial password is still in force (it is then e-mailed again).
 */
export async function ensureSellerLogin(tx: Prisma.TransactionClient, s: { id: string; seq: number; name: string; userId: string | null }, passwordHash: string) {
  if (s.userId) {
    const u = await tx.user.update({ where: { id: s.userId }, data: { displayName: s.name, isActive: true } });
    return { id: u.id, username: u.username, created: u.mustChangePassword };
  }
  const username = sellerUsername(s.seq);
  const u = await tx.user.upsert({
    where: { username },
    create: { username, passwordHash, role: "SELLER", displayName: s.name, mustChangePassword: true },
    update: { passwordHash, role: "SELLER", displayName: s.name, mustChangePassword: true, isActive: true },
  });
  await tx.seller.update({ where: { id: s.id }, data: { userId: u.id } });
  return { id: u.id, username, created: true };
}
