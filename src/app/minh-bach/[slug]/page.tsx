import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, HandCoins, type LucideIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { dateTime, money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ type?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const organization = await prisma.organization.findFirst({ where: { slug, enabled: true }, select: { name: true } });
  return { title: organization ? `Minh bạch — ${organization.name}` : "Trang minh bạch" };
}

export default async function PublicOrganizationPage({ params, searchParams }: Props) {
  const [{ slug }, filters] = await Promise.all([params, searchParams]);
  const organization = await prisma.organization.findFirst({ where: { slug, enabled: true } });
  if (!organization) notFound();
  const type = filters.type === "CREDIT" || filters.type === "DEBIT" ? filters.type : undefined;
  const [income, expense, accounts, dharmas, grouped, transactions] = await Promise.all([
    prisma.transaction.aggregate({ where: { organizationId: organization.id, type: "CREDIT" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { organizationId: organization.id, type: "DEBIT" }, _sum: { amount: true } }),
    prisma.bankAccount.findMany({ where: { organizationId: organization.id, enabled: true }, orderBy: { createdAt: "asc" } }),
    prisma.dharma.findMany({ where: { organizationId: organization.id, enabled: true }, include: { bankAccount: true }, orderBy: { createdAt: "asc" } }),
    prisma.transaction.groupBy({ by: ["dharmaId"], where: { organizationId: organization.id, type: "CREDIT", dharmaId: { not: null } }, _sum: { amount: true }, _count: true }),
    prisma.transaction.findMany({ where: { organizationId: organization.id, ...(type ? { type } : {}) }, include: { bankAccount: true, dharma: true }, orderBy: { transactionTime: "desc" }, take: 100 }),
  ]);
  const incomeTotal = Number(income._sum.amount || 0);
  const expenseTotal = Number(expense._sum.amount || 0);
  const groupedMap = new Map(grouped.map(row => [row.dharmaId, { amount: Number(row._sum.amount || 0), count: row._count }]));
  const cards: [string, number, LucideIcon, string][] = [
    ["Tổng thu", incomeTotal, ArrowDownLeft, "text-[#176b46]"],
    ["Tổng chi", expenseTotal, ArrowUpRight, "text-red-700"],
    ["Số dư thu − chi", incomeTotal - expenseTotal, HandCoins, "text-[#48617e]"],
  ];

  return <PublicShell organizationName={organization.name} homeHref={`/minh-bach/${slug}`}>
    <section className="mb-8"><p className="text-xs font-semibold tracking-widest text-[#176b46]">BÁO CÁO CÔNG KHAI</p><h1 className="text-3xl md:text-4xl font-semibold mt-2">Dòng tiền thiện pháp</h1><p className="text-[#718078] mt-3">Công khai các khoản thu, chi và mục đích thiện pháp của {organization.name}.</p><div className="flex flex-wrap gap-2 mt-4">{accounts.map(account => <span key={account.id} className="badge badge-gray">TK {account.accountNo} · {account.name}</span>)}</div></section>
    <section className="grid sm:grid-cols-3 gap-4 mb-8">{cards.map(([label,value,Icon,color]) => <div key={label} className="card p-5"><Icon className={color} size={20}/><p className="text-sm text-[#718078] mt-4">{label}</p><p className="text-2xl font-semibold mt-1">{money.format(value)}</p></div>)}</section>
    <section className="card mb-8"><div className="p-5 border-b border-[#e3e9e5]"><h2 className="text-xl font-semibold">Các thiện pháp</h2></div><div className="table-wrap"><table><thead><tr><th>Thiện pháp</th><th>Tài khoản</th><th>Mã phân loại</th><th>Khoản thu</th><th className="text-right">Tổng thu</th><th></th></tr></thead><tbody>{dharmas.map(dharma => { const stats=groupedMap.get(dharma.id); return <tr key={dharma.id}><td className="font-medium">{dharma.name}</td><td>{dharma.bankAccount.accountNo}</td><td><span className="badge badge-green">{dharma.code}</span></td><td>{stats?.count || 0}</td><td className="text-right font-semibold text-[#176b46] whitespace-nowrap">{money.format(stats?.amount || 0)}</td><td><Link href={`/minh-bach/${slug}/${dharma.id}`} className="text-sm font-medium text-[#176b46] hover:underline whitespace-nowrap">Xem chi tiết →</Link></td></tr>; })}{!dharmas.length && <tr><td colSpan={6} className="text-center py-10 text-[#7a867e]">Chưa có thiện pháp.</td></tr>}</tbody></table></div></section>
    <section className="card"><div className="p-5 border-b border-[#e3e9e5] flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-semibold text-lg">Sao kê gần nhất</h2><p className="text-sm text-[#7a867e] mt-1">Hiển thị tối đa 100 giao dịch.</p></div><div className="flex gap-2"><Link className={`btn ${!type ? "btn-primary" : "btn-soft"}`} href={`/minh-bach/${slug}`}>Tất cả</Link><Link className={`btn ${type === "CREDIT" ? "btn-primary" : "btn-soft"}`} href={`?type=CREDIT`}>Thu</Link><Link className={`btn ${type === "DEBIT" ? "btn-primary" : "btn-soft"}`} href={`?type=DEBIT`}>Chi</Link></div></div><div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>Nội dung</th><th>Thiện pháp</th><th className="text-right">Số tiền</th></tr></thead><tbody>{transactions.map(item => <tr key={item.id}><td className="whitespace-nowrap">{dateTime.format(item.transactionTime)}<p className="text-xs text-[#8a948e] mt-1">TK {item.bankAccount.accountNo}</p></td><td className="max-w-xl"><p className="line-clamp-2">{item.narrative}</p><p className="text-xs text-[#8a948e] mt-1">{item.displayName}</p></td><td>{item.dharma ? <span className="badge badge-green">{item.dharma.name}</span> : <span className="badge badge-gray">Chưa phân loại</span>}</td><td className={`text-right font-semibold whitespace-nowrap ${item.type === "CREDIT" ? "text-[#176b46]" : "text-red-700"}`}>{item.type === "CREDIT" ? "+" : "−"}{money.format(Number(item.amount))}</td></tr>)}</tbody></table></div></section>
  </PublicShell>;
}
