import { ArrowRight } from "lucide-react";
import { BASIC_LABELS, diffFields, PROFILE_LABELS, type BasicFields, type BuyerChange, type ProfileFields } from "@/lib/buyer-change";
import { DocLink } from "@/components/doc-link";

type Doc = { id: string; kind: string; originalName: string; size: number };
const DOC_LABEL: Record<string, string> = { PROFILE: "Company profile", CREDENTIALS: "Organisation credentials" };

/** The fields and documents a buyer asked to change, verified value → requested value. */
export function ChangeView({ change, basic, profile, pendingDocs }: {
  change: BuyerChange; basic: BasicFields; profile: ProfileFields; pendingDocs: Doc[];
}) {
  const rows = [...diffFields(basic, change.basic, BASIC_LABELS), ...diffFields(profile, change.profile, PROFILE_LABELS)];
  if (!rows.length && !pendingDocs.length) return <p className="text-sm text-slate-500">No differences from the verified details.</p>;
  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="py-1.5 pr-3">Field</th><th className="py-1.5 pr-3">Verified</th><th className="py-1.5" aria-label="changes to" /><th className="py-1.5">Requested</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="py-2 pr-3 font-medium text-slate-600">{r.label}</td>
                  <td className="py-2 pr-3 text-slate-500 line-through decoration-slate-300">{r.from || "—"}</td>
                  <td className="py-2 pr-2"><ArrowRight className="size-3.5 text-slate-400" /></td>
                  <td className="py-2 font-semibold text-ink"><mark className="rounded bg-amber-100 px-1">{r.to || "—"}</mark></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pendingDocs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {pendingDocs.map((d) => (
            <div key={d.id}>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">New {DOC_LABEL[d.kind] ?? d.kind}</div>
              <DocLink doc={d} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
