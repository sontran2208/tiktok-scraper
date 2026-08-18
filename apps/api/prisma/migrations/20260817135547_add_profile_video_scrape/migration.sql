-- CreateEnum
CREATE TYPE "VideoJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "ScrapeHistory" ADD COLUMN     "videoJobError" TEXT,
ADD COLUMN     "videoJobStatus" "VideoJobStatus";

-- CreateTable
CREATE TABLE "ProfileVideoScrape" (
    "id" TEXT NOT NULL,
    "scrapeHistoryId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "description" TEXT,
    "views" BIGINT,
    "likes" BIGINT,
    "comments" BIGINT,
    "shares" BIGINT,
    "coverUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileVideoScrape_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileVideoScrape_scrapeHistoryId_idx" ON "ProfileVideoScrape"("scrapeHistoryId");

-- CreateIndex
CREATE INDEX "ProfileVideoScrape_videoId_idx" ON "ProfileVideoScrape"("videoId");

-- AddForeignKey
ALTER TABLE "ProfileVideoScrape" ADD CONSTRAINT "ProfileVideoScrape_scrapeHistoryId_fkey" FOREIGN KEY ("scrapeHistoryId") REFERENCES "ScrapeHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
