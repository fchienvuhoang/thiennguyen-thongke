import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Pencil, ReceiptText, TriangleAlert } from "lucide-react";
import { classifyTransactionAction, createDharmaAction, updateDharmaAction } from "@/app/actions";
import { DeleteDharmaForm } from "@/components/delete-dharma-form";
import { PageHeader } from "@/components/page-header";
import { PublicLink } from "@/components/public-link";
import { requireSession } from "@/lib/auth";
import { dateTime, money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Filters = { type?: string; status?: string; account?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const session = await requireSession();
  if (session.systemRole === "SUPER_ADMIN") redirect("/dashboard/admin");
  const filters = await searchParams;
  const organizationId = session.organizationId;
  const transactionWhere: Prisma.TransactionWhereInput = {
    organizationId,
    ...(filters.type === "CREDIT" || filters.type === "DEBIT" ? { type: filters.type } : {}),
    ...(filters.status === "UNMATCHED" ? { classificationStatus: { in: ["UNMATCHED", "AMBIGUOUS"] } } : {}),
    ...(filters.account ? { bankAccountId: filters.account } : {}),
  };

  const [organization, accounts, dharmas, transactionCount, income, expense, unmatched, transactions, filteredTotal, incomeByDharma] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.bankAccount.findMany({ where: { organizationId }, include: { _count: { select: { transactions: true, dharmas: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.dharma.findMany({ where: { organizationId }, include: { bankAccount: true }, orderBy: { createdAt: "desc" } }),
    prisma.transaction.count({ where: { organizationId } }),
    prisma.transaction.aggregate({ where: { organizationId, type: "CREDIT" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { organizationId, type: "DEBIT" }, _sum: { amount: true } }),
    prisma.transaction.count({ where: { organizationId, classificationStatus: { in: ["UNMATCHED", "AMBIGUOUS"] } } }),
    prisma.transaction.findMany({ where: transactionWhere, include: { bankAccount: true, dharma: true }, orderBy: { transactionTime: "desc" }, take: 100 }),
    prisma.transaction.count({ where: transactionWhere }),
    prisma.transaction.groupBy({ by: ["dharmaId"], where: { organizationId, type: "CREDIT", dharmaId: { not: null } }, _sum: { amount: true }, _count: true }),
  ]);
  const incomeMap = new Map(incomeByDharma.map((row) => [row.dharmaId, { amount: Number(row._sum.amount || 0), count: row._count }]));
  const incomeTotal = Number(income._sum.amount || 0);
  const expenseTotal = Number(expense._sum.amount || 0);
  const cards = [
    ["Tổng thu", money.format(incomeTotal), ArrowDownLeft, "bg-[#e7f3ed] text-[#176b46]"],
    ["Tổng chi", money.format(expenseTotal), ArrowUpRight, "bg-[#fff0e9] text-[#ad5b36]"],
    ["Số dư thu − chi", money.format(incomeTotal - expenseTotal), ReceiptText, "bg-[#edf1f7] text-[#48617e]"],
    ["Chưa phân loại", unmatched.toLocaleString("vi-VN"), TriangleAlert, "bg-[#fff1d7] text-[#9a6412]"],
  ] as const;

  return <>
    <PageHeader eyebrow="TRUNG TÂM QUẢN LÝ" title="Dòng tiền thiện pháp" description="Theo dõi, cấu hình và phân loại giao dịch tại một nơi." action={<div className="flex flex-wrap gap-2"><a className="btn btn-soft" href="#thien-phap">Thiện pháp</a><a className="btn btn-soft" href="#cau-hinh">Cấu hình</a><a className="btn btn-primary" href="#giao-dich">Các giao dịch</a></div>} />

    <section className="card p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-l-[#d9a441]"><div><p className="text-xs font-semibold tracking-wider text-[#9a6b1a]">TRANG MINH BẠCH CÔNG KHAI</p><h2 className="font-semibold mt-1">{organization.name}</h2><p className="text-sm text-[#718078] mt-1">Thí chủ có thể xem thu, chi và các thiện pháp mà không cần đăng nhập.</p></div><PublicLink href={`/minh-bach/${organization.slug}`} /></section>

    <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {cards.map(([label, value, Icon, color]) => <div className="card p-5" key={label}><div className={`size-10 rounded-xl grid place-items-center ${color}`}><Icon size={20} /></div><p className="text-[#718078] text-sm mt-5">{label}</p><p className="text-2xl font-semibold mt-1">{value}</p></div>)}
    </section>

    <section id="thien-phap" className="card mb-8 scroll-mt-24">
      <div className="p-5 border-b border-[#e3e9e5]"><h2 className="font-semibold text-lg">Tổng thu các thiện pháp</h2><p className="text-sm text-[#7a867e] mt-1">Tổng hợp từ các giao dịch CREDIT đã được phân loại.</p></div>
      <div className="table-wrap"><table><thead><tr><th>Thiện pháp</th><th>Tài khoản</th><th>Mã chính</th><th>Mã phụ</th><th>Giao dịch</th><th className="text-right">Tổng thu</th><th>Link công khai</th></tr></thead><tbody>{dharmas.map((dharma) => { const stats = incomeMap.get(dharma.id); return <tr key={dharma.id}><td className="font-medium">{dharma.name}</td><td>{dharma.bankAccount.accountNo}</td><td><span className="badge badge-green">{dharma.code}</span></td><td><div className="flex flex-wrap gap-1">{dharma.aliases.length ? dharma.aliases.map(alias => <span key={alias} className="badge badge-gray">{alias}</span>) : <span className="text-xs text-[#9aa39d]">—</span>}</div></td><td>{stats?.count || 0}</td><td className="text-right font-semibold text-[#176b46] whitespace-nowrap">{money.format(stats?.amount || 0)}</td><td><PublicLink compact href={`/minh-bach/${organization.slug}/${dharma.id}`} /></td></tr>; })}{!dharmas.length && <tr><td colSpan={7} className="text-center py-10 text-[#7a867e]">Chưa có thiện pháp.</td></tr>}</tbody></table></div>
    </section>

    <section id="cau-hinh" className="scroll-mt-24 mb-8">
      <div className="mb-4"><h2 className="text-xl font-semibold">Cấu hình đồng bộ và phân loại</h2><p className="text-sm text-[#7a867e] mt-1">Quản lý tài khoản nguồn và mã nhận diện thiện pháp.</p></div>
      <div className="grid xl:grid-cols-2 gap-6">
        <div className="card"><div className="p-5 border-b border-[#e3e9e5]"><h3 className="font-semibold">Tài khoản thiện nguyện</h3><p className="text-sm text-[#7a867e] mt-1">Các tài khoản do quản trị hệ thống cấp; dữ liệu được đồng bộ tự động.</p></div><div className="table-wrap"><table><thead><tr><th>Tên tài khoản</th><th>Số TK</th><th>Giao dịch</th><th>Thiện pháp</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id}><td className="font-medium">{account.name}</td><td>{account.accountNo}</td><td>{account._count.transactions}</td><td>{account._count.dharmas}</td></tr>)}{!accounts.length && <tr><td colSpan={4} className="text-center py-8 text-[#8a948e]">Chưa được cấp tài khoản.</td></tr>}</tbody></table></div></div>

        <div className="card p-5"><h3 className="font-semibold">Thêm thiện pháp</h3><form action={createDharmaAction} className="grid sm:grid-cols-2 gap-3 mt-4"><select className="input" name="bankAccountId" required><option value="">Chọn tài khoản</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name} — {account.accountNo}</option>)}</select><input className="input" name="name" required placeholder="Tên thiện pháp" /><input className="input" name="code" required placeholder="Mã chính" /><input className="input" name="aliases" placeholder="Mã phụ, cách nhau dấu phẩy" /><button className="btn btn-primary sm:col-span-2">Tạo thiện pháp</button></form></div>
      </div>

      <div className="card table-wrap mt-6"><table><thead><tr><th>Thiện pháp</th><th>Tài khoản</th><th>Mã chính</th><th>Mã phụ</th><th>Thao tác</th></tr></thead><tbody>{dharmas.map(dharma => <tr key={dharma.id}><td className="font-medium">{dharma.name}</td><td>{dharma.bankAccount.accountNo}</td><td><span className="badge badge-green">{dharma.code}</span></td><td><div className="flex flex-wrap gap-1">{dharma.aliases.length ? dharma.aliases.map(alias => <span key={alias} className="badge badge-gray">{alias}</span>) : <span className="text-xs text-[#9aa39d]">Chưa cấu hình</span>}</div></td><td><details className="min-w-72"><summary className="list-none btn btn-soft py-2"><Pencil size={14}/> Sửa</summary><form action={updateDharmaAction} className="space-y-2 mt-3"><input type="hidden" name="id" value={dharma.id}/><input className="input py-2" name="name" required defaultValue={dharma.name}/><input className="input py-2" name="code" required defaultValue={dharma.code}/><input className="input py-2" name="aliases" defaultValue={dharma.aliases.join(", ")}/><button className="btn btn-primary w-full py-2">Lưu thay đổi</button></form><div className="flex justify-end mt-2"><DeleteDharmaForm id={dharma.id} name={dharma.name}/></div></details></td></tr>)}</tbody></table></div>
    </section>

    <section id="giao-dich" className="card scroll-mt-24">
      <div className="p-5 border-b border-[#e3e9e5]"><div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"><div><h2 className="font-semibold text-lg">Các giao dịch</h2><p className="text-sm text-[#7a867e] mt-1">{filteredTotal.toLocaleString("vi-VN")} kết quả · hiển thị tối đa 100 giao dịch gần nhất.</p></div><form className="flex flex-wrap gap-2" action="/dashboard#giao-dich"><select className="input w-auto" name="type" defaultValue={filters.type || "ALL"}><option value="ALL">Tất cả thu/chi</option><option value="CREDIT">Khoản thu</option><option value="DEBIT">Khoản chi</option></select><select className="input w-auto" name="status" defaultValue={filters.status || "ALL"}><option value="ALL">Mọi phân loại</option><option value="UNMATCHED">Chưa phân loại</option></select><select className="input w-auto" name="account" defaultValue={filters.account || ""}><option value="">Mọi tài khoản</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.accountNo}</option>)}</select><button className="btn btn-primary">Lọc</button></form></div></div>
      <div className="table-wrap"><table><thead><tr><th>Thời gian / Loại</th><th>Nội dung</th><th>Thiện pháp / Phân loại thủ công</th><th className="text-right">Số tiền</th></tr></thead><tbody>{transactions.map(transaction => { const options = dharmas.filter(dharma => dharma.bankAccountId === transaction.bankAccountId); return <tr key={transaction.id}><td className="whitespace-nowrap"><p>{dateTime.format(transaction.transactionTime)}</p><span className={`badge mt-2 ${transaction.type === "CREDIT" ? "badge-green" : "bg-red-50 text-red-700"}`}>{transaction.type === "CREDIT" ? "THU" : "CHI"}</span><span className="text-xs text-[#7a867e] ml-2">TK {transaction.bankAccount.accountNo}</span></td><td className="max-w-xl"><p className="line-clamp-2">{transaction.narrative}</p><p className="text-xs text-[#8a948e] mt-1">{transaction.displayName || transaction.refId}</p></td><td><form action={classifyTransactionAction} className="flex gap-2 min-w-72"><input type="hidden" name="transactionId" value={transaction.id} /><select className="input py-2" name="dharmaId" defaultValue={transaction.dharmaId || ""}><option value="">Chưa phân loại</option>{options.map(dharma => <option key={dharma.id} value={dharma.id}>{dharma.name}</option>)}</select><button className="btn btn-soft py-2">Gán</button></form>{transaction.manuallyClassified && <span className="text-[11px] text-[#176b46]">Đã gán thủ công</span>}</td><td className={`text-right font-semibold whitespace-nowrap ${transaction.type === "CREDIT" ? "text-[#176b46]" : "text-red-700"}`}>{transaction.type === "CREDIT" ? "+" : "−"}{money.format(Number(transaction.amount))}</td></tr>; })}{!transactions.length && <tr><td colSpan={4} className="text-center py-12 text-[#7a867e]">Không có giao dịch phù hợp.</td></tr>}</tbody></table></div>
    </section>
    <p className="text-center text-xs text-[#8a948e] mt-6">{transactionCount.toLocaleString("vi-VN")} giao dịch đã lưu trong hệ thống</p>
  </>;
}
