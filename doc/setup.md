# Local Setup Guide

Hướng dẫn thiết lập và chạy dự án `telegram-tiktok-scraper` ở môi trường máy tính cá nhân.

## Yêu cầu môi trường
- Node.js (khuyên dùng v18 hoặc v20+)
- pnpm v10+ (có thể cài qua `npm install -g pnpm`)
- Docker và Docker Compose (để chạy PostgreSQL cục bộ)

## Các bước cài đặt

### 1. Chuẩn bị biến môi trường
Mở thư mục gốc của dự án:
```bash
cp .env.example .env
```
Điền các thông số cơ bản vào file `.env`:
- `TELEGRAM_BOT_TOKEN`: Token lấy từ BotFather trên Telegram.
- `TELEGRAM_WEBAPP_URL`: Link của Mini App. Nếu test local, bạn cần dùng công cụ như ngrok hoặc localtunnel để tạo một link HTTPS trỏ về `http://localhost:5173`.
- Các biến `GOOGLE_SHEET_*` nếu cần test tính năng xuất Google Sheets.

### 2. Khởi chạy Database
Dự án có sẵn file `docker-compose.yml`. Mở terminal và chạy:
```bash
docker compose up -d postgres
```
Lệnh này sẽ khởi động một container PostgreSQL ở cổng `5432` với cấu hình khớp với `DATABASE_URL` trong file `.env`.

### 3. Cài đặt Dependencies
Sử dụng pnpm tại thư mục gốc:
```bash
pnpm install
```

### 4. Áp dụng Database Schema (Migration)
Chạy lệnh Prisma migration để tạo bảng trong PostgreSQL:
```bash
pnpm --filter @tiktok-scraper/api exec prisma migrate deploy
```
*(Nếu là lần đầu hoặc bạn vừa thay đổi schema, có thể dùng `prisma db push` hoặc `prisma migrate dev`)*

### 5. Khởi chạy Hệ thống
Dự án dùng Turbo Repo nên bạn có thể chạy tất cả các app (API & Web) cùng một lúc bằng một lệnh ở thư mục gốc:
```bash
pnpm dev
```
Hoặc nếu chạy từng phần:
- Web: `pnpm --filter @tiktok-scraper/web dev`
- API: `pnpm --filter @tiktok-scraper/api dev`

### Truy cập
- **Mini App (Frontend)**: [http://localhost:5173](http://localhost:5173)
- **API (Backend)**: [http://localhost:3000](http://localhost:3000) (hoặc truy cập `/scrapes`)
