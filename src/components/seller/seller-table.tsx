"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { BadgeCheck, Ban, CheckCircle2, ChevronRight, Send, Store, Undo2, UserRoundPen, XCircle } from "lucide-react";
import type { SellerStatus } from "@/generated/prisma/enums";
import { sellerDecisionAction } from "@/app/actions/seller";
import { Alert, Badge, Button, EmptyState, Textarea } from "@/components/ui";
import type { Decision } from "./seller-decision";

const ICON = { recommend: Send, not_recommend: Ban, approve_initial: CheckCircle2, approve: BadgeCheck, bypass: BadgeCheck, return: Undo2, reject: XCircle, to_seller: UserRoundPen };
import { SELLER_META } from "@/lib/status";
import { useKeepForm } from "@/lib/use-keep-form";
import { cn } from "@/lib/cn";

export type SellerRow = {
  id: string; regNo: string; approvedNo: string | null; name: string; district: string; taluk: string;
  udyamNo: string; exportExperience: boolean; contactName: string; mobile: string; status: SellerStatus;
  source: string; sectors: string[]; updated: string;
  /** Approved seller who has not completed the profile yet. */
  profilePending?: boolean;
};

export type BulkAction = {
  decision: Decision; label: string; eligible: SellerStatus[];
  variant: "primary" | "success" | "danger" | "secondary"; needsComment?: boolean; confirm?: string;
};

/**
 * Seller list with tick-boxes for bulk action: the taluk office recommends many sellers at once; the
 * Directorate gives initial or final approval (or rejects) many at once. Each action applies only to the
 * ticked sellers at the stage it is for.
 */
export function SellerTable({ rows, base, bulk }: { rows: SellerRow[]; base: string; bulk?: BulkAction[] }) {
  const [state, action, pending] = useActionState(sellerDecisionAction, undefined);
  const onSubmit = useKeepForm(action);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState("");
  const canAny = (st: SellerStatus) => !!bulk?.some((b) => b.eligible.includes(st));
  const eligible = bulk?.length ? rows.filter((r) => canAny(r.status)) : [];
  const chosen = eligible.filter((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = eligible.length > 0 && chosen.length === eligible.length;
  const withComment = bulk?.some((b) => b.needsComment);

  const notice = (state?.ok || state?.error) && (
    <div className="border-b border-slate-100 p-4">
      {state.ok ? <Alert tone="green">{state.message}</Alert> : <Alert tone="red">{state.fieldErrors?.comment ?? state.error}</Alert>}
    </div>
  );
  if (!rows.length) return <>{notice}<EmptyState icon={<Store className="size-5" />} title="No sellers found">Try changing the filters.</EmptyState></>;
  return (
    <form onSubmit={onSubmit}>
      {chosen.map((r) => <input key={r.id} type="hidden" name="sellerIds" value={r.id} />)}
      {notice}
      {bulk && eligible.length > 0 && (
        <div className="space-y-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-600">
              {chosen.length ? <><span className="font-semibold text-ink">{chosen.length}</span> selected</> : "Tick sellers (or tick the header box to select all on this page) to act on them together."}
            </span>
            <div className="flex flex-wrap gap-2">
              {bulk.map((b) => {
                const n = chosen.filter((r) => b.eligible.includes(r.status)).length;
                const Icon = ICON[b.decision];
                return (
                  <Button key={b.decision} type="submit" name="decision" value={b.decision} variant={b.variant} disabled={pending || !n} className="px-3 py-2"
                    onClick={(e) => {
                      if (b.needsComment && comment.trim().length < 5) { e.preventDefault(); alert("Please enter a comment (at least 5 characters)."); return; }
                      if (b.confirm && !confirm(b.confirm.replace("{n}", String(n)))) e.preventDefault();
                    }}>
                    <Icon className="size-4" /> {b.label} ({n})
                  </Button>
                );
              })}
            </div>
          </div>
          {withComment && chosen.length > 0 && (
            <Textarea name="comment" rows={2} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Comment"
              placeholder={`Comment (required for ${bulk.filter((b) => b.needsComment).map((b) => b.label.toLowerCase()).join(" / ")}; e-mailed to the sellers)`} />
          )}
        </div>
      )}
      <div className="table-scroll relative overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {bulk?.length ? (
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" aria-label="Select all" checked={all} disabled={!eligible.length} className="accent-brand-700"
                    onChange={() => setPicked(all ? new Set() : new Set(eligible.map((r) => r.id)))} />
                </th>
              ) : null}
              <th className="px-4 py-3">Reg. no.</th>
              <th className="px-4 py-3">Seller</th>
              <th className="px-4 py-3">District / Taluk</th>
              <th className="px-4 py-3">Sectors</th>
              <th className="px-4 py-3">Export exp.</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const can = canAny(r.status);
              const m = SELLER_META[r.status];
              return (
                <tr key={r.id} className={cn("group hover:bg-brand-50/40", picked.has(r.id) && can && "bg-brand-50/60")}>
                  {bulk?.length ? (
                    <td className="px-4 py-3 align-top">
                      {can && <input type="checkbox" aria-label={`Select ${r.name}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="accent-brand-700" />}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 align-top">
                    <div className="whitespace-nowrap font-mono text-xs font-semibold text-ink">{r.regNo}</div>
                    {r.approvedNo && <div className="mt-0.5 whitespace-nowrap font-mono text-[11px] font-semibold text-brand-700">{r.approvedNo}</div>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link href={`${base}/${r.id}`} className="font-semibold text-ink hover:text-brand-700">{r.name}</Link>
                    <div className="text-xs text-slate-500">{r.contactName} · <span className="whitespace-nowrap">{r.mobile}</span></div>
                    <div className="font-mono text-[11px] text-slate-400">{r.udyamNo}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700">{r.district}<div className="text-xs text-slate-500">{r.taluk}</div></td>
                  <td className="max-w-60 px-4 py-3 align-top text-xs text-slate-600">
                    {r.sectors.slice(0, 2).join(", ")}{r.sectors.length > 2 && ` +${r.sectors.length - 2}`}
                  </td>
                  <td className="px-4 py-3 align-top">{r.exportExperience ? <Badge tone="green">Yes</Badge> : <Badge tone="slate">No</Badge>}</td>
                  <td className="px-4 py-3 align-top">
                    <Badge tone={m.tone}>{m.short}</Badge>
                    {r.profilePending && <div className="mt-1"><Badge tone="amber">Profile pending</Badge></div>}
                    <div className="mt-1 text-[11px] text-slate-400">{r.source === "SELF" ? "Self-registered" : r.source === "BULK" ? "Bulk upload" : "Entered by district office"} · {r.updated}</div>
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <Link href={`${base}/${r.id}`} aria-label={`Open ${r.name}`} className="inline-grid size-8 place-items-center rounded-lg text-slate-400 group-hover:bg-white group-hover:text-brand-700">
                      <ChevronRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
