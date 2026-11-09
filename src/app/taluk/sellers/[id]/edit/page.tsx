import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SellerEditPage } from "@/components/seller/seller-edit-page";

export const metadata: Metadata = { title: "Edit seller" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("TALUK");
  return <SellerEditPage user={user} id={(await params).id} base="/taluk/sellers" />;
}
