"use client";

import { useKeepForm } from "@/lib/use-keep-form";
import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail, UserPlus } from "lucide-react";
import { signupAction } from "@/app/actions/auth";
import { Alert, Button, ButtonLink, Field, Input, Select } from "@/components/ui";
import { COUNTRIES } from "@/lib/countries";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  const onSubmit = useKeepForm(action);

  if (state?.ok && state.data) {
    const d = state.data;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700"><CheckCircle2 className="size-6" /></div>
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Registration received</h1>
            <p className="text-sm text-slate-500">Registration no. <span className="font-semibold text-ink">{d.regNo}</span></p>
          </div>
        </div>
        <Alert tone="green" title={<span className="inline-flex items-center gap-1.5"><Mail className="size-4" /> Check your inbox</span>}>
          {state.message}
        </Alert>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between py-1"><span className="text-slate-500">User name</span><span className="font-mono font-semibold">{d.username}</span></div>
          {d.password && (
            <div className="flex justify-between py-1"><span className="text-slate-500">Temporary password</span><span className="font-mono font-semibold">{d.password}</span></div>
          )}
        </div>
        <p className="text-sm text-slate-500">
          On first sign-in you will be asked to set a new password, then to complete your application (basic details, sourcing profile and sector requirements) and submit it to FIEO.
        </p>
        <ButtonLink href="/login" className="w-full">Continue to sign in</ButtonLink>
      </div>
    );
  }

  const fe = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Country" htmlFor="country" required error={fe.country}>
        <Select id="country" name="country" required defaultValue={state?.data?.country ?? ""}>
          <option value="" disabled>Select country…</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Name of the buyer" htmlFor="name" required error={fe.name} hint="Organisation / company name, in English">
        <Input id="name" name="name" required maxLength={160} defaultValue={state?.data?.name} autoComplete="organization" />
      </Field>
      <Field label="E-mail address" htmlFor="email" required error={fe.email} hint="Your login credentials will be sent to this address.">
        <Input id="email" name="email" type="email" required maxLength={160} defaultValue={state?.data?.email} autoComplete="email"
          pattern="[^@\s]+@[^@\s]+\.[^@\s]+" />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        <UserPlus className="size-4" /> {pending ? "Registering…" : "Sign up"}
      </Button>
      <p className="text-center text-sm text-slate-500">
        Already registered? <Link href="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
