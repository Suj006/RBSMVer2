-- AlterTable
ALTER TABLE "Buyer" ADD COLUMN "changeAt" DATETIME;
ALTER TABLE "Buyer" ADD COLUMN "changeState" TEXT;
ALTER TABLE "Buyer" ADD COLUMN "pendingChange" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Document_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("buyerId", "id", "kind", "mimeType", "originalName", "size", "storedName", "uploadedAt") SELECT "buyerId", "id", "kind", "mimeType", "originalName", "size", "storedName", "uploadedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE UNIQUE INDEX "Document_buyerId_kind_pending_key" ON "Document"("buyerId", "kind", "pending");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
