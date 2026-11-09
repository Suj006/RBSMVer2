import type { ReviewAction, Role } from "@/generated/prisma/enums";
import { ACTION_LABEL, ROLE_LABEL } from "@/lib/status";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const DOT: Partial<Record<ReviewAction, string>> = {
  BASIC_RETURNED: "bg-tx-red", REQ_RETURNED: "bg-tx-red", DIC_RETURNED: "bg-tx-red", REQ_REJECTED: "bg-rose-700", CHANGE_RETURNED: "bg-tx-red",
  CHANGE_SUBMITTED: "bg-tx-blue", CHANGE_APPROVED: "bg-tx-green",
  BASIC_APPROVED: "bg-tx-green", FIEO_RECOMMENDED: "bg-violet-500", DIC_APPROVED: "bg-tx-green",
  REQ_WITHDRAWN: "bg-slate-400", REQ_MODIFIED: "bg-tx-yellow",
  BASIC_SUBMITTED: "bg-tx-blue", REQ_SUBMITTED: "bg-tx-blue",
};

export function Timeline({ logs }: {
  logs: { id: string; action: ReviewAction; actorRole: Role; comment: string | null; createdAt: Date; sectorName?: string | null; actor?: { displayName: string } | null }[];
}) {
  if (!logs.length) return <p className="text-sm text-slate-500">No activity yet.</p>;
  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-6">
      {logs.map((l) => (
        <li key={l.id} className="relative">
          <span className={cn("absolute -left-[31px] top-1 size-3 rounded-full ring-4 ring-white", DOT[l.action] ?? "bg-slate-400")} />
          <div className="text-sm font-semibold text-ink">
            {ACTION_LABEL[l.action]}{l.sectorName && <span className="font-medium text-brand-700"> · {l.sectorName}</span>}
          </div>
          <div className="text-xs text-slate-500">
            {ROLE_LABEL[l.actorRole]}{l.actor && l.actorRole !== "BUYER" ? ` · ${l.actor.displayName}` : ""} · {fmtDateTime(l.createdAt)}
          </div>
          {l.comment && (
            <blockquote className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{l.comment}</blockquote>
          )}
        </li>
      ))}
    </ol>
  );
}
