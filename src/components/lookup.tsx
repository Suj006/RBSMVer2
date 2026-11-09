import Link from "next/link";
import { ScanSearch, Ticket as TicketIcon } from "lucide-react";
import type { Prisma, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sellerScope } from "@/lib/seller-query";
import { fmtDay, fmtTime, getEventConfig, LIVE_META, liveStatus } from "@/lib/event";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { SellerBadge } from "@/components/seller/seller-badge";
import { CountryTag, Flag, UidPill, uid } from "@/components/ids";
import { cn } from "@/lib/cn";
import { MOU_STATUS } from "@/lib/mou";

const MEET = { orderBy: { startAt: "asc" as const }, select: { id: true, ticketNo: true, day: true, startAt: true, endAt: true, pavilionNo: true, status: true,
  buyer: { select: { name: true, country: true, approvedNo: true, regNo: true } }, seller: { select: { name: true, approvedNo: true, regNo: true } } } };

/** The search box: buyer ID, seller ID, login ID or ticket number. */
export function IdSearch({ action, value, autoFocus }: { action: string; value?: string; autoFocus?: boolean }) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <ScanSearch className="size-5 text-brand-700" />
      <input name="q" defaultValue={value} autoFocus={autoFocus} autoComplete="off" aria-label="Buyer ID, seller ID or ticket number"
        placeholder="ID (RBSM-Buyer-2026007, RBSM-S-012, Tradex2027-S012), ticket, name, contact, mobile, district, country or product"
        className="min-w-0 flex-1 rounded-lg border-0 px-3 py-2.5 text-sm ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600 sm:max-w-xl" />
      <button className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">Find</button>
    </form>
  );
}

type Meeting = Awaited<ReturnType<typeof prisma.scheduledMeeting.findMany<typeof MEET>>>[number];

function Meetings({ rows, side, dayNo }: { rows: Meeting[]; side: "buyer" | "seller"; dayNo: Map<string, number> }) {
  if (!rows.length) return <p className="px-5 py-3 text-sm text-slate-500">No meetings in the published schedule.</p>;
  const now = new Date();
  return (
    <div className="table-scroll relative overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr><th className="px-5 py-2 text-left">Ticket</th><th className="px-3 py-2 text-left">Day · time</th><th className="px-3 py-2 text-left">Pavilion</th>
            <th className="px-3 py-2 text-left">{side === "buyer" ? "Seller" : "Buyer"}</th><th className="px-3 py-2 text-left">Status</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((m) => { const s = liveStatus(m, now); return (
            <tr key={m.id}>
              <td className="whitespace-nowrap px-5 py-2 font-mono text-xs">{m.ticketNo}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">D{dayNo.get(m.day)} · {fmtTime(m.startAt)}–{fmtTime(m.endAt)}</td>
              <td className="px-3 py-2 font-bold tabular-nums">{m.pavilionNo ?? "–"}</td>
              <td className="px-3 py-2">{side === "buyer"
                ? <span className="inline-flex flex-wrap items-center gap-1.5">{m.seller.name} <UidPill id={uid(m.seller)} tone="seller" /></span>
                : <span className="inline-flex flex-wrap items-center gap-1.5"><Flag country={m.buyer.country} /> {m.buyer.name} <UidPill id={uid(m.buyer)} tone="buyer" /></span>}</td>
              <td className="px-3 py-2"><span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold ring-1", LIVE_META[s].tone)}>{LIVE_META[s].label}</span></td>
            </tr>
          ); })}
        </tbody>
      </table>
    </div>
  );
}

function Keys({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 px-5 py-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
      {items.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
        <div key={k}><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{k}</dt><dd className="font-medium text-ink">{v}</dd></div>
      ))}
    </dl>
  );
}

/**
 * Staff "Find by ID": the buyer / seller unique ID (approved no., registration no. or login ID) or a meeting ticket
 * opens everything about that participant — identity, status, matches, meetings — with links to the full records.
 * `base` is the role's root ("/dic", "/fieo", "/admin", "/district").
 */
export async function IdLookup({ user, base, q: raw }: { user: User; base: string; q?: string }) {
  const q = (raw ?? "").trim();
  const Q = q.toUpperCase();
  // District and taluk offices look up sellers only.
  const district = user.role === "DISTRICT" || user.role === "TALUK";
  const cfg = await getEventConfig();
  const dayNo = new Map(cfg.days.map((d) => [d.date, d.n]));

  const ticket = q && /^TX-/i.test(q) ? await prisma.scheduledMeeting.findUnique({ where: { ticketNo: Q }, select: { buyerId: true, sellerId: true } }) : null;
  // IDs (approved no., registration no., login) and — from 3 characters — any other identifying detail.
  const text = q.length >= 3;
  const digits = q.replace(/\D/g, "");
  const buyerOr: Prisma.BuyerWhereInput[] = q ? [
    { approvedNo: { contains: q } }, { regNo: { contains: q } }, { user: { username: { contains: q } } },
    ...(text ? [{ name: { contains: q } }, { country: { contains: q } }, { pocName: { contains: q } }, { pocEmail: { contains: q.toLowerCase() } }, { signupEmail: { contains: q.toLowerCase() } },
      ...(digits.length >= 5 ? [{ pocMobile: { contains: digits } }] : []),
      { requirement: { items: { some: { status: "APPROVED" as const, OR: [{ products: { contains: q } }, { sector: { name: { contains: q } } }] } } } }] : []),
    ...(ticket ? [{ id: ticket.buyerId }] : []),
  ] : [];
  // FIEO does not see sellers' personal data, so it cannot search by it either.
  const personal = user.role !== "FIEO";
  const sellerOr: Prisma.SellerWhereInput[] = q ? [
    { approvedNo: { contains: q } }, { regNo: { contains: q } }, { user: { username: { contains: q } } },
    ...(text ? [{ name: { contains: q } }, { district: { contains: q } }, { udyamNo: { contains: q.toUpperCase() } }, { iecNo: { contains: q.toUpperCase() } },
      { products: { some: { OR: [{ products: { contains: q } }, { sector: { name: { contains: q } } }] } } },
      ...(personal ? [{ contactName: { contains: q } }, { contactEmail: { contains: q.toLowerCase() } }, ...(digits.length >= 5 ? [{ contactMobile: { contains: digits } }] : [])] : [])] : []),
    ...(ticket ? [{ id: ticket.sellerId }] : []),
  ] : [];
  // MoU numbers (RBSM-MOU-2026-B007-S012): the MoU itself, and its buyer and seller below.
  const mous = q && /mou/i.test(q) && !district
    ? await prisma.mou.findMany({ where: { mouNo: { contains: q } }, take: 10, orderBy: { seq: "desc" }, select: { id: true, mouNo: true, status: true, goods: true, buyerId: true, sellerId: true, buyer: { select: { name: true, country: true } }, seller: { select: { name: true } } } })
    : [];
  if (mous.length) { buyerOr.push({ id: { in: mous.map((m) => m.buyerId) } }); sellerOr.push({ id: { in: mous.map((m) => m.sellerId) } }); }
  const [buyers, sellers] = q ? await Promise.all([
    district ? [] : prisma.buyer.findMany({ where: { OR: buyerOr }, take: 12, orderBy: { regNo: "asc" },
      select: { id: true, name: true, country: true, approvedNo: true, regNo: true, status: true, pocName: true, pavilionNo: true,
        user: { select: { username: true } }, nodalOfficer: { select: { name: true, mobile: true } },
        requirement: { select: { items: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" }, select: { sector: { select: { name: true } } } } } },
        _count: { select: { publishedMatches: true } }, scheduled: MEET } }),
    prisma.seller.findMany({ where: { AND: [sellerScope(user), { OR: sellerOr }] }, take: 12, orderBy: { regNo: "asc" },
      select: { id: true, name: true, district: true, approvedNo: true, regNo: true, status: true,
        user: { select: { username: true } }, products: { orderBy: { sortOrder: "asc" }, select: { sector: { select: { name: true } } } },
        _count: { select: { publishedMatches: true, preferences: true } }, scheduled: MEET } }),
  ]) : [[], []];
  // Exact hits first (the ID typed in full), then partial ones.
  const exact = (p: { approvedNo: string | null; regNo: string; user: { username: string } | null }) =>
    [p.approvedNo, p.regNo, p.user?.username].some((x) => x?.toUpperCase() === Q);
  buyers.sort((a, b) => Number(exact(b)) - Number(exact(a)));
  sellers.sort((a, b) => Number(exact(b)) - Number(exact(a)));
  const few = buyers.length + sellers.length <= 3;
  const sellerHref = (id: string) => `${base}/sellers/${id}`;
  const showTicket = ticket ? Q : "";

  return (
    <>
      <PageHeader eyebrow="Search" title="Find by ID"
        subtitle="Every buyer and seller has a unique ID — the approved number (RBSM-Buyer-…, RBSM-Seller-…), the registration number (RBSM-B-…, RBSM-S-…) and the login ID (Tradex2027-…). Enter any of them or part of one, a meeting ticket number — or a name, contact person, mobile, e-mail, Udyam / IEC number, district, country or product." />
      <Card className="mb-6 p-5"><IdSearch action={`${base}/find`} value={q} autoFocus={!q} /></Card>
      {q && !buyers.length && !sellers.length && (
        <Card><EmptyState icon={<ScanSearch className="size-5" />} title={`Nothing found for "${q}"`}>Check the spelling or the ID. Buyer IDs look like RBSM-Buyer-2026007 or RBSM-B-007; seller IDs like RBSM-Seller-2026012 or RBSM-S-012.</EmptyState></Card>
      )}
      {(buyers.length === 12 || sellers.length === 12) && <p className="mb-4 text-sm text-slate-500">Showing the first 12 {buyers.length === 12 ? "buyers" : ""}{buyers.length === 12 && sellers.length === 12 ? " and " : ""}{sellers.length === 12 ? "sellers" : ""} — type more to narrow down, or use the full ID.</p>}
      {mous.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-brand-700">MoU{mous.length > 1 ? "s" : ""}</div>
          <ul className="divide-y divide-slate-100">
            {mous.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="flex flex-wrap items-center gap-2"><Link href={`${base}/mou/${m.id}`} className="font-mono font-bold text-brand-800 hover:underline">{m.mouNo}</Link>
                  <Flag country={m.buyer.country} /> {m.buyer.name} ↔ {m.seller.name} <span className="text-slate-500">· {m.goods}</span></span>
                <span className="text-xs font-semibold text-slate-600">{MOU_STATUS[m.status].label}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {showTicket && <p className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-600"><TicketIcon className="size-4" /> Ticket <b className="font-mono text-ink">{showTicket}</b> — the buyer and seller of this meeting:</p>}
      <div className="space-y-6">
        {buyers.map((b) => (
          <Card key={b.id} className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-sky-50/50 px-5 py-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-sky-800">Buyer</div>
                <Link href={`${base}/buyers/${b.id}`} className="flex items-center gap-2 text-lg font-bold text-ink hover:text-brand-700"><Flag country={b.country} /> {b.name}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs"><UidPill id={b.approvedNo} tone="buyer" /> <UidPill id={b.regNo} /> <UidPill id={b.user.username} /> <CountryTag country={b.country} name flag={false} className="text-slate-600" /></div>
              </div>
              <StatusBadge status={b.status} />
            </div>
            <Keys items={[
              ["Sectors approved", (b.requirement?.items ?? []).map((i) => i.sector.name).join(", ") || "—"],
              ["Contact", b.pocName], ["Sellers matched (published)", b._count.publishedMatches],
              ["Pavilion", b.pavilionNo ?? "—"], ["Nodal officer", b.nodalOfficer ? `${b.nodalOfficer.name} · ${b.nodalOfficer.mobile}` : "—"],
              ["Meetings", b.scheduled.length],
            ]} />
            {(few || exact(b)) && b.scheduled.length > 0 && <Meetings rows={b.scheduled} side="buyer" dayNo={dayNo} />}
            <div className="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3 text-sm font-semibold">
              <Link href={`${base}/buyers/${b.id}`} className="text-brand-700 hover:underline">Full profile →</Link>
              {(user.role === "DIC" || user.role === "ADMIN") && <Link href={`${base}/matchmaking/buyers/${b.id}`} className="text-brand-700 hover:underline">Matchmaking →</Link>}
              <Link href={`${base}/messages?q=${encodeURIComponent(uid(b))}`} className="text-brand-700 hover:underline">Messages →</Link>
            </div>
          </Card>
        ))}
        {sellers.map((s) => (
          <Card key={s.id} className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-emerald-50/50 px-5 py-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-800">Seller</div>
                <Link href={sellerHref(s.id)} className="text-lg font-bold text-ink hover:text-brand-700">{s.name}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs"><UidPill id={s.approvedNo} tone="seller" /> <UidPill id={s.regNo} /> <UidPill id={s.user?.username} /> <span className="text-slate-600">{s.district}, Kerala</span></div>
              </div>
              <SellerBadge status={s.status} />
            </div>
            <Keys items={[
              ["Sectors", [...new Set(s.products.map((p) => p.sector.name))].join(", ") || "—"],
              ["Preferences given", s._count.preferences], ["Buyers matched (published)", s._count.publishedMatches], ["Meetings", s.scheduled.length],
            ]} />
            {(few || exact(s)) && s.scheduled.length > 0 && <Meetings rows={s.scheduled} side="seller" dayNo={dayNo} />}
            <div className="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3 text-sm font-semibold">
              <Link href={sellerHref(s.id)} className="text-brand-700 hover:underline">Full profile →</Link>
              {!district && <Link href={`${base}/messages?q=${encodeURIComponent(uid(s))}`} className="text-brand-700 hover:underline">Messages →</Link>}
            </div>
          </Card>
        ))}
      </div>
      {cfg.days.length > 0 && (buyers.length > 0 || sellers.length > 0) && <p className="mt-4 text-xs text-slate-500">Event days: {cfg.days.map((d) => `Day ${d.n} ${fmtDay(d.date)}`).join(" · ")}</p>}
    </>
  );
}

export function FindCard({ base }: { base: string }) {
  return (
    <Card className="mb-6">
      <CardHeader title="Find a buyer, seller or ticket by ID" icon={<ScanSearch className="size-4" />} />
      <div className="px-5 pb-5"><IdSearch action={`${base}/find`} /></div>
    </Card>
  );
}
