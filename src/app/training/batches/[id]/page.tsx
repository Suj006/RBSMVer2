import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BatchDetailPage } from "@/components/training/pages";

export const metadata: Metadata = { title: "Awareness session — attendance" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("TRAINING");
  return <BatchDetailPage user={user} base="/training" id={(await params).id} />;
}
