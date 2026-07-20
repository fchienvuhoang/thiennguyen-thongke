import {
  ClassificationStatus,
  Prisma,
  SyncStatus,
  TransactionType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeClassificationText,
  normalizeText,
  parseMbDateTime,
} from "@/lib/format";

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

const SYNC_LOOKBACK_DAYS = 3;
const PAGE_WRITE_BATCH_SIZE = 20;
const vietnamDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isoDate(date: Date) {
  return vietnamDate.format(date);
}

export async function syncAccount(
  bankAccountId: string,
  options?: { days?: number; maxPages?: number },
) {
  const days = Math.min(
    SYNC_LOOKBACK_DAYS,
    Math.max(1, options?.days ?? SYNC_LOOKBACK_DAYS),
  );
  const maxPages = options?.maxPages ?? 5;
  const staleLock = new Date(Date.now() - 5 * 60_000);
  const locked = await prisma.bankAccount.updateMany({
    where: {
      id: bankAccountId,
      enabled: true,
      syncEnabled: true,
      OR: [
        { syncStatus: { not: SyncStatus.RUNNING } },
        { syncStatus: null },
        { syncLockedAt: { lt: staleLock } },
      ],
    },
    data: {
      syncStatus: SyncStatus.RUNNING,
      syncLockedAt: new Date(),
      lastSyncError: null,
    },
  });
  if (!locked.count)
    return { skipped: true, inserted: 0, received: 0, pages: 0 };

  await prisma.syncRun.updateMany({
    where: { bankAccountId, status: SyncStatus.RUNNING },
    data: {
      status: SyncStatus.FAILED,
      error: "Phiên đồng bộ trước bị gián đoạn",
      finishedAt: new Date(),
    },
  });

  const account = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: bankAccountId },
    include: { dharmas: { where: { enabled: true } } },
  });
  const run = await prisma.syncRun.create({
    data: { bankAccountId, status: SyncStatus.RUNNING },
  });
  let inserted = 0;
  let received = 0;
  let pages = 0;

  try {
    const to = new Date();
    // Tính cả hôm nay: 3 ngày tương ứng hôm nay và 2 ngày liền trước.
    const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    for (const transactionType of [
      TransactionType.CREDIT,
      TransactionType.DEBIT,
    ]) {
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
        const response = await fetch(
          `https://api.thiennguyen.app/api/v2/bank-account-transaction/search-by-accountNoV2?${params}`,
          {
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
        const payload = (await response.json()) as ApiResponse;
        if (payload.status !== 200 || !Array.isArray(payload.data?.items))
          throw new Error("Phản hồi API không hợp lệ");
        const uniqueItems = [
          ...new Map(
            payload.data.items.map((item) => [item.id, item]),
          ).values(),
        ];
        if (!uniqueItems.length) break;
        pages++;
        received += uniqueItems.length;
        const existingTransactions = await prisma.transaction.findMany({
          where: {
            bankAccountId,
            externalId: { in: uniqueItems.map((item) => item.id) },
          },
          select: {
            externalId: true,
            dharmaId: true,
            manuallyClassified: true,
            dharma: { select: { name: true } },
          },
        });
        const existingByExternalId = new Map(
          existingTransactions.map((transaction) => [
            transaction.externalId,
            transaction,
          ]),
        );
        const preparedItems = uniqueItems.map((item) => {
          const existed = existingByExternalId.get(item.id);
          const rawData = JSON.parse(
            JSON.stringify(item),
          ) as Prisma.InputJsonValue;
          const normalized = normalizeText(item.narrative || "");
          const normalizedForClassification = normalizeClassificationText(
            item.narrative || "",
          );
          const matches = account.dharmas.filter((dharma) =>
            [dharma.code, ...dharma.aliases].some((code) => {
              const candidate = normalizeClassificationText(code);
              return (
                candidate && normalizedForClassification.includes(candidate)
              );
            }),
          );
          const status =
            matches.length === 1
              ? ClassificationStatus.MATCHED
              : matches.length > 1
                ? ClassificationStatus.AMBIGUOUS
                : ClassificationStatus.UNMATCHED;
          const autoDharma = matches.length === 1 ? matches[0] : null;
          return {
            item,
            existed,
            rawData,
            normalized,
            status,
            autoDharma,
          };
        });
        const savedTransactions: Array<{ id: string }> = [];

        for (
          let offset = 0;
          offset < preparedItems.length;
          offset += PAGE_WRITE_BATCH_SIZE
        ) {
          const batch = preparedItems.slice(
            offset,
            offset + PAGE_WRITE_BATCH_SIZE,
          );
          const savedBatch = await prisma.$transaction(
            batch.map(
              ({ item, existed, rawData, normalized, status, autoDharma }) =>
                prisma.transaction.upsert({
                  where: {
                    bankAccountId_externalId: {
                      bankAccountId,
                      externalId: item.id,
                    },
                  },
                  create: {
                    organizationId: account.organizationId,
                    bankAccountId,
                    externalId: item.id,
                    refId: item.refId || null,
                    type:
                      item.type === "DEBIT"
                        ? TransactionType.DEBIT
                        : TransactionType.CREDIT,
                    amount: item.transactionAmount,
                    transactionTime: parseMbDateTime(item.transactionTime),
                    narrative: item.narrative || "",
                    normalizedNarrative: normalized,
                    displayName: item.displayName,
                    classificationStatus: status,
                    dharmaId: autoDharma?.id || null,
                    matchedCode: autoDharma?.code || null,
                    classifiedAt: new Date(),
                    rawData,
                  },
                  update: {
                    amount: item.transactionAmount,
                    narrative: item.narrative || "",
                    normalizedNarrative: normalized,
                    displayName: item.displayName,
                    rawData,
                    ...(!existed?.manuallyClassified
                      ? {
                          classificationStatus: status,
                          dharmaId: autoDharma?.id || null,
                          matchedCode: autoDharma?.code || null,
                          classifiedByEmail: null,
                          classifiedAt: new Date(),
                        }
                      : {}),
                  },
                  select: { id: true },
                }),
            ),
          );
          savedTransactions.push(...savedBatch);
        }

        const classificationLogs: Prisma.ClassificationLogCreateManyInput[] =
          preparedItems.flatMap(({ existed, autoDharma }, index) =>
            !existed?.manuallyClassified &&
            (existed?.dharmaId || null) !== (autoDharma?.id || null)
              ? [
                  {
                    organizationId: account.organizationId,
                    transactionId: savedTransactions[index].id,
                    source: "AUTO_SYNC",
                    previousDharmaId: existed?.dharmaId,
                    previousDharmaName: existed?.dharma?.name,
                    newDharmaId: autoDharma?.id,
                    newDharmaName: autoDharma?.name,
                  },
                ]
              : [],
          );
        if (classificationLogs.length) {
          await prisma.classificationLog.createMany({
            data: classificationLogs,
          });
        }

        const existing = existingTransactions.length;
        inserted += uniqueItems.length - existing;
        if (existing >= uniqueItems.length - 1) break;
        if (uniqueItems.length <= payload.data.pageSize) break;
      }
    }

    await prisma.$transaction([
      prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          syncStatus: SyncStatus.SUCCESS,
          syncLockedAt: null,
          lastSyncedAt: new Date(),
          nextSyncAt: new Date(Date.now() + 5 * 60_000),
        },
      }),
      prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: SyncStatus.SUCCESS,
          pages,
          received,
          inserted,
          finishedAt: new Date(),
        },
      }),
    ]);
    return { skipped: false, inserted, received, pages };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi đồng bộ";
    await prisma.$transaction([
      prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          syncStatus: SyncStatus.FAILED,
          syncLockedAt: null,
          lastSyncError: message,
        },
      }),
      prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: SyncStatus.FAILED,
          pages,
          received,
          inserted,
          error: message,
          finishedAt: new Date(),
        },
      }),
    ]);
    throw error;
  }
}

export async function syncDueAccounts(limit = 5) {
  const accounts = await prisma.bankAccount.findMany({
    where: {
      enabled: true,
      syncEnabled: true,
      nextSyncAt: { lte: new Date() },
    },
    orderBy: { nextSyncAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const results = await Promise.all(
    accounts.map(async (account) => {
      try {
        return await syncAccount(account.id);
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Lỗi" };
      }
    }),
  );
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
        {
          classificationStatus: {
            in: [
              ClassificationStatus.UNMATCHED,
              ClassificationStatus.AMBIGUOUS,
            ],
          },
        },
        { dharmaId: { not: null } },
      ],
    },
    select: {
      id: true,
      narrative: true,
      dharmaId: true,
      matchedCode: true,
      classificationStatus: true,
      dharma: { select: { name: true } },
    },
  });

  const groups = new Map<
    string,
    {
      ids: string[];
      dharmaId: string | null;
      matchedCode: string | null;
      classificationStatus: ClassificationStatus;
    }
  >();
  const auditRows: Prisma.ClassificationLogCreateManyInput[] = [];

  for (const transaction of transactions) {
    const normalized = normalizeClassificationText(transaction.narrative);
    const matches = account.dharmas.filter((dharma) =>
      [dharma.code, ...dharma.aliases].some((code) => {
        const candidate = normalizeClassificationText(code);
        return candidate && normalized.includes(candidate);
      }),
    );
    const classificationStatus =
      matches.length === 1
        ? ClassificationStatus.MATCHED
        : matches.length > 1
          ? ClassificationStatus.AMBIGUOUS
          : ClassificationStatus.UNMATCHED;
    const dharmaId = matches.length === 1 ? matches[0].id : null;
    const matchedCode = matches.length === 1 ? matches[0].code : null;
    const changed =
      (transaction.dharmaId || null) !== dharmaId ||
      (transaction.matchedCode || null) !== matchedCode ||
      transaction.classificationStatus !== classificationStatus;
    if (!changed) continue;

    const key = `${classificationStatus}:${dharmaId || ""}`;
    const group = groups.get(key) || {
      ids: [],
      dharmaId,
      matchedCode,
      classificationStatus,
    };
    group.ids.push(transaction.id);
    groups.set(key, group);
    if ((transaction.dharmaId || null) !== dharmaId) {
      auditRows.push({
        organizationId: account.organizationId,
        transactionId: transaction.id,
        source: "AUTO_RECLASSIFY",
        previousDharmaId: transaction.dharmaId,
        previousDharmaName: transaction.dharma?.name,
        newDharmaId: dharmaId,
        newDharmaName: matches.length === 1 ? matches[0].name : null,
      });
    }
  }

  const updates = [];
  for (const group of groups.values()) {
    for (let offset = 0; offset < group.ids.length; offset += 500) {
      updates.push(
        prisma.transaction.updateMany({
          where: { id: { in: group.ids.slice(offset, offset + 500) } },
          data: {
            dharmaId: group.dharmaId,
            matchedCode: group.matchedCode,
            classificationStatus: group.classificationStatus,
            classifiedByEmail: null,
            classifiedAt: new Date(),
          },
        }),
      );
    }
  }
  if (auditRows.length) {
    updates.push(prisma.classificationLog.createMany({ data: auditRows }));
  }
  if (updates.length) await prisma.$transaction(updates);
  const updated = [...groups.values()].reduce(
    (total, group) => total + group.ids.length,
    0,
  );
  return { scanned: transactions.length, updated };
}
