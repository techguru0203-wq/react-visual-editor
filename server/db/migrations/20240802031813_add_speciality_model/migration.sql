-- AlterEnum
ALTER TYPE "Access" ADD VALUE 'PUBLIC';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'VIRTUALEMPLOYEE';

-- CreateTable
CREATE TABLE "specialities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "access" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "meta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "specialities_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "specialities" ADD CONSTRAINT "specialities_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specialities" ADD CONSTRAINT "specialities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
