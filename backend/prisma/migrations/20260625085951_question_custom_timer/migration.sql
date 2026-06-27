/*
  Warnings:

  - You are about to drop the column `timerSeconds` on the `Question` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Question" DROP COLUMN "timerSeconds",
ADD COLUMN     "customTimer" INTEGER;
