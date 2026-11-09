import { Plus, Search, Upload } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import type { SellerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { sellerWhere, type SellerFilters } from "@/lib/seller-query";
import { ALL_SELLER_STATUSES, SELLER_META, SELLER_TALUK_EDITABLE, SELLER_VISIBLE } from "@/lib/status";
import { TALUKS } from "@/lib/kerala";
import { DISTRICT_NAMES } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { fmtMobile } from "@/lib/text";
import { Button, ButtonLink, Card, Input, PageHeader, Select } from "@/components/ui";
import { Pagination } from "@/components/staff/pagination";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { SellerTable, type BulkAction } from "./seller-table";
import { ProfileFilters } from "./profile-filters";

const PAGE_SIZE = 25;

export async function SellerListPage({ user, base, filters, title, subtitle }: {
  user: User; base: string; filters: SellerFilters; title: string; subtitle: string;
}) {
  const where = sellerWhere(user, filters);
  const page = Math.max(1, Number(filters.page) || 1);
  const [rows, total, sectors] = await Promise.all([
    prisma.seller.findMany({
      where, orderBy: [{ updatedAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { products: { orderBy: { sortOrder: "asc" }, include: { sector: { select: { name: true } } } } },
    }),
    prisma.seller.count({ where }),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const statuses: SellerStatus[] = ["DISTRICT", "TALUK", "ADMIN", "DIC", "TRAINING"].includes(user.role) ? ALL_SELLER_STATUSES : SELLER_VISIBLE[user.role] ?? [];
  const { page: _p, ...rest } = filters;
  void _p;
  const qs = new URLSearchParams(Object.entries(rest).filter(([, v]) => v) as [string, string][]).toString();
  const bulk: BulkAction[] | undefined =
    user.role === "TALUK" ? [
      { decision: "recommend", label: "Recommend to Directorate", eligible: SELLER_TALUK_EDITABLE, variant: "primary" },
      { decision: "not_recommend", label: "Not recommended", eligible: SELLER_TALUK_EDITABLE, variant: "danger", needsComment: true, confirm: "Mark {n} seller(s) as not recommended?" },
    ]
    : user.role === "DIC" ? [
      { decision: "approve_initial", label: "Initial approval", eligible: ["RECOMMENDED"], variant: "success", confirm: "Give initial approval to {n} seller(s)? They are then placed in awareness sessions." },
      { decision: "approve", label: "Final approval", eligible: ["TRAINED"], variant: "primary", confirm: "Give final approval to {n} seller(s) and e-mail their seller numbers and permanent logins?" },
      { decision: "reject", label: "Reject", eligible: ["RECOMMENDED", "INITIAL_APPROVED", "TRAINED"], variant: "danger", needsComment: true, confirm: "Reject {n} seller(s)? This cannot be undone." },
    ]
    : undefined;
  const local = user.role === "DISTRICT" || user.role === "TALUK";
  const talukList = user.role === "DISTRICT" ? TALUKS[user.district ?? ""] ?? [] : filters.district ? TALUKS[filters.district] ?? [] : [];

  return (
    <>
      <PageHeader title={title} subtitle={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {user.role === "DISTRICT" && (
              <>
                <ButtonLink href="/district/sellers/new"><Plus className="size-4" /> Add seller</ButtonLink>
                <ButtonLink href="/district/upload" variant="secondary"><Upload className="size-4" /> Bulk upload</ButtonLink>
              </>
            )}
            <DownloadButtons href={`/api/reports/seller-register${qs ? `?${qs}` : ""}`} label="Seller register" compact />
          </div>
        } />
      <Card className="overflow-hidden">
        <form action={base} className="space-y-3 border-b border-slate-100 p-4">
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.3fr_1.4fr_1fr_1fr_1.1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={filters.q} placeholder="Search name, Udyam, reg. no., mobile…" className="pl-9" aria-label="Search" />
          </div>
          <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status">
            <option value="">All statuses</option>
            {(user.role === "DISTRICT" || user.role === "TALUK" || user.role === "DIC") && <option value="action">{user.role === "DISTRICT" ? "⚑ To place in an awareness session" : "⚑ Needs my action"}</option>}
            {user.role !== "FIEO" && <option value="pending">All pending (in verification)</option>}
            {statuses.map((s) => <option key={s} value={s}>{SELLER_META[s].label}</option>)}
          </Select>
          <Select name="sector" defaultValue={filters.sector ?? ""} aria-label="Sector">
            <option value="">All sectors</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          {!local ? (
            <Select name="district" defaultValue={filters.district ?? ""} aria-label="District">
              <option value="">All districts</option>
              {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
            </Select>
          ) : (
            <Select name="source" defaultValue={filters.source ?? ""} aria-label="Source">
              <option value="">All sources</option>
              <option value="DISTRICT">Entered by district office</option>
              <option value="BULK">Bulk upload</option>
              <option value="SELF">Self-registered</option>
            </Select>
          )}
          <Select name="exp" defaultValue={filters.exp ?? ""} aria-label="Export experience">
            <option value="">Any export experience</option>
            <option value="yes">Export experience: Yes</option>
            <option value="no">Export experience: No</option>
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
         </div>
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {user.role !== "TALUK" && talukList.length > 0 && (
            <Select name="taluk" defaultValue={filters.taluk ?? ""} aria-label="Taluk">
              <option value="">All taluks</option>
              {talukList.map((t) => <option key={t}>{t}</option>)}
            </Select>
          )}
          {user.role !== "FIEO" && (
            <Select name="training" defaultValue={filters.training ?? ""} aria-label="Awareness session">
              <option value="">Any awareness-session stage</option>
              <option value="unassigned">Awaiting a session (not yet placed)</option>
              <option value="scheduled">Placed in a session</option>
              <option value="absent">Absent — to re-schedule</option>
              <option value="bypassed">Approved without session</option>
            </Select>
          )}
          <ProfileFilters f={filters} personal={user.role !== "FIEO"} />
         </div>
        </form>
        <SellerTable
          base={base}
          bulk={bulk}
          rows={rows.map((s) => ({
            id: s.id, regNo: s.regNo, approvedNo: s.approvedNo, name: s.name, district: s.district, taluk: s.taluk,
            udyamNo: s.udyamNo, exportExperience: s.exportExperience, contactName: s.contactName, mobile: fmtMobile(s.contactMobile),
            status: s.status, source: s.source, sectors: s.products.map((p) => p.sector.name), updated: fmtDate(s.updatedAt),
            profilePending: s.status === "APPROVED" && !s.profileCompletedAt,
          }))}
        />
        <Pagination base={base} params={rest} page={page} total={total} pageSize={PAGE_SIZE} />
      </Card>
    </>
  );
}
