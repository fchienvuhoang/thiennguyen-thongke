"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clearSession, createSession, requireSession } from "@/lib/auth";
import { normalizeText, toSlug } from "@/lib/format";
import { reclassifyAccount } from "@/lib/sync";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { organization: true }, take: 1 } },
  });
  if (
    !user?.enabled ||
    !user.memberships[0] ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    redirect("/login?error=1");
  }
  const membership = user.memberships[0];
  await createSession({
    userId: user.id,
    organizationId: membership.organizationId,
    name: user.name,
    systemRole: user.systemRole,
    organizationRole: membership.role,
  });
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

function accountNoFromInput(input: string) {
  const raw = input.trim();
  try {
    const parsed = new URL(raw);
    if (parsed.hostname !== "api.thiennguyen.app")
      throw new Error("Chỉ hỗ trợ api.thiennguyen.app");
    return parsed.searchParams.get("accountNo")?.trim() || "";
  } catch (error) {
    if (raw.startsWith("http") && error instanceof Error) throw error;
    return raw;
  }
}

function statementUrlFromInput(input: string) {
  const raw = input.trim();
  if (!raw) return null;
  const parsed = new URL(raw);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "thiennguyen.app" ||
    !parsed.pathname.startsWith("/user/")
  ) {
    throw new Error("Link sao kê phải thuộc thiennguyen.app/user/...");
  }
  return parsed.toString();
}

async function availableOrganizationSlug(name: string) {
  const base = toSlug(name);
  let slug = base;
  let suffix = 2;
  while (
    await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    })
  )
    slug = `${base}-${suffix++}`;
  return slug;
}

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

export async function createBankAccountForOrganizationAction(
  formData: FormData,
) {
  const session = await requireSession();
  if (session.systemRole !== "SUPER_ADMIN") throw new Error("Không có quyền");
  const organizationId = String(formData.get("organizationId") || "");
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, enabled: true },
  });
  if (!organization) throw new Error("Không tìm thấy khách hàng");
  const source = String(formData.get("source") || "");
  const statementUrl = statementUrlFromInput(
    String(formData.get("statementUrl") || ""),
  );
  const accountNo = accountNoFromInput(source);
  const name = String(formData.get("name") || "").trim();
  if (!/^\d{3,20}$/.test(accountNo) || !name)
    throw new Error("Thông tin tài khoản không hợp lệ");
  await prisma.bankAccount.create({
    data: {
      organizationId: organization.id,
      accountNo,
      name,
      sourceUrl: source.startsWith("http") ? source : null,
      statementUrl,
    },
  });
  revalidatePath("/dashboard/admin");
}

export async function createDharmaAction(formData: FormData) {
  const session = await requireSession();
  if (session.systemRole === "SUPER_ADMIN")
    throw new Error("Quản trị hệ thống không quản lý thiện pháp");
  const bankAccountId = String(formData.get("bankAccountId") || "");
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId: session.organizationId },
  });
  if (!account) throw new Error("Không tìm thấy tài khoản");
  const name = String(formData.get("name") || "").trim();
  const code = normalizeText(String(formData.get("code") || ""));
  const aliases = String(formData.get("aliases") || "")
    .split(",")
    .map(normalizeText)
    .filter(Boolean);
  if (!name || !code) throw new Error("Tên và mã thiện pháp là bắt buộc");
  const publicSlug = await availableDharmaSlug(session.organizationId, name);
  await prisma.dharma.create({
    data: {
      organizationId: session.organizationId,
      bankAccountId,
      name,
      publicSlug,
      code,
      aliases,
    },
  });
  revalidatePath("/dashboard/dharmas");
}

export async function updateDharmaAction(formData: FormData) {
  const session = await requireSession();
  if (session.systemRole === "SUPER_ADMIN")
    throw new Error("Quản trị hệ thống không quản lý thiện pháp");
  const id = String(formData.get("id") || "");
  const dharma = await prisma.dharma.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!dharma) throw new Error("Không tìm thấy thiện pháp");
  const name = String(formData.get("name") || "").trim();
  const code = normalizeText(String(formData.get("code") || ""));
  const aliases = String(formData.get("aliases") || "")
    .split(",")
    .map(normalizeText)
    .filter(Boolean);
  if (!name || !code) throw new Error("Tên và mã thiện pháp là bắt buộc");
  await prisma.dharma.update({ where: { id }, data: { name, code, aliases } });
  await reclassifyAccount(dharma.bankAccountId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/dharmas");
  revalidatePath("/dashboard/transactions");
}

export async function deleteDharmaAction(formData: FormData) {
  const session = await requireSession();
  if (session.systemRole === "SUPER_ADMIN")
    throw new Error("Quản trị hệ thống không quản lý thiện pháp");
  const id = String(formData.get("id") || "");
  const dharma = await prisma.dharma.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!dharma) throw new Error("Không tìm thấy thiện pháp");
  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { dharmaId: id, manuallyClassified: false },
      data: {
        dharmaId: null,
        matchedCode: null,
        classificationStatus: "UNMATCHED",
      },
    }),
    prisma.dharma.delete({ where: { id } }),
  ]);
  await reclassifyAccount(dharma.bankAccountId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/dharmas");
  revalidatePath("/dashboard/transactions");
}

export async function classifyTransactionAction(formData: FormData) {
  const session = await requireSession();
  if (session.systemRole === "SUPER_ADMIN")
    throw new Error("Quản trị hệ thống không quản lý giao dịch");
  const transactionId = String(formData.get("transactionId") || "");
  const dharmaId = String(formData.get("dharmaId") || "");
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId: session.organizationId },
  });
  if (!transaction) throw new Error("Không tìm thấy giao dịch");

  if (!dharmaId) {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        dharmaId: null,
        matchedCode: null,
        manuallyClassified: false,
        classificationStatus: "UNMATCHED",
      },
    });
  } else {
    const dharma = await prisma.dharma.findFirst({
      where: {
        id: dharmaId,
        organizationId: session.organizationId,
        bankAccountId: transaction.bankAccountId,
      },
    });
    if (!dharma)
      throw new Error("Thiện pháp không thuộc tài khoản của giao dịch");
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        dharmaId: dharma.id,
        matchedCode: dharma.code,
        manuallyClassified: true,
        classificationStatus: "MANUAL",
      },
    });
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
}

export async function createOrganizationUserAction(formData: FormData) {
  const session = await requireSession();
  if (session.systemRole !== "SUPER_ADMIN") throw new Error("Không có quyền");
  const organizationName = String(
    formData.get("organizationName") || "",
  ).trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  if (!organizationName || !name || !email || password.length < 8)
    throw new Error("Thông tin chưa hợp lệ");
  const slug = await availableOrganizationSlug(organizationName);
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.organization.create({
    data: {
      name: organizationName,
      slug,
      memberships: {
        create: {
          role: "ADMIN",
          user: { create: { name, email, passwordHash } },
        },
      },
    },
  });
  revalidatePath("/dashboard/admin");
}

export async function updateCustomerAction(formData: FormData) {
  const session = await requireSession();
  if (session.systemRole !== "SUPER_ADMIN") throw new Error("Không có quyền");
  const organizationId = String(formData.get("organizationId") || "");
  const userId = String(formData.get("userId") || "");
  const organizationName = String(
    formData.get("organizationName") || "",
  ).trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      memberships: { some: { userId } },
    },
    select: { id: true },
  });
  if (!organization || !organizationName || !name || !email)
    throw new Error("Thông tin khách hàng chưa hợp lệ");
  if (password && password.length < 8)
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự");
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organization.id },
      data: { name: organizationName },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        enabled: true,
        ...(password
          ? { passwordHash: await bcrypt.hash(password, 12) }
          : {}),
      },
    }),
  ]);
  revalidatePath("/dashboard/admin");
}

export async function createCustomerUserAction(formData: FormData) {
  const session = await requireSession();
  if (session.systemRole !== "SUPER_ADMIN") throw new Error("Không có quyền");
  const organizationId = String(formData.get("organizationId") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const role =
    String(formData.get("role") || "MEMBER") === "ADMIN" ? "ADMIN" : "MEMBER";
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, enabled: true },
  });
  if (!organization || !name || !email || password.length < 8)
    throw new Error("Thông tin chưa hợp lệ");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      memberships: { create: { organizationId: organization.id, role } },
    },
  });
  revalidatePath("/dashboard/admin");
}

export async function resetCustomerPasswordAction(formData: FormData) {
  const session = await requireSession();
  if (session.systemRole !== "SUPER_ADMIN") throw new Error("Không có quyền");
  const userId = String(formData.get("userId") || "");
  const password = String(formData.get("password") || "");
  if (password.length < 8) throw new Error("Mật khẩu phải có ít nhất 8 ký tự");
  const user = await prisma.user.findFirst({
    where: { id: userId, systemRole: "USER", memberships: { some: {} } },
  });
  if (!user) throw new Error("Không tìm thấy tài khoản khách hàng");
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12), enabled: true },
  });
  revalidatePath("/dashboard/admin");
}
