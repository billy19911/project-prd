-- AlterTable: Workspace tambah locale (bahasa output AI: 'id' | 'en')
ALTER TABLE "Workspace" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'id';
