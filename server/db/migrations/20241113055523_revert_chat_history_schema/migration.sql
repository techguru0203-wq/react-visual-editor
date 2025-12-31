/*
  Warnings:

  - The primary key for the `chatHistories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `role` on the `chatHistories` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `chatHistories` table. All the data in the column will be lost.
  - The `id` column on the `chatHistories` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "chatHistories" DROP CONSTRAINT "chatHistories_pkey",
DROP COLUMN "role",
DROP COLUMN "updated_at",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "chatHistories_pkey" PRIMARY KEY ("id");
