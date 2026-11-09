-- AlterTable
ALTER TABLE "User" ADD COLUMN "taluk" TEXT;

-- CreateTable
CREATE TABLE "TrainingBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "district" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BatchMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "attendance" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedById" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedById" TEXT,
    "markedAt" DATETIME,
    CONSTRAINT "BatchMember_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TrainingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BatchMember_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Seller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "regNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "taluk" TEXT NOT NULL,
    "localBodyType" TEXT NOT NULL,
    "localBodyName" TEXT NOT NULL,
    "udyamNo" TEXT NOT NULL,
    "exportExperience" BOOLEAN NOT NULL,
    "exportCountries" TEXT NOT NULL DEFAULT '[]',
    "exportedProducts" TEXT,
    "iecNo" TEXT,
    "certifications" TEXT NOT NULL DEFAULT '[]',
    "promoterGender" TEXT,
    "promoterDob" DATETIME,
    "socialCategory" TEXT,
    "speciallyAbled" BOOLEAN,
    "block" TEXT,
    "constitution" TEXT,
    "unitCategory" TEXT,
    "unitType" TEXT,
    "profileCompletedAt" DATETIME,
    "contactName" TEXT NOT NULL,
    "contactMobile" TEXT NOT NULL,
    "contactWhatsapp" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WITH_TALUK',
    "recommendedAt" DATETIME,
    "initialApprovedAt" DATETIME,
    "trainedAt" DATETIME,
    "bypassed" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "approvedSeq" INTEGER,
    "approvedNo" TEXT,
    "userId" TEXT,
    "prefSubmittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Seller_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Seller" ("approvedAt", "approvedNo", "approvedSeq", "block", "certifications", "constitution", "contactEmail", "contactMobile", "contactName", "contactWhatsapp", "createdAt", "createdById", "district", "exportCountries", "exportExperience", "exportedProducts", "id", "iecNo", "localBodyName", "localBodyType", "name", "prefSubmittedAt", "profileCompletedAt", "promoterDob", "promoterGender", "recommendedAt", "regNo", "seq", "socialCategory", "source", "speciallyAbled", "status", "taluk", "udyamNo", "unitCategory", "unitType", "updatedAt", "userId") SELECT "approvedAt", "approvedNo", "approvedSeq", "block", "certifications", "constitution", "contactEmail", "contactMobile", "contactName", "contactWhatsapp", "createdAt", "createdById", "district", "exportCountries", "exportExperience", "exportedProducts", "id", "iecNo", "localBodyName", "localBodyType", "name", "prefSubmittedAt", "profileCompletedAt", "promoterDob", "promoterGender", "recommendedAt", "regNo", "seq", "socialCategory", "source", "speciallyAbled", "status", "taluk", "udyamNo", "unitCategory", "unitType", "updatedAt", "userId" FROM "Seller";
DROP TABLE "Seller";
ALTER TABLE "new_Seller" RENAME TO "Seller";
CREATE UNIQUE INDEX "Seller_seq_key" ON "Seller"("seq");
CREATE UNIQUE INDEX "Seller_regNo_key" ON "Seller"("regNo");
CREATE UNIQUE INDEX "Seller_udyamNo_key" ON "Seller"("udyamNo");
CREATE UNIQUE INDEX "Seller_approvedSeq_key" ON "Seller"("approvedSeq");
CREATE UNIQUE INDEX "Seller_approvedNo_key" ON "Seller"("approvedNo");
CREATE UNIQUE INDEX "Seller_userId_key" ON "Seller"("userId");
CREATE INDEX "Seller_district_status_idx" ON "Seller"("district", "status");
CREATE INDEX "Seller_status_idx" ON "Seller"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TrainingBatch_seq_key" ON "TrainingBatch"("seq");

-- CreateIndex
CREATE INDEX "BatchMember_sellerId_idx" ON "BatchMember"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchMember_batchId_sellerId_key" ON "BatchMember"("batchId", "sellerId");

-- Applications that were with the district office now wait for the taluk office.
UPDATE "Seller" SET "status" = 'WITH_TALUK' WHERE "status" = 'WITH_DISTRICT';
