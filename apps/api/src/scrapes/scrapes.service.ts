import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma, ScrapeType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { GoogleSheetsService } from '../sheets/google-sheets.service';
import { CreateScrapeDto, ListScrapesDto, ListProfileVideosDto } from './dto';
import { Metrics, TikTokScraperService } from './tiktok-scraper.service';
import { PROFILE_VIDEOS_QUEUE, ProfileVideosJobData } from './profile-videos.processor';

@Injectable()
export class ScrapesService {
  private readonly logger = new Logger(ScrapesService.name);

  constructor(
    private prisma: PrismaService,
    private scraper: TikTokScraperService,
    private sheets: GoogleSheetsService,
    @InjectQueue(PROFILE_VIDEOS_QUEUE) private profileVideosQueue: Queue,
  ) {}

  async create(input: CreateScrapeDto) {
    const type = this.scraper.detectType(input.url);
    try {
      const metrics = await this.scraper.scrape(input.url);
      const record = await this.prisma.scrapeHistory.create({
        data: {
          ...this.toData(input, metrics),
          // Nếu là PROFILE → sẽ cào video ngay sau
          videoJobStatus: type === 'PROFILE' ? 'PENDING' : undefined,
        },
      });

      // Sync Google Sheets (async, không block response)
      this.sheets
        .append(record)
        .catch((e) => this.logger.warn(`Google Sheets sync failed: ${e.message}`));

      // Nếu là profile → enqueue job cào video nền
      if (type === 'PROFILE') {
        const username = this.scraper.parseUsername(input.url);
        const jobData: ProfileVideosJobData = {
          scrapeHistoryId: record.id,
          username,
          profileUrl: input.url,
        };
        await this.profileVideosQueue.add(jobData, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        });
        this.logger.log(`Đã enqueue job cào video cho profile @${username} (scrape ${record.id})`);
      }

      return this.serialize(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      await this.prisma.scrapeHistory.create({
        data: {
          url: input.url,
          telegramUserId: input.telegramUserId,
          type,
          status: 'FAILED',
          errorMessage: message,
        },
      });
      throw error;
    }
  }

  async findAll(query: ListScrapesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = {
      status: 'SUCCESS' as const,
      ...(query.type ? { type: query.type as ScrapeType } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.scrapeHistory.findMany({
        where,
        orderBy: { scrapedAt: query.order ?? 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.scrapeHistory.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.serialize(row)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findVideos(scrapeHistoryId: string, query: ListProfileVideosDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Lấy thông tin trạng thái job
    const history = await this.prisma.scrapeHistory.findUnique({
      where: { id: scrapeHistoryId },
      select: { id: true, url: true, videoJobStatus: true, videoJobError: true, totalVideos: true },
    });

    const [rows, total] = await Promise.all([
      this.prisma.profileVideoScrape.findMany({
        where: { scrapeHistoryId },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.profileVideoScrape.count({ where: { scrapeHistoryId } }),
    ]);

    return {
      jobStatus: history?.videoJobStatus ?? null,
      jobError: history?.videoJobError ?? null,
      data: rows.map((row) => this.serialize(row)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private toData(input: CreateScrapeDto, m: Metrics): Prisma.ScrapeHistoryUncheckedCreateInput {
    return {
      url: input.url,
      telegramUserId: input.telegramUserId,
      type: m.type,
      views: m.views,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      followers: m.followers,
      totalLikes: m.totalLikes,
      totalVideos: m.totalVideos,
    };
  }

  private serialize<T extends Record<string, unknown>>(row: T): T {
    return JSON.parse(JSON.stringify(row, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  }
}
