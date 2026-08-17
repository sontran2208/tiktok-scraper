-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ScrapeType" AS ENUM ('VIDEO', 'PROFILE');

-- CreateEnum
CREATE TYPE "ScrapeStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "ScrapeHistory" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "url" TEXT NOT NULL,
    "type" "ScrapeType" NOT NULL,
    "status" "ScrapeStatus" NOT NULL DEFAULT 'SUCCESS',
    "views" BIGINT,
    "likes" BIGINT,
    "comments" BIGINT,
    "shares" BIGINT,
    "followers" BIGINT,
    "totalLikes" BIGINT,
    "totalVideos" INTEGER,
    "errorMessage" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScrapeHistory_scrapedAt_idx" ON "ScrapeHistory"("scrapedAt");
CREATE INDEX "ScrapeHistory_type_idx" ON "ScrapeHistory"("type");
