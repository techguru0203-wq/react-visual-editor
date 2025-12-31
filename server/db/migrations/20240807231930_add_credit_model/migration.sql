-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "type" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "seats" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "subscription_status" DROP DEFAULT;

-- CreateTable
CREATE TABLE "creditActions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "creditActions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "creditActions" ADD CONSTRAINT "creditActions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditActions" ADD CONSTRAINT "creditActions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
