import Link from "next/link";
import { Target } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import type { SellerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { sellerScope } from "@/lib/seller-query";
import { DISTRICT_NAMES } from "@/lib/config";
import { TALUKS } from "@/lib/kerala";
import { getTargets } from "@/lib/targets";
import { SELLER_META } from "@/lib/status";
import { Card, CardHeader, StatCard } from "@/components/ui";
import { trainingCounts } from "@/lib/training";
import { SectionBand } from "@/components/section-band";
import { BarList, PipelineBar } from "@/components/charts";
import { cn } from "@/lib/cn";

function Progress({ label, value, target, color, suffix }: { label: string; value: number; target: number; color: string; suffix?: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-sm tabular-nums text-slate-600"><span className="text-lg font-extrabold text-ink">{value}</span> / {target}{suffix}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100"><div className={cn("h-2.5 rounded-full", color)} style={{ width: `${Math.max(pct, value ? 2 : 0)}%` }} /></div>
      <div className="mt-1 text-xs text-slate-500">{pct.toFixed(0)}% of target</div>
    </div>
  );
}

/** Seller statistics for any staff role, within what that role may see. */
export async function SellerOverview({ user, base, standalone }: { user: User; base: string; standalone?: boolean }) {
  const scope = sellerScope(user);
  const [byStatus, byDistrict, products, exp, bySource, approvedBuyers, profilePending, withIec, certified, everRecommended, everInitial, tc] = await Promise.all([
    prisma.seller.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.seller.groupBy({ by: ["district", "taluk", "status"], where: scope, _count: true }),
    // Sellers by sector: approved sellers only.
    prisma.sellerProduct.findMany({ where: { seller: { AND: [scope, { status: "APPROVED" }] } }, select: { sectorId: true, sector: { select: { name: true } } } }),
    prisma.seller.groupBy({ by: ["exportExperience", "status"], where: scope, _count: true }),
    prisma.seller.groupBy({ by: ["source"], where: scope, _count: true }),
    prisma.buyer.count({ where: { status: "APPROVED" } }),
    prisma.seller.count({ where: { AND: [scope, { status: "APPROVED", profileCompletedAt: null }] } }),
    prisma.seller.count({ where: { AND: [scope, { iecNo: { not: null } }] } }),
    prisma.seller.count({ where: { AND: [scope, { certifications: { not: "[]" } }] } }),
    prisma.seller.count({ where: { AND: [scope, { recommendedAt: { not: null } }] } }),
    prisma.seller.count({ where: { AND: [scope, { initialApprovedAt: { not: null } }] } }),
    trainingCounts(user),
  ]);
  const n = (...s: SellerStatus[]) => byStatus.filter((x) => s.includes(x.status)).reduce((a, x) => a + x._count, 0);
  const total = byStatus.reduce((a, x) => a + x._count, 0);
  const approved = n("APPROVED");
  const expCount = (yes: boolean, status?: SellerStatus) =>
    exp.filter((e) => e.exportExperience === yes && (!status || e.status === status)).reduce((a, e) => a + e._count, 0);

  const S = (st: string) => `${base}/sellers?status=${st}`;
  const T = (t: string) => `${base}/sellers?training=${t}`;
  const stats =
    user.role === "TALUK" ? [
      { label: "Sellers registered", value: total, accent: "blue" as const, href: `${base}/sellers` },
      { label: "Pending my verification", value: n("WITH_TALUK", "RETURNED"), accent: "yellow" as const, href: `${base}/sellers?status=action`,
        hint: [n("RETURNED") && `${n("RETURNED")} returned by Directorate`, n("WITH_SELLER") && `${n("WITH_SELLER")} with applicants`].filter(Boolean).join(" · ") || undefined },
      { label: "Recommended by me", value: everRecommended, accent: "violet" as const, hint: `${n("NOT_RECOMMENDED")} not recommended` },
      { label: "Approved sellers", value: n("APPROVED"), accent: "green" as const, href: S("APPROVED") },
    ]
    : user.role === "DISTRICT" ? [
      { label: "Sellers registered", value: total, accent: "blue" as const, href: `${base}/sellers` },
      { label: "With taluk offices", value: n("WITH_TALUK", "RETURNED", "WITH_SELLER"), accent: "yellow" as const, href: `${base}/sellers?status=pending`,
        hint: `${everRecommended} recommended · ${n("NOT_RECOMMENDED")} not recommended` },
      { label: "To place in a session", value: tc.unassigned + tc.absent, accent: "red" as const, href: `${base}/sellers?status=action`,
        hint: tc.absent ? `${tc.absent} absent — to re-schedule` : undefined },
      { label: "Approved sellers", value: approved, accent: "green" as const, href: S("APPROVED") },
    ]
    : user.role === "FIEO" ? [
      { label: "Approved sellers", value: approved, accent: "green" as const, href: `${base}/sellers` },
      { label: "With export experience", value: expCount(true), accent: "blue" as const, href: `${base}/sellers?exp=yes` },
      { label: "Sectors covered", value: new Set(products.map((p) => p.sectorId)).size, accent: "violet" as const },
      { label: "Districts represented", value: new Set(byDistrict.map((d) => d.district)).size, accent: "yellow" as const },
    ]
    : [
      // Directorate and Admin: the whole seller picture across all 14 districts.
      { label: "Sellers registered", value: total, accent: "blue" as const, href: `${base}/sellers`,
        hint: `${everRecommended} recommended by taluk offices · ${n("NOT_RECOMMENDED")} not recommended` },
      { label: user.role === "DIC" ? "Awaiting my initial approval" : "Awaiting initial approval", value: n("RECOMMENDED"), accent: "violet" as const, href: S("RECOMMENDED") },
      { label: user.role === "DIC" ? "Awaiting my final approval" : "Awaiting final approval", value: n("TRAINED"), accent: "yellow" as const, href: S("TRAINED"),
        hint: "Attended the awareness session" },
      { label: "Approved sellers", value: approved, accent: "green" as const, href: S("APPROVED"),
        hint: `${tc.bypassed} without session · ${expCount(true, "APPROVED")} with export experience` },
    ];

  // Every stage of the seller process, with counts (sellers currently at a stage, or that have passed it).
  const stages: { title: string; rows: { label: string; value: number; href?: string; dot: string }[] }[] = [
    { title: "Taluk verification", rows: [
      { label: "Pending with taluk office", value: n("WITH_TALUK"), href: S("WITH_TALUK"), dot: "bg-tx-yellow" },
      { label: "With applicants for correction", value: n("WITH_SELLER"), href: S("WITH_SELLER"), dot: "bg-tx-blue" },
      { label: "Returned by Directorate to taluk", value: n("RETURNED"), href: S("RETURNED"), dot: "bg-tx-red" },
      { label: "Recommended (total)", value: everRecommended, dot: "bg-violet-500" },
      { label: "Not recommended", value: n("NOT_RECOMMENDED"), href: S("NOT_RECOMMENDED"), dot: "bg-slate-500" },
    ] },
    { title: "Directorate — initial approval", rows: [
      { label: "Awaiting initial approval", value: n("RECOMMENDED"), href: S("RECOMMENDED"), dot: "bg-violet-500" },
      { label: "Initially approved (total)", value: everInitial, dot: "bg-sky-500" },
      { label: "Rejected", value: n("REJECTED"), href: S("REJECTED"), dot: "bg-slate-400" },
    ] },
    { title: "Awareness session", rows: [
      { label: "Awaiting a session (not yet placed)", value: tc.unassigned, href: T("unassigned"), dot: "bg-tx-yellow" },
      { label: "Placed in a session", value: tc.scheduled, href: T("scheduled"), dot: "bg-tx-blue" },
      { label: "Absent — to re-schedule", value: tc.absent, href: T("absent"), dot: "bg-tx-red" },
      { label: "Attended (session completed)", value: tc.trained, dot: "bg-tx-green" },
    ] },
    { title: "Final approval", rows: [
      { label: "Awaiting final approval", value: n("TRAINED"), href: S("TRAINED"), dot: "bg-indigo-500" },
      { label: "Approved sellers", value: approved, href: S("APPROVED"), dot: "bg-tx-green" },
      { label: "of which approved without session", value: tc.bypassed, href: T("bypassed"), dot: "bg-violet-500" },
      { label: "Approved — profile pending with seller", value: profilePending, href: `${base}/sellers?profile=pending`, dot: "bg-amber-500" },
    ] },
  ];

  const sectorCounts = new Map<string, { id: string; name: string; n: number }>();
  for (const p of products) {
    const e = sectorCounts.get(p.sectorId) ?? { id: p.sectorId, name: p.sector.name, n: 0 };
    e.n++; sectorCounts.set(p.sectorId, e);
  }
  const topSectors = [...sectorCounts.values()].sort((a, b) => b.n - a.n).slice(0, 10);
  const statuses = (Object.keys(SELLER_META) as SellerStatus[]).filter((s) => user.role !== "FIEO" || byStatus.some((x) => x.status === s));
  // District-wise (Directorate, Admin) or taluk-wise (district office) position.
  const byTaluk = user.role === "DISTRICT";
  const areas = byTaluk ? TALUKS[user.district ?? ""] ?? [] : DISTRICT_NAMES;
  const areaRows = areas.map((d) => {
    const c = (...s: SellerStatus[]) => byDistrict.filter((x) => (byTaluk ? x.taluk : x.district) === d && s.includes(x.status)).reduce((a, x) => a + x._count, 0);
    return {
      d, total: c(...(Object.keys(SELLER_META) as SellerStatus[])), taluk: c("WITH_TALUK", "WITH_SELLER", "RETURNED"), notRec: c("NOT_RECOMMENDED"),
      dic: c("RECOMMENDED"), session: c("INITIAL_APPROVED"), final: c("TRAINED"), approved: c("APPROVED"), rejected: c("REJECTED"),
    };
  });
  const targets = await getTargets();
  const ownTarget = user.role === "DISTRICT" || user.role === "TALUK" ? targets.district[user.district ?? ""] ?? 0 : 0;

  const sellersBySector = (
    <Card className="lg:col-span-2">
      <CardHeader title="Sellers by sector" subtitle="Approved sellers ready to export, per sector" />
      <div className="p-6">
        <BarList data={topSectors.map((s) => ({ label: s.name, value: s.n, href: user.role === "FIEO" ? `${base}/seller-list?sector=${s.id}` : `${base}/sellers?status=APPROVED&sector=${s.id}` }))} color="bg-tx-red" empty="No approved sellers yet." />
      </div>
    </Card>
  );

  return (
    <section className={standalone ? "" : "mt-10"}>
      <SectionBand id="sellers" kind="sellers"
        title={user.role === "DISTRICT" ? `Sellers — ${user.district}` : user.role === "TALUK" ? `Sellers — ${user.taluk} taluk` : "Seller registration & approvals"}
        summary={`${total} sellers in view · ${approved} approved${user.role === "DIC" || user.role === "ADMIN" ? " · all 14 districts" : ""}`}
        links={[
          { href: user.role === "FIEO" ? `${base}/seller-list` : `${base}/sellers`, label: user.role === "FIEO" ? "RBSM seller list" : "All sellers" },
          ...(user.role === "DIC" || user.role === "DISTRICT" || user.role === "TALUK" ? [{ href: `${base}/sellers?status=action`, label: "Seller work queue →", primary: true }] : []),
        ]} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        {/* FIEO sees approved sellers only, so a status pipeline would be a single bar. */}
        {user.role === "FIEO" ? sellersBySector : <Card className="lg:col-span-2">
          <CardHeader title="Seller pipeline" subtitle={`${total} sellers in view`} />
          <div className="space-y-6 p-6">
            <PipelineBar segments={statuses.map((s) => ({ label: SELLER_META[s].short, value: n(s), color: SELLER_META[s].dot, href: `${base}/sellers?status=${s}` }))} />
            {(user.role === "DISTRICT" || user.role === "TALUK" || user.role === "ADMIN" || user.role === "DIC") && (
              <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">How sellers were registered</div>
                  <ul className="space-y-1 text-sm">
                    {[["DISTRICT", "Entered by district office"], ["BULK", "Bulk upload"], ["SELF", "Self-registered"]].map(([k, l]) => (
                      <li key={k} className="flex justify-between"><span className="text-slate-600">{l}</span><span className="font-semibold tabular-nums">{bySource.find((x) => x.source === k)?._count ?? 0}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Export experience</div>
                  <ul className="space-y-1 text-sm">
                    <li className="flex justify-between"><span className="text-slate-600">Yes</span><span className="font-semibold tabular-nums">{expCount(true)}</span></li>
                    <li className="flex justify-between"><span className="text-slate-600">No</span><span className="font-semibold tabular-nums">{expCount(false)}</span></li>
                    <li className="flex justify-between"><Link href={`${base}/sellers?iec=yes`} className="text-slate-600 hover:text-brand-700">IEC number given</Link><span className="font-semibold tabular-nums">{withIec}</span></li>
                    <li className="flex justify-between"><Link href={`${base}/sellers?cert=yes`} className="text-slate-600 hover:text-brand-700">Hold certifications</Link><span className="font-semibold tabular-nums">{certified}</span></li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </Card>}
        <Card>
          <CardHeader title="Programme targets" icon={<Target className="size-4" />}
            subtitle={user.role === "DISTRICT" || user.role === "TALUK" ? "Approved-seller target set by the Directorate for the district" : `Each buyer to meet at least ${targets.sellersPerBuyer} sellers`}
            action={user.role === "DIC" || user.role === "ADMIN" ? <Link href={`${base}/targets`} className="text-sm font-semibold text-brand-700 hover:underline">Edit</Link> : undefined} />
          <div className="space-y-6 p-6">
            {user.role === "DISTRICT" || user.role === "TALUK" ? (
              <Progress label={`Approved sellers — ${user.role === "TALUK" ? `${user.taluk} taluk` : user.district}`} value={approved} target={ownTarget} color="bg-tx-green" />
            ) : (
              <>
                <Progress label="Approved sellers" value={approved} target={targets.sellers} color="bg-tx-green" />
                <Progress label="Approved buyers" value={approvedBuyers} target={targets.buyers} color="bg-tx-blue" />
                <Progress label="Sellers per approved buyer" value={approvedBuyers ? Math.floor(approved / approvedBuyers) : 0} target={targets.sellersPerBuyer} color="bg-tx-yellow" />
              </>
            )}
          </div>
        </Card>
      </div>

      {user.role !== "FIEO" && <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Stage-wise position" subtitle="Sellers at each stage of the process" />
          <div className="space-y-5 p-5">
            {stages.map((g) => (
              <div key={g.title}>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.title}</div>
                <ul className="space-y-1 text-sm">
                  {g.rows.map((r) => (
                    <li key={r.label} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-slate-600"><span className={cn("size-2 rounded-full", r.dot)} />
                        {r.href ? <Link href={r.href} className="hover:text-brand-700">{r.label}</Link> : r.label}</span>
                      <span className="font-semibold tabular-nums text-ink">{r.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
        {sellersBySector}
        {(user.role === "DIC" || user.role === "ADMIN" || (byTaluk && areas.length > 0)) && (
          <Card className="lg:col-span-3">
            <CardHeader title={byTaluk ? "Taluk-wise position" : "District-wise position"} subtitle={byTaluk ? "Sellers at each stage, per taluk" : "Sellers at each stage, and approved sellers against each district's target"} />
            <div className="table-scroll relative overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">{byTaluk ? "Taluk" : "District"}</th>
                    <th className="px-3 py-2.5 text-right">Registered</th>
                    <th className="px-3 py-2.5 text-right">With taluk</th>
                    <th className="px-3 py-2.5 text-right">Not recommended</th>
                    <th className="px-3 py-2.5 text-right">Initial approval</th>
                    <th className="px-3 py-2.5 text-right">Awareness session</th>
                    <th className="px-3 py-2.5 text-right">Final approval</th>
                    <th className="px-3 py-2.5 text-right">Rejected</th>
                    <th className="px-3 py-2.5 text-right">Approved</th>
                    {!byTaluk && <th className="w-[20%] px-4 py-2.5 text-left">Progress to target</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {areaRows.map((r) => {
                    const tg = targets.district[r.d] ?? 0;
                    const pct = tg ? Math.min(100, (r.approved / tg) * 100) : 0;
                    return (
                      <tr key={r.d} className="hover:bg-slate-50">
                        <td className="px-4 py-2"><Link href={`${base}/sellers?${byTaluk ? "taluk" : "district"}=${encodeURIComponent(r.d)}`} className="hover:text-brand-700">{r.d}</Link></td>
                        {[r.total, r.taluk, r.notRec, r.dic, r.session, r.final, r.rejected].map((v, i) => <td key={i} className="px-3 py-2 text-right tabular-nums text-slate-600">{v}</td>)}
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{r.approved}</td>
                        {!byTaluk && <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-tx-green" style={{ width: `${Math.max(pct, r.approved ? 3 : 0)}%` }} /></div>
                            <span className="w-16 text-right text-xs tabular-nums text-slate-500">{r.approved}/{tg}</span>
                          </div>
                        </td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>}
    </section>
  );
}
