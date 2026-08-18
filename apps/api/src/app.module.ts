import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { BotService } from './bot/bot.service';
import { PrismaService } from './prisma.service';
import { ScrapesController } from './scrapes/scrapes.controller';
import { ScrapesService } from './scrapes/scrapes.service';
import { TikTokScraperService } from './scrapes/tiktok-scraper.service';
import { ProfileVideosProcessor, PROFILE_VIDEOS_QUEUE } from './scrapes/profile-videos.processor';
import { GoogleSheetsService } from './sheets/google-sheets.service';
import { SheetsController } from './sheets/sheets.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                redis: {
                    host: config.get<string>('REDIS_HOST') ?? 'localhost',
                    port: config.get<number>('REDIS_PORT') ?? 6379,
                },
            }),
            inject: [ConfigService],
        }),
        BullModule.registerQueue({ name: PROFILE_VIDEOS_QUEUE }),
    ],
    controllers: [ScrapesController, SheetsController],
    providers: [
        PrismaService,
        ScrapesService,
        TikTokScraperService,
        ProfileVideosProcessor,
        GoogleSheetsService,
        BotService,
    ],
})
export class AppModule {}
