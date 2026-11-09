/**
 * A change an approved / verified buyer asks for in their basic details, documents or sourcing profile.
 * It is held on the buyer record until FIEO verifies it; the verified details stay in use meanwhile.
 * New documents are stored as Document rows with `pending: true`.
 */
export type BasicFields = { name: string; country: string; pocName: string; pocDesignation: string; pocEmail: string; pocMobile: string };
export type ProfileFields = { organisationType: string | null; annualSourcingValue: string | null; sourcingTimeline: string | null; preferredEngagement: string | null };
export type BuyerChange = { basic?: BasicFields; profile?: ProfileFields; comment?: string };

export const BASIC_LABELS: Record<keyof BasicFields, string> = {
  name: "Name of the buyer", country: "Country", pocName: "Contact name", pocDesignation: "Designation", pocEmail: "Contact e-mail", pocMobile: "Mobile number",
};
export const PROFILE_LABELS: Record<keyof ProfileFields, string> = {
  organisationType: "Organisation type", annualSourcingValue: "Indicative annual sourcing value", sourcingTimeline: "Sourcing timeline", preferredEngagement: "Preferred engagement",
};

export function parseChange(s: string | null | undefined): BuyerChange {
  if (!s) return {};
  try { const v = JSON.parse(s); return v && typeof v === "object" ? v as BuyerChange : {}; } catch { return {}; }
}

/** Field-by-field differences between the verified values and the requested ones. */
export function diffFields<T extends Record<string, string | null>>(current: T, next: T | undefined, labels: Record<keyof T, string>) {
  if (!next) return [];
  return (Object.keys(labels) as (keyof T)[])
    .filter((k) => (current[k] ?? "") !== (next[k] ?? ""))
    .map((k) => ({ key: String(k), label: labels[k], from: current[k] ?? "", to: next[k] ?? "" }));
}
