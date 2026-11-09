import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BatchesPage } from "@/components/training/pages";

export const metadata: Metadata = { title: "Awareness sessions" };
export default async function Page({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser("DISTRICT");
  return <BatchesPage user={user} base="/district/batches" sellersBase="/district/sellers" done={(await searchParams).done} />;
}
