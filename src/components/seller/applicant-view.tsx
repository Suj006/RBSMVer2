import { CalendarDays, Check, Clock, GraduationCap, Lock, XCircle } from "lucide-react";
import type { BatchMember, Seller, SellerLog, SellerProduct, Sector, TrainingBatch } from "@/generated/prisma/client";
import { fmtDay } from "@/lib/event";
import { fmtSlot } from "@/lib/training";
import { certificationNames } from "@/lib/masters";
import type { SellerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { Alert, Badge, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { ExportCredentials } from "./profile-summary";
import { SellerBadge } from "./seller-badge";
import { SellerForm } from "./seller-form";
import { EVENT, localBodyLabel } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { fmtMobile } from "@/lib/text";
import { SELLER_ACTION_LABEL, SELLER_APPLICANT_EDITABLE } from "@/lib/status";
import { sellerFormValues } from "@/lib/seller-form-defaults";
import { cn } from "@/lib/cn";

type Full = Seller & { products: (SellerProduct & { sector: Sector })[]; logs: SellerLog[]; batches: (BatchMember & { batch: TrainingBatch })[] };

const STEPS = ["Registered", "Taluk verification", "Initial approval", "Awareness session", "Final approval"];
const STEP: Record<SellerStatus, number> = {
  WITH_TALUK: 1, WITH_SELLER: 1, RETURNED: 1, RECOMMENDED: 2, INITIAL_APPROVED: 3, TRAINED: 4, APPROVED: 5, NOT_RECOMMENDED: -1, REJECTED: -1,
};

// Entries an applicant sees; internal Directorate ↔ taluk exchanges are left out.
const APPLICANT_LOG = new Set(["REGISTERED", "SENT_TO_SELLER", "RESUBMITTED", "RECOMMENDED", "NOT_RECOMMENDED", "INITIAL_APPROVED", "BATCH_ASSIGNED", "ATTENDED", "ABSENT", "APPROVED", "BYPASSED", "REJECTED"]);

const DONE: Record<string, string> = {
  resubmitted: "Thank you. Your corrected details have been sent back to the Taluk Industries Office.",
  updated: "Your details have been updated.",
};

/** The seller portal before approval: application status, corrections and resubmission. */
export async function ApplicantView({ seller: s, done }: { seller: Full; done?: string }) {
  const editable = SELLER_APPLICANT_EDITABLE.includes(s.status);
  const sentBack = s.logs.find((l) => l.action === "SENT_TO_SELLER");
  const rejected = s.logs.find((l) => l.action === "REJECTED");
  const notRec = s.logs.find((l) => l.action === "NOT_RECOMMENDED");
  const session = s.batches.find((m) => m.attendance === "PENDING");
  const wasAbsent = s.batches.some((m) => m.attendance === "ABSENT");
  const sectors = editable
    ? await prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } })
    : [];
  const certs = editable ? await certificationNames() : [];
  const step = STEP[s.status];

  return (
    <>
      <PageHeader eyebrow={`${EVENT.name} · ${EVENT.short} · Registration no. ${s.regNo}`} title="Your seller application"
        subtitle={s.name} actions={<SellerBadge status={s.status} />} />
      {done && DONE[done] && <Alert tone="green" className="mb-6">{DONE[done]}</Alert>}

      {/* Progress */}
      {step >= 0 && (
        <Card className="mb-6 p-5 sm:p-6">
          <ol className="grid grid-cols-5 gap-2">
            {STEPS.map((label, i) => {
              const state = i < step ? "done" : i === step ? "current" : "todo";
              return (
                <li key={label} className="flex flex-col items-center text-center">
                  <span className={cn("grid size-9 place-items-center rounded-full text-sm font-bold",
                    state === "done" ? "bg-brand-600 text-white" : state === "current" ? "bg-tx-yellow text-ink ring-4 ring-tx-yellow/25" : "bg-slate-100 text-slate-400")}>
                    {state === "done" ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span className={cn("mt-2 text-xs font-medium sm:text-sm", state === "todo" ? "text-slate-400" : "text-ink")}>{label}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {/* What happens now */}
      {s.status === "WITH_SELLER" && (
        <Alert tone="amber" className="mb-6" title={`Correction requested by the Taluk Industries Office, ${s.taluk}`}>
          {sentBack?.comment && <p className="mt-1 text-base font-medium text-amber-950">&ldquo;{sentBack.comment}&rdquo;</p>}
          <p className="mt-1">Please correct the details below and click <b>Save &amp; submit to taluk office</b>.</p>
        </Alert>
      )}
      {s.status === "WITH_TALUK" && (
        <StatusCard icon={<Clock className="size-5" />} title={`Being verified by the Taluk Industries Office, ${s.taluk}`}>
          You can still update your details below until the taluk office acts on your application. You will be e-mailed if anything needs correcting.
        </StatusCard>
      )}
      {(s.status === "RECOMMENDED" || s.status === "RETURNED") && (
        <StatusCard icon={<Lock className="size-5" />} title={s.status === "RECOMMENDED" ? "Recommended to the Directorate — awaiting initial approval" : "Being re-checked by your taluk office"}>
          Your details are locked while they are reviewed. After initial approval you will be invited to an awareness session.
        </StatusCard>
      )}
      {s.status === "INITIAL_APPROVED" && (session ? (
        <Card className="mb-6 flex gap-4 p-5 ring-2 ring-sky-200">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><CalendarDays className="size-5" /></div>
          <div>
            <div className="font-bold text-ink">Please attend your awareness session</div>
            <div className="mt-3"><DL cols={3} items={[
              { label: "Session", value: session.batch.name },
              { label: "Date and time", value: `${fmtDay(session.batch.date)}, ${fmtSlot(session.batch.startTime, session.batch.endTime)}` },
              { label: "Venue", value: session.batch.venue },
            ]} /></div>
            <p className="mt-3 text-sm text-slate-600">Attendance is marked at the session. After you attend, the Directorate gives final approval with your seller number and permanent login.</p>
          </div>
        </Card>
      ) : (
        <StatusCard icon={<GraduationCap className="size-5" />} title={wasAbsent ? "You were absent from your awareness session" : "Initially approved — awareness session to be scheduled"}>
          {wasAbsent ? "You will be placed in another session; " : "Your district office will place you in an awareness session; "}the date, time and venue will be e-mailed to you and shown here.
        </StatusCard>
      ))}
      {s.status === "TRAINED" && (
        <StatusCard icon={<Check className="size-5" />} title="Awareness session attended — awaiting final approval">
          The Directorate now gives final approval. Your seller number and permanent login will be e-mailed to you.
        </StatusCard>
      )}
      {s.status === "NOT_RECOMMENDED" && (
        <Alert tone="red" className="mb-6" title="Your registration was not recommended by the taluk office">
          {notRec?.comment && <p className="mt-1">&ldquo;{notRec.comment}&rdquo;</p>}
          <p className="mt-1">For clarification, please contact the Taluk Industries Office, {s.taluk}.</p>
        </Alert>
      )}
      {s.status === "REJECTED" && (
        <Alert tone="red" className="mb-6" title="Your registration was not accepted">
          {rejected?.comment && <p className="mt-1">&ldquo;{rejected.comment}&rdquo;</p>}
          <p className="mt-1">For clarification, please contact the District Industries Centre, {s.district}, or the Taluk Industries Office, {s.taluk}.</p>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {editable ? (
            s.status === "WITH_SELLER" ? (
              <SellerForm mode="applicant" initial={sellerFormValues(s)} sectors={sectors} certifications={certs} />
            ) : (
              <>
                <Summary s={s} />
                <details className="group rounded-2xl bg-white ring-1 ring-slate-200">
                  <summary className="cursor-pointer list-none px-6 py-4 font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Update my details…</span>
                    <span className="hidden group-open:inline">Update my details</span>
                  </summary>
                  <div className="border-t border-slate-100 p-4 sm:p-6">
                    <SellerForm mode="applicant" initial={sellerFormValues(s)} sectors={sectors} certifications={certs} />
                  </div>
                </details>
              </>
            )
          ) : <Summary s={s} />}
        </div>

        <Card className="h-fit">
          <CardHeader title="Application history" />
          <ol className="space-y-4 p-5">
            {s.logs.filter((l) => APPLICANT_LOG.has(l.action)).map((l) => (
              <li key={l.id} className="text-sm">
                <div className="font-semibold text-ink">{l.action === "BATCH_ASSIGNED" ? "Awareness session" : SELLER_ACTION_LABEL[l.action]}</div>
                <div className="text-xs text-slate-500">{fmtDateTime(l.createdAt)}</div>
                {l.comment && l.action !== "REGISTERED" && <div className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-700">{l.comment}</div>}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

function StatusCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-6 flex gap-4 p-5">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">{icon}</div>
      <div>
        <div className="font-bold text-ink">{title}</div>
        <p className="mt-1 text-sm text-slate-600">{children}</p>
      </div>
    </Card>
  );
}

function Summary({ s }: { s: Full }) {
  return (
    <Card>
      <CardHeader title="Submitted details" icon={s.status === "REJECTED" ? <XCircle className="size-4" /> : undefined} />
      <div className="space-y-6 p-6">
        <DL cols={3} items={[
          { label: "Name of the seller", value: s.name },
          { label: "Udyam number", value: <span className="font-mono">{s.udyamNo}</span> },
          { label: "Export experience", value: s.exportExperience ? <Badge tone="green">Yes</Badge> : <Badge tone="slate">No</Badge> },
          { label: "District", value: s.district },
          { label: "Taluk", value: s.taluk },
          { label: "Local body", value: `${s.localBodyName} ${localBodyLabel(s.localBodyType)}` },
          { label: "Name of the promoter", value: s.contactName },
          { label: "Mobile / WhatsApp", value: `${fmtMobile(s.contactMobile)}${s.contactWhatsapp !== s.contactMobile ? ` / ${fmtMobile(s.contactWhatsapp)}` : ""}` },
          { label: "E-mail ID", value: s.contactEmail },
        ]} />
        <ExportCredentials s={s} />
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sectors &amp; products ready to export</div>
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {s.products.map((p) => (
              <li key={p.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[200px_1fr]">
                <span className="font-semibold text-ink">{p.sector.name}</span><span className="text-slate-700">{p.products}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
