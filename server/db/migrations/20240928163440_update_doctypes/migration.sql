-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DOCTYPE" ADD VALUE 'PRODUCT';
ALTER TYPE "DOCTYPE" ADD VALUE 'BUSINESS';
ALTER TYPE "DOCTYPE" ADD VALUE 'MARKETING';
ALTER TYPE "DOCTYPE" ADD VALUE 'SALES';
ALTER TYPE "DOCTYPE" ADD VALUE 'SUPPORT';
