import type { Session } from "@/lib/auth";
import { normalizeText, toSlug } from "@/lib/format";
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

  const account = await prisma.bankAccount.findFirst({
    where: {
      id: input.bankAccountId,
      organizationId: session.organizationId,
    },
    select: { id: true },
  });
  if (!account) throw new Error("Không tìm thấy tài khoản");

  const name = input.name.trim();
  const code = normalizeText(input.code);
  const aliases = [...new Set(
    input.aliases
      .split(",")
      .map(normalizeText)
      .filter((alias) => alias && alias !== code),
  )];
  if (!name || !code) throw new Error("Tên và mã thiện pháp là bắt buộc");

  const publicSlug = await availableDharmaSlug(session.organizationId, name);
  return prisma.dharma.create({
    data: {
      organizationId: session.organizationId,
      bankAccountId: account.id,
      name,
      publicSlug,
      code,
      aliases,
    },
    select: { id: true, bankAccountId: true, name: true },
  });
}
