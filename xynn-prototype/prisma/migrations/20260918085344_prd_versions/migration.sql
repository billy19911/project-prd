-- CreateTable
CREATE TABLE "PrdVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fullPrdMd" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrdVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrdVersion_workspaceId_createdAt_idx" ON "PrdVersion"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "PrdVersion" ADD CONSTRAINT "PrdVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
