# Agent Context — TikTok Scraper Monorepo

Đây là file context để nạp vào AI agent khi bắt đầu một phiên làm việc mới. Đọc file này trước khi thực hiện bất kỳ thao tác nào trên codebase.

---

## Thông tin dự án
- **Tên**: `telegram-tiktok-scraper`
- **Monorepo tool**: pnpm workspace + Turbo Repo
- **Package manager**: pnpm v10+
- **Ngôn ngữ**: TypeScript (NestJS API) + TypeScript/JSX (React Web)
- **Repository**: https://github.com/sontran2208/tiktok-scraper

---

## Cấu trúc Monorepo

```
test-3-days/
├── apps/
│   ├── api/               # NestJS backend (port 3000)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── prisma.service.ts
│   │   │   ├── scrapes/
│   │   │   │   ├── scrapes.controller.ts      # REST endpoints
│   │   │   │   ├── scrapes.service.ts         # Business logic chính
│   │   │   │   ├── tiktok-scraper.service.ts  # Scraper core (fetch + Puppeteer)
│   │   │   │   ├── profile-videos.processor.ts # Bull job processor
│   │   │   │   └── dto.ts                     # DTOs (CreateScrapeDto, ListScrapesDto, ...)
│   │   │   ├── bot/
│   │   │   │   └── bot.service.ts             # Telegram bot (telegraf)
│   │   │   └── sheets/
│   │   │       ├── google-sheets.service.ts   # Google Sheets API
│   │   │       └── sheets.controller.ts       # GET /sheets/verify
│   │   └── prisma/
│   │       └── schema.prisma                  # Prisma schema (PostgreSQL)
│   └── web/               # React Vite Telegram Mini App (port 5173)
│       └── src/
│           ├── App.tsx    # Toàn bộ UI logic
│           ├── api.ts     # HTTP client gọi API
│           ├── main.tsx
│           └── styles.css
├── doc/                   # Tài liệu dự án (thư mục này)
├── docker-compose.yml     # PostgreSQL container
├── .env                   # Biến môi trường (xem bên dưới)
└── turbo.json
```

---

## Biến môi trường (.env tại root)

| Biến | Mô tả |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL. Mặc định: `postgresql://postgres:postgres@localhost:5432/tiktok_scraper` |
| `TELEGRAM_BOT_TOKEN` | Token từ BotFather |
| `TELEGRAM_WEBAPP_URL` | URL HTTPS của Mini App (dùng ngrok/localtunnel khi test local) |
| `REDIS_HOST` | Host Redis cho Bull Queue. Mặc định: `localhost` |
| `REDIS_PORT` | Port Redis. Mặc định: `6379` |
| `GOOGLE_SHEET_ID` | ID của Google Spreadsheet |
| `GOOGLE_SHEET_TAB` | Tên tab chính. Mặc định: `Scrapes` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Email service account GCP |
| `GOOGLE_PRIVATE_KEY` | Private key service account GCP |

---

## API Endpoints (NestJS — port 3000)

### Scrapes
| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/scrapes` | Tạo một lần cào dữ liệu mới. Body: `{ url, telegramUserId? }` |
| `GET` | `/scrapes` | Lấy danh sách lịch sử. Query: `type?, order?, page?, limit?` |
| `GET` | `/scrapes/:id/videos` | Lấy danh sách video của một Profile. Query: `page?, limit?` |

### Sheets
| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/sheets/verify` | Kiểm tra kết nối Google Sheets (không ghi dữ liệu) |

---

## Luồng dữ liệu chính

```
User (Telegram Mini App)
  → POST /scrapes { url }
  → ScrapesService.create()
    → TikTokScraperService.detectType(url)           // VIDEO hay PROFILE?
    → TikTokScraperService.scrape(url)               // Cào metrics chính
      ├── fetch() + parse embedded JSON (nhanh, không cần browser)
      └── Fallback: tikwm.com API (nếu TikTok trả WAF/Captcha cho VIDEO)
    → Lưu ScrapeHistory vào PostgreSQL
    → GoogleSheetsService.append() (async, không block)
    └── Nếu PROFILE → enqueue Bull Job "profile-videos"
          → ProfileVideosProcessor.handle()
            → TikTokScraperService.scrapeProfileVideos()   // Puppeteer Stealth
            → Lưu ProfileVideoScrape[] vào PostgreSQL (createMany)
            → GoogleSheetsService.appendProfileVideos()
            → Cập nhật videoJobStatus = DONE | FAILED
```

---

## Các Service quan trọng

### `TikTokScraperService` (`tiktok-scraper.service.ts`)
- **`detectType(url)`**: Phân loại URL → `VIDEO` hoặc `PROFILE`.  
  `vt.tiktok.com`, `vm.tiktok.com` → VIDEO; path `/video/\d+` hoặc `/photo/\d+` → VIDEO; còn lại → PROFILE.
- **`scrape(url)`**: Cào metrics chính. Dùng `fetch` + parse JSON từ `__UNIVERSAL_DATA_FOR_REHYDRATION__` hoặc `SIGI_STATE`. Nếu trả về HTML có `SlardarWAF` → fallback tikwm.com (chỉ cho VIDEO).
- **`scrapeProfileVideos(username)`**: Mở Puppeteer Stealth, giả lập iPhone, scroll trang profile, intercept XHR từ `/api/post/item_list/`. Dừng sau 8 lần scroll liên tiếp không có video mới.
- **`parseUsername(url)`**: Trích xuất username từ URL profile.

### `ScrapesService` (`scrapes.service.ts`)
- Orchestrates toàn bộ luồng create, findAll, findVideos.
- BigInt serialization: `JSON.stringify` với replacer `v => v.toString()`.

### `ProfileVideosProcessor` (`profile-videos.processor.ts`)
- Bull `@Processor('profile-videos')`.
- Cập nhật `videoJobStatus`: `PENDING → RUNNING → DONE/FAILED`.
- Retry 3 lần với exponential backoff (delay 5s).

### `GoogleSheetsService`
- Dùng googleapis SDK + Service Account.
- `append(record)`: ghi 1 dòng vào tab `GOOGLE_SHEET_TAB`.
- `appendProfileVideos(profileUrl, videos)`: ghi nhiều dòng vào tab riêng cho Profile Videos.

### `BotService` (`bot.service.ts`)
- Dùng `telegraf`.
- Lệnh `/start`: Hiển thị 2 nút inline — mở Google Sheet và mở Mini App (WebApp button).
- Đặt menu button của bot thành WebApp button trỏ đến `TELEGRAM_WEBAPP_URL`.

---

## Frontend (React Vite — `apps/web`)

- SDK: `@twa-dev/sdk` — đọc `WebApp.initDataUnsafe.user?.id` để lấy Telegram User ID.
- Giao diện: Nhập URL → `POST /scrapes` → Hiển thị toast (react-hot-toast) → Reload lịch sử.
- Lịch sử: phân trang, lọc theo `type` (ALL/VIDEO/PROFILE), sắp xếp theo `order` (desc/asc).
- Profile card: có nút mở rộng xem danh sách video. Nếu `videoJobStatus = PENDING/RUNNING` → polling mỗi 3 giây đến khi DONE/FAILED.
- `WebApp.HapticFeedback` được gọi sau khi cào thành công/thất bại.

---

## Database Schema tóm tắt

**`ScrapeHistory`**: Mỗi lần cào. `type` (VIDEO/PROFILE), `status` (SUCCESS/FAILED), metrics dạng `BigInt`, `videoJobStatus` (PENDING/RUNNING/DONE/FAILED) chỉ dùng cho PROFILE.

**`ProfileVideoScrape`**: Các video con của một Profile. FK → `ScrapeHistory.id`, cascade delete.

---

## Lệnh thường dùng

```bash
# Chạy toàn bộ (dev)
pnpm dev

# Chạy riêng
pnpm --filter @tiktok-scraper/api dev
pnpm --filter @tiktok-scraper/web dev

# Database
pnpm --filter @tiktok-scraper/api exec prisma migrate dev
pnpm --filter @tiktok-scraper/api exec prisma studio

# Docker (PostgreSQL)
docker compose up -d postgres
docker compose down

# Kiểm tra port đang dùng
lsof -ti :3000 | xargs kill -9
lsof -ti :5173 | xargs kill -9
```

---

## Lưu ý kỹ thuật & gotchas

1. **BigInt**: Tất cả metrics (views, likes, ...) lưu dạng `BigInt` trong Prisma. Khi serialize phải dùng `.toString()` vì `JSON.stringify` mặc định sẽ throw với BigInt.
2. **TikTok WAF/Captcha**: Nếu HTML trả về chứa `SlardarWAF` hoặc `_wafchallengeid` → TikTok đang chặn IP. Chỉ VIDEO có fallback qua tikwm.com. PROFILE sẽ báo lỗi ngay.
3. **Redis**: Bull Queue cần Redis. Khi chạy local cần đảm bảo Redis đang chạy (mặc định localhost:6379). Nếu chưa có, thêm vào `docker-compose.yml`.
4. **Puppeteer Stealth**: Cào Profile Videos dùng `puppeteer-extra` + `puppeteer-extra-plugin-stealth`. Emulate iPhone để tăng tỷ lệ bypass. Timeout mỗi lần goto là 30s.
5. **ngrok cho Telegram Mini App**: Mini App **bắt buộc phải HTTPS**. Khi test local, dùng `ngrok http 5173` và cập nhật `TELEGRAM_WEBAPP_URL`.
6. **Google Sheets service account**: Phải share Google Sheet cho email service account với quyền Editor. Tab cần được tạo sẵn với hàng tiêu đề đúng format.
7. **pnpm workspace filter**: Khi chạy lệnh cho một app cụ thể trong monorepo, dùng `pnpm --filter @tiktok-scraper/api <lệnh>`.
