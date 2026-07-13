import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  HandCoins,
} from "lucide-react";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { dateTime, money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ slug: string; dharmaId: string }>;
  searchParams: Promise<{ type?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, dharmaId } = await params;
  const dharma = await prisma.dharma.findFirst({
    where: {
      OR: [{ publicSlug: dharmaId }, { id: dharmaId }],
      organization: { slug, enabled: true },
    },
    select: { name: true },
  });
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
  const dharma = await prisma.dharma.findFirst({
    where: {
      OR: [{ publicSlug: dharmaId }, { id: dharmaId }],
      enabled: true,
      organization: { slug, enabled: true },
    },
    include: { organization: true, bankAccount: true },
  });
  if (!dharma) notFound();
  const type =
    filters.type === "CREDIT" || filters.type === "DEBIT"
      ? filters.type
      : undefined;
  const [income, expense, transactions] = await Promise.all([
    prisma.transaction.aggregate({
      where: { dharmaId: dharma.id, type: "CREDIT" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { dharmaId: dharma.id, type: "DEBIT" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.findMany({
      where: { dharmaId: dharma.id, ...(type ? { type } : {}) },
      orderBy: { transactionTime: "desc" },
      take: 100,
    }),
  ]);
  const incomeTotal = Number(income._sum.amount || 0);
  const expenseTotal = Number(expense._sum.amount || 0);

  return (
    <PublicShell
      organizationName={dharma.organization.name}
      homeHref={`/minh-bach/${slug}`}
    >
      <Link
        href={`/minh-bach/${slug}`}
        className="inline-flex items-center gap-2 text-sm text-[#176b46] font-medium mb-6"
      >
        <ArrowLeft size={16} /> Tất cả thiện pháp
      </Link>
      <section className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="badge badge-green">{dharma.code}</span>
          {dharma.aliases.map((alias) => (
            <span key={alias} className="badge badge-gray">
              {alias}
            </span>
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold">{dharma.name}</h1>
        <p className="text-[#718078] mt-3">
          Tài khoản tiếp nhận: {dharma.bankAccount.name} ·{" "}
          {dharma.bankAccount.accountNo}
        </p>
        {dharma.bankAccount.statementUrl && (
          <a
            href={dharma.bankAccount.statementUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex mt-3 text-sm font-medium text-[#176b46] hover:underline"
          >
            Xem sao kê gốc trên Thiện Nguyện ↗
          </a>
        )}
      </section>
      <section className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <ArrowDownLeft className="text-[#176b46]" size={20} />
          <p className="text-sm text-[#718078] mt-4">Tổng thu</p>
          <p className="text-2xl font-semibold mt-1">
            {money.format(incomeTotal)}
          </p>
          <p className="text-xs text-[#8a948e] mt-1">
            {income._count} giao dịch
          </p>
        </div>
        <div className="card p-5">
          <ArrowUpRight className="text-red-700" size={20} />
          <p className="text-sm text-[#718078] mt-4">Tổng chi</p>
          <p className="text-2xl font-semibold mt-1">
            {money.format(expenseTotal)}
          </p>
          <p className="text-xs text-[#8a948e] mt-1">
            {expense._count} giao dịch
          </p>
        </div>
        <div className="card p-5">
          <HandCoins className="text-[#48617e]" size={20} />
          <p className="text-sm text-[#718078] mt-4">Còn lại</p>
          <p className="text-2xl font-semibold mt-1">
            {money.format(incomeTotal - expenseTotal)}
          </p>
        </div>
      </section>
      <section className="card">
        <div className="p-5 border-b border-[#e3e9e5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg">Giao dịch của thiện pháp</h2>
            <p className="text-sm text-[#7a867e] mt-1">
              Các khoản đã được phân loại tự động hoặc thủ công.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              className={`btn ${!type ? "btn-primary" : "btn-soft"}`}
              href={`/minh-bach/${slug}/${dharma.publicSlug}`}
            >
              Tất cả
            </Link>
            <Link
              className={`btn ${type === "CREDIT" ? "btn-primary" : "btn-soft"}`}
              href="?type=CREDIT"
            >
              Thu
            </Link>
            <Link
              className={`btn ${type === "DEBIT" ? "btn-primary" : "btn-soft"}`}
              href="?type=DEBIT"
            >
              Chi
            </Link>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Nội dung</th>
                <th>Người giao dịch</th>
                <th className="text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap">
                    {dateTime.format(item.transactionTime)}
                    <p className="text-xs text-[#8a948e] mt-1">{item.refId}</p>
                  </td>
                  <td className="max-w-xl">
                    <p className="line-clamp-2">{item.narrative}</p>
                  </td>
                  <td>{item.displayName || "Không xác định"}</td>
                  <td
                    className={`text-right font-semibold whitespace-nowrap ${item.type === "CREDIT" ? "text-[#176b46]" : "text-red-700"}`}
                  >
                    {item.type === "CREDIT" ? "+" : "−"}
                    {money.format(Number(item.amount))}
                  </td>
                </tr>
              ))}
              {!transactions.length && (
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
