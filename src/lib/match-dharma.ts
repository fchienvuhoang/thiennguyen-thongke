import {
  normalizeClassificationText,
  normalizeText,
} from "@/lib/format";

export type ClassifiableDharma = {
  id: string;
  code: string;
  aliases: string[];
};

type KeywordMatch<T extends ClassifiableDharma> = {
  dharma: T;
  keyword: string;
  normalizedKeyword: string;
};

function keywordMatches(normalizedNarrative: string, keyword: string) {
  const normalizedKeyword = normalizeClassificationText(keyword);
  if (!normalizedKeyword) return false;

  // Ưu tiên cách khớp nguyên cụm như trước đây.
  if (normalizedNarrative.includes(normalizedKeyword)) return true;

  // Với mã gồm nhiều thành phần, chấp nhận các thành phần xuất hiện ở bất kỳ
  // vị trí/thứ tự nào. Narrative đã bỏ dấu và ký tự phân cách nên vẫn khớp
  // khi người chuyển khoản viết hoa/thường, chèn dấu chấm/gạch, hoặc viết liền.
  const parts = normalizeText(keyword)
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  return (
    parts.length > 1 &&
    parts.every((part) => normalizedNarrative.includes(part))
  );
}

/**
 * Tìm các thiện pháp khớp nội dung giao dịch.
 *
 * Một từ khóa ngắn bị loại khi nó nằm trọn trong một từ khóa dài hơn
 * của thiện pháp khác. Ví dụ: `TP69 AN TONG` ưu tiên hơn cả
 * `TP69` và `AN TONG`. Các từ khóa độc lập không che lấp nhau vẫn
 * được giữ lại để hệ thống đánh dấu xung đột.
 */
export function matchDharmas<T extends ClassifiableDharma>(
  narrative: string,
  dharmas: T[],
) {
  const normalizedNarrative = normalizeClassificationText(narrative);
  const bestMatchByDharma = new Map<string, KeywordMatch<T>>();

  for (const dharma of dharmas) {
    for (const keyword of [dharma.code, ...dharma.aliases]) {
      const normalizedKeyword = normalizeClassificationText(keyword);
      if (!normalizedKeyword || !keywordMatches(normalizedNarrative, keyword)) {
        continue;
      }

      const current = bestMatchByDharma.get(dharma.id);
      if (
        !current ||
        normalizedKeyword.length > current.normalizedKeyword.length
      ) {
        bestMatchByDharma.set(dharma.id, {
          dharma,
          keyword,
          normalizedKeyword,
        });
      }
    }
  }

  const matches = [...bestMatchByDharma.values()];
  return matches.filter(
    (match) =>
      !matches.some(
        (other) =>
          other.dharma.id !== match.dharma.id &&
          other.normalizedKeyword.length > match.normalizedKeyword.length &&
          other.normalizedKeyword.includes(match.normalizedKeyword),
      ),
  );
}
