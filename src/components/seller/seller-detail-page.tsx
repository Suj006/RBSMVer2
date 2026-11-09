import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { backFor } from "@/components/nav/back-target";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sellerScope, sellerWhere } from "@/lib/seller-query";
import { localBodyLabel } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { fmtMobile } from "@/lib/text";
import { ROLE_LABEL, SELLER_ACTION_LABEL, SELLER_TALUK_EDITABLE } from "@/lib/status";
import { fmtDay } from "@/lib/event";
import { canAssign, fmtSlot } from "@/lib/training";
import Link from "next/link";
import { Alert, Badge, ButtonLink, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { SellerBadge } from "./seller-badge";
import { ExportCredentials, ProfileDetails } from "./profile-summary";
import { BYPASS_OPTIONS, FINAL_OPTIONS, INITIAL_OPTIONS, SellerDecision, TALUK_OPTIONS } from "./seller-decision";
import { cn } from "@/lib/cn";

const DONE: Record<string, string> = {
  registered: "Seller registered and a temporary login e-mailed. The taluk office now verifies and recommends the seller.",
  updated: "Details updated.",
  recommended: "Saved and recommended to the Directorate.",
};

export async function SellerDetailPage({ user, id, base, done }: { user: User; id: string; base: string; done?: string }) {
  const s = await prisma.seller.findFirst({
    where: { AND: [{ id }, sellerScope(user)] },
    include: {
      products: { orderBy: { sortOrder: "asc" }, include: { sector: true } },
      logs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { displayName: true } } } },
      user: { select: { username: true, lastLoginAt: true } },
      createdBy: { select: { displayName: true } },
      batches: { orderBy: { assignedAt: "desc" }, include: { batch: true } },
    },
  });
  if (!s) notFound();
  const lastReturn = s.logs.find((l) => l.action === "RETURNED");
  const lastSentBack = s.logs.find((l) => l.action === "SENT_TO_SELLER");
  const editable = (user.role === "DISTRICT" || user.role === "TALUK") && SELLER_TALUK_EDITABLE.includes(s.status);
  const talukCan = user.role === "TALUK" && SELLER_TALUK_EDITABLE.includes(s.status);
  const dicStage = user.role !== "DIC" ? null : s.status === "RECOMMENDED" ? "initial" : s.status === "TRAINED" ? "final" : s.status === "INITIAL_APPROVED" ? "bypass" : null;
  const absent = s.batches.some((m) => m.attendance === "ABSENT");
  const pendingSession = s.batches.find((m) => m.attendance === "PENDING");
  const next = user.role === "TALUK" || user.role === "DIC"
    ? await prisma.seller.findFirst({ where: { AND: [sellerWhere(user, { status: "action" }), { id: { not: s.id } }] }, orderBy: { updatedAt: "asc" }, select: { id: true } })
    : null;
  const nav = { next: next ? `${base}/${next.id}` : null, list: `${base}?status=action`, listLabel: "Needs my action" };

  return (
    <>
      <PageHeader
        back={backFor(base, "Back to sellers")}
        eyebrow={<>{s.regNo}{s.approvedNo && <> · <span className="text-brand-700">{s.approvedNo}</span></>}</>}
        title={s.name}
        subtitle={`${s.district} · ${s.taluk} · ${s.udyamNo}`}
        actions={<><SellerBadge status={s.status} /><DownloadButtons href={`/api/reports/seller-profile?sellerId=${s.id}`} label="Seller profile" compact /></>}
      />
      {done && DONE[done] && <Alert tone="green" className="mb-6">{DONE[done]}</Alert>}
      {s.status === "RETURNED" && lastReturn?.comment && (
        <Alert tone="red" className="mb-6" title="Returned by the Directorate">{lastReturn.comment}</Alert>
      )}
      {s.status === "WITH_SELLER" && (
        <Alert tone="blue" className="mb-6" title={`With the applicant for correction${lastSentBack ? ` since ${fmtDateTime(lastSentBack.createdAt)}` : ""}`}>
          {lastSentBack?.comment && <>&ldquo;{lastSentBack.comment}&rdquo; </>}
          The applicant corrects the details with their login ({s.user?.username ?? "—"}); the registration comes back to the district centre when they resubmit.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Enterprise details"
              action={editable ? <ButtonLink href={`${base}/${s.id}/edit`} variant="secondary" className="px-3 py-2"><Pencil className="size-4" /> Edit</ButtonLink> : undefined} />
            <div className="p-6">
              <DL cols={3} items={[
                { label: "Name of the seller", value: s.name },
                { label: "Udyam number", value: <span className="font-mono">{s.udyamNo}</span> },
                { label: "Export experience", value: s.exportExperience ? <Badge tone="green">Yes</Badge> : <Badge tone="slate">No</Badge> },
                { label: "District", value: s.district },
                { label: "Taluk", value: s.taluk },
                { label: "Local body", value: `${s.localBodyName} ${localBodyLabel(s.localBodyType)}` },
              ]} />
              <div className="mt-5 border-t border-slate-100 pt-5"><ExportCredentials s={s} /></div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Promoter details" />
            <div className="p-6">
              <DL cols={2} items={[
                { label: "Name of the promoter", value: s.contactName },
                { label: "E-mail ID", value: <a href={`mailto:${s.contactEmail}`} className="text-brand-700 hover:underline">{s.contactEmail}</a> },
                { label: "Mobile number", value: fmtMobile(s.contactMobile) },
                { label: "WhatsApp number", value: fmtMobile(s.contactWhatsapp) },
              ]} />
            </div>
          </Card>
          {s.status === "APPROVED" && (
            <Card>
              <CardHeader title="Seller profile" subtitle="Promoter and unit details completed by the seller after approval."
                action={s.profileCompletedAt ? <Badge tone="green">Completed</Badge> : <Badge tone="amber">Pending with seller</Badge>} />
              <div className="p-6">
                {s.profileCompletedAt ? <ProfileDetails s={s} personal={user.role !== "FIEO"} />
                  : <p className="text-sm text-slate-500">The seller has not completed the profile yet (gender, date of birth, social category, specially abled, block, constitution, category and type of unit). It is asked for on the seller&apos;s dashboard.</p>}
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title={`Sectors & products ready to export (${s.products.length})`} />
            <ul className="divide-y divide-slate-100">
              {s.products.map((p) => (
                <li key={p.id} className="grid gap-1 px-6 py-4 sm:grid-cols-[240px_1fr]">
                  <div className="font-semibold text-ink">{p.sector.name}</div>
                  <div className="text-sm text-slate-700">{p.products}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Registration" />
            <div className="p-6">
              <DL cols={3} items={[
                { label: "Source", value: s.source === "SELF" ? "Self-registered on the portal" : s.source === "BULK" ? "Bulk upload by district office" : "Entered by district office" },
                { label: "Registered on", value: fmtDateTime(s.createdAt) },
                { label: "Recommended on", value: fmtDateTime(s.recommendedAt) },
                { label: "Initially approved on", value: fmtDateTime(s.initialApprovedAt) },
                { label: "Session attended on", value: fmtDateTime(s.trainedAt) },
                { label: "Final approval on", value: s.approvedAt ? <>{fmtDateTime(s.approvedAt)}{s.bypassed && <Badge tone="violet" className="ml-2">Without session</Badge>}</> : "—" },
                { label: "Login", value: s.user ? <><span className="font-mono">{s.user.username}</span>{s.status !== "APPROVED" && <span className="text-slate-500"> (temporary — until final approval)</span>}</> : "Allotted on approval" },
                { label: "Last login", value: s.user ? fmtDateTime(s.user.lastLoginAt) : "—" },
              ]} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {(user.role === "TALUK" || user.role === "DIC") && (
            <Card className={cn("no-print p-5", (talukCan || dicStage) && "border-brand-200 ring-2 ring-brand-100")}>
              {talukCan ? (
                <SellerDecision sellerId={s.id} options={TALUK_OPTIONS} nav={nav}
                  heading={s.status === "RETURNED" ? "Correct and recommend again" : "Taluk verification"}
                  note="Verify the Udyam number, IEC number, certifications and promoter details. Use Edit to correct the details yourself." />
              ) : dicStage === "initial" ? (
                <SellerDecision sellerId={s.id} options={INITIAL_OPTIONS} nav={nav} heading="Initial approval"
                  note="Initially approved sellers are placed in an awareness session. Final approval and the permanent login follow attendance." />
              ) : dicStage === "final" ? (
                <SellerDecision sellerId={s.id} options={FINAL_OPTIONS} nav={nav} heading="Final approval"
                  note="The seller attended the awareness session. Final approval allots the seller number and the permanent login." />
              ) : dicStage === "bypass" ? (
                <SellerDecision sellerId={s.id} options={BYPASS_OPTIONS} nav={nav} heading={absent ? "Absent from the awareness session" : "Awaiting the awareness session"}
                  note={`${absent ? "The seller can be placed in another session, or" : "Case by case, the seller can"} be given final approval without attending. A comment giving the reason is required.`} />
              ) : (
                <SellerDecision sellerId={s.id} options={[]} heading="No action pending" note="This seller is not at a stage that needs your decision." />
              )}
            </Card>
          )}
          {(s.batches.length > 0 || s.status === "INITIAL_APPROVED") && (
            <Card>
              <CardHeader title="Awareness session" subtitle={s.status === "INITIAL_APPROVED" && !pendingSession ? "Not yet placed in a session." : undefined}
                action={s.status === "INITIAL_APPROVED" && canAssign(user.role) ? <Link href={base.replace(/\/sellers$/, "/batches")} className="text-sm font-semibold text-brand-700 hover:underline">{pendingSession ? "Move" : "Place in a session"} →</Link> : undefined} />
              {s.batches.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {s.batches.map((m) => (
                    <li key={m.id} className="px-5 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{m.batch.name}</span>
                        <Badge tone={m.attendance === "PRESENT" ? "green" : m.attendance === "ABSENT" ? "red" : "blue"}>{m.attendance === "PRESENT" ? "Present" : m.attendance === "ABSENT" ? "Absent" : "Scheduled"}</Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">{fmtDay(m.batch.date)}, {fmtSlot(m.batch.startTime, m.batch.endTime)} · {m.batch.venue}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          <Card>
            <CardHeader title="Activity & comments" />
            <ol className="relative space-y-5 border-l border-slate-200 p-5 pl-10">
              {s.logs.map((l) => (
                <li key={l.id} className="relative">
                  <span className={cn("absolute -left-[26px] top-1 size-3 rounded-full ring-4 ring-white",
                    l.action === "APPROVED" || l.action === "BYPASSED" || l.action === "ATTENDED" ? "bg-tx-green" : l.action === "RETURNED" || l.action === "REJECTED" || l.action === "ABSENT" || l.action === "NOT_RECOMMENDED" ? "bg-tx-red" : l.action === "RECOMMENDED" || l.action === "INITIAL_APPROVED" ? "bg-violet-500" : "bg-tx-blue")} />
                  <div className="text-sm font-semibold text-ink">{SELLER_ACTION_LABEL[l.action]}</div>
                  <div className="text-xs text-slate-500">
                    {l.actorRole ? `${ROLE_LABEL[l.actorRole]}${l.actor ? ` · ${l.actor.displayName}` : ""}` : "Seller"} · {fmtDateTime(l.createdAt)}
                  </div>
                  {l.comment && <blockquote className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{l.comment}</blockquote>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
