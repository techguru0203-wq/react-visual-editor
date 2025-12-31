/*
  Warnings:

  - The primary key for the `chatHistories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `role` to the `chatHistories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `chatHistories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "chatHistories" DROP CONSTRAINT "chatHistories_pkey",
ADD COLUMN     "role" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "chatHistories_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "chatHistories_id_seq";
