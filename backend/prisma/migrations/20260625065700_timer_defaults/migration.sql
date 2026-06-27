/*
  Warnings:

  - The values [READY] on the enum `QuizStatus` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `defaultTimer` on table `Quiz` required. This step will fail if there are existing NULL values in that column.
  - Made the column `scheduledStartTime` on table `Quiz` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "QuizStatus_new" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."Quiz" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Quiz" ALTER COLUMN "status" TYPE "QuizStatus_new" USING ("status"::text::"QuizStatus_new");
ALTER TYPE "QuizStatus" RENAME TO "QuizStatus_old";
ALTER TYPE "QuizStatus_new" RENAME TO "QuizStatus";
DROP TYPE "public"."QuizStatus_old";
ALTER TABLE "Quiz" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "Question" ALTER COLUMN "timerSeconds" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Quiz" ALTER COLUMN "defaultTimer" SET NOT NULL,
ALTER COLUMN "scheduledStartTime" SET NOT NULL;
