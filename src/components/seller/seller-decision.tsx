"use client";

import { useActionState, useState } from "react";
import { BadgeCheck, Ban, CheckCircle2, Send, Undo2, UserRoundPen, XCircle } from "lucide-react";
import { sellerDecisionAction } from "@/app/actions/seller";
import { NextUp, type NextUpLinks } from "@/components/nav/next-up";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { useKeepForm } from "@/lib/use-keep-form";

export type Decision = "recommend" | "not_recommend" | "to_seller" | "approve_initial" | "return" | "reject" | "approve" | "bypass";
export type Opt = { decision: Decision; label: string; variant: "primary" | "success" | "danger" | "secondary"; needsComment: boolean };

export const TALUK_OPTIONS: Opt[] = [
  { decision: "recommend", label: "Recommend to Directorate", variant: "primary", needsComment: false },
  { decision: "to_seller", label: "Return to applicant for correction", variant: "secondary", needsComment: true },
  { decision: "not_recommend", label: "Not recommended", variant: "danger", needsComment: true },
];
export const INITIAL_OPTIONS: Opt[] = [
  { decision: "approve_initial", label: "Initial approval (awareness session)", variant: "success", needsComment: false },
  { decision: "return", label: "Return to taluk office", variant: "secondary", needsComment: true },
  { decision: "reject", label: "Reject", variant: "danger", needsComment: true },
];
export const FINAL_OPTIONS: Opt[] = [
  { decision: "approve", label: "Final approval & permanent login", variant: "success", needsComment: false },
  { decision: "reject", label: "Reject", variant: "danger", needsComment: true },
];
export const BYPASS_OPTIONS: Opt[] = [
  { decision: "bypass", label: "Final approval without session", variant: "primary", needsComment: true },
  { decision: "reject", label: "Reject", variant: "danger", needsComment: true },
];

const ICON = { recommend: Send, not_recommend: Ban, approve_initial: CheckCircle2, approve: BadgeCheck, bypass: BadgeCheck, return: Undo2, reject: XCircle, to_seller: UserRoundPen };
const CONFIRM: Partial<Record<Decision, string>> = {
  approve: "Give final approval and e-mail the seller number and permanent login?",
  bypass: "Give final approval WITHOUT the awareness session and e-mail the permanent login?",
  reject: "Reject this registration? This cannot be undone.",
  not_recommend: "Mark this seller as not recommended?",
};

/** Decision panel for one seller (detail page). */
export function SellerDecision({ sellerId, options, heading, note, nav }: { sellerId: string; options: Opt[]; heading: string; note?: string; nav?: NextUpLinks }) {
  const [state, action, pending] = useActionState(sellerDecisionAction, undefined);
  const onSubmit = useKeepForm(action);
  const [comment, setComment] = useState("");
  if (state?.ok) return <Alert tone="green" title="Done">{state.message}{nav && <NextUp {...nav} />}</Alert>;
  if (!options.length) return <div><div className="font-bold text-ink">{heading}</div>{note && <p className="mt-1 text-sm text-slate-500">{note}</p>}</div>;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="sellerIds" value={sellerId} />
      <div>
        <div className="font-bold text-ink">{heading}</div>
        {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
      </div>
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      <Field label="Comment" htmlFor="comment" error={state?.fieldErrors?.comment} hint="Required when returning, not recommending, rejecting or approving without a session. Comments to the applicant are e-mailed to them.">
        <Textarea id="comment" name="comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const Icon = ICON[o.decision];
          return (
            <Button key={o.decision} type="submit" name="decision" value={o.decision} variant={o.variant} disabled={pending}
              onClick={(e) => {
                if (o.needsComment && comment.trim().length < 5) { e.preventDefault(); alert("Please enter a comment (at least 5 characters)."); return; }
                const ask = CONFIRM[o.decision];
                if (ask && !confirm(ask)) e.preventDefault();
              }}>
              <Icon className="size-4" /> {o.label}
            </Button>
          );
        })}
      </div>
    </form>
  );
}
