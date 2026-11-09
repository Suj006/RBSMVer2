"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Save, Send, Trash2, X, History } from "lucide-react";
import type { ItemStatus } from "@/generated/prisma/enums";
import { removeItemAction, saveItemAction, submitAllAction } from "@/app/actions/buyer";
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { ITEM_EDITABLE, ITEM_META, ITEM_TO_SUBMIT } from "@/lib/status";
import { useKeepForm } from "@/lib/use-keep-form";
import { cn } from "@/lib/cn";

export type BoardItem = {
  id: string; sectorId: string; sectorName: string; status: ItemStatus; everApproved: boolean;
  products: string; specifications: string; certifications: string[]; quantity: string;
  lastComment: { text: string; by: string } | null;
};

type Draft = Omit<BoardItem, "id" | "status" | "everApproved" | "lastComment" | "sectorName"> & { id: string | null };

/** `canSubmit` is false while the application is a draft: sectors are then saved and go to FIEO with the application. */
export function RequirementBoard({ items, sectors, certifications, profileComplete, canSubmit = true, locked = false }: {
  items: BoardItem[]; sectors: { id: string; name: string }[]; certifications: string[]; profileComplete: boolean; canSubmit?: boolean; locked?: boolean;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(items.length ? null : "new");
  const [flash, setFlash] = useState<string | null>(null);
  const [submitState, submitAll, submitting] = useActionState(submitAllAction, undefined);
  const pendingDrafts = items.filter((i) => ITEM_TO_SUBMIT.includes(i.status));
  const used = new Set(items.map((i) => i.sectorId));
  const done = useCallback((msg: string) => { setEditing(null); setFlash(msg); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{canSubmit
            ? "Each sector is verified by FIEO and then approved by the Directorate, separately."
            : "Add one or more sectors. They are sent to FIEO together with your application."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSubmit && !locked && pendingDrafts.length > 0 && (
            <form action={submitAll} onSubmit={() => setFlash(null)}>
              <Button type="submit" disabled={submitting || !profileComplete} title={profileComplete ? undefined : "Complete the sourcing profile first"}>
                <Send className="size-4" /> Submit {pendingDrafts.length} pending to FIEO
              </Button>
            </form>
          )}
          <Button type="button" variant="secondary" onClick={() => { setEditing("new"); setFlash(null); }} disabled={locked || editing === "new" || used.size >= sectors.length}>
            <Plus className="size-4" /> Add sector
          </Button>
        </div>
      </div>

      {canSubmit && !profileComplete && <Alert tone="amber">Complete and save the sourcing profile above before submitting sectors. You can save sector drafts meanwhile.</Alert>}
      {flash && <Alert tone="green">{flash}</Alert>}
      {submitState?.ok && !flash && <Alert tone="green">{submitState.message}</Alert>}
      {submitState?.error && <Alert tone="red">{submitState.error}</Alert>}

      {editing === "new" && !locked && (
        <ItemEditor
          canSubmit={canSubmit}
          draft={{ id: null, sectorId: "", products: "", specifications: "", certifications: [], quantity: "" }}
          sectors={sectors.filter((s) => !used.has(s.id))}
          certifications={certifications}
          profileComplete={profileComplete}
          onCancel={items.length ? () => setEditing(null) : undefined}
          onDone={done}
        />
      )}

      {items.map((it) =>
        editing === it.id ? (
          <ItemEditor
            key={it.id}
            canSubmit={canSubmit}
            draft={it}
            status={it.status}
            sectors={sectors.filter((s) => s.id === it.sectorId || !used.has(s.id))}
            certifications={certifications}
            profileComplete={profileComplete}
            onCancel={() => setEditing(null)}
            onDone={done}
          />
        ) : (
          <ItemCard key={it.id} item={it} locked={locked} onEdit={() => { setEditing(it.id); setFlash(null); }} onRemoved={setFlash} />
        ),
      )}

      {!items.length && (editing !== "new" || locked) && (
        <Card className="p-8 text-center text-sm text-slate-500">No sectors yet — click “Add sector”.</Card>
      )}
    </div>
  );
}

function ItemCard({ item, locked, onEdit, onRemoved }: { item: BoardItem; locked: boolean; onEdit: () => void; onRemoved: (msg: string) => void }) {
  const [state, remove, removing] = useActionState(removeItemAction, undefined);
  useEffect(() => { if (state?.ok) onRemoved(state.message!); }, [state, onRemoved]);
  const meta = ITEM_META[item.status];
  const editable = !locked && ITEM_EDITABLE.includes(item.status);
  const returned = item.status === "FIEO_RETURNED" || item.status === "FIEO_REJECTED";
  return (
    <Card id={`item-${item.id}`} className={cn("scroll-mt-24 overflow-hidden", returned && "ring-2 ring-red-200")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-ink">{item.sectorName}</h3>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {item.everApproved && item.status !== "APPROVED" && (
              <Badge tone="blue"><History className="size-3" /> Modification of an approved sector</Badge>
            )}
          </div>
          {item.quantity && <div className="mt-1 text-xs text-slate-500">Volume: {item.quantity}</div>}
        </div>
        {editable && (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onEdit} className="px-3 py-1.5 text-xs">
              <Pencil className="size-3.5" /> {item.status === "APPROVED" ? "Modify" : "Edit"}
            </Button>
            <form action={remove} onSubmit={(e) => { if (!confirm(`Remove ${item.sectorName}?${item.status === "APPROVED" ? " It is currently approved." : ""}`)) e.preventDefault(); }}>
              <input type="hidden" name="itemId" value={item.id} />
              <Button type="submit" variant="ghost" disabled={removing} className="px-3 py-1.5 text-xs text-tx-red hover:text-tx-red">
                <Trash2 className="size-3.5" /> Remove
              </Button>
            </form>
          </div>
        )}
      </div>
      <div className="space-y-3 px-6 py-4 text-sm">
        {state?.error && <Alert tone="red">{state.error}</Alert>}
        {returned && item.lastComment && <Alert tone="red" title={`${item.status === "FIEO_REJECTED" ? "Rejected" : "Returned"} by ${item.lastComment.by}`}>{item.lastComment.text}{item.status === "FIEO_REJECTED" && " — you can edit this sector and submit it again."}</Alert>}
        <div><span className="font-semibold text-slate-600">Products: </span>{item.products}</div>
        {item.specifications && <div className="whitespace-pre-line"><span className="font-semibold text-slate-600">Specifications: </span>{item.specifications}</div>}
        {item.certifications.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{item.certifications.map((c) => <Badge key={c} tone="green">{c}</Badge>)}</div>
        )}
        {!editable && !locked && <p className="text-xs text-slate-500">With the reviewer — it can be changed again once a decision is made.</p>}
      </div>
    </Card>
  );
}

function ItemEditor({ draft, status, sectors, certifications, profileComplete, canSubmit, onCancel, onDone }: {
  draft: Draft; status?: ItemStatus; sectors: { id: string; name: string }[]; certifications: string[];
  profileComplete: boolean; canSubmit: boolean; onCancel?: () => void; onDone: (msg: string) => void;
}) {
  const [state, action, pending] = useActionState(saveItemAction, undefined);
  const onSubmit = useKeepForm(action);
  const [certs, setCerts] = useState<string[]>(draft.certifications);
  const [other, setOther] = useState("");
  const [otherError, setOtherError] = useState("");
  useEffect(() => { if (state?.ok) onDone(state.message!); }, [state, onDone]);
  const fe = state?.fieldErrors ?? {};
  const certError = Object.entries(fe).find(([k]) => k.startsWith("certifications"))?.[1];
  const toggle = (c: string) => setCerts((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));
  const custom = certs.filter((c) => !certifications.includes(c));
  const addOther = () => {
    const v = other.replace(/\s+/g, " ").trim();
    if (!v) return;
    if (!/^[\x20-\x7E]+$/.test(v)) { setOtherError("Use English characters only."); return; }
    if (!certs.includes(v)) setCerts((xs) => [...xs, v]);
    setOther(""); setOtherError("");
  };
  const uid = draft.id ?? "new";

  return (
    <Card className="ring-2 ring-brand-200">
      <form onSubmit={onSubmit} className="space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-ink">{draft.id ? (status === "APPROVED" ? "Modify approved sector" : "Edit sector") : "New sector requirement"}</div>
          {onCancel && <button type="button" onClick={onCancel} className="text-slate-400 hover:text-ink" aria-label="Cancel"><X className="size-5" /></button>}
        </div>
        {status === "APPROVED" && (
          <Alert tone="amber">This sector is approved. If you change it, the changes go through FIEO and Directorate approval again.</Alert>
        )}
        {state?.error && <Alert tone="red">{state.error}</Alert>}
        {draft.id && <input type="hidden" name="itemId" value={draft.id} />}
        <input type="hidden" name="certifications" value={JSON.stringify(certs)} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sector" htmlFor={`sector-${uid}`} required error={fe.sectorId}>
            <Select id={`sector-${uid}`} name="sectorId" defaultValue={draft.sectorId}>
              <option value="">Select sector…</option>
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Indicative quantity / volume" htmlFor={`qty-${uid}`} error={fe.quantity} hint="e.g. 2 containers per quarter">
            <Input id={`qty-${uid}`} name="quantity" defaultValue={draft.quantity} maxLength={200} />
          </Field>
          <Field label="Products" htmlFor={`products-${uid}`} required error={fe.products} className="sm:col-span-2" hint="Separate products with commas">
            <Textarea id={`products-${uid}`} name="products" rows={2} maxLength={1000} defaultValue={draft.products} placeholder="e.g. Black pepper, Cardamom, Turmeric powder" />
          </Field>
          <Field label="Product specifications" htmlFor={`spec-${uid}`} error={fe.specifications} className="sm:col-span-2">
            <Textarea id={`spec-${uid}`} name="specifications" rows={2} maxLength={2000} defaultValue={draft.specifications} placeholder="Grade, size, packaging, shelf life, labelling…" />
          </Field>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-700">Relevant certifications</div>
          <div className="flex flex-wrap gap-2">
            {certifications.map((c) => {
              const on = certs.includes(c);
              return (
                <button type="button" key={c} onClick={() => toggle(c)} aria-pressed={on}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition",
                    on ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50")}>
                  {c}
                </button>
              );
            })}
            {custom.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-tx-blue px-3 py-1.5 text-xs font-medium text-white">
                {c}
                <button type="button" onClick={() => toggle(c)} aria-label={`Remove ${c}`}><X className="size-3" /></button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex max-w-md gap-2">
            <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Other certification…" maxLength={120}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }} aria-label="Other certification" />
            <Button type="button" variant="secondary" onClick={addOther}>Add</Button>
          </div>
          {(otherError || certError) && <p className="mt-1 text-xs font-medium text-tx-red">{otherError || certError}</p>}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}>
            <Save className="size-4" /> {canSubmit ? "Save draft" : pending ? "Saving…" : "Save sector"}
          </Button>
          {canSubmit && (
            <Button type="submit" name="intent" value="submit" disabled={pending || !profileComplete} title={profileComplete ? undefined : "Complete the sourcing profile first"}>
              <Send className="size-4" /> {pending ? "Saving…" : "Submit to FIEO"}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
