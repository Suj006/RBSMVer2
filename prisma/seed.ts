import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { TALUKS } from "../src/lib/kerala";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

// Phase-1 staff logins (change before going live).
const STAFF = [
  { username: "fieo", password: "pass@123", role: "FIEO", displayName: "FIEO Desk" },
  { username: "dic123", password: "dic123", role: "DIC", displayName: "Directorate of Industries & Commerce" },
  { username: "admin", password: "admin", role: "ADMIN", displayName: "Portal Administrator" },
  { username: "training", password: "pass@123", role: "TRAINING", displayName: "Training Admin (Awareness Sessions)" },
] as const;

// One login per District Industries Centre: dic-tvm … dic-ksd (phase-1 password pass@123).
const DISTRICTS: [string, string][] = [
  ["Thiruvananthapuram", "tvm"], ["Kollam", "klm"], ["Pathanamthitta", "pta"], ["Alappuzha", "alp"],
  ["Kottayam", "ktm"], ["Idukki", "idk"], ["Ernakulam", "ekm"], ["Thrissur", "tsr"], ["Palakkad", "pkd"],
  ["Malappuram", "mlp"], ["Kozhikode", "kkd"], ["Wayanad", "wyd"], ["Kannur", "knr"], ["Kasaragod", "ksd"],
];

const SECTORS = [
  "Agriculture & Allied Products",
  "Spices & Condiments",
  "Tea & Coffee",
  "Cashew & Dry Fruits",
  "Marine & Seafood Products",
  "Processed Food & Beverages",
  "Coir & Coir Products",
  "Handloom & Textiles",
  "Apparel & Garments",
  "Handicrafts & Home Decor",
  "Bamboo & Wood Products",
  "Furniture",
  "Rubber & Rubber Products",
  "Ayurveda, Herbal & Wellness",
  "Pharmaceuticals & Healthcare",
  "Cosmetics & Personal Care",
  "Chemicals & Plastics",
  "Engineering & Capital Goods",
  "Electrical & Electronics",
  "IT & Software Services",
  "Leather & Footwear",
  "Gems & Jewellery",
  "Paper & Packaging",
  "Building Materials",
  "Toys & Sports Goods",
];

const CERTIFICATIONS = [
  "ISO 9001 (Quality Management)",
  "ISO 14001 (Environmental Management)",
  "ISO 22000 (Food Safety)",
  "ISO 45001 (Occupational Health & Safety)",
  "FSSC 22000",
  "HACCP",
  "BRCGS",
  "GMP",
  "WHO-GMP",
  "US FDA Registration",
  "CE Marking",
  "BIS Certification",
  "FSSAI Licence",
  "NPOP / India Organic",
  "USDA Organic",
  "EU Organic",
  "Fairtrade",
  "Rainforest Alliance",
  "Halal",
  "Kosher",
  "GOTS (Organic Textile)",
  "OEKO-TEX",
  "SA8000",
  "Sedex / SMETA",
  "RoHS",
  "AYUSH Premium Mark",
  "APEDA / Export Promotion Council RCMC",
];

async function main() {
  for (const s of STAFF) {
    await prisma.user.upsert({
      where: { username: s.username },
      update: {},
      create: {
        username: s.username,
        passwordHash: await bcrypt.hash(s.password, 10),
        role: s.role,
        displayName: s.displayName,
      },
    });
  }
  const districtHash = await bcrypt.hash("pass@123", 10);
  for (const [name, code] of DISTRICTS) {
    await prisma.user.upsert({
      where: { username: `dic-${code}` },
      update: { district: name },
      create: { username: `dic-${code}`, passwordHash: districtHash, role: "DISTRICT", district: name, displayName: `DIC ${name}` },
    });
  }
  // One login per Taluk Industries Office: tlk-<taluk> (phase-1 password pass@123), e.g. tlk-aluva.
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let taluks = 0;
  for (const [district, list] of Object.entries(TALUKS)) {
    for (const taluk of list) {
      await prisma.user.upsert({
        where: { username: `tlk-${slug(taluk)}` },
        update: { district, taluk },
        create: { username: `tlk-${slug(taluk)}`, passwordHash: districtHash, role: "TALUK", district, taluk, displayName: `Taluk Industries Office, ${taluk}` },
      });
      taluks++;
    }
  }
  for (const [i, name] of SECTORS.entries()) {
    await prisma.sector.upsert({ where: { name }, update: {}, create: { name, sortOrder: i + 1 } });
  }
  for (const name of CERTIFICATIONS) {
    await prisma.certification.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Seeded ${STAFF.length} staff logins, ${DISTRICTS.length} district logins, ${taluks} taluk logins, ${SECTORS.length} sectors, ${CERTIFICATIONS.length} certifications.`);
}

main().finally(() => prisma.$disconnect());
