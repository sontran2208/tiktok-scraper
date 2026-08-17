import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  constructor(private config: ConfigService) { }
  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const webAppUrl = this.config.get<string>('TELEGRAM_WEBAPP_URL');
    if (!token || !webAppUrl) { this.logger.warn('Telegram bot chưa được cấu hình.'); return; }
    const bot = new Telegraf(token);
    bot.start((ctx) => {
      return ctx.reply(
        'Chào bạn! Chọn chức năng bên dưới:',
        Markup.inlineKeyboard([
          [
            Markup.button.url(
              '📊 Mở Google Sheet',
              'https://docs.google.com/spreadsheets/d/1WaYBTbHNZ1sT719HmNRs7F_n3tWSJe9w6sxRevIt22k/edit?gid=0#gid=0',
            ),
          ],
          [
            Markup.button.webApp(
              '🚀 Mở Scraper',
              webAppUrl,
            ),
          ],
        ]),
      );
    });
    await bot.telegram.setChatMenuButton({ menuButton: { type: 'web_app', text: 'Mở Scraper', web_app: { url: webAppUrl } } });
    bot.launch().catch((e) => this.logger.error('Bot launch failed', e));
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}
