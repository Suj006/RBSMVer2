import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BatchesPage } from "@/components/training/pages";

export const metadata: Metadata = { title: "Awareness sessions" };
export default async function Page() {
  const user = await requireUser("TRAINING");
  return <BatchesPage user={user} base="/training/batches" />;
}
