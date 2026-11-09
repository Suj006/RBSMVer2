import type { Metadata } from "next";
import { ListChecks } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ButtonLink, PageHeader } from "@/components/ui";
import { SellerOverview } from "@/components/seller/seller-overview";
import { EVENT } from "@/lib/config";

export const metadata: Metadata = { title: "Taluk dashboard" };

export default async function Page() {
  const user = await requireUser("TALUK");
  return (
    <>
      <PageHeader eyebrow={`Taluk Industries Office · ${EVENT.name} ${EVENT.short}`} title={`${user.taluk ?? "Taluk"} — ${user.district ?? ""}`}
        subtitle="Verify the sellers of your taluk: correct the details if needed, then recommend, return to the applicant, or mark not recommended."
        actions={<ButtonLink href="/taluk/sellers?status=action"><ListChecks className="size-4" /> Sellers to verify</ButtonLink>} />
      <SellerOverview user={user} base="/taluk" standalone />
    </>
  );
}
