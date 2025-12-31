/*
  Warnings:

  - You are about to drop the column `googleAuthId` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "googleAuthId",
ADD COLUMN     "google_auth_id" TEXT;
