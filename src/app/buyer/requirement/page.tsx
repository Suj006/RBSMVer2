import { redirect } from "next/navigation";

// Sector requirements are now part of the one-step application.
export default function RequirementPage() {
  redirect("/buyer/application#sectors");
}
