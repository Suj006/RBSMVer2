import type { Metadata } from "next";
import Link from "next/link";
import { certificationNames } from "@/lib/masters";
import { ArrowLeft } from "lucide-react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import { SellerForm } from "@/components/seller/seller-form";
import { EMPTY_SELLER } from "@/lib/seller-form-defaults";
import { EVENT } from "@/lib/config";

export const metadata: Metadata = { title: "Seller registration" };

export default async function Page() {
  await connection(); // render per request so the sector list is always current
  const sectors = await prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  const certs = await certificationNames();
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="tx-ribbon h-1" />
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/"><Logo /></Link>
          <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">Kerala MSMEs</div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Register as a seller for {EVENT.name}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Meet international buyers at the {EVENT.programme}. Your registration is verified by your Taluk Industries Office and approved by the
            Directorate of Industries &amp; Commerce after an awareness session. A login is e-mailed to you right away so you can track your
            application, make any corrections the taluk office asks for and see your session; it becomes your permanent seller login on final approval.
          </p>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Keep ready: Udyam registration, IEC number (required if you have export experience) and any quality / product certificates.
            After approval you will also be asked to complete a short seller profile (promoter and unit details).
          </p>
        </div>
        <SellerForm mode="self" initial={EMPTY_SELLER} sectors={sectors} certifications={certs} />
      </main>
    </div>
  );
}
