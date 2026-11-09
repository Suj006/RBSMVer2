"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, UserRound, ClipboardList, Users, ShieldCheck, Layers, Award, Mail, FileDown, BadgeCheck, Inbox,
  Store, Upload, PlusCircle, Target, Boxes, PackageSearch, Lightbulb, Handshake, LayoutList, Star, ShieldAlert, ChartPie, MessagesSquare, CalendarClock, ScanSearch, FileSignature, GraduationCap, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = {
  dashboard: LayoutDashboard, profile: UserRound, requirement: ClipboardList, buyers: Users, review: Inbox,
  approved: BadgeCheck, users: ShieldCheck, sectors: Layers, certs: Award, mail: Mail, reports: FileDown,
  sellers: Store, upload: Upload, add: PlusCircle, target: Target, demand: Boxes, products: PackageSearch, insights: Lightbulb, match: Handshake, board: LayoutList, star: Star, checks: ShieldAlert, results: ChartPie, messages: MessagesSquare, calendar: CalendarClock, find: ScanSearch, mou: FileSignature, training: GraduationCap, final: ListChecks,
} as const;

export type NavItem = {
  href: string; label: string; icon: keyof typeof ICONS; exact?: boolean; badge?: number;
  /** Sidebar heading shown above the first item of a group (e.g. "Buyers", "Sellers"). */
  group?: string;
};

export function NavLinks({ items, horizontal }: { items: NavItem[]; horizontal?: boolean }) {
  const path = usePathname();
  // Highlight only the most specific matching item (e.g. "Add seller" rather than also "Sellers").
  const matches = (it: NavItem) => (it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/"));
  const best = items.filter(matches).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const ref = useRef<HTMLUListElement>(null);
  // On phones the menu is a sideways strip: keep the current page's tab in view.
  useEffect(() => {
    if (horizontal) ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [horizontal, best]);
  return (
    <ul ref={ref} className={cn(horizontal ? "flex gap-1" : "space-y-1")}>
      {items.map((it, i) => {
        const active = it.href === best;
        const Icon = ICONS[it.icon];
        const heading = !horizontal && it.group && it.group !== items[i - 1]?.group ? it.group : null;
        return (
          <li key={it.href}>
            {heading && <div className="mb-1 mt-4 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{heading}</div>}
            <Link
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                horizontal && "whitespace-nowrap py-2",
                active ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-600 hover:bg-slate-50 hover:text-ink",
              )}
            >
              <Icon className={cn("size-4.5 shrink-0", active ? "text-brand-700" : "text-slate-400")} />
              <span className="flex-1">{it.label}</span>
              {!!it.badge && (
                <span className="rounded-full bg-tx-red px-2 py-0.5 text-[10px] font-bold text-white">{it.badge}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
