import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CopyTransactionsButton } from "@/components/copy-transactions-button";
import { PublicDateFilter } from "@/components/public-date-filter";
import { PublicShell } from "@/components/public-shell";
import { PublicTransactionTabs } from "@/components/public-transaction-tabs";
import { dateTime, money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ slug: string; dharmaId: string }>;
  searchParams: Promise<{ type?: string; from?: string; to?: string }>;
};

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return undefined;
  return value;
}

function displayDate(value: string) {
  return value.split("-").reverse().join("/");
}

const getPublicDharma = cache((slug: string, dharmaId: string) =>
  prisma.dharma.findFirst({
    where: {
      OR: [{ publicSlug: dharmaId }, { id: dharmaId }],
      enabled: true,
      organization: { slug, enabled: true },
    },
    include: { organization: true, bankAccount: true },
  }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, dharmaId } = await params;
  const dharma = await getPublicDharma(slug, dharmaId);
  return {
    title: dharma ? `${dharma.name} — Minh bạch` : "Chi tiết thiện pháp",
  };
}

export default async function PublicDharmaPage({
  params,
  searchParams,
}: Props) {
  const [{ slug, dharmaId }, filters] = await Promise.all([
    params,
    searchParams,
  ]);
  const dharma = await getPublicDharma(slug, dharmaId);
  if (!dharma) notFound();
  const type =
    filters.type === "CREDIT" || filters.type === "DEBIT"
      ? filters.type
      : undefined;
  let fromDate = validDate(filters.from);
  let toDate = validDate(filters.to);
  if (fromDate && !toDate) toDate = fromDate;
  if (toDate && !fromDate) fromDate = toDate;
  if (fromDate && toDate && fromDate > toDate)
    [fromDate, toDate] = [toDate, fromDate];
  const hasDateFilter = Boolean(fromDate && toDate);
  const dateRangeWhere =
    fromDate && toDate
      ? {
          transactionTime: {
            gte: new Date(`${fromDate}T00:00:00+07:00`),
            lt: new Date(
              new Date(`${toDate}T00:00:00+07:00`).getTime() +
                24 * 60 * 60 * 1000,
            ),
          },
        }
      : {};
  const dateSummary =
    fromDate && toDate
      ? fromDate === toDate
        ? `Ngày ${displayDate(fromDate)}`
        : `Từ ${displayDate(fromDate)} đến ${displayDate(toDate)}`
      : "Tất cả ngày";
  const [totals, transactions] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: { dharmaId: dharma.id, ...dateRangeWhere },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.findMany({
      where: {
        dharmaId: dharma.id,
        ...(type ? { type } : {}),
        ...dateRangeWhere,
      },
      orderBy: { transactionTime: "desc" },
      take: hasDateFilter ? undefined : 50,
      select: {
        id: true,
        refId: true,
        type: true,
        amount: true,
        transactionTime: true,
        narrative: true,
        displayName: true,
      },
    }),
  ]);
  const income = totals.find((item) => item.type === "CREDIT");
  const expense = totals.find((item) => item.type === "DEBIT");
  // Without a date filter, select the latest 50 records. Date-filtered views
  // include every matching row so the Excel copy contains the full range.
  const chronologicalTransactions = [...transactions].reverse();

  return (
    <PublicShell
      organizationName={dharma.organization.name}
      homeHref={`/minh-bach/${slug}`}
    >
      <section className="mb-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="badge badge-green">{dharma.code}</span>
          {dharma.aliases.map((alias) => (
            <span key={alias} className="badge badge-gray">
              {alias}
            </span>
          ))}
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold">{dharma.name}</h1>
        <p className="text-sm text-[#718078] mt-2">
          Tài khoản tiếp nhận: {dharma.bankAccount.name} ·{" "}
          {dharma.bankAccount.accountNo}
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4 pt-4 border-t border-[#dfe6e1]">
          <div>
            <p className="text-xs text-[#718078]">Tổng thu</p>
            <p className="text-lg font-semibold text-[#176b46] mt-0.5">
              {money.format(Number(income?._sum.amount || 0))}
            </p>
            <p className="text-xs text-[#8a948e]">
              {income?._count || 0} giao dịch
            </p>
          </div>
          <div>
            <p className="text-xs text-[#718078]">Tổng chi</p>
            <p className="text-lg font-semibold text-red-700 mt-0.5">
              {money.format(Number(expense?._sum.amount || 0))}
            </p>
            <p className="text-xs text-[#8a948e]">
              {expense?._count || 0} giao dịch
            </p>
          </div>
        </div>
        <p className="text-xs font-medium text-[#48617e] mt-3">
          Phạm vi thống kê: {dateSummary}
        </p>
      </section>
      <section className="card">
        <div className="p-5 border-b border-[#e3e9e5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg">Giao dịch của thiện pháp</h2>
            <p className="text-sm text-[#7a867e] mt-1">
              {hasDateFilter
                ? `${chronologicalTransactions.length.toLocaleString("vi-VN")} giao dịch trong phạm vi đã chọn.`
                : "Hiển thị 50 giao dịch gần nhất."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyTransactionsButton
              transactions={chronologicalTransactions.map((item) => ({
                transactionTime: item.transactionTime.toISOString(),
                displayName: item.displayName,
                narrative: item.narrative,
                amount: Number(item.amount),
              }))}
            />
            <PublicTransactionTabs
              activeType={type}
              fromDate={fromDate}
              toDate={toDate}
            />
          </div>
        </div>
        <PublicDateFilter
          key={`${fromDate || "all"}-${toDate || "all"}`}
          activeType={type}
          fromDate={fromDate}
          toDate={toDate}
        />
        <div className="divide-y divide-[#edf1ee] sm:hidden">
          {chronologicalTransactions.map((item) => (
            <article key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">
                    {item.displayName || "Không xác định"}
                  </p>
                  <p className="text-xs text-[#7a867e] mt-1">
                    {dateTime.format(item.transactionTime)}
                  </p>
                </div>
                <p
                  className={`shrink-0 font-semibold ${item.type === "CREDIT" ? "text-[#176b46]" : "text-red-700"}`}
                >
                  {item.type === "CREDIT" ? "+" : "−"}
                  {money.format(Number(item.amount))}
                </p>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words mt-3">
                {item.narrative}
              </p>
              {item.refId && (
                <p className="text-xs text-[#8a948e] break-all mt-2">
                  Mã GD: <span className="font-mono font-medium">{item.refId}</span>
                </p>
              )}
            </article>
          ))}
          {!chronologicalTransactions.length && (
            <p className="text-center py-12 text-sm text-[#7a867e]">
              Chưa có giao dịch.
            </p>
          )}
        </div>
        <div className="hidden sm:block">
          <table className="table-fixed">
            <colgroup>
              <col className="w-[21%]" />
              <col className="w-[39%]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead>
              <tr>
                <th>Thời gian / Mã GD</th>
                <th>Nội dung chuyển khoản</th>
                <th>Người giao dịch</th>
                <th className="text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {chronologicalTransactions.map((item) => (
                <tr key={item.id}>
                  <td>
                    {dateTime.format(item.transactionTime)}
                    {item.refId && (
                      <p className="text-xs text-[#8a948e] mt-1">
                        Mã GD: <span className="font-mono font-medium">{item.refId}</span>
                      </p>
                    )}
                  </td>
                  <td>
                    <p className="whitespace-pre-wrap break-words">
                      {item.narrative}
                    </p>
                  </td>
                  <td className="break-words">
                    {item.displayName || "Không xác định"}
                  </td>
                  <td
                    className={`text-right font-semibold whitespace-nowrap ${item.type === "CREDIT" ? "text-[#176b46]" : "text-red-700"}`}
                  >
                    {item.type === "CREDIT" ? "+" : "−"}
                    {money.format(Number(item.amount))}
                  </td>
                </tr>
              ))}
              {!chronologicalTransactions.length && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-[#7a867e]">
                    Chưa có giao dịch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PublicShell>
  );
}
