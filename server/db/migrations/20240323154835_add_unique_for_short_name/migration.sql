/*
  Warnings:

  - A unique constraint covering the columns `[shortName]` on the table `issues` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shortName]` on the table `projects` will be added. If there are existing duplicate values, this will fail.
  - Made the column `shortName` on table `issues` required. This step will fail if there are existing NULL values in that column.
  - Made the column `shortName` on table `projects` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "issues" ALTER COLUMN "shortName" SET NOT NULL;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "shortName" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "issues_shortName_key" ON "issues"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "projects_shortName_key" ON "projects"("shortName");
