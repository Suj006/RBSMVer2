import "server-only";
import { prisma } from "@/lib/prisma";
import { getTargets } from "@/lib/targets";
import { DISTRICT_NAMES } from "@/lib/config";
import { coverage, getMatchState } from "@/lib/matchmaking";
import type { Insights } from "@/lib/insights";
import { sellerProfileStats } from "@/lib/seller-profile-stats";

const DAY = 86400000;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export type Finding = { tone: "red" | "amber" | "green" | "blue"; title: string; detail: string; action?: string; href?: string };
export type FunnelStep = { label: string; value: number; href?: string };

/**
 * The decision layer of Insights: funnels, pace against targets, rework, district performance,
 * matchmaking position and plain-language findings with recommended actions.
 */
export async function buildDecisionView(ins: Insights, root: string) {
  const now = Date.now();
  const since14 = new Date(now - 14 * DAY);
  const [targets, buyers, items, sellers, reqReturns, dicReturns, state, profile] = await Promise.all([
    getTargets(),
    prisma.buyer.findMany({ select: { status: true, basicSubmittedAt: true, basicApprovedAt: true, approvedAt: true, createdAt: true,
      requirement: { select: { items: { select: { status: true } } } } } }),
    prisma.requirementItem.findMany({ where: { status: { not: "DRAFT" } }, select: { id: true, status: true } }),
    prisma.seller.findMany({ select: { status: true, district: true, createdAt: true, recommendedAt: true, initialApprovedAt: true, trainedAt: true, approvedAt: true, updatedAt: true,
      logs: { where: { action: { in: ["RETURNED", "SENT_TO_SELLER"] } }, select: { action: true } } } }),
    prisma.reviewLog.findMany({ where: { action: "REQ_RETURNED", itemId: { not: null } }, select: { itemId: true }, distinct: ["itemId"] }),
    prisma.reviewLog.findMany({ where: { action: "DIC_RETURNED", itemId: { not: null } }, select: { itemId: true }, distinct: ["itemId"] }),
    getMatchState(),
    sellerProfileStats(),
  ]);

  // Funnels
  const buyerFunnel: FunnelStep[] = [
    { label: "Signed up", value: buyers.length, href: `${root}/buyers` },
    { label: "Application submitted", value: buyers.filter((b) => b.basicSubmittedAt || b.status !== "SIGNED_UP").length },
    { label: "Verified by FIEO", value: buyers.filter((b) => b.status === "BASIC_APPROVED" || b.status === "APPROVED").length, href: `${root}/buyers?status=basic_approved` },
    { label: "Sector requirement submitted", value: buyers.filter((b) => b.requirement?.items.some((i) => i.status !== "DRAFT")).length },
    { label: "Approved buyer", value: buyers.filter((b) => b.status === "APPROVED").length, href: `${root}/buyers?status=APPROVED` },
  ];
  const sellerFunnel: FunnelStep[] = [
    { label: "Registered", value: sellers.length, href: `${root}/sellers` },
    { label: "Recommended by taluk", value: sellers.filter((s) => s.recommendedAt || ["RECOMMENDED", "RETURNED", "INITIAL_APPROVED", "TRAINED", "APPROVED"].includes(s.status)).length },
    { label: "Initially approved", value: sellers.filter((s) => s.initialApprovedAt || ["INITIAL_APPROVED", "TRAINED", "APPROVED"].includes(s.status)).length },
    { label: "Awareness session attended", value: sellers.filter((s) => s.trainedAt).length },
    { label: "Approved seller", value: sellers.filter((s) => s.status === "APPROVED").length, href: `${root}/sellers?status=APPROVED` },
  ];

  // Pace against targets (approvals in the last 14 days)
  const approvedBuyers = buyerFunnel[4].value;
  const approvedSellers = sellerFunnel[2].value;
  const buyerPace = buyers.filter((b) => b.approvedAt && b.approvedAt >= since14).length / 2; // per week
  const sellerPace = sellers.filter((s) => s.approvedAt && s.approvedAt >= since14).length / 2;
  const weeksTo = (left: number, pace: number) => (left <= 0 ? 0 : pace ? Math.ceil(left / pace) : null);
  const pace = [
    { label: "Approved buyers", value: approvedBuyers, target: targets.buyers, perWeek: buyerPace, weeks: weeksTo(targets.buyers - approvedBuyers, buyerPace), href: `${root}/approved` },
    { label: "Approved sellers", value: approvedSellers, target: targets.sellers, perWeek: sellerPace, weeks: weeksTo(targets.sellers - approvedSellers, sellerPace), href: `${root}/seller-list` },
  ];

  // Rework: how often files are sent back
  const submittedItems = items.length;
  const rework = [
    { label: "Buyer sectors returned by FIEO to the buyer", count: reqReturns.length, of: submittedItems, href: `${root}/requirements?item=FIEO_RETURNED` },
    { label: "Buyer sectors returned by the Directorate to FIEO", count: dicReturns.length, of: submittedItems, href: `${root}/requirements?item=DIC_RETURNED` },
    { label: "Sellers returned by the Directorate to districts", count: sellers.filter((s) => s.logs.some((l) => l.action === "RETURNED")).length, of: sellerFunnel[1].value, href: `${root}/sellers?status=RETURNED` },
    { label: "Sellers sent back to applicants for correction", count: sellers.filter((s) => s.logs.some((l) => l.action === "SENT_TO_SELLER")).length, of: sellers.length, href: `${root}/sellers?status=WITH_SELLER` },
    { label: "Sellers rejected", count: sellers.filter((s) => s.status === "REJECTED").length, of: sellers.length, href: `${root}/sellers?status=REJECTED` },
  ];

  // District performance
  const districts = DISTRICT_NAMES.map((d) => {
    const ds = sellers.filter((s) => s.district === d);
    const approved = ds.filter((s) => s.status === "APPROVED").length;
    const target = targets.district[d] ?? 0;
    const rec = ds.filter((s) => s.recommendedAt).map((s) => (s.recommendedAt!.getTime() - s.createdAt.getTime()) / DAY);
    const waiting = ds.filter((s) => (s.status === "WITH_TALUK" || s.status === "RETURNED") && now - s.updatedAt.getTime() > 7 * DAY).length;
    return {
      district: d, registered: ds.length, approved, target, achieved: target ? approved / target : 0,
      pendingWithDistrict: ds.filter((s) => s.status === "WITH_TALUK" || s.status === "RETURNED").length, waitingOver7: waiting,
      avgDaysToRecommend: rec.length ? rec.reduce((a, b) => a + b, 0) / rec.length : null,
      rejected: ds.filter((s) => s.status === "REJECTED").length,
    };
  }).sort((a, b) => b.achieved - a.achieved || b.approved - a.approved);

  // Matchmaking position (published, else working list)
  const cov = await coverage(state.version ? "published" : "draft");

  // Findings
  const f: Finding[] = [];
  const s = ins.summary;
  const bConv = pct(approvedBuyers, buyers.length);
  if (pace[0].value < pace[0].target)
    f.push({ tone: pace[0].weeks === null || pace[0].weeks > 4 ? "red" : "amber", title: `Approved buyers: ${approvedBuyers} of ${targets.buyers} (${pct(approvedBuyers, targets.buyers)}%)`,
      detail: pace[0].perWeek ? `At the last two weeks' pace (${pace[0].perWeek.toFixed(1)} a week) the target is about ${pace[0].weeks} week${pace[0].weeks === 1 ? "" : "s"} away.` : "No buyer was approved in the last two weeks.",
      action: "Step up buyer outreach through FIEO and Indian missions; clear pending approvals.", href: `${root}/buyers?status=action` });
  if (pace[1].value < pace[1].target)
    f.push({ tone: pace[1].weeks === null || pace[1].weeks > 4 ? "red" : "amber", title: `Approved sellers: ${approvedSellers} of ${targets.sellers} (${pct(approvedSellers, targets.sellers)}%)`,
      detail: pace[1].perWeek ? `${pace[1].perWeek.toFixed(1)} approvals a week recently — about ${pace[1].weeks} week${pace[1].weeks === 1 ? "" : "s"} to target.` : "No seller was approved in the last two weeks.",
      action: "Ask districts below target to mobilise sellers; approve recommended sellers.", href: `${root}/sellers?status=RECOMMENDED` });
  const dropIdx = buyerFunnel.slice(1).map((st, i) => ({ st, prev: buyerFunnel[i], lost: buyerFunnel[i].value - st.value })).sort((a, b) => b.lost - a.lost)[0];
  if (dropIdx && dropIdx.lost > 0)
    f.push({ tone: "amber", title: `Biggest buyer drop-off: before “${dropIdx.st.label}”`,
      detail: `${dropIdx.lost} of ${dropIdx.prev.value} buyers have not moved past “${dropIdx.prev.label}”. Overall, ${bConv}% of sign-ups are approved buyers.`,
      action: "Follow up with these buyers by e-mail / phone.", href: `${root}/buyers` });
  if (s.overdue) f.push({ tone: "red", title: `${s.overdue} files pending for more than a week`, detail: "Buyer sectors and sellers waiting at one stage for over 7 days.", action: "Clear the oldest items first (see Turnaround and ageing).", href: "#speed" });
  const lagging = districts.filter((d) => d.target && d.achieved < 0.5);
  if (lagging.length) f.push({ tone: "amber", title: `${lagging.length} district${lagging.length > 1 ? "s" : ""} below half of target`,
    detail: lagging.slice(0, 5).map((d) => `${d.district} ${d.approved}/${d.target}`).join(", ") + (lagging.length > 5 ? "…" : ""),
    action: "Review mobilisation with these District Industries Centres.", href: "#districts" });
  if (s.short) f.push({ tone: "amber", title: `${s.short} approved buyer${s.short > 1 ? "s" : ""} short of sellers in their sectors`, detail: `Fewer than ${ins.target} approved sellers exist in their approved sectors.`, action: "Mobilise sellers in these sectors before matchmaking.", href: "#readiness" });
  if (s.productGaps) f.push({ tone: "amber", title: `${s.productGaps} requested product${s.productGaps > 1 ? "s have" : " has"} no approved supplier`, detail: "Buyers asked for them; no approved seller offers them yet.", action: "Share the list with district centres.", href: `${root}/products?view=gaps` });
  if (profile.summary.pending) f.push({ tone: "amber", title: `${profile.summary.pending} approved seller${profile.summary.pending > 1 ? "s have" : " has"} not completed the seller profile`,
    detail: `${profile.summary.completed} of ${profile.summary.approved} profiles completed. The profile (promoter and unit details) is needed before a seller can send buyer preferences.`,
    action: "Ask district centres to remind these sellers.", href: `${root}/seller-list?profile=pending` });
  const certGaps = profile.certReadiness.filter((c) => c.inSector === 0);
  if (certGaps.length) f.push({ tone: "amber", title: `${certGaps.length} certification${certGaps.length > 1 ? "s" : ""} buyers require ${certGaps.length > 1 ? "are" : "is"} held by no approved seller in the sector`,
    detail: certGaps.slice(0, 5).map((c) => `${c.name} (${c.buyerSectors} buyer sector${c.buyerSectors > 1 ? "s" : ""})`).join(", ") + (certGaps.length > 5 ? "…" : ""),
    action: "Plan certification support for MSMEs in these sectors.", href: "#certs" });
  const highRework = rework.filter((r) => r.of && r.count / r.of >= 0.2);
  for (const r of highRework) f.push({ tone: "blue", title: `${pct(r.count, r.of)}% rework: ${r.label.toLowerCase()}`, detail: `${r.count} of ${r.of}.`, action: "Check whether guidance or forms need to be clearer.", href: r.href });
  if (state.version) {
    if (cov.buyersBelow.length) f.push({ tone: "amber", title: `Published matchmaking: ${cov.buyersBelow.length} buyer${cov.buyersBelow.length > 1 ? "s" : ""} below ${cov.target} sellers`, detail: `${cov.sellersNeeded} more seller slot${cov.sellersNeeded === 1 ? "" : "s"} needed; ${cov.sellersWithout.length} approved seller${cov.sellersWithout.length === 1 ? " has" : "s have"} no buyer.`, action: "Adjust the mapping and republish.", href: `${root}/matchmaking/results` });
    else f.push({ tone: "green", title: "Every approved buyer has the target number of sellers", detail: `Published version ${state.version}: ${cov.pairs} pairs.`, href: `${root}/matchmaking/results` });
  } else if (approvedBuyers) {
    f.push({ tone: "blue", title: "Matchmaking not published yet", detail: `${cov.pairs} pairs in the working list; preferences ${state.prefsFrozen ? "frozen" : "open"}.`, action: "Freeze preferences, build the mapping and publish.", href: `${root}/matchmaking` });
  }
  if (!f.length) f.push({ tone: "green", title: "No issues stand out", detail: "Targets are on track and nothing is overdue." });

  return { buyerFunnel, sellerFunnel, pace, rework, districts, cov, state, profile, findings: f };
}
export type DecisionView = Awaited<ReturnType<typeof buildDecisionView>>;
