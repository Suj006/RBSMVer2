import { AppShell } from "@/components/shell/app-shell";
import { requireBuyer } from "@/lib/auth";
import { unreadTotal } from "@/lib/comms";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireBuyer();
  const unread = await unreadTotal(user);
  return (
    <AppShell
      role="BUYER"
      user={user}
      nav={[
        { href: "/buyer", label: "Dashboard", icon: "dashboard", exact: true },
        { href: "/buyer/application", label: "My application", icon: "requirement" },
        { href: "/buyer/matches", label: "Matched sellers", icon: "sellers" },
        { href: "/buyer/meetings", label: "My meetings", icon: "calendar" },
        { href: "/buyer/mou", label: "MoUs", icon: "mou" },
        { href: "/buyer/messages", label: "Messages", icon: "messages", badge: unread },
      ]}
    >
      {children}
    </AppShell>
  );
}
