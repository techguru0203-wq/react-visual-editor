/*
  Warnings:

  - You are about to drop the `specialities` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "specialities" DROP CONSTRAINT "specialities_creator_user_id_fkey";

-- DropForeignKey
ALTER TABLE "specialities" DROP CONSTRAINT "specialities_organization_id_fkey";

-- DropTable
DROP TABLE "specialities";

-- CreateTable
CREATE TABLE "specialties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "organization_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "access" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "meta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "specialties" ADD CONSTRAINT "specialties_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specialties" ADD CONSTRAINT "specialties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
