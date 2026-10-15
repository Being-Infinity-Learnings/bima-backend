-- CreateEnum
CREATE TYPE "CoinTransactionType" AS ENUM ('QUIZ_REWARD', 'REDEMPTION_DEBIT', 'REDEMPTION_REFUND', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CoinReferenceType" AS ENUM ('QUIZ', 'REDEMPTION');

-- CreateEnum
CREATE TYPE "StoreItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'SHIPPED', 'DELIVERED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotifTargetType" ADD VALUE 'USER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coinBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "savedAddressLine1" TEXT,
ADD COLUMN     "savedAddressLine2" TEXT,
ADD COLUMN     "savedCity" TEXT,
ADD COLUMN     "savedContactPhone" TEXT,
ADD COLUMN     "savedCountry" TEXT,
ADD COLUMN     "savedPostalCode" TEXT,
ADD COLUMN     "savedRecipientName" TEXT,
ADD COLUMN     "savedState" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "recipientUserId" TEXT;

-- CreateTable
CREATE TABLE "CoinTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CoinTransactionType" NOT NULL,
    "referenceType" "CoinReferenceType",
    "referenceId" TEXT,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "coinCost" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" "StoreItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "coinCost" INTEGER NOT NULL,
    "recipientName" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "contactPhone" TEXT NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "expectedDeliveryAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "rejectionReason" TEXT,
    "addressEditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinTransaction_userId_createdAt_idx" ON "CoinTransaction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoinTransaction_userId_referenceType_referenceId_type_key" ON "CoinTransaction"("userId", "referenceType", "referenceId", "type");

-- CreateIndex
CREATE INDEX "StoreItem_status_idx" ON "StoreItem"("status");

-- CreateIndex
CREATE INDEX "Redemption_userId_createdAt_idx" ON "Redemption"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Redemption_status_createdAt_idx" ON "Redemption"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Redemption_storeItemId_idx" ON "Redemption"("storeItemId");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_idx" ON "Notification"("recipientUserId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "StoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariants Prisma can't express in the schema

-- Balance and stock are decremented with conditional updates
-- (WHERE coinBalance >= cost / stock >= 1); these are the backstop.
ALTER TABLE "User" ADD CONSTRAINT "User_coinBalance_nonneg" CHECK ("coinBalance" >= 0);
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_stock_nonneg" CHECK ("stock" >= 0);
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_coinCost_positive" CHECK ("coinCost" > 0);
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_coinCost_positive" CHECK ("coinCost" > 0);

-- Ledger entries are never zero.
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_amount_nonzero" CHECK ("amount" <> 0);

-- Every entry except ADMIN_ADJUSTMENT must carry a reference, otherwise the
-- (userId, referenceType, referenceId, type) unique key can't dedupe it
-- (Postgres treats NULLs as distinct).
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_reference_required" CHECK (
  "type" = 'ADMIN_ADJUSTMENT'
  OR ("referenceType" IS NOT NULL AND "referenceId" IS NOT NULL)
);

-- USER-targeted notifications must name their recipient.
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipient_required" CHECK (
  "targetType"::text <> 'USER' OR "recipientUserId" IS NOT NULL
);
