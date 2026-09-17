-- CreateTable
CREATE TABLE "PrototypeVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "screens" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrototypeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrototypeVersion_workspaceId_createdAt_idx" ON "PrototypeVersion"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "PrototypeVersion" ADD CONSTRAINT "PrototypeVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
