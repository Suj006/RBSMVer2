import { Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { ITEM_META, STATUS_META } from "@/lib/status";
import type { BuyerStatus, ItemStatus } from "@/generated/prisma/enums";
import type { BuyerFilters as F } from "@/lib/buyer-query";

export function BuyerFilters({ action, filters, statuses, itemStatuses, countries, sectors, actionLabel, hidden = [] }: {
  action: string; filters: F; statuses: BuyerStatus[]; itemStatuses: ItemStatus[]; countries: string[];
  sectors: { id: string; name: string }[]; actionLabel: string; hidden?: [string, string | undefined][];
}) {
  return (
    <form action={action} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.3fr_1fr_1.2fr_1fr_1fr_1fr_auto]">
      {hidden.map(([k, v]) => <input key={k} type="hidden" name={k} value={v ?? ""} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input name="q" defaultValue={filters.q} placeholder="Search name, reg. no., e-mail…" className="pl-9" aria-label="Search" />
      </div>
      <Select name="status" defaultValue={filters.status ?? ""} aria-label="Buyer status">
        <option value="">All buyers</option>
        <option value="action">⚑ {actionLabel}</option>
        <option value="basic_pending">Application not yet submitted</option>
        <option value="basic_approved">Verified by FIEO (all)</option>
        {statuses.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
      </Select>
      <Select name="item" defaultValue={filters.item ?? ""} aria-label="Sector status">
        <option value="">All sector statuses</option>
        {itemStatuses.map((s) => <option key={s} value={s}>Sector: {ITEM_META[s].label}</option>)}
      </Select>
      <Select name="sector" defaultValue={filters.sector ?? ""} aria-label="Sector">
        <option value="">All sectors</option>
        {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
      <Select name="country" defaultValue={filters.country ?? ""} aria-label="Country">
        <option value="">All countries</option>
        {countries.map((c) => <option key={c}>{c}</option>)}
      </Select>
      <Select name="source" defaultValue={filters.source ?? ""} aria-label="How registered">
        <option value="">Any registration</option>
        <option value="SELF">Signed up themselves</option>
        <option value="STAFF">Added by FIEO (all)</option>
        <option value="FIEO">Added by FIEO — one by one</option>
        <option value="BULK">Added by FIEO — bulk upload</option>
      </Select>
      <Button type="submit" variant="secondary">Apply</Button>
    </form>
  );
}
