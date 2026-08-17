import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScrapeHistory } from '@prisma/client';
import { google } from 'googleapis';
import { createPrivateKey } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

type SheetsConfig = { sheetId: string; tab: string; auth: InstanceType<typeof google.auth.JWT> };

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  constructor(private config: ConfigService) { }

  private static readonly HEADERS = [
    'Thời gian', 'URL', 'Loại', 'Trạng thái',
    'Views', 'Likes', 'Comments', 'Shares',
    'Followers', 'Total Likes', 'Total Videos',
  ];

  async append(record: ScrapeHistory) {
    const { sheetId, tab, auth } = this.getConfig();
    const sheets = google.sheets({ version: 'v4', auth });
    await this.ensureHeaders(sheets, sheetId, tab);
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${this.escapeTab(tab)}!A:K`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [record.scrapedAt.toISOString(),
          record.url,
          record.type,
          record.status,
          record.views?.toString() ?? '',
          record.likes?.toString() ?? '',
          record.comments?.toString() ?? '',
          record.shares?.toString() ?? '',
          record.followers?.toString() ?? '',
          record.totalLikes?.toString() ?? '',
          record.totalVideos ?? '']
        ]
      },
    });
    this.logger.log(`Google Sheets synced: scrape ${record.id}`);
  }

  private async ensureHeaders(
    sheets: ReturnType<typeof google.sheets>,
    sheetId: string,
    tab: string,
  ) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${this.escapeTab(tab)}!A1`,
      });
      const firstCell = res.data.values?.[0]?.[0];
      if (firstCell) return; // headers already exist
    } catch {
      return; // if we can't read, skip — append will surface the real error
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${this.escapeTab(tab)}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [GoogleSheetsService.HEADERS] },
    });
    this.logger.log(`Google Sheets: header row created in tab "${tab}"`);
  }

  async verify() {
    const { sheetId, tab, auth } = this.getConfig();
    try {
      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'properties.title,sheets.properties.title' });
      const tabs = response.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean) ?? [];
      if (!tabs.includes(tab)) throw new Error(`Không tìm thấy tab "${tab}". Các tab hiện có: ${tabs.join(', ') || '(trống)'}.`);
      return { ok: true, spreadsheet: response.data.properties?.title, tab };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi Google Sheets không xác định.';
      this.logger.error(`Google Sheets verification failed: ${message}`);
      throw new ServiceUnavailableException(`Không kết nối được Google Sheets: ${message}`);
    }
  }

  private getConfig(): SheetsConfig {
    let sheetId = this.config.get<string>('GOOGLE_SHEET_ID')?.trim();
    const email = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL')?.trim();
    const rawKey = this.readPrivateKey();
    if (!sheetId || !email || !rawKey) throw new ServiceUnavailableException('Thiếu GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.');
    const urlMatch = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) sheetId = urlMatch[1];
    const key = this.normalizePrivateKey(rawKey);
    try { createPrivateKey(key); }
    catch { throw new ServiceUnavailableException('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY không phải private key PEM hợp lệ. Dùng private_key gốc từ file JSON hoặc base64 của toàn bộ private key.'); }
    return { sheetId, tab: this.config.get<string>('GOOGLE_SHEET_TAB')?.trim() || 'Scrapes', auth: new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] }) };
  }

  private normalizePrivateKey(value: string) {
    let key = value.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
    if (!key.includes('-----BEGIN')) {
      try { const decoded = Buffer.from(key.replace(/^base64:/i, ''), 'base64').toString('utf8'); if (decoded.includes('-----BEGIN')) key = decoded; } catch { /* validation below returns a useful error */ }
    }
    return key;
  }

  private readPrivateKey() {
    const file = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_FILE')?.trim();
    if (file) {
      try { return readFileSync(resolve(file), 'utf8'); }
      catch { throw new ServiceUnavailableException(`Không thể đọc GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_FILE: ${file}`); }
    }
    return this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  }

  private escapeTab(tab: string) { return `'${tab.replace(/'/g, "''")}'`; }
}
