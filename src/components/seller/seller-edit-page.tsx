import { notFound } from "next/navigation";
import type { User } from "@/generated/prisma/client";
import { certificationNames } from "@/lib/masters";
import { prisma } from "@/lib/prisma";
import { sellerScope } from "@/lib/seller-query";
import { Alert, PageHeader } from "@/components/ui";
import { SellerForm } from "@/components/seller/seller-form";
import { SELLER_TALUK_EDITABLE } from "@/lib/status";
import { sellerFormValues } from "@/lib/seller-form-defaults";

/** District or taluk office: edit a seller while it is with the taluk office. */
export async function SellerEditPage({ user, id, base }: { user: User; id: string; base: string }) {
  const s = await prisma.seller.findFirst({ where: { AND: [{ id }, sellerScope(user)] }, include: { products: { orderBy: { sortOrder: "asc" } } } });
  if (!s) notFound();
  const sectors = await prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  const certs = await certificationNames();
  return (
    <>
      <PageHeader back={{ href: `${base}/${s.id}`, label: "Back to seller" }} eyebrow={s.regNo} title={`Edit — ${s.name}`} />
      {SELLER_TALUK_EDITABLE.includes(s.status) ? (
        <SellerForm mode={user.role === "TALUK" ? "taluk" : "district"} district={s.district} taluk={s.taluk} backHref={`${base}/${s.id}`}
          sectors={sectors} certifications={certs} initial={sellerFormValues(s)} />
      ) : (
        <Alert tone="amber">This seller has moved on from taluk verification (with the Directorate or decided), so it can no longer be edited.</Alert>
      )}
    </>
  );
}
