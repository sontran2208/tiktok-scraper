import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ScrapeType } from '@prisma/client';

export type Metrics = { type: ScrapeType; views?: bigint; likes?: bigint; comments?: bigint; shares?: bigint; followers?: bigint; totalLikes?: bigint; totalVideos?: number };
@Injectable()
export class TikTokScraperService {
  detectType(url: string): ScrapeType {
    try {
      const u = new URL(url);
      if (!/(^|\.)tiktok\.com$/i.test(u.hostname.replace(/^www\./, ''))) throw new Error();
      return /\/(video|photo)\/\d+/.test(u.pathname) ? 'VIDEO' : 'PROFILE';
    }
    catch { throw new BadRequestException('Link TikTok không hợp lệ.'); }
  }
  async scrape(url: string): Promise<Metrics> {
    const type = this.detectType(url);
    let html: string;
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000), redirect: 'follow' });
      if (!r.ok) throw new Error(String(r.status)); html = await r.text();
    }
    catch { throw new ServiceUnavailableException('Không thể kết nối TikTok. Vui lòng thử lại sau.'); }

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
              shares: this.num(apiData.data.share_count)
            };
          }
        } catch (e) { }
      }
      throw new ServiceUnavailableException('Mạng của bạn đang bị TikTok chặn (yêu cầu Captcha). Vui lòng thử lại sau hoặc đổi mạng Wi-Fi.');
    }

    const json = this.readEmbeddedJson(html);
    if (!json) throw new ServiceUnavailableException('TikTok không trả dữ liệu công khai hoặc nội dung ở chế độ riêng tư.');
    const item = this.findObject(json, type === 'VIDEO' ? 'itemStruct' : 'userInfo') ?? json;
    const stats = this.findObject(item, type === 'VIDEO' ? 'stats' : 'stats') ?? {};
    if (type === 'VIDEO') return { type, views: this.num(stats.playCount), likes: this.num(stats.diggCount), comments: this.num(stats.commentCount), shares: this.num(stats.shareCount) };
    return { type, followers: this.num(stats.followerCount), totalLikes: this.num(stats.heartCount ?? stats.heart), totalVideos: Number(stats.videoCount ?? 0) };
  }
  private num(value: unknown): bigint { return BigInt(typeof value === 'number' || typeof value === 'string' ? value : 0); }
  private readEmbeddedJson(html: string): unknown | null {
    const m = html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s) ?? html.match(/<script[^>]+id="SIGI_STATE"[^>]*>(.*?)<\/script>/s);
    if (!m) {
      console.log('--- HTML DUMP ---');
      console.log(html.substring(0, 1000));
      console.log('--- END DUMP ---');
    }
    try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
  }
  private findObject(value: unknown, key: string): Record<string, unknown> | null { if (!value || typeof value !== 'object') return null; const obj = value as Record<string, unknown>; if (obj[key] && typeof obj[key] === 'object') return obj[key] as Record<string, unknown>; for (const v of Object.values(obj)) { const found = this.findObject(v, key); if (found) return found; } return null; }
}
