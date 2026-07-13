import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  type LucideIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PublicShell } from "@/components/public-shell";
import { PublicTransactionTabs } from "@/components/public-transaction-tabs";
import { dateTime, money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
};

const getPublicOrganization = cache((slug: string) =>
  prisma.organization.findFirst({ where: { slug, enabled: true } }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const organization = await getPublicOrganization(slug);
  return {
    title: organization
      ? `Minh bạch — ${organization.name}`
      : "Trang minh bạch",
  };
}

export default async function PublicOrganizationPage({
  params,
  searchParams,
}: Props) {
  const [{ slug }, filters] = await Promise.all([params, searchParams]);
  const organization = await getPublicOrganization(slug);
  if (!organization) notFound();
  const type =
    filters.type === "CREDIT" || filters.type === "DEBIT"
      ? filters.type
      : undefined;
  const [totals, accounts, dharmas, grouped, transactions] =
    await Promise.all([
      prisma.transaction.groupBy({
        by: ["type"],
        where: { organizationId: organization.id },
        _sum: { amount: true },
      }),
      prisma.bankAccount.findMany({
        where: { organizationId: organization.id, enabled: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.dharma.findMany({
        where: { organizationId: organization.id, enabled: true },
        include: { bankAccount: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.transaction.groupBy({
        by: ["dharmaId"],
        where: {
          organizationId: organization.id,
          type: "CREDIT",
          dharmaId: { not: null },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.findMany({
        where: { organizationId: organization.id, ...(type ? { type } : {}) },
        orderBy: { transactionTime: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          amount: true,
          transactionTime: true,
          narrative: true,
          displayName: true,
          bankAccount: { select: { accountNo: true } },
          dharma: { select: { name: true } },
        },
      }),
    ]);
  const incomeTotal = Number(
    totals.find((item) => item.type === "CREDIT")?._sum.amount || 0,
  );
  const expenseTotal = Number(
    totals.find((item) => item.type === "DEBIT")?._sum.amount || 0,
  );
  const groupedMap = new Map(
    grouped.map((row) => [
      row.dharmaId,
      { amount: Number(row._sum.amount || 0), count: row._count },
    ]),
  );
  const cards: [string, number, LucideIcon, string][] = [
    ["Tổng thu", incomeTotal, ArrowDownLeft, "text-[#176b46]"],
    ["Tổng chi", expenseTotal, ArrowUpRight, "text-red-700"],
    [
      "Số dư thu − chi",
      incomeTotal - expenseTotal,
      HandCoins,
      "text-[#48617e]",
    ],
  ];

  return (
    <PublicShell
      organizationName={organization.name}
      homeHref={`/minh-bach/${slug}`}
    >
      <section className="mb-8">
        <p className="text-xs font-semibold tracking-widest text-[#176b46]">
          BÁO CÁO CÔNG KHAI
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold mt-2">
          Dòng tiền thiện pháp
        </h1>
        <p className="text-[#718078] mt-3">
          Công khai các khoản thu, chi và mục đích thiện pháp của{" "}
          {organization.name}.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {accounts.map((account) => (
            <span key={account.id} className="badge badge-gray">
              TK {account.accountNo} · {account.name}
            </span>
          ))}
        </div>
      </section>
      <section className="grid sm:grid-cols-3 gap-4 mb-8">
        {cards.map(([label, value, Icon, color]) => (
          <div key={label} className="card p-5">
            <Icon className={color} size={20} />
            <p className="text-sm text-[#718078] mt-4">{label}</p>
            <p className="text-2xl font-semibold mt-1">{money.format(value)}</p>
          </div>
        ))}
      </section>
      <section className="card mb-8">
        <div className="p-5 border-b border-[#e3e9e5]">
          <h2 className="text-xl font-semibold">Các thiện pháp</h2>
        </div>
        <div className="divide-y divide-[#edf1ee] sm:hidden">
          {transactions.map((item) => (
            <article key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">
                    {item.displayName || "Không xác định"}
                  </p>
                  <p className="text-xs text-[#7a867e] mt-1">
                    {dateTime.format(item.transactionTime)} · TK{" "}
                    {item.bankAccount.accountNo}
                  </p>
                </div>
                <p
                  className={`shrink-0 font-semibold ${item.type === "CREDIT" ? "text-[#176b46]" : "text-red-700"}`}
                >
                  {item.type === "CREDIT" ? "+" : "−"}
                  {money.format(Number(item.amount))}
                </p>
              </div>
              <p className="text-sm break-words mt-3">{item.narrative}</p>
              <p className="text-xs text-[#176b46] mt-2">
                {item.dharma?.name || "Chưa phân loại"}
              </p>
            </article>
          ))}
          {!transactions.length && (
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
                <th>Thiện pháp</th>
                <th>Tài khoản</th>
                <th>Mã phân loại</th>
                <th>Khoản thu</th>
                <th className="text-right">Tổng thu</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dharmas.map((dharma) => {
                const stats = groupedMap.get(dharma.id);
                return (
                  <tr key={dharma.id}>
                    <td className="font-medium">{dharma.name}</td>
                    <td>{dharma.bankAccount.accountNo}</td>
                    <td>
                      <span className="badge badge-green">{dharma.code}</span>
                    </td>
                    <td>{stats?.count || 0}</td>
                    <td className="text-right font-semibold text-[#176b46] whitespace-nowrap">
                      {money.format(stats?.amount || 0)}
                    </td>
                    <td>
                      <Link
                        href={`/minh-bach/${slug}/${dharma.publicSlug}`}
                        className="text-sm font-medium text-[#176b46] hover:underline whitespace-nowrap"
                      >
                        Xem chi tiết →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!dharmas.length && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[#7a867e]">
                    Chưa có thiện pháp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <div className="p-5 border-b border-[#e3e9e5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg">Sao kê gần nhất</h2>
            <p className="text-sm text-[#7a867e] mt-1">
              Hiển thị 50 giao dịch gần nhất.
            </p>
          </div>
          <PublicTransactionTabs activeType={type} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Nội dung</th>
                <th>Thiện pháp</th>
                <th className="text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => (
                <tr key={item.id}>
                  <td>
                    {dateTime.format(item.transactionTime)}
                    <p className="text-xs text-[#8a948e] mt-1">
                      TK {item.bankAccount.accountNo}
                    </p>
                  </td>
                  <td>
                    <p className="break-words">{item.narrative}</p>
                    <p className="text-xs text-[#8a948e] mt-1">
                      {item.displayName}
                    </p>
                  </td>
                  <td>
                    {item.dharma ? (
                      <span className="badge badge-green">
                        {item.dharma.name}
                      </span>
                    ) : (
                      <span className="badge badge-gray">Chưa phân loại</span>
                    )}
                  </td>
                  <td
                    className={`text-right font-semibold whitespace-nowrap ${item.type === "CREDIT" ? "text-[#176b46]" : "text-red-700"}`}
                  >
                    {item.type === "CREDIT" ? "+" : "−"}
                    {money.format(Number(item.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PublicShell>
  );
}
