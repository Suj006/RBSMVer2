import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SellerSource } from "@/generated/prisma/enums";
import { sellerRegNo } from "@/lib/config";
import { nextSeq } from "@/lib/sequence";
import type { SellerData } from "@/lib/seller-schema";

/** Creates a seller record (status WITH_TALUK) with its sector products and a log entry. */
export async function createSeller(
  tx: Prisma.TransactionClient, d: SellerData, source: SellerSource, actor: { id: string; role: "DISTRICT" } | null,
) {
  const seq = await nextSeq(tx, "seller");
  const { products, ...rest } = d;
  const seller = await tx.seller.create({
    data: {
      ...rest, seq, regNo: sellerRegNo(seq), source, createdById: actor?.id ?? null,
      products: { create: products.map((p, i) => ({ sectorId: p.sectorId, products: p.products, sortOrder: i })) },
    },
  });
  await tx.sellerLog.create({
    data: {
      sellerId: seller.id, actorId: actor?.id ?? null, actorRole: actor?.role ?? null, action: "REGISTERED",
      comment: source === "SELF" ? "Self-registered on the portal" : source === "BULK" ? "Added by bulk upload" : null,
    },
  });
  return seller;
}
