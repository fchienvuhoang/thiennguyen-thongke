import type { Session } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function classifyTransaction(
  session: Session,
  transactionId: string,
  dharmaId: string,
) {
  if (session.systemRole === "SUPER_ADMIN")
    throw new Error("Quản trị hệ thống không quản lý giao dịch");

  const [transaction, dharma] = await Promise.all([
    prisma.transaction.findFirst({
      where: { id: transactionId, organizationId: session.organizationId },
      select: {
        id: true,
        bankAccountId: true,
        dharmaId: true,
        dharma: { select: { name: true } },
      },
    }),
    dharmaId
      ? prisma.dharma.findFirst({
          where: { id: dharmaId, organizationId: session.organizationId },
          select: { id: true, bankAccountId: true, code: true, name: true },
        })
      : Promise.resolve(null),
  ]);
  if (!transaction) throw new Error("Không tìm thấy giao dịch");
  if (dharma && dharma.bankAccountId !== transaction.bankAccountId)
    throw new Error("Thiện pháp không thuộc tài khoản của giao dịch");
  if (dharmaId && !dharma) throw new Error("Không tìm thấy thiện pháp");

  const classifiedAt = new Date();
  const [updated, classificationLog] = await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        dharmaId: dharma?.id || null,
        matchedCode: dharma?.code || null,
        manuallyClassified: true,
        classificationStatus: "MANUAL",
        classifiedByEmail: session.email,
        classifiedAt,
      },
      select: {
        id: true,
        dharmaId: true,
        manuallyClassified: true,
        classifiedByEmail: true,
        classifiedAt: true,
      },
    }),
    prisma.classificationLog.create({
      data: {
        organizationId: session.organizationId,
        transactionId: transaction.id,
        actorUserId: session.userId,
        actorEmail: session.email,
        source: "MANUAL",
        previousDharmaId: transaction.dharmaId,
        previousDharmaName: transaction.dharma?.name,
        newDharmaId: dharma?.id,
        newDharmaName: dharma?.name,
      },
      select: {
        id: true,
        source: true,
        actorEmail: true,
        previousDharmaName: true,
        newDharmaName: true,
        createdAt: true,
      },
    }),
  ]);

  return { ...updated, classificationLog };
}
