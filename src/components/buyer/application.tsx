"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Circle, Pencil, Send, Undo2 } from "lucide-react";
import { submitApplicationAction, withdrawChangeAction } from "@/app/actions/buyer";
import { Alert, Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Final step: the checklist and the one button that sends the whole application to FIEO. */
export function SubmitApplication({ checks }: { checks: { label: string; done: boolean }[] }) {
  const [state, action, pending] = useActionState(submitApplicationAction, undefined);
  const ready = checks.every((c) => c.done);
  if (state?.ok) return <Alert tone="green" title="Application submitted">{state.message}</Alert>;
  return (
    <Card id="submit" className="scroll-mt-24 p-6">
      <h2 className="text-lg font-bold text-ink">4. Submit your application</h2>
      <p className="mt-1 text-sm text-slate-500">Your basic details, documents, sourcing profile and every sector go to FIEO together. FIEO verifies them; each sector FIEO approves then goes to the Directorate.</p>
      <ul className="mt-4 space-y-2 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            {c.done ? <CheckCircle2 className="size-4 text-brand-600" /> : <Circle className="size-4 text-slate-300" />}
            <span className={cn(c.done ? "text-ink" : "text-slate-500")}>{c.label}</span>
          </li>
        ))}
      </ul>
      {state?.error && <Alert tone="red" className="mt-4">{state.error}</Alert>}
      <form action={action} className="mt-5 flex justify-end">
        <Button type="submit" disabled={pending || !ready} title={ready ? undefined : "Complete every section first"}>
          <Send className="size-4" /> {pending ? "Submitting…" : "Submit application to FIEO"}
        </Button>
      </form>
    </Card>
  );
}

/** Verified details shown read-only, with a button that opens the form to request a change. */
export function ChangeToggle({ label, view, form }: { label: string; view: React.ReactNode; form: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="space-y-3">
      {form}
      <div className="flex justify-end"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close without sending</Button></div>
    </div>
  ) : (
    <div className="space-y-3">
      {view}
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}><Pencil className="size-4" /> {label}</Button>
      </div>
    </div>
  );
}

/** Lets the buyer withdraw a change FIEO has not verified yet. */
export function WithdrawChange() {
  const [state, action, pending] = useActionState(withdrawChangeAction, undefined);
  if (state?.ok) return <p className="text-sm font-medium text-brand-800">{state.message}</p>;
  return (
    <form action={action} onSubmit={(e) => { if (!confirm("Withdraw this change? Your verified details stay as they are.")) e.preventDefault(); }}>
      {state?.error && <p className="mb-2 text-sm text-tx-red">{state.error}</p>}
      <Button type="submit" variant="ghost" disabled={pending} className="px-3 py-1.5 text-xs text-tx-red hover:text-tx-red"><Undo2 className="size-3.5" /> Withdraw change</Button>
    </form>
  );
}
