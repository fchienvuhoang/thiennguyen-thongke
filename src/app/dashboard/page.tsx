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
  createCustomerUserAction,
  createDharmaAction,
  updateDharmaAction,
} from "@/app/actions";
import { DeleteDharmaForm } from "@/components/delete-dharma-form";
import { OrganizationManagementModals } from "@/components/organization-management-modals";
import { PageHeader } from "@/components/page-header";
import { PublicLink } from "@/components/public-link";
import { SubmitButton } from "@/components/submit-button";
import { TransactionsPanel } from "@/components/transactions-panel";
import { requireSession } from "@/lib/auth";
import { money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Filters = {
  type?: string;
  status?: string;
  account?: string;
  tab?: string;
  page?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const session = await requireSession();
  if (session.systemRole === "SUPER_ADMIN") redirect("/dashboard/admin");
  const filters = await searchParams;
  const organizationId = session.organizationId;

  const [
    organization,
    accounts,
    dharmas,
    members,
    transactionStats,
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
    prisma.transaction.groupBy({
      by: ["type", "dharmaId"],
      where: { organizationId },
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  const transactionCount = transactionStats.reduce(
    (sum, row) => sum + row._count,
    0,
  );
  const incomeTotal = transactionStats
    .filter((row) => row.type === "CREDIT")
    .reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
  const expenseTotal = transactionStats
    .filter((row) => row.type === "DEBIT")
    .reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
  const unmatched = transactionStats
    .filter((row) => row.dharmaId === null)
    .reduce((sum, row) => sum + row._count, 0);
  const incomeMap = new Map(
    transactionStats.filter((row) => row.type === "CREDIT" && row.dharmaId).map((row) => [
      row.dharmaId,
      { amount: Number(row._sum.amount || 0), count: row._count },
    ]),
  );
  const originalStatementUrl = accounts.find(
    (account) => account.statementUrl,
  )?.statementUrl;
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
        {originalStatementUrl ? (
          <PublicLink
            href={originalStatementUrl}
            label="Xem trang Thiện Nguyện gốc"
          />
        ) : (
          <span className="text-sm text-[#9a6412]">
            Chưa cấu hình link Thiện Nguyện gốc
          </span>
        )}
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

      <TransactionsPanel
        accounts={accounts.map((account) => ({
          id: account.id,
          accountNo: account.accountNo,
        }))}
        dharmas={dharmas.map((dharma) => ({
          id: dharma.id,
          name: dharma.name,
          bankAccountId: dharma.bankAccountId,
          transactionCount: dharma._count.transactions,
        }))}
        initialFilters={{
          tab:
            filters.tab ||
            (filters.status === "UNMATCHED" ? "unmatched" : "all"),
          type:
            filters.type === "CREDIT" || filters.type === "DEBIT"
              ? filters.type
              : "ALL",
          account: filters.account || "",
          page: Math.max(
            1,
            Number.parseInt(filters.page || "1", 10) || 1,
          ),
        }}
        initialCounts={{ all: transactionCount, unmatched }}
      />
      <p className="text-center text-xs text-[#8a948e] mt-6">
        {transactionCount.toLocaleString("vi-VN")} giao dịch đã lưu trong hệ
        thống
      </p>
    </>
  );
}
