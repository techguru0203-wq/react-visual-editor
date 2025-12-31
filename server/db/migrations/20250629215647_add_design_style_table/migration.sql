-- CreateEnum
CREATE TYPE "StyleSourceType" AS ENUM ('IMAGE', 'WEBSITE_LINK', 'FIGMA_LINK', 'CODEBASE_LINK');

-- CreateTable
CREATE TABLE "designStyles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "style_info" JSONB NOT NULL,
    "source_type" "StyleSourceType" NOT NULL,
    "source_urls" TEXT[],
    "status" "RecordStatus" NOT NULL,
    "version" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designStyles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "designStyles_organization_id_idx" ON "designStyles"("organization_id");

-- AddForeignKey
ALTER TABLE "designStyles" ADD CONSTRAINT "designStyles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
