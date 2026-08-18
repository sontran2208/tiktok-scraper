import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ScrapeType } from '@prisma/client';

export type Metrics = {
  type: ScrapeType;
  views?: bigint;
  likes?: bigint;
  comments?: bigint;
  shares?: bigint;
  followers?: bigint;
  totalLikes?: bigint;
  totalVideos?: number;
};

export type VideoMetrics = {
  videoId: string;
  videoUrl: string;
  description?: string;
  views?: bigint;
  likes?: bigint;
  comments?: bigint;
  shares?: bigint;
  coverUrl?: string;
  publishedAt?: Date;
};

@Injectable()
export class TikTokScraperService {
  private readonly logger = new Logger(TikTokScraperService.name);

  detectType(url: string): ScrapeType {
    try {
      const u = new URL(url);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      if (!/(^|\.)tiktok\.com$/i.test(u.hostname.replace(/^www\./, ''))) throw new Error();
      if (['vt.tiktok.com', 'vm.tiktok.com'].includes(u.hostname)) return 'VIDEO';
      return /\/(video|photo)\/\d+/.test(u.pathname) ? 'VIDEO' : 'PROFILE';
    } catch {
      throw new BadRequestException('Link TikTok không hợp lệ.');
    }
  }

  parseUsername(url: string): string {
    try {
      const u = new URL(url);
      const match = u.pathname.match(/^\/@?([^/]+)/);
      if (match) return match[1];
    } catch { /* fall through */ }
    throw new BadRequestException('Không thể lấy username từ URL profile.');
  }

  async scrape(url: string): Promise<Metrics> {
    const type = this.detectType(url);
    let html: string;
    try {
      const r = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(12_000),
        redirect: 'follow',
      });
      if (!r.ok) throw new Error(String(r.status));
      html = await r.text();
    } catch {
      throw new ServiceUnavailableException('Không thể kết nối TikTok. Vui lòng thử lại sau.');
    }

    if (html.includes('SlardarWAF') || html.includes('_wafchallengeid')) {
      if (type === 'VIDEO') {
        try {
          const apiRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
          const apiData = await apiRes.json();
          if (apiData.code === 0 && apiData.data) {
            return {
              type,
              views: this.num(apiData.data.play_count),
              likes: this.num(apiData.data.digg_count),
              comments: this.num(apiData.data.comment_count),
              shares: this.num(apiData.data.share_count),
            };
          }
        } catch (_e) { /* ignore */ }
      }
      throw new ServiceUnavailableException(
        'Mạng của bạn đang bị TikTok chặn (yêu cầu Captcha). Vui lòng thử lại sau hoặc đổi mạng Wi-Fi.',
      );
    }

    const json = this.readEmbeddedJson(html);
    if (!json)
      throw new ServiceUnavailableException('TikTok không trả dữ liệu công khai hoặc nội dung ở chế độ riêng tư.');

    const item = this.findObject(json, type === 'VIDEO' ? 'itemStruct' : 'userInfo') ?? json;
    const stats = this.findObject(item, 'stats') ?? {};

    if (type === 'VIDEO') {
      return {
        type,
        views: this.num(stats.playCount),
        likes: this.num(stats.diggCount),
        comments: this.num(stats.commentCount),
        shares: this.num(stats.shareCount),
      };
    }
    return {
      type,
      followers: this.num(stats.followerCount),
      totalLikes: this.num(stats.heartCount ?? stats.heart),
      totalVideos: Number(stats.videoCount ?? 0),
    };
  }

  /**
   * Cào tất cả video của 1 profile dùng Puppeteer stealth.
   * Intercept XHR /api/post/item_list/ khi TikTok tự gọi trong lúc scroll.
   * Không giới hạn số lượng — tiếp tục scroll đến khi không còn video mới.
   */
  async scrapeProfileVideos(username: string): Promise<VideoMetrics[]> {
    this.logger.log(`[ProfileVideos] Bắt đầu cào video @${username} bằng Puppeteer`);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteerExtra = require('puppeteer-extra');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    const stealthFn = typeof StealthPlugin === 'function' ? StealthPlugin : StealthPlugin.default;
    puppeteerExtra.use(stealthFn());

    const browser = await puppeteerExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const all: VideoMetrics[] = [];
    const seenIds = new Set<string>();

    try {
      const page = await browser.newPage();

      // Dùng DESKTOP viewport — TikTok desktop dùng window scroll tiêu chuẩn
      // Mobile viewport khiến TikTok render trong virtual container không scroll được
      await page.setViewport({ width: 1280, height: 900 });
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      // Intercept TẤT CẢ item_list responses (TikTok gọi khi user scroll)
      page.on('response', async (response: import('puppeteer').HTTPResponse) => {
        const url = response.url();
        if (!url.includes('/api/post/item_list/')) return;
        try {
          const body = await response.json();
          const items: any[] = body?.itemList ?? body?.items ?? [];
          const hasMore: boolean = body?.hasMore ?? body?.has_more ?? false;
          const cursor = body?.cursor ?? null;
          this.logger.log(`[ProfileVideos][API] item_list → ${items.length} items, hasMore=${hasMore}, cursor=${cursor}, tổng=${all.length + items.length}`);
          for (const item of items) {
            const videoId = String(item.id ?? '');
            if (!videoId || seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            const stats = item.stats ?? {};
            all.push({
              videoId,
              videoUrl: `https://www.tiktok.com/@${username}/video/${videoId}`,
              description: item.desc ?? undefined,
              views: this.num(stats.playCount),
              likes: this.num(stats.diggCount),
              comments: this.num(stats.commentCount),
              shares: this.num(stats.shareCount),
              coverUrl: item.video?.cover ?? item.video?.dynamicCover ?? undefined,
              publishedAt: item.createTime ? new Date(Number(item.createTime) * 1000) : undefined,
            });
          }
        } catch { /* bỏ qua nếu response không phải JSON */ }
      });

      // Mở trang profile
      this.logger.log(`[ProfileVideos] Mở trang https://www.tiktok.com/@${username}`);
      await page.goto(`https://www.tiktok.com/@${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      // Chờ trang render + batch đầu tiên load xong
      await new Promise((r) => setTimeout(r, 4000));

      // Scroll loop — TikTok desktop dùng window scroll → window.scrollY thay đổi được
      let prevCount = 0;
      let noNewCount = 0;
      const MAX_NO_NEW = 5;

      while (noNewCount < MAX_NO_NEW) {
        // Scroll xuống từng bước để trigger TikTok lazy load
        const scrollResult = await page.evaluate(async () => {
          const before = { scrollY: window.scrollY, docH: document.documentElement.scrollHeight };
          for (let i = 0; i < 5; i++) {
            window.scrollBy(0, window.innerHeight);
            await new Promise((r) => setTimeout(r, 200));
          }
          // Scroll thẳng xuống cuối để trigger ngay
          window.scrollTo(0, document.documentElement.scrollHeight);
          return {
            before,
            after: { scrollY: window.scrollY, docH: document.documentElement.scrollHeight },
          };
        });

        // Chờ XHR response về từ TikTok
        await new Promise((r) => setTimeout(r, 3000));

        this.logger.log(
          `[ProfileVideos][SCROLL] scrollY: ${scrollResult.before.scrollY} → ${scrollResult.after.scrollY} | docH: ${scrollResult.before.docH} → ${scrollResult.after.docH} | total=${all.length} noNew=${noNewCount}`,
        );

        if (all.length === prevCount) {
          noNewCount++;
        } else {
          noNewCount = 0;
          prevCount = all.length;
        }
      }

    } catch (e) {
      this.logger.error(`[ProfileVideos] Puppeteer lỗi: ${e}`);
    } finally {
      await browser.close();
    }

    this.logger.log(`[ProfileVideos] @${username} — tổng ${all.length} video.`);
    return all;
  }


  private num(value: unknown): bigint {
    return BigInt(typeof value === 'number' || typeof value === 'string' ? value : 0);
  }

  private readEmbeddedJson(html: string): unknown | null {
    const m =
      html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s) ??
      html.match(/<script[^>]+id="SIGI_STATE"[^>]*>(.*?)<\/script>/s);
    if (!m) {
      console.log('--- HTML DUMP ---');
      console.log(html.substring(0, 1000));
      console.log('--- END DUMP ---');
    }
    try {
      return m ? JSON.parse(m[1]) : null;
    } catch {
      return null;
    }
  }

  private findObject(value: unknown, key: string): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') return null;
    const obj = value as Record<string, unknown>;
    if (obj[key] && typeof obj[key] === 'object') return obj[key] as Record<string, unknown>;
    for (const v of Object.values(obj)) {
      const found = this.findObject(v, key);
      if (found) return found;
    }
    return null;
  }
}
