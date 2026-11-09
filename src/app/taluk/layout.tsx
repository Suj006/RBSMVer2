import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sellerScope } from "@/lib/seller-query";
import { SELLER_TALUK_EDITABLE } from "@/lib/status";

export default async function TalukLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("TALUK");
  const pending = await prisma.seller.count({ where: { AND: [sellerScope(user), { status: { in: SELLER_TALUK_EDITABLE } }] } });
  return (
    <AppShell role="TALUK" user={user} nav={[
      { href: "/taluk", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/taluk/find", label: "Find by ID", icon: "find" },
      { href: "/taluk/sellers", label: "Sellers", icon: "sellers", badge: pending },
      { href: "/taluk/reports", label: "Reports", icon: "reports" },
    ]}>{children}</AppShell>
  );
}
