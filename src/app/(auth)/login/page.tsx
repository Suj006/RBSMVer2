import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/status";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : ROLE_HOME[user.role]);
  return (
    <>
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
        <ArrowLeft className="size-4" /> Back to home
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Sign in</h1>
      <p className="mb-8 mt-2 text-sm text-slate-500">Buyers, sellers, District and Taluk Industries Offices, FIEO, the training admin and the Directorate sign in here.</p>
      <LoginForm />
    </>
  );
}
