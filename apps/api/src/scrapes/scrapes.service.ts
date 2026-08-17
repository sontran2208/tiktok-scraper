import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ScrapeType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { GoogleSheetsService } from '../sheets/google-sheets.service';
import { CreateScrapeDto, ListScrapesDto } from './dto';
import { Metrics, TikTokScraperService } from './tiktok-scraper.service';

@Injectable()
export class ScrapesService {
  private readonly logger = new Logger(ScrapesService.name);
  constructor(
    private prisma: PrismaService,
    private scraper: TikTokScraperService,
    private sheets: GoogleSheetsService
  ) { }
  async create(input: CreateScrapeDto) {
    const type = this.scraper.detectType(input.url);
    try {
      const metrics = await this.scraper.scrape(input.url);
      const record = await this.prisma.scrapeHistory.create({
        data: this.toData(input, metrics)
      });
      this.sheets.append(record)
        .catch((e) => this.logger.warn(`Google Sheets sync failed: ${e.message}`));
      return this.serialize(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      await this.prisma.scrapeHistory.create({
        data: {
          url: input.url,
          telegramUserId: input.telegramUserId,
          type,
          status: 'FAILED',
          errorMessage: message
        }
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
      ...(query.type ? { type: query.type as ScrapeType } : {})
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
      totalVideos: m.totalVideos
    };
  }
  private serialize<T extends Record<string, unknown>>(row: T): T {
    return JSON.parse(JSON.stringify(row, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  }
}
