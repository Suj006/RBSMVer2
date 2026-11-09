import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BatchDetailPage } from "@/components/training/pages";

export const metadata: Metadata = { title: "Awareness session" };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser("ADMIN");
  return <BatchDetailPage user={user} base="/admin/batches" id={(await params).id} done={(await searchParams).done} />;
}
