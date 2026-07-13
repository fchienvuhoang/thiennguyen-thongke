import type { Session } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function classifyTransaction(
  session: Session,
  transactionId: string,
  dharmaId: string,
) {
  if (session.systemRole === "SUPER_ADMIN")
    throw new Error("Quản trị hệ thống không quản lý giao dịch");

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
    return;
  }

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
