-- CreateTable
CREATE TABLE "SavedTheme" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokens" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedTheme_userId_idx" ON "SavedTheme"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedTheme_userId_name_key" ON "SavedTheme"("userId", "name");

-- AddForeignKey
ALTER TABLE "SavedTheme" ADD CONSTRAINT "SavedTheme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
