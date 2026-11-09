import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SellerListPage } from "@/components/seller/seller-list-page";
import type { SellerFilters } from "@/lib/seller-query";

export const metadata: Metadata = { title: "Sellers" };
export default async function Page({ searchParams }: { searchParams: Promise<SellerFilters> }) {
  const user = await requireUser("TALUK");
  return <SellerListPage user={user} base="/taluk/sellers" filters={await searchParams}
    title={`Sellers — ${user.taluk} taluk`} subtitle="Sellers of your taluk: self-registered, entered by the district office or uploaded in bulk. Tick sellers to recommend them together." />;
}
