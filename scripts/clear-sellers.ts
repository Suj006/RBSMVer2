/**
 * Clears every seller so fresh registrations can start (the new taluk → Directorate → awareness session flow).
 *
 *   npm run db:clear-sellers -- --yes             sellers and their logins
 *   npm run db:clear-sellers -- --yes --sessions  also the awareness sessions
 *
 * Removes all sellers with everything that belongs to them (products, history, awareness-session places,
 * preferences, buyer–seller mapping, meetings, MoUs, conversations) and the sellers' logins, and restarts the
 * seller numbering (RBSM-S-001, RBSM-Seller-2026001). Buyers, staff, taluk and district logins, sectors,
 * certifications and targets are kept. Take a copy of dev.db first if you may need the old data.
 */
import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { EVENT } from "../src/lib/config";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }) });
const dbFile = path.resolve((process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, ""));

async function main() {
  const args = process.argv.slice(2);
  const sellers = await prisma.seller.count();
  if (!args.includes("--yes")) {
    console.log(`${sellers} sellers in ${dbFile}. Nothing changed — run \`npm run db:clear-sellers -- --yes\` to delete them all (add --sessions to delete the awareness sessions too).`);
    return;
  }
  const logins = (await prisma.user.findMany({ where: { role: "SELLER" }, select: { id: true } })).map((u) => u.id);
  await prisma.$transaction(async (tx) => {
    await tx.seller.deleteMany({});
    // Anything the seller logins still own (sessions, messages read / sent, announcement copies) goes with them.
    await tx.session.deleteMany({ where: { userId: { in: logins } } });
    await tx.user.deleteMany({ where: { id: { in: logins } } });
    if (args.includes("--sessions")) await tx.trainingBatch.deleteMany({});
    for (const name of ["seller", `seller-approved-${EVENT.approvedYear}`, ...(args.includes("--sessions") ? ["training-batch"] : [])]) {
      await tx.counter.upsert({ where: { name }, create: { name, value: 0 }, update: { value: 0 } });
    }
  }, { timeout: 120_000 });
  console.log(`Deleted ${sellers} sellers and ${logins.length} seller logins${args.includes("--sessions") ? " and all awareness sessions" : ""} in ${dbFile}. Seller numbering restarts at 001.`);
}

main().finally(() => prisma.$disconnect());
