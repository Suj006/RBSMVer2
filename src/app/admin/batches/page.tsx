import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BatchesPage } from "@/components/training/pages";

export const metadata: Metadata = { title: "Awareness sessions" };
export default async function Page({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser("ADMIN");
  return <BatchesPage user={user} base="/admin/batches" sellersBase="/admin/sellers" done={(await searchParams).done} />;
}
