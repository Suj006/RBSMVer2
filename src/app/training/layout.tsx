import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("TRAINING");
  const today = new Date().toISOString().slice(0, 10);
  // Sessions held (today or earlier) with attendance still to mark.
  const toMark = await prisma.trainingBatch.count({ where: { date: { lte: today }, members: { some: { attendance: "PENDING" } } } });
  return (
    <AppShell role="TRAINING" user={user} nav={[
      { href: "/training", label: "Awareness sessions", icon: "training", badge: toMark, exact: true },
      { href: "/training/reports", label: "Reports", icon: "reports" },
    ]}>{children}</AppShell>
  );
}
