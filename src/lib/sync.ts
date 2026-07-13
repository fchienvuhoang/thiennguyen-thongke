import { ClassificationStatus, Prisma, SyncStatus, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/format";

type ApiItem = {
  id: string;
  refId?: string | null;
  transactionAmount: number;
  transactionTime: string;
  narrative?: string | null;
  displayName?: string | null;
  type: "CREDIT" | "DEBIT";
  [key: string]: unknown;
};

type ApiResponse = {
  status: number;
  data: { items: ApiItem[]; page: number; pageSize: number; total: number };
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function syncAccount(bankAccountId: string, options?: { days?: number; maxPages?: number }) {
  const days = options?.days ?? 7;
  const maxPages = options?.maxPages ?? 5;
  const staleLock = new Date(Date.now() - 5 * 60_000);
  const locked = await prisma.bankAccount.updateMany({
    where: {
      id: bankAccountId,
      enabled: true,
      syncEnabled: true,
      OR: [{ syncStatus: { not: SyncStatus.RUNNING } }, { syncStatus: null }, { syncLockedAt: { lt: staleLock } }],
    },
    data: { syncStatus: SyncStatus.RUNNING, syncLockedAt: new Date(), lastSyncError: null },
  });
  if (!locked.count) return { skipped: true, inserted: 0, received: 0, pages: 0 };

  const account = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: bankAccountId },
    include: { dharmas: { where: { enabled: true } } },
  });
  const run = await prisma.syncRun.create({ data: { bankAccountId, status: SyncStatus.RUNNING } });
  let inserted = 0;
  let received = 0;
  let pages = 0;

  try {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const to = new Date();
    for (const transactionType of [TransactionType.CREDIT, TransactionType.DEBIT]) {
      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams({
          accountNo: account.accountNo,
          fromDate: isoDate(from),
          toDate: isoDate(to),
          type: transactionType,
          keyword: "",
          pageSize: "100",
          page: String(page),
          withTotal: "true",
        });
        const response = await fetch(`https://api.thiennguyen.app/api/v2/bank-account-transaction/search-by-accountNoV2?${params}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
        const payload = (await response.json()) as ApiResponse;
        if (payload.status !== 200 || !Array.isArray(payload.data?.items)) throw new Error("Phản hồi API không hợp lệ");
        const uniqueItems = [...new Map(payload.data.items.map((item) => [item.id, item])).values()];
        if (!uniqueItems.length) break;
        pages++;
        received += uniqueItems.length;
        let existing = 0;

        for (const item of uniqueItems) {
        const existed = await prisma.transaction.findUnique({
          where: { bankAccountId_externalId: { bankAccountId, externalId: item.id } },
          select: { id: true },
        });
        const rawData = JSON.parse(JSON.stringify(item)) as Prisma.InputJsonValue;
        const normalized = normalizeText(item.narrative || "");
        const matches = account.dharmas.filter((dharma) =>
          [dharma.code, ...dharma.aliases].some((code) => {
            const candidate = normalizeText(code);
            return candidate && (` ${normalized} `).includes(` ${candidate} `);
          }),
        );
        const status = matches.length === 1 ? ClassificationStatus.MATCHED : matches.length > 1 ? ClassificationStatus.AMBIGUOUS : ClassificationStatus.UNMATCHED;
        await prisma.transaction.upsert({
          where: { bankAccountId_externalId: { bankAccountId, externalId: item.id } },
          create: {
            organizationId: account.organizationId,
            bankAccountId,
            externalId: item.id,
            refId: item.refId || null,
            type: item.type === "DEBIT" ? TransactionType.DEBIT : TransactionType.CREDIT,
            amount: item.transactionAmount,
            transactionTime: new Date(item.transactionTime),
            narrative: item.narrative || "",
            normalizedNarrative: normalized,
            displayName: item.displayName,
            classificationStatus: status,
            dharmaId: matches.length === 1 ? matches[0].id : null,
            matchedCode: matches.length === 1 ? matches[0].code : null,
            rawData,
          },
          update: {
            amount: item.transactionAmount,
            narrative: item.narrative || "",
            normalizedNarrative: normalized,
            displayName: item.displayName,
            rawData,
            ...(matches.length === 1 ? { classificationStatus: status, dharmaId: matches[0].id, matchedCode: matches[0].code } : {}),
          },
        });
        if (existed) existing++;
        else inserted++;
        }
        if (existing >= uniqueItems.length - 1) break;
        if (uniqueItems.length <= payload.data.pageSize) break;
      }
    }

    await prisma.$transaction([
      prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { syncStatus: SyncStatus.SUCCESS, syncLockedAt: null, lastSyncedAt: new Date(), nextSyncAt: new Date(Date.now() + 5 * 60_000) },
      }),
      prisma.syncRun.update({ where: { id: run.id }, data: { status: SyncStatus.SUCCESS, pages, received, inserted, finishedAt: new Date() } }),
    ]);
    return { skipped: false, inserted, received, pages };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi đồng bộ";
    await prisma.$transaction([
      prisma.bankAccount.update({ where: { id: bankAccountId }, data: { syncStatus: SyncStatus.FAILED, syncLockedAt: null, lastSyncError: message } }),
      prisma.syncRun.update({ where: { id: run.id }, data: { status: SyncStatus.FAILED, pages, received, inserted, error: message, finishedAt: new Date() } }),
    ]);
    throw error;
  }
}

export async function syncDueAccounts(limit = 5) {
  const accounts = await prisma.bankAccount.findMany({
    where: { enabled: true, syncEnabled: true, nextSyncAt: { lte: new Date() } },
    orderBy: { nextSyncAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const results = [];
  for (const account of accounts) {
    try { results.push(await syncAccount(account.id)); }
    catch (error) { results.push({ error: error instanceof Error ? error.message : "Lỗi" }); }
  }
  return { processed: accounts.length, results };
}

export async function reclassifyAccount(bankAccountId: string) {
  const account = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: bankAccountId },
    include: { dharmas: { where: { enabled: true } } },
  });
  const transactions = await prisma.transaction.findMany({
    where: {
      bankAccountId,
      manuallyClassified: false,
      OR: [
        { classificationStatus: { in: [ClassificationStatus.UNMATCHED, ClassificationStatus.AMBIGUOUS] } },
        { dharmaId: { not: null } },
      ],
    },
    select: { id: true, narrative: true },
  });

  for (const transaction of transactions) {
    const normalized = normalizeText(transaction.narrative);
    const matches = account.dharmas.filter((dharma) =>
      [dharma.code, ...dharma.aliases].some((code) => {
        const candidate = normalizeText(code);
        return candidate && (` ${normalized} `).includes(` ${candidate} `);
      }),
    );
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        dharmaId: matches.length === 1 ? matches[0].id : null,
        matchedCode: matches.length === 1 ? matches[0].code : null,
        classificationStatus:
          matches.length === 1
            ? ClassificationStatus.MATCHED
            : matches.length > 1
              ? ClassificationStatus.AMBIGUOUS
              : ClassificationStatus.UNMATCHED,
      },
    });
  }
  return transactions.length;
}
