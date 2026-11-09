"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { bulkUploadAction } from "@/app/actions/seller-bulk";
import { Alert, Badge, Button, Card, CardHeader } from "@/components/ui";
import { useKeepForm } from "@/lib/use-keep-form";

export function BulkUpload({ district }: { district: string }) {
  const [state, action, pending] = useActionState(bulkUploadAction, undefined);
  const onSubmit = useKeepForm(action);
  const bad = state?.rows?.filter((r) => r.errors.length) ?? [];
  const previewed = state?.rows && !state.imported;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Step 1 — Download the template" icon={<FileSpreadsheet className="size-4" />}
          subtitle={`Excel template with drop-down lists for sectors, local body type and export experience. Sellers are registered under ${district}.`} />
        <div className="p-6">
          <a href="/api/sellers/template" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
            <Download className="size-4 text-brand-700" /> Download upload template (.xlsx)
          </a>
        </div>
      </Card>

      <Card>
        <CardHeader title="Step 2 — Upload and check" icon={<Upload className="size-4" />}
          subtitle="Upload the filled template. Every row is checked first — nothing is saved until you click Import." />
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100" />
          {state?.error && <Alert tone="red">{state.error}</Alert>}
          {state?.imported && (
            <Alert tone="green" title={`${state.imported.length} seller${state.imported.length === 1 ? "" : "s"} imported`}>
              Registration numbers {state.imported[0]?.regNo} to {state.imported[state.imported.length - 1]?.regNo}.{" "}
              Each seller has been e-mailed a temporary login; the taluk offices now verify them.{" "}
              <Link href="/district/sellers?status=WITH_TALUK" className="font-semibold underline">View them</Link>
              {bad.length > 0 && <> · {bad.length} row{bad.length === 1 ? " was" : "s were"} skipped (listed below).</>}
            </Alert>
          )}
          {previewed && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <span className="text-sm text-slate-700"><span className="font-semibold">{state.fileName}</span>:</span>
              <Badge tone="green">{state.valid} ready to import</Badge>
              {bad.length > 0 && <Badge tone="red">{bad.length} with errors</Badge>}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" name="intent" value="preview" variant="secondary" disabled={pending}>
              <Upload className="size-4" /> {pending ? "Checking…" : "Upload & check"}
            </Button>
            {previewed && !!state.valid && (
              <Button type="submit" name="intent" value="import" disabled={pending}>
                <CheckCircle2 className="size-4" /> Import {state.valid} valid seller{state.valid === 1 ? "" : "s"}
              </Button>
            )}
          </div>
        </form>
        {(previewed || bad.length > 0) && state?.rows && (
          <div className="relative max-h-[520px] overflow-auto border-t border-slate-100">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Row</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">Udyam number</th><th className="px-4 py-3">Result</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(previewed ? state.rows : bad).map((r) => (
                  <tr key={r.row} className={r.errors.length ? "bg-red-50/40" : ""}>
                    <td className="px-4 py-2.5 align-top text-slate-500">{r.row}</td>
                    <td className="px-4 py-2.5 align-top font-medium text-ink">{r.name || "—"}</td>
                    <td className="px-4 py-2.5 align-top font-mono text-xs">{r.udyamNo || "—"}</td>
                    <td className="px-4 py-2.5 align-top">
                      {r.errors.length
                        ? <ul className="list-disc space-y-0.5 pl-4 text-xs text-tx-red">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                        : <Badge tone="green">OK</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
