// Fills an EMPTY database with realistic demo buyers at every stage, for
// trying out dashboards and reports.   npm run db:demo
// Refuses to run when buyers already exist.
import "dotenv/config";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { ItemStatus, BuyerStatus } from "../src/generated/prisma/enums";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { approvedBuyerNo, buyerRegNo, buyerUsername, CONSTITUTIONS, GENDERS, SOCIAL_CATEGORIES, UNIT_CATEGORIES, UNIT_TYPES } from "../src/lib/config";
import { BLOCKS, CORPORATIONS, MUNICIPALITIES } from "../src/lib/kerala";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }) });
const dbFile = () => path.resolve((process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, ""));

const BUYERS: [string, string, string, string][] = [
  ["Gulf Fresh Trading LLC", "United Arab Emirates", "Ahmed Al Mansoori", "Head of Procurement"],
  ["Nordic Spice House AB", "Sweden", "Erik Lindqvist", "Category Manager"],
  ["Pacific Rim Imports Pty Ltd", "Australia", "Olivia Bennett", "Sourcing Director"],
  ["Maple Leaf Foods Distribution", "Canada", "Liam Tremblay", "Purchase Manager"],
  ["Al Noor Hypermarkets", "Qatar", "Fatima Al Thani", "Buying Manager"],
  ["Rhine Valley Organics GmbH", "Germany", "Lukas Schneider", "Managing Director"],
  ["Sakura Trading Co", "Japan", "Haruto Sato", "General Manager"],
  ["Lone Star Home Decor Inc", "United States", "Emily Carter", "Senior Buyer"],
  ["Thames Textiles Ltd", "United Kingdom", "Oliver Hughes", "Product Developer"],
  ["Merlion Wellness Pte Ltd", "Singapore", "Wei Ling Tan", "Procurement Lead"],
  ["Atlas Coffee Roasters", "Morocco", "Youssef El Amrani", "Owner"],
  ["Baltic Seafood Group", "Latvia", "Janis Berzins", "Import Manager"],
  ["Sahara Building Supplies", "Egypt", "Omar Hassan", "Commercial Manager"],
  ["Kiwi Natural Products Ltd", "New Zealand", "Charlotte Wilson", "Founder"],
  ["Andes Gourmet SAC", "Peru", "Mateo Rojas", "Import Director"],
  ["Lagos Agro Ventures", "Nigeria", "Chinedu Okafor", "Chief Executive"],
  ["Riyadh Retail Holdings", "Saudi Arabia", "Khalid Al Saud", "Head of Sourcing"],
  ["Iberia Fine Foods SL", "Spain", "Lucia Garcia", "Purchase Manager"],
  ["Danube Handicrafts Kft", "Hungary", "Bence Nagy", "Buyer"],
  ["Cape Wellness Distributors", "South Africa", "Thandiwe Mokoena", "Category Buyer"],
  ["Bosphorus Textile AS", "Turkiye", "Emre Yilmaz", "Sourcing Manager"],
  ["Mekong Trade Partners", "Vietnam", "Nguyen Van An", "Director"],
  ["Lisbon Coir Imports Lda", "Portugal", "Ricardo Santos", "Procurement Officer"],
  ["Muscat Food Industries", "Oman", "Salim Al Harthy", "Supply Chain Head"],
  ["Polar Home Furnishings Oy", "Finland", "Aino Virtanen", "Buyer"],
  ["Kuwait Gulf Mart", "Kuwait", "Fahad Al Sabah", "Purchase Manager"],
  ["Seoul Natural Life Co", "South Korea", "Min-jun Kim", "Import Manager"],
  ["Amsterdam Spice Traders BV", "Netherlands", "Daan de Vries", "Trading Manager"],
  ["Bahrain Fresh Markets", "Bahrain", "Ali Al Khalifa", "Category Manager"],
  ["Mombasa Agri Exports", "Kenya", "Wanjiru Kamau", "Sourcing Lead"],
  ["Milano Design Furniture Srl", "Italy", "Giulia Rossi", "Product Manager"],
  ["Paris Gourmet Distribution", "France", "Camille Martin", "Acheteur"],
  ["Dhaka Garments Sourcing", "Bangladesh", "Rahim Uddin", "Merchandiser"],
  ["Colombo Tea Blenders", "Sri Lanka", "Nimal Perera", "Blending Manager"],
  ["Toronto Wellness Group", "Canada", "Sophie Martin", "Buyer"],
  ["Texas Rubber Industries", "United States", "Michael Brown", "Procurement Manager"],
  ["Sydney Organic Grocers", "Australia", "Jack Thompson", "Owner"],
  ["Jeddah Building Materials", "Saudi Arabia", "Abdullah Al Ghamdi", "Purchase Head"],
  ["Hamburg Coffee Kontor", "Germany", "Anna Fischer", "Green Coffee Buyer"],
  ["Abu Dhabi Hospitality Supplies", "United Arab Emirates", "Mariam Al Hosani", "Sourcing Manager"],
];

const NEEDS: Record<string, [string, string][]> = {
  "Spices & Condiments": [["Black pepper, Cardamom, Turmeric powder", "ASTA cleaned, 25 kg PP bags"], ["Cloves, Nutmeg, Mace", "Hand-picked, moisture below 12%"]],
  "Tea & Coffee": [["Orthodox black tea, Green tea", "FOP grade, 1 kg retail packs"], ["Arabica coffee beans", "Plantation A, screen 17/18"]],
  "Marine & Seafood Products": [["Frozen shrimp, Squid rings", "Size 16/20, 20% glaze, IQF"], ["Tuna loins", "Sashimi grade, -60 C"]],
  "Coir & Coir Products": [["Coir mats, Coir pith blocks", "5 kg blocks, low EC"]],
  "Ayurveda, Herbal & Wellness": [["Ayurvedic oils, Herbal supplements", "GMP certified, private label"]],
  "Handicrafts & Home Decor": [["Brass lamps, Wooden handicrafts", "Gift packaging"]],
  "Apparel & Garments": [["Cotton kurtas, Linen shirts", "GOTS certified cotton"]],
  "Cashew & Dry Fruits": [["Cashew kernels W240, W320", "Vacuum packed tins"]],
  "Furniture": [["Teak dining sets, Rattan chairs", "Knock-down packing"]],
  "Rubber & Rubber Products": [["Rubber mats, Industrial gloves", "EN 388 compliant"]],
  "Building Materials": [["Granite slabs, Ceramic tiles", "Polished, 20 mm"]],
  "Processed Food & Beverages": [["Ready-to-eat curries, Pickles", "Shelf life 12 months"]],
};
const DIAL: Record<string, string> = {
  "United Arab Emirates": "+971 50", Sweden: "+46 70", Australia: "+61 412", Canada: "+1 416", Qatar: "+974 55", Germany: "+49 151",
  Japan: "+81 90", "United States": "+1 512", "United Kingdom": "+44 7700", Singapore: "+65 9123", Morocco: "+212 661", Latvia: "+371 2",
  Egypt: "+20 100", "New Zealand": "+64 21", Peru: "+51 987", Nigeria: "+234 803", "Saudi Arabia": "+966 50", Spain: "+34 612",
  Hungary: "+36 30", "South Africa": "+27 82", Turkiye: "+90 532", Vietnam: "+84 91", Portugal: "+351 912", Oman: "+968 92",
  Finland: "+358 40", Kuwait: "+965 66", "South Korea": "+82 10", Netherlands: "+31 6", Bahrain: "+973 36", Kenya: "+254 712",
  Italy: "+39 347", France: "+33 6", Bangladesh: "+880 171", "Sri Lanka": "+94 77",
};
const CERTS = ["ISO 22000 (Food Safety)", "HACCP", "Halal", "FSSAI Licence", "USDA Organic", "GOTS (Organic Textile)", "BRCGS", "ISO 9001 (Quality Management)"];
const ORG = ["Importer", "Distributor / Wholesaler", "Retail Chain", "E-commerce Platform", "Trading House"];
const VALUE = ["USD 100,000 - 500,000", "USD 500,000 - 1 million", "USD 1 - 5 million", "USD 5 - 10 million"];
const TIME = ["Immediate (within 3 months)", "3 - 6 months", "6 - 12 months"];

// Stage per buyer (cycled): basic stages, then sector mixes.
const PLAN: { status: BuyerStatus; items: ItemStatus[] }[] = [
  { status: "APPROVED", items: ["APPROVED", "APPROVED"] },
  { status: "APPROVED", items: ["APPROVED", "SUBMITTED"] },
  { status: "BASIC_APPROVED", items: ["FIEO_RECOMMENDED", "FIEO_RETURNED"] },
  { status: "BASIC_APPROVED", items: ["SUBMITTED"] },
  { status: "APPROVED", items: ["APPROVED", "FIEO_RECOMMENDED", "DRAFT"] },
  { status: "BASIC_SUBMITTED", items: [] },
  { status: "BASIC_APPROVED", items: ["DIC_RETURNED", "SUBMITTED"] },
  { status: "SIGNED_UP", items: [] },
  { status: "APPROVED", items: ["APPROVED"] },
  { status: "BASIC_RETURNED", items: [] },
];

async function main() {
  if (await prisma.buyer.count() || await prisma.seller.count()) { console.error(`Buyers or sellers already exist in ${dbFile()} — demo data is only loaded into an empty database.`); process.exit(1); }
  const sectors = await prisma.sector.findMany();
  const fieo = await prisma.user.findUnique({ where: { username: "fieo" } });
  const dic = await prisma.user.findUnique({ where: { username: "dic123" } });
  if (!fieo || !dic) { console.error(`No staff logins in ${dbFile()} — run \`npm run db:seed\` first, then \`npm run db:demo\`.`); process.exit(1); }
  const hash = await bcrypt.hash("pass@123", 10);
  const needSectors = Object.keys(NEEDS).map((n) => sectors.find((s) => s.name === n)).filter(Boolean) as typeof sectors;
  let approvedSeq = 0;
  const day = 86400000;
  // Staggered stage dates (never in the future) so turnaround figures look realistic.
  const after = (d: Date, days: number) => new Date(Math.min(d.getTime() + days * day, Date.now() - 3600000));

  for (const [i, [name, country, poc, desig]] of BUYERS.entries()) {
    const seq = i + 1;
    const plan = PLAN[i % PLAN.length];
    const created = new Date(Date.now() - (BUYERS.length - i) * day * 0.6);
    const email = `${poc.split(" ")[0].toLowerCase()}@${name.split(" ")[0].toLowerCase()}.example`;
    const user = await prisma.user.create({ data: { username: buyerUsername(seq), passwordHash: hash, role: "BUYER", displayName: name, createdAt: created } });
    const approved = plan.status === "APPROVED";
    if (approved) approvedSeq++;
    const basicDone = plan.status !== "SIGNED_UP";
    const buyer = await prisma.buyer.create({
      data: {
        userId: user.id, seq, regNo: buyerRegNo(seq), name, country, signupEmail: email, createdAt: created, status: plan.status,
        ...(basicDone ? { pocName: poc, pocDesignation: desig, pocEmail: email, pocMobile: `${DIAL[country] ?? "+1 555"} ${String(1000000 + i * 73519).slice(0, 7)}`, basicSubmittedAt: created } : {}),
        ...(plan.status === "BASIC_APPROVED" || approved ? { basicApprovedAt: new Date(created.getTime() + day / 2) } : {}),
        ...(approved ? { approvedSeq, approvedNo: approvedBuyerNo(approvedSeq), approvedAt: new Date(created.getTime() + day) } : {}),
      },
    });
    const log = (action: string, actorId: string | null, actorRole: "BUYER" | "FIEO" | "DIC", at: Date, extra: object = {}) =>
      prisma.reviewLog.create({ data: { buyerId: buyer.id, actorId, actorRole, action: action as never, createdAt: at, ...extra } });
    await log("SIGNED_UP", user.id, "BUYER", created);
    if (basicDone) await log("BASIC_SUBMITTED", user.id, "BUYER", created);
    if (plan.status === "BASIC_RETURNED") await log("BASIC_RETURNED", fieo.id, "FIEO", created, { comment: "Please upload a clearer copy of the trade licence." });
    if (plan.status === "BASIC_APPROVED" || approved) await log("BASIC_APPROVED", fieo.id, "FIEO", new Date(created.getTime() + day / 2));
    if (!plan.items.length) continue;

    const req = await prisma.requirement.create({
      data: {
        buyerId: buyer.id, organisationType: ORG[i % ORG.length], annualSourcingValue: VALUE[i % VALUE.length], sourcingTimeline: TIME[i % TIME.length],
        preferredEngagement: "Regular / long-term supply",
      },
    });
    for (const [j, st] of plan.items.entries()) {
      const sector = needSectors[(i + j * 5) % needSectors.length];
      const [products, spec] = NEEDS[Object.keys(NEEDS).find((k) => sector.name.startsWith(k.slice(0, 10)))!][0];
      const at = after(created, 0.7);
      const recAt = after(at, 1 + (i % 3));
      const apprAt = after(recAt, 1 + ((i + j) % 4));
      const item = await prisma.requirementItem.create({
        data: {
          // Some buyers also ask for products no demo seller offers (shows up as supply gaps).
          requirementId: req.id, sectorId: sector.id, products: i % 3 === 0 ? `${products}, ${["Private-label retail packs", "Organic certified range", "Gift hampers"][(i + j) % 3]}` : products,
          specifications: spec, updatedAt: st === "APPROVED" ? apprAt : ["FIEO_RECOMMENDED", "DIC_RETURNED"].includes(st) ? recAt : at, quantity: `${1 + (i % 4)} container${i % 4 ? "s" : ""} per quarter`,
          certifications: JSON.stringify([CERTS[(i + j) % CERTS.length], CERTS[(i + j + 3) % CERTS.length]]), sortOrder: j, status: st,
          submittedAt: st === "DRAFT" ? null : at, recommendedAt: ["FIEO_RECOMMENDED", "DIC_RETURNED", "APPROVED"].includes(st) ? recAt : null,
          approvedAt: st === "APPROVED" ? apprAt : null, everApproved: st === "APPROVED",
        },
      });
      const extra = { itemId: item.id, sectorName: sector.name };
      if (st !== "DRAFT") await log("REQ_SUBMITTED", user.id, "BUYER", at, extra);
      if (st === "FIEO_RETURNED") await log("REQ_RETURNED", fieo.id, "FIEO", at, { ...extra, comment: "Please add packaging and quantity details." });
      if (["FIEO_RECOMMENDED", "DIC_RETURNED", "APPROVED"].includes(st)) await log("FIEO_RECOMMENDED", fieo.id, "FIEO", recAt, extra);
      if (st === "DIC_RETURNED") await log("DIC_RETURNED", dic.id, "DIC", at, { ...extra, comment: "Verify the export licence before recommending." });
      if (st === "APPROVED") await log("DIC_APPROVED", dic.id, "DIC", apprAt, extra);
    }
  }
  await prisma.counter.upsert({ where: { name: "buyer" }, create: { name: "buyer", value: BUYERS.length }, update: { value: BUYERS.length } });
  await prisma.counter.upsert({ where: { name: "approved-2026" }, create: { name: "approved-2026", value: approvedSeq }, update: { value: approvedSeq } });
  // ---- sellers: 8–14 per district at every stage
  const TALUKS: Record<string, string[]> = {
    Thiruvananthapuram: ["Neyyattinkara", "Nedumangad"], Kollam: ["Karunagappally", "Kottarakkara"], Pathanamthitta: ["Adoor", "Thiruvalla"],
    Alappuzha: ["Cherthala", "Ambalappuzha"], Kottayam: ["Changanassery", "Vaikom"], Idukki: ["Thodupuzha", "Devikulam"],
    Ernakulam: ["Aluva", "Kanayannur"], Thrissur: ["Chalakudy", "Kodungallur"], Palakkad: ["Ottapalam", "Alathur"],
    Malappuram: ["Tirur", "Perinthalmanna"], Kozhikode: ["Vadakara", "Koyilandy"], Wayanad: ["Mananthavady", "Vythiri"],
    Kannur: ["Thalassery", "Taliparamba"], Kasaragod: ["Hosdurg", "Manjeshwaram"],
  };
  // Urban local bodies come from the master; a district without a corporation uses a municipality.
  const localBody = (district: string, taluk: string, k: number) => {
    const type = (["PANCHAYAT", "MUNICIPALITY", "CORPORATION"] as const)[k % 3];
    const corp = CORPORATIONS[district] ?? [], muni = MUNICIPALITIES[district] ?? [];
    if (type === "CORPORATION" && corp.length) return { localBodyType: type, localBodyName: corp[0] };
    if (type !== "PANCHAYAT" && muni.length) return { localBodyType: "MUNICIPALITY" as const, localBodyName: muni[k % muni.length] };
    return { localBodyType: "PANCHAYAT" as const, localBodyName: `${taluk} North` };
  };
  const EXPORT_MARKETS: string[][] = [
    ["United Arab Emirates", "Saudi Arabia"], ["Germany", "Netherlands", "France"], ["United States"], ["United Kingdom", "Ireland"],
    ["Qatar", "Oman", "Kuwait"], ["Japan", "Singapore"], ["Australia"], ["Canada", "United States"], ["Sri Lanka", "Maldives"],
  ];
  const EXPORTED = ["Black pepper, Cardamom", "Coir mats, Coir yarn", "Cashew kernels", "Handloom sarees", "Herbal oils", "Frozen shrimp", "Rubber mats", "Tea"];
  const SELLER_CERTS: string[][] = [
    ["FSSAI Licence", "HACCP"], ["ISO 9001 (Quality Management)"], [], ["ISO 22000 (Food Safety)", "BRCGS"], ["Halal", "FSSAI Licence"],
    ["GOTS (Organic Textile)"], [], ["USDA Organic", "NPOP / India Organic"], ["ISO 9001 (Quality Management)", "HACCP"], ["Fairtrade"],
  ];
  const FIRMS = ["Spices", "Coir Works", "Cashew Exports", "Agro Foods", "Handlooms", "Ayurveda", "Rubber Products", "Bamboo Crafts", "Tea Estates", "Seafoods", "Furniture", "Herbals"];
  const PEOPLE = ["Anil Kumar", "Suresh Nair", "Lakshmi Menon", "Joseph Thomas", "Fathima Beevi", "Rajesh Pillai", "Mini Joseph", "Abdul Rahman", "Deepa Varghese", "Vinod Krishnan"];
  type St = "WITH_TALUK" | "WITH_SELLER" | "NOT_RECOMMENDED" | "RECOMMENDED" | "RETURNED" | "INITIAL_APPROVED" | "TRAINED" | "APPROVED" | "REJECTED";
  const STATES: St[] = ["APPROVED", "APPROVED", "RECOMMENDED", "WITH_TALUK", "APPROVED", "RETURNED", "INITIAL_APPROVED", "APPROVED", "TRAINED", "REJECTED", "NOT_RECOMMENDED", "INITIAL_APPROVED", "APPROVED", "WITH_TALUK"];
  const districtUsers = await prisma.user.findMany({ where: { role: "DISTRICT" } });
  const talukUsers = await prisma.user.findMany({ where: { role: "TALUK" } });
  const trainer = await prisma.user.findUnique({ where: { username: "training" } });
  // Awareness sessions: one held per district (attendance marked), and two coming up for all districts.
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  let batchSeq = 0;
  const mkBatch = async (district: string | null, date: Date, venue: string) => {
    batchSeq++;
    return prisma.trainingBatch.create({ data: { seq: batchSeq, date: ymd(date), startTime: "10:00", endTime: "13:00", venue, district, createdById: null,
      name: `Batch ${String(batchSeq).padStart(2, "0")} · ${district ?? "All districts"} · ${new Date(ymd(date)).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}` } });
  };
  const upcoming = [
    await mkBatch(null, new Date(Date.now() + 9 * day), "Conference Hall, Directorate of Industries & Commerce, Thiruvananthapuram"),
    await mkBatch(null, new Date(Date.now() + 16 * day), "KSIDC Hall, Kochi"),
  ];
  const held = new Map<string, Awaited<ReturnType<typeof mkBatch>>>();
  let sSeq = 0, sApproved = 0;
  for (const [di, [district, taluks]] of Object.entries(TALUKS).entries()) {
    const du = districtUsers.find((u) => u.district === district);
    if (!held.has(district)) held.set(district, await mkBatch(district, new Date(Date.now() - (30 - di) * day), `District Industries Centre, ${district}`));
    const heldBatch = held.get(district)!;
    const count = 8 + ((di * 5) % 7);
    for (let k = 0; k < count; k++) {
      sSeq++;
      const source = k % 4 === 0 ? "SELF" : k % 4 === 1 ? "BULK" : "DISTRICT";
      // Some online applications are back with the applicant for correction.
      const status: St = source === "SELF" && STATES[(sSeq + di) % STATES.length] === "WITH_TALUK" && k % 8 === 0
        ? "WITH_SELLER" : STATES[(sSeq + di) % STATES.length];
      const taluk = taluks[k % 2];
      const tu = talukUsers.find((u) => u.district === district && u.taluk === taluk);
      const recommended = ["RECOMMENDED", "RETURNED", "INITIAL_APPROVED", "TRAINED", "APPROVED"].includes(status);
      const initial = ["INITIAL_APPROVED", "TRAINED", "APPROVED"].includes(status);
      // A few approved sellers were absent and approved by the Directorate without the session.
      const bypassed = status === "APPROVED" && sSeq % 9 === 0;
      const trained = status === "TRAINED" || (status === "APPROVED" && !bypassed);
      const firm = `${district.slice(0, 3)}${["ra", "vi", "ka", "na", "sha"][k % 5]} ${FIRMS[(sSeq + k) % FIRMS.length]}`;
      const created = new Date(Date.now() - (200 - sSeq) * day * 0.15);
      const mobile = `9${String(400000000 + sSeq * 7351).slice(0, 9)}`;
      const person = PEOPLE[(sSeq + di) % PEOPLE.length];
      let userId: string | undefined, approvedNo: string | undefined, aSeq: number | undefined;
      if (status === "APPROVED") {
        sApproved++; aSeq = sApproved;
        approvedNo = `RBSM-Seller-2026${String(sApproved).padStart(3, "0")}`;
      }
      // Every seller has a login from registration (temporary until final approval).
      {
        const u = await prisma.user.create({ data: { username: `Tradex2027-S${String(sSeq).padStart(3, "0")}`, passwordHash: hash, role: "SELLER", displayName: firm } });
        userId = u.id;
      }
      const seller = await prisma.seller.create({
        data: {
          seq: sSeq, regNo: `RBSM-S-${String(sSeq).padStart(3, "0")}`, name: firm, district, taluk,
          ...localBody(district, taluk, k),
          iecNo: k % 3 !== 0 ? `${"ABCDEFGHJK"[sSeq % 10]}${"LMNPQRSTUV"[(sSeq * 3) % 10]}${"WXYZABCDEF"[(sSeq * 7) % 10]}PK${String(1000 + sSeq * 13).slice(-4)}${"QRSTUVWXYZ"[sSeq % 10]}` : (k % 6 === 3 ? `${"ABCDEFGHJK"[sSeq % 10]}MNPS${String(2000 + sSeq).slice(-4)}L` : null),
          certifications: JSON.stringify(SELLER_CERTS[sSeq % SELLER_CERTS.length]),
          exportCountries: JSON.stringify(k % 3 !== 0 ? EXPORT_MARKETS[sSeq % EXPORT_MARKETS.length] : []),
          exportedProducts: k % 3 !== 0 ? EXPORTED[sSeq % EXPORTED.length] : null,
          udyamNo: `UDYAM-KL-${String(di + 1).padStart(2, "0")}-${String(1000000 + sSeq * 37).slice(0, 7)}`,
          exportExperience: k % 3 !== 0, contactName: person, contactMobile: mobile, contactWhatsapp: mobile,
          contactEmail: `${person.split(" ")[0].toLowerCase()}${sSeq}@msme.example`, source, createdById: source === "SELF" ? null : du?.id,
          status, createdAt: created, recommendedAt: recommended ? after(created, 1 + (k % 4)) : null,
          initialApprovedAt: initial ? after(created, 2 + (k % 4)) : null,
          trainedAt: trained ? new Date(heldBatch.date + "T13:00:00Z") : null, bypassed,
          approvedAt: status === "APPROVED" ? after(created, 3 + (k % 4) + (sSeq % 3)) : null,
          updatedAt: recommended ? after(created, 1 + (k % 4)) : created, approvedSeq: aSeq, approvedNo, userId,
          products: {
            create: [0, 1].slice(0, 1 + (k % 2)).map((j) => {
              const sector = needSectors[(sSeq + j * 3) % needSectors.length];
              const key = Object.keys(NEEDS).find((n) => n === sector.name)!;
              return { sectorId: sector.id, products: NEEDS[key][0][0], sortOrder: j };
            }),
          },
        },
      });
      const slog = (action: string, actorId: string | null | undefined, actorRole: "DISTRICT" | "TALUK" | "DIC" | "TRAINING" | null, comment?: string) =>
        prisma.sellerLog.create({ data: { sellerId: seller.id, actorId: actorId ?? null, actorRole, action: action as never, createdAt: created, comment } });
      await slog("REGISTERED", source === "SELF" ? null : du?.id, source === "SELF" ? null : "DISTRICT", source === "SELF" ? "Self-registered on the portal" : source === "BULK" ? "Added by bulk upload" : undefined);
      if (recommended) await slog("RECOMMENDED", tu?.id, "TALUK");
      if (status === "RETURNED") await slog("RETURNED", dic.id, "DIC", "Udyam certificate details do not match. Please verify.");
      if (status === "WITH_SELLER") await slog("SENT_TO_SELLER", tu?.id, "TALUK", "Please upload the correct Udyam number and add the products you can export.");
      if (status === "NOT_RECOMMENDED") await slog("NOT_RECOMMENDED", tu?.id, "TALUK", "Unit not functional at the given address on verification.");
      if (status === "REJECTED") { await slog("RECOMMENDED", tu?.id, "TALUK"); await slog("REJECTED", dic.id, "DIC", "Enterprise is not export-ready at present."); }
      if (initial) await slog("INITIAL_APPROVED", dic.id, "DIC");
      // Awareness sessions: attended the district session / absent / placed in an upcoming one / not yet placed.
      const member = (batchId: string, attendance: "PENDING" | "PRESENT" | "ABSENT") => prisma.batchMember.create({ data: {
        batchId, sellerId: seller.id, attendance, assignedById: du?.id ?? null, markedById: attendance === "PENDING" ? null : trainer?.id ?? null,
        markedAt: attendance === "PENDING" ? null : new Date(heldBatch.date + "T13:00:00Z") } });
      if (initial) {
        if (trained) {
          await member(heldBatch.id, "PRESENT");
          await slog("BATCH_ASSIGNED", du?.id, "DISTRICT", `Placed in ${heldBatch.name}`);
          await slog("ATTENDED", trainer?.id, "TRAINING");
        } else if (bypassed || (status === "INITIAL_APPROVED" && k % 3 === 0)) {
          await member(heldBatch.id, "ABSENT");
          await slog("BATCH_ASSIGNED", du?.id, "DISTRICT", `Placed in ${heldBatch.name}`);
          await slog("ABSENT", trainer?.id, "TRAINING");
        } else if (status === "INITIAL_APPROVED" && k % 3 === 1) {
          const ub = upcoming[sSeq % 2];
          await member(ub.id, "PENDING");
          await slog("BATCH_ASSIGNED", du?.id, "DISTRICT", `Placed in ${ub.name}`);
        }
      }
      if (status === "APPROVED") await slog(bypassed ? "BYPASSED" : "APPROVED", dic.id, "DIC", bypassed ? "Unit in peak export season; promoter attended the earlier FIEO export orientation." : undefined);
    }
  }
  await prisma.counter.upsert({ where: { name: "training-batch" }, create: { name: "training-batch", value: batchSeq }, update: { value: batchSeq } });
  await prisma.counter.upsert({ where: { name: "seller" }, create: { name: "seller", value: sSeq }, update: { value: sSeq } });
  await prisma.counter.upsert({ where: { name: "seller-approved-2026" }, create: { name: "seller-approved-2026", value: sApproved }, update: { value: sApproved } });

  // Matchmaking: buyer directory open; about half the approved sellers have given tentative preferences.
  await prisma.matchSetting.upsert({ where: { key: "buyersVisible" }, create: { key: "buyersVisible", value: "true" }, update: { value: "true" } });
  const approvedBuyers = await prisma.buyer.findMany({
    where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" },
    select: { id: true, requirement: { select: { items: { where: { status: "APPROVED" }, select: { sectorId: true } } } } },
  });
  const approvedSellers = await prisma.seller.findMany({ where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" },
    select: { id: true, district: true, approvedAt: true, userId: true, products: { select: { sectorId: true } } } });
  // Seller profiles: completed by most approved sellers (every fourth is still pending).
  let profiles = 0;
  for (const [k, sl] of approvedSellers.entries()) {
    if (k % 4 === 3) continue;
    const blocks = BLOCKS[sl.district] ?? [];
    const at = new Date((sl.approvedAt ?? new Date()).getTime() + (1 + (k % 3)) * day);
    await prisma.seller.update({ where: { id: sl.id }, data: {
      promoterGender: [GENDERS[0], GENDERS[1], GENDERS[0], GENDERS[1], GENDERS[0], GENDERS[4]][k % 6].value,
      promoterDob: new Date(Date.UTC(1965 + (k * 7) % 30, (k * 5) % 12, 1 + (k * 11) % 27)),
      socialCategory: SOCIAL_CATEGORIES[[0, 1, 1, 0, 2, 1, 0, 3][k % 8]].value, speciallyAbled: k % 11 === 5,
      block: blocks[k % blocks.length], constitution: CONSTITUTIONS[[0, 0, 2, 1, 4, 0, 5, 6, 2][k % 9]].value,
      unitCategory: UNIT_CATEGORIES[[0, 0, 1, 0, 1, 2, 0, 1][k % 8]].value, unitType: UNIT_TYPES[[0, 0, 2, 0, 1, 0][k % 6]].value,
      profileCompletedAt: at > new Date() ? new Date() : at,
    } });
    await prisma.sellerLog.create({ data: { sellerId: sl.id, actorId: sl.userId, actorRole: "SELLER", action: "PROFILE_UPDATED", comment: "Profile completed", createdAt: at > new Date() ? new Date() : at } });
    profiles++;
  }
  let prefSellers = 0;
  for (const [k, sl] of approvedSellers.entries()) {
    // Only sellers with a completed profile can give preferences.
    if (k % 2 || k % 4 === 3) continue;
    const mine = new Set(sl.products.map((p) => p.sectorId));
    const relevant = approvedBuyers.filter((b) => b.requirement?.items.some((i) => mine.has(i.sectorId)));
    const picks = [...relevant, ...approvedBuyers.filter((b) => !relevant.includes(b))].slice(0, 1 + (k % 5)).map((b) => b.id);
    if (!picks.length) continue;
    await prisma.sellerPreference.createMany({ data: picks.map((buyerId, r) => ({ sellerId: sl.id, buyerId, rank: r + 1 })) });
    await prisma.seller.update({ where: { id: sl.id }, data: { prefSubmittedAt: new Date(Date.now() - (k % 7) * day) } });
    prefSellers++;
  }

  // Communications: two common communications and a few programme-desk conversations.
  const staffDic = await prisma.user.findFirst({ where: { role: "DIC" } });
  const staffFieo = await prisma.user.findFirst({ where: { role: "FIEO" } });
  if (staffDic && staffFieo) {
    const allBuyers = await prisma.buyer.findMany({ select: { id: true, userId: true, name: true } });
    const apprSellers = await prisma.seller.findMany({ where: { status: "APPROVED", userId: { not: null } }, select: { id: true, userId: true, name: true } });
    const ago = (d: number) => new Date(Date.now() - d * day);
    await prisma.announcement.create({ data: {
      authorId: staffDic.id, authorRole: "DIC", audience: "ALL_PARTICIPANTS", audienceLabel: "All buyers and approved sellers",
      subject: "Welcome to the TRADEX 2.0 Reverse Buyer Seller Meet", createdAt: ago(6),
      body: "Thank you for registering. The Directorate will open the approved buyer directory to sellers shortly. Please keep your details up to date and write to the programme desk for any help.",
      recipients: { create: [...allBuyers.map((b) => ({ userId: b.userId, readAt: b.name.length % 2 ? ago(5) : null })), ...apprSellers.map((s) => ({ userId: s.userId!, readAt: s.name.length % 3 ? ago(4) : null }))] },
    } });
    await prisma.announcement.create({ data: {
      authorId: staffFieo.id, authorRole: "FIEO", audience: "ALL_BUYERS", audienceLabel: "All registered buyers (every stage)",
      subject: "Complete your sector requirements", createdAt: ago(3),
      body: "Buyers who have not yet submitted their sector requirements are requested to do so this week, so that FIEO can review them before matchmaking.",
      recipients: { create: allBuyers.map((b) => ({ userId: b.userId })) },
    } });
    const deskB = allBuyers.slice(0, 3);
    for (const [i, b] of deskB.entries()) {
      const c = await prisma.conversation.create({ data: { kind: "DESK_BUYER", buyerId: b.id, createdAt: ago(5 - i), lastMessageAt: ago(4 - i) } });
      await prisma.message.create({ data: { conversationId: c.id, authorId: b.userId, authorRole: "BUYER", createdAt: ago(5 - i),
        body: ["Can we send samples ahead of the meet? Please advise on the shipping address.", "Will interpreters be available during the one-to-one meetings?", "Could you confirm the meeting schedule format?"][i] } });
      if (i < 2) await prisma.message.create({ data: { conversationId: c.id, authorId: (i ? staffFieo : staffDic).id, authorRole: i ? "FIEO" : "DIC", createdAt: ago(4 - i),
        body: ["Yes. Samples can be sent to the Directorate of Industries & Commerce, Thiruvananthapuram, marked TRADEX 2.0. We will hand them over to the matched sellers.", "Yes, interpreters for major languages will be available on request. Please list the languages you need."][i] } });
    }
    for (const s of apprSellers.slice(0, 2)) {
      const c = await prisma.conversation.create({ data: { kind: "DESK_SELLER", sellerId: s.id, createdAt: ago(2), lastMessageAt: ago(2) } });
      await prisma.message.create({ data: { conversationId: c.id, authorId: s.userId!, authorRole: "SELLER", createdAt: ago(2), body: "How should we prepare for the buyer meetings? Is there a format for product presentations?" } });
    }
  }

  // Event days (two days, a month ahead), nodal officers, pavilions by first sector.
  const d0 = new Date(Date.now() + 30 * day);
  for (const [i, extra] of [0, 1].entries()) {
    const date = new Date(d0.getTime() + extra * day).toISOString().slice(0, 10);
    await prisma.eventDay.create({ data: { date, startTime: "09:30", endTime: i ? "16:30" : "17:30",
      breaks: JSON.stringify([{ label: "Tea break", start: "11:10", end: "11:30" }, { label: "Lunch break", start: "13:00", end: "14:00" }]) } });
  }
  await prisma.matchSetting.createMany({ data: [{ key: "event.meetingMinutes", value: "30" }, { key: "event.bufferMinutes", value: "10" }, { key: "event.venue", value: "Kerala Trade Centre, Kochi" }] });
  const officerNames = [["Anitha Kumari", "Deputy Director"], ["Biju Varghese", "Assistant Director"], ["Shameer Ali", "Industries Extension Officer"], ["Rekha Nair", "Assistant Director"]];
  const officerIds: string[] = [];
  for (const [i, [name, desig]] of officerNames.entries()) {
    const u = await prisma.user.create({ data: { username: `nodal${String(i + 1).padStart(2, "0")}`, passwordHash: hash, role: "NODAL", displayName: name,
      nodalOfficer: { create: { name, designation: desig, mobile: `94470${String(10001 + i * 111).padStart(5, "0")}`, email: `nodal${i + 1}@industries.kerala.example` } } }, include: { nodalOfficer: true } });
    officerIds.push(u.nodalOfficer!.id);
  }
  const seated = await prisma.buyer.findMany({ where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" },
    select: { id: true, approvedSeq: true, requirement: { select: { items: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" }, select: { sector: { select: { name: true, sortOrder: true } } } } } } } });
  seated.sort((a, b) => (a.requirement?.items[0]?.sector.sortOrder ?? 999) - (b.requirement?.items[0]?.sector.sortOrder ?? 999) || (a.approvedSeq ?? 0) - (b.approvedSeq ?? 0));
  const per = Math.ceil(seated.length / officerIds.length);
  for (const [i, b] of seated.entries()) await prisma.buyer.update({ where: { id: b.id }, data: { pavilionNo: i + 1, nodalOfficerId: officerIds[Math.floor(i / per)] } });

  // MoUs after successful meetings: approved, with the nodal officer / FIEO, and one returned — US$ and INR values.
  const fieoU = await prisma.user.findFirst({ where: { role: "FIEO" } });
  const dicU = await prisma.user.findFirst({ where: { role: "DIC" } });
  const mouBuyers = await prisma.buyer.findMany({ where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" },
    select: { id: true, approvedSeq: true, nodalOfficer: { select: { userId: true } }, requirement: { select: { items: { where: { status: "APPROVED" }, select: { sectorId: true, products: true } } } } } });
  const mouSellers = await prisma.seller.findMany({ where: { status: "APPROVED" }, orderBy: { approvedSeq: "asc" }, select: { id: true, approvedSeq: true, products: { select: { sectorId: true, products: true } } } });
  const GOODS = ["Instant chutney powders — 200 g retail packs", "Black pepper and green cardamom, bulk 25 kg bags", "Coir mats and brushed doormats, private label",
    "Handloom table linen and cushion covers", "Frozen shrimp (PD, 16/20) — IQF cartons", "Ayurvedic herbal teas and wellness blends", "Teak and rosewood handicrafts",
    "Roasted cashew kernels W240, vacuum packs", "Bamboo home décor and lamps", "Banana chips and tapioca snacks, export packs"];
  let mouSeq = 0;
  for (const [i, b] of mouBuyers.entries()) {
    const sectors = new Set((b.requirement?.items ?? []).map((x) => x.sectorId));
    const partners = mouSellers.filter((x) => x.products.some((p) => sectors.has(p.sectorId))).slice(i % 3, (i % 3) + 1 + (i % 3));
    for (const [k, sel] of partners.entries()) {
      mouSeq++;
      const n = mouSeq;
      const status = n % 9 === 0 ? "RETURNED" : n % 4 === 0 ? "SUBMITTED" : "APPROVED";
      const usd = n % 5 !== 2;
      const amount = n % 11 === 0 ? null : usd ? [25000, 60000, 120000, 45000, 250000, 80000, 15000, 500000][n % 8] : [1500000, 4200000, 9000000, 2500000][n % 4];
      const when = new Date(Date.now() - (n % 3) * day - n * 37 * 60000);
      const nodalBy = b.nodalOfficer?.userId ?? dicU!.id;
      const prior = await prisma.mou.count({ where: { buyerId: b.id, sellerId: sel.id } });
      await prisma.mou.create({ data: {
        seq: n, mouNo: `RBSM-MOU-2026-B${String(b.approvedSeq).padStart(3, "0")}-S${String(sel.approvedSeq).padStart(3, "0")}${prior ? `-${prior + 1}` : ""}`,
        buyerId: b.id, sellerId: sel.id, sectorId: sel.products.find((p) => sectors.has(p.sectorId))?.sectorId ?? null,
        goods: (() => { const p = sel.products.find((x) => sectors.has(x.sectorId))?.products; return p ? `${p.split(/,\s*/).slice(0, 2).join(" and ")} — ${["export packs", "bulk, 25 kg bags", "private label", "retail packs"][n % 4]}` : GOODS[(n + k) % GOODS.length]; })(), currency: usd ? "USD" : "INR", amount,
        orderMonth: new Date(Date.now() + (1 + (n % 5)) * 31 * day).toISOString().slice(0, 7),
        status, submittedAt: when,
        ...(status === "APPROVED" ? { nodalVerifiedAt: when, nodalVerifiedById: nodalBy, fieoApprovedAt: when, fieoApprovedById: fieoU!.id, approvedAt: when } : {}),
        ...(status === "SUBMITTED" && n % 8 === 0 ? { nodalVerifiedAt: when, nodalVerifiedById: nodalBy } : {}),
        ...(status === "RETURNED" ? { returnComment: "Please state the pack size and the quantity per order.", returnedAt: when, returnedById: fieoU!.id } : {}),
      } });
    }
  }
  await prisma.counter.upsert({ where: { name: "mou" }, create: { name: "mou", value: mouSeq }, update: { value: mouSeq } });

  console.log(`Loaded ${BUYERS.length} demo buyers (${approvedSeq} approved) and ${sSeq} demo sellers (${sApproved} approved; ${profiles} profiles completed; ${prefSellers} with buyer preferences), ${mouSeq} MoUs. Demo password: pass@123`);
}

main().finally(() => prisma.$disconnect());
