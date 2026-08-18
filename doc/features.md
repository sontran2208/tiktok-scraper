# Core Features

Dự án tập trung vào việc thu thập (scrape) số liệu từ nền tảng TikTok thông qua giao diện Telegram. Các tính năng chính bao gồm:

## 1. Scrape TikTok Data
Hệ thống tự động nhận diện loại URL đầu vào:
- **Single Video (`VIDEO`)**: Lấy thông tin lượt view, like, comment, share của một video cụ thể.
- **User Profile (`PROFILE`)**: Lấy thông tin tổng quan của kênh (follower, tổng like, tổng video). Sau đó đẩy vào hàng đợi (Queue) để tiếp tục dùng trình duyệt ẩn danh cào chi tiết tất cả các video thuộc profile đó.

## 2. Telegram Bot
- Nhận lệnh trực tiếp từ người dùng.
- Cung cấp nút (Inline Button) để người dùng mở Telegram Mini App.

## 3. Telegram Mini App (TMA)
- Giao diện web được nhúng vào bên trong Telegram.
- Người dùng có thể dán link TikTok, gửi yêu cầu cào dữ liệu trực tiếp từ giao diện.
- Hiển thị danh sách lịch sử cào dữ liệu cùng các số liệu thống kê cơ bản.

## 4. Google Sheets Sync
- Hệ thống hỗ trợ đẩy thông tin (URL, Type, Status, Metrics) lên một bảng tính Google Sheets để đội ngũ dễ dàng làm báo cáo hoặc theo dõi biến động.
- Cột dữ liệu tiêu biểu: `Scraped At`, `URL`, `Type`, `Status`, `Views`, `Likes`, `Comments`, `Shares`, `Followers`, `Total Likes`, `Total Videos`.

## 5. Anti-Bot Bypass
- Hệ thống tích hợp xử lý chống Captcha (SlardarWAF) bằng cách sử dụng fallback qua bên thứ 3 (như `tikwm.com`) đối với video lẻ.
- Sử dụng công nghệ Stealth Puppeteer để mô phỏng thao tác của người dùng (scroll tự động) và chặn (intercept) các API nội bộ của TikTok để lấy danh sách video mà không bị chặn IP.
