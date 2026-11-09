import type { BuyerStatus, ItemStatus, ReviewAction, Role, SellerAction, SellerStatus } from "@/generated/prisma/enums";

type Tone = "slate" | "blue" | "amber" | "red" | "green" | "violet";

export const STATUS_META: Record<BuyerStatus, { label: string; tone: Tone; stage: number }> = {
  SIGNED_UP: { label: "Application not submitted", tone: "slate", stage: 1 },
  BASIC_SUBMITTED: { label: "Application with FIEO", tone: "amber", stage: 2 },
  BASIC_RETURNED: { label: "Application returned", tone: "red", stage: 1 },
  BASIC_APPROVED: { label: "Verified by FIEO — sectors in approval", tone: "blue", stage: 3 },
  APPROVED: { label: "Approved buyer", tone: "green", stage: 4 },
};

export const ALL_STATUSES = Object.keys(STATUS_META) as BuyerStatus[];

export const ITEM_META: Record<ItemStatus, { label: string; short: string; tone: Tone; dot: string }> = {
  DRAFT: { label: "Draft — not submitted", short: "Draft", tone: "slate", dot: "bg-slate-400" },
  SUBMITTED: { label: "Awaiting FIEO verification", short: "With FIEO", tone: "amber", dot: "bg-tx-yellow" },
  FIEO_RETURNED: { label: "Returned by FIEO for correction", short: "Returned", tone: "red", dot: "bg-tx-red" },
  FIEO_REJECTED: { label: "Rejected by FIEO", short: "Rejected", tone: "red", dot: "bg-rose-700" },
  FIEO_RECOMMENDED: { label: "Approved by FIEO — awaiting Directorate", short: "With Directorate", tone: "violet", dot: "bg-violet-500" },
  DIC_RETURNED: { label: "Returned by Directorate to FIEO", short: "Directorate returned", tone: "red", dot: "bg-orange-500" },
  APPROVED: { label: "Approved", short: "Approved", tone: "green", dot: "bg-tx-green" },
};

export const ALL_ITEM_STATUSES = Object.keys(ITEM_META) as ItemStatus[];

export const ACTION_LABEL: Record<ReviewAction, string> = {
  SIGNED_UP: "Signed up",
  BASIC_SUBMITTED: "Application submitted to FIEO",
  BASIC_APPROVED: "Basic details verified by FIEO",
  BASIC_RETURNED: "Application returned for correction",
  REQ_SUBMITTED: "Requirement submitted",
  REQ_RETURNED: "Requirement returned for correction",
  FIEO_RECOMMENDED: "Approved by FIEO — sent to Directorate",
  DIC_RETURNED: "Returned to FIEO for re-verification",
  DIC_APPROVED: "Approved by Directorate",
  REQ_WITHDRAWN: "Requirement removed by buyer",
  REQ_MODIFIED: "Approved requirement reopened for changes",
  REQ_REJECTED: "Requirement rejected by FIEO",
  CHANGE_SUBMITTED: "Change to basic details / sourcing profile sent to FIEO",
  CHANGE_APPROVED: "Change verified by FIEO",
  CHANGE_RETURNED: "Change returned by FIEO",
};

export const ROLE_LABEL: Record<Role, string> = {
  BUYER: "Buyer",
  FIEO: "FIEO",
  DIC: "Directorate",
  ADMIN: "Administrator",
  DISTRICT: "District Industries Centre",
  SELLER: "Seller",
  NODAL: "Nodal officer",
  TALUK: "Taluk office",
  TRAINING: "Training admin",
};

/** Short label for the portal badge in the sidebar. */
export const ROLE_BADGE: Record<Role, string> = {
  BUYER: "Buyer portal", FIEO: "FIEO portal", DIC: "Directorate portal", ADMIN: "Admin portal",
  DISTRICT: "District office", SELLER: "Seller portal", NODAL: "Nodal officer", TALUK: "Taluk office", TRAINING: "Training admin",
};

export const ROLE_HOME: Record<Role, string> = {
  BUYER: "/buyer",
  FIEO: "/fieo",
  DIC: "/dic",
  ADMIN: "/admin",
  DISTRICT: "/district",
  SELLER: "/seller",
  NODAL: "/nodal",
  TALUK: "/taluk",
  TRAINING: "/training",
};

// Registration journey (buyer level): one application (basic details, sourcing profile and sectors)
// goes to FIEO; each sector FIEO approves then goes to the Directorate.
export const JOURNEY = ["Sign up", "Application", "FIEO verification", "Directorate approval", "Approved buyer"] as const;

// Sector rows each reviewer acts on.
export const FIEO_ITEM_QUEUE: ItemStatus[] = ["SUBMITTED", "DIC_RETURNED"];
/** Submitted sector requirements still in verification (drafts excluded). */
export const ITEM_PENDING: ItemStatus[] = ["SUBMITTED", "FIEO_RETURNED", "FIEO_RECOMMENDED", "DIC_RETURNED"];
export const DIC_ITEM_QUEUE: ItemStatus[] = ["FIEO_RECOMMENDED"];
// Sector rows the Directorate can see at all.

/** The whole application (basic details, documents, sourcing profile, sectors) is a draft the buyer edits freely. */
export const canEditApplication = (s: BuyerStatus) => s === "SIGNED_UP" || s === "BASIC_RETURNED";
/** Once FIEO has verified the basic details, changes to them (and the sourcing profile) go to FIEO for verification. */
export const canRequestChange = (s: BuyerStatus) => s === "BASIC_APPROVED" || s === "APPROVED";
/** Sectors can be submitted one by one once the application has been submitted. */
export const canSubmitItems = (s: BuyerStatus) => !canEditApplication(s);
/** Sector rows the buyer can edit or remove — anything not currently with a reviewer.
 *  Editing an approved sector sends it through approval again. */
export const ITEM_EDITABLE: ItemStatus[] = ["DRAFT", "FIEO_RETURNED", "FIEO_REJECTED", "APPROVED"];
/** Sectors the buyer still has to (re)submit. */
export const ITEM_TO_SUBMIT: ItemStatus[] = ["DRAFT", "FIEO_RETURNED", "FIEO_REJECTED"];

// ---------------------------------------------------------------- sellers

export const SELLER_META: Record<SellerStatus, { label: string; short: string; tone: Tone; dot: string }> = {
  WITH_TALUK: { label: "Pending taluk verification", short: "With taluk", tone: "amber", dot: "bg-tx-yellow" },
  WITH_SELLER: { label: "Returned to applicant for correction", short: "With applicant", tone: "blue", dot: "bg-tx-blue" },
  NOT_RECOMMENDED: { label: "Not recommended by taluk", short: "Not recommended", tone: "slate", dot: "bg-slate-500" },
  RECOMMENDED: { label: "Recommended — awaiting initial approval", short: "With Directorate", tone: "violet", dot: "bg-violet-500" },
  RETURNED: { label: "Returned to taluk by Directorate", short: "Returned", tone: "red", dot: "bg-tx-red" },
  INITIAL_APPROVED: { label: "Initially approved — awareness session", short: "Awareness session", tone: "blue", dot: "bg-sky-500" },
  TRAINED: { label: "Session attended — awaiting final approval", short: "Awaiting final approval", tone: "violet", dot: "bg-indigo-500" },
  APPROVED: { label: "Approved seller", short: "Approved", tone: "green", dot: "bg-tx-green" },
  REJECTED: { label: "Rejected", short: "Rejected", tone: "slate", dot: "bg-slate-400" },
};
export const ALL_SELLER_STATUSES = Object.keys(SELLER_META) as SellerStatus[];

export const SELLER_ACTION_LABEL: Record<SellerAction, string> = {
  REGISTERED: "Registered",
  UPDATED: "Details updated",
  SENT_TO_SELLER: "Returned to applicant for correction",
  RESUBMITTED: "Corrected and resubmitted by applicant",
  RECOMMENDED: "Recommended by taluk office",
  NOT_RECOMMENDED: "Not recommended by taluk office",
  RETURNED: "Returned to taluk office by Directorate",
  INITIAL_APPROVED: "Initially approved by Directorate",
  BATCH_ASSIGNED: "Assigned to awareness session",
  ATTENDED: "Attended awareness session",
  ABSENT: "Absent from awareness session",
  APPROVED: "Final approval — seller number and permanent login",
  BYPASSED: "Final approval without awareness session (Directorate)",
  REJECTED: "Rejected by Directorate",
  PROFILE_UPDATED: "Seller profile updated by the seller",
};

/** Seller records each role may see. FIEO sees sellers only once approved. */
export const SELLER_VISIBLE: Partial<Record<Role, SellerStatus[]>> = {
  FIEO: ["APPROVED"],
};
/** The taluk office (and the district office that entered it) can edit these; the taluk office decides on them. */
export const SELLER_TALUK_EDITABLE: SellerStatus[] = ["WITH_TALUK", "RETURNED"];
/** Sellers still in the approval process (not yet finally approved, not recommended or rejected). */
export const SELLER_PENDING: SellerStatus[] = ["WITH_TALUK", "WITH_SELLER", "RETURNED", "RECOMMENDED", "INITIAL_APPROVED", "TRAINED"];
/** An applicant with a temporary login can correct their own details in these (and resubmit to the taluk office). */
export const SELLER_APPLICANT_EDITABLE: SellerStatus[] = ["WITH_TALUK", "WITH_SELLER"];
/** Statuses each role acts on ("Needs my action"). */
export const SELLER_ACTION: Partial<Record<Role, SellerStatus[]>> = {
  TALUK: ["WITH_TALUK", "RETURNED"],
  DIC: ["RECOMMENDED", "TRAINED"],
};
