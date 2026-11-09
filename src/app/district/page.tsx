import type { Metadata } from "next";
import { MatchStatusBand } from "@/components/match/status-band";
import { GraduationCap, Plus, Upload } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ButtonLink, PageHeader } from "@/components/ui";
import { SellerOverview } from "@/components/seller/seller-overview";
import { EVENT } from "@/lib/config";

export const metadata: Metadata = { title: "District dashboard" };

export default async function Page() {
  const user = await requireUser("DISTRICT");
  return (
    <>
      <PageHeader eyebrow={`District Industries Centre · ${EVENT.name} ${EVENT.short}`} title={user.district ?? "Dashboard"}
        subtitle="Register sellers from your district (the taluk offices verify and recommend them) and place initially approved sellers in awareness sessions."
        actions={<><ButtonLink href="/district/sellers/new"><Plus className="size-4" /> Add seller</ButtonLink><ButtonLink href="/district/upload" variant="secondary"><Upload className="size-4" /> Bulk upload</ButtonLink><ButtonLink href="/district/batches" variant="secondary"><GraduationCap className="size-4" /> Awareness sessions</ButtonLink></>} />
      <SellerOverview user={user} base="/district" standalone />
      <MatchStatusBand user={user} base="/district" />
    </>
  );
}
