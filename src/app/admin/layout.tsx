import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("ADMIN");
  return (
    <AppShell role="ADMIN" user={user} nav={[
      { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/admin/find", label: "Find by ID", icon: "find" },
      { href: "/admin/buyers", label: "All buyers", icon: "buyers", group: "Buyers" },
      { href: "/admin/requirements", label: "Sector requirements", icon: "requirement", group: "Buyers" },
      { href: "/admin/approved", label: "RBSM buyer list", icon: "approved", group: "Buyers" },
      { href: "/admin/sellers", label: "All sellers", icon: "sellers", group: "Sellers" },
      { href: "/admin/batches", label: "Awareness sessions", icon: "training", group: "Sellers" },
      { href: "/admin/seller-list", label: "RBSM seller list", icon: "approved", group: "Sellers" },
      { href: "/admin/demand", label: "Sector demand", icon: "demand", group: "Programme" },
      { href: "/admin/products", label: "Product demand", icon: "products", group: "Programme" },
      { href: "/admin/insights", label: "Insights", icon: "insights", group: "Programme" },
      { href: "/admin/targets", label: "Targets", icon: "target", group: "Programme" },
      { href: "/admin/reports", label: "Reports", icon: "reports", group: "Programme" },
      { href: "/admin/matchmaking", label: "Matchmaking", icon: "match", group: "Matchmaking" },
      { href: "/admin/event", label: "Event days & schedule", icon: "calendar", group: "Matchmaking" },
      { href: "/admin/mou", label: "MoU dashboard", icon: "mou", group: "Matchmaking" },
      { href: "/admin/messages", label: "Messages (read only)", icon: "messages", group: "Communications" },
      { href: "/admin/sectors", label: "Sector master", icon: "sectors", group: "Administration" },
      { href: "/admin/certifications", label: "Certification master", icon: "certs", group: "Administration" },
      { href: "/admin/users", label: "Users & logins", icon: "users", group: "Administration" },
      { href: "/admin/emails", label: "E-mail outbox", icon: "mail", group: "Administration" },
    ]}>{children}</AppShell>
  );
}
