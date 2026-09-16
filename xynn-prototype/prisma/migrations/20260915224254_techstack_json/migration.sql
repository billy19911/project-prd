-- AlterTable: Workspace.techStack from TEXT[] to JSONB (PRD §5 final schema)
ALTER TABLE "Workspace"
  ALTER COLUMN "techStack" TYPE JSONB
  USING to_jsonb("techStack");

ALTER TABLE "Workspace"
  ALTER COLUMN "techStack" SET DEFAULT '[]'::jsonb;
