-- CreateTable
CREATE TABLE "RawEmail" (
    "id" TEXT NOT NULL,
    "emailAccountId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "subject" TEXT,
    "fromAddress" TEXT,
    "receivedAt" TIMESTAMP(3),
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "matchedApplicationId" TEXT,
    "extractionConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RawEmail_emailAccountId_gmailMessageId_key" ON "RawEmail"("emailAccountId", "gmailMessageId");

-- AddForeignKey
ALTER TABLE "RawEmail" ADD CONSTRAINT "RawEmail_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
