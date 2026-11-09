import "server-only";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DISTRICT_NAMES } from "@/lib/config";
import { parseCerts } from "@/lib/format";
import { getTargets } from "@/lib/targets";
import { productDemand, productKeys } from "@/lib/demand";
import { ITEM_PENDING } from "@/lib/status";

const DAY = 86400000;
const days = (from: Date | null, to: Date | null) => (from && to ? Math.max(0, (to.getTime() - from.getTime()) / DAY) : null);
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? { days: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : { days: null, n: 0 };
};
export const AGE_BUCKETS = ["0–3 days", "4–7 days", "8–14 days", "Over 14 days"] as const;
const bucket = (d: number) => (d <= 3 ? 0 : d <= 7 ? 1 : d <= 14 ? 2 : 3);

export type ReadinessRow = {
  id: string; name: string; approvedNo: string | null; country: string; sectors: string[];
  sectorSellers: number; productSellers: number; status: "ready" | "sector" | "short";
};

/** Directorate insights: matchmaking readiness, supply gaps, where supply and demand sit, and how fast files move. */
export async function buildInsights(user: User) {
  const now = new Date();
  const [targets, products, approvedItems, sellerOffers, nonDraftItems, sellers] = await Promise.all([
    getTargets(),
    productDemand(user),
    prisma.requirementItem.findMany({
      where: { status: "APPROVED" },
      select: { sectorId: true, products: true, sector: { select: { name: true } },
        requirement: { select: { buyer: { select: { id: true, name: true, approvedNo: true, country: true } } } } },
    }),
    prisma.sellerProduct.findMany({
      where: { seller: { status: "APPROVED" } },
      select: { sectorId: true, products: true, sector: { select: { name: true } }, seller: { select: { id: true, district: true, exportExperience: true } } },
    }),
    prisma.requirementItem.findMany({
      where: { status: { not: "DRAFT" } },
      select: { id: true, status: true, sectorId: true, certifications: true, submittedAt: true, recommendedAt: true, approvedAt: true, updatedAt: true,
        sector: { select: { name: true } }, requirement: { select: { buyer: { select: { country: true } } } } },
    }),
    prisma.seller.findMany({ select: { status: true, district: true, createdAt: true, updatedAt: true, recommendedAt: true, trainedAt: true, approvedAt: true } }),
  ]);
  const target = targets.sellersPerBuyer;

  // 1. Matchmaking readiness: approved sellers available to each approved buyer.
  const bySector = new Map<string, { sellers: Set<string>; keys: Map<string, Set<string>> }>();
  for (const o of sellerOffers) {
    const e = bySector.get(o.sectorId) ?? { sellers: new Set(), keys: new Map() };
    e.sellers.add(o.seller.id);
    for (const k of productKeys(o.products)) { const s = e.keys.get(k) ?? new Set(); s.add(o.seller.id); e.keys.set(k, s); }
    bySector.set(o.sectorId, e);
  }
  const buyers = new Map<string, ReadinessRow & { _sector: Set<string>; _product: Set<string> }>();
  for (const it of approvedItems) {
    const b = it.requirement.buyer;
    const r = buyers.get(b.id) ?? { id: b.id, name: b.name, approvedNo: b.approvedNo, country: b.country, sectors: [], sectorSellers: 0, productSellers: 0, status: "short" as const, _sector: new Set<string>(), _product: new Set<string>() };
    r.sectors.push(it.sector.name);
    const sup = bySector.get(it.sectorId);
    if (sup) {
      sup.sellers.forEach((s) => r._sector.add(s));
      for (const k of productKeys(it.products)) sup.keys.get(k)?.forEach((s) => r._product.add(s));
    }
    buyers.set(b.id, r);
  }
  const readiness: ReadinessRow[] = [...buyers.values()].map(({ _sector, _product, ...r }) => ({
    ...r, sectorSellers: _sector.size, productSellers: _product.size,
    status: (_product.size >= target ? "ready" : _sector.size >= target ? "sector" : "short") as ReadinessRow["status"],
  })).sort((a, b) => a.productSellers - b.productSellers || a.sectorSellers - b.sectorSellers);

  // 2. Supply gaps: products buyers want that no approved seller offers; sectors short of sellers.
  const productGaps = products.filter((p) => !p.sellers.length);
  const sectorMap = new Map<string, { id: string; name: string; approvedBuyers: Set<string>; sellers: number; exp: number }>();
  for (const it of approvedItems) {
    const e = sectorMap.get(it.sectorId) ?? { id: it.sectorId, name: it.sector.name, approvedBuyers: new Set(), sellers: 0, exp: 0 };
    e.approvedBuyers.add(it.requirement.buyer.id); sectorMap.set(it.sectorId, e);
  }
  for (const [sid, sup] of bySector) {
    const e = sectorMap.get(sid);
    if (e) { e.sellers = sup.sellers.size; e.exp = sellerOffers.filter((o) => o.sectorId === sid && o.seller.exportExperience).length; }
  }
  const sectorGaps = [...sectorMap.values()].map((s) => ({
    id: s.id, name: s.name, approvedBuyers: s.approvedBuyers.size, sellers: s.sellers, exportReady: s.exp,
    needed: s.approvedBuyers.size * target, shortfall: Math.max(0, s.approvedBuyers.size * target - s.sellers),
  })).sort((a, b) => b.shortfall - a.shortfall || a.name.localeCompare(b.name));

  // 3. Where supply sits: approved sellers by district and sector.
  const supplySectors = [...new Map(sellerOffers.map((o) => [o.sectorId, o.sector.name])).entries()]
    .map(([id, name]) => ({ id, name, n: sellerOffers.filter((o) => o.sectorId === id).length }))
    .sort((a, b) => b.n - a.n).slice(0, 10);
  const districtSector = DISTRICT_NAMES.map((d) => ({
    district: d,
    cells: supplySectors.map((s) => new Set(sellerOffers.filter((o) => o.sectorId === s.id && o.seller.district === d).map((o) => o.seller.id)).size),
    total: new Set(sellerOffers.filter((o) => o.seller.district === d).map((o) => o.seller.id)).size,
  }));

  // 4. Which markets want what: buyer requirements by country and sector.
  const demandSectors = [...new Map(nonDraftItems.map((i) => [i.sectorId, i.sector.name])).entries()]
    .map(([id, name]) => ({ id, name, n: nonDraftItems.filter((i) => i.sectorId === id).length }))
    .sort((a, b) => b.n - a.n).slice(0, 8);
  const countryCount = new Map<string, number>();
  for (const i of nonDraftItems) countryCount.set(i.requirement.buyer.country, (countryCount.get(i.requirement.buyer.country) ?? 0) + 1);
  const countrySector = [...countryCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([country, total]) => ({
    country, total,
    cells: demandSectors.map((s) => nonDraftItems.filter((i) => i.sectorId === s.id && i.requirement.buyer.country === country).length),
  }));

  // 5. Certifications buyers require (approved requirements / all submitted).
  const certs = new Map<string, { all: number; approved: number }>();
  for (const i of nonDraftItems) for (const c of parseCerts(i.certifications)) {
    const e = certs.get(c) ?? { all: 0, approved: 0 };
    e.all++; if (i.status === "APPROVED") e.approved++;
    certs.set(c, e);
  }
  const certifications = [...certs.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.all - a.all || a.name.localeCompare(b.name));

  // 6. Turnaround (average days, including any correction rounds) and age of what is pending now.
  const turnaround = [
    { stage: "Buyer sector: submitted → FIEO recommendation", ...avg(nonDraftItems.map((i) => days(i.submittedAt, i.recommendedAt))) },
    { stage: "Buyer sector: FIEO recommendation → Directorate approval", ...avg(nonDraftItems.map((i) => days(i.recommendedAt, i.approvedAt))) },
    { stage: "Seller: registration → district recommendation", ...avg(sellers.map((s) => days(s.createdAt, s.recommendedAt))) },
    { stage: "Seller: district recommendation → Directorate approval", ...avg(sellers.map((s) => days(s.recommendedAt, s.approvedAt))) },
  ];
  const ageRow = (stage: string, dates: Date[], href: string) => {
    const b = [0, 0, 0, 0];
    for (const d of dates) b[bucket((now.getTime() - d.getTime()) / DAY)]++;
    return { stage, buckets: b, total: dates.length, oldest: dates.length ? Math.floor((now.getTime() - Math.min(...dates.map((d) => d.getTime()))) / DAY) : null, href };
  };
  const ageing = [
    ageRow("Buyer sectors awaiting FIEO", nonDraftItems.filter((i) => i.status === "SUBMITTED").map((i) => i.submittedAt ?? i.updatedAt), "requirements?item=SUBMITTED"),
    ageRow("Buyer sectors awaiting Directorate", nonDraftItems.filter((i) => i.status === "FIEO_RECOMMENDED").map((i) => i.recommendedAt ?? i.updatedAt), "requirements?item=FIEO_RECOMMENDED"),
    ageRow("Buyer sectors returned (with buyer / FIEO)", nonDraftItems.filter((i) => i.status === "FIEO_RETURNED" || i.status === "DIC_RETURNED").map((i) => i.updatedAt), "requirements?item=pending"),
    ageRow("Sellers with taluk offices", sellers.filter((s) => s.status === "WITH_TALUK" || s.status === "RETURNED").map((s) => s.updatedAt), "sellers?status=WITH_TALUK"),
    ageRow("Sellers with applicants for correction", sellers.filter((s) => s.status === "WITH_SELLER").map((s) => s.updatedAt), "sellers?status=WITH_SELLER"),
    ageRow("Sellers awaiting initial approval", sellers.filter((s) => s.status === "RECOMMENDED").map((s) => s.recommendedAt ?? s.updatedAt), "sellers?status=RECOMMENDED"),
    ageRow("Sellers awaiting final approval", sellers.filter((s) => s.status === "TRAINED").map((s) => s.trainedAt ?? s.updatedAt), "sellers?status=TRAINED"),
  ];

  const pendingItems = nonDraftItems.filter((i) => ITEM_PENDING.includes(i.status)).length;
  return {
    target, readiness, productGaps, sectorGaps, supplySectors, districtSector, demandSectors, countrySector, certifications, turnaround, ageing,
    summary: {
      approvedBuyers: readiness.length,
      ready: readiness.filter((r) => r.status === "ready").length,
      short: readiness.filter((r) => r.status === "short").length,
      products: products.length,
      productGaps: productGaps.length,
      pendingItems,
      overdue: ageing.reduce((n, a) => n + a.buckets[2] + a.buckets[3], 0),
    },
  };
}
export type Insights = Awaited<ReturnType<typeof buildInsights>>;
