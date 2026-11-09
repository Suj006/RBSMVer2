"use client";

import { useKeepForm } from "@/lib/use-keep-form";
import { useActionState, useEffect, useRef } from "react";
import { Save, Send, Upload } from "lucide-react";
import { saveBasicAction } from "@/app/actions/buyer";
import { Alert, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { DocLink } from "@/components/doc-link";
import { COUNTRIES } from "@/lib/countries";

type Doc = { id: string; originalName: string; size: number } | null;

/** "draft": the application before submission (saved directly). "change": a verified buyer's change, sent to FIEO for verification. */
export function BasicForm({ buyer, docs, accept, mode = "draft", onCancel }: {
  buyer: { name: string; country: string; pocName: string | null; pocDesignation: string | null; pocEmail: string | null; pocMobile: string | null };
  docs: { PROFILE: Doc; CREDENTIALS: Doc };
  accept: string;
  mode?: "draft" | "change";
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState(saveBasicAction, undefined);
  const onSubmit = useKeepForm(action);
  const formRef = useRef<HTMLFormElement>(null);
  // Uploaded files are saved; clear the pickers so they are not sent again.
  useEffect(() => {
    if (state?.ok) formRef.current?.querySelectorAll<HTMLInputElement>("input[type=file]").forEach((i) => (i.value = ""));
  }, [state]);
  const fe = state?.fieldErrors ?? {};
  const v = (k: keyof typeof buyer) => state?.data?.[k] ?? buyer[k] ?? "";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && <Alert tone="green">{state.message}</Alert>}

      <Card>
        <CardHeader title="Buyer" subtitle="Captured at sign-up — you can correct it here. All details must be in English." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Name of the buyer" htmlFor="name" required error={fe.name} hint="English letters, numbers and . , & ' ( ) / -">
            <Input id="name" name="name" defaultValue={v("name")} required maxLength={160} />
          </Field>
          <Field label="Country" htmlFor="country" required error={fe.country}>
            <Select id="country" name="country" defaultValue={v("country")} required>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Point of contact" subtitle="The person FIEO and the Directorate will correspond with." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Name" htmlFor="pocName" required error={fe.pocName} hint="English letters and spaces only">
            <Input id="pocName" name="pocName" defaultValue={v("pocName")} maxLength={120} autoComplete="name" />
          </Field>
          <Field label="Designation" htmlFor="pocDesignation" required error={fe.pocDesignation} hint="e.g. Head of Procurement">
            <Input id="pocDesignation" name="pocDesignation" defaultValue={v("pocDesignation")} maxLength={120} autoComplete="organization-title" />
          </Field>
          <Field label="E-mail ID" htmlFor="pocEmail" required error={fe.pocEmail}>
            <Input id="pocEmail" name="pocEmail" type="email" defaultValue={v("pocEmail")} maxLength={160} autoComplete="email" />
          </Field>
          <Field label="Mobile number" htmlFor="pocMobile" required error={fe.pocMobile} hint="Include the country code, e.g. +971 50 123 4567">
            <Input id="pocMobile" name="pocMobile" type="tel" defaultValue={v("pocMobile")} maxLength={20} autoComplete="tel" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Documents" subtitle={mode === "change"
          ? "Upload a new file only to replace a verified document. PDF, JPG or PNG · up to 5 MB each."
          : "PDF, JPG or PNG · up to 5 MB each. Uploading again replaces the earlier file."} icon={<Upload className="size-4" />} />
        <div className="grid gap-6 p-6 sm:grid-cols-2">
          {([["profileFile", "PROFILE", "Company profile"], ["credentialsFile", "CREDENTIALS", "Organisation credentials"]] as const).map(([field, kind, label]) => (
            <Field key={field} label={label} htmlFor={field} required={mode === "draft"} error={fe[field]}
              hint={kind === "CREDENTIALS" ? "e.g. certificate of incorporation, trade licence or import-export registration" : "Brochure or company profile document"}>
              <div className="space-y-2">
                {docs[kind] && <DocLink doc={docs[kind]} />}
                <input id={field} name={field} type="file" accept={accept}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100" />
              </div>
            </Field>
          ))}
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        {mode === "draft" ? (
          <Button type="submit" variant="secondary" disabled={pending}>
            <Save className="size-4" /> {pending ? "Saving…" : "Save basic details"}
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            <Send className="size-4" /> {pending ? "Sending…" : "Send change to FIEO"}
          </Button>
        )}
      </div>
    </form>
  );
}
