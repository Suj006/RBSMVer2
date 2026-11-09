import type { Metadata } from "next";
import { BuyerMatches } from "@/components/match/my-matches";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock, AlertTriangle, Plus, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/auth";
import { UnreadBanner } from "@/components/comms/unread-banner";
import { Alert, Badge, ButtonLink, Card, CardHeader, DL, PageHeader } from "@/components/ui";
import { JourneyStepper } from "@/components/journey";
import { Timeline } from "@/components/timeline";
import { StatusBadge } from "@/components/status-badge";
import { EVENT } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { ITEM_META } from "@/lib/status";
import type { BuyerStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Buyer dashboard" };

type Step = { title: string; body: string; href?: string; cta?: string; tone: "blue" | "amber" | "red" | "green" };

const BASIC_STEP: Partial<Record<BuyerStatus, Step>> = {
  SIGNED_UP: { title: "Complete and submit your application", body: "Fill in your basic details and documents, your sourcing profile and at least one sector requirement, then submit everything to FIEO in one step.", href: "/buyer/application", cta: "Open my application", tone: "blue" },
  BASIC_RETURNED: { title: "Application needs correction", body: "FIEO has returned your application. Please review the comment, update and submit again.", href: "/buyer/application", cta: "Update application", tone: "red" },
  BASIC_SUBMITTED: { title: "Under FIEO verification", body: "Your application is with FIEO. You'll receive an e-mail once FIEO has reviewed it.", tone: "amber" },
};

export default async function BuyerDashboard() {
  const { buyer: b, user } = await requireBuyer();
  const [logs, requirement, docs] = await Promise.all([
    prisma.reviewLog.findMany({ where: { buyerId: b.id }, orderBy: { createdAt: "desc" }, include: { actor: { select: { displayName: true } } } }),
    prisma.requirement.findUnique({ where: { buyerId: b.id }, include: { items: { orderBy: { sortOrder: "asc" }, include: { sector: true } } } }),
    prisma.document.count({ where: { buyerId: b.id, pending: false } }),
  ]);
  // Buyers see only comments addressed to them (not internal FIEO ↔ DIC notes).
  const visibleLogs = logs.map((l) => (l.action === "DIC_RETURNED" || l.action === "FIEO_RECOMMENDED" || l.action === "DIC_APPROVED" ? { ...l, comment: null } : l));
  const lastBasicReturn = logs.find((l) => l.action === "BASIC_RETURNED");
  const items = requirement?.items ?? [];
  const n = (...s: (keyof typeof ITEM_META)[]) => items.filter((i) => s.includes(i.status)).length;

  const step: Step = BASIC_STEP[b.status] ?? (
    b.changeState === "RETURNED" ? { title: "Change to your details returned", body: "FIEO has returned the change you asked for in your basic details or sourcing profile. Review the comment, correct it and send it again.", href: "/buyer/application", cta: "Review change", tone: "red" }
    : n("FIEO_RETURNED", "FIEO_REJECTED") ? { title: `${n("FIEO_RETURNED", "FIEO_REJECTED")} sector${n("FIEO_RETURNED", "FIEO_REJECTED") > 1 ? "s" : ""} returned or rejected by FIEO`, body: "Review FIEO's comments, edit these sectors and submit them again. Other sectors are not affected.", href: "/buyer/application#sectors", cta: "Update sectors", tone: "red" }
    : n("DRAFT") ? { title: `${n("DRAFT")} draft sector${n("DRAFT") > 1 ? "s" : ""} not yet submitted`, body: "Submit your draft sector requirements to FIEO for verification.", href: "/buyer/application#sectors", cta: "Review and submit", tone: "blue" }
    : !items.length ? { title: "Add your sector requirements", body: "Tell us which sectors and products you want to source — each sector is verified by FIEO and approved by the Directorate.", href: "/buyer/application#sectors", cta: "Add requirements", tone: "blue" }
    : n("SUBMITTED", "FIEO_RECOMMENDED", "DIC_RETURNED") ? { title: `${n("SUBMITTED", "FIEO_RECOMMENDED", "DIC_RETURNED")} sector${n("SUBMITTED", "FIEO_RECOMMENDED", "DIC_RETURNED") > 1 ? "s" : ""} under review`, body: b.status === "APPROVED" ? "You are an approved buyer. The sectors below are being reviewed; you'll be notified by e-mail." : "Your sector requirements are with FIEO and the Directorate. You'll be notified by e-mail.", tone: "amber" }
    : { title: "You are an approved RBSM buyer", body: "All your sectors are approved. You can add new sectors or modify approved ones at any time — changes go through FIEO and the Directorate again. Changes to your basic details and sourcing profile are verified by FIEO.", href: "/buyer/application", cta: "Manage my application", tone: "green" }
  );
  const Icon = step.tone === "green" ? BadgeCheck : step.tone === "red" ? AlertTriangle : step.href ? ArrowRight : Clock;

  return (
    <>
      <PageHeader
        eyebrow={`${EVENT.name} · ${EVENT.short}`}
        title={`Welcome, ${b.name}`}
        subtitle={<>Registration no. <span className="font-semibold text-ink">{b.regNo}</span>{b.approvedNo && <> · Buyer no. <span className="font-semibold text-brand-700">{b.approvedNo}</span></>}</>}
        actions={<StatusBadge status={b.status} />}
      />
      <UnreadBanner user={user} href="/buyer/messages" />
      {b.status !== "APPROVED" && b.source !== "SELF" && (
        <Alert tone="amber" className="mb-6" title={`Temporary login: ${user.username}`}>
          {<>FIEO has registered your organisation and entered your basic details{b.recommendedAt ? " and sector requirements (now with the Directorate)" : ""}. Please check them and add any further sector requirements. </>}
          This login becomes your permanent {EVENT.short} login as soon as the Directorate approves your registration.
        </Alert>
      )}

      <Card className="mb-6 p-5 sm:p-6"><JourneyStepper status={b.status} /></Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-6" /></div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-ink">{step.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{step.body}</p>
              </div>
              {step.href && <ButtonLink href={step.href}>{step.cta} <ArrowRight className="size-4" /></ButtonLink>}
            </div>
            {b.status === "BASIC_RETURNED" && lastBasicReturn?.comment && (
              <div className="border-t border-slate-100 px-6 py-4">
                <Alert tone="red" title="Comment from FIEO">{lastBasicReturn.comment}</Alert>
              </div>
            )}
          </Card>

          {items.length > 0 && (
            <Card>
              <CardHeader title="My sectors" subtitle="Approval status of each sector requirement"
                action={<Link href="/buyer/application#sectors" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><Plus className="size-4" /> Add / modify</Link>} />
              <ul className="divide-y divide-slate-100">
                {items.map((i) => (
                  <li key={i.id}>
                    <Link href={`/buyer/application#item-${i.id}`} className="group flex flex-wrap items-center justify-between gap-2 px-6 py-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink group-hover:text-brand-700">{i.sector.name}</div>
                        <div className="truncate text-xs text-slate-500">{i.products}</div>
                      </div>
                      <span className="inline-flex items-center gap-2">
                        <Badge tone={ITEM_META[i.status].tone}>{ITEM_META[i.status].label}</Badge>
                        <ChevronRight className="size-4 text-slate-400 group-hover:text-brand-700" />
                      </span>
                    </Link>
                  </li>
                ))}
                {!items.length && <li className="px-6 py-6 text-sm text-slate-500">No sectors added yet.</li>}
              </ul>
            </Card>
          )}

          {b.status === "APPROVED" && <BuyerMatches buyerId={b.id} />}

          <Card>
            <CardHeader title="Registration summary" />
            <div className="p-6">
              <DL cols={3} items={[
                { label: "Country", value: b.country },
                { label: "Point of contact", value: b.pocName && `${b.pocName}${b.pocDesignation ? `, ${b.pocDesignation}` : ""}` },
                { label: "Contact e-mail", value: b.pocEmail ?? b.signupEmail },
                { label: "Documents uploaded", value: `${docs} of 2` },
                { label: "Approved sectors", value: `${n("APPROVED")} of ${items.length}` },
                { label: "Registered on", value: fmtDate(b.createdAt) },
              ]} />
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Activity" />
          <div className="max-h-[560px] overflow-y-auto p-6 pb-8 [mask-image:linear-gradient(to_bottom,black_88%,transparent)]"><Timeline logs={visibleLogs} /></div>
        </Card>
      </div>
    </>
  );
}
