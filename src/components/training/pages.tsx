import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronRight, GraduationCap, MapPin } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DISTRICT_NAMES } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { fmtDay } from "@/lib/event";
import { fmtMobile } from "@/lib/text";
import { SELLER_META } from "@/lib/status";
import { awaitingSession, canAssign, fmtSlot, memberScope, trainingCounts } from "@/lib/training";
import { Alert, Badge, Card, CardHeader, DL, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { DownloadButtons } from "@/components/staff/download-buttons";
import { InlineForm } from "@/components/event/inline";
import { removeFromBatchAction } from "@/app/actions/training";
import { AssignPanel, AttendanceForm, BatchForm, DeleteBatch, MoveMember } from "./forms";

const DONE: Record<string, string> = { created: "Session created. Now place initially approved sellers in it.", deleted: "Session deleted." };

/** Awareness sessions: figures, the list of sessions, and (Admin) the form to create one. */
export async function BatchesPage({ user, base, sellersBase, done }: { user: User; base: string; sellersBase?: string; done?: string }) {
  const [counts, batches] = await Promise.all([
    trainingCounts(user),
    prisma.trainingBatch.findMany({
      where: user.role === "DISTRICT" ? { OR: [{ district: user.district }, { district: null }] } : {},
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { members: { where: memberScope(user), select: { attendance: true } } },
    }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const sb = sellersBase ?? null;
  return (
    <>
      <PageHeader eyebrow="Awareness sessions" title={user.role === "TRAINING" ? "Awareness sessions — attendance" : "Awareness sessions"}
        subtitle={user.role === "TRAINING"
          ? "Open a session to mark each MSME present or absent. Present MSMEs go to the Directorate for final approval."
          : "Initially approved sellers attend an awareness session before the Directorate's final approval and permanent login."}
        actions={<DownloadButtons href="/api/reports/awareness-attendance" label="Attendance report" compact />} />
      {done && DONE[done] && <Alert tone="green" className="mb-6">{DONE[done]}</Alert>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Awaiting a session" value={counts.unassigned} accent="yellow" href={sb ? `${sb}?training=unassigned` : undefined} hint="Initially approved, not yet placed" />
        <StatCard label="Placed in a session" value={counts.scheduled} accent="blue" href={sb ? `${sb}?training=scheduled` : undefined} />
        <StatCard label="Absent — to re-schedule" value={counts.absent} accent="red" href={sb ? `${sb}?training=absent` : undefined} />
        <StatCard label="Attended" value={counts.trained} accent="green" />
        <StatCard label="Approved without session" value={counts.bypassed} accent="violet" href={sb ? `${sb}?training=bypassed` : undefined} hint="Directorate, case by case" />
      </div>
      {user.role === "ADMIN" && (
        <Card className="mb-6 p-5">
          <div className="mb-3 font-bold text-ink">New awareness session</div>
          <BatchForm districts={DISTRICT_NAMES} />
        </Card>
      )}
      <Card className="overflow-hidden">
        <CardHeader title={`Sessions (${batches.length})`} icon={<GraduationCap className="size-4" />} />
        {batches.length ? (
          <ul className="divide-y divide-slate-100">
            {batches.map((b) => {
              const n = (a: string) => b.members.filter((m) => m.attendance === a).length;
              return (
                <li key={b.id}>
                  <Link href={`${base}/${b.id}`} className="group flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink group-hover:text-brand-700">{b.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> {fmtDay(b.date)}, {fmtSlot(b.startTime, b.endTime)}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {b.venue}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {b.date < today && n("PENDING") > 0 && <Badge tone="amber">Attendance to mark</Badge>}
                      <Badge tone="blue">{b.members.length} seller{b.members.length === 1 ? "" : "s"}</Badge>
                      {n("PRESENT") > 0 && <Badge tone="green">{n("PRESENT")} present</Badge>}
                      {n("ABSENT") > 0 && <Badge tone="red">{n("ABSENT")} absent</Badge>}
                      <ChevronRight className="size-4 text-slate-400 group-hover:text-brand-700" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState icon={<GraduationCap className="size-5" />} title="No sessions yet">{user.role === "ADMIN" ? "Create the first session above." : "Admin creates the awareness sessions."}</EmptyState>}
      </Card>
    </>
  );
}

/** One session: details, its sellers (with attendance), and the actions each role may take. */
export async function BatchDetailPage({ user, base, id, done }: { user: User; base: string; id: string; done?: string }) {
  const b = await prisma.trainingBatch.findUnique({
    where: { id },
    include: { members: { where: memberScope(user), orderBy: { assignedAt: "asc" }, include: { seller: true } } },
  });
  if (!b || (user.role === "DISTRICT" && b.district && b.district !== user.district)) notFound();
  const assign = canAssign(user.role);
  const [candidates, others, last] = await Promise.all([
    assign ? prisma.seller.findMany({ where: awaitingSession(user, b.district), orderBy: [{ district: "asc" }, { taluk: "asc" }, { name: "asc" }],
      include: { batches: { where: { attendance: "ABSENT" }, include: { batch: { select: { name: true } } } } } }) : [],
    assign ? prisma.trainingBatch.findMany({ where: { id: { not: b.id }, ...(user.role === "DISTRICT" ? { OR: [{ district: user.district }, { district: null }] } : {}) }, orderBy: { date: "asc" }, select: { id: true, name: true, district: true } }) : [],
    prisma.batchMember.findFirst({ where: { batchId: b.id, markedAt: { not: null } }, orderBy: { markedAt: "desc" }, select: { markedAt: true } }),
  ]);
  const n = (a: string) => b.members.filter((m) => m.attendance === a).length;
  const ATT = { PENDING: { label: "Not marked", tone: "slate" }, PRESENT: { label: "Present", tone: "green" }, ABSENT: { label: "Absent", tone: "red" } } as const;

  return (
    <>
      <PageHeader back={{ href: base, label: "Back to sessions" }} eyebrow="Awareness session" title={b.name}
        subtitle={`${fmtDay(b.date)}, ${fmtSlot(b.startTime, b.endTime)} · ${b.venue}`}
        actions={<DownloadButtons href={`/api/reports/awareness-attendance?batchId=${b.id}`} label="Attendance" compact />} />
      {done && DONE[done] && <Alert tone="green" className="mb-6">{DONE[done]}</Alert>}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Sellers" value={b.members.length} accent="blue" />
        <StatCard label="Present" value={n("PRESENT")} accent="green" />
        <StatCard label="Absent" value={n("ABSENT")} accent="red" />
        <StatCard label="Not marked" value={n("PENDING")} accent="slate" hint={last?.markedAt ? `Last marked ${fmtDateTime(last.markedAt)}` : undefined} />
      </div>

      {user.role === "ADMIN" && (
        <Card className="mb-6 p-5">
          <div className="mb-3 flex items-center justify-between gap-3"><div className="font-bold text-ink">Session details</div><DeleteBatch id={b.id} /></div>
          <BatchForm districts={DISTRICT_NAMES} batch={{ id: b.id, date: b.date, startTime: b.startTime, endTime: b.endTime, venue: b.venue, district: b.district }} />
        </Card>
      )}
      {user.role !== "ADMIN" && (
        <Card className="mb-6 p-5"><DL cols={3} items={[
          { label: "Date and time", value: `${fmtDay(b.date)}, ${fmtSlot(b.startTime, b.endTime)}` },
          { label: "Venue", value: b.venue }, { label: "District", value: b.district ?? "All districts" },
        ]} /></Card>
      )}

      {user.role === "TRAINING" ? (
        <Card className="p-5">
          <div className="mb-3 font-bold text-ink">Attendance</div>
          <AttendanceForm batchId={b.id} rows={b.members.map((m) => ({
            id: m.id, name: m.seller.name, regNo: m.seller.regNo, district: m.seller.district, taluk: m.seller.taluk, mobile: fmtMobile(m.seller.contactMobile),
            attendance: m.attendance, locked: m.seller.status !== "INITIAL_APPROVED" && m.seller.status !== "TRAINED", status: SELLER_META[m.seller.status].label,
          }))} />
        </Card>
      ) : (
        <Card className="mb-6 overflow-hidden">
          <CardHeader title={`Sellers in this session (${b.members.length})`} subtitle={user.role === "DISTRICT" ? "Your district's sellers only." : undefined} />
          {b.members.length ? (
            <div className="table-scroll overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-2">Seller</th><th className="px-3 py-2">District / Taluk</th><th className="px-3 py-2">Mobile</th><th className="px-3 py-2">Attendance</th><th className="px-3 py-2">Stage</th>{assign && <th className="px-3 py-2">Change</th>}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.members.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2"><div className="font-semibold text-ink">{m.seller.name}</div><div className="font-mono text-[11px] text-slate-500">{m.seller.regNo}</div></td>
                      <td className="px-3 py-2 text-slate-700">{m.seller.district}<div className="text-xs text-slate-500">{m.seller.taluk}</div></td>
                      <td className="px-3 py-2 text-slate-700">{fmtMobile(m.seller.contactMobile)}</td>
                      <td className="px-3 py-2"><Badge tone={ATT[m.attendance].tone}>{ATT[m.attendance].label}</Badge></td>
                      <td className="px-3 py-2 text-xs text-slate-600">{SELLER_META[m.seller.status].short}</td>
                      {assign && (
                        <td className="px-3 py-2">
                          {m.attendance === "PENDING" && m.seller.status === "INITIAL_APPROVED" ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <MoveMember sellerId={m.sellerId} batches={others.filter((o) => !o.district || o.district === m.seller.district)} />
                              <InlineForm action={removeFromBatchAction} fields={{ memberId: m.id }} label="Remove"><span /></InlineForm>
                            </div>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="p-6 text-sm text-slate-500">No sellers in this session yet.</p>}
        </Card>
      )}

      {assign && (
        <AssignPanel batchId={b.id} candidates={candidates.map((c) => ({
          id: c.id, name: c.name, regNo: c.regNo, district: c.district, taluk: c.taluk, mobile: fmtMobile(c.contactMobile),
          note: c.batches.length ? `Absent: ${c.batches.map((x) => x.batch.name).join(", ")}` : null,
        }))} />
      )}
    </>
  );
}
