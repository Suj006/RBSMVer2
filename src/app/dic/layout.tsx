import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { unreadTotal } from "@/lib/comms";
import { prisma } from "@/lib/prisma";
import { actionWhere } from "@/lib/buyer-query";
import { awaitingSession } from "@/lib/training";

export default async function DicLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("DIC");
  const [pending, sellerPending, finalPending, toPlace, unread] = await Promise.all([
    prisma.buyer.count({ where: actionWhere("DIC") }),
    prisma.seller.count({ where: { status: "RECOMMENDED" } }),
    prisma.seller.count({ where: { status: "TRAINED" } }),
    prisma.seller.count({ where: awaitingSession(user) }),
    unreadTotal(user),
  ]);
  return (
    <AppShell role="DIC" user={user} nav={[
      { href: "/dic", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/dic/find", label: "Find by ID", icon: "find" },
      { href: "/dic/buyers", label: "Buyers", icon: "buyers", badge: pending, group: "Buyers" },
      { href: "/dic/requirements", label: "Sector requirements", icon: "requirement", group: "Buyers" },
      { href: "/dic/approved", label: "RBSM buyer list", icon: "approved", group: "Buyers" },
      { href: "/dic/sellers", label: "Sellers", icon: "sellers", group: "Sellers" },
      { href: "/dic/sellers?status=RECOMMENDED", label: "Initial approval", icon: "review", badge: sellerPending, group: "Sellers" },
      { href: "/dic/batches", label: "Awareness sessions", icon: "training", badge: toPlace, group: "Sellers" },
      { href: "/dic/sellers?status=TRAINED", label: "Final approval", icon: "final", badge: finalPending, group: "Sellers" },
      { href: "/dic/seller-list", label: "RBSM seller list", icon: "approved", group: "Sellers" },
      { href: "/dic/demand", label: "Sector demand", icon: "demand", group: "Programme" },
      { href: "/dic/products", label: "Product demand", icon: "products", group: "Programme" },
      { href: "/dic/insights", label: "Insights", icon: "insights", group: "Programme" },
      { href: "/dic/targets", label: "Targets", icon: "target", group: "Programme" },
      { href: "/dic/reports", label: "Reports", icon: "reports", group: "Programme" },
      { href: "/dic/matchmaking", label: "Matchmaking", icon: "match", group: "Matchmaking" },
      { href: "/dic/event", label: "Event days & schedule", icon: "calendar", group: "Matchmaking" },
      { href: "/dic/mou", label: "MoU dashboard", icon: "mou", group: "Matchmaking" },
      { href: "/dic/messages", label: "Messages", icon: "messages", badge: unread, group: "Communications" },
    ]}>{children}</AppShell>
  );
}
