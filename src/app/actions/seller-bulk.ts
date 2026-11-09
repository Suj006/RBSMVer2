"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser } from "@/lib/auth";
import { EVENT } from "@/lib/config";
import { sendMail, sellerMail } from "@/lib/mail";
import { ensureSellerLogin } from "@/lib/seller-login";
import { parseUpload } from "@/lib/seller-bulk";
import { createSeller } from "@/lib/seller-create";

export type BulkState = {
  error?: string;
  imported?: { regNo: string; name: string }[];
  rows?: { row: number; name: string; udyamNo: string; errors: string[] }[];
  valid?: number;
  fileName?: string;
} | undefined;

const MAX_BYTES = 5 * 1024 * 1024;

export async function bulkUploadAction(_: BulkState, form: FormData): Promise<BulkState> {
  const user = await requireUser("DISTRICT");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose the filled-in Excel file to upload." };
  if (file.size > MAX_BYTES) return { error: "The file is larger than 5 MB." };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Upload an Excel workbook (.xlsx) — use the template from this page." };

  const { error, rows } = await parseUpload(Buffer.from(await file.arrayBuffer()), user.district!);
  if (error) return { error, fileName: file.name };
  if (!rows.length) return { error: "No seller rows found. Fill the 'Sellers' sheet from row 2.", fileName: file.name };
  const summary = rows.map(({ row, name, udyamNo, errors }) => ({ row, name, udyamNo, errors }));
  const valid = rows.filter((r) => r.data);

  if (form.get("intent") !== "import") return { rows: summary, valid: valid.length, fileName: file.name };
  if (!valid.length) return { error: "No valid rows to import. Correct the errors and upload again.", rows: summary, valid: 0, fileName: file.name };

  // Each seller gets a temporary login (e-mailed) and goes to its taluk office for verification.
  const passwordHash = await hashPassword(EVENT.defaultBuyerPassword);
  const imported: { regNo: string; name: string }[] = [];
  const mails: { to: string; subject: string; text: string }[] = [];
  await prisma.$transaction(async (tx) => {
    for (const r of valid) {
      const s = await createSeller(tx, r.data!, "BULK", { id: user.id, role: "DISTRICT" });
      const login = await ensureSellerLogin(tx, s, passwordHash);
      imported.push({ regNo: s.regNo, name: s.name });
      const m = sellerMail.received(s.name, s.regNo, s.district, s.taluk, login.username, EVENT.defaultBuyerPassword, true);
      mails.push({ to: s.contactEmail, subject: m.subject, text: m.text });
    }
  }, { timeout: 120_000 });
  for (const m of mails) await sendMail(m.to, m.subject, m.text);
  for (const p of ["/district", "/taluk", "/dic", "/admin"]) revalidatePath(p, "layout");
  return { imported, rows: summary.filter((r) => r.errors.length), valid: 0, fileName: file.name };
}
