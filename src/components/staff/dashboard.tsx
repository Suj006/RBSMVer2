import type { BuyerStatus, ItemStatus, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { itemScope, scopeFor } from "@/lib/buyer-query";
import { FIEO_ITEM_QUEUE, ITEM_META, ROLE_LABEL } from "@/lib/status";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { PendingNow } from "@/components/pending-now";
import { SectionBand, SectionJumps } from "@/components/section-band";
import { BarList, ColumnChart, PipelineBar } from "@/components/charts";
import { fmtDate } from "@/lib/format";
import { EVENT } from "@/lib/config";
import { Flag } from "@/components/ids";
import { IdSearch } from "@/components/lookup";
import { countryCode } from "@/lib/country-codes";

const DAYS = 14;

export async function StaffDashboard({ role, base }: { role: Role; base: string }) {
  const scope = scopeFor(role);
  const iScope = itemScope(role);
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (DAYS - 1));

  const [byStatus, byItem, byCountry, sectorItems, recent] = await Promise.all([
    prisma.buyer.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.requirementItem.groupBy({ by: ["status"], where: iScope, _count: true }),
    prisma.buyer.groupBy({ by: ["country"], where: scope, _count: true, orderBy: { _count: { country: "desc" } }, take: 8 }),
    // Sectors of interest: approved requirements only.
    prisma.requirementItem.findMany({ where: { AND: [iScope, { status: "APPROVED" }] }, select: { sectorId: true, sector: { select: { name: true } } } }),
    prisma.buyer.findMany({ where: { AND: [scope, { createdAt: { gte: since } }] }, select: { createdAt: true } }),
  ]);
  const count = (...s: BuyerStatus[]) => byStatus.filter((x) => s.includes(x.status)).reduce((n, x) => n + x._count, 0);
  const items = (...s: ItemStatus[]) => byItem.filter((x) => s.includes(x.status)).reduce((n, x) => n + x._count, 0);
  const total = byStatus.reduce((n, x) => n + x._count, 0);
  const totalItems = byItem.reduce((n, x) => n + x._count, 0);

  const sectorCounts = new Map<string, { name: string; id: string; n: number }>();
  for (const it of sectorItems) {
    const e = sectorCounts.get(it.sectorId) ?? { name: it.sector.name, id: it.sectorId, n: 0 };
    e.n++; sectorCounts.set(it.sectorId, e);
  }
  const topSectors = [...sectorCounts.values()].sort((a, b) => b.n - a.n).slice(0, 8);

  const days = Array.from({ length: DAYS }, (_, i) => { const d = new Date(since); d.setDate(since.getDate() + i); return d; });
  const trend = days.map((d) => ({
    day: fmtDate(d).slice(0, 6),
    value: recent.filter((r) => r.createdAt.toDateString() === d.toDateString()).length,
  }));

  // Every staff role sees the whole programme; the Directorate's own queue is highlighted in row 2.
  const stats = [
        // Row 1 — basic details
        { label: "Total sign-ups", value: total, accent: "blue" as const, href: `${base}/buyers` },
        { label: "Applications not yet submitted", value: count("SIGNED_UP", "BASIC_RETURNED"), accent: "slate" as const,
          hint: count("BASIC_RETURNED") ? `${count("BASIC_RETURNED")} returned for correction` : undefined, href: `${base}/buyers?status=basic_pending` },
        { label: "Applications to verify", value: count("BASIC_SUBMITTED"), accent: "yellow" as const, href: `${base}/buyers?status=BASIC_SUBMITTED` },
        { label: "Verified by FIEO", value: count("BASIC_APPROVED", "APPROVED"), accent: "green" as const,
          hint: `${count("APPROVED")} already approved buyers`, href: `${base}/buyers?status=basic_approved` },
        // Row 2 — sector requirements
        { label: "Sectors pending with FIEO", value: items(...FIEO_ITEM_QUEUE), accent: "yellow" as const, hint: items("DIC_RETURNED") ? `${items("DIC_RETURNED")} returned by Directorate` : undefined,
          href: `${base}/requirements?item=${role === "DIC" ? "with_fieo" : "action"}` },
        { label: role === "DIC" ? "Sectors awaiting my approval" : "Sectors with Directorate", value: items("FIEO_RECOMMENDED"), accent: "violet" as const, href: `${base}/requirements?item=FIEO_RECOMMENDED` },
        { label: "Approved sectors", value: items("APPROVED"), accent: "green" as const, href: `${base}/requirements?item=APPROVED` },
        { label: "Approved buyers", value: count("APPROVED"), accent: "green" as const, href: `${base}/buyers?status=APPROVED` },
      ];

  const buyerPipeline = [
    { label: "Application not submitted", value: count("SIGNED_UP", "BASIC_RETURNED"), color: "bg-slate-400", href: `${base}/buyers?status=basic_pending` },
    { label: "With FIEO", value: count("BASIC_SUBMITTED"), color: "bg-tx-yellow", href: `${base}/buyers?status=BASIC_SUBMITTED` },
    { label: "Sectors in approval", value: count("BASIC_APPROVED"), color: "bg-tx-blue", href: `${base}/buyers?status=BASIC_APPROVED` },
    { label: "Approved buyers", value: count("APPROVED"), color: "bg-tx-green", href: `${base}/buyers?status=APPROVED` },
  ];
  const itemPipeline = (Object.keys(ITEM_META) as ItemStatus[]).map((s) => ({
    label: ITEM_META[s].short, value: items(s), color: ITEM_META[s].dot, href: `${base}/requirements?item=${s}`,
  }));

  return (
    <>
      <PageHeader eyebrow={`${ROLE_LABEL[role]} · ${EVENT.name} ${EVENT.short}`} title="Dashboard"
        subtitle="Real-time view of the whole programme — international buyers first, then Kerala MSME sellers."
        actions={<SectionJumps />} />
      <Card className="mb-6 p-4"><IdSearch action={`${base}/find`} /></Card>

      <SectionBand id="buyers" kind="buyers" title="Buyer registration & sector approvals"
        summary={`${total} buyers registered · ${count("APPROVED")} approved · ${totalItems} sector requirements`}
        links={[
          { href: `${base}/buyers`, label: "All buyers" },
          ...(role === "ADMIN" ? [] : [{ href: `${base}/buyers?status=action`, label: "Buyer work queue →", primary: true }]),
        ]} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Buyer pipeline" subtitle={`${total} buyers · ${totalItems} sector requirements in view`} />
          <div className="space-y-8 p-6">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Buyers</div>
              <PipelineBar segments={buyerPipeline} />
            </div>
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Sector requirements</div>
              <PipelineBar segments={itemPipeline} />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="New sign-ups" subtitle={`Last ${DAYS} days`} />
          <div className="p-6 pt-8"><ColumnChart data={trend} label="Sign-ups" /></div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <PendingNow title="Buyers pending now" rows={[
          { group: "Application", label: "Signed up, not yet submitted", value: count("SIGNED_UP"), href: `${base}/buyers?status=SIGNED_UP`, dot: "bg-slate-400" },
          { group: "Application", label: "Returned to buyer for correction", value: count("BASIC_RETURNED"), href: `${base}/buyers?status=BASIC_RETURNED`, dot: "bg-tx-red" },
          { group: "Application", label: "Awaiting FIEO verification", value: count("BASIC_SUBMITTED"), href: `${base}/buyers?status=BASIC_SUBMITTED`, dot: "bg-tx-yellow" },
          { group: "Sector requirements", label: "Draft, not yet submitted", value: items("DRAFT"), href: `${base}/requirements?item=DRAFT`, dot: "bg-slate-400" },
          { group: "Sector requirements", label: "Returned to buyer", value: items("FIEO_RETURNED"), href: `${base}/requirements?item=FIEO_RETURNED`, dot: "bg-tx-red" },
          { group: "Sector requirements", label: "Awaiting FIEO", value: items("SUBMITTED"), href: `${base}/requirements?item=SUBMITTED`, dot: "bg-tx-yellow" },
          { group: "Sector requirements", label: "Returned by Directorate to FIEO", value: items("DIC_RETURNED"), href: `${base}/requirements?item=DIC_RETURNED`, dot: "bg-orange-500" },
          { group: "Sector requirements", label: "Awaiting Directorate approval", value: items("FIEO_RECOMMENDED"), href: `${base}/requirements?item=FIEO_RECOMMENDED`, dot: "bg-violet-500" },
        ]} />
        <Card>
          <CardHeader title="Top countries" />
          <div className="p-6">
            <BarList data={byCountry.map((c) => ({ label: `${c.country}${countryCode(c.country) ? ` (${countryCode(c.country)})` : ""}`, icon: <Flag country={c.country} />, value: c._count, href: `${base}/buyers?country=${encodeURIComponent(c.country)}` }))} color="bg-tx-green" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Sectors of interest" subtitle="Approved buyer requirements per sector" />
          <div className="p-6">
            <BarList data={topSectors.map((s) => ({ label: s.name, value: s.n, href: `${base}/requirements?item=APPROVED&sector=${s.id}` }))} color="bg-tx-red" empty="No approved sector requirements yet." />
          </div>
        </Card>
      </div>
    </>
  );
}
