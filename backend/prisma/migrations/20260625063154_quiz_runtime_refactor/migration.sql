/*
  Warnings:

  - You are about to drop the column `isPublished` on the `Quiz` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'READY', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Quiz" DROP COLUMN "isPublished",
ADD COLUMN     "actualStartTime" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledStartTime" TIMESTAMP(3),
ADD COLUMN     "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT';
