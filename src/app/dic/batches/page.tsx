import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BatchesPage } from "@/components/training/pages";

export const metadata: Metadata = { title: "Awareness sessions" };
export default async function Page({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser("DIC");
  return <BatchesPage user={user} base="/dic/batches" sellersBase="/dic/sellers" done={(await searchParams).done} />;
}
