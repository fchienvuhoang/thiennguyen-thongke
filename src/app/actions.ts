"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clearSession, requireSession } from "@/lib/auth";
import { normalizeText, toSlug } from "@/lib/format";
import { reclassifyAccount } from "@/lib/sync";

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

export async function updateBankAccountAction(formData: FormData) {
  const session = await requireSession();
  if (session.systemRole !== "SUPER_ADMIN") throw new Error("Không có quyền");
  const id = String(formData.get("id") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const account = await prisma.bankAccount.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!account) throw new Error("Không tìm thấy tài khoản ngân hàng");
  const source = String(formData.get("source") || "");
  const accountNo = accountNoFromInput(source);
  const name = String(formData.get("name") || "").trim();
  const statementUrl = statementUrlFromInput(
    String(formData.get("statementUrl") || ""),
  );
  if (!/^\d{3,20}$/.test(accountNo) || !name)
    throw new Error("Thông tin tài khoản không hợp lệ");
  const enabled = formData.get("enabled") === "on";
  const syncEnabled = formData.get("syncEnabled") === "on";
  await prisma.bankAccount.update({
    where: { id: account.id },
    data: {
      name,
      accountNo,
      sourceUrl: source.startsWith("http") ? source : null,
      statementUrl,
      enabled,
      syncEnabled,
      ...(enabled && syncEnabled ? { nextSyncAt: new Date() } : {}),
    },
  });
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
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
  await reclassifyAccount(account.id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/dharmas");
  revalidatePath("/dashboard/transactions");
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
  revalidatePath("/minh-bach/[slug]", "page");
  revalidatePath("/minh-bach/[slug]/[dharmaId]", "page");
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
    include: { dharma: { select: { id: true, name: true } } },
  });
  if (!transaction) throw new Error("Không tìm thấy giao dịch");

  const actor = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { id: true, email: true },
  });

  if (!dharmaId) {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          dharmaId: null,
          matchedCode: null,
          manuallyClassified: true,
          classificationStatus: "MANUAL",
          classifiedByEmail: actor.email,
          classifiedAt: new Date(),
        },
      }),
      prisma.classificationLog.create({
        data: {
          organizationId: session.organizationId,
          transactionId: transaction.id,
          actorUserId: actor.id,
          actorEmail: actor.email,
          source: "MANUAL",
          previousDharmaId: transaction.dharmaId,
          previousDharmaName: transaction.dharma?.name,
        },
      }),
    ]);
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
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          dharmaId: dharma.id,
          matchedCode: dharma.code,
          manuallyClassified: true,
          classificationStatus: "MANUAL",
          classifiedByEmail: actor.email,
          classifiedAt: new Date(),
        },
      }),
      prisma.classificationLog.create({
        data: {
          organizationId: session.organizationId,
          transactionId: transaction.id,
          actorUserId: actor.id,
          actorEmail: actor.email,
          source: "MANUAL",
          previousDharmaId: transaction.dharmaId,
          previousDharmaName: transaction.dharma?.name,
          newDharmaId: dharma.id,
          newDharmaName: dharma.name,
        },
      }),
    ]);
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
  if (!organizationName || !name || !email)
    throw new Error("Thông tin chưa hợp lệ");
  const slug = await availableOrganizationSlug(organizationName);
  await prisma.organization.create({
    data: {
      name: organizationName,
      slug,
      memberships: {
        create: {
          role: "ADMIN",
          user: { create: { name, email } },
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
  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      memberships: { some: { userId } },
    },
    select: { id: true },
  });
  if (!organization || !organizationName || !name || !email)
    throw new Error("Thông tin khách hàng chưa hợp lệ");
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
      },
    }),
  ]);
  revalidatePath("/dashboard/admin");
}

export async function createCustomerUserAction(formData: FormData) {
  const session = await requireSession();
  const requestedOrganizationId = String(
    formData.get("organizationId") || "",
  );
  const organizationId =
    session.systemRole === "SUPER_ADMIN"
      ? requestedOrganizationId
      : session.organizationId;
  if (
    session.systemRole !== "SUPER_ADMIN" &&
    session.organizationRole !== "ADMIN"
  )
    throw new Error("Không có quyền thêm thành viên");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const role =
    String(formData.get("role") || "MEMBER") === "ADMIN" ? "ADMIN" : "MEMBER";
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, enabled: true },
  });
  if (!organization || !name || !email)
    throw new Error("Thông tin chưa hợp lệ");
  await prisma.user.create({
    data: {
      name,
      email,
      memberships: { create: { organizationId: organization.id, role } },
    },
  });
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard");
}

export async function updateOrganizationMemberAction(formData: FormData) {
  const session = await requireSession();
  if (session.systemRole !== "SUPER_ADMIN") throw new Error("Không có quyền");
  const membershipId = String(formData.get("membershipId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: { id: true, userId: true },
  });
  if (!membership) throw new Error("Không tìm thấy thành viên trong tổ chức");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const role =
    String(formData.get("role") || "MEMBER") === "ADMIN" ? "ADMIN" : "MEMBER";
  const enabled = formData.get("enabled") === "on";
  if (!name || !email) throw new Error("Thông tin thành viên chưa hợp lệ");
  await prisma.$transaction([
    prisma.membership.update({
      where: { id: membership.id },
      data: { role },
    }),
    prisma.user.update({
      where: { id: membership.userId },
      data: { name, email, enabled },
    }),
  ]);
  revalidatePath("/dashboard/admin");
}
