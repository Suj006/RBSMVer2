"use client";

import { useState } from "react";
import { Eye, EyeOff, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui";
import { diffItem, type Change, type ItemSnapshot } from "@/lib/item-snapshot";
import { cn } from "@/lib/cn";

/** Small "Changed" marker used next to a field label. */
export function ChangedPill() {
  return <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">Changed</span>;
}

/** A changed text value: new value highlighted, previous value struck through underneath. */
export function TextDiff({ before, after, beforeLabel }: { before: string; after: string; beforeLabel: string }) {
  return (
    <div className="space-y-1">
      <div className="whitespace-pre-line rounded-md bg-amber-50 px-2 py-1 text-ink ring-1 ring-amber-200">{after || <span className="italic text-slate-400">(removed)</span>}</div>
      <div className="whitespace-pre-line text-xs text-slate-500">
        <span className="font-semibold">{beforeLabel}: </span>
        <span className="line-through decoration-tx-red/60">{before || "(blank)"}</span>
      </div>
    </div>
  );
}

/** Item-by-item list comparison: unchanged, added (+) and removed (−). */
function ListDiff({ kept, added, removed, chip }: { kept: string[]; added: string[]; removed: string[]; chip?: boolean }) {
  const base = chip ? "rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset" : "rounded px-1.5 py-0.5";
  return (
    <div className="flex flex-wrap gap-1.5">
      {kept.map((x) => <span key={`k-${x}`} className={cn(base, chip ? "bg-brand-50 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700")}>{x}</span>)}
      {added.map((x) => <span key={`a-${x}`} className={cn(base, "bg-green-100 font-semibold text-green-800 ring-1 ring-green-300")} title="Added">+ {x}</span>)}
      {removed.map((x) => <span key={`r-${x}`} className={cn(base, "bg-red-50 text-red-700 line-through ring-1 ring-red-200")} title="Removed">− {x}</span>)}
    </div>
  );
}

const split = (s: string) => s.split(/[,\n;]/).map((x) => x.trim()).filter(Boolean);

/**
 * Sector requirement content for reviewers. With a baseline (the approved
 * version, or the version FIEO returned) every change is highlighted.
 */
export function SectorContent({ current, baseline }: {
  current: ItemSnapshot;
  baseline?: { label: "approved version" | "version FIEO returned or rejected"; snap: ItemSnapshot } | null;
}) {
  const [showOld, setShowOld] = useState(false);
  const changes: Change[] = baseline ? diffItem(baseline.snap, current) : [];
  const ch = (f: string) => changes.find((c) => c.field === f);
  const beforeLabel = baseline?.label === "approved version" ? "Approved" : "Returned version";

  const row = (field: string, label: string, plain: React.ReactNode) => {
    const c = ch(field);
    return (
      <div className={cn(c && "-mx-2 rounded-lg border-l-4 border-amber-400 bg-amber-50/40 px-2 py-1.5")}>
        <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}{c && <ChangedPill />}</div>
        {c ? (c.kind === "text"
          ? <TextDiff before={c.before} after={c.after} beforeLabel={beforeLabel} />
          : <ListDiff kept={c.kept} added={c.added} removed={c.removed} chip={field === "certifications"} />)
          : plain}
      </div>
    );
  };

  return (
    <div className="space-y-3 text-sm">
      {baseline && (
        <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ring-1",
          changes.length ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-slate-50 text-slate-600 ring-slate-200")}>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <PencilLine className="size-4" />
            {changes.length
              ? `${changes.length} change${changes.length > 1 ? "s" : ""} since the ${baseline.label}: ${changes.map((c) => c.label.toLowerCase()).join(", ")}`
              : `No changes since the ${baseline.label}`}
          </span>
          <button type="button" onClick={() => setShowOld((v) => !v)} className="no-print inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline">
            {showOld ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {showOld ? "Hide" : "Show"} {baseline.label}
          </button>
        </div>
      )}
      {baseline && showOld && (
        <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
          <div className="font-bold uppercase tracking-wide text-slate-500">{baseline.label}</div>
          <div><span className="font-semibold">Sector: </span>{baseline.snap.sectorName}</div>
          <div><span className="font-semibold">Products: </span>{baseline.snap.products}</div>
          <div><span className="font-semibold">Specifications: </span>{baseline.snap.specifications || "—"}</div>
          <div><span className="font-semibold">Certifications: </span>{baseline.snap.certifications.join(", ") || "—"}</div>
          <div><span className="font-semibold">Indicative volume: </span>{baseline.snap.quantity || "—"}</div>
        </div>
      )}
      {ch("sector") && row("sector", "Sector", null)}
      {row("products", "Products", <ListDiff kept={split(current.products)} added={[]} removed={[]} />)}
      {(current.specifications || ch("specifications")) && row("specifications", "Specifications", <div className="whitespace-pre-line text-ink">{current.specifications}</div>)}
      {(current.certifications.length > 0 || ch("certifications")) &&
        row("certifications", "Certifications", <div className="flex flex-wrap gap-1.5">{current.certifications.map((c) => <Badge key={c} tone="green">{c}</Badge>)}</div>)}
      {(current.quantity || ch("quantity")) && row("quantity", "Indicative volume", <div className="text-ink">{current.quantity}</div>)}
    </div>
  );
}
