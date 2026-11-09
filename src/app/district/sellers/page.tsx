import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SellerListPage } from "@/components/seller/seller-list-page";
import type { SellerFilters } from "@/lib/seller-query";

export const metadata: Metadata = { title: "Sellers" };
export default async function Page({ searchParams }: { searchParams: Promise<SellerFilters> }) {
  const user = await requireUser("DISTRICT");
  return <SellerListPage user={user} base="/district/sellers" filters={await searchParams}
    title={`Sellers — ${user.district}`} subtitle="Sellers entered by your office, uploaded in bulk or self-registered for your district. The taluk offices verify and recommend them; you place initially approved sellers in awareness sessions." />;
}
