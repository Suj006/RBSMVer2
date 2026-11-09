import type { Metadata } from "next";
import { Clock, Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBuyer } from "@/lib/auth";
import { Alert, Card, CardHeader, DL } from "@/components/ui";
import { PageHeader } from "@/components/ui";
import { BasicForm } from "@/components/buyer/basic-form";
import { ProfileForm } from "@/components/buyer/profile-form";
import { RequirementBoard } from "@/components/buyer/requirement-board";
import { ChangeToggle, SubmitApplication, WithdrawChange } from "@/components/buyer/application";
import { ChangeView } from "@/components/change-view";
import { DocLink } from "@/components/doc-link";
import { StatusBadge } from "@/components/status-badge";
import { canEditApplication, canRequestChange, canSubmitItems, ROLE_LABEL } from "@/lib/status";
import { ACCEPT_ATTR } from "@/lib/storage";
import { fmtDateTime, parseCerts } from "@/lib/format";
import { parseChange, type BasicFields, type ProfileFields } from "@/lib/buyer-change";

export const metadata: Metadata = { title: "My application" };

const Section = ({ id, n, title, note, children }: { id: string; n: number; title: string; note?: React.ReactNode; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24 space-y-4">
    <div>
      <h2 className="text-lg font-bold text-ink">{n}. {title}</h2>
      {note && <p className="text-sm text-slate-500">{note}</p>}
    </div>
    {children}
  </section>
);

export default async function ApplicationPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { buyer: b } = await requireBuyer();
  const { welcome } = await searchParams;
  const [docList, req, sectors, certs, basicLog] = await Promise.all([
    prisma.document.findMany({ where: { buyerId: b.id } }),
    prisma.requirement.findUnique({
      where: { buyerId: b.id },
      include: { items: { orderBy: { sortOrder: "asc" }, include: { sector: true,
        // Latest comment addressed to the buyer (FIEO returns and rejections only).
        reviewLogs: { where: { action: { in: ["REQ_RETURNED", "REQ_REJECTED"] } }, orderBy: { createdAt: "desc" }, take: 1 } } } },
    }),
    prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.certification.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
    // FIEO's comment on the basic details (when verifying the application) or an earlier return.
    prisma.reviewLog.findFirst({ where: { buyerId: b.id, actorRole: "FIEO", action: { in: ["BASIC_APPROVED", "BASIC_RETURNED"] }, comment: { not: null } }, orderBy: { createdAt: "desc" } }),
  ]);
  for (const it of req?.items ?? []) {
    if (!sectors.some((s) => s.id === it.sectorId)) sectors.push({ id: it.sector.id, name: `${it.sector.name} (inactive)` });
  }

  const draft = canEditApplication(b.status);
  const verified = canRequestChange(b.status);
  const withFieo = b.status === "BASIC_SUBMITTED";
  const docs = (pending: boolean) => ({
    PROFILE: docList.find((d) => d.kind === "PROFILE" && d.pending === pending) ?? null,
    CREDENTIALS: docList.find((d) => d.kind === "CREDENTIALS" && d.pending === pending) ?? null,
  });
  const verifiedDocs = docs(false);
  const pendingDocs = docList.filter((d) => d.pending);
  const change = parseChange(b.pendingChange);
  const basic: BasicFields = { name: b.name, country: b.country, pocName: b.pocName ?? "", pocDesignation: b.pocDesignation ?? "", pocEmail: b.pocEmail ?? "", pocMobile: b.pocMobile ?? "" };
  const profile: ProfileFields = { organisationType: req?.organisationType ?? null, annualSourcingValue: req?.annualSourcingValue ?? null, sourcingTimeline: req?.sourcingTimeline ?? null, preferredEngagement: req?.preferredEngagement ?? null };
  const profileComplete = Boolean(profile.organisationType && profile.annualSourcingValue && profile.sourcingTimeline);
  const items = req?.items ?? [];
  const formProfile = (p: ProfileFields) => ({ organisationType: p.organisationType ?? "", procurementInterests: req?.procurementInterests ?? "", annualSourcingValue: p.annualSourcingValue ?? "", sourcingTimeline: p.sourcingTimeline ?? "", preferredEngagement: p.preferredEngagement ?? "" });

  const basicView = (
    <Card>
      <CardHeader title="Basic details and documents" icon={<Lock className="size-4" />}
        subtitle={withFieo ? "With FIEO for verification — locked while under review." : `Verified by FIEO${b.basicApprovedAt ? ` on ${fmtDateTime(b.basicApprovedAt)}` : ""}.`} />
      <div className="space-y-6 p-6">
        <DL items={[
          { label: "Name of the buyer", value: b.name }, { label: "Country", value: b.country },
          { label: "Contact name", value: b.pocName }, { label: "Designation", value: b.pocDesignation },
          { label: "E-mail ID", value: b.pocEmail }, { label: "Mobile number", value: b.pocMobile },
        ]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Company profile</div><DocLink doc={verifiedDocs.PROFILE} /></div>
          <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Organisation credentials</div><DocLink doc={verifiedDocs.CREDENTIALS} /></div>
        </div>
      </div>
    </Card>
  );
  const profileView = (
    <Card>
      <CardHeader title="Sourcing profile" icon={<Lock className="size-4" />} subtitle={withFieo ? "With FIEO for verification." : "Verified by FIEO."} />
      <div className="p-6">
        <DL cols={2} items={[
          { label: "Organisation type", value: profile.organisationType }, { label: "Indicative annual sourcing value", value: profile.annualSourcingValue },
          { label: "Sourcing timeline", value: profile.sourcingTimeline }, { label: "Preferred engagement", value: profile.preferredEngagement },
        ]} />
      </div>
    </Card>
  );

  return (
    <>
      <PageHeader back={{ href: "/buyer", label: "Back to dashboard" }} eyebrow={b.regNo} title="My application"
        subtitle={draft
          ? "Fill in all sections, then submit your application to FIEO in one step."
          : "FIEO verifies your application; each sector FIEO approves then goes to the Directorate."}
        actions={<StatusBadge status={b.status} />} />
      {welcome && draft && <Alert tone="green" className="mb-6" title="Password changed">Now complete your application and submit it to FIEO.</Alert>}
      {withFieo && <Alert tone="amber" className="mb-6" title="Under FIEO verification">Your application was submitted{b.basicSubmittedAt ? ` on ${fmtDateTime(b.basicSubmittedAt)}` : ""}. You will be notified by e-mail.</Alert>}
      {basicLog?.comment && !(basicLog.action === "BASIC_RETURNED" && !draft) && (
        <Alert tone={basicLog.action === "BASIC_RETURNED" ? "red" : "blue"} className="mb-6" title="Comment from FIEO on your basic details">{basicLog.comment}</Alert>
      )}

      <div className="space-y-10">
        {b.changeState && (
          <Card className={b.changeState === "RETURNED" ? "ring-2 ring-red-200" : "ring-2 ring-amber-200"}>
            <CardHeader icon={<Clock className="size-4" />}
              title={b.changeState === "SUBMITTED" ? "Change awaiting FIEO verification" : "Change returned by FIEO"}
              subtitle={b.changeState === "SUBMITTED"
                ? "Your verified details stay in use until FIEO verifies this change."
                : "Correct the change below and send it again, or withdraw it."}
              action={<WithdrawChange />} />
            <div className="space-y-4 p-6">
              {b.changeState === "RETURNED" && change.comment && <Alert tone="red" title="Comment from FIEO">{change.comment}</Alert>}
              <ChangeView change={change} basic={basic} profile={profile} pendingDocs={pendingDocs} />
            </div>
          </Card>
        )}

        <Section id="basic" n={1} title="Basic details and documents" note={verified ? "Changes are verified by FIEO before they take effect." : undefined}>
          {draft ? (
            <BasicForm buyer={basic} docs={verifiedDocs} accept={ACCEPT_ATTR} />
          ) : verified ? (
            <ChangeToggle label="Request a change" view={basicView}
              form={<BasicForm mode="change" buyer={change.basic ?? basic} docs={{ PROFILE: docs(true).PROFILE ?? verifiedDocs.PROFILE, CREDENTIALS: docs(true).CREDENTIALS ?? verifiedDocs.CREDENTIALS }} accept={ACCEPT_ATTR} />} />
          ) : basicView}
        </Section>

        <Section id="profile" n={2} title="Sourcing profile" note={verified && profileComplete ? "Changes are verified by FIEO before they take effect." : undefined}>
          {draft || (verified && !profileComplete) ? (
            <ProfileForm profile={formProfile(profile)} complete={profileComplete} />
          ) : verified ? (
            <ChangeToggle label="Request a change" view={profileView}
              form={<ProfileForm mode="change" profile={formProfile(change.profile ?? profile)} complete />} />
          ) : profileView}
        </Section>

        <Section id="sectors" n={3} title="Sector requirements" note="At least one sector is required.">
          <RequirementBoard
            canSubmit={canSubmitItems(b.status)}
            locked={withFieo}
            profileComplete={profileComplete}
            sectors={sectors}
            certifications={certs.map((c) => c.name)}
            items={items.map((i) => ({
              id: i.id, sectorId: i.sectorId, sectorName: i.sector.name, status: i.status, everApproved: i.everApproved,
              products: i.products, specifications: i.specifications ?? "", certifications: parseCerts(i.certifications), quantity: i.quantity ?? "",
              lastComment: i.reviewLogs[0]?.comment ? { text: i.reviewLogs[0].comment, by: ROLE_LABEL[i.reviewLogs[0].actorRole] } : null,
            }))}
          />
        </Section>

        {draft && (
          <SubmitApplication checks={[
            { label: "Basic details and point of contact", done: Boolean(b.pocName && b.pocDesignation && b.pocEmail && b.pocMobile) },
            { label: "Company profile and organisation credentials uploaded", done: Boolean(verifiedDocs.PROFILE && verifiedDocs.CREDENTIALS) },
            { label: "Sourcing profile completed", done: profileComplete },
            { label: `At least one sector requirement (${items.length} added)`, done: items.length > 0 },
          ]} />
        )}
      </div>
    </>
  );
}
