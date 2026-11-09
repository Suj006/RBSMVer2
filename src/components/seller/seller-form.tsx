"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Save, Send, Trash2 } from "lucide-react";
import { applicantSaveSellerAction, saveSellerAction, selfRegisterSellerAction } from "@/app/actions/seller";
import { Alert, Button, ButtonLink, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { DISTRICT_NAMES, LOCAL_BODY_TYPES } from "@/lib/config";
import { TALUKS, urbanBodies } from "@/lib/kerala";
import { CertPicker } from "./cert-picker";
import { CountryMulti } from "./country-multi";
import { useKeepForm } from "@/lib/use-keep-form";
import { UdyamInput } from "./udyam-input";
import { cn } from "@/lib/cn";
import { EMPTY_SELLER, type SellerFormValues } from "@/lib/seller-form-defaults";

export function SellerForm({ mode, initial, sectors, certifications, district, taluk, backHref }: {
  /** district / taluk: a district or taluk office; self: public self-registration; applicant: the applicant correcting their own registration. */
  mode: "district" | "taluk" | "self" | "applicant";
  initial: SellerFormValues;
  sectors: { id: string; name: string }[];
  /** Certification master names. */
  certifications: string[];
  district?: string;
  /** Taluk office: its own taluk (fixed). */
  taluk?: string;
  backHref?: string;
}) {
  const [state, action, pending] = useActionState(mode === "self" ? selfRegisterSellerAction : mode === "applicant" ? applicantSaveSellerAction : saveSellerAction, undefined);
  const onSubmit = useKeepForm(action);
  const staff = mode === "district" || mode === "taluk";
  const [rows, setRows] = useState(initial.products.length ? initial.products : EMPTY_SELLER.products);
  const [same, setSame] = useState(!initial.contactWhatsapp || initial.contactWhatsapp === initial.contactMobile);
  const fe = state?.fieldErrors ?? {};
  const used = new Set(rows.map((r) => r.sectorId));
  const [dist, setDist] = useState(staff ? district ?? "" : initial.district);
  const [lbt, setLbt] = useState(initial.localBodyType);
  const [exp, setExp] = useState(initial.exportExperience);
  const taluks = TALUKS[dist] ?? [];
  const urban = urbanBodies(dist, lbt);
  // Keep a stored value that is not in the master visible, so an older record can be corrected.
  const withCurrent = (list: readonly string[], v: string) => (v && !list.includes(v) ? [v, ...list] : list);

  if (state?.ok && mode === "self" && state.data) {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700"><CheckCircle2 className="size-6" /></div>
          <div>
            <h2 className="text-2xl font-extrabold text-ink">Registration received</h2>
            <p className="text-sm text-slate-500">Registration no. <span className="font-semibold text-ink">{state.data.regNo}</span></p>
          </div>
        </div>
        <Alert tone="green" className="mt-6">
          Your details have been sent to the Taluk Industries Office, {state.data.taluk} ({state.data.district} district), for verification.
        </Alert>
        <div className="mt-4 rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <div className="font-bold text-ink">Your temporary login</div>
          <p className="mt-1 text-sm text-slate-600">
            User name <span className="font-mono font-semibold text-ink">{state.data.username}</span> — the password has been e-mailed to {state.data.email}.
            Use it to track your application, to correct your details if the taluk office asks, and to see your awareness session.
            After the session and the Directorate&apos;s final approval, the same login becomes your permanent seller login.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/login">Sign in to track your application</ButtonLink>
          <ButtonLink href="/" variant="secondary">Back to home</ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="products" value={JSON.stringify(rows)} />
      {state?.error && <Alert tone="red">{state.error}</Alert>}
      {state?.ok && mode === "district" && (
        <Alert tone="green" title="Saved">
          {state.message}{" "}
          {state.data?.id && <Link href={`/district/sellers/${state.data.id}`} className="font-semibold underline">Open seller</Link>}
        </Alert>
      )}

      <Card>
        <CardHeader title="Enterprise details" subtitle="Please write all details in English." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Name of the seller" htmlFor="name" required error={fe.name} className="sm:col-span-2" hint="Name of the enterprise as in the Udyam certificate">
            <Input id="name" name="name" defaultValue={initial.name} maxLength={160} />
          </Field>
          <Field label="District" htmlFor="district" required error={fe.district}>
            {staff ? (
              <>
                <Input id="district" value={district} disabled />
                <input type="hidden" name="district" value={district} />
              </>
            ) : (
              <Select id="district" name="district" value={dist} onChange={(e) => setDist(e.target.value)}>
                <option value="">Select district…</option>
                {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Taluk" htmlFor="taluk" required error={fe.taluk}>
            {mode === "taluk" ? (
              <>
                <Input id="taluk" value={taluk} disabled />
                <input type="hidden" name="taluk" value={taluk} />
              </>
            ) : (
              <Select key={`t-${dist}`} id="taluk" name="taluk" defaultValue={dist === initial.district ? initial.taluk : ""} disabled={!dist}>
                <option value="">{dist ? "Select taluk…" : "Select the district first"}</option>
                {withCurrent(taluks, dist === initial.district ? initial.taluk : "").map((t) => <option key={t}>{t}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Local body type" htmlFor="localBodyType" required error={fe.localBodyType}>
            <Select id="localBodyType" name="localBodyType" value={lbt} onChange={(e) => setLbt(e.target.value)}>
              <option value="">Select…</option>
              {LOCAL_BODY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Local body name" htmlFor="localBodyName" required error={fe.localBodyName}
            hint={lbt === "PANCHAYAT" ? "Name of the grama panchayat" : undefined}>
            {lbt === "MUNICIPALITY" || lbt === "CORPORATION" ? (
              <Select key={`lb-${dist}-${lbt}`} id="localBodyName" name="localBodyName" disabled={!dist}
                defaultValue={dist === initial.district && lbt === initial.localBodyType ? initial.localBodyName : ""}>
                <option value="">{!dist ? "Select the district first" : urban.length ? "Select…" : `No ${lbt === "CORPORATION" ? "corporation" : "municipality"} in ${dist}`}</option>
                {withCurrent(urban, dist === initial.district && lbt === initial.localBodyType ? initial.localBodyName : "").map((t) => <option key={t}>{t}</option>)}
              </Select>
            ) : (
              <Input key={`lbp-${lbt}`} id="localBodyName" name="localBodyName" maxLength={80}
                defaultValue={lbt === initial.localBodyType ? initial.localBodyName : ""} placeholder={lbt ? "e.g. Thanneermukkom" : "Select the local body type first"} />
            )}
          </Field>
          <Field label="Udyam registration number" htmlFor="udyamNo" required error={fe.udyamNo} hint="Enter only the numbers — e.g. 07 and 0012345. UDYAM-KL- is filled in for you.">
            <UdyamInput name="udyamNo" defaultValue={initial.udyamNo} invalid={!!fe.udyamNo} />
          </Field>
          <Field label="Export experience" required error={fe.exportExperience}>
            <div className="flex gap-3 pt-1" role="radiogroup">
              {(["YES", "NO"] as const).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ring-1 ring-slate-300 has-[:checked]:bg-brand-50 has-[:checked]:ring-2 has-[:checked]:ring-brand-600">
                  <input type="radio" name="exportExperience" value={v} checked={exp === v} onChange={() => setExp(v)} className="accent-brand-700" />
                  {v === "YES" ? "Yes" : "No"}
                </label>
              ))}
            </div>
          </Field>
          {exp === "YES" && (
            <div className="grid gap-5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:col-span-2 sm:grid-cols-2">
              <div className="sm:col-span-2 text-xs text-slate-500">Export history — for reference only; it does not affect buyer–seller matchmaking.</div>
              <Field label="Countries exported to" htmlFor="exportCountries" required error={fe.exportCountries ?? Object.entries(fe).find(([k]) => k.startsWith("exportCountries."))?.[1]}
                hint="Pick each country from the list; you can add several.">
                <CountryMulti id="exportCountries" name="exportCountries" initial={initial.exportCountries} invalid={!!fe.exportCountries} />
              </Field>
              <Field label="Products exported" htmlFor="exportedProducts" required error={fe.exportedProducts} hint="Separate products with commas">
                <Textarea id="exportedProducts" name="exportedProducts" rows={3} maxLength={1000} defaultValue={initial.exportedProducts} placeholder="e.g. Black pepper, Coir mats" />
              </Field>
            </div>
          )}
          <Field label="IEC number (Importer-Exporter Code)" htmlFor="iecNo" required={exp === "YES"} error={fe.iecNo}
            hint={exp === "YES" ? "10 characters, e.g. ABCDE1234F — required for sellers with export experience" : "10 characters, e.g. ABCDE1234F — if the unit has one"}>
            <Input id="iecNo" name="iecNo" defaultValue={initial.iecNo} maxLength={14} className="uppercase" autoComplete="off" />
          </Field>
          <div className="sm:col-span-2">
            <div className="mb-2 text-sm font-semibold text-slate-700">Quality / product certifications held</div>
            <CertPicker name="certifications" master={certifications} initial={initial.certifications}
              error={Object.entries(fe).find(([k]) => k.startsWith("certifications"))?.[1]} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Promoter details" subtitle="The promoter is the contact person for the event." />
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Name of the promoter" htmlFor="contactName" required error={fe.contactName} hint="English letters and spaces only">
            <Input id="contactName" name="contactName" defaultValue={initial.contactName} maxLength={120} autoComplete="name" />
          </Field>
          <Field label="E-mail ID" htmlFor="contactEmail" required error={fe.contactEmail}
            hint={staff ? "The temporary login and updates on the application are sent here" : "Login details and updates on your application are sent here"}>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={initial.contactEmail} maxLength={160} autoComplete="email" />
          </Field>
          <Field label="Mobile number" htmlFor="contactMobile" required error={fe.contactMobile} hint="10-digit mobile number">
            <Input id="contactMobile" name="contactMobile" type="tel" inputMode="numeric" defaultValue={initial.contactMobile} maxLength={16} placeholder="98765 43210" />
          </Field>
          <Field label="WhatsApp number" htmlFor="contactWhatsapp" required error={fe.contactWhatsapp}>
            <div className="space-y-2">
              <Input id="contactWhatsapp" name="contactWhatsapp" type="tel" inputMode="numeric" defaultValue={same ? "" : initial.contactWhatsapp}
                maxLength={16} disabled={same} placeholder={same ? "Same as mobile number" : "98765 43210"} />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="sameWhatsapp" checked={same} onChange={(e) => setSame(e.target.checked)} className="accent-brand-700" />
                Same as mobile number
              </label>
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Sectors & products ready to export" subtitle="Add each sector the enterprise works in, with the products it can export now."
          action={
            <Button type="button" variant="secondary" disabled={rows.length >= sectors.length} onClick={() => setRows((r) => [...r, { sectorId: "", products: "" }])}>
              <Plus className="size-4" /> Add sector
            </Button>
          } />
        {fe.products && <Alert tone="red" className="mx-6 mt-5">{fe.products}</Alert>}
        <div className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-4 p-6 sm:grid-cols-[minmax(0,280px)_1fr_auto] sm:items-start">
              <Field label={`Sector ${i + 1}`} htmlFor={`sector-${i}`} required error={fe[`products.${i}.sectorId`]}>
                <Select id={`sector-${i}`} value={r.sectorId} onChange={(e) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, sectorId: e.target.value } : x)))}>
                  <option value="">Select sector…</option>
                  {sectors.filter((s) => s.id === r.sectorId || !used.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Products ready to export" htmlFor={`products-${i}`} required error={fe[`products.${i}.products`]} hint="Separate products with commas">
                <Textarea id={`products-${i}`} rows={2} maxLength={1000} value={r.products} placeholder="e.g. Black pepper, Cardamom"
                  onChange={(e) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, products: e.target.value } : x)))} />
              </Field>
              <button type="button" onClick={() => setRows((xs) => xs.filter((_, j) => j !== i))} disabled={rows.length === 1}
                className={cn("mt-7 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-tx-red hover:bg-red-50", rows.length === 1 && "invisible")}
                aria-label={`Remove sector ${i + 1}`}>
                <Trash2 className="size-3.5" /> Remove
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {backHref && <ButtonLink href={backHref} variant="ghost">Cancel</ButtonLink>}
        {mode === "taluk" ? (
          <>
            <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}><Save className="size-4" /> Save</Button>
            <Button type="submit" name="intent" value="recommend" disabled={pending}><Send className="size-4" /> {pending ? "Saving…" : "Save & recommend to Directorate"}</Button>
          </>
        ) : mode === "district" ? (
          <Button type="submit" name="intent" value="save" disabled={pending} className="px-6"><Save className="size-4" /> {pending ? "Saving…" : initial.id ? "Save" : "Register seller"}</Button>
        ) : mode === "applicant" ? (
          <Button type="submit" disabled={pending} className="px-6"><Send className="size-4" /> {pending ? "Submitting…" : "Save & submit to taluk office"}</Button>
        ) : (
          <Button type="submit" disabled={pending} className="px-6"><Send className="size-4" /> {pending ? "Submitting…" : "Submit registration"}</Button>
        )}
      </div>
    </form>
  );
}
