import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SellerListPage } from "@/components/seller/seller-list-page";
import type { SellerFilters } from "@/lib/seller-query";

export const metadata: Metadata = { title: "Sellers" };
export default async function Page({ searchParams }: { searchParams: Promise<SellerFilters> }) {
  const user = await requireUser("DIC");
  return <SellerListPage user={user} base="/dic/sellers" filters={await searchParams} title="Sellers"
    subtitle="Every seller from all 14 districts, at every stage. Sellers recommended by the taluk offices wait for initial approval; those who attended the awareness session wait for final approval — filter by “Needs my action”, tick and act together." />;
}
