# Database Schema

Hệ thống sử dụng Prisma làm ORM để thao tác với PostgreSQL. Dưới đây là kiến trúc của các bảng chính:

## 1. Bảng `ScrapeHistory`
Lưu trữ mỗi lần người dùng gửi yêu cầu cào dữ liệu từ một URL.

**Các trường chính:**
- `id`: Định danh dạng CUID.
- `telegramUserId`: ID của người dùng Telegram gọi lệnh (để lọc lịch sử theo user nếu cần).
- `url`: Link TikTok đầu vào.
- `type`: `ScrapeType` (VIDEO hoặc PROFILE).
- `status`: `ScrapeStatus` (SUCCESS hoặc FAILED).
- **Video Metrics** (Nếu type là VIDEO): `views`, `likes`, `comments`, `shares`.
- **Profile Metrics** (Nếu type là PROFILE): `followers`, `totalLikes`, `totalVideos`.
- `errorMessage`: Chứa thông báo lỗi nếu `status` là FAILED.
- `scrapedAt` / `createdAt`: Dấu thời gian.

**Quản lý Job của Profile:**
Nếu người dùng cào Profile, quá trình lấy toàn bộ video sẽ được đẩy vào background job.
- `videoJobStatus`: Trạng thái của job (`PENDING`, `RUNNING`, `DONE`, `FAILED`).
- `videoJobError`: Thông báo lỗi của job nếu có.

## 2. Bảng `ProfileVideoScrape`
Lưu trữ danh sách chi tiết các video thuộc về một Profile đã được hệ thống thu thập thông qua job ẩn.

**Các trường chính:**
- `id`: Định danh dạng CUID.
- `scrapeHistoryId`: Khóa ngoại liên kết với lần cào Profile (`ScrapeHistory.id`). Xóa Cascade.
- `videoId`: ID thực tế của video trên nền tảng TikTok.
- `videoUrl`: Link trực tiếp dẫn tới video.
- `description`: Mô tả/caption của video.
- **Video Metrics**: `views`, `likes`, `comments`, `shares`.
- `coverUrl`: Link ảnh thumbnail.
- `publishedAt`: Thời gian đăng tải trên TikTok.
- `createdAt`: Thời gian ghi nhận vào database.

## Enum
- `ScrapeType`: `VIDEO`, `PROFILE`
- `ScrapeStatus`: `SUCCESS`, `FAILED`
- `VideoJobStatus`: `PENDING`, `RUNNING`, `DONE`, `FAILED`
