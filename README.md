# Thiện Pháp

SaaS đồng bộ giao dịch tài khoản minh bạch MB, phân loại theo mã thiện pháp và tổng hợp trên dashboard.

## Chạy local

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Tài khoản super admin seed lấy từ `ADMIN_EMAIL` và đăng nhập bằng Google SSO.

## Đăng nhập Google

Tạo OAuth Client loại **Web application** trong Google Cloud, sau đó cấu hình:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APP_URL` là URL gốc của ứng dụng, ví dụ `https://example.com`
- Authorized redirect URI: `${APP_URL}/api/auth/google/callback`

Các redirect URI cần khai báo trong Google Cloud cho dự án này:

- `https://thiennguyen-thongke.vercel.app/api/auth/google/callback`
- `http://localhost:3000/api/auth/google/callback`
- `http://localhost:3001/api/auth/google/callback`

Địa chỉ Gmail phải được quản trị tổ chức thêm trước trong mục **Thành viên tổ chức**. Tổ chức trong app không yêu cầu hoặc liên kết với domain email; hệ thống không tự cấp quyền cho Gmail chưa được thêm.

## Deploy Vercel

Khai báo toàn bộ biến trong `.env.example` tại Project Settings → Environment Variables. Build command mặc định là `pnpm build`.

## QStash

Tạo schedule mỗi 5 phút:

- Destination: `https://YOUR_DOMAIN/api/internal/sync`
- Method: `POST`
- Cron: `*/5 * * * *`
- Header: `Authorization: Bearer YOUR_SYNC_SECRET`

Endpoint xử lý tối đa 5 tài khoản đến hạn mỗi lượt, có khóa chống chạy chồng và upsert chống trùng giao dịch.
