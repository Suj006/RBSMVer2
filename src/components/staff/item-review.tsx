"use client";

import { useActionState, useState } from "react";
import { CheckCheck, History, Save } from "lucide-react";
import type { ItemStatus, ReviewAction, Role } from "@/generated/prisma/enums";
import { itemReviewAction } from "@/app/actions/review";
import { Alert, Badge, Button, Card, Textarea } from "@/components/ui";
import { ACTION_LABEL, DIC_ITEM_QUEUE, FIEO_ITEM_QUEUE, ITEM_META, ROLE_LABEL } from "@/lib/status";
import { useKeepForm } from "@/lib/use-keep-form";
import { cn } from "@/lib/cn";
import { SectorContent } from "@/components/changes";
import type { ItemSnapshot } from "@/lib/item-snapshot";
import { NextUp, type NextUpLinks } from "@/components/nav/next-up";

export type ReviewItem = {
  id: string; sectorId: string; sectorName: string; status: ItemStatus; everApproved: boolean;
  /** What to compare against: the approved version, or the version FIEO returned. */
  baseline: { label: "approved version" | "version FIEO returned or rejected"; snap: ItemSnapshot } | null;
  products: string; specifications: string | null; certifications: string[]; quantity: string | null;
  history: { id: string; action: ReviewAction; actorRole: Role; comment: string | null; at: string }[];
};

type Option = { value: string; label: string; tone: "green" | "violet" | "red" };

const OPTIONS: Record<"FIEO" | "DIC", Option[]> = {
  FIEO: [
    { value: "recommend", label: "Approve (send to Directorate)", tone: "green" },
    { value: "return", label: "Return for correction", tone: "violet" },
    { value: "reject", label: "Reject", tone: "red" },
  ],
  DIC: [
    { value: "approve", label: "Approve", tone: "green" },
    { value: "return", label: "Return to FIEO", tone: "red" },
  ],
};

const ON: Record<Option["tone"], string> = {
  green: "bg-brand-600 text-white ring-brand-600",
  violet: "bg-violet-600 text-white ring-violet-600",
  red: "bg-tx-red text-white ring-tx-red",
};

/**
 * Sector-by-sector review. FIEO / DIC pick a decision for each pending sector
 * independently (or leave it for later) and save them together.
 */
export function ItemReview({ buyerId, role, items, nav, basicPending = false }: { buyerId: string; role: Role; items: ReviewItem[]; nav?: NextUpLinks; basicPending?: boolean }) {
  const reviewer = role === "FIEO" || role === "DIC" ? role : null;
  const queue = reviewer === "FIEO" ? FIEO_ITEM_QUEUE : reviewer === "DIC" ? DIC_ITEM_QUEUE : [];
  const pending = items.filter((i) => queue.includes(i.status));
  const [state, action, saving] = useActionState(itemReviewAction, undefined);
  const onSubmit = useKeepForm(action);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const fe = state?.fieldErrors ?? {};
  const positive = reviewer === "DIC" ? "approve" : "recommend";
  // Only sectors still pending count (decisions on sectors just saved drop out).
  const chosen = pending.filter((p) => decisions[p.id]).length;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="buyerId" value={buyerId} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{basicPending ? "Review the application" : `Sector requirements (${items.length})`}</h2>
          <p className="text-sm text-slate-500">
            {reviewer && pending.length
              ? `${pending.length} sector${pending.length > 1 ? "s" : ""} waiting for your decision — decide each one separately.`
              : "Each sector is approved separately."}
          </p>
        </div>
        {reviewer && pending.length > 1 && (
          <Button type="button" variant="secondary" className="no-print"
            onClick={() => setDecisions(Object.fromEntries(pending.map((p) => [p.id, positive])))}>
            <CheckCheck className="size-4" /> Approve all
          </Button>
        )}
      </div>

      {state?.ok && <Alert tone="green" title="Saved">{state.message}{nav && !pending.length && <NextUp {...nav} />}</Alert>}
      {basicPending && !state?.ok && (
        <Card className="no-print p-5 ring-2 ring-brand-100">
          <div className="font-bold text-ink">Basic details and documents</div>
          <p className="mt-1 text-sm text-slate-500">Check the buyer&apos;s identity, contact, documents and sourcing profile above. They are marked verified when you save your decisions below. Add a comment for the buyer if anything needs attention — it does not hold up the sectors.</p>
          <Textarea name="basicComment" rows={2} maxLength={2000} className="mt-3" aria-label="Comment on the basic details" placeholder="Comment on the basic details for the buyer (optional)" />
          {fe.basicComment && <p className="mt-1 text-xs font-medium text-tx-red">{fe.basicComment}</p>}
        </Card>
      )}
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {!items.length && <Card className="p-6 text-sm text-slate-500">No sector requirements yet.</Card>}

      {items.map((it) => {
        const meta = ITEM_META[it.status];
        const actionable = pending.some((p) => p.id === it.id);
        const decision = decisions[it.id] ?? "";
        // Comments reviewers need most: the latest return and recommendation notes.
        const notes = it.history.filter((h) => h.comment && h.action !== "REQ_SUBMITTED");
        return (
          <Card key={it.id} id={`item-${it.id}`} className={cn("scroll-mt-24 overflow-hidden", actionable && "ring-2 ring-brand-100")}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-ink">{it.sectorName}</h3>
                <Badge tone={meta.tone}>{meta.label}</Badge>
                {it.everApproved && it.status !== "APPROVED" && <Badge tone="blue"><History className="size-3" /> Modification of an approved sector</Badge>}
              </div>
            </div>
            <div className="grid gap-6 px-6 py-4 lg:grid-cols-[1fr_300px]">
              <SectorContent
                baseline={it.baseline}
                current={{ sectorId: it.sectorId, sectorName: it.sectorName, products: it.products, specifications: it.specifications ?? "",
                  certifications: it.certifications, quantity: it.quantity ?? "" }}
              />
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">History</div>
                <ul className="space-y-2 text-xs">
                  {it.history.slice(0, 4).map((h) => (
                    <li key={h.id}>
                      <span className="font-semibold text-ink">{ACTION_LABEL[h.action]}</span>
                      <span className="text-slate-500"> · {ROLE_LABEL[h.actorRole]} · {h.at}</span>
                      {h.comment && notes.includes(h) && <div className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-slate-700 ring-1 ring-slate-200">{h.comment}</div>}
                    </li>
                  ))}
                  {!it.history.length && <li className="text-slate-400">—</li>}
                </ul>
              </div>
            </div>
            {actionable && reviewer && (
              <div className="no-print space-y-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                <input type="hidden" name="itemIds" value={it.id} />
                <input type="hidden" name={`decision_${it.id}`} value={decision} />
                <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={`Decision for ${it.sectorName}`}>
                  <span className="mr-1 text-sm font-semibold text-slate-700">Decision:</span>
                  {OPTIONS[reviewer].map((o) => (
                    <button type="button" key={o.value} role="radio" aria-checked={decision === o.value}
                      onClick={() => setDecisions((d) => ({ ...d, [it.id]: d[it.id] === o.value ? "" : o.value }))}
                      className={cn("rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
                        decision === o.value ? ON[o.tone] : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-100")}>
                      {o.label}
                    </button>
                  ))}
                  {!decision && <span className="text-xs text-slate-400">No decision yet — it stays pending</span>}
                </div>
                <div>
                  <Textarea name={`comment_${it.id}`} rows={2} maxLength={2000} aria-label={`Comment for ${it.sectorName}`}
                    placeholder={decision === "return" ? "Required: what needs to be corrected?" : decision === "reject" ? "Required: reason for rejection" : "Comment (optional)"} />
                  {fe[`comment_${it.id}`] && <p className="mt-1 text-xs font-medium text-tx-red">{fe[`comment_${it.id}`]}</p>}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {reviewer && (pending.length > 0 || (basicPending && !state?.ok)) && (
        <div className="no-print sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-3 text-white shadow-lg">
          <span className="text-sm">{chosen ? `${chosen} decision${chosen > 1 ? "s" : ""} selected` : basicPending ? "Select a decision for each sector (or verify the basic details only)" : "Select a decision for one or more sectors"}</span>
          <Button type="submit" disabled={saving || (!chosen && !basicPending)} className="bg-white !text-ink hover:bg-brand-50">
            <Save className="size-4" /> {saving ? "Saving…" : chosen ? "Save decisions" : "Verify basic details"}
          </Button>
        </div>
      )}
    </form>
  );
}
