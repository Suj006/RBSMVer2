import { redirect } from "next/navigation";

// Basic details are now part of the one-step application.
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  redirect(welcome ? "/buyer/application?welcome=1" : "/buyer/application#basic");
}
