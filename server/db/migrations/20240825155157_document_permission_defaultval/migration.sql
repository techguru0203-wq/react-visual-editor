-- AlterTable
ALTER TABLE "documentPermissions" ADD COLUMN     "status" "DocumentPermissionStatus" NOT NULL DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE "documentPermissions" ADD CONSTRAINT "documentPermissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
