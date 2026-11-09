# TRADEX 2.0 — Reverse Buyer Seller Meet (RBSM) Portal

End-to-end management portal for the TRADEX 2.0 Reverse Buyer Seller Meet: participant registration,
profiling, verification, matchmaking, meeting scheduling, communication, monitoring and reporting.

**Phase 1 (this release): international buyer registration and approval workflow.**

## Workflow

```
Buyer sign-up ─► e-mail with login (Tradex2027-NNN / pass@123) ─► forced password change
   ─► My application (one step): basic details + documents + sourcing profile + one or more sectors
   ─► Submit application to FIEO (at least one sector; sourcing profile required)
   ─► FIEO reviews it in one go: basic details verified (optional comment for the buyer, which does not hold up
      the sectors) and, for each sector, Approve (→ Directorate) / Return for correction / Reject
        returned or rejected sectors: the buyer edits them and submits them again
   ─► Directorate, each FIEO-approved sector: Approve / Return to FIEO
   ─► first approved sector makes the buyer an approved RBSM buyer (RBSM-Buyer-2026NNN)
   ─► afterwards: new or modified sectors go through FIEO and the Directorate again;
      changes to basic details, documents or the sourcing profile are verified by FIEO only —
      the verified details stay in use until FIEO verifies the change (FIEO can return it with a comment;
      the buyer can correct or withdraw it)
```

**Buyers added by FIEO.** (Buyers who sign up themselves follow the workflow above, unchanged.) FIEO can also register buyers itself — **Add buyer** (one at a time, with optional company
documents) or **Bulk upload buyers** (Excel template with drop-downs for country, sourcing profile and up to 3 sector
requirements; every row is checked first, then the valid rows are imported). Each buyer gets a **temporary login**
(`Tradex2027-NNN`, e-mailed, password changed at first sign-in). Basic details entered by FIEO count as verified;
sector requirements entered by FIEO go straight to the Directorate as FIEO-recommended (the sourcing profile is then
required). The buyer signs in with the temporary login, sees a notice, checks the details and can add more sectors.
When the Directorate approves the first sector, the same login becomes the buyer's **permanent login** — the approval
e-mail says so. Lists show "Added by FIEO" / "FIEO bulk", can be filtered by how the buyer was registered, and the
buyer page and Buyer Register report show the source and whether the login is temporary or permanent.

```
FIEO adds a buyer (form or bulk Excel) ─► temporary login e-mailed ─► basic details verified (by FIEO)
   ─► sectors entered by FIEO: recommended to the Directorate ─► Directorate approves
   ─► RBSM-Buyer-2026NNN; the temporary login becomes the permanent login
```

FIEO and the Directorate decide each sector on its own (e.g. recommend one sector and return
another in the same step), with "Recommend all" / "Approve all" shortcuts.

| Number | Format | Assigned |
|---|---|---|
| Login ID | `Tradex2027-001` | at sign-up (or when FIEO adds the buyer: temporary until approval, then permanent) |
| Registration no. | `RBSM-B-001` | at sign-up |
| Buyer no. | `RBSM-Buyer-2026001` | when the first sector is approved by the Directorate |

## Sellers (Kerala MSMEs)

```
District office enters a seller (form or bulk Excel upload)  ─┐
Seller self-registers (district and taluk) ───────────────────┴─► with that Taluk Industries Office
   (every seller gets a temporary login Tradex2027-SNNN at once, e-mailed; visible to the district office too)
   ─► Taluk office verifies, may edit, and: recommends (one or many) / returns to the applicant / not recommended
        └─ applicant corrects and resubmits with the temporary login ─► back with the taluk office
   ─► Directorate initial approval (one or many) / returns to the taluk office / rejects
   ─► Awareness session: Admin creates sessions (date, time, venue, district or all districts; the name is
      generated, e.g. "Batch 03 · Ernakulam · Tue, 12 Dec 2026"); Admin, the Directorate and the district office
      place initially approved sellers in a session (and can move or remove them); sellers are e-mailed
   ─► Training admin marks attendance: present ─► with the Directorate for final approval
                                         absent  ─► placed in another session, or (case by case, with a reason)
                                                    given final approval by the Directorate without a session
   ─► Final approval (one or many) / reject: seller number RBSM-Seller-2026NNN; the temporary login becomes the
      permanent seller login. Only finally approved sellers are visible to FIEO and go to matchmaking.
```

Until final approval, a seller login shows only **My application**: progress (registered → taluk verification →
initial approval → awareness session → final approval), the taluk office's comments, the awareness session's date,
time and venue, and (while with the taluk office or returned to the applicant) the form to correct and resubmit the
details. After final approval it opens the full seller dashboard.

Dashboards (Directorate, Admin, district, taluk) show the count at every stage — registered, with taluk, with
applicant, recommended, not recommended, awaiting initial approval, awaiting / placed in a session, absent,
attended, awaiting final approval, approved, approved without session, rejected — with a district-wise
(Directorate) or taluk-wise (district office) table. Reports: **Taluk-wise Seller Summary**, **Awareness Session
Attendance** (all sessions or one session, sellers awaiting a session, sellers approved without a session) and the
**District-wise Seller Summary** with the new stages.

To start the new flow with no sellers, `npm run db:clear-sellers -- --yes` deletes all sellers and their logins
(buyers and staff are kept; add `--sessions` to delete the awareness sessions too).

Seller details at registration: name, district (14 Kerala districts), taluk (drop-down by district), local body type
(Panchayat / Municipality / Corporation) and name (municipalities and corporations from a drop-down; grama panchayat typed in),
Udyam number (Kerala only, UDYAM-KL-00-0000000, unique — users type only the digits), export experience — when Yes,
**countries exported to** (several, from the world list) and **products exported** (for reference only; not used in
matchmaking) — **IEC number**
(10 characters; required when the seller has export experience), **quality / product certifications** (from the certification
master, plus others), sectors with products ready to export, and promoter details (name of the promoter, mobile, WhatsApp, e-mail).
The Kerala masters (taluks, block panchayats, municipalities, corporations) are in `src/lib/kerala.ts`.

**Seller profile (after approval).** An approved seller completes **My profile**: gender and date of birth of the promoter,
social category (General / OBC / SC / ST), specially abled, block, constitution of the unit (Proprietary … Others), category
(Micro / Small / Medium / Large) and unit type (Manufacturing / Service / Trade); IEC and certifications can be updated there.
The dashboard asks for it until done, and buyer preferences can be sent only after it. Staff see "Profile pending" on
lists and dashboards, can filter by profile, category, unit type, promoter (women, SC / ST, specially abled), IEC and
certifications, and download the **Seller Profile Analysis** report (including the countries sellers already export to). Personal promoter details (gender, date of birth, social
category, specially abled) are shown to the Directorate, Admin and district centres only — not to FIEO or buyers.
Matchmaking adds 5 fit points for each certification the buyer requires that the seller holds (max 10), and flags pairs where the
seller holds none of the required certifications; buyers see their matched sellers' certifications, category and IEC status.
FIEO sees sellers only after Directorate approval. Seller products use the same sector master as buyer
requirements, ready for buyer–seller matchmaking. Targets (approved sellers overall and per district,
approved buyers, sellers per buyer — default 600 / 60 / 10) are set by the Directorate on the **Targets** page.

## Matchmaking (core module)

```
1. Directorate opens the buyer directory  ─► approved sellers see approved buyers (sectors, products,
                                              specifications, certifications, volumes)
2. Sellers give up to 5 tentative preferences, in order — final once submitted
3. Directorate freezes preferences          (only Admin can reopen; the Directorate can freeze again)
4. Directorate builds the mapping           ─► suggestions: up to 10 sellers per buyer, sharing the buyer's
                                              sectors — seller preferences first, then best fit
                                              (products, export experience); add / remove by hand
5. Checks flag incorrect mappings           (Directorate only, for reference — never blocks publishing)
6. Publish                                  ─► buyers, sellers, FIEO and district centres see it; changes
                                              stay in the working list until republished
7. Lock the final version                   (only Admin can unlock)
```

Every pair is labelled **Seller preference (#rank)**, **System match** or **Manual**. The Directorate sees each
seller's preferences and how many made it into the working list and the published mapping, plus **Results &
gaps**: buyers below 10 sellers, approved sellers without a buyer, sector coverage, requested products not
covered by the matched sellers, and district position. Reports: mapping (published or working list), seller
preferences and outcome, results and gaps. Buyers see their matched sellers; sellers their buyer meetings;
district centres the meetings of their sellers. Participants whose list changes are e-mailed on publishing.
**Reports at every step** (Excel and PDF, offered inside each step on the Matchmaking overview and on Reports):

| Step | Report | What it holds |
|---|---|---|
| 1 | Buyer directory for sellers | Approved buyers' approved sectors: products, specifications, certifications, volumes; approved sellers per sector; preferences received |
| 2–3 | Seller preferences and outcome | Each seller's ranked choices; every preference with the seller's sectors & products, the buyer's sectors & products, the fit and the result (in working list / published / why not placed); sellers yet to respond; preferences per buyer |
| 4 | Working list | Every pair with the buyer's approved sectors & products, the seller's sectors & products and **why matched** (seller's preference rank, common sectors, matching products, required certifications held, export experience, with the fit points); buyer-wise and seller-wise summaries; changes against the published version; pairs removed by the Directorate |
| 5 | Checks | Mappings to review, by severity |
| 5–6 | Published / final mapping, Results & gaps | As the working list, for the published (or locked) version; buyers below target and sellers without buyers with their sectors & products, sector and product coverage, district position |

FIEO and district centres get the published mapping (districts: their own sellers) with the sector, product and certification
reasons but without seller preference ranks or fit points. Buyers and sellers see "Matched on: <sectors>" for each meeting.

The Directorate and Admin work the module from one **Matchmaking** menu entry with tabs: Overview, Mapping
board, Seller preferences, Checks, Results & gaps, Published.

## Event days, meeting schedule and live monitor

**Directorate → Event days & schedule** (FIEO and Admin: view only):

1. **Dates & hours** — start and end dates (two days planned), each day's start and end time and up to three breaks;
   meeting length (30 minutes) and buffer after each meeting (10 minutes); venue. Slots never run into a break.
2. **Pavilions** — approved buyers are numbered 1…n, grouped by their first sector that has matched sellers (else their
   first sector), in the sector master's order (e.g. agri buyers 1–10, then FMCG 11–15 …). Any number can be changed.
3. **Nodal officers** — Directorate officers with their own login (`nodal01` …, e-mailed). Buyers are shared among them
   in pavilion order (e.g. 60 buyers / 10 officers = 10 each) or assigned one by one.
4. **Draft schedule** — every buyer–seller pair of the published mapping gets one slot; no buyer or seller is
   double-booked and the buffer is kept. Pairs are placed round by round in pavilion order, each in the earliest slot
   free for both. The Directorate can move a meeting (only slots free for both are offered), remove it, place a pair by
   hand, fill gaps or rebuild (manual placements kept). Seen only by the Directorate, FIEO and Admin.
5. **Publish** — buyers and sellers see **My meetings** (day, time, pavilion, the other party's name, ID and
   details). **Sellers** get a **ticket** for each meeting (`TX-D1-P07-1030`: day, pavilion, time) with both IDs,
   printable one by one or all together; buyers get no tickets (sellers come to their pavilion). Nodal officers see
   their buyers' schedules. Republishing e-mails only those whose meetings changed.
6. **Event day** — the nodal officer verifies the seller's ticket, or looks the seller up by ID (**Verify ticket /
   seller ID**), and marks seller present /
   absent, meeting completed, or the buyer absent for the day. **Live monitor** (Directorate, FIEO, Admin) refreshes
   every 20 seconds: meetings today, completed, in meeting now, awaiting seller, upcoming, no-shows, not marked; buyers
   in meeting / waiting / idle / done / absent; sellers in meeting / pending / finished; the pavilion × slot board in
   colour; late check-ins with the nodal officer to call; each officer's marking. A **rehearsal** time can be entered
   to see the board as at any time of an event day.
7. **Fill this slot** (nodal officer for their buyers; Directorate from the live monitor) — when a seller is marked
   absent, or has not checked in after the slot starts, the slot can be given to **any other seller matched with that
   buyer** who is available now: each seller's other meetings that day are checked (no overlap, buffer kept), sellers
   marked absent elsewhere today or who have already met the buyer are left out (the reason is shown), sellers already
   at the venue are listed first with their day's timetable, and the list can be searched by name, ID, district,
   contact, mobile or product. Their later meeting with the buyer moves forward and keeps its ticket number; a matched pair without a
   meeting gets a new ticket. Only pairs of the published mapping are offered. If the absent seller arrives late, they
   can be given a later slot that day free for both sides. Moves show in My meetings, on the ticket, the live board and
   the attendance report (Event-Day Change), and are copied into the draft so a republish keeps them. The live
   board marks every changed slot (⇄, dashed outline) and lists the **Event-day changes** — who was absent, who took
   the slot, moved from when, by whom — for the Directorate, FIEO and Admin.

Reports: **Meeting Schedule** (published or draft — by time, buyer, seller, pavilions and nodal officers) and
**Event Day Attendance** (every meeting's status, day-wise summary, buyers' attendance, nodal officers' marking).

## MoUs (memoranda of understanding)

After a successful one-to-one meeting the buyer fills an MoU under **MoUs** (or **Fill MoU** next to a meeting): only
the **description of goods**, the **approximate value** (US$ or INR, or "to be determined") and the **approximate month
of placing the order**, plus the sector. Everything else is filled in automatically — buyer and seller names, IDs,
addresses and contacts, the meeting (day, time, pavilion, ticket), the event, venue and dates — on a standard MoU
("Intention for Placing Orders": purpose, products and quality, specifications, commercial terms, non-binding nature,
validity, facilitation, verification and signature blocks).

```
Buyer fills the MoU ─► nodal officer of the buyer verifies  ┐ (either order; the Directorate can verify when no
                    ─► FIEO approves                         ┘  officer is assigned)
   ─► approved: shown to the seller; buyer and seller download the PDF; both e-mailed
   either reviewer can return it with a comment ─► buyer corrects and submits again (or withdraws it)
```

**MoU number:** `RBSM-MOU-2026-B007-S012` — the year, the buyer's and the seller's approved numbers (`-2`, `-3` for further
MoUs of the same pair), so the buyer and seller are recognisable from the number; Find by ID accepts it.

**MoU dashboard** (Directorate, FIEO, Admin — live, refreshes every 30 s): approved / awaiting / all-signed value in US$
and INR; MoUs approved, awaiting the nodal officer, awaiting FIEO, returned, withdrawn; buyers and sellers with an MoU
against the approved totals; meetings → MoU conversion; recent MoUs; largest MoU; countries and districts reached;
breakdowns by buyer country (flags), sector, top buyers, top sellers, seller district and nodal officer; the order
pipeline by expected month and MoUs signed by day; "All signed" / "Approved only" views. The Directorate sets the US$ →
INR rate used throughout. **All MoUs** lists and filters every MoU (status, country, sector, district, search by number,
name or ID); the **MoU Register** report (Excel / PDF) has every MoU with country-, sector- and district-wise totals.

## Unique IDs, country flags and Find by ID

Every buyer and seller is identified by a unique ID wherever they appear — lists, dashboards, matchmaking, messages,
schedules, the live board, nodal officers' pages and tickets:

| | Approved number | Registration number | Login ID |
|---|---|---|---|
| Buyer | `RBSM-Buyer-2026007` | `RBSM-B-007` | `Tradex2027-007` |
| Seller | `RBSM-Seller-2026012` | `RBSM-S-012` | `Tradex2027-S012` |

Buyers carry their country's flag and ISO short code (🇦🇪 AE). **Find by ID** (Directorate, FIEO, Admin, districts —
also the search box on the dashboard) takes any of these IDs, part of one, or a meeting ticket number and shows the
participant's identity, status, sectors, matches, pavilion, nodal officer and every meeting. It also finds by name,
contact person, mobile, e-mail, Udyam / IEC number, district, country or product (FIEO: not by sellers' personal
data). Nodal officers can look a seller up by ticket, ID, name or mobile, with links to the full
profile, matchmaking and messages. Districts find only their own sellers. Buyer and seller lists and the messages list
also search by ID.

## Communications

**Messages** in every login (buyer, approved seller, FIEO, Directorate; Admin read only; district centres have no access).

- **Programme desk** — from the start: each buyer and each approved seller has one conversation with the Directorate and
  FIEO. Staff can open it from **Message a buyer / seller**; the participant can reply and share documents.
- **Common communications** — the Directorate and FIEO send to all buyers and approved sellers, all registered buyers,
  approved buyers, approved sellers, or the buyers and sellers in the published mapping, optionally narrowed to a sector or
  (sellers) a district; optionally e-mailed. Only the recipients see them; staff see who has read each one.
- **Buyer–seller discussions** — after the matchmaking is published and the Directorate enables **buyer–seller
  interaction** (Matchmaking step 7, or the Messages page), each matched buyer and seller can discuss and share documents.
  A discussion is seen only by that buyer, that seller, the Directorate and FIEO — never by other sellers or buyers.
  A buyer can also send one communication to **all its matched sellers**; each seller replies privately.
- **Documents** — PDF, JPG, PNG, Word (.docx) or Excel (.xlsx), up to 5 MB, up to 3 per message; the sender must give each
  a **document name**. Files are content-checked and served only to those who can see the message.
- **Intervention** — the Directorate and FIEO can write in any discussion (both parties see it), withdraw a message (kept
  for the record, hidden from the parties) and close / reopen a conversation. Disabling interaction keeps discussions readable.
- Unread counts on the menu and dashboards; buyers and sellers are e-mailed when someone writes to them.
- **Communications Log** report (Excel / PDF): conversations, every message, documents shared, communications and read counts;
  also per conversation.

## Insights (Directorate / Admin)

A decision page built from live data, with an Excel / PDF report of every section:

- **Key findings and recommended actions** — plain-language points ranked by urgency (targets at risk,
  biggest drop-off, overdue files, lagging districts, sellers short in sectors, products with no supplier,
  high rework, matchmaking gaps), each with the next step and a link to the list behind it
- **Registration funnels** — buyers (sign-up → basic details → FIEO approval → sector submitted → approved)
  and sellers (registered → recommended → approved), with conversion from each previous stage
- **Progress to targets and pace** — approvals per week over the last 14 days and weeks to target
- **District performance** — districts ranked by approved sellers against target, files waiting over a
  week, average days to recommend, rejections
- **Seller profile** — women, SC / ST and specially abled promoters, unit category, type and constitution, IEC and
  certifications, district-wise, with profiles still pending; **certification readiness** — each certification approved
  buyers require against approved sellers holding it in those sectors
- Matchmaking readiness per approved buyer, sector supply gaps, district × sector supply, markets × sectors
  demand, certifications, **rework and rejection** rates, turnaround and ageing, and the matchmaking position

## Logins (phase-1 defaults — change before going live)

| Role | User name | Password | Can do |
|---|---|---|---|
| FIEO | `fieo` | `pass@123` | See all buyers, approve / return basic details, recommend / return each sector |
| Directorate | `dic123` | `dic123` | Central team: sees the whole programme — every buyer, sector and seller at every stage, all documents and all reports. Approves FIEO-recommended sectors (first approval adds the buyer to the RBSM list) / returns to FIEO; approves district-recommended sellers; sets targets |
| Admin | `admin` | `admin` | Sector & certification masters, users, buyer password reset, e-mail outbox, all reports |
| District offices (14) | `dic-tvm`, `dic-klm`, `dic-pta`, `dic-alp`, `dic-ktm`, `dic-idk`, `dic-ekm`, `dic-tsr`, `dic-pkd`, `dic-mlp`, `dic-kkd`, `dic-wyd`, `dic-knr`, `dic-ksd` | `pass@123` | Register sellers of their district (form / bulk Excel upload, up to 5 sectors per row), place initially approved sellers in awareness sessions |
| Taluk offices (78) | `tlk-<taluk>`, e.g. `tlk-aluva`, `tlk-neyyattinkara`, `tlk-kanayannur` | `pass@123` | Verify and edit the sellers of their taluk; recommend / return to the applicant / not recommended |
| Training admin | `training` | `pass@123` | See the sellers placed in each awareness session and mark attendance |
| Buyer | `Tradex2027-NNN` | `pass@123` (must change on first login) | Own profile and requirement |
| Seller | `Tradex2027-SNNN` (allotted at registration; temporary until final approval) | `pass@123` (must change on first login) | My application until final approval, then the seller dashboard |
| Nodal officer | `nodal01` … (created by the Directorate; demo: `nodal01`–`nodal04`) | `pass@123` | Their buyers' meeting schedules, ticket / seller-ID verification, attendance |

Staff passwords can be changed from **Admin → Users & logins**.

## Features

- Sign-up with full world country list, e-mail format check and duplicate check
- English-only input everywhere; names and designations saved in Title Case (e.g. "sujith hdhd" → "Sujith Hdhd"); contact names accept letters and spaces only
- Credential e-mails (SMTP) plus an **E-mail outbox** that records every message
- Document uploads (PDF/JPG/PNG, 5 MB, content-checked) served only to authorised users
- Detailed requirement: multiple sectors, products, specifications, volumes, certifications (master + custom)
- Sector-wise approval: save draft / submit per sector, return-with-comment at FIEO and Directorate, modify approved sectors or add new ones later; full audit trail
- Role dashboards: KPIs, pipeline, sign-up trend, top countries, sectors of interest, work queue
- Every dashboard tile, pipeline legend and chart bar opens the matching list, with the same count
  (buyer tiles open **Buyer applications**; sector tiles open **Sector requirements**, one row per buyer sector)
- Easy navigation: "Back to …" on every inner page returns to the list you came from with its filters kept;
  after a decision, **Next pending application** opens the next item in your queue; sector rows jump straight
  to that sector on the buyer's page; on phones a shortcut jumps to the decision panel
- **RBSM buyer list** and **RBSM seller list** (Directorate, FIEO, Admin): every approved buyer / seller on screen,
  with one-click **Complete details** downloads (Excel and PDF) — buyers with contacts, sourcing profile and every
  approved sector (products, specifications, certifications, volumes); sellers with Udyam, location, promoter
  contact, export experience and every sector with products
- Reports (Reports page for FIEO, Directorate and Admin) — each as a formatted **Excel** workbook and a **PDF**
  with the TRADEX letterhead, coloured headings, status colours, summary boxes and page numbers:
  Buyer Registration Register, Sector-wise Requirement Report, RBSM Approved Buyer List, MIS Summary,
  and a Buyer Profile for any single buyer (from the buyer's page). Filters on the list/report pages apply.
- **Sector demand** page and report (FIEO, Directorate, Admin): per sector, the buyers, each product requested
  with the buyers asking for it, required certifications, and the approved sellers offering it (matching
  products highlighted)
- Change tracking: when a buyer modifies an approved sector (or resubmits a returned one), reviewers see each
  change highlighted against the approved / returned version

## Running locally

```bash
cp .env.example .env
npm install              # also generates the Prisma client
npx prisma migrate deploy
npm run db:seed          # staff logins, sectors, certifications
npm run dev              # http://localhost:3000
```

To try the dashboards and reports with sample data, run `npm run db:demo` on an empty database
(loads 40 demo buyers and about 150 demo sellers at every stage; demo password `pass@123`).

To see the event as if it were running **today**, run `npm run db:event-today` (after `db:demo`). It sets
day 1 to today, with the hours placed around the current time (IST), and day 2 to tomorrow; publishes and
locks the mapping and the schedule; and marks today's meetings as the nodal officers would — completed,
in meeting now, awaiting the seller, seller / buyer absent, a few not marked, and a few absent sellers'
slots filled with another seller. It also replaces the MoUs with ones filled after today's completed
meetings (approved, with the reviewers, returned, withdrawn; the newest a few minutes old). Buyers,
sellers and logins are kept; the mapping, schedule and MoUs are rebuilt each time. Run it again later in
the day to move the event to the new time. Then open **Event days & schedule → Live monitor** and the
**MoU dashboard** (Directorate `dic123`), or log in as a nodal officer (`nodal01`–`nodal04`, `pass@123`).

After updating from an older version, run `npx prisma migrate deploy` (database changes) and
`npm run db:seed` (adds new logins such as the district, taluk and training logins; existing data is kept). Once, run
`npm run db:normalize` to re-format names already saved.

Production: `npm run build && npm start`. Set `APP_URL` and the `SMTP_*` variables in `.env` so buyers
receive their credentials by e-mail; without SMTP the e-mails appear only in **Admin → E-mail outbox**
and the sign-up screen shows the credentials. Uploaded files are stored in `storage/uploads`
(override with `UPLOAD_DIR`) — include it in backups together with `dev.db`.

## Branding

Colours come from the TRADEX logo (`src/app/globals.css`, `@theme`). The logo file is set in
`src/lib/config.ts` (`EVENT.logo`); replace `public/tradex-logo.svg` or point it to the official artwork.

## Stack

Next.js 16 (App Router, server actions) · React 19 · Prisma 7 + SQLite · Tailwind CSS 4 · Zod · Nodemailer
