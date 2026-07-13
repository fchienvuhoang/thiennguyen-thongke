import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  ReceiptText,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import {
  classifyTransactionAction,
  createCustomerUserAction,
  createDharmaAction,
  updateDharmaAction,
} from "@/app/actions";
import { DeleteDharmaForm } from "@/components/delete-dharma-form";
import { OrganizationManagementModals } from "@/components/organization-management-modals";
import { PageHeader } from "@/components/page-header";
import { PublicLink } from "@/components/public-link";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth";
import { dateTime, money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Filters = {
  type?: string;
  status?: string;
  account?: string;
  tab?: string;
  page?: string;
};

const TRANSACTIONS_PER_PAGE = 25;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const session = await requireSession();
  if (session.systemRole === "SUPER_ADMIN") redirect("/dashboard/admin");
  const filters = await searchParams;
  const organizationId = session.organizationId;
  const activeTab =
    filters.tab || (filters.status === "UNMATCHED" ? "unmatched" : "all");
  const currentPage = Math.max(1, Number.parseInt(filters.page || "1", 10) || 1);
  const transactionWhere: Prisma.TransactionWhereInput = {
    organizationId,
    ...(filters.type === "CREDIT" || filters.type === "DEBIT"
      ? { type: filters.type }
      : {}),
    ...(activeTab === "unmatched"
      ? { dharmaId: null }
      : activeTab !== "all"
        ? { dharmaId: activeTab }
      : {}),
    ...(filters.account ? { bankAccountId: filters.account } : {}),
  };

  const [
    organization,
    accounts,
    dharmas,
    members,
    transactionCount,
    income,
    expense,
    unmatched,
    transactions,
    filteredTotal,
    incomeByDharma,
  ] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.bankAccount.findMany({
      where: { organizationId },
      include: { _count: { select: { transactions: true, dharmas: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dharma.findMany({
      where: { organizationId },
      include: {
        bankAccount: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.membership.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
    }),
    prisma.transaction.count({ where: { organizationId } }),
    prisma.transaction.aggregate({
      where: { organizationId, type: "CREDIT" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { organizationId, type: "DEBIT" },
      _sum: { amount: true },
    }),
    prisma.transaction.count({
      where: {
        organizationId,
        dharmaId: null,
      },
    }),
    prisma.transaction.findMany({
      where: transactionWhere,
      include: {
        bankAccount: true,
        dharma: true,
        classificationLogs: { orderBy: { createdAt: "desc" }, take: 3 },
      },
      orderBy: { transactionTime: "desc" },
      skip: (currentPage - 1) * TRANSACTIONS_PER_PAGE,
      take: TRANSACTIONS_PER_PAGE,
    }),
    prisma.transaction.count({ where: transactionWhere }),
    prisma.transaction.groupBy({
      by: ["dharmaId"],
      where: { organizationId, type: "CREDIT", dharmaId: { not: null } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  const incomeMap = new Map(
    incomeByDharma.map((row) => [
      row.dharmaId,
      { amount: Number(row._sum.amount || 0), count: row._count },
    ]),
  );
  const incomeTotal = Number(income._sum.amount || 0);
  const expenseTotal = Number(expense._sum.amount || 0);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTotal / TRANSACTIONS_PER_PAGE),
  );
  const transactionUrl = (tab: string, page = 1) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (filters.type === "CREDIT" || filters.type === "DEBIT")
      params.set("type", filters.type);
    if (filters.account) params.set("account", filters.account);
    if (page > 1) params.set("page", String(page));
    return `/dashboard?${params.toString()}#giao-dich`;
  };
  const cards = [
    [
      "Tổng thu",
      money.format(incomeTotal),
      ArrowDownLeft,
      "bg-[#e7f3ed] text-[#176b46]",
    ],
    [
      "Tổng chi",
      money.format(expenseTotal),
      ArrowUpRight,
      "bg-[#fff0e9] text-[#ad5b36]",
    ],
    [
      "Số dư thu − chi",
      money.format(incomeTotal - expenseTotal),
      ReceiptText,
      "bg-[#edf1f7] text-[#48617e]",
    ],
    [
      "Chưa phân loại",
      unmatched.toLocaleString("vi-VN"),
      TriangleAlert,
      "bg-[#fff1d7] text-[#9a6412]",
    ],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="TRUNG TÂM QUẢN LÝ"
        title="Dòng tiền thiện pháp"
        description="Theo dõi, cấu hình và phân loại giao dịch tại một nơi."
        action={
          <div className="flex flex-wrap gap-2">
            <OrganizationManagementModals
              accounts={accounts}
              members={members}
              canManageMembers={session.organizationRole === "ADMIN"}
            />
            <a className="btn btn-primary" href="#giao-dich">
              Các giao dịch
            </a>
          </div>
        }
      />

      <section className="card px-4 py-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-4 border-l-[#d9a441]">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[#9a6b1a]">
            TRANG MINH BẠCH CÔNG KHAI
          </p>
          <h2 className="font-semibold mt-1">{organization.name}</h2>
          <p className="text-sm text-[#718078] mt-1">
            Thí chủ có thể xem thu, chi và các thiện pháp mà không cần đăng
            nhập.
          </p>
        </div>
        <PublicLink href={`/minh-bach/${organization.slug}`} />
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {cards.map(([label, value, Icon, color]) => (
          <div className="card px-4 py-3 flex items-center gap-3" key={label}>
            <div
              className={`size-9 shrink-0 rounded-xl grid place-items-center ${color}`}
            >
              <Icon size={18} />
            </div>
            <div><p className="text-[#718078] text-xs">{label}</p><p className="text-lg font-semibold leading-tight mt-0.5">{value}</p></div>
          </div>
        ))}
      </section>

      <section id="thien-phap" className="card mb-5 scroll-mt-24">
        <div className="px-4 py-3 border-b border-[#e3e9e5]">
          <h2 className="font-semibold text-lg">Tổng thu các thiện pháp</h2>
          <p className="text-sm text-[#7a867e] mt-1">
            Tổng hợp từ các giao dịch CREDIT đã được phân loại.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thiện pháp</th>
                <th>Tài khoản</th>
                <th>Mã chính</th>
                <th>Mã phụ</th>
                <th>Giao dịch</th>
                <th className="text-right">Tổng thu</th>
                <th>Link công khai</th>
                <th>Quản lý</th>
              </tr>
            </thead>
            <tbody>
              {dharmas.map((dharma) => {
                const stats = incomeMap.get(dharma.id);
                return (
                  <tr key={dharma.id}>
                    <td className="font-medium">{dharma.name}</td>
                    <td>{dharma.bankAccount.accountNo}</td>
                    <td>
                      <span className="badge badge-green">{dharma.code}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {dharma.aliases.length ? (
                          dharma.aliases.map((alias) => (
                            <span key={alias} className="badge badge-gray">
                              {alias}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#9aa39d]">—</span>
                        )}
                      </div>
                    </td>
                    <td>{stats?.count || 0}</td>
                    <td className="text-right font-semibold text-[#176b46] whitespace-nowrap">
                      {money.format(stats?.amount || 0)}
                    </td>
                    <td>
                      <PublicLink
                        compact
                        href={`/minh-bach/${organization.slug}/${dharma.publicSlug}`}
                      />
                    </td>
                    <td>
                      <details className="min-w-64">
                        <summary className="list-none btn btn-soft py-1.5">
                          <Pencil size={14} /> Sửa
                        </summary>
                        <form action={updateDharmaAction} className="space-y-2 mt-2">
                          <input type="hidden" name="id" value={dharma.id} />
                          <input className="input py-1.5" name="name" required defaultValue={dharma.name} />
                          <input className="input py-1.5" name="code" required defaultValue={dharma.code} />
                          <input className="input py-1.5" name="aliases" defaultValue={dharma.aliases.join(", ")} />
                          <SubmitButton pendingText="Đang lưu..." className="btn btn-primary w-full py-1.5">Lưu thay đổi</SubmitButton>
                        </form>
                        <div className="flex justify-end mt-2"><DeleteDharmaForm id={dharma.id} name={dharma.name} /></div>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {!dharmas.length && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-[#7a867e]">
                    Chưa có thiện pháp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <details id="cau-hinh" className="card scroll-mt-24 mb-5">
        <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">Tài khoản nguồn đồng bộ</h2><p className="text-xs text-[#7a867e] mt-0.5">Bấm để xem thông tin tài khoản thiện nguyện.</p></div>
          <span className="badge badge-gray">{accounts.length} tài khoản</span>
        </summary>
        <div className="border-t border-[#e3e9e5]">
          <div className="border-0">
            <div className="px-4 py-2.5 border-b border-[#e3e9e5]">
              <h3 className="font-semibold">Tài khoản thiện nguyện</h3>
              <p className="text-sm text-[#7a867e] mt-1">
                Các tài khoản do quản trị hệ thống cấp; dữ liệu được đồng bộ tự
                động.
              </p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên tài khoản</th>
                    <th>Số TK</th>
                    <th>Giao dịch</th>
                    <th>Thiện pháp</th>
                    <th>Sao kê gốc</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td className="font-medium">{account.name}</td>
                      <td>{account.accountNo}</td>
                      <td>{account._count.transactions}</td>
                      <td>{account._count.dharmas}</td>
                      <td>
                        {account.statementUrl ? (
                          <a
                            href={account.statementUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#176b46] font-medium hover:underline whitespace-nowrap"
                          >
                            Xem sao kê ↗
                          </a>
                        ) : (
                          <span className="text-[#9aa39d]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!accounts.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-8 text-[#8a948e]"
                      >
                        Chưa được cấp tài khoản.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="hidden card p-5">
            <h3 className="font-semibold">Thêm thiện pháp</h3>
            <form
              action={createDharmaAction}
              className="grid sm:grid-cols-2 gap-3 mt-4"
            >
              <select className="input" name="bankAccountId" required>
                <option value="">Chọn tài khoản</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} — {account.accountNo}
                  </option>
                ))}
              </select>
              <input
                className="input"
                name="name"
                required
                placeholder="Tên thiện pháp"
              />
              <input
                className="input"
                name="code"
                required
                placeholder="Mã chính"
              />
              <input
                className="input"
                name="aliases"
                placeholder="Mã phụ, cách nhau dấu phẩy"
              />
              <SubmitButton pendingText="Đang tạo..." className="btn btn-primary sm:col-span-2">
                Tạo thiện pháp
              </SubmitButton>
            </form>
          </div>
        </div>

        <div className="hidden card table-wrap mt-6">
          <table>
            <thead>
              <tr>
                <th>Thiện pháp</th>
                <th>Tài khoản</th>
                <th>Mã chính</th>
                <th>Mã phụ</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {dharmas.map((dharma) => (
                <tr key={dharma.id}>
                  <td className="font-medium">{dharma.name}</td>
                  <td>{dharma.bankAccount.accountNo}</td>
                  <td>
                    <span className="badge badge-green">{dharma.code}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {dharma.aliases.length ? (
                        dharma.aliases.map((alias) => (
                          <span key={alias} className="badge badge-gray">
                            {alias}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#9aa39d]">
                          Chưa cấu hình
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <details className="min-w-72">
                      <summary className="list-none btn btn-soft py-2">
                        <Pencil size={14} /> Sửa
                      </summary>
                      <form
                        action={updateDharmaAction}
                        className="space-y-2 mt-3"
                      >
                        <input type="hidden" name="id" value={dharma.id} />
                        <input
                          className="input py-2"
                          name="name"
                          required
                          defaultValue={dharma.name}
                        />
                        <input
                          className="input py-2"
                          name="code"
                          required
                          defaultValue={dharma.code}
                        />
                        <input
                          className="input py-2"
                          name="aliases"
                          defaultValue={dharma.aliases.join(", ")}
                        />
                        <SubmitButton pendingText="Đang lưu..." className="btn btn-primary w-full py-2">
                          Lưu thay đổi
                        </SubmitButton>
                      </form>
                      <div className="flex justify-end mt-2">
                        <DeleteDharmaForm id={dharma.id} name={dharma.name} />
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="hidden card mt-6">
          <div className="p-5 border-b border-[#e3e9e5] flex items-center gap-3">
            <UserPlus size={19} className="text-[#176b46]" />
            <div>
              <h3 className="font-semibold">Thành viên tổ chức</h3>
              <p className="text-sm text-[#7a867e] mt-1">
                Email được thêm tại đây có thể đăng nhập bằng tài khoản Gmail tương ứng; không yêu cầu domain riêng.
              </p>
            </div>
          </div>
          <div className="grid lg:grid-cols-[1fr_1fr]">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Thành viên</th><th>Quyền</th><th>Đăng nhập Google</th></tr></thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td><p className="font-medium">{member.user.name}</p><p className="text-xs text-[#7a867e] mt-1">{member.user.email}</p></td>
                      <td><span className="badge badge-gray">{member.role === "ADMIN" ? "Quản trị" : "Thành viên"}</span></td>
                      <td>{member.user.googleSubject ? <span className="badge badge-green">Đã liên kết</span> : <span className="badge badge-gray">Chưa đăng nhập</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {session.organizationRole === "ADMIN" && (
              <form action={createCustomerUserAction} className="p-5 space-y-3 border-t lg:border-t-0 lg:border-l border-[#e3e9e5]">
                <h4 className="font-semibold">Thêm tài khoản Google</h4>
                <p className="text-sm text-[#7a867e]">Thêm trước địa chỉ Gmail của thành viên; tổ chức trong app không liên quan đến domain email.</p>
                <input className="input" name="name" required placeholder="Tên thành viên" />
                <input className="input" type="email" name="email" required placeholder="email@gmail.com" />
                <select className="input" name="role" defaultValue="MEMBER">
                  <option value="MEMBER">Thành viên</option>
                  <option value="ADMIN">Quản trị tổ chức</option>
                </select>
                <SubmitButton pendingText="Đang thêm..." className="btn btn-primary w-full">Thêm thành viên</SubmitButton>
              </form>
            )}
          </div>
        </div>
      </details>

      <section id="giao-dich" className="card scroll-mt-24">
        <div className="px-4 py-3 border-b border-[#e3e9e5]">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <h2 className="font-semibold text-lg">Các giao dịch</h2>
              <p className="text-sm text-[#7a867e] mt-1">
                {filteredTotal.toLocaleString("vi-VN")} kết quả · trang {currentPage}
                /{totalPages}.
              </p>
            </div>
            <form
              className="flex flex-wrap gap-2"
              action="/dashboard#giao-dich"
            >
              <input type="hidden" name="tab" value={activeTab} />
              <select
                className="input w-auto"
                name="type"
                defaultValue={filters.type || "ALL"}
              >
                <option value="ALL">Tất cả thu/chi</option>
                <option value="CREDIT">Khoản thu</option>
                <option value="DEBIT">Khoản chi</option>
              </select>
              <select
                className="input w-auto"
                name="account"
                defaultValue={filters.account || ""}
              >
                <option value="">Mọi tài khoản</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountNo}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary">Lọc</button>
            </form>
          </div>
          <nav
            className="flex gap-2 overflow-x-auto mt-5 pb-1"
            aria-label="Phân loại giao dịch"
          >
            <a
              href={transactionUrl("all")}
              className={`btn py-2 whitespace-nowrap ${activeTab === "all" ? "btn-primary" : "btn-soft"}`}
            >
              Tất cả
              <span className="text-xs opacity-75">
                {transactionCount.toLocaleString("vi-VN")}
              </span>
            </a>
            <a
              href={transactionUrl("unmatched")}
              className={`btn py-2 whitespace-nowrap border border-[#efc56f] ${activeTab === "unmatched" ? "bg-[#d99a24] text-white" : "bg-[#fff1d7] text-[#8a590d]"}`}
            >
              <TriangleAlert size={15} /> Chưa phân loại
              <span className="text-xs opacity-80">
                {unmatched.toLocaleString("vi-VN")}
              </span>
            </a>
            {dharmas.map((dharma) => (
              <a
                key={dharma.id}
                href={transactionUrl(dharma.id)}
                className={`btn py-2 whitespace-nowrap ${activeTab === dharma.id ? "btn-primary" : "btn-soft"}`}
              >
                {dharma.name}
                <span className="text-xs opacity-75">
                  {dharma._count.transactions.toLocaleString("vi-VN")}
                </span>
              </a>
            ))}
          </nav>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời gian / Loại</th>
                <th>Nội dung</th>
                <th>Thiện pháp / Phân loại thủ công</th>
                <th className="text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const options = dharmas.filter(
                  (dharma) =>
                    dharma.bankAccountId === transaction.bankAccountId,
                );
                return (
                  <tr key={transaction.id}>
                    <td className="whitespace-nowrap">
                      <p>{dateTime.format(transaction.transactionTime)}</p>
                      <span
                        className={`badge mt-2 ${transaction.type === "CREDIT" ? "badge-green" : "bg-red-50 text-red-700"}`}
                      >
                        {transaction.type === "CREDIT" ? "THU" : "CHI"}
                      </span>
                      <span className="text-xs text-[#7a867e] ml-2">
                        TK {transaction.bankAccount.accountNo}
                      </span>
                    </td>
                    <td className="max-w-xl">
                      <p className="line-clamp-2">{transaction.narrative}</p>
                      <p className="text-xs text-[#8a948e] mt-1">
                        {transaction.displayName || transaction.refId}
                      </p>
                    </td>
                    <td>
                      <form
                        action={classifyTransactionAction}
                        className="flex gap-2 min-w-72"
                      >
                        <input
                          type="hidden"
                          name="transactionId"
                          value={transaction.id}
                        />
                        <select
                          className="input py-2"
                          name="dharmaId"
                          defaultValue={transaction.dharmaId || ""}
                        >
                          <option value="">Chưa phân loại</option>
                          {options.map((dharma) => (
                            <option key={dharma.id} value={dharma.id}>
                              {dharma.name}
                            </option>
                          ))}
                        </select>
                        <SubmitButton pendingText="Đang gán..." className="btn btn-soft py-2">Gán</SubmitButton>
                      </form>
                      <div className="mt-2">
                        {transaction.manuallyClassified ? (
                          <span className="badge badge-green">
                            Thủ công · {transaction.classifiedByEmail || "Tài khoản cũ"}
                          </span>
                        ) : transaction.dharmaId ? (
                          <span className="badge badge-gray">Hệ thống tự động gán</span>
                        ) : (
                          <span className="badge badge-amber">Hệ thống chưa nhận diện</span>
                        )}
                        {transaction.classifiedAt && (
                          <span className="block text-[11px] text-[#7a867e] mt-1">
                            {dateTime.format(transaction.classifiedAt)}
                          </span>
                        )}
                      </div>
                      {transaction.classificationLogs.length > 0 && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-[#176b46] font-medium">
                            Lịch sử phân loại ({transaction.classificationLogs.length} gần nhất)
                          </summary>
                          <div className="mt-2 space-y-2 border-l-2 border-[#dfe6e1] pl-3">
                            {transaction.classificationLogs.map((log) => (
                              <div key={log.id}>
                                <p className="font-medium">
                                  {log.source === "MANUAL"
                                    ? `Thủ công · ${log.actorEmail || "Không rõ tài khoản"}`
                                    : "Hệ thống tự động"}
                                </p>
                                <p className="text-[#68756d]">
                                  {log.previousDharmaName || "Chưa phân loại"} → {log.newDharmaName || "Chưa phân loại"}
                                </p>
                                <p className="text-[#8a948e]">{dateTime.format(log.createdAt)}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </td>
                    <td
                      className={`text-right font-semibold whitespace-nowrap ${transaction.type === "CREDIT" ? "text-[#176b46]" : "text-red-700"}`}
                    >
                      {transaction.type === "CREDIT" ? "+" : "−"}
                      {money.format(Number(transaction.amount))}
                    </td>
                  </tr>
                );
              })}
              {!transactions.length && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-[#7a867e]">
                    Không có giao dịch phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#e3e9e5] flex items-center justify-between gap-3">
            {currentPage > 1 ? (
              <a
                className="btn btn-soft py-2"
                href={transactionUrl(activeTab, currentPage - 1)}
              >
                ← Trang trước
              </a>
            ) : (
              <span />
            )}
            <span className="text-sm text-[#68756d]">
              Trang {currentPage} / {totalPages}
            </span>
            {currentPage < totalPages ? (
              <a
                className="btn btn-soft py-2"
                href={transactionUrl(activeTab, currentPage + 1)}
              >
                Trang sau →
              </a>
            ) : (
              <span />
            )}
          </div>
        )}
      </section>
      <p className="text-center text-xs text-[#8a948e] mt-6">
        {transactionCount.toLocaleString("vi-VN")} giao dịch đã lưu trong hệ
        thống
      </p>
    </>
  );
}
