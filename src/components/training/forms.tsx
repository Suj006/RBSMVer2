"use client";

import { useActionState, useState } from "react";
import { ArrowRightLeft, Save, Trash2, UserPlus } from "lucide-react";
import { assignBatchAction, deleteBatchAction, markAttendanceAction, saveBatchAction } from "@/app/actions/training";
import { Alert, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { RowSearch } from "@/components/row-search";
import { useKeepForm } from "@/lib/use-keep-form";
import { cn } from "@/lib/cn";

type Batch = { id?: string; date: string; startTime: string; endTime: string; venue: string; district: string | null };

/** Admin: create or edit an awareness session. The batch name is generated. */
export function BatchForm({ batch, districts }: { batch?: Batch; districts: readonly string[] }) {
  const [state, action, pending] = useActionState(saveBatchAction, undefined);
  const onSubmit = useKeepForm(action);
  const fe = state?.fieldErrors ?? {};
  const v = (k: keyof Batch) => (state?.data?.[k] as string | undefined) ?? (batch?.[k] as string | null | undefined) ?? "";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {batch?.id && <input type="hidden" name="id" value={batch.id} />}
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && <Alert tone="green">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date" htmlFor="date" required error={fe.date}><Input id="date" name="date" type="date" defaultValue={v("date")} required /></Field>
        <Field label="Start time" htmlFor="startTime" required error={fe.startTime}><Input id="startTime" name="startTime" type="time" defaultValue={v("startTime") || "10:00"} required /></Field>
        <Field label="End time" htmlFor="endTime" required error={fe.endTime}><Input id="endTime" name="endTime" type="time" defaultValue={v("endTime") || "13:00"} required /></Field>
        <Field label="District" htmlFor="district" error={fe.district} hint="Leave as 'All districts' for a common session">
          <Select id="district" name="district" defaultValue={v("district")}>
            <option value="">All districts</option>
            {districts.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label="Venue" htmlFor="venue" required error={fe.venue} className="sm:col-span-2 lg:col-span-4">
          <Input id="venue" name="venue" defaultValue={v("venue")} maxLength={300} placeholder="e.g. Conference hall, District Industries Centre, Ernakulam" required />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}><Save className="size-4" /> {pending ? "Saving…" : batch?.id ? "Save session" : "Create session"}</Button>
      </div>
    </form>
  );
}

export function DeleteBatch({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteBatchAction, undefined);
  return (
    <form action={action} onSubmit={(e) => { if (!confirm("Delete this session? Its sellers go back to 'awaiting a session'.")) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      {state?.error && <p className="mb-2 text-sm text-tx-red">{state.error}</p>}
      <Button type="submit" variant="ghost" disabled={pending} className="text-tx-red hover:text-tx-red"><Trash2 className="size-4" /> Delete session</Button>
    </form>
  );
}

export type Candidate = { id: string; name: string; regNo: string; district: string; taluk: string; mobile: string; note: string | null };

/** Place initially approved sellers in this session (ticked together). */
export function AssignPanel({ batchId, candidates }: { batchId: string; candidates: Candidate[] }) {
  const [state, action, pending] = useActionState(assignBatchAction, undefined);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = candidates.length > 0 && picked.size === candidates.length;
  return (
    <Card className="overflow-hidden">
      <CardHeader title={`Sellers awaiting a session (${candidates.length})`} icon={<UserPlus className="size-4" />}
        subtitle="Initially approved sellers not yet placed in a session, or absent from an earlier one. Tick and place them in this session; they are informed by e-mail." />
      <form action={action}>
        <input type="hidden" name="batchId" value={batchId} />
        {[...picked].map((id) => <input key={id} type="hidden" name="sellerIds" value={id} />)}
        <div className="space-y-3 border-b border-slate-100 p-4">
          {state?.ok && <Alert tone="green">{state.message}</Alert>}
          {state?.error && <Alert tone="red">{state.error}</Alert>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <RowSearch target={`cand-${batchId}`} placeholder="Search name, reg. no., taluk, mobile…" />
            <Button type="submit" disabled={pending || !picked.size}><UserPlus className="size-4" /> Place {picked.size || ""} in this session</Button>
          </div>
        </div>
        {candidates.length ? (
          <div id={`cand-${batchId}`} className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-2"><input type="checkbox" aria-label="Select all" checked={all} className="accent-brand-700" onChange={() => setPicked(all ? new Set() : new Set(candidates.map((c) => c.id)))} /></th>
                  <th className="px-3 py-2">Seller</th><th className="px-3 py-2">District / Taluk</th><th className="px-3 py-2">Mobile</th><th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map((c) => (
                  <tr key={c.id} data-search={`${c.name} ${c.regNo} ${c.district} ${c.taluk} ${c.mobile}`.toLowerCase()} className={cn(picked.has(c.id) && "bg-brand-50/60")}>
                    <td className="px-4 py-2"><input type="checkbox" aria-label={`Select ${c.name}`} checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="accent-brand-700" /></td>
                    <td className="px-3 py-2"><div className="font-semibold text-ink">{c.name}</div><div className="font-mono text-[11px] text-slate-500">{c.regNo}</div></td>
                    <td className="px-3 py-2 text-slate-700">{c.district}<div className="text-xs text-slate-500">{c.taluk}</div></td>
                    <td className="px-3 py-2 text-slate-700">{c.mobile}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="p-6 text-sm text-slate-500">No sellers are waiting for a session{""}.</p>}
      </form>
    </Card>
  );
}

/** Move one member to another session (before attendance is marked). */
export function MoveMember({ sellerId, batches }: { sellerId: string; batches: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(assignBatchAction, undefined);
  const [to, setTo] = useState("");
  if (state?.ok) return <span className="text-xs font-medium text-brand-700">Moved</span>;
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="sellerIds" value={sellerId} />
      <Select name="batchId" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Move to session" className="py-1 text-xs">
        <option value="">Move to…</option>
        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
      <Button type="submit" variant="secondary" disabled={pending || !to} className="px-2 py-1 text-xs"><ArrowRightLeft className="size-3.5" /></Button>
      {state?.error && <span className="text-xs text-tx-red">{state.error}</span>}
    </form>
  );
}

export type AttendanceRow = { id: string; name: string; regNo: string; district: string; taluk: string; mobile: string; attendance: "PENDING" | "PRESENT" | "ABSENT"; locked: boolean; status: string };

/** Training admin: mark each member present or absent and save. */
export function AttendanceForm({ batchId, rows }: { batchId: string; rows: AttendanceRow[] }) {
  const [state, action, pending] = useActionState(markAttendanceAction, undefined);
  const [marks, setMarks] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.id, r.attendance])));
  const set = (v: string) => setMarks(Object.fromEntries(rows.map((r) => [r.id, r.locked ? r.attendance : v])));
  const OPTS = [["PRESENT", "Present", "bg-brand-600 text-white ring-brand-600"], ["ABSENT", "Absent", "bg-tx-red text-white ring-tx-red"], ["PENDING", "Not marked", "bg-slate-600 text-white ring-slate-600"]] as const;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="batchId" value={batchId} />
      {Object.entries(marks).map(([id, v]) => <input key={id} type="hidden" name={`att_${id}`} value={v} />)}
      {state?.ok && <Alert tone="green">{state.message}</Alert>}
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RowSearch target={`att-${batchId}`} placeholder="Search name, reg. no., mobile…" />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => set("PRESENT")}>Mark all present</Button>
          <Button type="submit" disabled={pending}><Save className="size-4" /> {pending ? "Saving…" : "Save attendance"}</Button>
        </div>
      </div>
      <div id={`att-${batchId}`} className="table-scroll overflow-x-auto rounded-xl ring-1 ring-slate-200">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-2">Seller</th><th className="px-3 py-2">District / Taluk</th><th className="px-3 py-2">Mobile</th><th className="px-3 py-2">Attendance</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} data-search={`${r.name} ${r.regNo} ${r.mobile} ${r.taluk}`.toLowerCase()}>
                <td className="px-4 py-2"><div className="font-semibold text-ink">{r.name}</div><div className="font-mono text-[11px] text-slate-500">{r.regNo}</div></td>
                <td className="px-3 py-2 text-slate-700">{r.district}<div className="text-xs text-slate-500">{r.taluk}</div></td>
                <td className="px-3 py-2 text-slate-700">{r.mobile}</td>
                <td className="px-3 py-2">
                  {r.locked ? <span className="text-xs text-slate-500">{r.status}</span> : (
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Attendance of ${r.name}`}>
                      {OPTS.map(([v, label, on]) => (
                        <button type="button" key={v} role="radio" aria-checked={marks[r.id] === v} onClick={() => setMarks((m) => ({ ...m, [r.id]: v }))}
                          className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset", marks[r.id] === v ? on : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50")}>{label}</button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No sellers in this session yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </form>
  );
}
