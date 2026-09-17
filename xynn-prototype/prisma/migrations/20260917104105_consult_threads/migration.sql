-- CreateTable
CREATE TABLE "ConsultThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Konsultasi baru',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultThread_userId_updatedAt_idx" ON "ConsultThread"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ConsultMessage_threadId_createdAt_idx" ON "ConsultMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsultThread" ADD CONSTRAINT "ConsultThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultThread" ADD CONSTRAINT "ConsultThread_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultMessage" ADD CONSTRAINT "ConsultMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ConsultThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
