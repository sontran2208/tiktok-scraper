import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma.service';
import { TikTokScraperService } from './tiktok-scraper.service';
import { GoogleSheetsService } from '../sheets/google-sheets.service';

export const PROFILE_VIDEOS_QUEUE = 'profile-videos';

export interface ProfileVideosJobData {
  scrapeHistoryId: string;
  username: string;
  profileUrl: string;
}

@Processor(PROFILE_VIDEOS_QUEUE)
export class ProfileVideosProcessor {
  private readonly logger = new Logger(ProfileVideosProcessor.name);

  constructor(
    private prisma: PrismaService,
    private scraper: TikTokScraperService,
    private sheets: GoogleSheetsService,
  ) {}

  @Process()
  async handle(job: Job<ProfileVideosJobData>) {
    const { scrapeHistoryId, username, profileUrl } = job.data;
    this.logger.log(`Job ${job.id}: bắt đầu cào video của @${username}`);

    // Đánh dấu RUNNING
    await this.prisma.scrapeHistory.update({
      where: { id: scrapeHistoryId },
      data: { videoJobStatus: 'RUNNING' },
    });

    try {
      const videos = await this.scraper.scrapeProfileVideos(username);

      if (videos.length > 0) {
        // Bulk insert tất cả video
        await this.prisma.profileVideoScrape.createMany({
          data: videos.map((v) => ({
            scrapeHistoryId,
            videoId: v.videoId,
            videoUrl: v.videoUrl,
            description: v.description ?? null,
            views: v.views ?? null,
            likes: v.likes ?? null,
            comments: v.comments ?? null,
            shares: v.shares ?? null,
            coverUrl: v.coverUrl ?? null,
            publishedAt: v.publishedAt ?? null,
          })),
          skipDuplicates: true,
        });

        // Sync vào Google Sheets (tab Profile Videos)
        this.sheets
          .appendProfileVideos(profileUrl, videos)
          .catch((e) => this.logger.warn(`Sheets sync thất bại: ${e.message}`));
      }

      // Đánh dấu DONE
      await this.prisma.scrapeHistory.update({
        where: { id: scrapeHistoryId },
        data: { videoJobStatus: 'DONE', totalVideos: videos.length },
      });

      this.logger.log(`Job ${job.id}: hoàn thành, đã lưu ${videos.length} video của @${username}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Job ${job.id}: thất bại — ${message}`);
      await this.prisma.scrapeHistory.update({
        where: { id: scrapeHistoryId },
        data: { videoJobStatus: 'FAILED', videoJobError: message },
      });
      throw error; // Bull sẽ đánh dấu job failed
    }
  }
}
