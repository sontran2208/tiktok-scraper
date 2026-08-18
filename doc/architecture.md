# Project Architecture

Dự án `telegram-tiktok-scraper` được xây dựng theo kiến trúc Monorepo sử dụng `pnpm workspace` và `turbo`. Nó bao gồm các thành phần chính sau:

## 1. apps/api (Backend)
- **Framework**: NestJS
- **Database ORM**: Prisma Client kết nối với PostgreSQL.
- **Queue/Background Jobs**: Sử dụng Bull queue để xử lý các tác vụ cào dữ liệu tốn thời gian (đặc biệt là cào toàn bộ video từ một profile).
- **Telegram Bot**: Tích hợp `telegraf` để xử lý các lệnh từ người dùng trên Telegram và cung cấp link mở Mini App.
- **Scraper Service**: 
  - Sử dụng `fetch` API để lấy HTML và bóc tách chuỗi JSON nội bộ của trang web TikTok (phương pháp nhanh cho video đơn lẻ).
  - Sử dụng `puppeteer`, `puppeteer-extra` kết hợp với `puppeteer-extra-plugin-stealth` để giả lập trình duyệt, vượt qua các cơ chế chống bot của TikTok khi cào số lượng lớn video từ profile (thông qua intercept XHR request).
- **Google Sheets Integration**: Sử dụng `googleapis` để đẩy dữ liệu đã cào được lên Google Sheets làm báo cáo.

## 2. apps/web (Frontend)
- **Framework**: ReactJS kết hợp Vite.
- **Telegram Web App SDK**: Sử dụng `@twa-dev/sdk` để tích hợp liền mạch vào hệ sinh thái Telegram Mini App (TMA). Giao diện lấy thông tin theme, user của Telegram.
- **Mục đích**: Cung cấp giao diện trực quan cho người dùng nhập URL TikTok, xem trạng thái cào dữ liệu, và quản lý lịch sử.

## 3. Database (PostgreSQL)
- Chứa các bảng lịch sử `ScrapeHistory` và chi tiết các video của một profile `ProfileVideoScrape`.
- Hỗ trợ lưu trữ số liệu (view, like, comment, share) với kiểu dữ liệu `BigInt` để tránh tràn số do view TikTok thường rất lớn.

## 4. Công cụ hỗ trợ
- **Docker**: Sử dụng `docker-compose.yml` để dễ dàng khởi tạo PostgreSQL cho môi trường local.
- **Turbo Repo**: Giúp quản lý lệnh build, dev, lint, test cho nhiều app trong monorepo một cách tối ưu.
