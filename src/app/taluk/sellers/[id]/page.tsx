import { requireUser } from "@/lib/auth";
import { SellerDetailPage } from "@/components/seller/seller-detail-page";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser("TALUK");
  return <SellerDetailPage user={user} id={(await params).id} base="/taluk/sellers" done={(await searchParams).done} />;
}
