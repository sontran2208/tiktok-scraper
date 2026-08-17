import { BadRequestException } from '@nestjs/common';
import { TikTokScraperService } from './tiktok-scraper.service';

describe('TikTokScraperService', () => {
  let service: TikTokScraperService;

  beforeEach(() => {
    service = new TikTokScraperService();
  });

  // ──────────────────────────────────────────
  // detectType()
  // ──────────────────────────────────────────
  describe('detectType()', () => {
    describe('VIDEO links', () => {
      const videoCases = [
        'https://www.tiktok.com/@user/video/1234567890',
        'https://tiktok.com/@user/video/9999999999',
        'https://www.tiktok.com/@user/photo/1234567890',   // /photo/ treated as VIDEO
        'http://www.tiktok.com/@user/video/1234567890',
      ];

      it.each(videoCases)('returns VIDEO for %s', (url) => {
        expect(service.detectType(url)).toBe('VIDEO');
      });
    });

    describe('PROFILE links', () => {
      const profileCases = [
        'https://www.tiktok.com/@username',
        'https://tiktok.com/@some.user',
        'https://www.tiktok.com/@channel123',
        'https://www.tiktok.com/@user/',
      ];

      it.each(profileCases)('returns PROFILE for %s', (url) => {
        expect(service.detectType(url)).toBe('PROFILE');
      });
    });

    describe('invalid links', () => {
      const invalidCases = [
        'not-a-url',
        '',
        'https://youtube.com/@user',
        'https://tiktok.evil.com/@user',
        'ftp://tiktok.com/@user',
        'https://fakektiktok.com/@user/video/123',
      ];

      it.each(invalidCases)('throws BadRequestException for %s', (url) => {
        expect(() => service.detectType(url)).toThrow(BadRequestException);
      });
    });
  });

  // ──────────────────────────────────────────
  // scrape() — WAF fallback via tikwm.com
  // ──────────────────────────────────────────
  describe('scrape() WAF fallback', () => {
    it('returns VIDEO metrics from tikwm.com when TikTok responds with WAF challenge', async () => {
      const wafHtml = '<html><body>SlardarWAF</body></html>';
      const tikwmPayload = {
        code: 0,
        data: { play_count: 1000, digg_count: 200, comment_count: 50, share_count: 30 },
      };

      // First fetch → TikTok (WAF HTML), second fetch → tikwm.com API
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, text: async () => wafHtml } as unknown as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => tikwmPayload } as unknown as Response);

      global.fetch = fetchMock;

      const result = await service.scrape('https://www.tiktok.com/@user/video/1234567890');

      expect(result.type).toBe('VIDEO');
      expect(result.views).toBe(BigInt(1000));
      expect(result.likes).toBe(BigInt(200));
      expect(result.comments).toBe(BigInt(50));
      expect(result.shares).toBe(BigInt(30));
    });

    it('throws ServiceUnavailableException for PROFILE links when WAF blocks', async () => {
      const wafHtml = '<html><body>SlardarWAF</body></html>';
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, text: async () => wafHtml } as unknown as Response);

      await expect(
        service.scrape('https://www.tiktok.com/@someprofile'),
      ).rejects.toThrow('Mạng của bạn đang bị TikTok chặn');
    });
  });
});
