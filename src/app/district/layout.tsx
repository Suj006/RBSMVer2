import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awaitingSession } from "@/lib/training";

export default async function DistrictLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("DISTRICT");
  const toPlace = await prisma.seller.count({ where: awaitingSession(user) });
  return (
    <AppShell role="DISTRICT" user={{ displayName: user.displayName, username: user.username }} nav={[
      { href: "/district", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/district/find", label: "Find by ID", icon: "find" },
      { href: "/district/sellers", label: "Sellers", icon: "sellers" },
      { href: "/district/batches", label: "Awareness sessions", icon: "training", badge: toPlace },
      { href: "/district/sellers/new", label: "Add seller", icon: "add", exact: true },
      { href: "/district/upload", label: "Bulk upload", icon: "upload" },
      { href: "/district/matches", label: "Buyer meetings", icon: "match" },
      { href: "/district/reports", label: "Reports", icon: "reports" },
    ]}>{children}</AppShell>
  );
}
