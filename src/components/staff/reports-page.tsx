import { ShieldAlert, BarChart3, BadgeCheck, Boxes, ChartPie, ClipboardList, Handshake, Lightbulb, MapPinned, PackageSearch, Star, Store, Users, UsersRound, MessagesSquare, CalendarClock, ClipboardCheck, FileSignature, GraduationCap, Map } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import type { SellerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { scopeFor, type BuyerFilters as F } from "@/lib/buyer-query";
import { REPORTS, reportsFor, type ReportId } from "@/lib/reports/data";
import { ALL_ITEM_STATUSES, ALL_SELLER_STATUSES, ALL_STATUSES, SELLER_META, SELLER_VISIBLE } from "@/lib/status";
import { DISTRICT_NAMES } from "@/lib/config";
import { Button, Card, PageHeader, Select } from "@/components/ui";
import { BuyerFilters } from "./buyer-filters";
import { DownloadButtons } from "./download-buttons";
import { ProfileFilters } from "@/components/seller/profile-filters";

const ICON: Record<ReportId, typeof Users> = {
  "buyer-register": Users, "sector-requirements": ClipboardList, "approved-buyers": BadgeCheck, "approved-sellers": BadgeCheck,
  "seller-register": Store, "seller-district-summary": MapPinned, "seller-taluk-summary": Map, "awareness-attendance": GraduationCap, "seller-profile-analysis": UsersRound, "mis-summary": BarChart3, "sector-demand": Boxes,
  "product-demand": PackageSearch, "insights": Lightbulb, "match-list": Handshake, "seller-preferences": Star, "match-coverage": ChartPie, "match-buyer-directory": Users, "match-checks": ShieldAlert, "communications": MessagesSquare, "event-schedule": CalendarClock, "event-attendance": ClipboardCheck, "mou-register": FileSignature,
};
const ACCENT: Record<ReportId, string> = {
  "buyer-register": "bg-tx-blue", "sector-requirements": "bg-tx-yellow", "approved-buyers": "bg-tx-green", "approved-sellers": "bg-tx-green",
  "seller-register": "bg-tx-green", "seller-district-summary": "bg-tx-blue", "seller-taluk-summary": "bg-tx-blue", "awareness-attendance": "bg-sky-500", "seller-profile-analysis": "bg-violet-500", "mis-summary": "bg-tx-red", "sector-demand": "bg-violet-500",
  "product-demand": "bg-violet-500", "insights": "bg-ink", "match-list": "bg-tx-green", "seller-preferences": "bg-violet-500", "match-coverage": "bg-tx-red", "match-buyer-directory": "bg-tx-blue", "match-checks": "bg-tx-yellow", "communications": "bg-ink", "event-schedule": "bg-tx-blue", "event-attendance": "bg-tx-green", "mou-register": "bg-tx-green",
};
const SELLER_REPORTS: ReportId[] = ["approved-sellers", "seller-register", "seller-district-summary", "seller-taluk-summary", "awareness-attendance", "seller-profile-analysis"];
const WHOLE: ReportId[] = ["seller-district-summary", "seller-profile-analysis", "awareness-attendance"];
// In the order of the matchmaking steps.
const MATCH_REPORTS: ReportId[] = ["match-buyer-directory", "seller-preferences", "match-list", "match-checks", "match-coverage", "event-schedule", "event-attendance", "mou-register", "communications"];

type Params = F & { s_status?: string; s_district?: string; s_sector?: string; s_exp?: string;
  s_profile?: string; s_cat?: string; s_utype?: string; s_promoter?: string; s_iec?: string; s_cert?: string };

function ReportCard({ id, href, note }: { id: ReportId; href: string; note?: string }) {
  const Icon = ICON[id];
  return (
    <Card className="relative flex flex-col overflow-hidden p-6">
      <span className={`absolute inset-x-0 top-0 h-1 ${ACCENT[id]}`} />
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-white"><Icon className="size-5" /></div>
        <div>
          <h3 className="text-base font-bold text-ink">{REPORTS[id].title}</h3>
          <p className="mt-1 text-sm text-slate-500">{REPORTS[id].description}</p>
          {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
        </div>
      </div>
      <div className="mt-5 flex flex-1 items-end justify-end"><DownloadButtons href={href} /></div>
    </Card>
  );
}

export async function ReportsPage({ user, base, filters }: { user: User; base: string; filters: Params }) {
  const role = user.role;
  const allowed = reportsFor(role);
  const buyerIds = allowed.filter((id) => !SELLER_REPORTS.includes(id) && !MATCH_REPORTS.includes(id));
  const matchIds = MATCH_REPORTS.filter((id) => allowed.includes(id));
  const sellerIds = allowed.filter((id) => SELLER_REPORTS.includes(id));
  const [countries, sectors] = await Promise.all([
    buyerIds.length ? prisma.buyer.findMany({ where: scopeFor(role), distinct: ["country"], select: { country: true }, orderBy: { country: "asc" } }) : [],
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const pick = (o: Record<string, string | undefined>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
  const bqs = pick({ q: filters.q, status: filters.status, item: filters.item, country: filters.country, sector: filters.sector });
  const sqs = pick({ status: filters.s_status, district: filters.s_district, sector: filters.s_sector, exp: filters.s_exp,
    profile: filters.s_profile, cat: filters.s_cat, utype: filters.s_utype, promoter: filters.s_promoter, iec: filters.s_iec, cert: filters.s_cert });
  const sellerStatuses: SellerStatus[] = ["DISTRICT", "TALUK", "ADMIN", "DIC", "TRAINING"].includes(role) ? ALL_SELLER_STATUSES : SELLER_VISIBLE[role] ?? [];
  const keep = (prefix: "s_" | "b") => Object.entries(filters).filter(([k, v]) => v && (prefix === "s_" ? !k.startsWith("s_") : k.startsWith("s_")));

  return (
    <>
      <PageHeader eyebrow="Reports" title="Reports & downloads"
        subtitle="Formatted Excel workbooks and PDF reports with the TRADEX letterhead. Choose filters, then download." />

      {/* The two lists the central team needs most, one click away. */}
      {(allowed.includes("approved-buyers") || allowed.includes("approved-sellers")) && (
        <Card className="mb-10 overflow-hidden">
          <div className="tx-ribbon h-1" />
          <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
            {(["approved-buyers", "approved-sellers"] as const).filter((id) => allowed.includes(id)).map((id) => (
              <div key={id} className="flex flex-col gap-3 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-brand-700">Complete details</div>
                  <div className="mt-0.5 text-lg font-bold text-ink">{id === "approved-buyers" ? "All approved buyers" : "All approved sellers"}</div>
                  <div className="text-sm text-slate-500">{id === "approved-buyers" ? "Contacts, sourcing profile, every approved sector" : "Udyam, location, promoter contact, sectors & products"}</div>
                </div>
                <DownloadButtons href={`/api/reports/${id}`} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {buyerIds.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold text-ink">Buyer reports</h2>
          <Card className="mb-5 overflow-hidden">
            <BuyerFilters
              action={base}
              filters={filters}
              statuses={ALL_STATUSES}
              itemStatuses={ALL_ITEM_STATUSES}
              countries={countries.map((c) => c.country)}
              sectors={sectors}
              actionLabel={role === "DIC" ? "Awaiting my approval" : "Needs FIEO action"}
              hidden={keep("b")}
            />
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            {buyerIds.map((id) => (
              <ReportCard key={id} id={id}
                href={`/api/reports/${id}${id === "mis-summary" || id === "insights" ? "" : id === "sector-demand" || id === "product-demand" ? (filters.sector ? `?sector=${filters.sector}` : "") : bqs ? `?${bqs}` : ""}`}
                note={id === "mis-summary" || id === "insights" ? "Always covers the whole programme (filters not applied)." : id === "sector-demand" || id === "product-demand" ? "Uses the Sector filter only." : undefined} />
            ))}
          </div>
        </section>
      )}

      {sellerIds.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">Seller reports</h2>
          <Card className="mb-5 overflow-hidden">
            <form action={base} className="space-y-3 p-4">
             <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              {keep("s_").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <Select name="s_status" defaultValue={filters.s_status ?? ""} aria-label="Seller status">
                <option value="">All seller statuses</option>
                {sellerStatuses.map((s) => <option key={s} value={s}>{SELLER_META[s].label}</option>)}
              </Select>
              {role !== "DISTRICT" && role !== "TALUK" ? (
                <Select name="s_district" defaultValue={filters.s_district ?? ""} aria-label="District">
                  <option value="">All districts</option>
                  {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
                </Select>
              ) : <div className="hidden lg:block" />}
              <Select name="s_sector" defaultValue={filters.s_sector ?? ""} aria-label="Sector">
                <option value="">All sectors</option>
                {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select name="s_exp" defaultValue={filters.s_exp ?? ""} aria-label="Export experience">
                <option value="">Any export experience</option>
                <option value="yes">Export experience: Yes</option>
                <option value="no">Export experience: No</option>
              </Select>
              <Button type="submit" variant="secondary">Apply</Button>
             </div>
             <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <ProfileFilters prefix="s_" personal={role !== "FIEO"} f={{ profile: filters.s_profile, cat: filters.s_cat, utype: filters.s_utype, promoter: filters.s_promoter, iec: filters.s_iec, cert: filters.s_cert }} />
             </div>
            </form>
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            {sellerIds.map((id) => (
              <ReportCard key={id} id={id}
                href={`/api/reports/${id}${WHOLE.includes(id) || !sqs ? "" : id === "seller-taluk-summary" ? (filters.s_district ? `?district=${encodeURIComponent(filters.s_district)}` : "") : `?${sqs}`}`}
                note={WHOLE.includes(id) ? "Covers all sellers you can see (filters not applied)."
                  : id === "seller-taluk-summary" ? "Uses the District filter only."
                  : id === "approved-sellers" ? "Approved sellers only — the status filter is not applied." : undefined} />
            ))}
          </div>
        </section>
      )}
      {matchIds.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-ink">Matchmaking, event days &amp; communications reports</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {matchIds.map((id) => (
              <ReportCard key={id} id={id} href={`/api/reports/${id}`}
                note={id === "match-list" ? (role === "DIC" || role === "ADMIN" ? "Published mapping (final once locked). The working list is below and on the Matchmaking pages." : role === "DISTRICT" ? "Published mapping — sellers of your district." : "Published mapping only.")
                  : id === "match-coverage" ? "Published mapping; the working list version is on Matchmaking → Results & gaps."
                  : id === "match-checks" ? "Checks the current working list." : undefined} />
            ))}
            {(role === "DIC" || role === "ADMIN") && (
              <Card className="relative flex flex-col overflow-hidden p-6">
                <span className="absolute inset-x-0 top-0 h-1 bg-tx-yellow" />
                <h3 className="text-base font-bold text-ink">Buyer–Seller Mapping — Working List</h3>
                <p className="mt-1 text-sm text-slate-500">Step 4 — the mapping being prepared (not yet seen by participants), with the same detail as the published mapping, changes against the published version and pairs removed by the Directorate.</p>
                <div className="mt-5 flex flex-1 items-end justify-end"><DownloadButtons href="/api/reports/match-list?v=draft" /></div>
              </Card>
            )}
          </div>
        </section>
      )}
    </>
  );
}
