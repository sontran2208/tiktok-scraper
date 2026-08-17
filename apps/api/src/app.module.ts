import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotService } from './bot/bot.service';
import { PrismaService } from './prisma.service';
import { ScrapesController } from './scrapes/scrapes.controller';
import { ScrapesService } from './scrapes/scrapes.service';
import { TikTokScraperService } from './scrapes/tiktok-scraper.service';
import { GoogleSheetsService } from './sheets/google-sheets.service';
import { SheetsController } from './sheets/sheets.controller';

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true })],
    controllers: [ScrapesController, SheetsController],
    providers: [PrismaService, ScrapesService, TikTokScraperService, GoogleSheetsService, BotService]
})
export class AppModule { }
