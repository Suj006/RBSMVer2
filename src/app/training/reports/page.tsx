import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ReportsPage } from "@/components/staff/reports-page";

export const metadata: Metadata = { title: "Reports" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("TRAINING");
  return <ReportsPage user={user} base="/training/reports" filters={await searchParams} />;
}
