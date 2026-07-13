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

Tài khoản seed lấy từ `ADMIN_EMAIL` và `ADMIN_PASSWORD`.

## Deploy Vercel

Khai báo toàn bộ biến trong `.env.example` tại Project Settings → Environment Variables. Build command mặc định là `pnpm build`.

## QStash

Tạo schedule mỗi 5 phút:

- Destination: `https://YOUR_DOMAIN/api/internal/sync`
- Method: `POST`
- Cron: `*/5 * * * *`
- Header: `Authorization: Bearer YOUR_SYNC_SECRET`

Endpoint xử lý tối đa 5 tài khoản đến hạn mỗi lượt, có khóa chống chạy chồng và upsert chống trùng giao dịch.
