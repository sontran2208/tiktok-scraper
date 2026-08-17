# Telegram Mini App — TikTok Data Scraper

Monorepo gồm Mini App React, NestJS REST API, PostgreSQL/Prisma, Telegram Bot và Google Sheets integration.

## Chạy local

1. `cp .env.example .env` và điền `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBAPP_URL` (dùng HTTPS tunnel khi test với Telegram).
2. `docker compose up -d postgres`
3. `pnpm install`
4. `pnpm --filter @tiktok-scraper/api exec prisma migrate deploy`
5. `pnpm dev`

Mini App: `http://localhost:5173`. API: `http://localhost:3000/scrapes`.

## Google Sheets

Tạo service account trong Google Cloud, bật Google Sheets API, chia sẻ sheet cho email service account và đặt các biến `GOOGLE_SHEET_*`. `GOOGLE_SHEET_TAB` mặc định là `Scrapes`. Tạo worksheet tên tương ứng với hàng tiêu đề: `Scraped At, URL, Type, Status, Views, Likes, Comments, Shares, Followers, Total Likes, Total Videos`.

Sau khi chạy API, kiểm tra credential và quyền truy cập mà không ghi dữ liệu bằng `GET /sheets/verify`.

## Lưu ý scraper

`TikTokScraperService` đọc JSON công khai nhúng trong trang TikTok. TikTok có thể chặn request hoặc thay đổi cấu trúc trang; service đã tách riêng để thay bằng provider/API khác mà không ảnh hưởng API, database và giao diện.
