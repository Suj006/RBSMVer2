"use client";

import { useActionState } from "react";
import { Save, Send } from "lucide-react";
import { saveProfileAction } from "@/app/actions/buyer";
import { Alert, Button, Card, CardHeader, Field, Select } from "@/components/ui";
import { ENGAGEMENT_TYPES, ORGANISATION_TYPES, SOURCING_TIMELINES, SOURCING_VALUES } from "@/lib/config";
import { useKeepForm } from "@/lib/use-keep-form";

export type Profile = { organisationType: string; procurementInterests: string; annualSourcingValue: string; sourcingTimeline: string; preferredEngagement: string };

/** "draft": saved directly (before the application is submitted). "change": sent to FIEO for verification. */
export function ProfileForm({ profile, complete, mode = "draft", onCancel }: { profile: Profile; complete: boolean; mode?: "draft" | "change"; onCancel?: () => void }) {
  const [state, action, pending] = useActionState(saveProfileAction, undefined);
  const onSubmit = useKeepForm(action);
  const fe = state?.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader title="Sourcing profile" subtitle={complete
        ? "Applies to all your sectors. Please write all details in English."
        : "Required before you submit your application. Please write all details in English."} />
      <form onSubmit={onSubmit} className="space-y-5 p-6">
        {state?.error && <Alert tone="red">{state.error}</Alert>}
        {state?.ok && <Alert tone="green">{state.message}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Organisation type" htmlFor="organisationType" required error={fe.organisationType}>
            <Select id="organisationType" name="organisationType" defaultValue={profile.organisationType}>
              <option value="">Select…</option>
              {ORGANISATION_TYPES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Indicative annual sourcing value" htmlFor="annualSourcingValue" required error={fe.annualSourcingValue}>
            <Select id="annualSourcingValue" name="annualSourcingValue" defaultValue={profile.annualSourcingValue}>
              <option value="">Select…</option>
              {SOURCING_VALUES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Sourcing timeline" htmlFor="sourcingTimeline" required error={fe.sourcingTimeline}>
            <Select id="sourcingTimeline" name="sourcingTimeline" defaultValue={profile.sourcingTimeline}>
              <option value="">Select…</option>
              {SOURCING_TIMELINES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Preferred engagement" htmlFor="preferredEngagement" error={fe.preferredEngagement}>
            <Select id="preferredEngagement" name="preferredEngagement" defaultValue={profile.preferredEngagement}>
              <option value="">Select…</option>
              {ENGAGEMENT_TYPES.map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-3">
          {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
          {mode === "draft"
            ? <Button type="submit" variant="secondary" disabled={pending}><Save className="size-4" /> {pending ? "Saving…" : "Save profile"}</Button>
            : <Button type="submit" disabled={pending}><Send className="size-4" /> {pending ? "Sending…" : "Send change to FIEO"}</Button>}
        </div>
      </form>
    </Card>
  );
}
