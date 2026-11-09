"use client";

import { useKeepForm } from "@/lib/use-keep-form";
import { useActionState, useState } from "react";
import { CheckCircle2, Undo2, Send } from "lucide-react";
import { changeReviewAction } from "@/app/actions/review";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { NextUp, type NextUpLinks } from "@/components/nav/next-up";

export type PanelAction = { decision: string; label: string; variant: "primary" | "success" | "danger"; needsComment: boolean; confirm?: string };

export function ReviewPanel({ buyerId, actions, heading, note, nav }: { buyerId: string; actions: PanelAction[]; heading: string; note?: string; nav?: NextUpLinks }) {
  const [state, action, pending] = useActionState(changeReviewAction, undefined);
  const onSubmit = useKeepForm(action);
  const [comment, setComment] = useState("");
  if (state?.ok) return <Alert tone="green" title="Done">{state.message}{nav && <NextUp {...nav} />}</Alert>;
  if (!actions.length) {
    return <div><div className="font-bold text-ink">{heading}</div>{note && <p className="mt-1 text-sm text-slate-500">{note}</p>}</div>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="buyerId" value={buyerId} />
      <div>
        <div className="font-bold text-ink">{heading}</div>
        {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
      </div>
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      <Field label="Comment" htmlFor="comment" error={state?.fieldErrors?.comment} hint="Required when returning; optional otherwise. Visible in the audit trail.">
        <Textarea id="comment" name="comment" rows={4} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <div className="flex flex-col gap-2">
        {actions.map((a) => {
          const Icon = a.variant === "danger" ? Undo2 : a.decision === "recommend" ? Send : CheckCircle2;
          return (
            <Button key={a.decision} type="submit" name="decision" value={a.decision} variant={a.variant} disabled={pending}
              onClick={(e) => {
                if (a.needsComment && comment.trim().length < 5) { e.preventDefault(); alert("Please enter a comment explaining the correction required."); return; }
                if (a.confirm && !confirm(a.confirm)) e.preventDefault();
              }}>
              <Icon className="size-4" /> {a.label}
            </Button>
          );
        })}
      </div>
    </form>
  );
}
