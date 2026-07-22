import type { Session } from "@/lib/auth";
import {
  normalizeClassificationText,
  normalizeText,
  toSlug,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

async function availableDharmaSlug(organizationId: string, name: string) {
  const base = toSlug(name);
  let publicSlug = base;
  let suffix = 2;
  while (
    await prisma.dharma.findFirst({
      where: { organizationId, publicSlug },
      select: { id: true },
    })
  )
    publicSlug = `${base}-${suffix++}`;
  return publicSlug;
}

function prepareDharmaInput(input: {
  name: string;
  code: string;
  aliases: string;
}) {
  const name = input.name.trim();
  const code = normalizeText(input.code);
  const aliases = input.aliases
    .split(",")
    .map(normalizeText)
    .filter(Boolean);
  if (!name || !code) throw new Error("Tên và mã thiện pháp là bắt buộc");

  const seen = new Map<string, { value: string; type: string }>();
  for (const [index, value] of [code, ...aliases].entries()) {
    const key = normalizeClassificationText(value);
    const type = index === 0 ? "mã chính" : "mã phụ";
    const duplicate = seen.get(key);
    if (duplicate) {
      throw new Error(
        `Từ khóa “${value}” bị trùng với ${duplicate.type} “${duplicate.value}” trong cùng thiện pháp.`,
      );
    }
    seen.set(key, { value, type });
  }
  return { name, code, aliases, keywords: seen };
}

async function assertKeywordsAvailable(
  organizationId: string,
  bankAccountId: string,
  keywords: Map<string, { value: string; type: string }>,
  excludeDharmaId?: string,
) {
  const dharmas = await prisma.dharma.findMany({
    where: {
      organizationId,
      bankAccountId,
      ...(excludeDharmaId ? { id: { not: excludeDharmaId } } : {}),
    },
    select: { name: true, code: true, aliases: true },
  });
  for (const dharma of dharmas) {
    for (const [index, value] of [dharma.code, ...dharma.aliases].entries()) {
      const requested = keywords.get(normalizeClassificationText(value));
      if (!requested) continue;
      const existingType = index === 0 ? "mã chính" : "mã phụ";
      throw new Error(
        `${requested.type === "mã chính" ? "Mã chính" : "Mã phụ"} “${requested.value}” trùng với ${existingType} “${value}” của thiện pháp “${dharma.name}”.`,
      );
    }
  }
}

export async function createDharma(
  session: Session,
  input: {
    bankAccountId: string;
    name: string;
    code: string;
    aliases: string;
  },
) {
  if (session.systemRole === "SUPER_ADMIN")
    throw new Error("Quản trị hệ thống không quản lý thiện pháp");

  const prepared = prepareDharmaInput(input);
  const [account, publicSlug] = await Promise.all([
    prisma.bankAccount.findFirst({
      where: {
        id: input.bankAccountId,
        organizationId: session.organizationId,
      },
      select: { id: true },
    }),
    availableDharmaSlug(session.organizationId, prepared.name),
    assertKeywordsAvailable(
      session.organizationId,
      input.bankAccountId,
      prepared.keywords,
    ),
  ]);
  if (!account) throw new Error("Không tìm thấy tài khoản");
  return prisma.dharma.create({
    data: {
      organizationId: session.organizationId,
      bankAccountId: account.id,
      name: prepared.name,
      publicSlug,
      code: prepared.code,
      aliases: prepared.aliases,
    },
    select: { id: true, bankAccountId: true, name: true },
  });
}

export async function updateDharma(
  session: Session,
  input: { id: string; name: string; code: string; aliases: string },
) {
  if (session.systemRole === "SUPER_ADMIN")
    throw new Error("Quản trị hệ thống không quản lý thiện pháp");
  const prepared = prepareDharmaInput(input);
  const existing = await prisma.dharma.findFirst({
    where: { id: input.id, organizationId: session.organizationId },
    select: { id: true, bankAccountId: true },
  });
  if (!existing) throw new Error("Không tìm thấy thiện pháp");
  await assertKeywordsAvailable(
    session.organizationId,
    existing.bankAccountId,
    prepared.keywords,
    input.id,
  );

  return prisma.dharma.update({
    where: { id: existing.id },
    data: {
      name: prepared.name,
      code: prepared.code,
      aliases: prepared.aliases,
    },
    select: { id: true, bankAccountId: true, name: true },
  });
}
