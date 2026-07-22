import { normalizeClassificationText } from "@/lib/format";

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
      if (
        !normalizedKeyword ||
        !normalizedNarrative.includes(normalizedKeyword)
      ) {
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
