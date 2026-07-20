import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      ...init?.headers,
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  if (session.systemRole === "SUPER_ADMIN")
    return json({ error: "Forbidden" }, { status: 403 });

  const type = request.nextUrl.searchParams.get("type");
  const account = request.nextUrl.searchParams.get("account") || "";
  const requestedTab = request.nextUrl.searchParams.get("tab") || "all";
  const page = Math.max(
    1,
    Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1,
  );
  const organizationId = session.organizationId;

  if (account) {
    const validAccount = await prisma.bankAccount.findFirst({
      where: { id: account, organizationId },
      select: { id: true },
    });
    if (!validAccount)
      return json({ error: "Tài khoản nguồn không hợp lệ" }, { status: 400 });
  }

  let tab = requestedTab;
  if (tab !== "all" && tab !== "unmatched") {
    const validDharma = await prisma.dharma.findFirst({
      where: {
        id: tab,
        organizationId,
        enabled: true,
        ...(account ? { bankAccountId: account } : {}),
      },
      select: { id: true },
    });
    if (!validDharma) tab = "all";
  }

  const where: Prisma.TransactionWhereInput = {
    organizationId,
    ...(type === "CREDIT" || type === "DEBIT" ? { type } : {}),
    ...(tab === "unmatched"
      ? { dharmaId: null }
      : tab !== "all"
        ? { dharmaId: tab }
        : {}),
    ...(account ? { bankAccountId: account } : {}),
  };

  const [transactions, total, groupedCounts] = await Promise.all([
    prisma.transaction.findMany({
      where,
      select: {
        id: true,
        bankAccountId: true,
        dharmaId: true,
        type: true,
        amount: true,
        transactionTime: true,
        narrative: true,
        displayName: true,
        refId: true,
        manuallyClassified: true,
        classifiedByEmail: true,
        classifiedAt: true,
        bankAccount: { select: { accountNo: true } },
        classificationLogs: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            source: true,
            actorEmail: true,
            previousDharmaName: true,
            newDharmaName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { transactionTime: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({
      by: ["dharmaId"],
      where: {
        organizationId,
        ...(account ? { bankAccountId: account } : {}),
      },
      _count: true,
    }),
  ]);

  const countsByDharma: Record<string, number> = {};
  let all = 0;
  let unmatched = 0;
  for (const row of groupedCounts) {
    all += row._count;
    if (row.dharmaId) countsByDharma[row.dharmaId] = row._count;
    else unmatched += row._count;
  }

  return json({
    data: transactions.map((transaction) => ({
      ...transaction,
      amount: Number(transaction.amount),
      transactionTime: transaction.transactionTime.toISOString(),
      classifiedAt: transaction.classifiedAt?.toISOString() || null,
      classificationLogs: transaction.classificationLogs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
    })),
    meta: {
      tab,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
    counts: { all, unmatched, byDharma: countsByDharma },
  });
}
