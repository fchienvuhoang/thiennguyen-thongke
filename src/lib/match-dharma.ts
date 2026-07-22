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
  mode: "EXACT" | "UNORDERED_PARTS";
};

function keywordMatches(normalizedNarrative: string, keyword: string) {
  const normalizedKeyword = normalizeClassificationText(keyword);
  if (!normalizedKeyword) return null;

  // Ưu tiên cách khớp nguyên cụm như trước đây.
  if (normalizedNarrative.includes(normalizedKeyword)) return "EXACT" as const;

  // Với mã gồm nhiều thành phần, chấp nhận các thành phần xuất hiện ở bất kỳ
  // vị trí/thứ tự nào. Narrative đã bỏ dấu và ký tự phân cách nên vẫn khớp
  // khi người chuyển khoản viết hoa/thường, chèn dấu chấm/gạch, hoặc viết liền.
  const parts = normalizeText(keyword)
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  // Từ đơn ký tự như "Y" rất dễ xuất hiện trong tên/mã giao dịch và gây
  // dương tính giả khi đảo thứ tự (ví dụ DANG Y khớp "Dang Duc Huy").
  if (parts.length <= 1 || parts.some((part) => part.length < 2)) return null;
  return parts.every((part) => normalizedNarrative.includes(part))
    ? ("UNORDERED_PARTS" as const)
    : null;
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
  const allMatches: KeywordMatch<T>[] = [];

  for (const dharma of dharmas) {
    for (const keyword of [dharma.code, ...dharma.aliases]) {
      const normalizedKeyword = normalizeClassificationText(keyword);
      const mode = keywordMatches(normalizedNarrative, keyword);
      if (normalizedKeyword && mode) {
        allMatches.push({
          dharma,
          keyword,
          normalizedKeyword,
          mode,
        });
      }
    }
  }

  // Mọi cụm dài đều có quyền che cụm ngắn của thiện pháp khác. Không thu gọn
  // theo thiện pháp trước bước này, vì một mã phụ quan trọng có thể ngắn hơn
  // mã phụ khác trong cùng thiện pháp.
  let matches = allMatches.filter(
    (match) =>
      !allMatches.some(
        (other) =>
          other.dharma.id !== match.dharma.id &&
          other.normalizedKeyword.length > match.normalizedKeyword.length &&
          other.normalizedKeyword.includes(match.normalizedKeyword),
      ),
  );

  // Nếu còn xung đột giữa khớp trực tiếp và khớp ghép rời rạc, ưu tiên thiện
  // pháp có ít nhất một mã xuất hiện trực tiếp. Điều này tránh tên người như
  // "Truong Thi..." bị hiểu nhầm thành mã "TRUONG HA".
  const exactDharmaIds = new Set(
    matches
      .filter((match) => match.mode === "EXACT")
      .map((match) => match.dharma.id),
  );
  if (exactDharmaIds.size) {
    matches = matches.filter((match) => exactDharmaIds.has(match.dharma.id));
  }

  const bestMatchByDharma = new Map<string, KeywordMatch<T>>();
  for (const match of matches) {
    const current = bestMatchByDharma.get(match.dharma.id);
    if (
      !current ||
      match.normalizedKeyword.length > current.normalizedKeyword.length
    ) {
      bestMatchByDharma.set(match.dharma.id, match);
    }
  }
  return [...bestMatchByDharma.values()];
}
