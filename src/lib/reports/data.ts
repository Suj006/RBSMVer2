import "server-only";
import type { User } from "@/generated/prisma/client";
import type { BuyerStatus, ItemStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { buyerWhere, itemScope, scopeFor, type BuyerFilters } from "@/lib/buyer-query";
import { ACTION_LABEL, ALL_ITEM_STATUSES, ALL_STATUSES, ITEM_META, ROLE_LABEL, STATUS_META } from "@/lib/status";
import { fmtDate, fmtDateTime, parseCerts } from "@/lib/format";
import { EVENT } from "@/lib/config";
import type { Column, Kpi, Report, Row, Table } from "./types";
import { describeProfileFilters, sellerScope, sellerWhere, type SellerFilters } from "@/lib/seller-query";
import { ALL_SELLER_STATUSES, SELLER_ACTION_LABEL, SELLER_META } from "@/lib/status";
import type { SellerStatus } from "@/generated/prisma/enums";
import { CONSTITUTIONS, DISTRICT_NAMES, GENDERS, localBodyLabel, optLabel, SOCIAL_CATEGORIES, UNIT_CATEGORIES, UNIT_TYPES } from "@/lib/config";
import { fmtMobile } from "@/lib/text";
import { getTargets } from "@/lib/targets";
import { productDemand, sectorDemandSummary } from "@/lib/demand";
import { AGE_BUCKETS, buildInsights } from "@/lib/insights";
import { buildDecisionView } from "@/lib/decision";
import { buyerPrimarySectors, fmtDay, fmtTime, getEventConfig, LIVE_META, liveStatus, unscheduledPairs, type Live } from "@/lib/event";
import { sellerProfileStats } from "@/lib/seller-profile-stats";
import { fmtSlot } from "@/lib/training";
import { fmtMonth, getMouRate, MOU_STATUS, mouStage, mouWhere, toMoney, type MouFilters } from "@/lib/mou";
import { buyerNeeds, coverage, fit, getMatchState, loadPool, matchChecks, preferenceOutcomes, sellerOffers, SOURCE_LABEL, whyMatched } from "@/lib/matchmaking";

export const REPORTS = {
  "buyer-register": {
    title: "Buyer Registration Register",
    description: "All registered buyers with contact details, registration stage and sector-wise approval status.",
  },
  "sector-requirements": {
    title: "Sector-wise Requirement Report",
    description: "Each buyer's sourcing requirement by sector — products, specifications, certifications and approval status.",
  },
  "approved-buyers": {
    title: "RBSM Approved Buyer List",
    description: "Complete details of buyers approved by the Directorate: contact, sourcing profile, and every approved sector with products, specifications, certifications and volumes.",
  },
  "approved-sellers": {
    title: "RBSM Approved Seller List",
    description: "Complete details of sellers approved by the Directorate: Udyam and IEC numbers, location, promoter contact, export experience, certifications, seller profile, and every sector with the products ready to export.",
  },
  "seller-register": {
    title: "Seller Registration Register",
    description: "Kerala MSME sellers with Udyam and IEC numbers, location, promoter details, certifications, sectors and products ready to export, and approval status.",
  },
  "seller-district-summary": {
    title: "District-wise Seller Summary",
    description: "Seller registrations and approvals by district, against the targets set by the Directorate.",
  },
  "seller-taluk-summary": {
    title: "Taluk-wise Seller Summary",
    description: "Seller registrations at every stage — taluk verification, recommendation, initial approval, awareness session, final approval — taluk by taluk.",
  },
  "awareness-attendance": {
    title: "Awareness Session Attendance",
    description: "Awareness sessions with date, time and venue; every seller placed in each session with attendance; sellers awaiting a session; sellers absent; and sellers given final approval without a session.",
  },
  "seller-profile-analysis": {
    title: "Seller Profile Analysis",
    description: "Approved sellers by promoter (women, SC / ST, specially abled), unit category, type and constitution, IEC, certifications and export markets — district-wise, with profiles still pending.",
  },
  "sector-demand": {
    title: "Sector Demand Report",
    description: "Sector by sector: buyers, products requested (with the buyers asking for each), certifications, and approved sellers offering the sector.",
  },
  "product-demand": {
    title: "Product Demand Report",
    description: "Every product buyers have requested, by sector: buyers asking for it (approved / pending), their countries, and the approved sellers offering it — supply gaps highlighted.",
  },
  "insights": {
    title: "Directorate Insights",
    description: "Key findings with recommended actions, registration funnels, pace to targets, district performance, rework, seller profile, certification readiness, matchmaking readiness, supply gaps, district × sector supply, markets × sectors demand, certifications required, turnaround and ageing.",
  },
  "match-list": {
    title: "Buyer–Seller Mapping",
    description: "Steps 4–6 — every buyer–seller pair with the buyer's approved sectors and products, the seller's sectors and products, and why they are matched (common sector, matching products, certifications, preference); buyer-wise and seller-wise summaries.",
  },
  "match-buyer-directory": {
    title: "Buyer Directory for Sellers",
    description: "Step 1 — the approved buyers and approved sector requirements shown to approved sellers: products, specifications, certifications, volumes, approved sellers per sector and preferences received.",
  },
  "match-checks": {
    title: "Matchmaking Checks",
    description: "Step 5 — working-list mappings that look incorrect (not approved any more, no common sector, no matching product, missing certifications, below / above target, over-assigned sellers). For reference; they do not stop publishing.",
  },
  "seller-preferences": {
    title: "Seller Preferences and Outcome",
    description: "Steps 2–3 — each approved seller's tentative buyer preferences (rank 1–5) with both sides' sectors and products, the fit, and whether each made it into the working list and the published mapping; sellers yet to respond; preferences received by each buyer.",
  },
  "match-coverage": {
    title: "Matchmaking Results and Gaps",
    description: "Buyers below target, sellers without buyers, sector coverage, requested products not covered and district position.",
  },
  "event-schedule": {
    title: "Meeting Schedule",
    description: "Event days — every buyer–seller meeting by day, time and pavilion with ticket numbers; buyer-wise and seller-wise schedules; pavilions and nodal officers.",
  },
  "event-attendance": {
    title: "Event Day Attendance",
    description: "Event days — status of every meeting (completed, seller / buyer absent, not marked), day-wise summary, buyers' attendance and each nodal officer's marking.",
  },
  "communications": {
    title: "Communications Log",
    description: "Buyer–seller discussions, programme-desk conversations and common communications: every message with its sender, the documents shared (by name) and who has read each communication.",
  },
  "mou-register": {
    title: "MoU Register",
    description: "Memoranda of understanding signed after buyer–seller meetings: MoU number, buyer and seller with their IDs, goods, approximate value in US$ and INR, expected order month and verification — with country-, sector- and district-wise totals.",
  },
  "mis-summary": {
    title: "MIS Summary Report",
    description: "Programme-level summary: registration pipeline, sector approvals, country-wise and sector-wise position.",
  },
} as const;

export type ReportId = keyof typeof REPORTS;
/** Reports a role may open (district offices: seller reports only). */
export const reportsFor = (role: User["role"]): ReportId[] =>
  role === "DISTRICT" ? ["approved-sellers", "seller-register", "seller-district-summary", "seller-taluk-summary", "awareness-attendance", "seller-profile-analysis", "match-list"] as ReportId[]
  : role === "TALUK" ? ["approved-sellers", "seller-register", "seller-taluk-summary", "awareness-attendance"] as ReportId[]
  : role === "TRAINING" ? ["awareness-attendance"] as ReportId[]
  // Promoter details (gender, social category…) are internal to the Directorate and districts.
  : role === "FIEO" ? (Object.keys(REPORTS) as ReportId[]).filter((id) => !["seller-taluk-summary", "awareness-attendance", "insights", "seller-preferences", "match-coverage", "match-checks", "match-buyer-directory", "seller-profile-analysis"].includes(id))
  : role === "DIC" || role === "ADMIN" ? (Object.keys(REPORTS) as ReportId[])
  : [];
export const isReportId = (s: string): s is ReportId => s in REPORTS;

const stamp = (d: Date) => d.toISOString().slice(0, 10);

async function describeFilters(f: BuyerFilters): Promise<string[]> {
  const out: string[] = [];
  if (f.q) out.push(`Search: "${f.q}"`);
  if (f.status === "action") out.push("Buyer status: pending action");
  else if (f.status === "basic_approved") out.push("Buyer status: basic details approved");
  else if (f.status === "basic_pending") out.push("Buyer status: basic details not submitted / returned");
  else if (f.status && ALL_STATUSES.includes(f.status as BuyerStatus)) out.push(`Buyer status: ${STATUS_META[f.status as BuyerStatus].label}`);
  if (f.item && ALL_ITEM_STATUSES.includes(f.item as ItemStatus)) out.push(`Sector status: ${ITEM_META[f.item as ItemStatus].label}`);
  if (f.sector) {
    const s = await prisma.sector.findUnique({ where: { id: f.sector }, select: { name: true } });
    if (s) out.push(`Sector: ${s.name}`);
  }
  if (f.country) out.push(`Country: ${f.country}`);
  return out;
}

function base(id: ReportId, user: User, filters: string[], orientation: Report["orientation"] = "landscape") {
  const generatedAt = new Date();
  return {
    id,
    title: REPORTS[id].title,
    description: REPORTS[id].description,
    generatedAt,
    generatedBy: `${user.displayName} (${ROLE_LABEL[user.role]})`,
    filters,
    orientation,
    fileName: `TRADEX-RBSM-${REPORTS[id].title.replace(/[^A-Za-z0-9]+/g, "-")}-${stamp(generatedAt)}`,
  };
}

const sectorItemFilter = (user: User, f: BuyerFilters) => ({
  ...itemScope(user.role),
  ...(f.sector ? { sectorId: f.sector } : {}),
  ...(f.item && ALL_ITEM_STATUSES.includes(f.item as ItemStatus) ? { status: f.item as ItemStatus } : {}),
});

// ---------------------------------------------------------------- buyer register

async function buyerRegister(user: User, f: BuyerFilters): Promise<Report> {
  const buyers = await prisma.buyer.findMany({
    where: buyerWhere(user.role, f),
    orderBy: { seq: "asc" },
    include: {
      user: { select: { username: true } },
      requirement: { include: { items: { where: itemScope(user.role), orderBy: { sortOrder: "asc" }, include: { sector: true } } } },
    },
  });
  const rows: Row[] = buyers.map((b, i) => {
    const items = b.requirement?.items ?? [];
    return {
      sl: i + 1, regNo: b.regNo, approvedNo: b.approvedNo, username: b.user.username, name: b.name, country: b.country,
      pocName: b.pocName, pocDesignation: b.pocDesignation, email: b.pocEmail ?? b.signupEmail, mobile: b.pocMobile,
      status: b.status,
      sectors: items.map((it) => `${it.sector.name} (${ITEM_META[it.status].short}): ${it.products}`).join("\n"),
      approvedSectors: items.filter((it) => it.status === "APPROVED").length,
      totalSectors: items.length,
      createdAt: b.createdAt, basicApprovedAt: b.basicApprovedAt, approvedAt: b.approvedAt,
      source: b.source === "SELF" ? "Self sign-up" : b.source === "BULK" ? "FIEO bulk upload" : "Added by FIEO",
      login: b.source === "SELF" ? b.user.username : `${b.user.username} (${b.status === "APPROVED" ? "permanent" : "temporary"})`,
    };
  });
  const n = (s: BuyerStatus[]) => buyers.filter((b) => s.includes(b.status)).length;
  const kpis: Kpi[] = [
    { label: "Buyers", value: buyers.length, tone: "blue" },
    { label: "Approved buyers", value: n(["APPROVED"]), tone: "green" },
    { label: "Verified by FIEO, sectors in approval", value: n(["BASIC_APPROVED"]), tone: "violet" },
    { label: "Application not submitted / with FIEO", value: n(["SIGNED_UP", "BASIC_SUBMITTED", "BASIC_RETURNED"]), tone: "yellow" },
  ];
  return {
    ...base("buyer-register", user, await describeFilters(f)),
    kpis,
    tables: [{
      name: "Buyer Register",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "regNo", header: "Reg. No.", width: 14, kind: "mono" },
        { key: "approvedNo", header: "Buyer No.", width: 18, kind: "mono" },
        { key: "name", header: "Buyer Name", width: 26 },
        { key: "country", header: "Country", width: 16 },
        { key: "pocName", header: "Contact Person", width: 20 },
        { key: "pocDesignation", header: "Designation", width: 18 },
        { key: "email", header: "E-mail", width: 28 },
        { key: "mobile", header: "Mobile", width: 17 },
        { key: "status", header: "Registration Status", width: 20, kind: "buyerStatus" },
        { key: "sectors", header: "Sectors (Status): Products", width: 46 },
        { key: "approvedSectors", header: "Approved Sectors", width: 13, kind: "number", align: "center" },
        { key: "source", header: "Registered By", width: 16 },
        { key: "login", header: "Login", width: 26, excelOnly: true },
        { key: "createdAt", header: "Registered On", width: 15, kind: "date" },
        { key: "approvedAt", header: "Approved On", width: 15, kind: "date" },
      ],
      rows,
    }],
  };
}

// ---------------------------------------------------------------- sector-wise requirements

async function sectorRequirements(user: User, f: BuyerFilters): Promise<Report> {
  const items = await prisma.requirementItem.findMany({
    where: { ...sectorItemFilter(user, f), requirement: { buyer: buyerWhere(user.role, f) } },
    orderBy: [{ sector: { sortOrder: "asc" } }, { sector: { name: "asc" } }, { requirement: { buyer: { seq: "asc" } } }],
    include: { sector: true, requirement: { include: { buyer: true } } },
  });
  const rows: Row[] = items.map((it, i) => {
    const b = it.requirement.buyer;
    return {
      sl: i + 1, sector: it.sector.name, buyer: b.name, regNo: b.regNo, approvedNo: b.approvedNo, country: b.country,
      products: it.products, specifications: it.specifications, certifications: parseCerts(it.certifications).join(", "),
      quantity: it.quantity, orgType: it.requirement.organisationType, value: it.requirement.annualSourcingValue,
      status: it.status, submittedAt: it.submittedAt, approvedAt: it.approvedAt,
    };
  });
  const n = (s: ItemStatus[]) => items.filter((it) => s.includes(it.status)).length;
  return {
    ...base("sector-requirements", user, await describeFilters(f)),
    kpis: [
      { label: "Sector requirements", value: items.length, tone: "blue" },
      { label: "Approved", value: n(["APPROVED"]), tone: "green" },
      { label: "Under review", value: n(["SUBMITTED", "FIEO_RECOMMENDED", "DIC_RETURNED"]), tone: "yellow" },
      { label: "Returned / draft", value: n(["FIEO_RETURNED", "DRAFT"]), tone: "red" },
    ],
    tables: [{
      name: "Sector Requirements",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "sector", header: "Sector", width: 22 },
        { key: "buyer", header: "Buyer Name", width: 24 },
        { key: "regNo", header: "Reg. No.", width: 14, kind: "mono" },
        { key: "country", header: "Country", width: 15 },
        { key: "products", header: "Products", width: 30 },
        { key: "specifications", header: "Specifications", width: 30 },
        { key: "certifications", header: "Certifications Required", width: 26 },
        { key: "quantity", header: "Indicative Volume", width: 16 },
        { key: "value", header: "Annual Sourcing Value", width: 18 },
        { key: "status", header: "Status", width: 22, kind: "itemStatus" },
        { key: "approvedAt", header: "Approved On", width: 15, kind: "date" },
      ],
      rows,
    }],
  };
}

// ---------------------------------------------------------------- approved buyers

async function approvedBuyers(user: User, f: BuyerFilters): Promise<Report> {
  const buyers = await prisma.buyer.findMany({
    where: { AND: [buyerWhere(user.role, f), { status: "APPROVED" }] },
    orderBy: { approvedSeq: "asc" },
    include: { requirement: { include: { items: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" }, include: { sector: true } } } } },
  });
  const sectors = new Set(buyers.flatMap((b) => b.requirement?.items.map((i) => i.sectorId) ?? []));
  return {
    ...base("approved-buyers", user, await describeFilters({ ...f, status: undefined })),
    kpis: [
      { label: "Approved buyers", value: buyers.length, tone: "green" },
      { label: "Approved sector requirements", value: buyers.reduce((n, b) => n + (b.requirement?.items.length ?? 0), 0), tone: "blue" },
      { label: "Sectors covered", value: sectors.size, tone: "violet" },
      { label: "Countries", value: new Set(buyers.map((b) => b.country)).size, tone: "yellow" },
    ],
    tables: [
      {
        name: "Approved Buyers",
        heading: "1. Approved buyers",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Buyer No.", width: 19, kind: "mono" },
          { key: "regNo", header: "Reg. No.", width: 13, kind: "mono", excelOnly: true },
          { key: "name", header: "Buyer Name", width: 26 },
          { key: "country", header: "Country", width: 15 },
          { key: "pocName", header: "Contact Person", width: 20 },
          { key: "pocDesignation", header: "Designation", width: 18 },
          { key: "email", header: "E-mail", width: 28 },
          { key: "mobile", header: "Mobile", width: 17 },
          { key: "orgType", header: "Organisation Type", width: 18 },
          { key: "value", header: "Annual Sourcing Value", width: 18 },
          { key: "timeline", header: "Sourcing Timeline", width: 18, excelOnly: true },
          { key: "engagement", header: "Preferred Engagement", width: 18, excelOnly: true },
          { key: "sectors", header: "Approved Sectors & Products", width: 44 },
          { key: "approvedAt", header: "Approved On", width: 14, kind: "date" },
        ],
        rows: buyers.map((b, i) => ({
          sl: i + 1, approvedNo: b.approvedNo, regNo: b.regNo, name: b.name, country: b.country, pocName: b.pocName, pocDesignation: b.pocDesignation,
          email: b.pocEmail ?? b.signupEmail, mobile: b.pocMobile,
          orgType: b.requirement?.organisationType, value: b.requirement?.annualSourcingValue, timeline: b.requirement?.sourcingTimeline,
          engagement: b.requirement?.preferredEngagement,
          sectors: b.requirement?.items.map((it) => `${it.sector.name}: ${it.products}`).join("\n"),
          approvedAt: b.approvedAt,
        })),
      },
      {
        name: "Approved Sector Requirements",
        heading: "2. Approved sector requirements",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Buyer No.", width: 19, kind: "mono" },
          { key: "name", header: "Buyer Name", width: 24 },
          { key: "country", header: "Country", width: 14 },
          { key: "sector", header: "Sector", width: 22 },
          { key: "products", header: "Products", width: 30 },
          { key: "specifications", header: "Specifications", width: 30 },
          { key: "certifications", header: "Certifications Required", width: 26 },
          { key: "quantity", header: "Indicative Volume", width: 18 },
          { key: "approvedAt", header: "Approved On", width: 14, kind: "date" },
        ],
        rows: buyers.flatMap((b) => (b.requirement?.items ?? []).map((it) => ({ b, it }))).map(({ b, it }, i) => ({
          sl: i + 1, approvedNo: b.approvedNo, name: b.name, country: b.country, sector: it.sector.name, products: it.products,
          specifications: it.specifications, certifications: parseCerts(it.certifications).join(", "), quantity: it.quantity, approvedAt: it.approvedAt,
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------- approved sellers (complete details)

/** Promoter details (gender, date of birth, social category, specially abled) are internal: not for FIEO. */
const PERSONAL_ROLES = new Set(["DIC", "ADMIN", "DISTRICT"]);

/** Excel-only profile columns appended to seller lists. */
function profileColumns(personal: boolean): Column[] {
  return [
    { key: "block", header: "Block", width: 14, excelOnly: true },
    ...(personal ? [
      { key: "gender", header: "Promoter Gender", width: 12, excelOnly: true },
      { key: "dob", header: "Promoter Date of Birth", width: 13, kind: "date" as const, excelOnly: true },
      { key: "social", header: "Social Category", width: 11, excelOnly: true },
      { key: "abled", header: "Specially Abled", width: 10, excelOnly: true },
    ] : []),
    { key: "constitution", header: "Constitution of Unit", width: 22, excelOnly: true },
    { key: "category", header: "Category of Unit", width: 11, excelOnly: true },
    { key: "unitType", header: "Unit Type", width: 13, excelOnly: true },
    { key: "profile", header: "Profile Completed On", width: 14, kind: "date", excelOnly: true },
  ];
}
type ProfileSrc = { block: string | null; promoterGender: string | null; promoterDob: Date | null; socialCategory: string | null;
  speciallyAbled: boolean | null; constitution: string | null; unitCategory: string | null; unitType: string | null; profileCompletedAt: Date | null };
function profileRow(x: ProfileSrc, personal: boolean): Row {
  return {
    block: x.block ?? "",
    ...(personal ? { gender: optLabel(GENDERS, x.promoterGender), dob: x.promoterDob, social: optLabel(SOCIAL_CATEGORIES, x.socialCategory),
      abled: x.speciallyAbled === null ? "" : x.speciallyAbled ? "Yes" : "No" } : {}),
    constitution: optLabel(CONSTITUTIONS, x.constitution), category: optLabel(UNIT_CATEGORIES, x.unitCategory), unitType: optLabel(UNIT_TYPES, x.unitType),
    profile: x.profileCompletedAt,
  };
}

async function approvedSellers(user: User, f: SellerFilters): Promise<Report> {
  const personal = PERSONAL_ROLES.has(user.role);
  const sellers = await prisma.seller.findMany({
    where: { AND: [sellerWhere(user, { ...f, status: undefined }), { status: "APPROVED" }] },
    orderBy: { approvedSeq: "asc" },
    include: { products: { orderBy: { sortOrder: "asc" }, include: { sector: true } } },
  });
  const filters = (await describeSellerFilters(user, { ...f, status: undefined })).filter((x) => x !== "Approved sellers only");
  return {
    ...base("approved-sellers", user, filters),
    kpis: [
      { label: "Approved sellers", value: sellers.length, tone: "green" },
      { label: "With export experience", value: sellers.filter((x) => x.exportExperience).length, tone: "blue" },
      { label: "Sectors covered", value: new Set(sellers.flatMap((x) => x.products.map((p) => p.sectorId))).size, tone: "violet" },
      { label: "Profiles completed", value: `${sellers.filter((x) => x.profileCompletedAt).length} / ${sellers.length}`, tone: "yellow" },
    ],
    tables: [
      {
        name: "Approved Sellers",
        heading: "1. Approved sellers",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Seller No.", width: 19, kind: "mono" },
          { key: "regNo", header: "Reg. No.", width: 13, kind: "mono", excelOnly: true },
          { key: "name", header: "Name of Seller", width: 26 },
          { key: "district", header: "District", width: 16 },
          { key: "taluk", header: "Taluk", width: 16, excelOnly: true },
          { key: "localBody", header: "Local Body", width: 20 },
          { key: "udyamNo", header: "Udyam Number", width: 21, kind: "mono" },
          { key: "exp", header: "Export Exp.", width: 9, align: "center" },
          { key: "contact", header: "Name of Promoter", width: 18 },
          { key: "mobile", header: "Mobile", width: 15 },
          { key: "whatsapp", header: "WhatsApp", width: 15, excelOnly: true },
          { key: "email", header: "E-mail", width: 26 },
          { key: "iecNo", header: "IEC Number", width: 13, kind: "mono", excelOnly: true },
          { key: "certs", header: "Certifications", width: 30, excelOnly: true },
          { key: "expCountries", header: "Countries Exported To", width: 30, excelOnly: true },
          { key: "expProducts", header: "Products Exported", width: 30, excelOnly: true },
          { key: "sectors", header: "Sectors & Products Ready to Export", width: 44 },
          { key: "approvedAt", header: "Approved On", width: 14, kind: "date" },
          ...profileColumns(personal),
        ],
        rows: sellers.map((x, i) => ({
          sl: i + 1, approvedNo: x.approvedNo, regNo: x.regNo, name: x.name, district: x.district, taluk: x.taluk,
          localBody: `${x.localBodyName} ${localBodyLabel(x.localBodyType)}`, udyamNo: x.udyamNo, exp: x.exportExperience ? "Yes" : "No",
          contact: x.contactName, mobile: fmtMobile(x.contactMobile), whatsapp: fmtMobile(x.contactWhatsapp), email: x.contactEmail,
          iecNo: x.iecNo ?? "", certs: parseCerts(x.certifications).join(", "),
          expCountries: parseCerts(x.exportCountries).join(", "), expProducts: x.exportedProducts ?? "",
          sectors: x.products.map((p) => `${p.sector.name}: ${p.products}`).join("\n"), approvedAt: x.approvedAt,
          ...profileRow(x, personal),
        })),
      },
      {
        name: "Profile & Credentials",
        heading: "3. Seller profile and export credentials",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Seller No.", width: 19, kind: "mono" },
          { key: "name", header: "Name of Seller", width: 24 },
          { key: "district", header: "District", width: 14 },
          { key: "block", header: "Block", width: 14 },
          ...(personal ? [
            { key: "gender", header: "Promoter Gender", width: 11 },
            { key: "social", header: "Social Category", width: 10 },
            { key: "abled", header: "Specially Abled", width: 9, align: "center" as const },
          ] : []),
          { key: "constitution", header: "Constitution", width: 18 },
          { key: "category", header: "Category", width: 9 },
          { key: "unitType", header: "Unit Type", width: 13 },
          { key: "iecNo", header: "IEC Number", width: 13, kind: "mono" },
          { key: "certs", header: "Certifications", width: 30 },
          { key: "expCountries", header: "Exported To", width: 26 },
          { key: "profile", header: "Profile", width: 11 },
        ],
        rows: sellers.map((x, i) => ({
          sl: i + 1, approvedNo: x.approvedNo, name: x.name, district: x.district, block: x.block ?? "",
          gender: optLabel(GENDERS, x.promoterGender), social: optLabel(SOCIAL_CATEGORIES, x.socialCategory),
          abled: x.speciallyAbled === null ? "" : x.speciallyAbled ? "Yes" : "No",
          constitution: optLabel(CONSTITUTIONS, x.constitution), category: optLabel(UNIT_CATEGORIES, x.unitCategory), unitType: optLabel(UNIT_TYPES, x.unitType),
          iecNo: x.iecNo ?? "", certs: parseCerts(x.certifications).join(", ") || "None", expCountries: parseCerts(x.exportCountries).join(", "), profile: x.profileCompletedAt ? "Completed" : "Pending",
        })),
      },
      {
        name: "Sectors & Products",
        heading: "2. Sectors and products ready to export",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Seller No.", width: 19, kind: "mono" },
          { key: "name", header: "Name of Seller", width: 26 },
          { key: "district", header: "District", width: 16 },
          { key: "sector", header: "Sector", width: 24 },
          { key: "products", header: "Products Ready to Export", width: 44 },
          { key: "exp", header: "Export Exp.", width: 9, align: "center" },
        ],
        rows: sellers.flatMap((x) => x.products.map((p) => ({ x, p }))).map(({ x, p }, i) => ({
          sl: i + 1, approvedNo: x.approvedNo, name: x.name, district: x.district, sector: p.sector.name, products: p.products,
          exp: x.exportExperience ? "Yes" : "No",
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------- MIS summary

async function misSummary(user: User): Promise<Report> {
  const scope = scopeFor(user.role);
  const iScope = itemScope(user.role);
  const [buyers, items] = await Promise.all([
    prisma.buyer.findMany({ where: scope, select: { id: true, status: true, country: true } }),
    prisma.requirementItem.findMany({
      where: iScope,
      select: { status: true, sector: { select: { name: true, sortOrder: true } }, requirement: { select: { buyer: { select: { country: true } } } } },
    }),
  ]);
  const pct = (n: number, d: number) => (d ? n / d : null);

  const buyerStatuses = user.role === "DIC" ? (["BASIC_APPROVED", "APPROVED"] as BuyerStatus[]) : ALL_STATUSES;
  const buyerTable: Table = {
    name: "Registration Pipeline",
    heading: "1. Buyer registration pipeline",
    columns: [
      { key: "label", header: "Registration Stage", width: 34 },
      { key: "count", header: "Buyers", width: 12, kind: "number", align: "right" },
      { key: "share", header: "Share", width: 12, kind: "percent", align: "right" },
    ],
    rows: buyerStatuses.map((s) => {
      const c = buyers.filter((b) => b.status === s).length;
      return { label: STATUS_META[s].label, count: c, share: pct(c, buyers.length) };
    }),
    totals: { label: "Total", count: buyers.length, share: buyers.length ? 1 : null },
  };

  const itemStatuses = ALL_ITEM_STATUSES;
  const itemTable: Table = {
    name: "Sector Approvals",
    heading: "2. Sector requirement approvals",
    columns: [
      { key: "label", header: "Sector Requirement Status", width: 34 },
      { key: "count", header: "Requirements", width: 14, kind: "number", align: "right" },
      { key: "share", header: "Share", width: 12, kind: "percent", align: "right" },
    ],
    rows: itemStatuses.map((s) => {
      const c = items.filter((i) => i.status === s).length;
      return { label: ITEM_META[s].label, count: c, share: pct(c, items.length) };
    }),
    totals: { label: "Total", count: items.length, share: items.length ? 1 : null },
  };

  const countries = [...new Set(buyers.map((b) => b.country))].sort();
  const countryRows = countries
    .map((c) => {
      const bs = buyers.filter((b) => b.country === c);
      const its = items.filter((i) => i.requirement.buyer.country === c);
      return {
        country: c, buyers: bs.length, approved: bs.filter((b) => b.status === "APPROVED").length,
        sectors: its.length, approvedSectors: its.filter((i) => i.status === "APPROVED").length,
      };
    })
    .sort((a, b) => b.buyers - a.buyers || a.country.localeCompare(b.country));
  const sum = (rows: Record<string, unknown>[], k: string) => rows.reduce((n, r) => n + Number(r[k] ?? 0), 0);
  const countryTable: Table = {
    name: "Country-wise",
    heading: "3. Country-wise position",
    columns: [
      { key: "country", header: "Country", width: 28 },
      { key: "buyers", header: "Buyers", width: 11, kind: "number", align: "right" },
      { key: "approved", header: "Approved Buyers", width: 14, kind: "number", align: "right" },
      { key: "sectors", header: "Sector Requirements", width: 16, kind: "number", align: "right" },
      { key: "approvedSectors", header: "Approved Sectors", width: 14, kind: "number", align: "right" },
    ],
    rows: countryRows,
    totals: { country: "Total", buyers: sum(countryRows, "buyers"), approved: sum(countryRows, "approved"), sectors: sum(countryRows, "sectors"), approvedSectors: sum(countryRows, "approvedSectors") },
  };

  const sectorNames = [...new Map(items.map((i) => [i.sector.name, i.sector.sortOrder])).entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const sectorRows = sectorNames.map(([name]) => {
    const its = items.filter((i) => i.sector.name === name);
    return {
      sector: name, total: its.length,
      approved: its.filter((i) => i.status === "APPROVED").length,
      review: its.filter((i) => i.status === "SUBMITTED" || i.status === "FIEO_RECOMMENDED" || i.status === "DIC_RETURNED").length,
      returned: its.filter((i) => i.status === "FIEO_RETURNED" || i.status === "DRAFT").length,
    };
  });
  const sectorTable: Table = {
    name: "Sector-wise",
    heading: "4. Sector-wise position",
    columns: [
      { key: "sector", header: "Sector", width: 32 },
      { key: "total", header: "Buyers Interested", width: 14, kind: "number", align: "right" },
      { key: "approved", header: "Approved", width: 11, kind: "number", align: "right" },
      { key: "review", header: "Under Review", width: 12, kind: "number", align: "right" },
      { key: "returned", header: user.role === "DIC" ? "Returned" : "Returned / Draft", width: 14, kind: "number", align: "right" },
    ],
    rows: sectorRows,
    totals: { sector: "Total", total: sum(sectorRows, "total"), approved: sum(sectorRows, "approved"), review: sum(sectorRows, "review"), returned: sum(sectorRows, "returned") },
  };

  return {
    ...base("mis-summary", user, [], "portrait"),
    kpis: [
      { label: "Registered buyers", value: buyers.length, tone: "blue" },
      { label: "Approved buyers", value: buyers.filter((b) => b.status === "APPROVED").length, tone: "green" },
      { label: "Sector requirements", value: items.length, tone: "violet" },
      { label: "Approved sectors", value: items.filter((i) => i.status === "APPROVED").length, tone: "green" },
      { label: "Countries", value: countries.length, tone: "yellow" },
    ],
    tables: [buyerTable, itemTable, countryTable, sectorTable],
  };
}

export async function buildReport(id: ReportId, user: User, f: BuyerFilters & SellerFilters): Promise<Report> {
  switch (id) {
    case "seller-register": return sellerRegister(user, f);
    case "sector-demand": return sectorDemandReport(user, f);
    case "seller-district-summary": return sellerDistrictSummary(user);
    case "seller-taluk-summary": return sellerTalukSummary(user, f);
    case "awareness-attendance": return awarenessReport(user, (f as { batchId?: string }).batchId);
    case "buyer-register": return buyerRegister(user, f);
    case "sector-requirements": return sectorRequirements(user, f);
    case "approved-buyers": return approvedBuyers(user, f);
    case "approved-sellers": return approvedSellers(user, f);
    case "mis-summary": return misSummary(user);
    case "product-demand": return productDemandReport(user, f as BuyerFilters & { view?: string });
    case "insights": return insightsReport(user);
    case "seller-profile-analysis": return sellerProfileAnalysis(user);
    case "match-list": return matchListReport(user, (f as { v?: string }).v === "draft" ? "draft" : "published");
    case "seller-preferences": return sellerPreferencesReport(user);
    case "match-buyer-directory": return buyerDirectoryReport(user);
    case "match-checks": return matchChecksReport(user);
    case "event-schedule": return eventScheduleReport(user, (f as { v?: string }).v === "draft" && (user.role === "DIC" || user.role === "ADMIN"));
    case "event-attendance": return eventAttendanceReport(user);
    case "communications": return communicationsReport(user, (f as { conversationId?: string }).conversationId);
    case "match-coverage": return matchCoverageReport(user, (f as { v?: string }).v === "draft" ? "draft" : "published");
    case "mou-register": return mouRegisterReport(user, f as MouFilters);
  }
}

// ---------------------------------------------------------------- MoUs

async function mouRegisterReport(user: User, f: MouFilters): Promise<Report> {
  const [rate, mous] = await Promise.all([
    getMouRate(),
    prisma.mou.findMany({ where: mouWhere(f), orderBy: { seq: "asc" }, include: {
      buyer: { select: { name: true, country: true, approvedNo: true, regNo: true, nodalOfficer: { select: { name: true } } } },
      seller: { select: { name: true, district: true, approvedNo: true, regNo: true } }, sector: { select: { name: true } },
      nodalVerifiedBy: { select: { displayName: true } }, fieoApprovedBy: { select: { displayName: true } } } }),
  ]);
  const rows: Row[] = mous.map((m, i) => {
    const v = toMoney(m, rate);
    return {
      sl: i + 1, mouNo: m.mouNo, date: m.submittedAt, status: m.status === "SUBMITTED" ? mouStage(m) : MOU_STATUS[m.status].label,
      buyer: m.buyer.name, buyerId: m.buyer.approvedNo ?? m.buyer.regNo, country: m.buyer.country,
      seller: m.seller.name, sellerId: m.seller.approvedNo ?? m.seller.regNo, district: m.seller.district,
      sector: m.sector?.name ?? "", goods: m.goods, entered: m.amount === null ? "To be determined" : `${m.currency} ${m.amount.toLocaleString("en-IN")}`,
      usd: v ? Math.round(v.usd) : null, inr: v ? Math.round(v.inr) : null, month: fmtMonth(m.orderMonth),
      nodal: m.nodalVerifiedAt ? `${m.nodalVerifiedBy?.displayName ?? ""} ${fmtDate(m.nodalVerifiedAt)}` : `Pending${m.buyer.nodalOfficer ? ` (${m.buyer.nodalOfficer.name})` : ""}`,
      fieo: m.fieoApprovedAt ? `${m.fieoApprovedBy?.displayName ?? ""} ${fmtDate(m.fieoApprovedAt)}` : "Pending",
    };
  });
  const live = mous.filter((m) => m.status === "APPROVED" || m.status === "SUBMITTED");
  const total = (list: typeof mous) => list.reduce((t, m) => { const v = toMoney(m, rate); return { usd: t.usd + (v?.usd ?? 0), inr: t.inr + (v?.inr ?? 0) }; }, { usd: 0, inr: 0 });
  const approved = mous.filter((m) => m.status === "APPROVED");
  const at = total(approved);
  const group = (key: (m: (typeof mous)[number]) => string) => {
    const g = new Map<string, { n: number; approved: number; usd: number; inr: number }>();
    for (const m of live) { const k = key(m); const e = g.get(k) ?? { n: 0, approved: 0, usd: 0, inr: 0 }; const v = toMoney(m, rate); e.n++; if (m.status === "APPROVED") e.approved++; e.usd += v?.usd ?? 0; e.inr += v?.inr ?? 0; g.set(k, e); }
    return [...g.entries()].sort((a, b) => b[1].usd - a[1].usd).map(([k, e]) => ({ k, n: e.n, approved: e.approved, usd: Math.round(e.usd), inr: Math.round(e.inr) }));
  };
  const sumCols = (h: string) => [{ key: "k", header: h, width: 30 }, { key: "n", header: "MoUs Signed", width: 12, kind: "number" as const, align: "right" as const },
    { key: "approved", header: "Approved", width: 11, kind: "number" as const, align: "right" as const }, { key: "usd", header: "Value (US$)", width: 16, kind: "number" as const, align: "right" as const },
    { key: "inr", header: "Value (INR)", width: 18, kind: "number" as const, align: "right" as const }];
  const filters: string[] = [`1 US$ = Rs. ${rate}`];
  if (f.q) filters.push(`Search: "${f.q}"`);
  if (f.status) filters.push(`Status: ${MOU_STATUS[f.status as keyof typeof MOU_STATUS]?.label ?? f.status}`);
  if (f.country) filters.push(`Country: ${f.country}`);
  if (f.district) filters.push(`District: ${f.district}`);
  return {
    ...base("mou-register", user, filters),
    kpis: [
      { label: "MoUs signed", value: live.length, tone: "blue" },
      { label: "Approved", value: approved.length, tone: "green" },
      { label: "Approved value (US$)", value: Math.round(at.usd).toLocaleString("en-US"), tone: "green" },
      { label: "Approved value (INR)", value: Math.round(at.inr).toLocaleString("en-IN"), tone: "violet" },
    ],
    tables: [
      { name: "MoUs", heading: "1. Every MoU",
        columns: [{ key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" }, { key: "mouNo", header: "MoU No.", width: 26, kind: "mono" }, { key: "date", header: "Signed On", width: 12, kind: "date" },
          { key: "buyer", header: "Buyer", width: 22 }, { key: "buyerId", header: "Buyer ID", width: 18, kind: "mono" }, { key: "country", header: "Country", width: 14 },
          { key: "seller", header: "Seller", width: 22 }, { key: "sellerId", header: "Seller ID", width: 19, kind: "mono" }, { key: "district", header: "District", width: 14, excelOnly: true },
          { key: "sector", header: "Sector", width: 18, excelOnly: true }, { key: "goods", header: "Description of Goods", width: 30 },
          { key: "entered", header: "Value as Entered", width: 16, excelOnly: true }, { key: "usd", header: "Value (US$)", width: 13, kind: "number", align: "right" },
          { key: "inr", header: "Value (INR)", width: 15, kind: "number", align: "right" }, { key: "month", header: "Order Month", width: 13 },
          { key: "status", header: "Status", width: 18 }, { key: "nodal", header: "Nodal Officer Verification", width: 24, excelOnly: true }, { key: "fieo", header: "FIEO Approval", width: 22, excelOnly: true }],
        rows },
      { name: "By Country", heading: "2. By buyer country (signed = approved + awaiting verification)", columns: sumCols("Country"), rows: group((m) => m.buyer.country) },
      { name: "By Sector", heading: "3. By sector", columns: sumCols("Sector"), rows: group((m) => m.sector?.name ?? "—") },
      { name: "By District", heading: "4. By seller district", columns: sumCols("District"), rows: group((m) => m.seller.district) },
    ],
  };
}

// ---------------------------------------------------------------- single buyer profile (dossier)

export async function buildDossier(user: User, buyerId: string): Promise<Report | null> {
  const b = await prisma.buyer.findFirst({
    where: { AND: [{ id: buyerId }, scopeFor(user.role)] },
    include: {
      user: { select: { username: true } },
      documents: true,
      requirement: { include: { items: { where: itemScope(user.role), orderBy: { sortOrder: "asc" }, include: { sector: true } } } },
      reviewLogs: { orderBy: { createdAt: "asc" }, include: { actor: { select: { displayName: true } } } },
    },
  });
  if (!b) return null;
  const r = b.requirement;
  const kv = (rows: [string, Row[string]][]): Row[] => rows.map(([label, value]) => ({ label, value }));
  const kvCols = [
    { key: "label", header: "Particulars", width: 28 },
    { key: "value", header: "Details", width: 62 },
  ];
  const doc = (k: "PROFILE" | "CREDENTIALS") => b.documents.find((d) => d.kind === k && !d.pending)?.originalName ?? "Not uploaded";
  const generatedAt = new Date();
  return {
    id: "buyer-profile",
    title: "Buyer Profile",
    description: `${b.name} — ${b.regNo}${b.approvedNo ? ` / ${b.approvedNo}` : ""}`,
    generatedAt,
    generatedBy: `${user.displayName} (${ROLE_LABEL[user.role]})`,
    filters: [],
    orientation: "portrait",
    fileName: `TRADEX-RBSM-Buyer-Profile-${b.regNo}-${stamp(generatedAt)}`,
    kpis: [
      { label: "Registration status", value: STATUS_META[b.status].label, tone: b.status === "APPROVED" ? "green" : "blue" },
      { label: "Sector requirements", value: r?.items.length ?? 0, tone: "violet" },
      { label: "Approved sectors", value: r?.items.filter((i) => i.status === "APPROVED").length ?? 0, tone: "green" },
    ],
    tables: [
      {
        name: "Basic Details", heading: "1. Basic details", columns: kvCols,
        rows: kv([
          ["Registration No.", b.regNo], ["Buyer No.", b.approvedNo ?? "Not yet approved"], ["Login ID", b.user.username],
          ["Name of the buyer", b.name], ["Country", b.country], ["Sign-up e-mail", b.signupEmail],
          ["Contact person", b.pocName], ["Designation", b.pocDesignation], ["Contact e-mail", b.pocEmail], ["Mobile number", b.pocMobile],
          ["Company profile", doc("PROFILE")], ["Organisation credentials", doc("CREDENTIALS")],
          ["Registered on", b.createdAt], ["Verified by FIEO on", b.basicApprovedAt], ["Approved as RBSM buyer on", b.approvedAt],
        ]),
      },
      {
        name: "Sourcing Profile", heading: "2. Sourcing profile", columns: kvCols,
        rows: kv([
          ["Organisation type", r?.organisationType], ["Annual sourcing value", r?.annualSourcingValue], ["Sourcing timeline", r?.sourcingTimeline],
          ["Preferred engagement", r?.preferredEngagement],
          ...(r?.procurementInterests ? [["Procurement interests", r.procurementInterests] as [string, string]] : []),
        ]),
      },
      {
        name: "Sector Requirements", heading: "3. Sector requirements",
        columns: [
          { key: "sl", header: "Sl.", width: 4, kind: "number", align: "center" },
          { key: "sector", header: "Sector", width: 18 },
          { key: "products", header: "Products & Specifications", width: 34 },
          { key: "certifications", header: "Certifications", width: 18 },
          { key: "status", header: "Status", width: 16, kind: "itemStatus" },
        ],
        rows: (r?.items ?? []).map((it, i) => ({
          sl: i + 1, sector: it.sector.name,
          products: [it.products, it.specifications && `Spec: ${it.specifications}`, it.quantity && `Volume: ${it.quantity}`].filter(Boolean).join("\n"),
          certifications: parseCerts(it.certifications).join(", "), status: it.status,
        })),
      },
      {
        name: "Activity Log", heading: "4. Activity log",
        columns: [
          { key: "at", header: "Date & Time", width: 17, kind: "datetime" },
          { key: "by", header: "By", width: 16 },
          { key: "action", header: "Action", width: 30 },
          { key: "comment", header: "Comment", width: 30 },
        ],
        rows: b.reviewLogs.map((l) => ({
            at: l.createdAt,
            by: l.actorRole === "BUYER" ? "Buyer" : `${ROLE_LABEL[l.actorRole]}${l.actor ? ` — ${l.actor.displayName}` : ""}`,
            action: `${ACTION_LABEL[l.action]}${l.sectorName ? ` (${l.sectorName})` : ""}`,
          comment: l.comment,
        })),
      },
    ],
  };
}

export const EVENT_LINE = `${EVENT.name} · ${EVENT.programme}`;

// ---------------------------------------------------------------- sellers

async function describeSellerFilters(user: User, f: SellerFilters): Promise<string[]> {
  const out: string[] = [];
  if (user.role === "DISTRICT") out.push(`District: ${user.district}`);
  if (user.role === "FIEO") out.push("Approved sellers only");
  if (f.q) out.push(`Search: "${f.q}"`);
  if (f.status === "action") out.push("Status: needs action");
  else if (f.status && ALL_SELLER_STATUSES.includes(f.status as SellerStatus)) out.push(`Status: ${SELLER_META[f.status as SellerStatus].label}`);
  if (f.sector) {
    const sec = await prisma.sector.findUnique({ where: { id: f.sector }, select: { name: true } });
    if (sec) out.push(`Sector: ${sec.name}`);
  }
  if (f.district) out.push(`District: ${f.district}`);
  if (f.exp === "yes") out.push("Export experience: Yes");
  if (f.exp === "no") out.push("Export experience: No");
  out.push(...describeProfileFilters(f));
  return out;
}

async function sellerRegister(user: User, f: SellerFilters): Promise<Report> {
  const sellers = await prisma.seller.findMany({
    where: sellerWhere(user, f),
    orderBy: [{ district: "asc" }, { seq: "asc" }],
    include: { products: { orderBy: { sortOrder: "asc" }, include: { sector: true } } },
  });
  const n = (s: SellerStatus[]) => sellers.filter((x) => s.includes(x.status)).length;
  return {
    ...base("seller-register", user, await describeSellerFilters(user, f)),
    kpis: [
      { label: "Sellers", value: sellers.length, tone: "blue" },
      { label: "Approved", value: n(["APPROVED"]), tone: "green" },
      { label: "In approval", value: n(["WITH_TALUK", "WITH_SELLER", "RECOMMENDED", "RETURNED", "INITIAL_APPROVED", "TRAINED"]), tone: "yellow" },
      { label: "With export experience", value: sellers.filter((x) => x.exportExperience).length, tone: "violet" },
    ],
    tables: [{
      name: "Seller Register",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "regNo", header: "Reg. No.", width: 13, kind: "mono" },
        { key: "approvedNo", header: "Seller No.", width: 19, kind: "mono" },
        { key: "name", header: "Name of Seller", width: 26 },
        { key: "district", header: "District", width: 16 },
        { key: "taluk", header: "Taluk", width: 17 },
        { key: "localBody", header: "Local Body", width: 20 },
        { key: "udyamNo", header: "Udyam Number", width: 21, kind: "mono" },
        { key: "exp", header: "Export Exp.", width: 9, align: "center" },
        { key: "contact", header: "Promoter", width: 18 },
        { key: "mobile", header: "Mobile / WhatsApp", width: 17 },
        { key: "email", header: "E-mail", width: 26 },
        { key: "iecNo", header: "IEC Number", width: 13, kind: "mono", excelOnly: true },
        { key: "certs", header: "Certifications", width: 30, excelOnly: true },
        { key: "expCountries", header: "Countries Exported To", width: 30, excelOnly: true },
        { key: "expProducts", header: "Products Exported", width: 30, excelOnly: true },
        { key: "products", header: "Sectors & Products", width: 37 },
        { key: "status", header: "Status", width: 20, kind: "sellerStatus" },
        ...profileColumns(PERSONAL_ROLES.has(user.role)),
      ],
      rows: sellers.map((x, i) => ({
        sl: i + 1, regNo: x.regNo, approvedNo: x.approvedNo, name: x.name, district: x.district, taluk: x.taluk,
        localBody: `${x.localBodyName} ${localBodyLabel(x.localBodyType)}`, udyamNo: x.udyamNo, exp: x.exportExperience ? "Yes" : "No",
        contact: x.contactName,
        mobile: fmtMobile(x.contactMobile) + (x.contactWhatsapp !== x.contactMobile ? `\nWA: ${fmtMobile(x.contactWhatsapp)}` : ""),
        email: x.contactEmail,
        products: x.products.map((p) => `${p.sector.name}: ${p.products}`).join("\n"),
        status: x.status, iecNo: x.iecNo ?? "", certs: parseCerts(x.certifications).join(", "),
        expCountries: parseCerts(x.exportCountries).join(", "), expProducts: x.exportedProducts ?? "",
        ...profileRow(x, PERSONAL_ROLES.has(user.role)),
      })),
    }],
  };
}

async function sellerDistrictSummary(user: User): Promise<Report> {
  const sellers = await prisma.seller.findMany({ where: sellerScope(user), select: { district: true, status: true, exportExperience: true, profileCompletedAt: true } });
  const districts = user.role === "DISTRICT" ? [user.district ?? ""] : DISTRICT_NAMES;
  const targets = await getTargets();
  const rows = districts.map((d) => {
    const ds = sellers.filter((x) => x.district === d);
    const c = (...st: SellerStatus[]) => ds.filter((x) => st.includes(x.status)).length;
    const approved = c("APPROVED");
    return {
      district: d, total: ds.length, pending: c("WITH_TALUK", "WITH_SELLER", "RETURNED"), recommended: c("RECOMMENDED"),
      notRecommended: c("NOT_RECOMMENDED"), training: c("INITIAL_APPROVED"), trained: c("TRAINED"),
      approved, rejected: c("REJECTED"), exp: ds.filter((x) => x.exportExperience).length, target: targets.district[d] ?? 0,
      profilePending: ds.filter((x) => x.status === "APPROVED" && !x.profileCompletedAt).length,
      achieved: targets.district[d] ? approved / targets.district[d] : null,
    };
  });
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const totalApproved = sum("approved");
  const fieo = user.role === "FIEO";
  return {
    ...base("seller-district-summary", user,
      user.role === "DISTRICT" ? [`District: ${user.district}`]
      : fieo ? ["Approved sellers only"]
      : [], "portrait"),
    kpis: [
      { label: "Sellers", value: sellers.length, tone: "blue" },
      { label: "Approved sellers", value: totalApproved, tone: "green" },
      ...(fieo ? [] : [{ label: `Target (${user.role === "DISTRICT" ? "district" : "programme"})`, value: user.role === "DISTRICT" ? targets.district[user.district ?? ""] ?? 0 : targets.sellers, tone: "yellow" as const }]),
    ],
    tables: [{
      name: "District-wise",
      columns: [
        { key: "district", header: "District", width: 22 },
        ...(fieo ? [] : [
          { key: "total", header: "Registered", width: 11, kind: "number" as const, align: "right" as const },
          { key: "pending", header: "With Taluk / Applicant", width: 12, kind: "number" as const, align: "right" as const },
          { key: "notRecommended", header: "Not Recom-mended", width: 10, kind: "number" as const, align: "right" as const },
          { key: "recommended", header: "Awaiting Initial Approval", width: 12, kind: "number" as const, align: "right" as const },
          { key: "training", header: "Awareness Session", width: 11, kind: "number" as const, align: "right" as const },
          { key: "trained", header: "Awaiting Final Approval", width: 11, kind: "number" as const, align: "right" as const },
        ]),
        { key: "approved", header: "Approved", width: 11, kind: "number", align: "right" },
        ...(fieo ? [] : [{ key: "rejected", header: "Rejected", width: 10, kind: "number" as const, align: "right" as const }]),
        { key: "exp", header: "Export Exp.", width: 11, kind: "number", align: "right" },
        ...(fieo ? [] : [{ key: "profilePending", header: "Profile Pending", width: 11, kind: "number" as const, align: "right" as const }]),
        // Targets are an internal Directorate / district matter — not shown to FIEO.
        ...(fieo ? [] : [
          { key: "target", header: "Target", width: 9, kind: "number" as const, align: "right" as const },
          { key: "achieved", header: "Achieved", width: 10, kind: "percent" as const, align: "right" as const },
        ]),
      ],
      rows,
      totals: {
        district: "Total", total: sum("total"), pending: sum("pending"), recommended: sum("recommended"), approved: totalApproved,
        notRecommended: sum("notRecommended"), training: sum("training"), trained: sum("trained"),
        rejected: sum("rejected"), exp: sum("exp"), profilePending: sum("profilePending"),
        target: user.role === "DISTRICT" ? targets.district[user.district ?? ""] ?? 0 : targets.sellers,
        achieved: (user.role === "DISTRICT" ? targets.district[user.district ?? ""] : targets.sellers) ? totalApproved / (user.role === "DISTRICT" ? targets.district[user.district ?? ""] : targets.sellers) : null,
      },
    }],
  };
}

async function sellerTalukSummary(user: User, f: SellerFilters): Promise<Report> {
  const district = user.role === "DISTRICT" || user.role === "TALUK" ? user.district ?? "" : f.district && DISTRICT_NAMES.includes(f.district) ? f.district : null;
  const sellers = await prisma.seller.findMany({
    where: { AND: [sellerScope(user), district ? { district } : {}] },
    select: { district: true, taluk: true, status: true, recommendedAt: true, initialApprovedAt: true, trainedAt: true, bypassed: true,
      batches: { select: { attendance: true } } },
  });
  const keys = [...new Set(sellers.map((x) => `${x.district}|${x.taluk}`))].sort();
  const rows: Row[] = keys.map((k) => {
    const [d, t] = k.split("|");
    const ts = sellers.filter((x) => x.district === d && x.taluk === t);
    const c = (...st: SellerStatus[]) => ts.filter((x) => st.includes(x.status)).length;
    return {
      district: d, taluk: t, total: ts.length, withTaluk: c("WITH_TALUK", "RETURNED"), withSeller: c("WITH_SELLER"),
      recommended: ts.filter((x) => x.recommendedAt).length, notRecommended: c("NOT_RECOMMENDED"), awaitingInitial: c("RECOMMENDED"),
      initial: ts.filter((x) => x.initialApprovedAt).length,
      awaitingSession: ts.filter((x) => x.status === "INITIAL_APPROVED" && !x.batches.some((b) => b.attendance === "PENDING")).length,
      scheduled: ts.filter((x) => x.status === "INITIAL_APPROVED" && x.batches.some((b) => b.attendance === "PENDING")).length,
      attended: ts.filter((x) => x.trainedAt).length, absent: ts.filter((x) => x.batches.some((b) => b.attendance === "ABSENT")).length,
      awaitingFinal: c("TRAINED"), approved: c("APPROVED"), bypassed: ts.filter((x) => x.bypassed).length, rejected: c("REJECTED"),
    };
  });
  const NUM = ["total", "withTaluk", "withSeller", "recommended", "notRecommended", "awaitingInitial", "initial", "awaitingSession", "scheduled", "attended", "absent", "awaitingFinal", "approved", "bypassed", "rejected"];
  const totals: Row = { district: "Total", taluk: "" };
  for (const k of NUM) totals[k] = rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const H: Record<string, string> = {
    total: "Registered", withTaluk: "With Taluk", withSeller: "With Applicant", recommended: "Recom-mended", notRecommended: "Not Recom-mended",
    awaitingInitial: "Awaiting Initial Approval", initial: "Initially Approved", awaitingSession: "Awaiting Session", scheduled: "Session Scheduled",
    attended: "Attended", absent: "Absent (ever)", awaitingFinal: "Awaiting Final Approval", approved: "Approved", bypassed: "Approved w/o Session", rejected: "Rejected",
  };
  return {
    ...base("seller-taluk-summary", user, [user.role === "TALUK" ? `Taluk: ${user.taluk}, ${user.district}` : district ? `District: ${district}` : "All districts"]),
    kpis: [
      { label: "Registered", value: Number(totals.total), tone: "blue" },
      { label: "Recommended by taluk", value: Number(totals.recommended), tone: "violet" },
      { label: "Not recommended", value: Number(totals.notRecommended), tone: "slate" },
      { label: "Session attended", value: Number(totals.attended), tone: "yellow" },
      { label: "Approved", value: Number(totals.approved), tone: "green" },
    ],
    tables: [{
      name: "Taluk-wise",
      columns: [
        { key: "district", header: "District", width: 14 }, { key: "taluk", header: "Taluk", width: 16 },
        ...NUM.map((k) => ({ key: k, header: H[k], width: 9, kind: "number" as const, align: "right" as const })),
      ],
      rows, totals,
    }],
  };
}

async function awarenessReport(user: User, batchId?: string): Promise<Report> {
  const local = user.role === "DISTRICT" || user.role === "TALUK";
  const memberWhere = local ? { seller: sellerScope(user) } : {};
  const batches = await prisma.trainingBatch.findMany({
    where: { ...(batchId ? { id: batchId } : {}), ...(user.role === "DISTRICT" || user.role === "TALUK" ? { OR: [{ district: user.district }, { district: null }] } : {}) },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { members: { where: memberWhere, orderBy: { assignedAt: "asc" }, include: { seller: true } } },
  });
  const markers = new Map((await prisma.user.findMany({
    where: { id: { in: [...new Set(batches.flatMap((b) => b.members.map((m) => m.markedById).filter((x): x is string => !!x)))] } }, select: { id: true, displayName: true },
  })).map((u) => [u.id, u.displayName]));
  const one = batchId ? batches[0] : null;
  const slot = (b: { date: string; startTime: string; endTime: string }) => `${fmtDay(b.date)}, ${fmtSlot(b.startTime, b.endTime)}`;
  const ATT = { PENDING: "Not marked", PRESENT: "Present", ABSENT: "Absent" } as const;
  const memberRows: Row[] = batches.flatMap((b) => b.members.map((m) => ({
    batch: b.name, when: slot(b), venue: b.venue, regNo: m.seller.regNo, name: m.seller.name, district: m.seller.district, taluk: m.seller.taluk,
    contact: m.seller.contactName, mobile: fmtMobile(m.seller.contactMobile), email: m.seller.contactEmail,
    attendance: ATT[m.attendance], markedAt: m.markedAt, markedBy: m.markedById ? markers.get(m.markedById) ?? "" : "", status: m.seller.status,
  })));
  const sessionRows: Row[] = batches.map((b) => {
    const n = (a: string) => b.members.filter((m) => m.attendance === a).length;
    return { batch: b.name, when: slot(b), venue: b.venue, district: b.district ?? "All districts", placed: b.members.length, present: n("PRESENT"), absent: n("ABSENT"), pending: n("PENDING") };
  });
  const sellerCols: Column[] = [
    { key: "regNo", header: "Reg. No.", width: 14, kind: "mono" }, { key: "name", header: "Seller", width: 26 },
    { key: "district", header: "District", width: 13 }, { key: "taluk", header: "Taluk", width: 14 },
    { key: "contact", header: "Promoter", width: 18 }, { key: "mobile", header: "Mobile", width: 13 },
  ];
  const tables: Table[] = [];
  if (!one) {
    tables.push({
      name: "Sessions", columns: [
        { key: "batch", header: "Session", width: 30 }, { key: "when", header: "Date & Time", width: 26 }, { key: "venue", header: "Venue", width: 26 },
        { key: "district", header: "District", width: 14 }, { key: "placed", header: "Sellers", width: 9, kind: "number", align: "right" },
        { key: "present", header: "Present", width: 9, kind: "number", align: "right" }, { key: "absent", header: "Absent", width: 9, kind: "number", align: "right" },
        { key: "pending", header: "Not Marked", width: 9, kind: "number", align: "right" },
      ], rows: sessionRows,
      totals: { batch: "Total", placed: sessionRows.reduce((a, r) => a + Number(r.placed), 0), present: sessionRows.reduce((a, r) => a + Number(r.present), 0),
        absent: sessionRows.reduce((a, r) => a + Number(r.absent), 0), pending: sessionRows.reduce((a, r) => a + Number(r.pending), 0) },
    });
  }
  tables.push({
    name: one ? "Attendance" : "Session-wise attendance", columns: [
      ...(one ? [] : [{ key: "batch", header: "Session", width: 28 }]),
      ...sellerCols,
      { key: "email", header: "E-mail", width: 22, excelOnly: true },
      { key: "attendance", header: "Attendance", width: 11 }, { key: "markedAt", header: "Marked On", width: 15, kind: "datetime", excelOnly: true },
      { key: "markedBy", header: "Marked By", width: 16, excelOnly: true }, { key: "status", header: "Stage", width: 16, kind: "sellerStatus" },
    ], rows: memberRows,
  });
  if (!one && user.role !== "TRAINING") {
    const scope = sellerScope(user);
    const [waiting, bypassed] = await Promise.all([
      prisma.seller.findMany({ where: { AND: [scope, { status: "INITIAL_APPROVED", batches: { none: { attendance: "PENDING" } } }] }, orderBy: [{ district: "asc" }, { taluk: "asc" }, { name: "asc" }],
        include: { batches: { where: { attendance: "ABSENT" }, include: { batch: { select: { name: true } } } } } }),
      prisma.seller.findMany({ where: { AND: [scope, { bypassed: true }] }, orderBy: { approvedAt: "asc" },
        include: { logs: { where: { action: "BYPASSED" }, take: 1, orderBy: { createdAt: "desc" } } } }),
    ]);
    tables.push({
      name: "Awaiting a session", heading: "Initially approved — awaiting a session (incl. absent)", columns: [...sellerCols,
        { key: "initialAt", header: "Initially Approved", width: 15, kind: "date" }, { key: "absent", header: "Absent From", width: 28 }],
      rows: waiting.map((x) => ({ regNo: x.regNo, name: x.name, district: x.district, taluk: x.taluk, contact: x.contactName, mobile: fmtMobile(x.contactMobile),
        initialAt: x.initialApprovedAt, absent: x.batches.map((b) => b.batch.name).join("; ") })),
    });
    tables.push({
      name: "Approved without session", heading: "Final approval without the awareness session (Directorate, case by case)", columns: [...sellerCols,
        { key: "approvedNo", header: "Seller No.", width: 18, kind: "mono" }, { key: "approvedAt", header: "Approved On", width: 15, kind: "date" },
        { key: "reason", header: "Reason", width: 30 }],
      rows: bypassed.map((x) => ({ regNo: x.regNo, name: x.name, district: x.district, taluk: x.taluk, contact: x.contactName, mobile: fmtMobile(x.contactMobile),
        approvedNo: x.approvedNo, approvedAt: x.approvedAt, reason: x.logs[0]?.comment ?? "" })),
    });
  }
  const count = (a: string) => memberRows.filter((r) => r.attendance === a).length;
  return {
    ...base("awareness-attendance", user, [
      ...(one ? [`Session: ${one.name}`, `Date & time: ${slot(one)}`, `Venue: ${one.venue}`] : []),
      ...(user.role === "TALUK" ? [`Taluk: ${user.taluk}`] : user.role === "DISTRICT" ? [`District: ${user.district}`] : []),
    ]),
    kpis: [
      ...(one ? [] : [{ label: "Sessions", value: batches.length, tone: "blue" as const }]),
      { label: "Sellers placed", value: memberRows.length, tone: "violet" },
      { label: "Present", value: count("Present"), tone: "green" },
      { label: "Absent", value: count("Absent"), tone: "red" },
      { label: "Not marked", value: count("Not marked"), tone: "slate" },
    ],
    tables,
  };
}

export async function buildSellerProfile(user: User, sellerId: string): Promise<Report | null> {
  const x = await prisma.seller.findFirst({
    where: { AND: [{ id: sellerId }, sellerScope(user)] },
    include: {
      products: { orderBy: { sortOrder: "asc" }, include: { sector: true } },
      logs: { orderBy: { createdAt: "asc" }, include: { actor: { select: { displayName: true } } } },
      user: { select: { username: true } },
    },
  });
  if (!x) return null;
  const generatedAt = new Date();
  const kvCols = [{ key: "label", header: "Particulars", width: 28 }, { key: "value", header: "Details", width: 62 }];
  const kv = (rows: [string, Row[string]][]): Row[] => rows.map(([label, value]) => ({ label, value }));
  return {
    id: "seller-profile",
    title: "Seller Profile",
    description: `${x.name} — ${x.regNo}${x.approvedNo ? ` / ${x.approvedNo}` : ""}`,
    generatedAt,
    generatedBy: `${user.displayName} (${ROLE_LABEL[user.role]})`,
    filters: [],
    orientation: "portrait",
    fileName: `TRADEX-RBSM-Seller-Profile-${x.regNo}-${stamp(generatedAt)}`,
    kpis: [
      { label: "Status", value: SELLER_META[x.status].label, tone: x.status === "APPROVED" ? "green" : "blue" },
      { label: "Sectors", value: x.products.length, tone: "violet" },
      { label: "Export experience", value: x.exportExperience ? "Yes" : "No", tone: "yellow" },
    ],
    tables: [
      {
        name: "Seller Details", heading: "Enterprise and promoter details", columns: kvCols,
        rows: kv([
          ["Registration No.", x.regNo], ["Seller No.", x.approvedNo ?? "Not yet approved"], ["Login ID", x.user?.username ?? "Allotted on approval"],
          ["Name of the seller", x.name], ["Udyam number", x.udyamNo], ["District", x.district], ["Taluk", x.taluk],
          ["Local body", `${x.localBodyName} ${localBodyLabel(x.localBodyType)}`], ["Export experience", x.exportExperience ? "Yes" : "No"],
          ...(x.exportExperience ? [["Countries exported to", parseCerts(x.exportCountries).join(", ") || "Not given"], ["Products exported", x.exportedProducts ?? "Not given"]] as [string, Row[string]][] : []),
          ["IEC number", x.iecNo ?? "Not given"], ["Quality / product certifications", parseCerts(x.certifications).join(", ") || "None"],
          ["Name of the promoter", x.contactName], ["Mobile number", fmtMobile(x.contactMobile)], ["WhatsApp number", fmtMobile(x.contactWhatsapp)],
          ["E-mail ID", x.contactEmail],
          ["Source", x.source === "SELF" ? "Self-registered" : x.source === "BULK" ? "Bulk upload by district centre" : "Entered by district centre"],
          ["Registered on", x.createdAt], ["Recommended on", x.recommendedAt], ["Approved on", x.approvedAt],
        ]),
      },
      ...(x.status === "APPROVED" ? [{
        name: "Seller Profile", heading: "Seller profile (completed by the seller after approval)", columns: kvCols,
        rows: x.profileCompletedAt ? kv([
          ...(PERSONAL_ROLES.has(user.role) ? [
            ["Gender of the promoter", optLabel(GENDERS, x.promoterGender)], ["Date of birth", x.promoterDob],
            ["Social category", optLabel(SOCIAL_CATEGORIES, x.socialCategory)], ["Specially abled", x.speciallyAbled ? "Yes" : "No"],
          ] as [string, Row[string]][] : []),
          ["Block", x.block], ["Constitution of the unit", optLabel(CONSTITUTIONS, x.constitution)],
          ["Category of the unit", optLabel(UNIT_CATEGORIES, x.unitCategory)], ["Unit type", optLabel(UNIT_TYPES, x.unitType)],
          ["Profile completed on", x.profileCompletedAt],
        ]) : kv([["Profile", "Not completed by the seller yet"]]),
      }] : []),
      {
        name: "Products", heading: "Sectors and products ready to export",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "sector", header: "Sector", width: 30 },
          { key: "products", header: "Products", width: 60 },
        ],
        rows: x.products.map((p, i) => ({ sl: i + 1, sector: p.sector.name, products: p.products })),
      },
      {
        name: "Activity Log", heading: "Activity log",
        columns: [
          { key: "at", header: "Date & Time", width: 18, kind: "datetime" },
          { key: "by", header: "By", width: 22 },
          { key: "action", header: "Action", width: 24 },
          { key: "comment", header: "Comment", width: 30 },
        ],
        rows: x.logs.map((l) => ({
          at: l.createdAt,
          by: l.actorRole ? `${ROLE_LABEL[l.actorRole]}${l.actor ? ` — ${l.actor.displayName}` : ""}` : "Seller",
          action: SELLER_ACTION_LABEL[l.action], comment: l.comment,
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------- sector demand

async function sectorDemandReport(user: User, f: BuyerFilters): Promise<Report> {
  let rows = await sectorDemandSummary(user);
  if (f.sector) rows = rows.filter((r) => r.id === f.sector);
  const filters = f.sector && rows[0] ? [`Sector: ${rows[0].name}`] : [];
  const productRows = rows.flatMap((r) => r.products.map((p) => ({ sector: r.name, ...p })));
  return {
    ...base("sector-demand", user, filters),
    kpis: [
      { label: "Sectors with demand", value: rows.filter((r) => r.buyers).length, tone: "blue" },
      { label: "Buyer-sector requirements", value: rows.reduce((a, r) => a + r.buyers, 0), tone: "violet" },
      { label: "Distinct products requested", value: productRows.length, tone: "yellow" },
      { label: "Products with a matching seller", value: productRows.filter((p) => p.sellers > 0).length, tone: "green" },
    ],
    tables: [
      {
        name: "Sector Summary", heading: "1. Sector summary",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "sector", header: "Sector", width: 26 },
          { key: "buyers", header: "Buyers (incl. Pending)", width: 11, kind: "number", align: "right" },
          { key: "approved", header: "Approved Buyers", width: 11, kind: "number", align: "right" },
          { key: "pending", header: "Under Review", width: 11, kind: "number", align: "right" },
          { key: "top", header: "Most Requested Products (buyers)", width: 52 },
          { key: "sellers", header: "Approved Sellers", width: 11, kind: "number", align: "right" },
          { key: "ratio", header: "Sellers per Approved Buyer", width: 13, align: "right" },
        ],
        rows: rows.map((r, i) => ({
          sl: i + 1, sector: r.name, buyers: r.buyers, approved: r.approvedReqs, pending: r.pendingReqs,
          top: r.products.slice(0, 6).map((p) => `${p.product} (${p.buyers})`).join(", "), sellers: r.sellers,
          ratio: r.approvedReqs ? (r.sellers / r.approvedReqs).toFixed(1) : "—",
        })),
        totals: {
          sector: "Total", buyers: rows.reduce((a, r) => a + r.buyers, 0), approved: rows.reduce((a, r) => a + r.approvedReqs, 0),
          pending: rows.reduce((a, r) => a + r.pendingReqs, 0), sellers: rows.reduce((a, r) => a + r.sellers, 0),
        },
      },
      {
        name: "Product Demand", heading: "2. Product-wise demand",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "sector", header: "Sector", width: 24 },
          { key: "product", header: "Product", width: 28 },
          { key: "buyers", header: "Buyers", width: 9, kind: "number", align: "right" },
          { key: "names", header: "Requested By", width: 60 },
          { key: "sellers", header: "Sellers Offering", width: 12, kind: "number", align: "right" },
        ],
        rows: productRows.map((p, i) => ({ sl: i + 1, sector: p.sector, product: p.product, buyers: p.buyers, names: p.buyerNames.join(", "), sellers: p.sellers })),
      },
    ],
  };
}

// ---------------------------------------------------------------- product demand

async function productDemandReport(user: User, f: BuyerFilters & { view?: string }): Promise<Report> {
  const all = await productDemand(user);
  const q = f.q?.trim().toLowerCase();
  const rows = all.filter((r) => (!f.sector || r.sectorId === f.sector) && (!q || r.product.toLowerCase().includes(q)) &&
    (f.view === "gaps" ? !r.sellers.length : f.view === "approved" ? r.approvedBuyers > 0 : true));
  const filters: string[] = [];
  if (f.sector && rows[0]) filters.push(`Sector: ${rows[0].sectorName}`);
  if (q) filters.push(`Search: "${f.q}"`);
  if (f.view === "gaps") filters.push("Supply gaps only");
  if (f.view === "approved") filters.push("With approved buyer demand");
  return {
    ...base("product-demand", user, filters),
    kpis: [
      { label: "Products requested", value: rows.length, tone: "blue" },
      { label: "With approved demand", value: rows.filter((r) => r.approvedBuyers).length, tone: "green" },
      { label: "Supplied by approved sellers", value: rows.filter((r) => r.sellers.length).length, tone: "violet" },
      { label: "Supply gaps", value: rows.filter((r) => !r.sellers.length).length, tone: "red" },
    ],
    tables: [{
      name: "Product Demand",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "product", header: "Product", width: 24 },
        { key: "sector", header: "Sector", width: 22 },
        { key: "total", header: "Buyers", width: 8, kind: "number", align: "right" },
        { key: "approved", header: "Approved", width: 9, kind: "number", align: "right" },
        { key: "pending", header: "Pending", width: 8, kind: "number", align: "right" },
        { key: "countries", header: "Countries", width: 24 },
        { key: "buyers", header: "Buyers Asking", width: 30 },
        { key: "nSellers", header: "Approved Sellers", width: 9, kind: "number", align: "right" },
        { key: "sellers", header: "Sellers Offering (District)", width: 34 },
      ],
      rows: rows.map((r, i) => ({
        sl: i + 1, product: r.product, sector: r.sectorName, total: r.approvedBuyers + r.pendingBuyers, approved: r.approvedBuyers, pending: r.pendingBuyers,
        countries: r.countries.join(", "),
        buyers: r.buyers.map((b) => `${b.name}${b.approved ? "" : " (pending)"}`).join("\n"),
        nSellers: r.sellers.length,
        sellers: r.sellers.length ? r.sellers.map((s) => `${s.name} (${s.district})`).join("\n") : "NO SUPPLIER YET",
      })),
    }],
  };
}

// ---------------------------------------------------------------- event days

async function eventScheduleReport(user: User, draft: boolean): Promise<Report> {
  const cfg = await getEventConfig();
  const dayNo = new Map(cfg.days.map((d) => [d.date, d.n]));
  const include = { buyer: { select: { name: true, country: true, pavilionNo: true, nodalOfficer: { select: { name: true, mobile: true } } } }, seller: { select: { name: true, district: true, contactName: true, contactMobile: true } } };
  const rows = draft
    ? (await prisma.meeting.findMany({ orderBy: [{ startAt: "asc" }], include })).map((m) => ({ ...m, ticketNo: "", pavilionNo: m.buyer.pavilionNo }))
    : await prisma.scheduledMeeting.findMany({ orderBy: [{ startAt: "asc" }], include });
  rows.sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || (a.pavilionNo ?? 999) - (b.pavilionNo ?? 999));
  const pav = await buyerPrimarySectors();
  const unsched = draft ? await unscheduledPairs() : [];
  const when = (m: { day: string; startAt: Date; endAt: Date }) => `D${dayNo.get(m.day) ?? "?"} ${fmtTime(m.startAt)}`;
  const tables: Table[] = [
    { name: "Schedule", heading: "1. Meetings by day and time",
      columns: [{ key: "day", header: "Day", width: 17 }, { key: "time", header: "Time", width: 17 }, { key: "pav", header: "Pavilion", width: 8, kind: "number", align: "center" },
        { key: "buyer", header: "Buyer", width: 24 }, { key: "country", header: "Country", width: 13 }, { key: "seller", header: "Seller", width: 24 }, { key: "district", header: "District", width: 13 },
        ...(draft ? [] : [{ key: "ticket", header: "Ticket No.", width: 17, kind: "mono" as const }]), { key: "nodal", header: "Nodal Officer", width: 18 }],
      rows: rows.map((m) => ({ day: `Day ${dayNo.get(m.day) ?? "?"} · ${fmtDay(m.day)}`, time: `${fmtTime(m.startAt)}–${fmtTime(m.endAt)}`, pav: m.pavilionNo ?? "",
        buyer: m.buyer.name, country: m.buyer.country, seller: m.seller.name, district: m.seller.district, ticket: m.ticketNo, nodal: m.buyer.nodalOfficer?.name ?? "" })) },
    { name: "By Buyer", heading: "2. Buyer-wise schedule",
      columns: [{ key: "pav", header: "Pavilion", width: 8, kind: "number", align: "center" }, { key: "buyer", header: "Buyer", width: 26 }, { key: "nodal", header: "Nodal Officer", width: 20 },
        { key: "n", header: "Meetings", width: 9, kind: "number", align: "right" }, { key: "list", header: "Meetings (day · time · seller)", width: 60 }],
      rows: [...new Set(rows.map((m) => m.buyerId))].map((id) => { const ms = rows.filter((m) => m.buyerId === id); const b = ms[0].buyer;
        return { pav: b.pavilionNo ?? "", buyer: b.name, nodal: b.nodalOfficer ? `${b.nodalOfficer.name} (${b.nodalOfficer.mobile})` : "", n: ms.length, list: ms.map((m) => `${when(m)} · ${m.seller.name}`).join("\n") }; })
        .sort((a, b) => Number(a.pav || 999) - Number(b.pav || 999)) },
    { name: "By Seller", heading: "3. Seller-wise schedule",
      columns: [{ key: "seller", header: "Seller", width: 26 }, { key: "district", header: "District", width: 14 }, { key: "contact", header: "Promoter / Mobile", width: 22 },
        { key: "n", header: "Meetings", width: 9, kind: "number", align: "right" }, { key: "list", header: "Meetings (day · time · pavilion · buyer)", width: 60 }],
      rows: [...new Set(rows.map((m) => m.sellerId))].map((id) => { const ms = rows.filter((m) => m.sellerId === id); const s = ms[0].seller;
        return { seller: s.name, district: s.district, contact: `${s.contactName} · ${fmtMobile(s.contactMobile)}`, n: ms.length, list: ms.map((m) => `${when(m)} · P${m.pavilionNo ?? "–"} ${m.buyer.name}`).join("\n") }; })
        .sort((a, b) => a.seller.localeCompare(b.seller)) },
    { name: "Pavilions", heading: "4. Pavilions and nodal officers",
      columns: [{ key: "pav", header: "Pavilion", width: 8, kind: "number", align: "center" }, { key: "buyer", header: "Buyer", width: 28 }, { key: "country", header: "Country", width: 14 },
        { key: "sector", header: "Seated by Sector", width: 26 }, { key: "nodal", header: "Nodal Officer", width: 24 }],
      rows: pav.sort((a, b) => (a.pavilionNo ?? 999) - (b.pavilionNo ?? 999)).map((b) => ({ pav: b.pavilionNo ?? "", buyer: b.name, country: b.country, sector: b.primary?.name ?? "", nodal: "" })) },
  ];
  // nodal names for pavilions table
  const officers = await prisma.nodalOfficer.findMany({ select: { id: true, name: true, mobile: true } });
  tables[3].rows = tables[3].rows.map((r, i) => { const o = officers.find((x) => x.id === pav[i].nodalOfficerId); return { ...r, nodal: o ? `${o.name} (${o.mobile})` : "" }; });
  if (draft) tables.push({ name: "Not Scheduled", heading: "5. Pairs not scheduled",
    columns: [{ key: "pav", header: "Pavilion", width: 8, kind: "number", align: "center" }, { key: "buyer", header: "Buyer", width: 30 }, { key: "seller", header: "Seller", width: 30 }, { key: "district", header: "District", width: 16 }],
    rows: unsched.map((p) => ({ pav: p.buyer.pavilionNo ?? "", buyer: p.buyer.name, seller: p.seller.name, district: p.seller.district })) });
  const r = base("event-schedule", user, [draft ? "Draft (not published)" : cfg.version ? `Published version ${cfg.version}` : "Not published",
    ...(cfg.days.length ? [`${fmtDay(cfg.days[0].date)} – ${fmtDay(cfg.days.at(-1)!.date)}`] : []), `${cfg.meetingMinutes}-minute meetings, ${cfg.bufferMinutes}-minute buffer`]);
  return {
    ...r, title: draft ? "Meeting Schedule — Draft" : r.title,
    kpis: [
      { label: "Meetings", value: rows.length, tone: "green" },
      { label: "Buyers", value: new Set(rows.map((m) => m.buyerId)).size, tone: "blue" },
      { label: "Sellers", value: new Set(rows.map((m) => m.sellerId)).size, tone: "violet" },
      { label: draft ? "Not scheduled" : "Event days", value: draft ? unsched.length : cfg.days.length, tone: "yellow" },
    ],
    tables,
  };
}

async function eventAttendanceReport(user: User): Promise<Report> {
  const cfg = await getEventConfig();
  const dayNo = new Map(cfg.days.map((d) => [d.date, d.n]));
  const [ms, att] = await Promise.all([
    prisma.scheduledMeeting.findMany({ orderBy: [{ startAt: "asc" }], include: { buyer: { select: { name: true, approvedNo: true, pavilionNo: true, nodalOfficer: { select: { name: true } } } }, seller: { select: { name: true, district: true, approvedNo: true } }, markedBy: { select: { displayName: true } }, movedBy: { select: { displayName: true } } } }),
    prisma.buyerDayAttendance.findMany({ include: { buyer: { select: { name: true, pavilionNo: true } }, markedBy: { select: { displayName: true } } } }),
  ]);
  const now = new Date();
  const live = ms.map((m) => ({ m, s: liveStatus(m, now) }));
  const by = (k: Live, day?: string) => live.filter((x) => x.s === k && (!day || x.m.day === day)).length;
  const officers = [...new Set(ms.map((m) => m.buyer.nodalOfficer?.name ?? "Not assigned"))];
  return {
    ...base("event-attendance", user, [cfg.version ? `Published version ${cfg.version}` : "Not published", `As at ${fmtDateTime(now)}`]),
    kpis: [
      { label: "Meetings", value: ms.length, tone: "blue" },
      { label: "Completed", value: by("completed"), tone: "green" },
      { label: "Seller / buyer absent", value: by("no_show") + by("buyer_absent"), tone: "red" },
      { label: "Not marked (past)", value: by("not_marked"), tone: "yellow" },
      { label: "Slots filled on the day", value: ms.filter((m) => m.replacesId).length, tone: "violet" },
    ],
    tables: [
      { name: "Summary", heading: "1. Day-wise summary",
        columns: [{ key: "day", header: "Day", width: 24 }, ...(["completed", "in_meeting", "awaiting", "upcoming", "checked_in", "no_show", "buyer_absent", "not_marked", "cancelled"] as Live[]).map((k) => ({ key: k, header: LIVE_META[k].label, width: 11, kind: "number" as const, align: "right" as const })), { key: "total", header: "Total", width: 9, kind: "number", align: "right" }],
        rows: cfg.days.map((d) => ({ day: `Day ${d.n} · ${fmtDay(d.date)}`, total: ms.filter((m) => m.day === d.date).length, ...Object.fromEntries((["completed", "in_meeting", "awaiting", "upcoming", "checked_in", "no_show", "buyer_absent", "not_marked", "cancelled"] as Live[]).map((k) => [k, by(k, d.date)])) })) },
      { name: "Meetings", heading: "2. Every meeting",
        columns: [{ key: "ticket", header: "Ticket No.", width: 17, kind: "mono" }, { key: "when", header: "Day · Time", width: 18 }, { key: "pav", header: "Pavilion", width: 8, kind: "number", align: "center" },
          { key: "buyer", header: "Buyer", width: 22 }, { key: "seller", header: "Seller", width: 22 }, { key: "status", header: "Status", width: 16 }, { key: "by", header: "Marked By", width: 18 }, { key: "at", header: "Marked At", width: 16, kind: "datetime" }, { key: "change", header: "Event-Day Change", width: 24 }, { key: "note", header: "Note", width: 24, excelOnly: true }],
        rows: live.map(({ m, s }) => ({ ticket: m.ticketNo, when: `D${dayNo.get(m.day)} ${fmtTime(m.startAt)}`, pav: m.pavilionNo ?? "", buyer: `${m.buyer.name} (${m.buyer.approvedNo ?? ""})`, seller: `${m.seller.name} (${m.seller.approvedNo ?? ""}, ${m.seller.district})`,
          status: LIVE_META[s].label, by: m.markedBy?.displayName ?? "", at: m.markedAt, note: m.note ?? "",
          change: !m.movedAt ? "" : `${m.movedFrom ? `Moved from ${fmtTime(m.movedFrom)}` : "Added"}${m.replacesId ? `, took ${ms.find((x) => x.id === m.replacesId)?.seller.name ?? "an absent seller"}'s slot` : ""}${m.movedBy ? ` — ${m.movedBy.displayName}` : ""}` })) },
      { name: "Buyer Attendance", heading: "3. Buyers' attendance by day",
        columns: [{ key: "day", header: "Day", width: 22 }, { key: "pav", header: "Pavilion", width: 8, kind: "number", align: "center" }, { key: "buyer", header: "Buyer", width: 28 }, { key: "present", header: "Present", width: 9, align: "center" }, { key: "by", header: "Marked By", width: 20 }, { key: "at", header: "Marked At", width: 16, kind: "datetime" }],
        rows: att.sort((a, b) => a.day.localeCompare(b.day) || (a.buyer.pavilionNo ?? 999) - (b.buyer.pavilionNo ?? 999)).map((a) => ({ day: `Day ${dayNo.get(a.day)} · ${fmtDay(a.day)}`, pav: a.buyer.pavilionNo ?? "", buyer: a.buyer.name, present: a.present ? "Yes" : "No", by: a.markedBy?.displayName ?? "", at: a.markedAt })) },
      { name: "Nodal Officers", heading: "4. Nodal officers — meetings due and marked",
        columns: [{ key: "name", header: "Nodal Officer", width: 26 }, { key: "buyers", header: "Buyers", width: 9, kind: "number", align: "right" }, { key: "meetings", header: "Meetings", width: 10, kind: "number", align: "right" },
          { key: "due", header: "Due So Far", width: 10, kind: "number", align: "right" }, { key: "marked", header: "Marked", width: 10, kind: "number", align: "right" }],
        rows: officers.map((o) => { const mine = ms.filter((m) => (m.buyer.nodalOfficer?.name ?? "Not assigned") === o); const due = mine.filter((m) => m.startAt <= now);
          return { name: o, buyers: new Set(mine.map((m) => m.buyerId)).size, meetings: mine.length, due: due.length, marked: due.filter((m) => m.status !== "SCHEDULED").length }; }) },
    ],
  };
}

// ---------------------------------------------------------------- communications

async function communicationsReport(user: User, conversationId?: string): Promise<Report> {
  const one = conversationId ? await prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true } }) : null;
  const convWhere = one ? { id: one.id } : {};
  const [convs, msgs, anns] = await Promise.all([
    prisma.conversation.findMany({ where: convWhere, orderBy: { lastMessageAt: "desc" },
      include: { buyer: { select: { name: true, approvedNo: true } }, seller: { select: { name: true, approvedNo: true } },
        messages: { select: { authorRole: true, hiddenAt: true, _count: { select: { attachments: true } } } } } }),
    prisma.message.findMany({ where: { conversation: convWhere }, orderBy: { createdAt: "asc" },
      include: { author: { select: { displayName: true } }, attachments: { select: { name: true, mimeType: true, size: true } },
        conversation: { select: { kind: true, buyer: { select: { name: true } }, seller: { select: { name: true } } } } } }),
    one ? Promise.resolve([]) : prisma.announcement.findMany({ orderBy: { createdAt: "desc" },
      include: { author: { select: { displayName: true } }, buyer: { select: { name: true } }, attachments: { select: { name: true } },
        recipients: { select: { readAt: true } } } }),
  ]);
  const KIND: Record<string, string> = { BUYER_SELLER: "Buyer–seller", DESK_BUYER: "Desk — buyer", DESK_SELLER: "Desk — seller" };
  const title = (c: { kind: string; buyer: { name: string } | null; seller: { name: string } | null }) =>
    c.kind === "BUYER_SELLER" ? `${c.buyer?.name} – ${c.seller?.name}` : c.buyer?.name ?? c.seller?.name ?? "";
  const roleName = (r: string) => ({ DIC: "Directorate", FIEO: "FIEO", BUYER: "Buyer", SELLER: "Seller", ADMIN: "Admin" } as Record<string, string>)[r] ?? r;
  const docs = msgs.flatMap((m) => m.attachments.map((a) => ({ at: m.createdAt, where: title(m.conversation), from: m.author.displayName, name: a.name, type: a.mimeType.includes("sheet") ? "Excel" : a.mimeType.includes("word") ? "Word" : a.mimeType.startsWith("image/") ? "Image" : "PDF", kb: Math.round(a.size / 1024) })));
  const r = base("communications", user, one && convs[0] ? [`Conversation: ${title(convs[0])}`] : []);
  const tables: Table[] = [
    { name: "Conversations", heading: "1. Conversations",
      columns: [{ key: "kind", header: "Type", width: 14 }, { key: "title", header: "Buyer / Seller", width: 40 }, num("n", "Messages", 9), num("staff", "By Programme Team", 11), num("docs", "Documents", 9),
        { key: "status", header: "Status", width: 9 }, { key: "created", header: "Started", width: 15, kind: "datetime" }, { key: "last", header: "Last Message", width: 15, kind: "datetime" }],
      rows: convs.map((c) => ({ kind: KIND[c.kind], title: title(c), n: c.messages.length, staff: c.messages.filter((m) => m.authorRole === "DIC" || m.authorRole === "FIEO").length,
        docs: c.messages.reduce((a, m) => a + m._count.attachments, 0), status: c.closed ? "Closed" : "Open", created: c.createdAt, last: c.lastMessageAt })) },
    { name: "Messages", heading: "2. Messages",
      columns: [{ key: "at", header: "Date & Time", width: 15, kind: "datetime" }, { key: "kind", header: "Type", width: 12 }, { key: "where", header: "Conversation", width: 30 },
        { key: "from", header: "From", width: 20 }, { key: "role", header: "Role", width: 11 }, { key: "body", header: "Message", width: 60 }, { key: "docs", header: "Documents", width: 26 }],
      rows: msgs.map((m) => ({ at: m.createdAt, kind: KIND[m.conversation.kind], where: title(m.conversation), from: m.author.displayName, role: roleName(m.authorRole),
        body: (m.hiddenAt ? "[Withdrawn by the programme team] " : "") + m.body, docs: m.attachments.map((a) => a.name).join("\n") })) },
    { name: "Documents", heading: "3. Documents shared",
      columns: [{ key: "at", header: "Date & Time", width: 15, kind: "datetime" }, { key: "where", header: "Conversation", width: 32 }, { key: "from", header: "Shared By", width: 22 },
        { key: "name", header: "Document Name", width: 36 }, { key: "type", header: "Type", width: 8 }, num("kb", "Size (KB)", 9)],
      rows: docs },
  ];
  if (!one) tables.push({ name: "Communications Sent", heading: "4. Common communications",
    columns: [{ key: "at", header: "Sent", width: 15, kind: "datetime" }, { key: "from", header: "From", width: 22 }, { key: "to", header: "To", width: 34 }, { key: "subject", header: "Subject", width: 36 },
      num("n", "Recipients", 10), num("read", "Read", 8), { key: "docs", header: "Documents", width: 26 }],
    rows: anns.map((a) => ({ at: a.createdAt, from: a.authorRole === "BUYER" ? `Buyer: ${a.buyer?.name}` : `${roleName(a.authorRole)} (${a.author.displayName})`, to: a.audienceLabel, subject: a.subject,
      n: a.recipients.length, read: a.recipients.filter((x) => x.readAt).length, docs: a.attachments.map((d) => d.name).join("\n") })) });
  return {
    ...r,
    title: one && convs[0] ? `Conversation — ${title(convs[0])}` : r.title,
    kpis: [
      { label: "Conversations", value: convs.length, tone: "blue" },
      { label: "Messages", value: msgs.length, tone: "green" },
      { label: "Documents shared", value: docs.length + (one ? 0 : anns.reduce((a, x) => a + x.attachments.length, 0)), tone: "violet" },
      { label: one ? "Programme-team messages" : "Communications sent", value: one ? msgs.filter((m) => m.authorRole === "DIC" || m.authorRole === "FIEO").length : anns.length, tone: "yellow" },
    ],
    tables,
  };
}
const num = (key: string, header: string, width = 10) => ({ key, header, width, kind: "number" as const, align: "right" as const });

// ---------------------------------------------------------------- seller profile analysis

async function sellerProfileAnalysis(user: User): Promise<Report> {
  const districts = user.role === "DISTRICT" ? [user.district ?? ""] : DISTRICT_NAMES;
  const p = await sellerProfileStats(sellerScope(user), districts);
  const S = p.summary;
  const pct = (a: number) => (S.completed ? Math.round((a / S.completed) * 100) : 0);
  const num = (key: string, header: string, width = 8) => ({ key, header, width, kind: "number" as const, align: "right" as const });
  const pending = await prisma.seller.findMany({
    where: { AND: [sellerScope(user), { status: "APPROVED", profileCompletedAt: null }] }, orderBy: [{ district: "asc" }, { approvedSeq: "asc" }],
    select: { approvedNo: true, name: true, district: true, contactName: true, contactMobile: true, contactEmail: true, approvedAt: true },
  });
  return {
    ...base("seller-profile-analysis", user, user.role === "DISTRICT" ? [`District: ${user.district}`] : []),
    kpis: [
      { label: "Profiles completed", value: `${S.completed} / ${S.approved}`, tone: "green" },
      { label: "Women promoters", value: `${S.women} (${pct(S.women)}%)`, tone: "violet" },
      { label: "SC / ST promoters", value: `${S.scst} (${pct(S.scst)}%)`, tone: "blue" },
      { label: "With IEC number", value: `${S.withIec} / ${S.approved}`, tone: "yellow" },
    ],
    tables: [
      {
        name: "District-wise", heading: "1. Approved sellers by district",
        columns: [{ key: "district", header: "District", width: 18 }, num("approved", "Approved", 9), num("completed", "Profile Done", 9), num("pending", "Pending"),
          num("women", "Women", 7), num("scst", "SC / ST", 7), num("disabled", "Sp. Abled", 7), num("micro", "Micro", 7), num("small", "Small", 7),
          num("medium", "Medium", 7), num("large", "Large", 7), num("mfg", "Mfg.", 7), num("service", "Service", 7), num("trade", "Trade", 7),
          num("withIec", "IEC", 7), num("certified", "Certified")],
        rows: p.byDistrict,
        totals: { district: "Total", ...Object.fromEntries((["approved", "completed", "pending", "women", "scst", "disabled", "micro", "small", "medium", "large", "mfg", "service", "trade", "withIec", "certified"] as const)
          .map((k) => [k, p.byDistrict.reduce((a, r) => a + r[k], 0)])) },
      },
      {
        name: "Breakdown", heading: "2. Breakdown of completed profiles",
        columns: [{ key: "dim", header: "Attribute", width: 26 }, { key: "label", header: "Value", width: 36 }, num("n", "Sellers", 10), num("pct", "% of Completed", 13)],
        rows: ([["Category of unit", p.dims.category], ["Unit type", p.dims.unitType], ["Constitution of unit", p.dims.constitution],
          ["Gender of promoter", p.dims.gender], ["Social category", p.dims.social]] as const)
          .flatMap(([dim, xs]) => xs.map((o, i) => ({ dim: i ? "" : dim, label: o.label, n: o.n, pct: pct(o.n) }))),
      },
      {
        name: "Certification Readiness", heading: "3. Certifications required by approved buyers against approved sellers",
        columns: [{ key: "name", header: "Certification", width: 30 }, { key: "sectors", header: "Required in Sectors", width: 40 },
          num("buyerSectors", "Approved Buyer Sectors", 12), num("holders", "Sellers Holding It", 11), num("inSector", "…in Those Sectors", 11)],
        rows: p.certReadiness.map((c) => ({ name: c.name, sectors: c.sectors.join(", "), buyerSectors: c.buyerSectors, holders: c.holders, inSector: c.inSector })),
      },
      {
        name: "Export Markets", heading: "4. Countries approved sellers have already exported to (reference only)",
        columns: [{ key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" }, { key: "country", header: "Country", width: 30 },
          num("sellers", "Approved Sellers", 12), num("buyers", "Approved Buyers from Country", 14)],
        rows: p.exportMarkets.map((m, i) => ({ sl: i + 1, ...m })),
      },
      {
        name: "Profile Pending", heading: "5. Approved sellers yet to complete the profile",
        columns: [{ key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" }, { key: "approvedNo", header: "Seller No.", width: 19, kind: "mono" },
          { key: "name", header: "Name of Seller", width: 28 }, { key: "district", header: "District", width: 16 }, { key: "contact", header: "Name of Promoter", width: 20 },
          { key: "mobile", header: "Mobile", width: 15 }, { key: "email", header: "E-mail", width: 26 }, { key: "approvedAt", header: "Approved On", width: 13, kind: "date" }],
        rows: pending.map((x, i) => ({ sl: i + 1, approvedNo: x.approvedNo, name: x.name, district: x.district, contact: x.contactName,
          mobile: fmtMobile(x.contactMobile), email: x.contactEmail, approvedAt: x.approvedAt })),
      },
    ],
  };
}

// ---------------------------------------------------------------- Directorate insights

async function insightsReport(user: User): Promise<Report> {
  const d = await buildInsights(user);
  const v = await buildDecisionView(d, user.role === "ADMIN" ? "/admin" : "/dic");
  const label = { ready: "Ready", sector: "Sector match only", short: "Short of sellers" } as const;
  const num = (key: string, header: string, width = 10) => ({ key, header, width, kind: "number" as const, align: "right" as const });
  return {
    ...base("insights", user, []),
    kpis: [
      { label: "Buyers ready for matchmaking", value: `${d.summary.ready} / ${d.summary.approvedBuyers}`, tone: "green" },
      { label: "Buyers short of sellers", value: d.summary.short, tone: "red" },
      { label: "Products with no supplier", value: `${d.summary.productGaps} / ${d.summary.products}`, tone: "yellow" },
      { label: "Pending > 7 days", value: d.summary.overdue, tone: "violet" },
    ],
    tables: ([
      {
        name: "Key Findings", heading: "Key findings and recommended actions",
        columns: [{ key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" }, { key: "priority", header: "Priority", width: 11 },
          { key: "title", header: "Finding", width: 38 }, { key: "detail", header: "Detail", width: 46 }, { key: "action", header: "Recommended Action", width: 40 }],
        rows: v.findings.map((f, i) => ({ sl: i + 1, priority: { red: "High", amber: "Medium", blue: "Note", green: "On track" }[f.tone], title: f.title, detail: f.detail, action: f.action ?? "" })),
      },
      {
        name: "Funnels", heading: "Registration funnels",
        columns: [{ key: "who", header: "Applicant", width: 18 }, { key: "stage", header: "Stage", width: 36 }, num("n", "Count"), num("conv", "% of Previous", 13)],
        rows: [...v.buyerFunnel.map((st, i, a) => ({ who: i ? "" : "Buyers", stage: st.label, n: st.value, conv: i ? (a[i - 1].value ? Math.round((st.value / a[i - 1].value) * 100) : 0) : "" })),
          ...v.sellerFunnel.map((st, i, a) => ({ who: i ? "" : "Sellers", stage: st.label, n: st.value, conv: i ? (a[i - 1].value ? Math.round((st.value / a[i - 1].value) * 100) : 0) : "" }))],
      },
      {
        name: "Targets and Pace", heading: "Progress to targets and pace (approvals in the last 14 days)",
        columns: [{ key: "label", header: "Measure", width: 22 }, num("value", "Achieved"), num("target", "Target"), num("pct", "% of Target", 12),
          { key: "pace", header: "Per Week", width: 11, align: "right" }, { key: "weeks", header: "Weeks to Target", width: 15, align: "right" }],
        rows: v.pace.map((x) => ({ label: x.label, value: x.value, target: x.target, pct: x.target ? Math.round((x.value / x.target) * 100) : 0,
          pace: x.perWeek.toFixed(1), weeks: x.weeks === null ? "No recent approvals" : x.weeks === 0 ? "Reached" : `~${x.weeks}` })),
      },
      {
        name: "District Performance", heading: "District performance (approved sellers against target)",
        columns: [{ key: "sl", header: "Rank", width: 6, kind: "number", align: "center" }, { key: "district", header: "District", width: 20 },
          num("registered", "Registered"), num("approved", "Approved"), num("target", "Target"), num("pct", "% Achieved", 11),
          num("pending", "With District"), num("waiting", "Waiting > 7 Days", 13), { key: "avg", header: "Avg Days to Recommend", width: 14, align: "right" }, num("rejected", "Rejected")],
        rows: v.districts.map((x, i) => ({ sl: i + 1, district: x.district, registered: x.registered, approved: x.approved, target: x.target, pct: Math.round(x.achieved * 100),
          pending: x.pendingWithDistrict, waiting: x.waitingOver7, avg: x.avgDaysToRecommend === null ? "" : x.avgDaysToRecommend.toFixed(1), rejected: x.rejected })),
      },
      {
        name: "Rework", heading: "Rework and rejection",
        columns: [{ key: "label", header: "Measure", width: 50 }, num("count", "Count"), num("of", "Out of"), num("pct", "%")],
        rows: v.rework.map((r) => ({ label: r.label, count: r.count, of: r.of, pct: r.of ? Math.round((r.count / r.of) * 100) : 0 })),
      },
      {
        name: "Seller Profile", heading: "Seller profile — approved sellers by district",
        columns: [{ key: "district", header: "District", width: 18 }, num("approved", "Approved", 9), num("completed", "Profile Done", 9), num("pending", "Pending", 8),
          num("women", "Women", 7), num("scst", "SC / ST", 7), num("disabled", "Sp. Abled", 7), num("micro", "Micro", 7), num("small", "Small", 7),
          num("medium", "Medium", 7), num("large", "Large", 7), num("mfg", "Mfg.", 7), num("service", "Service", 7), num("trade", "Trade", 7),
          num("withIec", "IEC", 7), num("certified", "Certified", 8)],
        rows: v.profile.byDistrict,
        totals: { district: "Total", ...Object.fromEntries((["approved", "completed", "pending", "women", "scst", "disabled", "micro", "small", "medium", "large", "mfg", "service", "trade", "withIec", "certified"] as const)
          .map((k) => [k, v.profile.byDistrict.reduce((a, r) => a + r[k], 0)])) },
      },
      {
        name: "Profile Breakdown", heading: "Seller profile — breakdown of completed profiles",
        columns: [{ key: "dim", header: "Attribute", width: 26 }, { key: "label", header: "Value", width: 36 }, num("n", "Sellers"), num("pct", "% of Completed", 13)],
        rows: ([["Category of unit", v.profile.dims.category], ["Unit type", v.profile.dims.unitType], ["Constitution of unit", v.profile.dims.constitution],
          ["Gender of promoter", v.profile.dims.gender], ["Social category", v.profile.dims.social]] as const)
          .flatMap(([dim, xs]) => xs.map((o, i) => ({ dim: i ? "" : dim, label: o.label, n: o.n, pct: v.profile.summary.completed ? Math.round((o.n / v.profile.summary.completed) * 100) : 0 }))),
      },
      {
        name: "Seller Export Markets", heading: "Countries approved sellers have already exported to (reference only)",
        columns: [{ key: "country", header: "Country", width: 30 }, num("sellers", "Approved Sellers", 12), num("buyers", "Approved Buyers from Country", 14)],
        rows: v.profile.exportMarkets,
      },
      {
        name: "Certification Readiness", heading: "Certification readiness — approved buyer demand against approved sellers",
        columns: [{ key: "name", header: "Certification", width: 30 }, { key: "sectors", header: "Required in Sectors", width: 40 },
          num("buyerSectors", "Approved Buyer Sectors", 12), num("holders", "Sellers Holding It", 11), num("inSector", "…in Those Sectors", 11), { key: "pos", header: "Position", width: 18 }],
        rows: v.profile.certReadiness.map((c) => ({ name: c.name, sectors: c.sectors.join(", "), buyerSectors: c.buyerSectors, holders: c.holders, inSector: c.inSector,
          pos: !c.inSector ? "No certified seller" : c.inSector < c.buyerSectors ? "Thin" : "Covered" })),
      },
      {
        name: "Matchmaking Readiness", heading: `1. Matchmaking readiness (target ${d.target} sellers per buyer)`,
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Buyer No.", width: 19, kind: "mono" },
          { key: "name", header: "Buyer", width: 26 }, { key: "country", header: "Country", width: 15 },
          { key: "sectors", header: "Approved Sectors", width: 34 },
          num("sectorSellers", "Sellers in Sectors", 12), num("productSellers", "Product-matched Sellers", 13),
          { key: "status", header: "Status", width: 16 },
        ],
        rows: d.readiness.map((r, i) => ({ sl: i + 1, approvedNo: r.approvedNo, name: r.name, country: r.country, sectors: r.sectors.join("\n"),
          sectorSellers: r.sectorSellers, productSellers: r.productSellers, status: label[r.status] })),
      },
      {
        name: "Sector Supply Gaps", heading: "2. Sectors short of sellers",
        columns: [
          { key: "sector", header: "Sector", width: 28 }, num("buyers", "Approved Buyers"), num("needed", "Sellers Needed"),
          num("sellers", "Approved Sellers"), num("exp", "Export-ready"), num("shortfall", "Shortfall"),
        ],
        rows: d.sectorGaps.map((g) => ({ sector: g.name, buyers: g.approvedBuyers, needed: g.needed, sellers: g.sellers, exp: g.exportReady, shortfall: g.shortfall })),
      },
      {
        name: "Products No Supplier", heading: "3. Requested products with no approved supplier",
        columns: [
          { key: "product", header: "Product", width: 26 }, { key: "sector", header: "Sector", width: 24 },
          num("buyers", "Buyers"), num("approved", "Approved"), { key: "countries", header: "Countries", width: 30 },
        ],
        rows: d.productGaps.map((p) => ({ product: p.product, sector: p.sectorName, buyers: p.approvedBuyers + p.pendingBuyers, approved: p.approvedBuyers, countries: p.countries.join(", ") })),
      },
      {
        name: "District x Sector", heading: "4. Approved sellers by district and sector",
        columns: [{ key: "district", header: "District", width: 18 },
          ...d.supplySectors.map((s, i) => num(`c${i}`, s.name, 10)), num("total", "Sellers")],
        rows: d.districtSector.map((r) => ({ district: r.district, total: r.total, ...Object.fromEntries(r.cells.map((v, i) => [`c${i}`, v])) })),
      },
      {
        name: "Country x Sector", heading: "5. Buyer requirements by country and sector",
        columns: [{ key: "country", header: "Country", width: 18 },
          ...d.demandSectors.map((s, i) => num(`c${i}`, s.name, 11)), num("total", "All Sectors")],
        rows: d.countrySector.map((r) => ({ country: r.country, total: r.total, ...Object.fromEntries(r.cells.map((v, i) => [`c${i}`, v])) })),
      },
      {
        name: "Certifications", heading: "6. Certifications required by buyers",
        columns: [{ key: "name", header: "Certification", width: 34 }, num("all", "All Requirements", 14), num("approved", "Approved", 12)],
        rows: d.certifications.map((c) => ({ name: c.name, all: c.all, approved: c.approved })),
      },
      {
        name: "Turnaround", heading: "7. Average turnaround (including correction rounds)",
        columns: [{ key: "stage", header: "Stage", width: 50 }, { key: "days", header: "Average Days", width: 14, align: "right" }, num("n", "Files", 10)],
        rows: d.turnaround.map((t) => ({ stage: t.stage, days: t.days === null ? "" : t.days.toFixed(1), n: t.n })),
      },
      {
        name: "Pending Ageing", heading: "8. Pending now, by waiting time",
        columns: [{ key: "stage", header: "Stage", width: 40 }, ...AGE_BUCKETS.map((b, i) => num(`b${i}`, b, 11)), num("total", "Total"), num("oldest", "Oldest (days)", 12)],
        rows: d.ageing.map((a) => ({ stage: a.stage, total: a.total, oldest: a.oldest ?? "", ...Object.fromEntries(a.buckets.map((n, i) => [`b${i}`, n])) })),
      },
    ] as Table[]).map((t, i) => ({ ...t, heading: `${i + 1}. ${(t.heading ?? t.name).replace(/^\d+\. /, "")}` })),
  };
}

// ---------------------------------------------------------------- matchmaking

async function matchListReport(user: User, which: "published" | "draft"): Promise<Report> {
  // Only the Directorate and Admin see the working list; everyone else sees what is published.
  const draft = which === "draft" && (user.role === "DIC" || user.role === "ADMIN");
  const internal = user.role === "DIC" || user.role === "ADMIN";
  const districtOnly = user.role === "DISTRICT" ? { seller: { district: user.district ?? "" } } : {};
  const [state, pool, pairs, published, removed] = await Promise.all([
    getMatchState(), loadPool(),
    draft
      ? prisma.match.findMany({ where: { removed: false }, select: { buyerId: true, sellerId: true, source: true } })
      : prisma.publishedMatch.findMany({ where: districtOnly, orderBy: { slot: "asc" }, select: { buyerId: true, sellerId: true, source: true } }),
    draft ? prisma.publishedMatch.findMany({ select: { buyerId: true, sellerId: true, source: true } }) : Promise.resolve([]),
    draft ? prisma.match.findMany({ where: { removed: true }, select: { buyerId: true, sellerId: true, updatedAt: true } }) : Promise.resolve([]),
  ]);
  const sellerById = new Map(pool.sellers.map((s) => [s.id, s]));
  const buyerById = new Map(pool.buyers.map((b) => [b.id, b]));
  const fitOf = (buyerId: string, sellerId: string) => fit(buyerById.get(buyerId)!, sellerById.get(sellerId)!, pool.prefRank.get(`${buyerId}|${sellerId}`) ?? null);
  const label = draft ? "Working list (not published)" : state.version ? `Published version ${state.version}${state.locked ? " (final)" : ""}` : "Not published yet";

  // 1. Pair by pair, with both sides' sectors and products and why the pair is there.
  const rows: Row[] = [];
  const buyerRows: Row[] = [];
  let sl = 0;
  for (const b of pool.buyers) {
    const mine = pairs.filter((p) => p.buyerId === b.id && sellerById.has(p.sellerId))
      .map((p) => ({ p, s: sellerById.get(p.sellerId)!, f: fitOf(b.id, p.sellerId) }))
      .sort((x, y) => y.f.score - x.f.score);
    mine.forEach(({ p, s, f }, i) => rows.push({
      sl: ++sl, buyerNo: b.approvedNo, buyer: b.name, country: b.country, n: i + 1, needs: buyerNeeds(b),
      sellerNo: s.approvedNo, seller: s.name, district: s.district, offers: sellerOffers(s),
      why: whyMatched(f, s, internal), source: SOURCE_LABEL[p.source] + (f.prefRank ? ` (preference #${f.prefRank})` : ""), score: f.score,
      iec: s.iecNo ?? "", certs: s.certifications.join(", "),
    }));
    if (user.role !== "DISTRICT" || mine.length) {
      const src = (x: string) => mine.filter((m) => m.p.source === x).length;
      buyerRows.push({
        buyerNo: b.approvedNo, buyer: b.name, country: b.country, sectors: b.sectors.map((x) => x.name).join(", "), n: mine.length,
        pref: src("PREFERENCE"), sys: src("SYSTEM"), manual: src("MANUAL"),
        status: user.role === "DISTRICT" ? "" : mine.length >= pool.target ? "At target" : mine.length ? `Short by ${pool.target - mine.length}` : "No sellers",
      });
    }
  }
  // 2. Seller by seller.
  const sellerRows: Row[] = pool.sellers
    .filter((s) => user.role !== "DISTRICT" || s.district === user.district)
    .map((s) => {
      const mine = pairs.filter((p) => p.sellerId === s.id && buyerById.has(p.buyerId));
      const prefs = pool.prefs.filter((x) => x.sellerId === s.id);
      return {
        sellerNo: s.approvedNo, seller: s.name, district: s.district, sectors: s.sectors.map((x) => x.name).join(", "), n: mine.length,
        buyers: mine.map((p) => `${buyerById.get(p.buyerId)!.name} (${buyerById.get(p.buyerId)!.country})`).join("\n"),
        prefs: prefs.length ? `${prefs.filter((x) => mine.some((m) => m.buyerId === x.buyerId)).length} of ${prefs.length}` : "—",
      };
    })
    .sort((a, b) => Number(b.n) - Number(a.n) || String(a.seller).localeCompare(String(b.seller)));

  const tables: Table[] = [
    {
      name: "Mapping", heading: "1. Buyer–seller pairs — what each side needs / offers and why they are matched",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "buyerNo", header: "Buyer No.", width: 19, kind: "mono", excelOnly: true },
        { key: "buyer", header: "Buyer", width: 20 }, { key: "country", header: "Country", width: 12 },
        { key: "needs", header: "Buyer's Approved Sectors & Products", width: 34 },
        { key: "n", header: "#", width: 4, kind: "number", align: "center" },
        { key: "sellerNo", header: "Seller No.", width: 19, kind: "mono", excelOnly: true },
        { key: "seller", header: "Seller", width: 20 }, { key: "district", header: "District", width: 12 },
        { key: "offers", header: "Seller's Sectors & Products", width: 34 },
        { key: "why", header: "Why Matched", width: 40 },
        ...(internal ? [{ key: "source", header: "How Matched", width: 16 }, { key: "score", header: "Fit", width: 6, kind: "number" as const, align: "right" as const }] : []),
        { key: "iec", header: "Seller IEC", width: 13, kind: "mono", excelOnly: true },
        { key: "certs", header: "Seller Certifications", width: 30, excelOnly: true },
      ],
      rows,
    },
    {
      name: "Buyer-wise", heading: `2. Buyer-wise summary${user.role === "DISTRICT" ? ` (sellers of ${user.district})` : ` (target ${pool.target} sellers per buyer)`}`,
      columns: [
        { key: "buyerNo", header: "Buyer No.", width: 19, kind: "mono" }, { key: "buyer", header: "Buyer", width: 26 }, { key: "country", header: "Country", width: 15 },
        { key: "sectors", header: "Approved Sectors", width: 36 }, { key: "n", header: "Sellers", width: 8, kind: "number", align: "right" },
        ...(internal ? [
          { key: "pref", header: "Preference", width: 10, kind: "number" as const, align: "right" as const },
          { key: "sys", header: "System", width: 8, kind: "number" as const, align: "right" as const },
          { key: "manual", header: "Manual", width: 8, kind: "number" as const, align: "right" as const },
        ] : []),
        ...(user.role === "DISTRICT" ? [] : [{ key: "status", header: "Position", width: 14 }]),
      ],
      rows: buyerRows,
    },
    {
      name: "Seller-wise", heading: "3. Seller-wise summary — the buyers each seller meets",
      columns: [
        { key: "sellerNo", header: "Seller No.", width: 19, kind: "mono" }, { key: "seller", header: "Seller", width: 26 }, { key: "district", header: "District", width: 15 },
        { key: "sectors", header: "Sectors", width: 30 }, { key: "n", header: "Buyers", width: 8, kind: "number", align: "right" },
        { key: "buyers", header: "Buyers (Country)", width: 40 },
        ...(internal ? [{ key: "prefs", header: "Own Preferences Included", width: 13, align: "center" as const }] : []),
      ],
      rows: sellerRows,
    },
  ];
  if (draft && state.version) {
    const key = (x: { buyerId: string; sellerId: string }) => `${x.buyerId}|${x.sellerId}`;
    const pub = new Set(published.map(key)), cur = new Set(pairs.map(key));
    const name = (x: { buyerId: string; sellerId: string }) => ({ buyer: buyerById.get(x.buyerId)?.name ?? "—", seller: sellerById.get(x.sellerId)?.name ?? "(no longer approved)" });
    tables.push({
      name: "Changes vs Published", heading: `4. Changes against published version ${state.version} (seen by participants only after republishing)`,
      columns: [{ key: "change", header: "Change", width: 12 }, { key: "buyer", header: "Buyer", width: 28 }, { key: "seller", header: "Seller", width: 28 }, { key: "source", header: "How Matched", width: 20 }],
      rows: [
        ...pairs.filter((x) => !pub.has(key(x))).map((x) => ({ change: "Added", ...name(x), source: SOURCE_LABEL[x.source] })),
        ...published.filter((x) => !cur.has(key(x))).map((x) => ({ change: "Removed", ...name(x), source: SOURCE_LABEL[x.source] })),
      ],
    });
  }
  // Pairs whose buyer or seller is no longer approved (kept until the mapping is changed and republished).
  const orphans = pairs.filter((p) => !sellerById.has(p.sellerId) || !buyerById.has(p.buyerId));
  if (orphans.length) {
    const [ob, os] = await Promise.all([
      prisma.buyer.findMany({ where: { id: { in: orphans.map((o) => o.buyerId) } }, select: { id: true, name: true, status: true } }),
      prisma.seller.findMany({ where: { id: { in: orphans.map((o) => o.sellerId) } }, select: { id: true, name: true, status: true } }),
    ]);
    tables.push({
      name: "Needs Attention", heading: `${tables.length + 1}. Pairs whose buyer or seller is no longer approved`,
      columns: [{ key: "buyer", header: "Buyer", width: 30 }, { key: "seller", header: "Seller", width: 30 }, { key: "note", header: "Note", width: 40 }],
      rows: orphans.map((o) => {
        const b = ob.find((x) => x.id === o.buyerId), sl = os.find((x) => x.id === o.sellerId);
        return { buyer: b?.name ?? "—", seller: sl?.name ?? "—",
          note: [b && b.status !== "APPROVED" && "Buyer no longer approved", sl && sl.status !== "APPROVED" && "Seller no longer approved"].filter(Boolean).join("; ") || "Not in the approved lists" };
      }),
    });
  }
  if (draft) tables.push({
    name: "Excluded Pairs", heading: `${tables.length + 1}. Pairs removed by the Directorate (kept out when suggestions are refreshed)`,
    columns: [{ key: "buyer", header: "Buyer", width: 28 }, { key: "seller", header: "Seller", width: 28 }, { key: "pref", header: "Seller's Preference", width: 14 }, { key: "at", header: "Removed On", width: 16, kind: "datetime" }],
    rows: removed.filter((x) => buyerById.has(x.buyerId) && sellerById.has(x.sellerId)).map((x) => ({
      buyer: buyerById.get(x.buyerId)!.name, seller: sellerById.get(x.sellerId)!.name,
      pref: pool.prefRank.get(`${x.buyerId}|${x.sellerId}`) ? `#${pool.prefRank.get(`${x.buyerId}|${x.sellerId}`)}` : "", at: x.updatedAt,
    })),
  });

  const r = base("match-list", user, [label, ...(user.role === "DISTRICT" ? [`Sellers of ${user.district}`] : [])]);
  return {
    ...r,
    title: draft ? "Buyer–Seller Mapping — Working List" : state.locked ? "Buyer–Seller Mapping — Final" : r.title,
    fileName: draft ? r.fileName.replace("Mapping", "Mapping-Working-List") : r.fileName,
    kpis: [
      { label: "Buyers", value: new Set(rows.map((x) => x.buyer)).size, tone: "blue" },
      { label: "Buyer–seller pairs", value: rows.length, tone: "green" },
      { label: "Sellers", value: new Set(rows.map((x) => x.seller)).size, tone: "violet" },
      { label: "Target per buyer", value: pool.target, tone: "yellow" },
    ],
    tables,
  };
}

async function sellerPreferencesReport(user: User): Promise<Report> {
  const [{ rows, summary }, state, pool, removed, draftCount, profiles] = await Promise.all([
    preferenceOutcomes(), getMatchState(), loadPool(),
    prisma.match.findMany({ where: { removed: true }, select: { buyerId: true, sellerId: true } }),
    prisma.match.count({ where: { removed: false } }),
    prisma.seller.findMany({ where: { status: "APPROVED" }, select: { id: true, profileCompletedAt: true, contactName: true, contactMobile: true, contactEmail: true } }),
  ]);
  const sellerById = new Map(pool.sellers.map((s) => [s.id, s]));
  const buyerById = new Map(pool.buyers.map((b) => [b.id, b]));
  const profileOf = new Map(profiles.map((p) => [p.id, p]));
  const removedSet = new Set(removed.map((x) => `${x.buyerId}|${x.sellerId}`));
  const cell = (r: (typeof rows)[number], n: number) => {
    const p = r.prefs.find((x) => x.rank === n);
    return p ? `${p.buyer}${p.inPublished ? " ✓ published" : p.inDraft ? " ✓ list" : ""}` : "";
  };
  const outcome = (inDraft: boolean, inPublished: boolean, buyerId: string, sellerId: string, common: boolean) =>
    inPublished ? (inDraft ? "In published mapping" : "In published mapping; removed from working list")
    : inDraft ? "In working list (not yet published)"
    : removedSet.has(`${buyerId}|${sellerId}`) ? "Removed by the Directorate"
    : !common ? "Not placed — no common sector with the buyer"
    : !draftCount ? "Mapping not built yet"
    : "Not placed — buyer's list was full or the seller reached the buyer limit";

  // Each preference with both sides' sectors and products and the result.
  const detail: Row[] = [];
  for (const r of rows) for (const p of r.prefs) {
    const s = sellerById.get(r.id), b = buyerById.get(p.buyerId);
    const f = s && b ? fit(b, s, p.rank) : null;
    detail.push({
      sellerNo: r.approvedNo, seller: r.name, district: r.district, offers: s ? sellerOffers(s) : "", rank: p.rank,
      buyerNo: p.approvedNo, buyer: p.buyer, country: b?.country ?? "", needs: b ? buyerNeeds(b) : "(buyer no longer approved)",
      fitWhy: f && s ? whyMatched(f, s, true) : "", score: f?.score ?? "",
      outcome: outcome(p.inDraft, p.inPublished, p.buyerId, r.id, !!f?.sectors.length),
    });
  }
  const pending = rows.filter((r) => !r.prefSubmittedAt);
  const byBuyer = pool.buyers.map((b) => {
    const ps = pool.prefs.filter((x) => x.buyerId === b.id);
    return { buyerNo: b.approvedNo, buyer: b.name, country: b.country, sectors: b.sectors.map((x) => x.name).join(", "),
      total: ps.length, first: ps.filter((x) => x.rank === 1).length, sellers: ps.map((x) => `${sellerById.get(x.sellerId)?.name ?? "—"} (#${x.rank})`).join("\n") };
  }).sort((a, b) => b.total - a.total || a.buyer.localeCompare(b.buyer));

  return {
    ...base("seller-preferences", user, [state.prefsFrozen ? "Preferences frozen" : "Preferences open", state.buyersVisible ? "Buyer directory open" : "Buyer directory hidden"]),
    kpis: [
      { label: "Sellers who submitted", value: `${summary.submitted} / ${summary.sellers}`, tone: "violet" },
      { label: "Preferences given", value: summary.preferences, tone: "blue" },
      { label: "Included in working list", value: summary.honouredDraft, tone: "green" },
      { label: "Included in published", value: summary.honouredPublished, tone: "yellow" },
    ],
    tables: [
      {
        name: "Seller Preferences", heading: "1. Each seller's preferences (rank 1–5) and how many were included",
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Seller No.", width: 19, kind: "mono", excelOnly: true },
          { key: "name", header: "Seller", width: 24 }, { key: "district", header: "District", width: 14 },
          { key: "submitted", header: "Submitted On", width: 14, kind: "date" },
          ...[1, 2, 3, 4, 5].map((n) => ({ key: `p${n}`, header: `Preference ${n}`, width: 20 })),
          { key: "honoured", header: "Included", width: 9, align: "center" as const },
          { key: "mapped", header: "Buyers Mapped", width: 9, kind: "number" as const, align: "right" as const },
        ],
        rows: rows.filter((r) => r.prefSubmittedAt).map((r, i) => ({
          sl: i + 1, approvedNo: r.approvedNo, name: r.name, district: r.district, submitted: r.prefSubmittedAt,
          ...Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`p${n}`, cell(r, n)])),
          honoured: r.prefs.length ? `${state.version ? r.honouredPublished : r.honouredDraft}/${r.prefs.length}` : "",
          mapped: state.version ? r.matchedPublished : r.matchedDraft,
        })),
      },
      {
        name: "Preference Details", heading: "2. Every preference — seller's offer, buyer's need, fit and result",
        columns: [
          { key: "sellerNo", header: "Seller No.", width: 19, kind: "mono", excelOnly: true },
          { key: "seller", header: "Seller", width: 20 }, { key: "district", header: "District", width: 12 },
          { key: "offers", header: "Seller's Sectors & Products", width: 32 },
          { key: "rank", header: "Rank", width: 5, kind: "number", align: "center" },
          { key: "buyerNo", header: "Buyer No.", width: 19, kind: "mono", excelOnly: true },
          { key: "buyer", header: "Buyer", width: 20 }, { key: "country", header: "Country", width: 12 },
          { key: "needs", header: "Buyer's Approved Sectors & Products", width: 32 },
          { key: "fitWhy", header: "Fit", width: 36 }, { key: "score", header: "Score", width: 6, kind: "number", align: "right" },
          { key: "outcome", header: "Result", width: 24 },
        ],
        rows: detail,
      },
      {
        name: "No Preferences Yet", heading: `3. Approved sellers who have not given preferences${state.prefsFrozen ? " (window closed)" : ""}`,
        columns: [
          { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
          { key: "approvedNo", header: "Seller No.", width: 19, kind: "mono" }, { key: "name", header: "Seller", width: 26 },
          { key: "district", header: "District", width: 15 }, { key: "sectors", header: "Sectors & Products", width: 36 },
          { key: "profile", header: "Profile", width: 12 },
          { key: "contact", header: "Promoter", width: 18 }, { key: "mobile", header: "Mobile", width: 15 }, { key: "email", header: "E-mail", width: 26, excelOnly: true },
        ],
        rows: pending.map((r, i) => {
          const pr = profileOf.get(r.id), s = sellerById.get(r.id);
          return { sl: i + 1, approvedNo: r.approvedNo, name: r.name, district: r.district, sectors: s ? sellerOffers(s) : "",
            profile: pr?.profileCompletedAt ? "Completed" : "Pending (needed first)", contact: pr?.contactName ?? "", mobile: fmtMobile(pr?.contactMobile), email: pr?.contactEmail ?? "" };
        }),
      },
      {
        name: "Preferences by Buyer", heading: "4. Preferences received by each buyer",
        columns: [
          { key: "buyerNo", header: "Buyer No.", width: 19, kind: "mono", excelOnly: true }, { key: "buyer", header: "Buyer", width: 26 },
          { key: "country", header: "Country", width: 15 }, { key: "sectors", header: "Approved Sectors", width: 32 },
          { key: "total", header: "Sellers Preferring", width: 11, kind: "number", align: "right" },
          { key: "first", header: "As First Choice", width: 10, kind: "number", align: "right" },
          { key: "sellers", header: "Sellers (Rank)", width: 40 },
        ],
        rows: byBuyer,
      },
    ],
  };
}

// The buyer directory as approved sellers see it (step 1).
async function buyerDirectoryReport(user: User): Promise<Report> {
  const [state, pool] = await Promise.all([getMatchState(), loadPool()]);
  const rows: Row[] = [];
  let sl = 0;
  for (const b of pool.buyers) for (const x of b.sectors) {
    const sellers = pool.sellers.filter((s) => s.sectors.some((y) => y.id === x.id)).length;
    rows.push({ sl: ++sl, buyerNo: b.approvedNo, buyer: b.name, country: b.country, sector: x.name, products: x.products,
      specs: x.specifications ?? "", certs: x.certifications.join(", "), quantity: x.quantity ?? "", sellers,
      prefs: pool.prefs.filter((p) => p.buyerId === b.id).length });
  }
  return {
    ...base("match-buyer-directory", user, [state.buyersVisible ? "Open to approved sellers" : "Hidden from sellers"]),
    kpis: [
      { label: "Approved buyers", value: pool.buyers.length, tone: "blue" },
      { label: "Approved sectors", value: rows.length, tone: "green" },
      { label: "Approved sellers", value: pool.sellers.length, tone: "violet" },
      { label: "Preferences so far", value: pool.prefs.length, tone: "yellow" },
    ],
    tables: [{
      name: "Buyer Directory", heading: "Approved buyers and their approved sector requirements",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" },
        { key: "buyerNo", header: "Buyer No.", width: 19, kind: "mono" }, { key: "buyer", header: "Buyer", width: 22 }, { key: "country", header: "Country", width: 13 },
        { key: "sector", header: "Sector", width: 20 }, { key: "products", header: "Products", width: 30 },
        { key: "specs", header: "Specifications", width: 28, excelOnly: true }, { key: "certs", header: "Certifications", width: 24 },
        { key: "quantity", header: "Volume", width: 16, excelOnly: true },
        { key: "sellers", header: "Approved Sellers in Sector", width: 11, kind: "number", align: "right" },
        { key: "prefs", header: "Sellers Preferring Buyer", width: 11, kind: "number", align: "right" },
      ],
      rows,
    }],
  };
}

// Mappings that look incorrect (step 5) — for reference; they never block publishing.
async function matchChecksReport(user: User): Promise<Report> {
  const [issues, state] = await Promise.all([matchChecks(), getMatchState()]);
  const sev = { high: "High", medium: "Medium", low: "Low" } as const;
  return {
    ...base("match-checks", user, [state.version ? `Working list against published version ${state.version}` : "Working list"]),
    kpis: [
      { label: "Items to review", value: issues.length, tone: "blue" },
      { label: "High", value: issues.filter((i) => i.severity === "high").length, tone: "red" },
      { label: "Medium", value: issues.filter((i) => i.severity === "medium").length, tone: "yellow" },
      { label: "Low", value: issues.filter((i) => i.severity === "low").length, tone: "slate" },
    ],
    tables: [{
      name: "Checks", heading: "Mappings to review (reference only — they do not stop publishing)",
      columns: [
        { key: "sl", header: "Sl.", width: 5, kind: "number", align: "center" }, { key: "severity", header: "Severity", width: 10 },
        { key: "kind", header: "Check", width: 26 }, { key: "buyer", header: "Buyer", width: 24 }, { key: "seller", header: "Seller", width: 24 },
        { key: "detail", header: "Detail", width: 56 },
      ],
      rows: issues.map((i, n) => ({ sl: n + 1, severity: sev[i.severity], kind: i.kind, buyer: i.buyer ?? "", seller: i.seller ?? "", detail: i.detail })),
    }],
  };
}

async function matchCoverageReport(user: User, which: "published" | "draft"): Promise<Report> {
  const c = await coverage(which);
  const num = (key: string, header: string, width = 10) => ({ key, header, width, kind: "number" as const, align: "right" as const });
  return {
    ...base("match-coverage", user, [which === "draft" ? "Working list" : c.state.version ? `Published version ${c.state.version}` : "Not published yet"]),
    kpis: [
      { label: "Pairs", value: c.pairs, tone: "blue" },
      { label: `Buyers with ${c.target}+ sellers`, value: `${c.buyersAtTarget} / ${c.buyers}`, tone: "green" },
      { label: "Sellers with a buyer", value: `${c.sellersMatched} / ${c.sellers}`, tone: "violet" },
      { label: "Seller slots still needed", value: c.sellersNeeded, tone: "red" },
    ],
    tables: [
      { name: "Buyers Below Target", heading: `1. Buyers below ${c.target} sellers`,
        columns: [{ key: "buyerNo", header: "Buyer No.", width: 19, kind: "mono", excelOnly: true }, { key: "buyer", header: "Buyer", width: 24 }, { key: "country", header: "Country", width: 14 },
          { key: "needs", header: "Approved Sectors & Products", width: 44 }, num("n", "Sellers"), num("short", "Short By")],
        rows: c.buyersBelow.map((b) => ({ buyerNo: b.approvedNo, buyer: b.name, country: b.country, needs: b.needs, n: b.n, short: b.shortfall })) },
      { name: "Sellers Without Buyer", heading: "2. Approved sellers without a buyer",
        columns: [{ key: "sellerNo", header: "Seller No.", width: 19, kind: "mono", excelOnly: true }, { key: "seller", header: "Seller", width: 24 }, { key: "district", header: "District", width: 15 },
          { key: "offers", header: "Sectors & Products", width: 44 }, { key: "pref", header: "Gave Preferences", width: 12 }],
        rows: c.sellersWithout.map((s) => ({ sellerNo: s.approvedNo, seller: s.name, district: s.district, offers: s.offers, pref: s.gavePreferences ? "Yes" : "No" })) },
      { name: "Sector Coverage", heading: "3. Sector coverage",
        columns: [{ key: "sector", header: "Sector", width: 28 }, num("buyers", "Approved Buyers"), num("needed", "Sellers Needed"), num("sellers", "Approved Sellers"), num("mapped", "Sellers Mapped"), num("unmapped", "Not Mapped"), { key: "status", header: "Position", width: 20 }],
        rows: c.sectorRows.map((r) => ({ sector: r.name, buyers: r.buyers, needed: r.needed, sellers: r.sellers, mapped: r.matchedSellers, unmapped: r.unmatchedSellers, status: r.status })) },
      { name: "Products Not Covered", heading: "4. Requested products not covered by matched sellers",
        columns: [{ key: "product", header: "Product", width: 26 }, { key: "sector", header: "Sector", width: 22 }, { key: "buyer", header: "Buyer", width: 26 }, num("available", "Approved Sellers Offering It", 14)],
        rows: c.productGaps.map((p) => ({ product: p.product, sector: p.sector, buyer: p.buyer, available: p.availableSellers })) },
      { name: "District Position", heading: "5. District position",
        columns: [{ key: "district", header: "District", width: 20 }, num("sellers", "Approved Sellers"), num("matched", "With Buyers"), num("unmatched", "Without"), num("meetings", "Meetings")],
        rows: c.districtRows.map((r) => ({ district: r.district, sellers: r.sellers, matched: r.matched, unmatched: r.unmatched, meetings: r.meetings })) },
    ],
  };
}
