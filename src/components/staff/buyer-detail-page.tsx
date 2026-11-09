import { notFound } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { actionWhere, itemScope, scopeFor } from "@/lib/buyer-query";
import { backFor } from "@/components/nav/back-target";
import { Alert, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { DIC_ITEM_QUEUE, FIEO_ITEM_QUEUE } from "@/lib/status";
import { JourneyStepper } from "@/components/journey";
import { Timeline } from "@/components/timeline";
import { DocLink } from "@/components/doc-link";
import { SourcingProfileView } from "@/components/requirement-view";
import { DownloadButtons } from "./download-buttons";
import { ReviewPanel } from "./review-panel";
import { ItemReview } from "./item-review";
import { fmtDateTime, parseCerts } from "@/lib/format";
import { parseSnapshot, type ItemSnapshot, type ProfileSnapshot } from "@/lib/item-snapshot";
import { CountryTag, Flag } from "@/components/ids";
import { ChangeView } from "@/components/change-view";
import { parseChange } from "@/lib/buyer-change";

/** Approved sectors being modified compare with the approved version; returned ones with what FIEO returned. */
function baselineFor(i: { status: string; approvedSnapshot: string | null; returnedSnapshot: string | null }) {
  if (i.status === "APPROVED") return null;
  const approved = parseSnapshot<ItemSnapshot>(i.approvedSnapshot);
  if (approved) return { label: "approved version" as const, snap: approved };
  const returned = parseSnapshot<ItemSnapshot>(i.returnedSnapshot);
  return returned ? { label: "version FIEO returned or rejected" as const, snap: returned } : null;
}

export async function BuyerDetailPage({ role, id, base, extra }: { role: Role; id: string; base: string; extra?: (buyerId: string) => React.ReactNode }) {
  const b = await prisma.buyer.findFirst({
    where: { AND: [{ id }, scopeFor(role)] },
    include: {
      createdBy: { select: { displayName: true } },
      user: { select: { username: true, lastLoginAt: true } },
      documents: true,
      requirement: {
        include: {
          items: {
            where: itemScope(role),
            orderBy: { sortOrder: "asc" },
            include: { sector: true, reviewLogs: { orderBy: { createdAt: "desc" } } },
          },
        },
      },
      reviewLogs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { displayName: true } } } },
    },
  });
  if (!b) notFound();
  const doc = (k: "PROFILE" | "CREDENTIALS") => b.documents.find((d) => d.kind === k && !d.pending) ?? null;
  // FIEO verifies the basic details as part of its first review of the submitted application.
  const basicPending = role === "FIEO" && b.status === "BASIC_SUBMITTED";
  const changePending = role === "FIEO" && b.changeState === "SUBMITTED";
  const change = parseChange(b.pendingChange);
  const req = b.requirement;
  const queue = role === "FIEO" ? FIEO_ITEM_QUEUE : role === "DIC" ? DIC_ITEM_QUEUE : [];
  const pendingItems = (b.requirement?.items ?? []).filter((i) => queue.includes(i.status)).length;
  const next = role === "FIEO" || role === "DIC"
    ? await prisma.buyer.findFirst({ where: { AND: [actionWhere(role), { id: { not: b.id } }] }, orderBy: { updatedAt: "asc" }, select: { id: true } })
    : null;
  const nav = { next: next ? `${base}/${next.id}` : null, list: `${base}?status=action`, listLabel: "Waiting for my decision" };

  return (
    <>
      <PageHeader
        back={backFor(base, "Back to buyers")}
        eyebrow={<>{b.regNo}{b.approvedNo && <> · <span className="text-brand-700">{b.approvedNo}</span></>}</>}
        title={<span className="inline-flex items-center gap-2"><Flag country={b.country} /> {b.name}</span>}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><CountryTag country={b.country} name flag={false} /> · Login <span className="font-mono">{b.user.username}</span>
          {b.source !== "SELF" && <span className={b.status === "APPROVED" ? "rounded bg-brand-50 px-1.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200" : "rounded bg-amber-50 px-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"}>{b.status === "APPROVED" ? "permanent" : "temporary until approval"}</span>}
          · {b.source === "SELF" ? "Signed up on the portal" : `${b.source === "BULK" ? "Bulk upload" : "Added"} by FIEO${b.createdBy ? ` (${b.createdBy.displayName})` : ""}`}</span>}
        actions={<><StatusBadge status={b.status} /><DownloadButtons href={`/api/reports/buyer-profile?buyerId=${b.id}`} label="Buyer profile" compact /></>}
      />
      {(basicPending || changePending || pendingItems > 0) && (
        // On phones the decision panels sit below the long details; offer a shortcut.
        <a href={changePending && !basicPending && !pendingItems ? "#change" : "#sectors"}
          className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 lg:hidden">
          {changePending && !basicPending && !pendingItems ? "Go to the requested change" : basicPending ? "Go to the application review" : `Go to the ${pendingItems} sector${pendingItems > 1 ? "s" : ""} to decide`}
          <span aria-hidden>↓</span>
        </a>
      )}
      <Card className="mb-6 p-5 sm:p-6"><JourneyStepper status={b.status} /></Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Basic details" subtitle={b.basicApprovedAt ? `Verified by FIEO ${fmtDateTime(b.basicApprovedAt)}` : b.basicSubmittedAt ? `Application submitted ${fmtDateTime(b.basicSubmittedAt)} — verified with FIEO's review below` : "Application not yet submitted"} />
            <div className="space-y-6 p-6">
              <DL cols={3} items={[
                { label: "Name of the buyer", value: b.name },
                { label: "Country", value: b.country },
                { label: "Sign-up e-mail", value: b.signupEmail },
                { label: "Contact person", value: b.pocName },
                { label: "Designation", value: b.pocDesignation },
                { label: "Contact e-mail", value: b.pocEmail },
                { label: "Mobile number", value: b.pocMobile },
                { label: "Registered on", value: fmtDateTime(b.createdAt) },
                { label: "Last login", value: fmtDateTime(b.user.lastLoginAt) },
              ]} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Company profile</div><DocLink doc={doc("PROFILE")} /></div>
                <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Organisation credentials</div><DocLink doc={doc("CREDENTIALS")} /></div>
              </div>
            </div>
          </Card>
          {b.requirement ? <SourcingProfileView req={b.requirement} before={parseSnapshot<ProfileSnapshot>(b.requirement.approvedProfile)} /> : <Alert tone="slate">The buyer has not started the detailed requirement yet.</Alert>}
        </div>

        <div className="space-y-6">
          {b.changeState && (
            // A verified buyer's change to basic details / documents / sourcing profile: FIEO verifies it.
            <Card id="change" className={changePending ? "no-print scroll-mt-24 border-amber-200 p-5 ring-2 ring-amber-100" : "no-print scroll-mt-24 p-5"}>
              <div className="mb-4 space-y-3">
                <div className="font-bold text-ink">{b.changeState === "SUBMITTED" ? "Change requested by the buyer" : "Change returned to the buyer"}</div>
                <p className="text-sm text-slate-500">{b.changeState === "SUBMITTED"
                  ? `Sent ${fmtDateTime(b.changeAt)}. The verified details stay in use until FIEO verifies the change.`
                  : "Waiting for the buyer to correct and resend it."}</p>
                {b.changeState === "RETURNED" && change.comment && <Alert tone="red" title="FIEO's comment">{change.comment}</Alert>}
                <ChangeView change={change}
                  basic={{ name: b.name, country: b.country, pocName: b.pocName ?? "", pocDesignation: b.pocDesignation ?? "", pocEmail: b.pocEmail ?? "", pocMobile: b.pocMobile ?? "" }}
                  profile={{ organisationType: req?.organisationType ?? null, annualSourcingValue: req?.annualSourcingValue ?? null, sourcingTimeline: req?.sourcingTimeline ?? null, preferredEngagement: req?.preferredEngagement ?? null }}
                  pendingDocs={b.documents.filter((d) => d.pending)} />
              </div>
              {changePending && (
                <ReviewPanel buyerId={b.id} nav={nav} heading="Verify the change"
                  note="Verifying puts the new details in use. Returning keeps the verified details and sends the change back to the buyer."
                  actions={[
                    { decision: "approve_change", label: "Verify change", variant: "success", needsComment: false },
                    { decision: "return_change", label: "Return change to buyer", variant: "danger", needsComment: true },
                  ]} />
              )}
            </Card>
          )}
          {extra?.(b.id)}
          <Card>
            <CardHeader title="Activity & comments" />
            <div className="max-h-[560px] overflow-y-auto p-5 pb-8 [mask-image:linear-gradient(to_bottom,black_88%,transparent)]"><Timeline logs={b.reviewLogs} /></div>
          </Card>
        </div>
      </div>

      <div id="sectors" className="mt-8 scroll-mt-24">
        <ItemReview
          buyerId={b.id}
          nav={nav}
          role={role}
          basicPending={basicPending}
          items={(b.requirement?.items ?? []).map((i) => ({
            id: i.id, sectorId: i.sectorId, sectorName: i.sector.name, status: i.status, everApproved: i.everApproved,
            baseline: baselineFor(i),
            products: i.products, specifications: i.specifications, certifications: parseCerts(i.certifications), quantity: i.quantity,
            history: i.reviewLogs.map((l) => ({ id: l.id, action: l.action, actorRole: l.actorRole, comment: l.comment, at: fmtDateTime(l.createdAt) })),
          }))}
        />
      </div>
    </>
  );
}
