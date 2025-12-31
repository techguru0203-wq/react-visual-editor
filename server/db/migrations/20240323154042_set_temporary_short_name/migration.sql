-- Copy issue/project's id to short name before we add unique index in next migration

UPDATE "issues" SET "shortName" = id where "shortName" is null;
UPDATE "projects" SET "shortName" = id where "shortName" is null;
