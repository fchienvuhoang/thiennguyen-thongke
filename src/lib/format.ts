export const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseMbDateTime(value: string) {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasTimeZone ? value : `${value}+07:00`);
}

export function toSlug(value: string) {
  return (
    normalizeText(value).toLowerCase().replace(/\s+/g, "-") || "thien-phap"
  );
}
